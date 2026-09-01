import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";

const profiles = {
  cria: {
    label: "Cria",
    description: "Prioriza reprodução, habilidade materna e desmama.",
    defaultWeights: { reproduction: 45, weaning: 30, growth: 10, carcass: 15 },
    metrics: { reproduction: ["STAY", "3P"], weaning: ["MP120", "3P"], growth: ["MP120"], carcass: ["P450", "AOL", "ACAB"] },
  },
  pasture: {
    label: "Recria e engorda a pasto",
    description: "Equilibra crescimento, permanência e carcaça em sistema de pasto.",
    defaultWeights: { reproduction: 20, weaning: 20, growth: 35, carcass: 25 },
    metrics: { reproduction: ["STAY"], weaning: ["MP120"], growth: ["P210", "P450", "PE365"], carcass: ["AOL", "ACAB"] },
  },
  confinement: {
    label: "Confinamento",
    description: "Foca peso, carcaça e eficiência para terminação intensiva.",
    defaultWeights: { reproduction: 10, weaning: 15, growth: 35, carcass: 40 },
    metrics: { reproduction: ["STAY"], weaning: ["MP120"], growth: ["P450"], carcass: ["AOL", "ACAB", "P450"] },
  },
  f1: {
    label: "F1",
    description: "Perfil para animais cruzados com ênfase em peso e carcaça.",
    defaultWeights: { reproduction: 15, weaning: 15, growth: 30, carcass: 40 },
    metrics: { reproduction: ["STAY"], weaning: ["MP120"], growth: ["P450"], carcass: ["AOL", "ACAB", "P450"] },
  },
} as const;

type ProfileKey = keyof typeof profiles;
type PriorityKey = "reproduction" | "weaning" | "growth" | "carcass";
type Animal = Record<string, string | number | boolean | null>;

function csvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function parseValue(value: string) {
  const clean = value.trim();
  if (!clean) return null;
  if (/^-?\d+(\.\d+)?$/.test(clean)) return Number(clean);
  return clean;
}

export function addAvailabilityFlags(row: Animal): Animal {
  const metricNames = Array.from(new Set(Object.keys(row).filter(key => /(?:dep|ac|top_pct)$/.test(key)).map(key => key.replace(/(?:dep|ac|top_pct)$/, ""))));
  metricNames.forEach(metric => {
    row[`${metric}_available`] = ["dep", "ac", "top_pct"].some(suffix => row[`${metric}${suffix}`] !== null && row[`${metric}${suffix}`] !== undefined);
  });
  return row;
}

function loadAnimals(): Animal[] {
  const candidates = [
    path.resolve(process.cwd(), "server/data/ancp/generated/animal_records_one_row_per_animal.csv"),
    path.resolve(process.cwd(), "server/data/ancp/animal_records_one_row_per_animal.csv"),
    path.resolve(process.cwd(), "dist/data/ancp/generated/animal_records_one_row_per_animal.csv"),
  ];
  const file = candidates.find(candidate => fs.existsSync(candidate));
  if (!file) return [];
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = csvLine(lines[0]).map((header, index) => index === 0 ? header.replace(/^\uFEFF/, "") : header);
  return lines.slice(1).map(line => {
    const values = csvLine(line);
    const row = headers.reduce<Animal>((result, header, index) => {
      result[header] = parseValue(values[index] ?? "");
      return result;
    }, {});
    return addAvailabilityFlags(row);
  });
}

const animals = loadAnimals();

type TableInfo = { file: string; page: number; breed: string; rows: number; columns: number; metrics: string[]; layout: string };
function loadTableCatalog(): TableInfo[] {
  const dir = path.resolve(process.cwd(), "server/data/ancp/tables");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(file => /^page_\\d+__.+\\.csv$/.test(file)).map(file => {
    const match = file.match(/^page_(\\d+)__(.+)\\.csv$/);
    const page = match ? Number(match[1]) : 0;
    const layout = match?.[2] ?? file.replace(/\\.csv$/, "");
    const rows = fs.readFileSync(path.join(dir, file), "utf8").split(/\\r?\\n/).filter(Boolean);
    const headers = rows.length ? csvLine(rows[0]) : [];
    const breed = rows.length > 1 ? String(csvLine(rows[1])[0] ?? "") : "";
    const metrics = Array.from(new Set(headers.filter(header => /(?:dep|ac|top_pct)$/.test(header)).map(header => header.replace(/(?:dep|ac|top_pct)$/, ""))));
    return { file, page, breed, rows: Math.max(0, rows.length - 1), columns: headers.length, metrics, layout };
  }).sort((a, b) => a.page - b.page);
}
const tableCatalog = loadTableCatalog();
const metricPrefixes = ["3P", "MP120", "MP210", "P210", "P450", "PE365", "AOL", "ACAB", "STAY", "MGTe", "MGTe_CR", "MGTe_RE"];

function numeric(row: Animal, column: string) {
  const value = row[column];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function matchingColumns(row: Animal, prefix: string, suffix: "dep" | "ac" | "top_pct") {
  return metricPrefixes
    .filter(metric => metric === prefix || metric.startsWith(prefix))
    .map(metric => `${metric}${suffix}`)
    .filter(column => column in row);
}

function metricValue(row: Animal, prefixes: readonly string[], suffix: "dep" | "top_pct") {
  for (const prefix of prefixes) {
    const columns = matchingColumns(row, prefix, suffix);
    for (const column of columns) {
      const value = numeric(row, column);
      if (value !== null) return { value, column };
    }
  }
  return null;
}

function normalize(value: number, values: number[], inverse = false) {
  if (values.length < 2) return 0.5;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return 0.5;
  const normalized = (value - min) / (max - min);
  return inverse ? 1 - normalized : normalized;
}

function makePriorityScore(row: Animal, key: PriorityKey, profile: typeof profiles[ProfileKey], pool: Animal[]) {
  const prefixes = profile.metrics[key];
  const options = pool.map(candidate => metricValue(candidate, prefixes, "dep")).filter(Boolean) as { value: number; column: string }[];
  const topOptions = pool.map(candidate => metricValue(candidate, prefixes, "top_pct")).filter(Boolean) as { value: number; column: string }[];
  const dep = metricValue(row, prefixes, "dep");
  const top = metricValue(row, prefixes, "top_pct");
  const depScore = dep ? normalize(dep.value, options.map(item => item.value)) : null;
  const topScore = top ? normalize(top.value, topOptions.map(item => item.value), true) : null;
  const score = depScore !== null && topScore !== null ? depScore * 0.65 + topScore * 0.35 : depScore ?? topScore ?? 0;
  return { score, metric: dep?.column.replace(/dep$/, "") ?? top?.column.replace(/top_pct$/, "") ?? prefixes[0], available: dep !== null || top !== null };
}

const weightsInput = z.object({ reproduction: z.number().min(0).max(100), weaning: z.number().min(0).max(100), growth: z.number().min(0).max(100), carcass: z.number().min(0).max(100) }).superRefine((weights, context) => {
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (total !== 100) context.addIssue({ code: z.ZodIssueCode.custom, message: "A soma dos pesos deve ser exatamente 100" });
});

const recommendationInput = z.object({
  breed: z.string().default("Todas"),
  profile: z.enum(["cria", "pasture", "confinement", "f1"]).default("cria"),
  weights: weightsInput,
  minAccuracy: z.number().min(0).max(100).default(0),
  maxTop: z.number().min(0).max(100).default(100),
  protectReproduction: z.boolean().default(true),
  requiredMetrics: z.array(z.string()).default([]),
  protectedLimits: z.record(z.string(), z.number()).default({}),
  limit: z.number().int().min(1).max(30).default(10),
});

function availableMetrics(rows: Animal[]) {
  return metricPrefixes.filter(metric => rows.some(row => numeric(row, `${metric}dep`) !== null || numeric(row, `${metric}top_pct`) !== null));
}

function recommend(input: z.infer<typeof recommendationInput>) {
  const profile = profiles[input.profile];
  const base = input.breed === "Todas" ? animals : animals.filter(row => row.breed === input.breed);
  const filtered = base.filter(row => {
    const accuracyColumns = Object.keys(row).filter(key => key.endsWith("ac"));
    const accuracy = accuracyColumns.map(key => numeric(row, key)).filter((value): value is number => value !== null);
    const topValues = Object.keys(row).filter(key => key.endsWith("top_pct")).map(key => numeric(row, key)).filter((value): value is number => value !== null);
    const accuracyOk = input.minAccuracy === 0 || accuracy.length === 0 || Math.max(...accuracy) >= input.minAccuracy;
    const topOk = input.maxTop >= 100 || topValues.length === 0 || Math.min(...topValues) <= input.maxTop;
    const reproductionOk = !input.protectReproduction || numeric(row, "STAYdep") !== null || numeric(row, "3Pdep") !== null || numeric(row, "STAYtop_pct") !== null;
    const requiredOk = input.requiredMetrics.every(metric => numeric(row, `${metric}dep`) !== null || numeric(row, `${metric}top_pct`) !== null);
    const protectedOk = Object.entries(input.protectedLimits).every(([metric, limit]) => {
      const value = numeric(row, `${metric}dep`);
      return value === null || value >= limit;
    });
    return accuracyOk && topOk && reproductionOk && requiredOk && protectedOk;
  });
  const pool = filtered.length ? filtered : base;
  const total = Object.values(input.weights).reduce((sum, value) => sum + value, 0);
  const normalizedWeights = Object.fromEntries(Object.entries(input.weights).map(([key, value]) => [key, total ? value / total : 0.25])) as Record<PriorityKey, number>;
  const ranked = pool.map(row => {
    const contributions = (Object.keys(normalizedWeights) as PriorityKey[]).map(key => {
      const result = makePriorityScore(row, key, profile, pool);
      return { key, label: { reproduction: "Reprodução", weaning: "Desmama", growth: "Crescimento", carcass: "Carcaça" }[key], score: result.score, weight: normalizedWeights[key], contribution: result.score * normalizedWeights[key] * 100, metric: result.metric, available: result.available };
    });
    const score = contributions.reduce((sum, item) => sum + item.contribution, 0);
    const alerts = contributions.filter(item => !item.available).map(item => `${item.label}: métrica não publicada nesta tabela`);
    const tradeoffs = contributions.filter(item => item.available && item.score < 0.35).map(item => `Aderência menor em ${item.label}`);
    const metricAvailability = Object.fromEntries(Object.keys(row).filter(key => key.endsWith("_available")).map(key => [key.replace(/_available$/, ""), row[key] === true]));
    return { id: String(row.animal_id ?? ""), name: String(row.animal_name ?? "Registro sem nome"), breed: String(row.breed ?? ""), score: Math.round(score * 10) / 10, sire: String(row.sire ?? "—"), sourcePage: row.source_page ?? row.source_pages ?? "—", contributions, alerts, tradeoffs, availability: Object.fromEntries(contributions.map(item => [item.key, item.available])), metricAvailability };
  }).sort((a, b) => b.score - a.score).slice(0, input.limit);
  return { profile: input.profile, profileLabel: profile.label, totalBase: base.length, totalFiltered: filtered.length, metrics: availableMetrics(base), recommendations: ranked, weightsTotal: total, dataEdition: "ANCP 2026", note: "Pontuação indicativa baseada nos registros públicos extraídos e normalizados por raça nesta edição." };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  ancp: router({
    overview: publicProcedure.query(() => ({ edition: "ANCP 2026", records: animals.length, breeds: Array.from(new Set(animals.map(row => String(row.breed ?? "").trim()).filter(Boolean))).sort(), metrics: availableMetrics(animals), source: "Sumário de Touros ANCP 2026" })),
    tables: publicProcedure.input(z.object({ breed: z.string().optional(), metric: z.string().optional() }).default({})).query(({ input }) => tableCatalog.filter(table => (!input.breed || table.breed === input.breed) && (!input.metric || table.metrics.includes(input.metric)))),
    table: publicProcedure.input(z.object({ page: z.number().int().min(1) })).query(({ input }) => tableCatalog.find(table => table.page === input.page) ?? null),
    profiles: publicProcedure.query(() => Object.entries(profiles).map(([id, profile]) => ({ id, label: profile.label, description: profile.description, defaultWeights: profile.defaultWeights }))),
    recommend: publicProcedure.input(recommendationInput).query(({ input }) => recommend(input)),
  }),
});

export type AppRouter = typeof appRouter;
