import { useState } from "react";
import { Check, Spool, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ServerError } from "@/components/auth/ServerError";
import type { YarnWithPhotoUrl } from "@/lib/services/yarns";
import type { SubstituteDecisionStatus } from "@/types";

interface SubstituteSuggestion {
  yarn: YarnWithPhotoUrl;
  score: number;
}

interface Props {
  yarnId: string;
  initialSuggestions: SubstituteSuggestion[];
  initialAccepted: YarnWithPhotoUrl[];
}

function YarnThumbnail({ yarn }: { yarn: YarnWithPhotoUrl }) {
  return (
    <div className="bg-secondary size-14 shrink-0 overflow-hidden rounded-lg">
      {yarn.photoUrl ? (
        <img src={yarn.photoUrl} alt={yarn.name} className="h-full w-full object-cover" />
      ) : (
        <Spool className="text-muted-foreground h-full w-full p-3" strokeWidth={1.25} aria-hidden="true" />
      )}
    </div>
  );
}

function YarnInfo({ yarn }: { yarn: YarnWithPhotoUrl }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-medium">{yarn.name}</p>
      <p className="text-muted-foreground truncate text-xs">{yarn.manufacturer}</p>
    </div>
  );
}

export default function SubstituteSuggestions({ yarnId, initialSuggestions, initialAccepted }: Props) {
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [accepted, setAccepted] = useState(initialAccepted);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function handleDecision(suggestion: SubstituteSuggestion, status: SubstituteDecisionStatus) {
    const substituteYarnId = suggestion.yarn.id;
    setError(null);
    setPendingIds((prev) => new Set(prev).add(substituteYarnId));
    setSuggestions((prev) => prev.filter((s) => s.yarn.id !== substituteYarnId));
    if (status === "accepted") {
      setAccepted((prev) => [...prev, suggestion.yarn]);
    }

    try {
      const response = await fetch(`/api/yarns/${yarnId}/substitutes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ substituteYarnId, status }),
      });
      if (!response.ok) throw new Error("Request failed");
    } catch {
      setSuggestions((prev) => [...prev, suggestion].sort((a, b) => b.score - a.score));
      if (status === "accepted") {
        setAccepted((prev) => prev.filter((yarn) => yarn.id !== substituteYarnId));
      }
      setError("Nie udało się zapisać decyzji. Spróbuj ponownie.");
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(substituteYarnId);
        return next;
      });
    }
  }

  if (suggestions.length === 0 && accepted.length === 0) {
    return (
      <section>
        <h2 className="text-muted-foreground mb-2 text-sm font-semibold">Zamienniki</h2>
        <div className="border-border bg-card flex flex-col items-center rounded-2xl border p-12 text-center">
          <Spool className="text-muted-foreground mb-4 size-16" strokeWidth={1.25} aria-hidden="true" />
          <p className="text-muted-foreground text-sm">
            Brak sugestii zamienników — dodaj więcej włóczek do biblioteki, aby zobaczyć podobne propozycje.
          </p>
        </div>
        <ServerError message={error} />
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {accepted.length > 0 && (
        <section>
          <h2 className="text-muted-foreground mb-2 text-sm font-semibold">Twoje zamienniki</h2>
          <ul className="space-y-2">
            {accepted.map((yarn) => (
              <li key={yarn.id} className="border-border bg-card flex items-center gap-3 rounded-xl border p-3">
                <YarnThumbnail yarn={yarn} />
                <YarnInfo yarn={yarn} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-muted-foreground mb-2 text-sm font-semibold">Sugerowane zamienniki</h2>
        {suggestions.length > 0 ? (
          <ul className="space-y-2">
            {suggestions.map((suggestion) => (
              <li
                key={suggestion.yarn.id}
                className="border-border bg-card flex items-center gap-3 rounded-xl border p-3"
              >
                <YarnThumbnail yarn={suggestion.yarn} />
                <YarnInfo yarn={suggestion.yarn} />
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Akceptuj"
                    disabled={pendingIds.has(suggestion.yarn.id)}
                    onClick={() => handleDecision(suggestion, "accepted")}
                  >
                    <Check className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Odrzuć"
                    disabled={pendingIds.has(suggestion.yarn.id)}
                    onClick={() => handleDecision(suggestion, "rejected")}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">Brak nowych sugestii.</p>
        )}
      </section>

      <ServerError message={error} />
    </div>
  );
}
