"use client";

import { useEffect, useMemo, useState } from "react";
import { buildSeries, distribute } from "@/lib/portfolio/engine";
import { hasCoverage } from "@/lib/market/coverage";
import { usePortfolio } from "@/state/portfolio-context";
import { useHistories } from "@/hooks/useHistories";
import ComparisonChart, {
  type ComparisonDatum,
} from "@/components/charts/ComparisonChart";
import DividendNotice from "@/components/common/DividendNotice";

type Candidate = {
  symbol: string;
  name?: string;
  quoteType?: string;
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

export default function WeightDistribution() {
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

  const [rows, setRows] = useState<Array<WeightRow>>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<Candidate>>([]);
  const [searching, setSearching] = useState(false);

  const allTickers = useMemo(
    () =>
      [...new Set([...portfolioTickers, ...rows.map((row) => row.ticker)])],
    [portfolioTickers, rows]
  );
  const { histories, loading: historiesLoading } = useHistories(
    allTickers,
    portfolioEarliest
  );

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

  // Autocompletado para agregar tickers al reparto.
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

  const distributed = useMemo(() => {
    if (!histories || !sumValid || rows.length === 0) return null;
    if (coverageIssues.length > 0) return null;

    const weights = rows.map((row) => ({ ticker: row.ticker, weight: row.weight }));
    const distributedLots = distribute(lots, weights, histories);
    return buildSeries(distributedLots, histories, "Distributed");
  }, [histories, sumValid, rows, coverageIssues, lots]);

  const combined: Array<ComparisonDatum> = useMemo(() => {
    if (!original || !distributed) return [];
    const byDate = new Map<string, ComparisonDatum>();
    for (const point of original.points)
      byDate.set(point.date, { date: point.date, original: point.value });
    for (const point of distributed.points) {
      const entry = byDate.get(point.date) ?? { date: point.date };
      entry.substituted = point.value;
      byDate.set(point.date, entry);
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [original, distributed]);

  const addCandidate = (candidate: Candidate) => {
    if (rows.some((row) => row.ticker === candidate.symbol)) return;
    // El primer ticker arranca con el 100%; al agregar mas se ajusta con "Split evenly".
    const weight = rows.length === 0 ? 100 : 0;
    setRows((current) => [...current, { ticker: candidate.symbol, weight }]);
    setQuery("");
    setResults([]);
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

  const removeRow = (ticker: string) => {
    setRows((current) => current.filter((row) => row.ticker !== ticker));
  };

  const splitEvenly = () => {
    if (rows.length === 0) return;
    const share = 100 / rows.length;
    setRows((current) => current.map((row) => ({ ...row, weight: share })));
  };

  if (portfolioTickers.length === 0) return null;

  return (
    <section className="space-y-4" aria-label="Weight distribution simulation">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          What if… distribute by weights
        </h2>
        {rows.length > 1 ? (
          <button
            type="button"
            onClick={splitEvenly}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Split evenly
          </button>
        ) : null}
      </div>

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
                value={Number.isInteger(row.weight) ? row.weight : row.weight.toFixed(2)}
                onChange={(event) => updateWeight(row.ticker, event.target.value)}
                className="w-24 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-right text-sm tabular-nums text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
              <span className="text-sm text-zinc-500 dark:text-zinc-400">%</span>
              {issue ? (
                <span className="text-xs text-red-600 dark:text-red-400">
                  only has data since {histories?.[row.ticker]?.firstTradeDate}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => removeRow(row.ticker)}
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
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Add a ticker…"
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
                    onClick={() => addCandidate(candidate)}
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

        <div className="flex items-center justify-between border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <span className="text-sm text-zinc-500 dark:text-zinc-400">Total</span>
          <span
            className={`text-sm font-semibold tabular-nums ${
              sumValid ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
            }`}
          >
            {sum.toFixed(1)}%
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Add one or more tickers and set weights that sum to 100%.
        </p>
      ) : !sumValid ? (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Weights must sum to 100%. Current total: {sum.toFixed(1)}%.
        </p>
      ) : historiesLoading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Loading histories…
        </p>
      ) : coverageIssues.length > 0 ? (
        <p className="text-sm text-red-600 dark:text-red-400">
          Some tickers don&apos;t cover your earliest lot ({portfolioEarliest}). Remove them to
          compare.
        </p>
      ) : distributed && original ? (
        <>
          <ComparisonChart
            data={combined}
            originalLabel="Original"
            substitutedLabel="Weighted mix"
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
                Mix final
              </p>
              <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {usd(distributed.finalValue)}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Invested (matches)
              </p>
              <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {usd(distributed.totalInvested)}
              </p>
            </div>
          </div>
          <DividendNotice />
        </>
      ) : null}
    </section>
  );
}