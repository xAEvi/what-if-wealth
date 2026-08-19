"use client";

import { useState } from "react";
import { useSearch, type SearchCandidate } from "@/hooks/useSearch";
import type { DcaFrequency } from "@/lib/portfolio/engine";
import SearchDropdown from "./SearchDropdown";
import Card from "@/components/ui/Card";
import type { WeightRow } from "./types";

type CoverageIssue = {
  ticker: string;
  firstTradeDate?: string;
};

type DcaPanelProps = {
  rows: Array<WeightRow>;
  sum: number;
  sumValid: boolean;
  coverageIssues: Array<CoverageIssue>;
  amount: number;
  frequency: DcaFrequency;
  startDate: string;
  onAdd: (candidate: SearchCandidate) => void;
  onRemove: (ticker: string) => void;
  onWeightChange: (ticker: string, raw: string) => void;
  onSplitEvenly: () => void;
  onAmountChange: (value: number) => void;
  onFrequencyChange: (value: DcaFrequency) => void;
  onStartChange: (value: string) => void;
};

const FREQUENCIES: Array<{ value: DcaFrequency; label: string }> = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annual", label: "Annual" },
];

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Controles de la simulacion "Invest from Zero" (DCA): tickers con pesos, monto
 * por periodo, frecuencia de aporte y fecha de inicio.
 */
export default function DcaPanel({
  rows,
  sum,
  sumValid,
  coverageIssues,
  amount,
  frequency,
  startDate,
  onAdd,
  onRemove,
  onWeightChange,
  onSplitEvenly,
  onAmountChange,
  onFrequencyChange,
  onStartChange,
}: DcaPanelProps) {
  const [query, setQuery] = useState("");
  const { results, searching } = useSearch(query);

  const issueFor = (ticker: string) =>
    coverageIssues.find((issue) => issue.ticker === ticker);

  return (
    <Card className="space-y-4 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-fg">
            Amount per period (USD)
          </span>
          <input
            type="number"
            min={0}
            step="any"
            value={Number.isFinite(amount) ? amount : ""}
            onChange={(event) =>
              onAmountChange(
                Number(event.target.value) >= 0
                  ? Number(event.target.value)
                  : 0
              )
            }
            placeholder="100"
            className="w-full rounded-sm-card border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-subtle"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-fg">
            Frequency
          </span>
          <select
            value={frequency}
            onChange={(event) =>
              onFrequencyChange(event.target.value as DcaFrequency)
            }
            className="w-full rounded-sm-card border border-border bg-surface px-3 py-2 text-sm text-fg"
          >
            {FREQUENCIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-fg">
            Start date
          </span>
          <input
            type="date"
            value={startDate}
            max={today()}
            onChange={(event) => onStartChange(event.target.value)}
            className="w-full rounded-sm-card border border-border bg-surface px-3 py-2 text-sm text-fg"
          />
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-fg">Tickers and weights</p>
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
                className="w-24 rounded-sm-card border border-border bg-surface px-2 py-1.5 text-right text-sm tabular-nums text-fg"
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
            className="w-full rounded-sm-card border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-subtle"
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
      </div>
    </Card>
  );
}
