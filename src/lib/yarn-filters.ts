import { isYarnExhausted } from "@/lib/utils";
import type { Yarn } from "@/types";

export type YarnSortKey =
  | "created_desc"
  | "created_asc"
  | "name_asc"
  | "name_desc"
  | "rating_desc"
  | "rating_asc"
  | "skeins_desc"
  | "skeins_asc"
  | "grams_desc"
  | "grams_asc";

const SORT_KEYS: readonly YarnSortKey[] = [
  "created_desc",
  "created_asc",
  "name_asc",
  "name_desc",
  "rating_desc",
  "rating_asc",
  "skeins_desc",
  "skeins_asc",
  "grams_desc",
  "grams_asc",
];

const DEFAULT_SORT: YarnSortKey = "created_desc";

export interface YarnFilterCriteria {
  manufacturer?: string;
  color?: string;
  fibers?: string[];
  needleSizeMm?: number;
  hookSizeMm?: number;
  hideExhausted?: boolean;
  minSkeins?: number;
  minGrams?: number;
}

export interface YarnFilterOptions {
  manufacturers: string[];
  colors: string[];
  fibers: string[];
  needleSizes: number[];
  hookSizes: number[];
}

type FilterableYarn = Pick<
  Yarn,
  | "manufacturer"
  | "color"
  | "composition"
  | "needle_size_mm"
  | "hook_size_mm"
  | "quantity_skeins"
  | "quantity_grams"
  | "name"
  | "rating"
  | "created_at"
>;

type OptionSourceYarn = Pick<Yarn, "manufacturer" | "color" | "composition" | "needle_size_mm" | "hook_size_mm">;

function parseNumberParam(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isYarnSortKey(value: string): value is YarnSortKey {
  return (SORT_KEYS as string[]).includes(value);
}

export function parseYarnFilters(searchParams: URLSearchParams): { criteria: YarnFilterCriteria; sort: YarnSortKey } {
  const criteria: YarnFilterCriteria = {};

  const manufacturer = searchParams.get("manufacturer");
  if (manufacturer) criteria.manufacturer = manufacturer;

  const color = searchParams.get("color");
  if (color) criteria.color = color;

  const fibers = searchParams.getAll("fiber").filter((fiber) => fiber.trim() !== "");
  if (fibers.length > 0) criteria.fibers = fibers;

  const needleSizeMm = parseNumberParam(searchParams.get("needle"));
  if (needleSizeMm !== undefined) criteria.needleSizeMm = needleSizeMm;

  const hookSizeMm = parseNumberParam(searchParams.get("hook"));
  if (hookSizeMm !== undefined) criteria.hookSizeMm = hookSizeMm;

  if (searchParams.get("hideExhausted") === "1") criteria.hideExhausted = true;

  const minSkeins = parseNumberParam(searchParams.get("minSkeins"));
  if (minSkeins !== undefined) criteria.minSkeins = minSkeins;

  const minGrams = parseNumberParam(searchParams.get("minGrams"));
  if (minGrams !== undefined) criteria.minGrams = minGrams;

  const sortParam = searchParams.get("sort");
  const sort = sortParam && isYarnSortKey(sortParam) ? sortParam : DEFAULT_SORT;

  return { criteria, sort };
}

export function hasActiveYarnFilters(criteria: YarnFilterCriteria): boolean {
  return (
    criteria.manufacturer !== undefined ||
    criteria.color !== undefined ||
    (criteria.fibers !== undefined && criteria.fibers.length > 0) ||
    criteria.needleSizeMm !== undefined ||
    criteria.hookSizeMm !== undefined ||
    criteria.hideExhausted === true ||
    criteria.minSkeins !== undefined ||
    criteria.minGrams !== undefined
  );
}

function matchesCriteria(yarn: FilterableYarn, criteria: YarnFilterCriteria): boolean {
  if (criteria.manufacturer !== undefined && yarn.manufacturer !== criteria.manufacturer) return false;
  if (criteria.color !== undefined && yarn.color !== criteria.color) return false;

  if (criteria.fibers !== undefined && criteria.fibers.length > 0) {
    const yarnFibers = new Set((yarn.composition ?? []).map((row) => row.fiber));
    if (!criteria.fibers.some((fiber) => yarnFibers.has(fiber))) return false;
  }

  if (criteria.needleSizeMm !== undefined && yarn.needle_size_mm !== criteria.needleSizeMm) return false;
  if (criteria.hookSizeMm !== undefined && yarn.hook_size_mm !== criteria.hookSizeMm) return false;
  if (criteria.hideExhausted === true && isYarnExhausted(yarn)) return false;

  if (criteria.minSkeins !== undefined) {
    if (yarn.quantity_skeins === null || yarn.quantity_skeins < criteria.minSkeins) return false;
  }
  if (criteria.minGrams !== undefined) {
    if (yarn.quantity_grams === null || yarn.quantity_grams < criteria.minGrams) return false;
  }

  return true;
}

/** Puste (null) wartości zawsze lądują na końcu, niezależnie od kierunku sortowania. */
function compareNullableNumber(a: number | null, b: number | null, direction: 1 | -1): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return (a - b) * direction;
}

function sortYarns<T extends FilterableYarn>(yarns: T[], sort: YarnSortKey): T[] {
  const sorted = [...yarns];
  switch (sort) {
    case "created_desc":
      sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
      break;
    case "created_asc":
      sorted.sort((a, b) => a.created_at.localeCompare(b.created_at));
      break;
    case "name_asc":
      sorted.sort((a, b) => a.name.localeCompare(b.name, "pl"));
      break;
    case "name_desc":
      sorted.sort((a, b) => b.name.localeCompare(a.name, "pl"));
      break;
    case "rating_desc":
      sorted.sort((a, b) => compareNullableNumber(a.rating, b.rating, -1));
      break;
    case "rating_asc":
      sorted.sort((a, b) => compareNullableNumber(a.rating, b.rating, 1));
      break;
    case "skeins_desc":
      sorted.sort((a, b) => compareNullableNumber(a.quantity_skeins, b.quantity_skeins, -1));
      break;
    case "skeins_asc":
      sorted.sort((a, b) => compareNullableNumber(a.quantity_skeins, b.quantity_skeins, 1));
      break;
    case "grams_desc":
      sorted.sort((a, b) => compareNullableNumber(a.quantity_grams, b.quantity_grams, -1));
      break;
    case "grams_asc":
      sorted.sort((a, b) => compareNullableNumber(a.quantity_grams, b.quantity_grams, 1));
      break;
  }
  return sorted;
}

export function filterAndSortYarns<T extends FilterableYarn>(
  yarns: T[],
  criteria: YarnFilterCriteria,
  sort: YarnSortKey,
): T[] {
  const filtered = yarns.filter((yarn) => matchesCriteria(yarn, criteria));
  return sortYarns(filtered, sort);
}

export function getYarnFilterOptions(yarns: OptionSourceYarn[]): YarnFilterOptions {
  const manufacturers = new Set<string>();
  const colors = new Set<string>();
  const fibers = new Set<string>();
  const needleSizes = new Set<number>();
  const hookSizes = new Set<number>();

  for (const yarn of yarns) {
    manufacturers.add(yarn.manufacturer);
    if (yarn.color) colors.add(yarn.color);
    for (const row of yarn.composition ?? []) {
      if (row.fiber) fibers.add(row.fiber);
    }
    if (yarn.needle_size_mm !== null) needleSizes.add(yarn.needle_size_mm);
    if (yarn.hook_size_mm !== null) hookSizes.add(yarn.hook_size_mm);
  }

  return {
    manufacturers: [...manufacturers].sort((a, b) => a.localeCompare(b, "pl")),
    colors: [...colors].sort((a, b) => a.localeCompare(b, "pl")),
    fibers: [...fibers].sort((a, b) => a.localeCompare(b, "pl")),
    needleSizes: [...needleSizes].sort((a, b) => a - b),
    hookSizes: [...hookSizes].sort((a, b) => a - b),
  };
}
