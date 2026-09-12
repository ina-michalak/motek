import { describe, expect, it, vi } from "vitest";
import { CRITERIA } from "./criteria";

const { generateTextMock } = vi.hoisted(() => ({ generateTextMock: vi.fn() }));

vi.mock("ai", () => ({
  generateText: generateTextMock,
  Output: {
    object: (config: unknown) => config,
  },
}));

vi.mock("@openrouter/ai-sdk-provider", () => ({
  createOpenRouter: () => (model: string) => ({ modelId: model }),
}));

function buildScores(scores: Record<string, number>): Record<string, { score: number; rationale: string }> {
  return Object.fromEntries(CRITERIA.map((c) => [c.id, { score: scores[c.id], rationale: "test" }]));
}

describe("runReview", () => {
  it("returns a pass verdict and a success banner when every criterion is at or above the threshold", async () => {
    const { runReview } = await import("./review");
    const scores = Object.fromEntries(CRITERIA.map((c) => [c.id, 10]));
    generateTextMock.mockResolvedValueOnce({ output: buildScores(scores) });

    const result = await runReview({
      title: "t",
      body: "b",
      diff: "d",
      apiKey: "key",
      model: "openai/gpt-4o-mini",
    });

    expect(result.verdict).toBe("pass");
    expect(result.comment).toContain("PRZESZŁO");
  });

  it("returns a fail verdict and a failure banner when one criterion is below the threshold", async () => {
    const { runReview } = await import("./review");
    const scores = Object.fromEntries(CRITERIA.map((c) => [c.id, 10]));
    scores[CRITERIA[0].id] = 1;
    generateTextMock.mockResolvedValueOnce({ output: buildScores(scores) });

    const result = await runReview({
      title: "t",
      body: "b",
      diff: "d",
      apiKey: "key",
      model: "openai/gpt-4o-mini",
    });

    expect(result.verdict).toBe("fail");
    expect(result.comment).toContain("NIE PRZESZŁO");
  });

  it("throws when the model output does not match the review schema", async () => {
    const { runReview } = await import("./review");
    generateTextMock.mockResolvedValueOnce({ output: { correctness: { score: 10 } } });

    await expect(
      runReview({
        title: "t",
        body: "b",
        diff: "d",
        apiKey: "key",
        model: "openai/gpt-4o-mini",
      }),
    ).rejects.toThrow("Niepoprawny structured output");
  });
});
