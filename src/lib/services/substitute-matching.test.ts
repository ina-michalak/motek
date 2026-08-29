import { describe, expect, it } from "vitest";
import { MIN_SUBSTITUTE_SCORE, scoreYarnSimilarity } from "@/lib/services/substitute-matching";
import type { Yarn } from "@/types";

let nextId = 1;

function makeYarn(overrides: Partial<Yarn> = {}): Yarn {
  const id = String(nextId++);
  return {
    id,
    user_id: "user-1",
    name: `Yarn ${id}`,
    manufacturer: "Drops",
    quantity_skeins: 1,
    quantity_grams: null,
    color: null,
    dye_lot: null,
    composition: null,
    needle_size_mm: null,
    hook_size_mm: null,
    gauge_note: null,
    rating: null,
    note: null,
    photo_url: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("scoreYarnSimilarity", () => {
  it("returns ~100 for identical parameters", () => {
    const a = makeYarn({
      composition: [{ fiber: "Wełna", percent: 100 }],
      needle_size_mm: 4,
      color: "Niebieski",
    });
    const b = makeYarn({
      composition: [{ fiber: "Wełna", percent: 100 }],
      needle_size_mm: 4,
      color: "Niebieski",
    });

    expect(scoreYarnSimilarity(a, b)).toBe(100);
  });

  it("returns a low score below the threshold for disjoint composition and out-of-tolerance size", () => {
    const a = makeYarn({
      composition: [{ fiber: "Wełna", percent: 100 }],
      needle_size_mm: 3,
    });
    const b = makeYarn({
      composition: [{ fiber: "Akryl", percent: 100 }],
      needle_size_mm: 8,
    });

    const score = scoreYarnSimilarity(a, b);
    if (score === null) throw new Error("expected a non-null score");
    expect(score).toBeLessThan(MIN_SUBSTITUTE_SCORE);
  });

  it("gives full size score exactly at the 0.5mm tolerance boundary", () => {
    const a = makeYarn({ needle_size_mm: 4 });
    const b = makeYarn({ needle_size_mm: 4.5 });

    expect(scoreYarnSimilarity(a, b)).toBe(100);
  });

  it("gives a reduced size score just past the 0.5mm tolerance boundary", () => {
    const a = makeYarn({ needle_size_mm: 4 });
    const b = makeYarn({ needle_size_mm: 4.6 });

    const score = scoreYarnSimilarity(a, b);
    if (score === null) throw new Error("expected a non-null score");
    expect(score).toBeLessThan(100);
  });

  it("skips composition and renormalizes weights when missing on one side", () => {
    const a = makeYarn({ composition: [{ fiber: "Wełna", percent: 100 }], needle_size_mm: 4, color: "Czerwony" });
    const b = makeYarn({ composition: null, needle_size_mm: 4, color: "Czerwony" });

    expect(scoreYarnSimilarity(a, b)).toBe(100);
  });

  it("returns null when no dimension is comparable", () => {
    const a = makeYarn();
    const b = makeYarn();

    expect(scoreYarnSimilarity(a, b)).toBeNull();
  });

  it("skips the size dimension when different size types are filled on each side", () => {
    const a = makeYarn({ needle_size_mm: 4, hook_size_mm: null, color: "Zielony" });
    const b = makeYarn({ needle_size_mm: null, hook_size_mm: 4, color: "Zielony" });

    expect(scoreYarnSimilarity(a, b)).toBe(100);
  });

  it("scores an exact color match as a full match", () => {
    const a = makeYarn({ color: "Niebieski" });
    const b = makeYarn({ color: "niebieski" });

    expect(scoreYarnSimilarity(a, b)).toBe(100);
  });

  it("scores a substring color match as a partial match", () => {
    const a = makeYarn({ color: "Niebieski" });
    const b = makeYarn({ color: "Ciemny niebieski" });

    expect(scoreYarnSimilarity(a, b)).toBe(50);
  });

  it("scores an unrelated color as no match", () => {
    const a = makeYarn({ color: "Niebieski" });
    const b = makeYarn({ color: "Czerwony" });

    expect(scoreYarnSimilarity(a, b)).toBe(0);
  });
});
