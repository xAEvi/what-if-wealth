"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildSeries,
  distribute,
  replaceAll,
  substituteTicker,
} from "@/lib/portfolio/engine";
import { hasCoverage } from "@/lib/market/coverage";
import { usePortfolio } from "@/state/portfolio-context";
import { useHistories } from "@/hooks/useHistories";
import ComparisonChart, {
  type ComparisonDatum,
} from "@/components/charts/ComparisonChart";
import DividendNotice from "@/components/common/DividendNotice";

type Mode = "replace" | "distribute";

type Candidate = {
  symbol: string;
  name?: string;
};

type WeightRow = {
  ticker: string;
  weight: number;
};

const usd = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

export default function WhatIfSimulation() {
  const { state } = usePortfolio();
  const { lots } = state;

  const portfolioTickers = useMemo(
    () => [...new Set(lots.map((lot) => lot.ticker))].sort(),
    [lots]
  );
  const portfolioEarliest = useMemo(
    () =>
      lots.reduce(
        (min, lot) => (lot.date < min ? lot.date : min),
        lots[0]?.date ?? ""
      ),
    [lots]
  );

  const [mode, setMode] = useState<Mode>("replace");

  // Estado del modo reemplazo.
  const [replaceAllMode, setReplaceAllMode] = useState(false);
  const [fromTicker, setFromTicker] = useState("");
  const [toTicker, setToTicker] = useState("");
  const [toName, setToName] = useState("");
  const [rQuery, setRQuery] = useState("");
  const [rResults, setRResults] = useState<Array<Candidate>>([]);
  const [rSearching, setRSearching] = useState(false);

  // Estado del modo distribucion.
  const [rows, setRows] = useState<Array<WeightRow>>([]);
  const [dQuery, setDQuery] = useState("");
  const [dResults, setDResults] = useState<Array<Candidate>>([]);
  const [dSearching, setDSearching] = useState(false);

  const sourceEarliest = useMemo(
    () =>
      lots
        .filter((lot) => lot.ticker === fromTicker)
        .reduce((min, lot) => (lot.date < min ? lot.date : min), ""),
    [lots, fromTicker]
  );
  const earliestToCover = replaceAllMode ? portfolioEarliest : sourceEarliest;

  const allTickers = useMemo(() => {
    const extra =
      mode === "replace"
        ? toTicker
          ? [toTicker]
          : []
        : rows.map((row) => row.ticker);
    return [...new Set([...portfolioTickers, ...extra])];
  }, [mode, portfolioTickers, toTicker, rows]);

  const { histories, loading: historiesLoading } = useHistories(
    allTickers,
    portfolioEarliest
  );

  const destHistory = toTicker ? histories?.[toTicker] : undefined;
  const covered =
    destHistory && earliestToCover
      ? hasCoverage(destHistory, earliestToCover)
      : null;

  const sum = rows.reduce((total, row) => total + row.weight, 0);
  const sumValid = Math.abs(sum - 100) < 1e-6;

  const coverageIssues = useMemo(
    () =>
      rows.filter((row) => {
        const history = histories?.[row.ticker];
        return history ? !hasCoverage(history, portfolioEarliest) : false;
      }),
    [rows, histories, portfolioEarliest]
  );

  // Autocompletado compartido: golpea /api/search con debounce segun el modo activo.
  const query = mode === "replace" ? rQuery : dQuery;
  useEffect(() => {
    if (!query.trim()) {
      if (mode === "replace") setRResults([]);
      else setDResults([]);
      return;
    }
    const timer = setTimeout(() => {
      if (mode === "replace") setRSearching(true);
      else setDSearching(true);
      fetch(`/api/search?q=${encodeURIComponent(query.trim())}`)
        .then((response) => response.json())
        .then((data) => {
          const results = data.results ?? [];
          if (mode === "replace") setRResults(results);
          else setDResults(results);
        })
        .catch(() => {
          if (mode === "replace") setRResults([]);
          else setDResults([]);
        })
        .finally(() => {
          if (mode === "replace") setRSearching(false);
          else setDSearching(false);
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [query, mode]);

  const original = useMemo(
    () => (histories ? buildSeries(lots, histories, "Original") : null),
    [lots, histories]
  );

  const simulated = useMemo(() => {
    if (!histories) return null;

    if (mode === "replace") {
      if (!destHistory || covered !== true) return null;
      const synthetic = replaceAllMode
        ? replaceAll(lots, destHistory)
        : substituteTicker(lots, fromTicker, destHistory);
      return buildSeries(synthetic, histories, "Simulated");
    }

    if (!sumValid || rows.length === 0 || coverageIssues.length > 0)
      return null;
    const weights = rows.map((row) => ({
      ticker: row.ticker,
      weight: row.weight,
    }));
    return buildSeries(
      distribute(lots, weights, histories),
      histories,
      "Simulated"
    );
  }, [
    histories,
    mode,
    destHistory,
    covered,
    replaceAllMode,
    fromTicker,
    rows,
    sumValid,
    coverageIssues,
    lots,
  ]);

  const combined: Array<ComparisonDatum> = useMemo(() => {
    if (!original || !simulated) return [];
    const byDate = new Map<string, ComparisonDatum>();
    for (const point of original.points)
      byDate.set(point.date, { date: point.date, original: point.value });
    for (const point of simulated.points) {
      const entry = byDate.get(point.date) ?? { date: point.date };
      entry.substituted = point.value;
      byDate.set(point.date, entry);
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [original, simulated]);

  const selectReplace = (candidate: Candidate) => {
    setToTicker(candidate.symbol);
    setToName(candidate.name ?? "");
    setRQuery(
      `${candidate.symbol}${candidate.name ? ` — ${candidate.name}` : ""}`
    );
    setRResults([]);
  };

  const addRow = (candidate: Candidate) => {
    if (rows.some((row) => row.ticker === candidate.symbol)) return;
    setRows((current) => [
      ...current,
      { ticker: candidate.symbol, weight: current.length === 0 ? 100 : 0 },
    ]);
    setDQuery("");
    setDResults([]);
  };

  const updateWeight = (ticker: string, raw: string) => {
    const value = Number(raw);
    const weight = Number.isFinite(value)
      ? Math.max(0, Math.min(100, value))
      : 0;
    setRows((current) =>
      current.map((row) => (row.ticker === ticker ? { ...row, weight } : row))
    );
  };

  const splitEvenly = () => {
    if (rows.length === 0) return;
    const share = 100 / rows.length;
    setRows((current) => current.map((row) => ({ ...row, weight: share })));
  };

  const reset = () => {
    setFromTicker("");
    setToTicker("");
    setToName("");
    setRQuery("");
    setRResults([]);
    setReplaceAllMode(false);
    setRows([]);
    setDQuery("");
    setDResults([]);
  };

  const results = mode === "replace" ? rResults : dResults;
  const searching = mode === "replace" ? rSearching : dSearching;
  const hasActive = mode === "replace" ? Boolean(toTicker) : rows.length > 0;

  if (portfolioTickers.length === 0) return null;

  return (
    <section className="space-y-4" aria-label="What-if simulation">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          What if…
        </h2>
        {hasActive ? (
          <button
            type="button"
            onClick={reset}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Reset
          </button>
        ) : null}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("replace")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            mode === "replace"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
        >
          Replace a ticker
        </button>
        <button
          type="button"
          onClick={() => setMode("distribute")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            mode === "distribute"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
        >
          Distribute by weights
        </button>
      </div>

      {mode === "replace" ? (
        <div className="space-y-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={replaceAllMode}
              onChange={(event) => {
                setReplaceAllMode(event.target.checked);
                setFromTicker("");
                setToTicker("");
                setToName("");
                setRQuery("");
              }}
              className="h-4 w-4 accent-blue-600"
            />
            Replace all tickers
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {!replaceAllMode ? (
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  Replace
                </span>
                <select
                  value={fromTicker}
                  onChange={(event) => {
                    setFromTicker(event.target.value);
                    setToTicker("");
                    setToName("");
                    setRQuery("");
                  }}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
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
                <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
                  All {portfolioTickers.length} position
                  {portfolioTickers.length === 1 ? "" : "s"} replaced
                </p>
              </div>
            )}

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                With
              </span>
              <div className="relative">
                <input
                  value={rQuery}
                  onChange={(event) => {
                    setRQuery(event.target.value);
                    if (
                      event.target.value !==
                      `${toTicker}${toName ? ` — ${toName}` : ""}`
                    ) {
                      setToTicker("");
                      setToName("");
                    }
                  }}
                  placeholder="Search destination ticker…"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
                {searching ? (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">
                    …
                  </span>
                ) : null}
                {results.length > 0 ? (
                  <SearchDropdown results={results} onSelect={selectReplace} />
                ) : null}
              </div>
            </label>
          </div>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          {rows.map((row) => {
            const issue = coverageIssues.find((c) => c.ticker === row.ticker);
            return (
              <div key={row.ticker} className="flex items-center gap-3">
                <span className="w-24 shrink-0 font-medium text-zinc-900 dark:text-zinc-100">
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
                  onChange={(event) =>
                    updateWeight(row.ticker, event.target.value)
                  }
                  className="w-24 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-right text-sm tabular-nums text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  %
                </span>
                {issue ? (
                  <span className="text-xs text-red-600 dark:text-red-400">
                    only has data since{" "}
                    {histories?.[row.ticker]?.firstTradeDate}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() =>
                    setRows((current) =>
                      current.filter((r) => r.ticker !== row.ticker)
                    )
                  }
                  className="ml-auto rounded-md px-2 py-1 text-sm text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800"
                  aria-label={`Remove ${row.ticker}`}
                >
                  ✕
                </button>
              </div>
            );
          })}

          <div className="relative">
            <input
              value={dQuery}
              onChange={(event) => setDQuery(event.target.value)}
              placeholder="Add a ticker…"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            {searching ? (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">
                …
              </span>
            ) : null}
            {results.length > 0 ? (
              <SearchDropdown results={results} onSelect={addRow} />
            ) : null}
          </div>

          <div className="flex items-center justify-between border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                Total
              </span>
              <span
                className={`text-sm font-semibold tabular-nums ${
                  sumValid
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {sum.toFixed(1)}%
              </span>
              {rows.length > 1 ? (
                <button
                  type="button"
                  onClick={splitEvenly}
                  className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Split evenly
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {renderStatus()}

      {simulated && original ? (
        <>
          <ComparisonChart
            data={combined}
            originalLabel="Original"
            substitutedLabel={
              mode === "replace"
                ? replaceAllMode
                  ? `All in ${toTicker}`
                  : `${fromTicker} → ${toTicker}`
                : "Weighted mix"
            }
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Original final
              </p>
              <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {usd(original.finalValue)}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Simulated final
              </p>
              <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {usd(simulated.finalValue)}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Growth
              </p>
              <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {simulated.growthPct.toFixed(1)}%
              </p>
            </div>
          </div>
          <DividendNotice />
        </>
      ) : null}
    </section>
  );

  function renderStatus() {
    if (mode === "replace") {
      if (!toTicker) {
        return (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {replaceAllMode
              ? "Replacing everything in your portfolio."
              : fromTicker
                ? "Pick a destination ticker to compare."
                : "Pick a ticker from your portfolio to substitute."}
          </p>
        );
      }
      if (historiesLoading)
        return (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Loading destination history…
          </p>
        );
      if (!destHistory)
        return (
          <p className="text-sm text-red-600 dark:text-red-400">
            No price history available for {toTicker}.
          </p>
        );
      if (covered === false)
        return (
          <p className="text-sm text-red-600 dark:text-red-400">
            Cannot substitute: {toTicker} only has data since{" "}
            {destHistory.firstTradeDate}, but the earliest lot to replace is{" "}
            {earliestToCover}. Pick a ticker that existed before that date.
          </p>
        );
      return null;
    }

    if (rows.length === 0)
      return (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Add one or more tickers and set weights that sum to 100%.
        </p>
      );
    if (!sumValid)
      return (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Weights must sum to 100%. Current total: {sum.toFixed(1)}%.
        </p>
      );
    if (historiesLoading)
      return (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Loading histories…
        </p>
      );
    if (coverageIssues.length > 0)
      return (
        <p className="text-sm text-red-600 dark:text-red-400">
          Some tickers don&apos;t cover your earliest lot ({portfolioEarliest}).
          Remove them to compare.
        </p>
      );
    return null;
  }
}

function SearchDropdown({
  results,
  onSelect,
}: {
  results: Array<Candidate>;
  onSelect: (candidate: Candidate) => void;
}) {
  return (
    <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
      {results.map((candidate) => (
        <li key={candidate.symbol}>
          <button
            type="button"
            onClick={() => onSelect(candidate)}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {candidate.symbol}
            </span>
            <span className="truncate text-zinc-500 dark:text-zinc-400">
              {candidate.name}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
