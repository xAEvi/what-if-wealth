"use client";

import type { Position } from "@/lib/portfolio/engine";
import type { PortfolioSeries } from "@/lib/portfolio/types";
import PortfolioCharts from "@/components/charts/PortfolioCharts";
import DividendNotice from "@/components/common/DividendNotice";

const usd = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

type DashboardProps = {
  series: PortfolioSeries | null;
  positions: Array<Position>;
  loading: boolean;
  error: string | null;
  reload: () => void;
  excludeZeroCost: boolean;
  onExcludeZeroCostChange: (value: boolean) => void;
};

/** Tablero del portafolio: toggle de costo cero, graficas y desglose. */
export default function Dashboard({
  series,
  positions,
  loading,
  error,
  reload,
  excludeZeroCost,
  onExcludeZeroCostChange,
}: DashboardProps) {
  if (loading)
    return <p className="text-sm text-fg-subtle">Loading market data…</p>;

  if (error)
    return (
      <div className="flex items-center justify-between gap-3 rounded-card border border-danger/40 bg-danger/5 p-4 text-sm text-danger">
        <span>{error}</span>
        <button
          type="button"
          onClick={reload}
          className="shrink-0 rounded-sm-card border border-danger/50 px-3 py-1 font-medium transition-colors hover:bg-danger/10"
        >
          Retry
        </button>
      </div>
    );

  if (!series) return null;

  return (
    <section className="space-y-6" aria-label="Portfolio dashboard">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-fg">Dashboard</h2>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-fg-muted">
          <input
            type="checkbox"
            checked={excludeZeroCost}
            onChange={(event) => onExcludeZeroCostChange(event.target.checked)}
            className="h-4 w-4 accent-warning"
          />
          Exclude zero-cost lots
        </label>
      </div>

      <PortfolioCharts points={series.points} />

      {positions.length > 0 && (
        <div className="overflow-x-auto rounded-card border border-border">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-border bg-surface-2 text-xs uppercase tracking-wide text-fg-subtle">
              <tr>
                <th className="px-4 py-3 font-medium">Position</th>
                <th className="px-4 py-3 text-right font-medium">Value</th>
                <th className="px-4 py-3 text-right font-medium">Invested</th>
                <th className="px-4 py-3 text-right font-medium">Gain</th>
                <th className="px-4 py-3 text-right font-medium">Growth</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {positions.map((position) => {
                const gain = position.value - position.invested;
                return (
                  <tr key={position.ticker}>
                    <td className="px-4 py-2.5 font-medium text-fg">
                      {position.ticker}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-fg-muted">
                      {usd(position.value)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-fg-muted">
                      {usd(position.invested)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-fg-muted">
                      {gain >= 0 ? "+" : "-"}
                      {usd(Math.abs(gain))}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-fg-muted">
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
    </section>
  );
}
