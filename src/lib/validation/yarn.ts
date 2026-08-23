import { z } from "zod";

export const KNOWN_MANUFACTURERS = [
  "Drops",
  "Malabrigo",
  "Rico Design",
  "Katia",
  "Lana Grossa",
  "Regia",
  "Scheepjes",
  "Phildar",
  "Ita Rosa Manufaktura",
  "Włóczka Kabaczek",
] as const;

export const COMMON_NEEDLE_HOOK_SIZES_MM = [2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 8, 9, 10, 12] as const;

export const COMMON_FIBERS = [
  "Wełna",
  "Merynos",
  "Alpaka",
  "Bawełna",
  "Akryl",
  "Jedwab",
  "Kaszmir",
  "Len",
  "Mohair",
  "Wiskoza",
  "Poliamid",
  "Poliester",
] as const;

const emptyToUndefined = (value: unknown) => (typeof value === "string" && value.trim() === "" ? undefined : value);

const optionalTrimmedString = z.preprocess(emptyToUndefined, z.string().trim().min(1).optional());

const optionalNumber = z.preprocess(emptyToUndefined, z.coerce.number().optional());

const compositionRowSchema = z.object({
  fiber: z.string().trim().min(1, "Podaj rodzaj włókna"),
  percent: z.coerce.number().min(0).max(100),
});

const compositionSchema = z.preprocess((value): unknown => {
  if (typeof value !== "string" || value.trim() === "") return [];
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}, z.array(compositionRowSchema).default([]));

export const createYarnSchema = z
  .object({
    name: z.string().trim().min(1, "Nazwa jest wymagana"),
    manufacturer: z.string().trim().min(1, "Producent jest wymagany"),
    quantity_skeins: optionalNumber,
    quantity_grams: optionalNumber,
    color: optionalTrimmedString,
    dye_lot: optionalTrimmedString,
    composition: compositionSchema,
    needle_size_mm: optionalNumber,
    hook_size_mm: optionalNumber,
    gauge_note: optionalTrimmedString,
    rating: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(5).optional()),
    note: optionalTrimmedString,
  })
  .refine((data) => data.quantity_skeins !== undefined || data.quantity_grams !== undefined, {
    message: "Podaj ilość w motkach lub gramach",
    path: ["quantity_skeins"],
  })
  .refine(
    (data) => {
      if (data.composition.length === 0) return true;
      const total = data.composition.reduce((sum, row) => sum + row.percent, 0);
      return Math.abs(total - 100) <= 0.5;
    },
    {
      message: "Suma procentów składu musi wynosić 100%",
      path: ["composition"],
    },
  );

export type CreateYarnInput = z.infer<typeof createYarnSchema>;
