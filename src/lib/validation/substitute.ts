import { z } from "zod";

export const substituteDecisionSchema = z.object({
  substituteYarnId: z.uuid(),
  status: z.enum(["accepted", "rejected"]),
});

export type SubstituteDecisionInput = z.infer<typeof substituteDecisionSchema>;
