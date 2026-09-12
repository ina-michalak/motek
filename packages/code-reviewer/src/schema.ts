import { z } from "zod";
import { CRITERIA } from "./criteria";

const criterionResultSchema = (definition: string) =>
  z.object({
    // Zakres 1-10 celowo tylko w opisie, nie jako z.number().min(1).max(10) —
    // niektóre modele przez native structured output odrzucają minimum/maximum
    // w JSON Schema dla typu integer (vercel/ai#14342).
    score: z.number().describe(definition),
    rationale: z.string().describe("Krótkie uzasadnienie oceny w języku polskim (1-2 zdania)."),
  });

export const REVIEW_SCHEMA = z.object(
  Object.fromEntries(CRITERIA.map((c) => [c.id, criterionResultSchema(c.definition)])),
);

export type Review = z.infer<typeof REVIEW_SCHEMA>;
