import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { blockInvalidNumberKey, sanitizeNonNegativeNumberInput } from "@/lib/numeric-input";
import {
  hasActiveYarnFilters,
  type YarnFilterCriteria,
  type YarnFilterOptions,
  type YarnSortKey,
} from "@/lib/yarn-filters";

interface Props {
  options: YarnFilterOptions;
  initialCriteria: YarnFilterCriteria;
  initialSort: YarnSortKey;
  defaultOpen: boolean;
}

type SortField = "created" | "name" | "rating" | "skeins" | "grams";
type SortDirection = "asc" | "desc";

const SORT_FIELDS: { value: SortField; label: string }[] = [
  { value: "created", label: "Data dodania" },
  { value: "name", label: "Nazwa" },
  { value: "rating", label: "Ocena" },
  { value: "skeins", label: "Motki" },
  { value: "grams", label: "Gramatura" },
];

function splitSort(sort: YarnSortKey): { field: SortField; direction: SortDirection } {
  const [field, direction] = sort.split("_") as [SortField, SortDirection];
  return { field, direction };
}

function combineSort(field: SortField, direction: SortDirection): YarnSortKey {
  return `${field}_${direction}`;
}

const selectClass = cn(
  "border-input dark:bg-input/30 h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs",
  "outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
);
const fieldLabelClass = "mb-1 block text-sm font-medium";
const checkboxClass = "border-input size-4 shrink-0 rounded";

function submit(form: HTMLFormElement | null) {
  form?.requestSubmit();
}

export default function YarnFilters({ options, initialCriteria, initialSort, defaultOpen }: Props) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [minSkeins, setMinSkeins] = useState(initialCriteria.minSkeins?.toString() ?? "");
  const [minGrams, setMinGrams] = useState(initialCriteria.minGrams?.toString() ?? "");
  const initialSplitSort = splitSort(initialSort);
  const [sortField, setSortField] = useState<SortField>(initialSplitSort.field);
  const [sortDirection, setSortDirection] = useState<SortDirection>(initialSplitSort.direction);

  const filtersActive = hasActiveYarnFilters(initialCriteria);

  function submitSort(form: HTMLFormElement | null, field: SortField, direction: SortDirection) {
    if (!form) return;
    const hiddenSortInput = form.elements.namedItem("sort");
    if (hiddenSortInput instanceof HTMLInputElement) {
      hiddenSortInput.value = combineSort(field, direction);
    }
    form.requestSubmit();
  }

  return (
    <form method="GET" action="/dashboard" className="border-border bg-card mb-6 rounded-2xl border p-4">
      <input type="hidden" name="sort" value={combineSort(sortField, sortDirection)} readOnly />
      <input type="hidden" name="filtersOpen" value={isOpen ? "1" : "0"} readOnly />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="sortField">Sortuj:</Label>
          <div className="border-input flex overflow-hidden rounded-md border">
            <div className="relative">
              <select
                id="sortField"
                value={sortField}
                onChange={(e) => {
                  const nextField = e.target.value as SortField;
                  setSortField(nextField);
                  submitSort(e.currentTarget.form, nextField, sortDirection);
                }}
                className={cn(selectClass, "w-auto appearance-none rounded-none border-0 pr-8")}
              >
                {SORT_FIELDS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2" />
            </div>
            <button
              type="button"
              onClick={(e) => {
                const nextDirection: SortDirection = sortDirection === "asc" ? "desc" : "asc";
                setSortDirection(nextDirection);
                submitSort(e.currentTarget.form, sortField, nextDirection);
              }}
              title={sortDirection === "asc" ? "Rosnąco" : "Malejąco"}
              aria-label={sortDirection === "asc" ? "Sortuj rosnąco" : "Sortuj malejąco"}
              className="border-input hover:bg-secondary flex shrink-0 items-center justify-center border-l px-3 transition-colors"
            >
              {sortDirection === "asc" ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {filtersActive && (
            <a
              href={`/dashboard?sort=${combineSort(sortField, sortDirection)}&filtersOpen=${isOpen ? "1" : "0"}`}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm underline-offset-2 hover:underline"
            >
              <X className="size-3.5" />
              Wyczyść filtry
            </a>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setIsOpen((prev) => !prev);
            }}
            aria-expanded={isOpen}
            aria-controls="yarn-filters-panel"
          >
            <SlidersHorizontal className="size-4" />
            Filtry
            {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </Button>
        </div>
      </div>

      <div
        id="yarn-filters-panel"
        className={
          isOpen ? "border-border mt-4 grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-3" : "hidden"
        }
      >
        <div>
          <Label htmlFor="manufacturer" className={fieldLabelClass}>
            Producent
          </Label>
          <select
            id="manufacturer"
            name="manufacturer"
            defaultValue={initialCriteria.manufacturer ?? ""}
            onChange={(e) => {
              submit(e.currentTarget.form);
            }}
            className={selectClass}
          >
            <option value="">Wszyscy</option>
            {options.manufacturers.map((manufacturer) => (
              <option key={manufacturer} value={manufacturer}>
                {manufacturer}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="color" className={fieldLabelClass}>
            Kolor
          </Label>
          <select
            id="color"
            name="color"
            defaultValue={initialCriteria.color ?? ""}
            onChange={(e) => {
              submit(e.currentTarget.form);
            }}
            className={selectClass}
          >
            <option value="">Wszystkie</option>
            {options.colors.map((color) => (
              <option key={color} value={color}>
                {color}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className={fieldLabelClass}>Skład</span>
          <div className="border-input max-h-32 space-y-1.5 overflow-y-auto rounded-md border p-2">
            {options.fibers.length === 0 && <p className="text-muted-foreground text-sm">Brak danych</p>}
            {options.fibers.map((fiber) => (
              <Label key={fiber} className="flex items-center gap-2 text-sm font-normal">
                <input
                  type="checkbox"
                  name="fiber"
                  value={fiber}
                  defaultChecked={initialCriteria.fibers?.includes(fiber) ?? false}
                  onChange={(e) => {
                    submit(e.currentTarget.form);
                  }}
                  className={checkboxClass}
                />
                {fiber}
              </Label>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="needle" className={fieldLabelClass}>
            Rozmiar drutów
          </Label>
          <select
            id="needle"
            name="needle"
            defaultValue={initialCriteria.needleSizeMm?.toString() ?? ""}
            onChange={(e) => {
              submit(e.currentTarget.form);
            }}
            className={selectClass}
          >
            <option value="">Wszystkie</option>
            {options.needleSizes.map((size) => (
              <option key={size} value={size}>
                {size} mm
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="hook" className={fieldLabelClass}>
            Rozmiar szydełka
          </Label>
          <select
            id="hook"
            name="hook"
            defaultValue={initialCriteria.hookSizeMm?.toString() ?? ""}
            onChange={(e) => {
              submit(e.currentTarget.form);
            }}
            className={selectClass}
          >
            <option value="">Wszystkie</option>
            {options.hookSizes.map((size) => (
              <option key={size} value={size}>
                {size} mm
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <Label htmlFor="hideExhausted" className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              id="hideExhausted"
              name="hideExhausted"
              value="1"
              defaultChecked={initialCriteria.hideExhausted === true}
              onChange={(e) => {
                submit(e.currentTarget.form);
              }}
              className={checkboxClass}
            />
            Ukryj wyczerpane
          </Label>
        </div>

        <div>
          <Label htmlFor="minSkeins" className={fieldLabelClass}>
            Min. motków
          </Label>
          <Input
            id="minSkeins"
            name="minSkeins"
            type="number"
            min={0}
            step="any"
            value={minSkeins}
            onChange={(e) => {
              setMinSkeins(sanitizeNonNegativeNumberInput(e.target.value));
            }}
            onKeyDown={(e) => {
              blockInvalidNumberKey(e);
              if (e.key === "Enter") submit(e.currentTarget.form);
            }}
            onBlur={(e) => {
              submit(e.currentTarget.form);
            }}
          />
        </div>

        <div>
          <Label htmlFor="minGrams" className={fieldLabelClass}>
            Min. gramów
          </Label>
          <Input
            id="minGrams"
            name="minGrams"
            type="number"
            min={0}
            step="any"
            value={minGrams}
            onChange={(e) => {
              setMinGrams(sanitizeNonNegativeNumberInput(e.target.value));
            }}
            onKeyDown={(e) => {
              blockInvalidNumberKey(e);
              if (e.key === "Enter") submit(e.currentTarget.form);
            }}
            onBlur={(e) => {
              submit(e.currentTarget.form);
            }}
          />
        </div>
      </div>
    </form>
  );
}
