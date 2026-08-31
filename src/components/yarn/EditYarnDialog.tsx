import { useState } from "react";
import { Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import YarnForm from "@/components/yarn/YarnForm";
import type { CompositionRow } from "@/components/yarn/CompositionRows";
import type { YarnWithPhotoUrl } from "@/lib/services/yarns";

interface Props {
  yarn: YarnWithPhotoUrl;
  serverError?: string | null;
  defaultOpen?: boolean;
}

function toCompositionRows(yarn: YarnWithPhotoUrl): CompositionRow[] {
  if (!yarn.composition || yarn.composition.length === 0) {
    return [{ id: crypto.randomUUID(), fiber: "", percent: "" }];
  }
  return yarn.composition.map((row) => ({
    id: crypto.randomUUID(),
    fiber: row.fiber,
    percent: String(row.percent),
  }));
}

export default function EditYarnDialog({ yarn, serverError, defaultOpen }: Props) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <Pencil className="size-4" />
          Edytuj
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edytuj włóczkę</DialogTitle>
        </DialogHeader>
        <YarnForm
          mode="edit"
          action={`/api/yarns/${yarn.id}`}
          submitLabel="Zapisz zmiany"
          serverError={serverError}
          initialValues={{
            name: yarn.name,
            manufacturer: yarn.manufacturer,
            quantity_skeins: yarn.quantity_skeins != null ? String(yarn.quantity_skeins) : "",
            quantity_grams: yarn.quantity_grams != null ? String(yarn.quantity_grams) : "",
            color: yarn.color ?? "",
            dye_lot: yarn.dye_lot ?? "",
            needle_size_mm: yarn.needle_size_mm != null ? String(yarn.needle_size_mm) : "",
            hook_size_mm: yarn.hook_size_mm != null ? String(yarn.hook_size_mm) : "",
            gauge_note: yarn.gauge_note ?? "",
            note: yarn.note ?? "",
          }}
          initialComposition={toCompositionRows(yarn)}
          initialRating={yarn.rating}
          existingPhotoUrl={yarn.photoUrl}
        />
      </DialogContent>
    </Dialog>
  );
}
