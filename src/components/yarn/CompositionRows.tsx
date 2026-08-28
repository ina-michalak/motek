import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { COMMON_FIBERS } from "@/lib/validation/yarn";
import { cn } from "@/lib/utils";
import type { YarnFiberComposition } from "@/types";

const rowInputClass =
  "border-white/20 bg-white/10 text-white placeholder-white/40 focus-visible:border-purple-400 focus-visible:ring-purple-400/50";

interface CompositionRowsProps {
  value: YarnFiberComposition[];
  onChange: (value: YarnFiberComposition[]) => void;
}

export function CompositionRows({ value, onChange }: CompositionRowsProps) {
  function updateRow(index: number, patch: Partial<YarnFiberComposition>) {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function addRow() {
    onChange([...value, { fiber: "", percent: 0 }]);
  }

  return (
    <div className="space-y-2">
      {value.map((row, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            list="fibers"
            value={row.fiber}
            onChange={(e) => {
              updateRow(index, { fiber: e.target.value });
            }}
            placeholder="Rodzaj włókna"
            aria-label="Rodzaj włókna"
            className={cn(rowInputClass, "flex-1")}
          />
          <Input
            type="number"
            min={0}
            max={100}
            step="any"
            value={row.percent}
            onChange={(e) => {
              updateRow(index, { percent: Number(e.target.value) });
            }}
            placeholder="%"
            aria-label="Procent składu"
            className={cn(rowInputClass, "w-20")}
          />
          <button
            type="button"
            onClick={() => {
              removeRow(index);
            }}
            aria-label="Usuń wiersz składu"
            className="text-white/40 transition-colors hover:text-red-300"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      ))}

      <datalist id="fibers">
        {COMMON_FIBERS.map((fiber) => (
          <option key={fiber} value={fiber} />
        ))}
      </datalist>

      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-1 text-sm text-purple-300 hover:underline"
      >
        <Plus className="size-4" />
        Dodaj włókno
      </button>
    </div>
  );
}
