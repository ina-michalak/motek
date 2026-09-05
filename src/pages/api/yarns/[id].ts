import type { APIRoute } from "astro";
import { z } from "zod";
import * as Sentry from "@sentry/astro";
import { createClient } from "@/lib/supabase";
import { createYarnSchema, validateYarnPhoto } from "@/lib/validation/yarn";
import { attachYarnPhoto, deleteYarn, removeYarnPhoto, updateYarn } from "@/lib/services/yarns";

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

  const idParsed = z.uuid().safeParse(context.params.id);
  if (!idParsed.success) {
    return context.redirect("/dashboard");
  }
  const id = idParsed.data;
  const userId = context.locals.user.id;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/yarns/${id}?error=${encodeURIComponent("Supabase is not configured")}&edit=1`);
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
    return context.redirect(`/yarns/${id}?error=${encodeURIComponent(message)}&edit=1`);
  }

  const photo = form.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const photoError = validateYarnPhoto(photo);
    if (photoError) {
      return context.redirect(`/yarns/${id}?error=${encodeURIComponent(photoError)}&edit=1`);
    }
  }

  try {
    await updateYarn(supabase, userId, id, parsed.data);
  } catch (error) {
    Sentry.captureException(error);
    console.error("Failed to update yarn:", error);
    const message = toErrorMessage(error, "Nie udało się zapisać zmian");
    return context.redirect(`/yarns/${id}?error=${encodeURIComponent(message)}&edit=1`);
  }

  if (photo instanceof File && photo.size > 0) {
    try {
      await attachYarnPhoto(supabase, userId, id, photo);
    } catch (error) {
      Sentry.captureException(error);
      console.warn("Failed to attach yarn photo:", error);
      const message = "Zmiany zostały zapisane, ale nie udało się zapisać zdjęcia.";
      return context.redirect(`/yarns/${id}?warning=${encodeURIComponent(message)}`);
    }
  } else if (form.get("remove_photo") === "true") {
    try {
      await removeYarnPhoto(supabase, userId, id);
    } catch (error) {
      Sentry.captureException(error);
      console.warn("Failed to remove yarn photo:", error);
      const message = "Zmiany zostały zapisane, ale nie udało się usunąć zdjęcia.";
      return context.redirect(`/yarns/${id}?warning=${encodeURIComponent(message)}`);
    }
  }

  return context.redirect(`/yarns/${id}`);
};

export const DELETE: APIRoute = async (context) => {
  if (!context.locals.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const idParsed = z.uuid().safeParse(context.params.id);
  if (!idParsed.success) {
    return Response.json({ error: "Nieprawidłowy identyfikator włóczki" }, { status: 400 });
  }
  const id = idParsed.data;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Supabase is not configured" }, { status: 400 });
  }

  try {
    await deleteYarn(supabase, context.locals.user.id, id);
  } catch (error) {
    Sentry.captureException(error);
    console.error("Failed to delete yarn:", error);
    const message = toErrorMessage(error, "Nie udało się usunąć włóczki");
    return Response.json({ error: message }, { status: 400 });
  }

  return Response.json({ ok: true }, { status: 200 });
};
