"use client";

import type { SearchCandidate } from "@/hooks/useSearch";

type SearchDropdownProps = {
  results: Array<SearchCandidate>;
  onSelect: (candidate: SearchCandidate) => void;
};

/** Lista de resultados de autocompletado posicionada bajo el input. */
export default function SearchDropdown({
  results,
  onSelect,
}: SearchDropdownProps) {
  return (
    <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-card border border-border bg-surface shadow-card">
      {results.map((candidate) => (
        <li key={candidate.symbol}>
          <button
            type="button"
            onClick={() => onSelect(candidate)}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-surface-2"
          >
            <span className="font-medium text-fg">{candidate.symbol}</span>
            <span className="truncate text-fg-subtle">{candidate.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
