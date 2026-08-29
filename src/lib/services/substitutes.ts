import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { MIN_SUBSTITUTE_SCORE, scoreYarnSimilarity } from "@/lib/services/substitute-matching";
import { getYarnById, listYarns, type YarnWithPhotoUrl } from "@/lib/services/yarns";
import type { SubstituteDecisionStatus } from "@/types";

export interface SubstituteSuggestion {
  yarn: YarnWithPhotoUrl;
  score: number;
}

export async function listSubstituteSuggestions(
  supabase: SupabaseClient,
  userId: string,
  yarnId: string,
): Promise<SubstituteSuggestion[]> {
  const targetYarn = await getYarnById(supabase, userId, yarnId);
  if (!targetYarn) return [];

  const candidates = (await listYarns(supabase, userId)).filter((yarn) => yarn.id !== yarnId);
  if (candidates.length === 0) return [];

  const { data: decisions, error } = (await supabase
    .from("yarn_substitute_decisions")
    .select("substitute_yarn_id")
    .eq("user_id", userId)
    .eq("yarn_id", yarnId)) as { data: { substitute_yarn_id: string }[] | null; error: PostgrestError | null };
  if (error) throw error;

  const decidedIds = new Set((decisions ?? []).map((decision) => decision.substitute_yarn_id));

  return candidates
    .filter((candidate) => !decidedIds.has(candidate.id))
    .map((candidate) => ({ yarn: candidate, score: scoreYarnSimilarity(targetYarn, candidate) }))
    .filter(
      (suggestion): suggestion is SubstituteSuggestion =>
        suggestion.score !== null && suggestion.score >= MIN_SUBSTITUTE_SCORE,
    )
    .sort((a, b) => b.score - a.score);
}

export async function getAcceptedSubstitutes(
  supabase: SupabaseClient,
  userId: string,
  yarnId: string,
): Promise<YarnWithPhotoUrl[]> {
  const { data: decisions, error } = (await supabase
    .from("yarn_substitute_decisions")
    .select("substitute_yarn_id")
    .eq("user_id", userId)
    .eq("yarn_id", yarnId)
    .eq("status", "accepted")) as { data: { substitute_yarn_id: string }[] | null; error: PostgrestError | null };
  if (error) throw error;

  const acceptedIds = new Set((decisions ?? []).map((decision) => decision.substitute_yarn_id));
  if (acceptedIds.size === 0) return [];

  return (await listYarns(supabase, userId)).filter((yarn) => acceptedIds.has(yarn.id));
}

export async function recordSubstituteDecision(
  supabase: SupabaseClient,
  userId: string,
  yarnId: string,
  substituteYarnId: string,
  status: SubstituteDecisionStatus,
): Promise<void> {
  if (yarnId === substituteYarnId) {
    throw new Error("Włóczka nie może być swoim własnym zamiennikiem");
  }

  const [yarn, substituteYarn] = await Promise.all([
    getYarnById(supabase, userId, yarnId),
    getYarnById(supabase, userId, substituteYarnId),
  ]);
  if (!yarn || !substituteYarn) {
    throw new Error("Both yarns must belong to the current user");
  }

  const { error } = await supabase.from("yarn_substitute_decisions").upsert(
    [
      { user_id: userId, yarn_id: yarnId, substitute_yarn_id: substituteYarnId, status },
      { user_id: userId, yarn_id: substituteYarnId, substitute_yarn_id: yarnId, status },
    ],
    { onConflict: "user_id,yarn_id,substitute_yarn_id" },
  );
  if (error) throw error;
}
