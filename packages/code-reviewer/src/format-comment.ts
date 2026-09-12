import { CRITERIA } from "./criteria";
import { MAX_DIFF_CHARS } from "./prompt";
import type { Review } from "./schema";

export const COMMENT_MARKER = "<!-- ai-cr:review-comment -->";

export function formatComment(review: Review, verdict: "pass" | "fail", opts?: { diffTruncated?: boolean }): string {
  const banner = verdict === "pass" ? "## ✅ Recenzja AI: PRZESZŁO" : "## ❌ Recenzja AI: NIE PRZESZŁO";

  const rows = CRITERIA.map((c) => {
    const result = review[c.id];
    return `| ${c.label} | ${result.score} | ${result.rationale} |`;
  }).join("\n");

  const table = `| Kryterium | Ocena | Uzasadnienie |\n| --- | --- | --- |\n${rows}`;

  const truncationLine = opts?.diffTruncated
    ? `\n\n> ⚠️ Diff został obcięty do ${String(MAX_DIFF_CHARS)} znaków przed oceną.`
    : "";

  return `${COMMENT_MARKER}\n${banner}\n\n${table}${truncationLine}`;
}
