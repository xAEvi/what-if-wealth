"use client";

import { useEffect, useMemo, useState } from "react";
import { buildSeries, replaceAll, substituteTicker } from "@/lib/portfolio/engine";
import { hasCoverage } from "@/lib/market/coverage";
import { usePortfolio } from "@/state/portfolio-context";
import { useHistories } from "@/hooks/useHistories";
import ComparisonChart, {
  type ComparisonDatum,
} from "@/components/charts/ComparisonChart";

type Candidate = {
  symbol: string;
  name?: string;
  quoteType?: string;
};

const usd = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

export default function TickerSubstitution() {
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

  const [replaceAllMode, setReplaceAllMode] = useState(false);
  const [fromTicker, setFromTicker] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<Candidate>>([]);
  const [searching, setSearching] = useState(false);
  const [toTicker, setToTicker] = useState("");
  const [toName, setToName] = useState("");

  const sourceEarliest = useMemo(
    () =>
      lots
        .filter((lot) => lot.ticker === fromTicker)
        .reduce((min, lot) => (lot.date < min ? lot.date : min), ""),
    [lots, fromTicker]
  );

  const earliestToCover = replaceAllMode ? portfolioEarliest : sourceEarliest;

  const allTickers = useMemo(
    () => (toTicker ? [...portfolioTickers, toTicker] : portfolioTickers),
    [portfolioTickers, toTicker]
  );
  const { histories, loading: historiesLoading } = useHistories(
    allTickers,
    portfolioEarliest
  );

  const destHistory = toTicker ? histories?.[toTicker] : undefined;
  const covered =
    destHistory && earliestToCover
      ? hasCoverage(destHistory, earliestToCover)
      : null;

  // Autocompletado con debounce para no golpear la API en cada tecla.
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setSearching(true);
      fetch(`/api/search?q=${encodeURIComponent(query.trim())}`)
        .then((response) => response.json())
        .then((data) => setResults(data.results ?? []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const original = useMemo(
    () => (histories ? buildSeries(lots, histories, "Original") : null),
    [lots, histories]
  );

  const substituted = useMemo(() => {
    if (!histories || !destHistory || covered !== true) return null;
    const synthetic = replaceAllMode
      ? replaceAll(lots, destHistory)
      : substituteTicker(lots, fromTicker, destHistory);
    return buildSeries(synthetic, histories, "Substituted");
  }, [histories, destHistory, covered, replaceAllMode, fromTicker, lots]);

  const combined: Array<ComparisonDatum> = useMemo(() => {
    if (!original || !substituted) return [];
    const byDate = new Map<string, ComparisonDatum>();
    for (const point of original.points)
      byDate.set(point.date, { date: point.date, original: point.value });
    for (const point of substituted.points) {
      const entry = byDate.get(point.date) ?? { date: point.date };
      entry.substituted = point.value;
      byDate.set(point.date, entry);
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [original, substituted]);

  const selectCandidate = (candidate: Candidate) => {
    setToTicker(candidate.symbol);
    setToName(candidate.name ?? "");
    setQuery(
      `${candidate.symbol}${candidate.name ? ` — ${candidate.name}` : ""}`
    );
    setResults([]);
  };

  const reset = () => {
    setFromTicker("");
    setQuery("");
    setToTicker("");
    setToName("");
    setResults([]);
  };

  if (portfolioTickers.length === 0) return null;

  return (
    <section className="space-y-4" aria-label="Ticker substitution simulation">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          What if… replace a ticker
        </h2>
        {toTicker ? (
          <button
            type="button"
            onClick={reset}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Reset
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={replaceAllMode}
            onChange={(event) => {
              setReplaceAllMode(event.target.checked);
              setFromTicker("");
              setToTicker("");
              setQuery("");
              setResults([]);
            }}
            className="h-4 w-4 accent-blue-600"
          />
          Replace all tickers
        </label>
      </div>

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
                setQuery("");
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
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
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
              <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                {results.map((candidate) => (
                  <li key={candidate.symbol}>
                    <button
                      type="button"
                      onClick={() => selectCandidate(candidate)}
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
            ) : null}
          </div>
        </label>
      </div>

      {!earliestToCover || !toTicker ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {toTicker
            ? replaceAllMode
              ? "Replacing everything in your portfolio."
              : "Pick a source ticker to substitute."
            : "Pick a destination ticker to compare."}
        </p>
      ) : historiesLoading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Loading destination history…
        </p>
      ) : !destHistory ? (
        <div className="rounded-xl border border-red-200 bg-red-50/60 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          No price history available for {toTicker}.
        </div>
      ) : covered === false ? (
        <div className="rounded-xl border border-red-200 bg-red-50/60 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          Cannot substitute: {toTicker} only has data since{" "}
          {destHistory.firstTradeDate}, but the earliest lot to replace is{" "}
          {earliestToCover}. Pick a ticker that existed before that date.
        </div>
      ) : substituted && original ? (
        <>
          <ComparisonChart
            data={combined}
            originalLabel="Original"
            substitutedLabel={
              replaceAllMode
                ? `All in ${toTicker}`
                : `${fromTicker} → ${toTicker}`
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
                {toTicker} final
              </p>
              <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {usd(substituted.finalValue)}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Growth
              </p>
              <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {substituted.growthPct.toFixed(1)}%
              </p>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}