export interface YarnFiberComposition {
  fiber: string;
  percent: number;
}

export interface Yarn {
  id: string;
  user_id: string;
  name: string;
  manufacturer: string;
  quantity_skeins: number | null;
  quantity_grams: number | null;
  color: string | null;
  dye_lot: string | null;
  composition: YarnFiberComposition[] | null;
  needle_size_mm: number | null;
  hook_size_mm: number | null;
  gauge_note: string | null;
  rating: number | null;
  note: string | null;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
}
