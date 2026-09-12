import { describe, expect, it } from "vitest";
import { CRITERIA } from "./criteria";
import { buildPrompt, MAX_DIFF_CHARS, truncateDiff } from "./prompt";

describe("truncateDiff", () => {
  it("does not truncate a diff exactly at the limit", () => {
    const diff = "x".repeat(MAX_DIFF_CHARS);
    const result = truncateDiff(diff);
    expect(result.truncated).toBe(false);
    expect(result.diff).toHaveLength(MAX_DIFF_CHARS);
  });

  it("truncates a diff one character over the limit", () => {
    const diff = "x".repeat(MAX_DIFF_CHARS + 1);
    const result = truncateDiff(diff);
    expect(result.truncated).toBe(true);
    expect(result.diff).toHaveLength(MAX_DIFF_CHARS);
  });

  it("does not truncate a diff well below the limit", () => {
    const diff = "x".repeat(100);
    const result = truncateDiff(diff);
    expect(result.truncated).toBe(false);
    expect(result.diff).toBe(diff);
  });
});

describe("buildPrompt", () => {
  it("includes the title, body, and diff", () => {
    const { prompt } = buildPrompt({ title: "Mój tytuł PR", body: "Mój opis PR", diff: "diff --git a b" });
    expect(prompt).toContain("Mój tytuł PR");
    expect(prompt).toContain("Mój opis PR");
    expect(prompt).toContain("diff --git a b");
  });

  it("includes all 7 criteria definitions", () => {
    const { prompt } = buildPrompt({ title: "t", body: "b", diff: "d" });
    for (const criterion of CRITERIA) {
      expect(prompt).toContain(criterion.definition);
    }
  });

  it("reports whether the diff was truncated", () => {
    const short = buildPrompt({ title: "t", body: "b", diff: "x".repeat(100) });
    expect(short.truncated).toBe(false);

    const long = buildPrompt({ title: "t", body: "b", diff: "x".repeat(MAX_DIFF_CHARS + 1) });
    expect(long.truncated).toBe(true);
    expect(long.prompt).toContain("diff został obcięty");
  });
});
