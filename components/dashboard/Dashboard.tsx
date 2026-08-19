"use client";

import { useMemo, useState } from "react";
import {
  buildSeries,
  positionBreakdown,
  valueWithQuotes,
} from "@/lib/portfolio/engine";
import { usePortfolio } from "@/state/portfolio-context";
import { useHistories } from "@/hooks/useHistories";
import { useQuotes } from "@/hooks/useQuotes";
import SummaryCards from "@/components/summary/SummaryCards";
import ValueChart from "@/components/charts/ValueChart";
import GrowthChart from "@/components/charts/GrowthChart";
import DividendNotice from "@/components/common/DividendNotice";

const usd = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

export default function Dashboard() {
  const { state } = usePortfolio();
  const { lots } = state;

  const tickers = useMemo(
    () => [...new Set(lots.map((lot) => lot.ticker))].sort(),
    [lots]
  );
  const earliestDate = useMemo(
    () =>
      lots.reduce(
        (min, lot) => (lot.date < min ? lot.date : min),
        lots[0]?.date ?? ""
      ),
    [lots]
  );

  const { histories, loading, error, reload } = useHistories(
    tickers,
    earliestDate
  );
  const { quotes } = useQuotes(tickers);
  const [excludeZeroCost, setExcludeZeroCost] = useState(false);

  const activeLots = useMemo(
    () => (excludeZeroCost ? lots.filter((lot) => lot.price > 0) : lots),
    [lots, excludeZeroCost]
  );

  const series = useMemo(
    () => (histories ? buildSeries(activeLots, histories, "Portfolio") : null),
    [activeLots, histories]
  );

  const positions = useMemo(
    () => (histories ? positionBreakdown(activeLots, histories) : []),
    [activeLots, histories]
  );

  const currentValue = useMemo(
    () =>
      histories && quotes ? valueWithQuotes(activeLots, histories, quotes) : 0,
    [activeLots, histories, quotes]
  );

  if (lots.length === 0) return null;

  const growthPct = series?.totalInvested
    ? ((currentValue - series.totalInvested) / series.totalInvested) * 100
    : 0;

  return (
    <section className="space-y-6" aria-label="Portfolio dashboard">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Dashboard
        </h2>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={excludeZeroCost}
            onChange={(event) => setExcludeZeroCost(event.target.checked)}
            className="h-4 w-4 accent-amber-600"
          />
          Exclude zero-cost lots
        </label>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Loading market data…
        </p>
      ) : error ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50/60 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          <span>{error}</span>
          <button
            type="button"
            onClick={reload}
            className="shrink-0 rounded-md border border-red-300 px-3 py-1 font-medium transition-colors hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-900"
          >
            Retry
          </button>
        </div>
      ) : series ? (
        <>
          <SummaryCards
            invested={series.totalInvested}
            currentValue={currentValue}
            gain={currentValue - series.totalInvested}
            growthPct={growthPct}
          />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                Total value
              </h3>
              <ValueChart points={series.points} />
            </div>
            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                Growth
              </h3>
              <GrowthChart points={series.points} />
            </div>
          </div>

          {positions.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Position</th>
                    <th className="px-4 py-3 text-right font-medium">Value</th>
                    <th className="px-4 py-3 text-right font-medium">
                      Invested
                    </th>
                    <th className="px-4 py-3 text-right font-medium">Gain</th>
                    <th className="px-4 py-3 text-right font-medium">Growth</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {positions.map((position) => {
                    const gain = position.value - position.invested;
                    return (
                      <tr key={position.ticker}>
                        <td className="px-4 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">
                          {position.ticker}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                          {usd(position.value)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                          {usd(position.invested)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                          {gain >= 0 ? "+" : "-"}
                          {usd(Math.abs(gain))}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                          {position.growthPct.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <DividendNotice />
        </>
      ) : null}
    </section>
  );
}
