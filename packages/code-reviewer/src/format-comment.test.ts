import { describe, expect, it } from "vitest";
import { CRITERIA } from "./criteria";
import { COMMENT_MARKER, formatComment } from "./format-comment";
import { MAX_DIFF_CHARS } from "./prompt";
import type { Review } from "./schema";

function buildReview(): Review {
  return Object.fromEntries(CRITERIA.map((c, i) => [c.id, { score: 7 + i, rationale: `uzasadnienie ${c.id}` }]));
}

describe("formatComment", () => {
  it("starts with the comment marker", () => {
    const comment = formatComment(buildReview(), "pass");
    expect(comment.startsWith(COMMENT_MARKER)).toBe(true);
  });

  it("renders the passing banner for a pass verdict", () => {
    const comment = formatComment(buildReview(), "pass");
    expect(comment).toContain("PRZESZŁO");
    expect(comment).not.toContain("NIE PRZESZŁO");
  });

  it("renders the failing banner for a fail verdict", () => {
    const comment = formatComment(buildReview(), "fail");
    expect(comment).toContain("NIE PRZESZŁO");
  });

  it("orders table rows to match CRITERIA", () => {
    const comment = formatComment(buildReview(), "pass");
    const positions = CRITERIA.map((c) => comment.indexOf(c.label));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(positions.every((p) => p !== -1)).toBe(true);
  });

  it("omits the truncation line by default", () => {
    const comment = formatComment(buildReview(), "pass");
    expect(comment).not.toContain("obcięty");
  });

  it("includes the truncation line when diffTruncated is true", () => {
    const comment = formatComment(buildReview(), "pass", { diffTruncated: true });
    expect(comment).toContain(`obcięty do ${String(MAX_DIFF_CHARS)} znaków`);
  });
});
