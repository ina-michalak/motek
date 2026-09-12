import { CRITERIA } from "./criteria";

export const MAX_DIFF_CHARS = 60_000;

export function truncateDiff(diff: string): { diff: string; truncated: boolean } {
  if (diff.length <= MAX_DIFF_CHARS) {
    return { diff, truncated: false };
  }
  return { diff: diff.slice(0, MAX_DIFF_CHARS), truncated: true };
}

export function buildPrompt({ title, body, diff }: { title: string; body: string; diff: string }): {
  prompt: string;
  truncated: boolean;
} {
  const { diff: truncatedDiff, truncated } = truncateDiff(diff);

  const criteriaList = CRITERIA.map((c, i) => `${i + 1}) **${c.label}**\n${c.definition}`).join("\n\n");

  const truncationNote = truncated
    ? `\n\n> Uwaga: diff został obcięty do ${MAX_DIFF_CHARS} znaków przed oceną — może nie zawierać pełnego kontekstu zmiany.`
    : "";

  const prompt = `Jesteś recenzentem PR-a w projekcie Astro SSR (React 19, Tailwind 4, Supabase, shadcn/ui). Oceń poniższą zmianę wyłącznie na podstawie tytułu, opisu i diffa — bez dostępu do szerszego kontekstu repo. Dla każdego z poniższych 7 kryteriów wystaw ocenę w skali 1-10 (1 = najgorszy, 10 = najlepszy) oraz krótkie uzasadnienie po polsku (1-2 zdania).

## Kryteria oceny

${criteriaList}

## Tytuł PR-a

${title}

## Opis PR-a

${body}

## Diff

${truncatedDiff}${truncationNote}`;

  return { prompt, truncated };
}
