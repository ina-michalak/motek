import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Local Supabase CLI defaults (npx supabase start) — safe, non-production dev values.
// Override via SUPABASE_TEST_URL / SUPABASE_TEST_ANON_KEY for CI or a different local setup.
const DEFAULT_LOCAL_URL = "http://127.0.0.1:54321";
const DEFAULT_LOCAL_ANON_KEY = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

export interface TestSupabaseSession {
  supabase: SupabaseClient;
  userId: string;
}

/**
 * Creates a real, authenticated Supabase session for integration tests — a fresh
 * user is signed up (local stack has `enable_confirmations = false`, so the
 * session is active immediately). RLS applies to every query made with the
 * returned client, exactly as it does for a real logged-in user.
 */
export async function createTestSupabaseSession(): Promise<TestSupabaseSession> {
  const url = process.env.SUPABASE_TEST_URL ?? DEFAULT_LOCAL_URL;
  const anonKey = process.env.SUPABASE_TEST_ANON_KEY ?? DEFAULT_LOCAL_ANON_KEY;

  const supabase = createClient(url, anonKey);

  const email = `test-${randomUUID()}@example.com`;
  const password = randomUUID();

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    throw new Error(
      `Failed to create test Supabase session — is the local stack running? (npx supabase start): ${error.message}`,
    );
  }
  if (!data.user) {
    throw new Error("Supabase signUp succeeded but returned no user");
  }

  return { supabase, userId: data.user.id };
}
