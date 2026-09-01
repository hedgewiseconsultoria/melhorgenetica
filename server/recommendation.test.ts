import { describe, expect, it } from "vitest";
import { addAvailabilityFlags, appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const ctx = {
  user: null,
  req: {} as TrpcContext["req"],
  res: {} as TrpcContext["res"],
};

describe("ancp recommendation engine", () => {
  it("distinguishes observed zero from an unpublished metric", () => {
    const observed = addAvailabilityFlags({ STAYdep: 0, STAYac: 40, STAYtop_pct: 50 });
    const unpublished = addAvailabilityFlags({ STAYdep: null, STAYac: null, STAYtop_pct: null });
    expect(observed.STAY_available).toBe(true);
    expect(unpublished.STAY_available).toBe(false);
  });
  it("exposes the four production profiles", async () => {
    const result = await appRouter.createCaller(ctx).ancp.profiles();
    expect(result.map(profile => profile.id)).toEqual(["cria", "pasture", "confinement", "f1"]);
  });

  it("rejects priorities that do not sum to 100", async () => {
    await expect(appRouter.createCaller(ctx).ancp.recommend({
      breed: "Todas",
      profile: "cria",
      weights: { reproduction: 50, weaning: 20, growth: 10, carcass: 10 },
      minAccuracy: 35,
      maxTop: 20,
      protectReproduction: true,
      limit: 10,
    })).rejects.toThrow("100");
  });

  it("returns explainable recommendation fields and percentage metadata", async () => {
    const result = await appRouter.createCaller(ctx).ancp.recommend({
      breed: "Todas",
      profile: "cria",
      weights: { reproduction: 45, weaning: 30, growth: 10, carcass: 15 },
      minAccuracy: 0,
      maxTop: 100,
      protectReproduction: false,
      limit: 3,
    });
    expect(result.dataEdition).toBe("ANCP 2026");
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations[0]).toHaveProperty("contributions");
    expect(result.recommendations[0]).toHaveProperty("sourcePage");
    expect(result.recommendations[0]).toHaveProperty("metricAvailability");
    expect(typeof result.recommendations[0].metricAvailability).toBe("object");
  });

  it("changes contribution weight and ranking when priorities change", async () => {
    const caller = appRouter.createCaller(ctx);
    const reproduction = await caller.ancp.recommend({ breed: "Todas", profile: "cria", weights: { reproduction: 70, weaning: 10, growth: 10, carcass: 10 }, minAccuracy: 0, maxTop: 100, protectReproduction: false, limit: 3 });
    const carcass = await caller.ancp.recommend({ breed: "Todas", profile: "cria", weights: { reproduction: 10, weaning: 10, growth: 10, carcass: 70 }, minAccuracy: 0, maxTop: 100, protectReproduction: false, limit: 3 });
    expect(reproduction.weightsTotal).toBe(100);
    expect(carcass.weightsTotal).toBe(100);
    expect(reproduction.recommendations[0]?.contributions.find(item => item.key === "reproduction")?.weight).toBe(0.7);
    expect(carcass.recommendations[0]?.contributions.find(item => item.key === "carcass")?.weight).toBe(0.7);
    expect(reproduction.recommendations.map(item => item.id)).not.toEqual(carcass.recommendations.map(item => item.id));
  });

  it("applies metric, accuracy, TOP and protected-limit filters", async () => {
    const caller = appRouter.createCaller(ctx);
    const base = await caller.ancp.recommend({ breed: "Todas", profile: "cria", weights: { reproduction: 45, weaning: 30, growth: 10, carcass: 15 }, minAccuracy: 0, maxTop: 100, protectReproduction: false, requiredMetrics: [], protectedLimits: {}, limit: 10 });
    const metricFiltered = await caller.ancp.recommend({ breed: "Todas", profile: "cria", weights: { reproduction: 45, weaning: 30, growth: 10, carcass: 15 }, minAccuracy: 0, maxTop: 100, protectReproduction: false, requiredMetrics: ["ACAB"], protectedLimits: {}, limit: 10 });
    const strictFiltered = await caller.ancp.recommend({ breed: "Todas", profile: "cria", weights: { reproduction: 45, weaning: 30, growth: 10, carcass: 15 }, minAccuracy: 100, maxTop: 1, protectReproduction: false, requiredMetrics: [], protectedLimits: { STAY: 100 }, limit: 10 });
    expect(metricFiltered.totalFiltered).toBeLessThanOrEqual(base.totalFiltered);
    expect(strictFiltered.totalFiltered).toBeLessThanOrEqual(base.totalFiltered);
  });

  it("returns trade-off explanations as arrays for every candidate", async () => {
    const result = await appRouter.createCaller(ctx).ancp.recommend({ breed: "Todas", profile: "cria", weights: { reproduction: 45, weaning: 30, growth: 10, carcass: 15 }, minAccuracy: 0, maxTop: 100, protectReproduction: false, limit: 10 });
    expect(result.recommendations.every(candidate => Array.isArray(candidate.tradeoffs))).toBe(true);
    expect(result.recommendations.every(candidate => candidate.contributions.every(item => typeof item.available === "boolean"))).toBe(true);
  });
});
