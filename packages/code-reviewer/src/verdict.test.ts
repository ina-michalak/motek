import { describe, expect, it } from "vitest";
import { CRITERIA } from "./criteria";
import type { Review } from "./schema";
import { computeVerdict, PASS_THRESHOLD } from "./verdict";

function buildReview(scores: Record<string, number>): Review {
  return Object.fromEntries(CRITERIA.map((c) => [c.id, { score: scores[c.id], rationale: "test" }]));
}

describe("computeVerdict", () => {
  it("returns pass when every criterion is exactly at the threshold", () => {
    const scores = Object.fromEntries(CRITERIA.map((c) => [c.id, PASS_THRESHOLD]));
    expect(computeVerdict(buildReview(scores))).toBe("pass");
  });

  it("returns fail when a single criterion is one point below the threshold and the rest are maxed out", () => {
    const scores = Object.fromEntries(CRITERIA.map((c) => [c.id, 10]));
    scores[CRITERIA[0].id] = PASS_THRESHOLD - 1;
    expect(computeVerdict(buildReview(scores))).toBe("fail");
  });

  it("returns pass when all criteria score above the threshold", () => {
    const scores = Object.fromEntries(CRITERIA.map((c) => [c.id, 10]));
    expect(computeVerdict(buildReview(scores))).toBe("pass");
  });
});
