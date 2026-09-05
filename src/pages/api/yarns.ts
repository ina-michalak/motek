import type { APIRoute } from "astro";
import * as Sentry from "@sentry/astro";
import { createClient } from "@/lib/supabase";
import { createYarnSchema, validateYarnPhoto } from "@/lib/validation/yarn";
import { attachYarnPhoto, createYarn } from "@/lib/services/yarns";

export const prerender = false;

function toErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message.length > 0 ? error.message : fallback;
  }
  return fallback;
}

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return context.redirect("/auth/signin");
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/yarns/new?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  const form = await context.request.formData();
  const parsed = createYarnSchema.safeParse({
    name: form.get("name"),
    manufacturer: form.get("manufacturer"),
    quantity_skeins: form.get("quantity_skeins"),
    quantity_grams: form.get("quantity_grams"),
    color: form.get("color"),
    dye_lot: form.get("dye_lot"),
    composition: form.get("composition"),
    needle_size_mm: form.get("needle_size_mm"),
    hook_size_mm: form.get("hook_size_mm"),
    gauge_note: form.get("gauge_note"),
    rating: form.get("rating"),
    note: form.get("note"),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Nieprawidłowe dane formularza";
    return context.redirect(`/yarns/new?error=${encodeURIComponent(message)}`);
  }

  const photo = form.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const photoError = validateYarnPhoto(photo);
    if (photoError) {
      return context.redirect(`/yarns/new?error=${encodeURIComponent(photoError)}`);
    }
  }

  let yarn;
  try {
    yarn = await createYarn(supabase, context.locals.user.id, parsed.data);
  } catch (error) {
    Sentry.captureException(error);
    console.error("Failed to create yarn:", error);
    const message = toErrorMessage(error, "Nie udało się zapisać włóczki");
    return context.redirect(`/yarns/new?error=${encodeURIComponent(message)}`);
  }

  if (photo instanceof File && photo.size > 0) {
    try {
      await attachYarnPhoto(supabase, context.locals.user.id, yarn.id, photo);
    } catch (error) {
      Sentry.captureException(error);
      console.warn("Failed to attach yarn photo:", error);
      const message = "Włóczka została zapisana, ale nie udało się zapisać zdjęcia.";
      return context.redirect(`/dashboard?warning=${encodeURIComponent(message)}`);
    }
  }

  return context.redirect("/dashboard");
};
