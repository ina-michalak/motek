import { randomUUID } from "node:crypto";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createYarn } from "@/lib/services/yarns";
import { createTestSupabaseSession } from "@/lib/testing/supabase-test-client";
import type { CreateYarnInput } from "@/lib/validation/yarn";
import type { Yarn } from "@/types";

function makeYarnInput(overrides: Partial<CreateYarnInput> = {}): CreateYarnInput {
  return {
    name: `Yarn ${randomUUID()}`,
    manufacturer: "Drops",
    quantity_skeins: 3,
    quantity_grams: undefined,
    color: undefined,
    dye_lot: undefined,
    composition: [],
    needle_size_mm: undefined,
    hook_size_mm: undefined,
    gauge_note: undefined,
    rating: undefined,
    note: undefined,
    ...overrides,
  };
}

describe("createYarn (integration)", () => {
  let supabase: SupabaseClient;
  let userId: string;

  beforeEach(async () => {
    ({ supabase, userId } = await createTestSupabaseSession());
  });

  afterEach(async () => {
    await supabase.from("yarns").delete().eq("user_id", userId);
  });

  it("persists a readable row with the submitted data when the write succeeds", async () => {
    const input = makeYarnInput({
      name: `Wełna testowa ${randomUUID()}`,
      manufacturer: "Malabrigo",
      quantity_skeins: 5,
    });

    const created = await createYarn(supabase, userId, input);
    expect(created.id).toBeTruthy();

    const { data: row, error } = (await supabase.from("yarns").select("*").eq("id", created.id).single()) as {
      data: Yarn | null;
      error: PostgrestError | null;
    };

    expect(error).toBeNull();
    expect(row).toMatchObject({
      name: input.name,
      manufacturer: input.manufacturer,
      quantity_skeins: input.quantity_skeins,
      user_id: userId,
    });
  });

  it("rejects a write missing both quantity fields and leaves no row behind", async () => {
    const name = `Bez ilości ${randomUUID()}`;
    const input = makeYarnInput({ name, quantity_skeins: undefined, quantity_grams: undefined });

    await expect(createYarn(supabase, userId, input)).rejects.toThrow();

    const { data: rows, error } = await supabase.from("yarns").select("id").eq("user_id", userId).eq("name", name);

    expect(error).toBeNull();
    expect(rows).toEqual([]);
  });
});
