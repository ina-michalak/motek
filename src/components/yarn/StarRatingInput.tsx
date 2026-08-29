import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

const STAR_VALUES = [1, 2, 3, 4, 5] as const;

interface StarRatingInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
}

export function StarRatingInput({ value, onChange }: StarRatingInputProps) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Ocena">
      {STAR_VALUES.map((star) => {
        const filled = value !== null && star <= value;
        return (
          <button
            key={star}
            type="button"
            onClick={() => {
              onChange(value === star ? null : star);
            }}
            aria-pressed={filled}
            aria-label={`${star} ${star === 1 ? "gwiazdka" : "gwiazdek"}`}
            className="text-muted-foreground hover:text-warning-border transition-colors"
          >
            <Star className={cn("size-6", filled && "fill-warning-border text-warning-border")} />
          </button>
        );
      })}
    </div>
  );
}
