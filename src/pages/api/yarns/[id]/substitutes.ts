import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { substituteDecisionSchema } from "@/lib/validation/substitute";
import { recordSubstituteDecision } from "@/lib/services/substitutes";

export const prerender = false;

function toErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message.length > 0 ? error.message : fallback;
  }
  return fallback;
}

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const yarnIdParsed = z.uuid().safeParse(context.params.id);
  if (!yarnIdParsed.success) {
    return Response.json({ error: "Nieprawidłowy identyfikator włóczki" }, { status: 400 });
  }
  const yarnId = yarnIdParsed.data;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Supabase is not configured" }, { status: 400 });
  }

  const body: unknown = await context.request.json();
  const parsed = substituteDecisionSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Nieprawidłowe dane żądania";
    return Response.json({ error: message }, { status: 400 });
  }

  try {
    await recordSubstituteDecision(
      supabase,
      context.locals.user.id,
      yarnId,
      parsed.data.substituteYarnId,
      parsed.data.status,
    );
  } catch (error) {
    console.error("Failed to record substitute decision:", error);
    const message = toErrorMessage(error, "Nie udało się zapisać decyzji");
    return Response.json({ error: message }, { status: 400 });
  }

  return Response.json({ ok: true }, { status: 200 });
};
