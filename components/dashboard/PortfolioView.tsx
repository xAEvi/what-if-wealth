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
import SummaryStrip from "@/components/summary/SummaryStrip";
import Dashboard from "@/components/dashboard/Dashboard";
import LotTable from "@/components/csv/LotTable";
import {
  ChartSkeleton,
  SummaryStripSkeleton,
  TableSkeleton,
} from "@/components/ui/Skeletons";

/**
 * Vista del portafolio: calcula la serie una sola vez y compone la barra de
 * resumen (sticky), el tablero y la tabla de lotes, de modo que el resumen
 * siga visible mientras se scrollea la tabla.
 */
export default function PortfolioView() {
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
  // Filtro cruzado: al hacer click en una posicion se filtra la tabla de lotes.
  const [linkedTicker, setLinkedTicker] = useState<string | null>(null);

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
      histories && quotes
        ? valueWithQuotes(activeLots, histories, quotes)
        : 0,
    [activeLots, histories, quotes]
  );

  if (lots.length === 0) return null;

  const invested = series?.totalInvested ?? 0;
  const growthPct = invested
    ? ((currentValue - invested) / invested) * 100
    : 0;

  // Mientras cargan los historicos se muestran skeletons en vez de texto plano.
  if (loading)
    return (
      <>
        <SummaryStripSkeleton />
        <div className="space-y-6">
          <ChartSkeleton />
          <TableSkeleton />
        </div>
      </>
    );

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

  return (
    <>
      <SummaryStrip
        invested={invested}
        currentValue={currentValue}
        gain={currentValue - invested}
        growthPct={growthPct}
      />
      <Dashboard
        series={series}
        positions={positions}
        loading={loading}
        error={error}
        reload={reload}
        excludeZeroCost={excludeZeroCost}
        onExcludeZeroCostChange={setExcludeZeroCost}
        selectedTicker={linkedTicker}
        onSelectTicker={(ticker) =>
          setLinkedTicker((current) => (current === ticker ? null : ticker))
        }
      />
      <LotTable
        linkedTicker={linkedTicker}
        onLinkedTickerChange={setLinkedTicker}
      />
    </>
  );
}
