import { describe, expect, it } from "vitest";
import { createYarnSchema } from "@/lib/validation/yarn";

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    name: "Merino Fino",
    manufacturer: "Drops",
    quantity_grams: 100,
    composition: "",
    ...overrides,
  };
}

describe("createYarnSchema quantity validation", () => {
  it("accepts quantity_skeins of 0 without quantity_grams", () => {
    const result = createYarnSchema.safeParse(baseInput({ quantity_skeins: 0, quantity_grams: undefined }));
    expect(result.success).toBe(true);
  });

  it("rejects a negative quantity_skeins", () => {
    const result = createYarnSchema.safeParse(baseInput({ quantity_skeins: -1 }));
    expect(result.success).toBe(false);
  });
});
