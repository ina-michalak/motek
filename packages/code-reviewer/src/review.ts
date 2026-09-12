import { randomUUID } from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, Output } from "ai";
import { z } from "zod";
import { buildPrompt } from "./prompt";
import { formatComment } from "./format-comment";
import { REVIEW_SCHEMA, type Review } from "./schema";
import { computeVerdict } from "./verdict";

export async function runReview(input: {
  title: string;
  body: string;
  diff: string;
  apiKey: string;
  model: string;
}): Promise<{ review: Review; verdict: "pass" | "fail"; comment: string }> {
  const openrouter = createOpenRouter({ apiKey: input.apiKey });
  const { prompt, truncated } = buildPrompt({ title: input.title, body: input.body, diff: input.diff });
  const { output } = await generateText({
    model: openrouter(input.model),
    output: Output.object({ schema: REVIEW_SCHEMA }),
    prompt,
  });
  const parsed = REVIEW_SCHEMA.safeParse(output);
  if (!parsed.success) {
    throw new Error(`Niepoprawny structured output: ${parsed.error.message}`);
  }
  const verdict = computeVerdict(parsed.data);
  return { review: parsed.data, verdict, comment: formatComment(parsed.data, verdict, { diffTruncated: truncated }) };
}

const envSchema = z.object({
  OPENROUTER_API_KEY: z.string().min(1),
  OPENROUTER_MODEL: z.string().min(1).default("openai/gpt-4o-mini"),
  PR_TITLE: z.string(),
  PR_BODY_FILE: z.string().min(1),
  PR_DIFF_FILE: z.string().min(1),
});

export async function main(): Promise<void> {
  const env = envSchema.parse(process.env);
  const body = readFileSync(env.PR_BODY_FILE, "utf8");
  const diff = readFileSync(env.PR_DIFF_FILE, "utf8");

  const { verdict, comment } = await runReview({
    title: env.PR_TITLE,
    body,
    diff,
    apiKey: env.OPENROUTER_API_KEY,
    model: env.OPENROUTER_MODEL,
  });

  const githubOutput = process.env.GITHUB_OUTPUT;
  if (!githubOutput) {
    throw new Error("GITHUB_OUTPUT nie jest ustawiony w środowisku.");
  }

  const delimiter = `GHADELIM_${randomUUID()}`;
  appendFileSync(githubOutput, `verdict=${verdict}\n`);
  appendFileSync(githubOutput, `comment-body<<${delimiter}\n${comment}\n${delimiter}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    // Loguj tylko komunikat, nie cały obiekt błędu — APICallError potrafi przechowywać
    // pełną treść promptu (diff PR-a) w requestBodyValues/responseBody.
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
