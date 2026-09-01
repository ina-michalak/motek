import { describe, expect, it } from "vitest";
import {
  filterAndSortYarns,
  getYarnFilterOptions,
  hasActiveYarnFilters,
  parseYarnFilters,
  type YarnFilterCriteria,
} from "@/lib/yarn-filters";
import type { Yarn } from "@/types";

let nextId = 0;

function makeYarn(overrides: Partial<Yarn> = {}): Yarn {
  nextId += 1;
  return {
    id: `yarn-${nextId}`,
    user_id: "user-1",
    name: "Merino Fino",
    manufacturer: "Drops",
    quantity_skeins: 3,
    quantity_grams: null,
    color: "Czerwony",
    dye_lot: null,
    composition: [{ fiber: "Wełna", percent: 100 }],
    needle_size_mm: 4,
    hook_size_mm: null,
    gauge_note: null,
    rating: 4,
    note: null,
    photo_url: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("filterAndSortYarns — filtry pojedyncze", () => {
  it("filtruje po producencie", () => {
    const yarns = [makeYarn({ manufacturer: "Drops" }), makeYarn({ manufacturer: "Katia" })];
    const result = filterAndSortYarns(yarns, { manufacturer: "Katia" }, "created_desc");
    expect(result).toHaveLength(1);
    expect(result[0].manufacturer).toBe("Katia");
  });

  it("filtruje po kolorze", () => {
    const yarns = [makeYarn({ color: "Czerwony" }), makeYarn({ color: "Niebieski" })];
    const result = filterAndSortYarns(yarns, { color: "Niebieski" }, "created_desc");
    expect(result).toHaveLength(1);
    expect(result[0].color).toBe("Niebieski");
  });

  it("filtruje po rozmiarze drutów", () => {
    const yarns = [makeYarn({ needle_size_mm: 3 }), makeYarn({ needle_size_mm: 5 })];
    const result = filterAndSortYarns(yarns, { needleSizeMm: 5 }, "created_desc");
    expect(result).toHaveLength(1);
    expect(result[0].needle_size_mm).toBe(5);
  });

  it("filtruje po rozmiarze szydełka", () => {
    const yarns = [makeYarn({ hook_size_mm: 3 }), makeYarn({ hook_size_mm: 6 })];
    const result = filterAndSortYarns(yarns, { hookSizeMm: 6 }, "created_desc");
    expect(result).toHaveLength(1);
    expect(result[0].hook_size_mm).toBe(6);
  });

  it("domyślnie (bez filtra dostępności) pokazuje też wyczerpane włóczki", () => {
    const yarns = [makeYarn({ quantity_skeins: 0, quantity_grams: null }), makeYarn({ quantity_skeins: 5 })];
    const result = filterAndSortYarns(yarns, {}, "created_desc");
    expect(result).toHaveLength(2);
  });

  it("filtr dostępności ukrywa wyczerpane włóczki", () => {
    const yarns = [makeYarn({ quantity_skeins: 0, quantity_grams: null }), makeYarn({ quantity_skeins: 5 })];
    const result = filterAndSortYarns(yarns, { hideExhausted: true }, "created_desc");
    expect(result).toHaveLength(1);
    expect(result[0].quantity_skeins).toBe(5);
  });

  it("próg minSkeins wyklucza włóczki poniżej progu i bez pola motków", () => {
    const yarns = [
      makeYarn({ quantity_skeins: 1 }),
      makeYarn({ quantity_skeins: 5 }),
      makeYarn({ quantity_skeins: null, quantity_grams: 200 }),
    ];
    const result = filterAndSortYarns(yarns, { minSkeins: 2 }, "created_desc");
    expect(result).toHaveLength(1);
    expect(result[0].quantity_skeins).toBe(5);
  });

  it("próg minSkeins jest inkluzywny (>=)", () => {
    const yarns = [makeYarn({ quantity_skeins: 2 })];
    const result = filterAndSortYarns(yarns, { minSkeins: 2 }, "created_desc");
    expect(result).toHaveLength(1);
  });

  it("próg minGrams wyklucza włóczki poniżej progu i bez pola gramatury", () => {
    const yarns = [
      makeYarn({ quantity_skeins: null, quantity_grams: 50 }),
      makeYarn({ quantity_skeins: null, quantity_grams: 300 }),
      makeYarn({ quantity_skeins: 3, quantity_grams: null }),
    ];
    const result = filterAndSortYarns(yarns, { minGrams: 100 }, "created_desc");
    expect(result).toHaveLength(1);
    expect(result[0].quantity_grams).toBe(300);
  });
});

describe("filterAndSortYarns — skład (dopasowanie OR)", () => {
  it("dopasowuje włóczkę zawierającą chociaż jedno z zaznaczonych włókien", () => {
    const yarns = [
      makeYarn({ composition: [{ fiber: "Wełna", percent: 100 }] }),
      makeYarn({ composition: [{ fiber: "Bawełna", percent: 100 }] }),
      makeYarn({ composition: [{ fiber: "Akryl", percent: 100 }] }),
    ];
    const result = filterAndSortYarns(yarns, { fibers: ["Wełna", "Bawełna"] }, "created_desc");
    expect(result).toHaveLength(2);
    expect(result.map((y) => y.composition?.[0].fiber).sort()).toEqual(["Bawełna", "Wełna"]);
  });

  it("dopasowuje mieszankę zawierającą jedno z kilku zaznaczonych włókien", () => {
    const yarns = [
      makeYarn({
        composition: [
          { fiber: "Wełna", percent: 80 },
          { fiber: "Poliamid", percent: 20 },
        ],
      }),
    ];
    const result = filterAndSortYarns(yarns, { fibers: ["Poliamid"] }, "created_desc");
    expect(result).toHaveLength(1);
  });

  it("wyklucza włóczkę bez żadnego zaznaczonego włókna", () => {
    const yarns = [makeYarn({ composition: [{ fiber: "Akryl", percent: 100 }] })];
    const result = filterAndSortYarns(yarns, { fibers: ["Wełna"] }, "created_desc");
    expect(result).toHaveLength(0);
  });

  it("wyklucza włóczkę bez zdefiniowanego składu, gdy filtr składu aktywny", () => {
    const yarns = [makeYarn({ composition: null })];
    const result = filterAndSortYarns(yarns, { fibers: ["Wełna"] }, "created_desc");
    expect(result).toHaveLength(0);
  });
});

describe("filterAndSortYarns — kombinacja filtrów (AND)", () => {
  it("łączy filtry logiką AND", () => {
    const yarns = [
      makeYarn({ manufacturer: "Drops", color: "Czerwony" }),
      makeYarn({ manufacturer: "Drops", color: "Niebieski" }),
      makeYarn({ manufacturer: "Katia", color: "Czerwony" }),
    ];
    const result = filterAndSortYarns(yarns, { manufacturer: "Drops", color: "Czerwony" }, "created_desc");
    expect(result).toHaveLength(1);
    expect(result[0].manufacturer).toBe("Drops");
    expect(result[0].color).toBe("Czerwony");
  });

  it("brak kryteriów zwraca wszystkie włóczki", () => {
    const yarns = [makeYarn(), makeYarn(), makeYarn()];
    const result = filterAndSortYarns(yarns, {}, "created_desc");
    expect(result).toHaveLength(3);
  });
});

describe("filterAndSortYarns — sortowanie", () => {
  it("created_desc: najnowsze pierwsze (domyślne zachowanie)", () => {
    const yarns = [
      makeYarn({ name: "Stara", created_at: "2026-01-01T00:00:00.000Z" }),
      makeYarn({ name: "Nowa", created_at: "2026-02-01T00:00:00.000Z" }),
    ];
    const result = filterAndSortYarns(yarns, {}, "created_desc");
    expect(result.map((y) => y.name)).toEqual(["Nowa", "Stara"]);
  });

  it("created_asc: najstarsze pierwsze", () => {
    const yarns = [
      makeYarn({ name: "Stara", created_at: "2026-01-01T00:00:00.000Z" }),
      makeYarn({ name: "Nowa", created_at: "2026-02-01T00:00:00.000Z" }),
    ];
    const result = filterAndSortYarns(yarns, {}, "created_asc");
    expect(result.map((y) => y.name)).toEqual(["Stara", "Nowa"]);
  });

  it("name_asc / name_desc sortują alfabetycznie", () => {
    const yarns = [makeYarn({ name: "Zula" }), makeYarn({ name: "Alpaka" })];
    expect(filterAndSortYarns(yarns, {}, "name_asc").map((y) => y.name)).toEqual(["Alpaka", "Zula"]);
    expect(filterAndSortYarns(yarns, {}, "name_desc").map((y) => y.name)).toEqual(["Zula", "Alpaka"]);
  });

  it("rating_desc / rating_asc umieszczają brak oceny na końcu niezależnie od kierunku", () => {
    const yarns = [
      makeYarn({ name: "Bez oceny", rating: null }),
      makeYarn({ name: "Trzy", rating: 3 }),
      makeYarn({ name: "Pięć", rating: 5 }),
    ];
    expect(filterAndSortYarns(yarns, {}, "rating_desc").map((y) => y.name)).toEqual(["Pięć", "Trzy", "Bez oceny"]);
    expect(filterAndSortYarns(yarns, {}, "rating_asc").map((y) => y.name)).toEqual(["Trzy", "Pięć", "Bez oceny"]);
  });

  it("skeins_desc / skeins_asc umieszczają brak motków na końcu niezależnie od kierunku", () => {
    const yarns = [
      makeYarn({ name: "Tylko gramy", quantity_skeins: null, quantity_grams: 100 }),
      makeYarn({ name: "Dwa motki", quantity_skeins: 2, quantity_grams: null }),
      makeYarn({ name: "Pięć motków", quantity_skeins: 5, quantity_grams: null }),
    ];
    expect(filterAndSortYarns(yarns, {}, "skeins_desc").map((y) => y.name)).toEqual([
      "Pięć motków",
      "Dwa motki",
      "Tylko gramy",
    ]);
    expect(filterAndSortYarns(yarns, {}, "skeins_asc").map((y) => y.name)).toEqual([
      "Dwa motki",
      "Pięć motków",
      "Tylko gramy",
    ]);
  });

  it("grams_desc / grams_asc umieszczają brak gramatury na końcu niezależnie od kierunku", () => {
    const yarns = [
      makeYarn({ name: "Tylko motki", quantity_skeins: 2, quantity_grams: null }),
      makeYarn({ name: "Sto gram", quantity_skeins: null, quantity_grams: 100 }),
      makeYarn({ name: "Pięćset gram", quantity_skeins: null, quantity_grams: 500 }),
    ];
    expect(filterAndSortYarns(yarns, {}, "grams_desc").map((y) => y.name)).toEqual([
      "Pięćset gram",
      "Sto gram",
      "Tylko motki",
    ]);
    expect(filterAndSortYarns(yarns, {}, "grams_asc").map((y) => y.name)).toEqual([
      "Sto gram",
      "Pięćset gram",
      "Tylko motki",
    ]);
  });
});

describe("getYarnFilterOptions", () => {
  it("zwraca unikalne, posortowane wartości obecne w bibliotece", () => {
    const yarns = [
      makeYarn({ manufacturer: "Katia", color: "Czerwony", needle_size_mm: 5, hook_size_mm: null }),
      makeYarn({ manufacturer: "Drops", color: "Czerwony", needle_size_mm: 3, hook_size_mm: 4 }),
      makeYarn({ manufacturer: "Drops", color: null, needle_size_mm: null, hook_size_mm: 4 }),
    ];
    const options = getYarnFilterOptions(yarns);
    expect(options.manufacturers).toEqual(["Drops", "Katia"]);
    expect(options.colors).toEqual(["Czerwony"]);
    expect(options.needleSizes).toEqual([3, 5]);
    expect(options.hookSizes).toEqual([4]);
  });

  it("zbiera unikalne włókna ze wszystkich pozycji składu", () => {
    const yarns = [
      makeYarn({
        composition: [
          { fiber: "Wełna", percent: 80 },
          { fiber: "Poliamid", percent: 20 },
        ],
      }),
      makeYarn({ composition: [{ fiber: "Wełna", percent: 100 }] }),
      makeYarn({ composition: null }),
    ];
    const options = getYarnFilterOptions(yarns);
    expect(options.fibers).toEqual(["Poliamid", "Wełna"]);
  });

  it("zwraca puste listy dla pustej biblioteki", () => {
    const options = getYarnFilterOptions([]);
    expect(options).toEqual({ manufacturers: [], colors: [], fibers: [], needleSizes: [], hookSizes: [] });
  });
});

describe("parseYarnFilters", () => {
  it("bez parametrów zwraca puste kryteria i domyślne sortowanie", () => {
    const { criteria, sort } = parseYarnFilters(new URLSearchParams());
    expect(criteria).toEqual({});
    expect(sort).toBe("created_desc");
  });

  it("parsuje wszystkie parametry filtrów", () => {
    const params = new URLSearchParams({
      manufacturer: "Drops",
      color: "Czerwony",
      needle: "4",
      hook: "5",
      hideExhausted: "1",
      minSkeins: "2",
      minGrams: "100",
      sort: "name_asc",
    });
    const { criteria, sort } = parseYarnFilters(params);
    expect(criteria).toEqual<YarnFilterCriteria>({
      manufacturer: "Drops",
      color: "Czerwony",
      needleSizeMm: 4,
      hookSizeMm: 5,
      hideExhausted: true,
      minSkeins: 2,
      minGrams: 100,
    });
    expect(sort).toBe("name_asc");
  });

  it("parsuje wielokrotny parametr fiber", () => {
    const params = new URLSearchParams();
    params.append("fiber", "Wełna");
    params.append("fiber", "Bawełna");
    const { criteria } = parseYarnFilters(params);
    expect(criteria.fibers).toEqual(["Wełna", "Bawełna"]);
  });

  it("ignoruje nieznany klucz sort i wraca do domyślnego", () => {
    const { sort } = parseYarnFilters(new URLSearchParams({ sort: "totally_invalid" }));
    expect(sort).toBe("created_desc");
  });

  it("ignoruje niepoprawną wartość liczbową bez rzucania wyjątku", () => {
    const { criteria } = parseYarnFilters(new URLSearchParams({ minSkeins: "not-a-number" }));
    expect(criteria.minSkeins).toBeUndefined();
  });

  it("hideExhausted jest ustawiane tylko dla wartości '1'", () => {
    expect(parseYarnFilters(new URLSearchParams({ hideExhausted: "true" })).criteria.hideExhausted).toBeUndefined();
    expect(parseYarnFilters(new URLSearchParams({ hideExhausted: "1" })).criteria.hideExhausted).toBe(true);
  });
});

describe("hasActiveYarnFilters", () => {
  it("zwraca false dla pustych kryteriów", () => {
    expect(hasActiveYarnFilters({})).toBe(false);
  });

  it("zwraca true, gdy którekolwiek pole jest ustawione", () => {
    expect(hasActiveYarnFilters({ manufacturer: "Drops" })).toBe(true);
    expect(hasActiveYarnFilters({ color: "Czerwony" })).toBe(true);
    expect(hasActiveYarnFilters({ fibers: ["Wełna"] })).toBe(true);
    expect(hasActiveYarnFilters({ needleSizeMm: 4 })).toBe(true);
    expect(hasActiveYarnFilters({ hookSizeMm: 4 })).toBe(true);
    expect(hasActiveYarnFilters({ hideExhausted: true })).toBe(true);
    expect(hasActiveYarnFilters({ minSkeins: 1 })).toBe(true);
    expect(hasActiveYarnFilters({ minGrams: 1 })).toBe(true);
  });

  it("zwraca false, gdy fibers jest pustą tablicą", () => {
    expect(hasActiveYarnFilters({ fibers: [] })).toBe(false);
  });
});
