import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { CreateYarnInput } from "@/lib/validation/yarn";
import type { Yarn } from "@/types";

const YARN_PHOTOS_BUCKET = "yarn-photos";
const PHOTO_SIGNED_URL_TTL_SECONDS = 60 * 60;

export interface YarnWithPhotoUrl extends Yarn {
  photoUrl: string | null;
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
}

async function resolveYarnPhotoUrl(supabase: SupabaseClient, photoPath: string | null): Promise<string | null> {
  if (!photoPath) return null;

  const { data, error } = await supabase.storage
    .from(YARN_PHOTOS_BUCKET)
    .createSignedUrl(photoPath, PHOTO_SIGNED_URL_TTL_SECONDS);

  if (error) return null;
  return data.signedUrl;
}

export async function listYarns(supabase: SupabaseClient, userId: string): Promise<YarnWithPhotoUrl[]> {
  const { data, error } = (await supabase
    .from("yarns")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })) as { data: Yarn[] | null; error: PostgrestError | null };

  if (error) throw error;
  const yarns = data ?? [];

  return Promise.all(
    yarns.map(async (yarn) => ({
      ...yarn,
      photoUrl: await resolveYarnPhotoUrl(supabase, yarn.photo_url),
    })),
  );
}

export async function getYarnById(supabase: SupabaseClient, id: string): Promise<YarnWithPhotoUrl | null> {
  const { data, error } = (await supabase.from("yarns").select("*").eq("id", id).maybeSingle()) as {
    data: Yarn | null;
    error: PostgrestError | null;
  };

  if (error) throw error;
  if (!data) return null;

  return { ...data, photoUrl: await resolveYarnPhotoUrl(supabase, data.photo_url) };
}

export async function createYarn(supabase: SupabaseClient, userId: string, data: CreateYarnInput): Promise<Yarn> {
  const { data: yarn, error } = (await supabase
    .from("yarns")
    .insert({
      user_id: userId,
      name: data.name,
      manufacturer: data.manufacturer,
      quantity_skeins: data.quantity_skeins ?? null,
      quantity_grams: data.quantity_grams ?? null,
      color: data.color ?? null,
      dye_lot: data.dye_lot ?? null,
      composition: data.composition.length > 0 ? data.composition : null,
      needle_size_mm: data.needle_size_mm ?? null,
      hook_size_mm: data.hook_size_mm ?? null,
      gauge_note: data.gauge_note ?? null,
      rating: data.rating ?? null,
      note: data.note ?? null,
    })
    .select()
    .single()) as { data: Yarn | null; error: PostgrestError | null };

  if (error) throw error;
  if (!yarn) throw new Error("Insert succeeded but returned no row");
  return yarn;
}

export async function attachYarnPhoto(
  supabase: SupabaseClient,
  userId: string,
  yarnId: string,
  file: File,
): Promise<void> {
  const path = `${userId}/${yarnId}-${sanitizeFileName(file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from(YARN_PHOTOS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;

  const { error: updateError } = await supabase.from("yarns").update({ photo_url: path }).eq("id", yarnId);
  if (updateError) throw updateError;
}
