import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { COMMON_FIBERS } from "@/lib/validation/yarn";
import { blockInvalidNumberKey, sanitizeNonNegativeNumberInput } from "@/lib/numeric-input";

export interface CompositionRow {
  id: string;
  fiber: string;
  percent: string;
}

interface CompositionRowsProps {
  value: CompositionRow[];
  onChange: (value: CompositionRow[]) => void;
}

export function CompositionRows({ value, onChange }: CompositionRowsProps) {
  function updateRow(id: string, patch: Partial<CompositionRow>) {
    onChange(value.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function removeRow(id: string) {
    onChange(value.filter((row) => row.id !== id));
  }

  function addRow() {
    onChange([...value, { id: crypto.randomUUID(), fiber: "", percent: "" }]);
  }

  return (
    <div className="space-y-2">
      {value.map((row) => (
        <div key={row.id} className="flex items-center gap-2">
          <Input
            list="fibers"
            value={row.fiber}
            onChange={(e) => {
              updateRow(row.id, { fiber: e.target.value });
            }}
            placeholder="Rodzaj włókna"
            aria-label="Rodzaj włókna"
            className="flex-1"
          />
          <Input
            type="number"
            min={0}
            max={100}
            step="any"
            value={row.percent}
            onChange={(e) => {
              updateRow(row.id, { percent: sanitizeNonNegativeNumberInput(e.target.value) });
            }}
            onKeyDown={blockInvalidNumberKey}
            placeholder="%"
            aria-label="Procent składu"
            className="w-20"
          />
          <button
            type="button"
            onClick={() => {
              removeRow(row.id);
            }}
            aria-label="Usuń wiersz składu"
            className="text-muted-foreground hover:text-destructive transition-colors"
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

      <button type="button" onClick={addRow} className="text-primary flex items-center gap-1 text-sm hover:underline">
        <Plus className="size-4" />
        Dodaj włókno
      </button>
    </div>
  );
}
