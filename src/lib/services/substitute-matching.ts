import type { Yarn } from "@/types";

export const MIN_SUBSTITUTE_SCORE = 50;

const COMPOSITION_WEIGHT = 40;
const SIZE_WEIGHT = 40;
const COLOR_WEIGHT = 20;

function scoreComposition(a: Yarn, b: Yarn): number | null {
  if (!a.composition || a.composition.length === 0 || !b.composition || b.composition.length === 0) return null;

  const percentsByFiber = new Map<string, { a: number; b: number }>();
  for (const row of a.composition) {
    const entry = percentsByFiber.get(row.fiber) ?? { a: 0, b: 0 };
    entry.a += row.percent;
    percentsByFiber.set(row.fiber, entry);
  }
  for (const row of b.composition) {
    const entry = percentsByFiber.get(row.fiber) ?? { a: 0, b: 0 };
    entry.b += row.percent;
    percentsByFiber.set(row.fiber, entry);
  }

  let totalDiff = 0;
  for (const { a: percentA, b: percentB } of percentsByFiber.values()) {
    totalDiff += Math.abs(percentA - percentB);
  }

  return Math.max(0, 1 - totalDiff / 200);
}

function scoreSizeDiff(sizeA: number, sizeB: number): number {
  const diff = Math.abs(sizeA - sizeB);
  return diff <= 0.5 ? 1 : Math.max(0, 1 - (diff - 0.5) / 2);
}

function scoreSize(a: Yarn, b: Yarn): number | null {
  const scores: number[] = [];
  if (a.needle_size_mm !== null && b.needle_size_mm !== null) {
    scores.push(scoreSizeDiff(a.needle_size_mm, b.needle_size_mm));
  }
  if (a.hook_size_mm !== null && b.hook_size_mm !== null) {
    scores.push(scoreSizeDiff(a.hook_size_mm, b.hook_size_mm));
  }
  if (scores.length === 0) return null;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function scoreColor(a: Yarn, b: Yarn): number | null {
  if (!a.color || !b.color) return null;
  const colorA = a.color.trim().toLowerCase();
  const colorB = b.color.trim().toLowerCase();
  if (colorA === colorB) return 1;
  if (colorA.includes(colorB) || colorB.includes(colorA)) return 0.5;
  return 0;
}

/**
 * Waga podwymiarów sumuje się do 100% tylko gdy wszystkie są porównywalne;
 * gdy część wymiarów jest pomijana (brak danych po którejś stronie), pozostałe
 * wagi są renormalizowane tak, by nadal sumować się do 100%.
 */
export function scoreYarnSimilarity(a: Yarn, b: Yarn): number | null {
  const dimensions: { score: number | null; weight: number }[] = [
    { score: scoreComposition(a, b), weight: COMPOSITION_WEIGHT },
    { score: scoreSize(a, b), weight: SIZE_WEIGHT },
    { score: scoreColor(a, b), weight: COLOR_WEIGHT },
  ];

  const available = dimensions.filter(
    (dimension): dimension is { score: number; weight: number } => dimension.score !== null,
  );
  if (available.length === 0) return null;

  const totalWeight = available.reduce((sum, dimension) => sum + dimension.weight, 0);
  const weightedSum = available.reduce((sum, dimension) => sum + (dimension.weight / totalWeight) * dimension.score, 0);

  return Math.round(100 * weightedSum);
}
