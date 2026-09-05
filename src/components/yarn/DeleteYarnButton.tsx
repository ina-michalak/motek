import React, { useState } from "react";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ServerError } from "@/components/auth/ServerError";

interface Props {
  yarnId: string;
  yarnName: string;
}

export default function DeleteYarnButton({ yarnId, yarnName }: Props) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    setError(null);
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/yarns/${yarnId}`, { method: "DELETE" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error);
      }
      window.location.href = "/dashboard";
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : "Nie udało się usunąć włóczki.";
      setError(message);
      setIsDeleting(false);
    }
  }

  return (
    <AlertDialog
      onOpenChange={(open) => {
        if (!open) setError(null);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button type="button" variant="destructive">
          <Trash2 className="size-4" />
          Usuń
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Usunąć „{yarnName}”?</AlertDialogTitle>
          <AlertDialogDescription>
            Ta operacja jest nieodwracalna. Włóczka zostanie trwale usunięta z Twojej biblioteki.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <ServerError message={error} />}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Anuluj</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={isDeleting} onClick={handleConfirm}>
            {isDeleting ? "Usuwanie…" : "Usuń"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
