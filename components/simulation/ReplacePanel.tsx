"use client";

import { useState } from "react";
import { useSearch, type SearchCandidate } from "@/hooks/useSearch";
import SearchDropdown from "./SearchDropdown";

type ReplacePanelProps = {
  portfolioTickers: Array<string>;
  replaceAllMode: boolean;
  fromTicker: string;
  toTicker: string;
  toName: string;
  onReplaceAllChange: (value: boolean) => void;
  onFromTickerChange: (value: string) => void;
  onDestinationSelected: (candidate: SearchCandidate) => void;
  onDestinationTyped: () => void;
};

/**
 * Controles del modo "reemplazar un ticker". El query de busqueda vive aqui
 * (no en el orquestador) para que cada panel maneje su propio autocompletado
 * con el hook useSearch.
 */
export default function ReplacePanel({
  portfolioTickers,
  replaceAllMode,
  fromTicker,
  toTicker,
  toName,
  onReplaceAllChange,
  onFromTickerChange,
  onDestinationSelected,
  onDestinationTyped,
}: ReplacePanelProps) {
  const [query, setQuery] = useState("");
  const { results, searching } = useSearch(query);

  const display = toTicker
    ? `${toTicker}${toName ? ` — ${toName}` : ""}`
    : "";

  return (
    <div className="space-y-4">
      <label className="flex cursor-pointer items-center gap-2 text-sm text-fg-muted">
        <input
          type="checkbox"
          checked={replaceAllMode}
          onChange={(event) => onReplaceAllChange(event.target.checked)}
          className="h-4 w-4 accent-accent"
        />
        Replace all tickers
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {!replaceAllMode ? (
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-fg">
              Replace
            </span>
            <select
              value={fromTicker}
              onChange={(event) => onFromTickerChange(event.target.value)}
              className="w-full rounded-card border border-border bg-surface px-3 py-2 text-sm text-fg"
            >
              <option value="">Select a ticker…</option>
              {portfolioTickers.map((ticker) => (
                <option key={ticker} value={ticker}>
                  {ticker}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="flex items-end">
            <p className="rounded-card border border-border bg-surface-2 px-3 py-2 text-sm text-fg">
              All {portfolioTickers.length} position
              {portfolioTickers.length === 1 ? "" : "s"} replaced
            </p>
          </div>
        )}

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-fg">With</span>
          <div className="relative">
            <input
              value={query || display}
              onChange={(event) => {
                setQuery(event.target.value);
                if (event.target.value !== display) onDestinationTyped();
              }}
              placeholder="Search destination ticker…"
              className="w-full rounded-card border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-subtle"
            />
            {searching ? (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-fg-subtle">
                …
              </span>
            ) : null}
            {results.length > 0 ? (
              <SearchDropdown
                results={results}
                onSelect={(candidate) => {
                  setQuery(
                    `${candidate.symbol}${candidate.name ? ` — ${candidate.name}` : ""}`
                  );
                  onDestinationSelected(candidate);
                }}
              />
            ) : null}
          </div>
        </label>
      </div>
    </div>
  );
}
