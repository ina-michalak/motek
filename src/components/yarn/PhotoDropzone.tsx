import { useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface PhotoDropzoneProps {
  id: string;
  name: string;
  preview: string | null;
  onFileSelected: (file: File | null) => void;
  invalid?: boolean;
}

export function PhotoDropzone({ id, name, preview, onFileSelected, invalid }: PhotoDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function openFileDialog() {
    inputRef.current?.click();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openFileDialog();
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files.item(0);
    if (file && inputRef.current) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      inputRef.current.files = dataTransfer.files;
    }
    onFileSelected(file);
  }

  return (
    <div>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          onFileSelected(e.target.files?.[0] ?? null);
        }}
      />
      <div
        role="button"
        tabIndex={0}
        aria-invalid={invalid}
        onClick={openFileDialog}
        onKeyDown={handleKeyDown}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => {
          setIsDragging(false);
        }}
        onDrop={handleDrop}
        className={cn(
          "border-input flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-6 text-center transition-colors",
          isDragging ? "border-primary bg-accent" : "hover:bg-accent/50",
          invalid && "border-destructive",
        )}
      >
        {preview ? (
          <img src={preview} alt="Podgląd zdjęcia włóczki" className="h-32 w-32 rounded-lg object-cover" />
        ) : (
          <>
            <ImagePlus className="text-muted-foreground size-6" />
            <p className="text-sm">
              <span className="text-primary font-medium">Wybierz zdjęcie</span> lub przeciągnij i upuść
            </p>
            <p className="text-muted-foreground text-xs">JPEG, PNG lub WEBP, maks. 5MB</p>
          </>
        )}
      </div>
    </div>
  );
}
