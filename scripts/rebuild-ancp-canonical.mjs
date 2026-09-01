import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const tableDir = path.join(root, "server/data/ancp/tables");
const outDir = path.join(root, "server/data/ancp/generated");
fs.mkdirSync(outDir, { recursive: true });

function parseCsvLine(line) {
  const cells = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { value += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) { cells.push(value); value = ""; }
    else value += char;
  }
  cells.push(value);
  return cells;
}
function csvEscape(value) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
function parseValue(value) {
  const clean = String(value ?? "").trim();
  if (!clean) return "";
  if (/^-?\d+(\.\d+)?$/.test(clean)) return Number(clean);
  return clean;
}
const files = fs.readdirSync(tableDir).filter(file => /^page_\d+__.+\.csv$/.test(file)).sort();
const audit = [];
const rowsByAnimal = new Map();
const metricSet = new Set();
for (const file of files) {
  const page = Number(file.match(/^page_(\d+)/)?.[1] ?? 0);
  const lines = fs.readFileSync(path.join(tableDir, file), "utf8").split(/\r?\n/).filter(Boolean);
  const headers = (lines[0] ? parseCsvLine(lines[0]) : []).map((header, i) => i === 0 ? header.replace(/^\uFEFF/, "") : header);
  const rows = [];
  let rejected = 0;
  for (const line of lines.slice(1)) {
    const values = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, i) => [header, parseValue(values[i])]));
    if (!row.animal_id || !row.animal_name) { rejected += 1; continue; }
    for (const header of headers) if (/(?:dep|ac|top_pct)$/.test(header)) metricSet.add(header);
    row.source_pages = String(row.source_pages ?? page);
    row.source_page_count = 1;
    rows.push(row);
    const key = `${row.breed ?? ""}::${row.animal_id}`;
    const current = rowsByAnimal.get(key) ?? { ...row, source_pages: new Set(), source_page_count: 0 };
    for (const [keyName, value] of Object.entries(row)) {
      if (value !== "" && value != null && (current[keyName] === "" || current[keyName] == null)) current[keyName] = value;
    }
    for (const sourcePage of String(row.source_pages).split(/[;,]/).map(item => item.trim()).filter(Boolean)) current.source_pages.add(sourcePage);
    current.source_page_count = current.source_pages.size;
    rowsByAnimal.set(key, current);
  }
  audit.push({ file, page, rows_in_file: lines.length - 1, rows_accepted: rows.length, rows_rejected: rejected, status: rejected ? "review_required" : "audited" });
}
const identifiers = ["breed", "animal_id", "birth_month_year", "animal_name", "sex", "sire", "source_pages", "source_page_count"];
const metrics = Array.from(metricSet).sort((a, b) => a.localeCompare(b, "en"));
const headers = [...identifiers, ...metrics];
const animals = Array.from(rowsByAnimal.values()).map(row => {
  const output = { ...row, source_pages: Array.from(row.source_pages).sort((a, b) => Number(a) - Number(b)).join(",") };
  return headers.map(header => output[header] ?? "");
});
const csv = [headers, ...animals].map(row => row.map(csvEscape).join(",")).join("\n") + "\n";
fs.writeFileSync(path.join(outDir, "animal_records_one_row_per_animal.csv"), csv);
fs.writeFileSync(path.join(outDir, "canonical_audit.json"), JSON.stringify({ generated_at: new Date().toISOString(), source: "server/data/ancp/tables", audited_files: files.length, unique_animals: animals.length, duplicate_records_collapsed: audit.reduce((sum, item) => sum + Math.max(0, item.rows_accepted - 1), 0), columns: headers.length, rejected_rows: audit.reduce((sum, item) => sum + item.rows_rejected, 0), tables: audit }, null, 2) + "\n");
console.log(JSON.stringify({ files: files.length, unique_animals: animals.length, columns: headers.length, rejected_rows: audit.reduce((sum, item) => sum + item.rows_rejected, 0) }));
