"use client";

import type { Position } from "@/lib/portfolio/engine";
import type { PortfolioSeries } from "@/lib/portfolio/types";
import PortfolioCharts from "@/components/charts/PortfolioCharts";
import PositionsTable from "@/components/dashboard/PositionsTable";
import DividendNotice from "@/components/common/DividendNotice";

type DashboardProps = {
  series: PortfolioSeries | null;
  positions: Array<Position>;
  loading: boolean;
  error: string | null;
  reload: () => void;
  excludeZeroCost: boolean;
  onExcludeZeroCostChange: (value: boolean) => void;
  selectedTicker: string | null;
  onSelectTicker: (ticker: string) => void;
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
  selectedTicker,
  onSelectTicker,
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
        <PositionsTable
          positions={positions}
          totalValue={positions.reduce((sum, position) => sum + position.value, 0)}
          selectedTicker={selectedTicker}
          onSelectTicker={onSelectTicker}
        />
      )}

      <DividendNotice />
    </section>
  );
}
