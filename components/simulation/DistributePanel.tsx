"use client";

import { useState } from "react";
import { useSearch, type SearchCandidate } from "@/hooks/useSearch";
import SearchDropdown from "./SearchDropdown";
import Card from "@/components/ui/Card";
import type { WeightRow } from "./types";

type CoverageIssue = {
  ticker: string;
  firstTradeDate?: string;
};

type DistributePanelProps = {
  rows: Array<WeightRow>;
  coverageIssues: Array<CoverageIssue>;
  sum: number;
  sumValid: boolean;
  onAdd: (candidate: SearchCandidate) => void;
  onRemove: (ticker: string) => void;
  onWeightChange: (ticker: string, raw: string) => void;
  onSplitEvenly: () => void;
};

/**
 * Controles del modo "distribuir por pesos". Maneja su propio autocompletado
 * para agregar tickers mediante el hook useSearch.
 */
export default function DistributePanel({
  rows,
  coverageIssues,
  sum,
  sumValid,
  onAdd,
  onRemove,
  onWeightChange,
  onSplitEvenly,
}: DistributePanelProps) {
  const [query, setQuery] = useState("");
  const { results, searching } = useSearch(query);

  const issueFor = (ticker: string) =>
    coverageIssues.find((issue) => issue.ticker === ticker);

  return (
    <Card className="space-y-3 p-4">
      {rows.map((row) => {
        const issue = issueFor(row.ticker);
        return (
          <div key={row.ticker} className="flex items-center gap-3">
            <span className="w-24 shrink-0 font-medium text-fg">
              {row.ticker}
            </span>
            <input
              type="number"
              min={0}
              max={100}
              step="any"
              value={
                Number.isInteger(row.weight)
                  ? row.weight
                  : row.weight.toFixed(2)
              }
              onChange={(event) => onWeightChange(row.ticker, event.target.value)}
              className="w-24 rounded-card border border-border bg-surface px-2 py-1.5 text-right text-sm tabular-nums text-fg"
            />
            <span className="text-sm text-fg-subtle">%</span>
            {issue ? (
              <span className="text-xs text-danger">
                only has data since {issue.firstTradeDate}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => onRemove(row.ticker)}
              className="ml-auto rounded-sm-card px-2 py-1 text-sm text-fg-subtle transition-colors hover:bg-surface-2 hover:text-danger"
              aria-label={`Remove ${row.ticker}`}
            >
              ✕
            </button>
          </div>
        );
      })}

      <div className="relative">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Add a ticker…"
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
              setQuery("");
              onAdd(candidate);
            }}
          />
        ) : null}
      </div>

      <div className="flex items-center justify-between border-t border-border pt-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-fg-subtle">Total</span>
          <span
            className={`text-sm font-semibold tabular-nums ${
              sumValid ? "text-success" : "text-danger"
            }`}
          >
            {sum.toFixed(1)}%
          </span>
          {rows.length > 1 ? (
            <button
              type="button"
              onClick={onSplitEvenly}
              className="rounded-sm-card border border-border px-2 py-1 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-2"
            >
              Split evenly
            </button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
