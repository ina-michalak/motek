import { describe, expect, it } from "vitest";
import { isYarnExhausted } from "@/lib/utils";

describe("isYarnExhausted", () => {
  it("returns true when both quantities are zero", () => {
    expect(isYarnExhausted({ quantity_skeins: 0, quantity_grams: 0 })).toBe(true);
  });

  it("returns true when the only defined quantity is zero", () => {
    expect(isYarnExhausted({ quantity_skeins: 0, quantity_grams: null })).toBe(true);
  });

  it("returns false when no quantity was ever set", () => {
    expect(isYarnExhausted({ quantity_skeins: null, quantity_grams: null })).toBe(false);
  });

  it("returns false when at least one defined quantity is nonzero", () => {
    expect(isYarnExhausted({ quantity_skeins: 5, quantity_grams: 0 })).toBe(false);
  });
});
