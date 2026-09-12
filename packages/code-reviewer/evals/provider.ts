import { readFileSync } from "node:fs";
import type { ApiProvider, CallApiContextParams, ProviderOptions, ProviderResponse } from "promptfoo";
import { runReview } from "../src/review";

interface ReviewProviderConfig {
  model?: string;
}

function requireStringVar(vars: Record<string, unknown>, key: string): string {
  const value = vars[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Brakująca lub nieprawidłowa zmienna testowa "${key}" w promptfoo`);
  }
  return value;
}

export default class ReviewProvider implements ApiProvider {
  private readonly model: string;

  constructor(options: ProviderOptions) {
    const config = options.config as ReviewProviderConfig | undefined;
    if (typeof config?.model !== "string" || config.model.length === 0) {
      throw new Error("ReviewProvider wymaga config.model w promptfooconfig.yaml");
    }
    this.model = config.model;
  }

  id(): string {
    return "code-review-agent";
  }

  async callApi(_prompt: string, context?: CallApiContextParams): Promise<ProviderResponse> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY nie jest ustawiony w środowisku.");
    }
    const vars = context?.vars ?? {};
    const diffPath = new URL(requireStringVar(vars, "diffPath"), import.meta.url);
    const result = await runReview({
      title: requireStringVar(vars, "title"),
      body: requireStringVar(vars, "body"),
      diff: readFileSync(diffPath, "utf8"),
      apiKey,
      model: this.model,
    });
    return { output: JSON.stringify(result) };
  }
}
