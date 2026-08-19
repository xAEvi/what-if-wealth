"use client";

import { useRef, useState, type DragEvent, type ChangeEvent } from "react";
import { parsePortfolioCsv } from "@/lib/csv/parser";
import { usePortfolio } from "@/state/portfolio-context";

export default function CsvDropzone() {
  const { dispatch } = usePortfolio();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);

  const handleFile = async (file: File) => {
    setReading(true);
    try {
      const raw = await file.text();
      const parsed = parsePortfolioCsv(raw);
      dispatch({
        type: "import",
        payload: {
          lots: parsed.lots,
          errors: parsed.errors,
          fileName: file.name,
        },
      });
    } finally {
      setReading(false);
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const onSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleFile(file);
    event.target.value = "";
  };

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
      className={`flex min-h-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
        dragging
          ? "border-zinc-800 bg-zinc-100 dark:border-zinc-200 dark:bg-zinc-800"
          : "border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:border-zinc-500 dark:hover:bg-zinc-900"
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
        {reading ? "⏳" : "📄"}
      </span>
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {reading
          ? "Reading file…"
          : "Drop your Yahoo portfolio export here, or click to browse"}
      </p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Exported CSV with Symbol, Trade Date, Purchase Price, Quantity and
        Transaction Type
      </p>
    </div>
  );
}
