"use client";

import { useRef, useState, type DragEvent, type ChangeEvent } from "react";
import { useCsvImport } from "@/hooks/useCsvImport";

/**
 * Zona de arrastre para el CSV de Yahoo. Sus estados (idle, dragover, error)
 * se reflejan en borde y color, y el error se anuncia con aria-live para
 * lectores de pantalla.
 */
export default function CsvDropzone() {
  const { importFile, reading, error } = useCsvImport();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) importFile(file);
  };

  const onSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) importFile(file);
    event.target.value = "";
  };

  const label = error
    ? error
    : reading
      ? "Reading file…"
      : "Drop your Yahoo portfolio export here, or click to browse";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload a Yahoo portfolio CSV"
      onClick={() => inputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ")
          inputRef.current?.click();
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`flex min-h-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed p-8 text-center transition-colors ${
        error
          ? "border-danger bg-danger/5"
          : dragging
            ? "border-accent bg-accent/5"
            : "border-border hover:border-fg-subtle hover:bg-surface-2"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={onSelect}
      />
      <span className="text-3xl" aria-hidden>
        {reading ? "⏳" : error ? "⚠️" : "📄"}
      </span>
      <p className={`text-sm font-medium ${error ? "text-danger" : "text-fg"}`}>
        {label}
      </p>
      {!error && !reading ? (
        <p className="text-xs text-fg-subtle">
          Exported CSV with Symbol, Trade Date, Purchase Price, Quantity and
          Transaction Type
        </p>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {error ?? ""}
      </p>
    </div>
  );
}
