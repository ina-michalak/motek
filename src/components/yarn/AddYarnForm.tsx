import React, { useEffect, useState } from "react";
import { CircleAlert, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import { CompositionRows, type CompositionRow } from "@/components/yarn/CompositionRows";
import { StarRatingInput } from "@/components/yarn/StarRatingInput";
import {
  createYarnSchema,
  validateYarnPhoto,
  KNOWN_MANUFACTURERS,
  COMMON_NEEDLE_HOOK_SIZES_MM,
} from "@/lib/validation/yarn";

function serializeComposition(composition: CompositionRow[]): string {
  return JSON.stringify(composition.map(({ fiber, percent }) => ({ fiber, percent })));
}

const labelClass = "mb-1 block";

interface Props {
  serverError?: string | null;
}

interface TextValues {
  name: string;
  manufacturer: string;
  quantity_skeins: string;
  quantity_grams: string;
  color: string;
  dye_lot: string;
  needle_size_mm: string;
  hook_size_mm: string;
  gauge_note: string;
  note: string;
}

const initialValues: TextValues = {
  name: "",
  manufacturer: "",
  quantity_skeins: "",
  quantity_grams: "",
  color: "",
  dye_lot: "",
  needle_size_mm: "",
  hook_size_mm: "",
  gauge_note: "",
  note: "",
};

function FieldError({ message }: { message: string }) {
  return (
    <p className="text-destructive mt-1 flex items-center gap-1 text-xs">
      <CircleAlert className="size-3" />
      {message}
    </p>
  );
}

export default function AddYarnForm({ serverError }: Props) {
  const [values, setValues] = useState<TextValues>(initialValues);
  const [composition, setComposition] = useState<CompositionRow[]>([]);
  const [rating, setRating] = useState<number | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  useEffect(() => {
    if (!photoPreview) return;
    return () => {
      URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  function updateField(field: keyof TextValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next: typeof prev = { ...prev, [field]: undefined };
      if (field === "quantity_skeins" || field === "quantity_grams") {
        next.quantity_skeins = undefined;
        next.quantity_grams = undefined;
      }
      return next;
    });
  }

  function handleCompositionChange(next: CompositionRow[]) {
    setComposition(next);
    setErrors((prev) => ({ ...prev, composition: undefined }));
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;

    if (!file) {
      setPhotoPreview(null);
      setPhotoError(null);
      return;
    }
    const validationError = validateYarnPhoto(file);
    if (validationError) {
      setPhotoError(validationError);
      e.target.value = "";
      setPhotoPreview(null);
      return;
    }
    setPhotoError(null);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function validate(): { valid: boolean; firstErrorKey?: string } {
    const result = createYarnSchema.safeParse({
      ...values,
      composition: serializeComposition(composition),
      rating: rating ?? "",
    });

    if (result.success) {
      setErrors({});
      return { valid: true };
    }

    const nextErrors: Record<string, string> = {};
    let firstErrorKey: string | undefined;
    for (const issue of result.error.issues) {
      const key = issue.path[0]?.toString() ?? "form";
      if (!(key in nextErrors)) nextErrors[key] = issue.message;
      firstErrorKey ??= key;
    }
    setErrors(nextErrors);
    return { valid: false, firstErrorKey };
  }

  function scrollToField(key?: string) {
    if (!key) return;
    const id = key === "composition" ? "composition-fields" : key;
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.focus({ preventScroll: true });
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    const { valid, firstErrorKey } = validate();
    if (!valid) {
      e.preventDefault();
      scrollToField(firstErrorKey);
      return;
    }
    if (photoError) {
      e.preventDefault();
      scrollToField("photo");
    }
  }

  const quantityError = errors.quantity_skeins ?? errors.quantity_grams;
  const hasErrors = Object.values(errors).some(Boolean);

  return (
    <form
      method="POST"
      action="/api/yarns"
      encType="multipart/form-data"
      className="space-y-4"
      onSubmit={handleSubmit}
      noValidate
    >
      <input type="hidden" name="composition" value={serializeComposition(composition)} />
      <input type="hidden" name="rating" value={rating ?? ""} />

      <ServerError message={hasErrors ? "Formularz zawiera błędy — popraw zaznaczone pola." : null} />

      <div>
        <Label htmlFor="name" className={labelClass}>
          Nazwa
        </Label>
        <Input
          id="name"
          name="name"
          value={values.name}
          onChange={(e) => {
            updateField("name", e.target.value);
          }}
          placeholder="np. Merino Extrafine"
          aria-invalid={!!errors.name}
        />
        {errors.name && <FieldError message={errors.name} />}
      </div>

      <div>
        <Label htmlFor="manufacturer" className={labelClass}>
          Producent
        </Label>
        <Input
          id="manufacturer"
          name="manufacturer"
          list="manufacturers"
          value={values.manufacturer}
          onChange={(e) => {
            updateField("manufacturer", e.target.value);
          }}
          placeholder="np. Drops"
          aria-invalid={!!errors.manufacturer}
        />
        <datalist id="manufacturers">
          {KNOWN_MANUFACTURERS.map((manufacturer) => (
            <option key={manufacturer} value={manufacturer} />
          ))}
        </datalist>
        {errors.manufacturer && <FieldError message={errors.manufacturer} />}
      </div>

      <div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="quantity_skeins" className={labelClass}>
              Ilość (motki)
            </Label>
            <Input
              id="quantity_skeins"
              name="quantity_skeins"
              type="number"
              min={0}
              step="any"
              value={values.quantity_skeins}
              onChange={(e) => {
                updateField("quantity_skeins", e.target.value);
              }}
              aria-invalid={!!quantityError}
            />
          </div>
          <div>
            <Label htmlFor="quantity_grams" className={labelClass}>
              Ilość (gramy)
            </Label>
            <Input
              id="quantity_grams"
              name="quantity_grams"
              type="number"
              min={0}
              step="any"
              value={values.quantity_grams}
              onChange={(e) => {
                updateField("quantity_grams", e.target.value);
              }}
              aria-invalid={!!quantityError}
            />
          </div>
        </div>
        {quantityError && <FieldError message={quantityError} />}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="color" className={labelClass}>
            Kolor
          </Label>
          <Input
            id="color"
            name="color"
            value={values.color}
            onChange={(e) => {
              updateField("color", e.target.value);
            }}
          />
        </div>
        <div>
          <Label htmlFor="dye_lot" className={labelClass}>
            Farbowanie (lot)
          </Label>
          <Input
            id="dye_lot"
            name="dye_lot"
            value={values.dye_lot}
            onChange={(e) => {
              updateField("dye_lot", e.target.value);
            }}
          />
        </div>
      </div>

      <div id="composition-fields" tabIndex={-1}>
        <Label className={labelClass}>Skład włókien</Label>
        <CompositionRows value={composition} onChange={handleCompositionChange} />
        {errors.composition && <FieldError message={errors.composition} />}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="needle_size_mm" className={labelClass}>
            Druty (mm)
          </Label>
          <Input
            id="needle_size_mm"
            name="needle_size_mm"
            type="number"
            list="needle-sizes"
            min={0}
            step="any"
            value={values.needle_size_mm}
            onChange={(e) => {
              updateField("needle_size_mm", e.target.value);
            }}
          />
          <datalist id="needle-sizes">
            {COMMON_NEEDLE_HOOK_SIZES_MM.map((size) => (
              <option key={size} value={size} />
            ))}
          </datalist>
        </div>
        <div>
          <Label htmlFor="hook_size_mm" className={labelClass}>
            Szydełko (mm)
          </Label>
          <Input
            id="hook_size_mm"
            name="hook_size_mm"
            type="number"
            list="hook-sizes"
            min={0}
            step="any"
            value={values.hook_size_mm}
            onChange={(e) => {
              updateField("hook_size_mm", e.target.value);
            }}
          />
          <datalist id="hook-sizes">
            {COMMON_NEEDLE_HOOK_SIZES_MM.map((size) => (
              <option key={size} value={size} />
            ))}
          </datalist>
        </div>
      </div>

      <div>
        <Label htmlFor="gauge_note" className={labelClass}>
          Próbka
        </Label>
        <Textarea
          id="gauge_note"
          name="gauge_note"
          value={values.gauge_note}
          onChange={(e) => {
            updateField("gauge_note", e.target.value);
          }}
        />
      </div>

      <div>
        <Label className={labelClass}>Ocena</Label>
        <StarRatingInput value={rating} onChange={setRating} />
      </div>

      <div>
        <Label htmlFor="note" className={labelClass}>
          Notatka
        </Label>
        <Textarea
          id="note"
          name="note"
          value={values.note}
          onChange={(e) => {
            updateField("note", e.target.value);
          }}
        />
      </div>

      <div>
        <Label htmlFor="photo" className={labelClass}>
          Zdjęcie
        </Label>
        <input
          id="photo"
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handlePhotoChange}
          className="text-muted-foreground file:bg-secondary file:text-foreground hover:file:bg-accent block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:px-3 file:py-2 file:text-sm"
        />
        {photoError && <FieldError message={photoError} />}
        {photoPreview && (
          <img src={photoPreview} alt="Podgląd zdjęcia włóczki" className="mt-2 h-32 w-32 rounded-lg object-cover" />
        )}
      </div>

      <ServerError message={serverError} />

      <SubmitButton pendingText="Zapisywanie..." icon={<Plus className="size-4" />}>
        Dodaj włóczkę
      </SubmitButton>
    </form>
  );
}
