import type { Review } from "./schema";

export const PASS_THRESHOLD = 6;

export function computeVerdict(review: Review): "pass" | "fail" {
  const isFail = Object.values(review).some((r) => r.score < PASS_THRESHOLD);
  return isFail ? "fail" : "pass";
}
