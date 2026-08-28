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

const emptyToUndefined = (value: unknown) =>
  value === null || (typeof value === "string" && value.trim() === "") ? undefined : value;

const optionalTrimmedString = (maxLength: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().min(1).max(maxLength).optional());

const optionalNonNegativeNumber = z.preprocess(
  emptyToUndefined,
  z.coerce.number().nonnegative("Wartość nie może być ujemna").optional(),
);

const optionalPositiveNumber = z.preprocess(
  emptyToUndefined,
  z.coerce.number().positive("Wartość musi być większa od zera").optional(),
);

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
    name: z.string().trim().min(1, "Nazwa jest wymagana").max(200),
    manufacturer: z.string().trim().min(1, "Producent jest wymagany").max(200),
    quantity_skeins: optionalNonNegativeNumber,
    quantity_grams: optionalNonNegativeNumber,
    color: optionalTrimmedString(200),
    dye_lot: optionalTrimmedString(200),
    composition: compositionSchema,
    needle_size_mm: optionalPositiveNumber,
    hook_size_mm: optionalPositiveNumber,
    gauge_note: optionalTrimmedString(1000),
    rating: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(5).optional()),
    note: optionalTrimmedString(1000),
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

export const ACCEPTED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

export function validateYarnPhoto(file: File): string | null {
  if (!ACCEPTED_PHOTO_TYPES.includes(file.type as (typeof ACCEPTED_PHOTO_TYPES)[number])) {
    return "Dozwolone formaty: JPEG, PNG, WEBP";
  }
  if (file.size > MAX_PHOTO_SIZE_BYTES) {
    return "Zdjęcie nie może przekraczać 5MB";
  }
  return null;
}
