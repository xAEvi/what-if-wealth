"use client";

import { useMemo, useState } from "react";
import {
  buildSeries,
  distribute,
  replaceAll,
  replaceAllWithDetails,
  replaceTickerWithDetails,
  substituteTicker,
  type Replacement,
} from "@/lib/portfolio/engine";
import { hasCoverage } from "@/lib/market/coverage";
import { usePortfolio } from "@/state/portfolio-context";
import { useHistories } from "@/hooks/useHistories";
import { useQuotes } from "@/hooks/useQuotes";
import ComparisonChart, {
  type ComparisonDatum,
} from "@/components/charts/ComparisonChart";
import DividendNotice from "@/components/common/DividendNotice";
import Button from "@/components/ui/Button";
import ReplacePanel from "./ReplacePanel";
import DistributePanel from "./DistributePanel";
import ReplacementDetail from "./ReplacementDetail";
import type { SearchCandidate } from "@/hooks/useSearch";
import type { WeightRow } from "./types";

type Mode = "replace" | "distribute";

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

  // Estado del modo distribucion.
  const [rows, setRows] = useState<Array<WeightRow>>([]);

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
  const { quotes } = useQuotes(allTickers);

  const destHistory = toTicker ? histories?.[toTicker] : undefined;
  const covered =
    destHistory && earliestToCover
      ? hasCoverage(destHistory, earliestToCover)
      : null;

  const replacements: Array<Replacement> = useMemo(() => {
    if (mode !== "replace" || !destHistory) return [];
    const pairs = replaceAllMode
      ? replaceAllWithDetails(lots, destHistory)
      : replaceTickerWithDetails(lots, fromTicker, destHistory);
    // Mismo orden que la tabla de compras: mas reciente primero.
    return pairs.sort((a, b) => b.original.date.localeCompare(a.original.date));
  }, [mode, destHistory, replaceAllMode, fromTicker, lots]);

  const sum = rows.reduce((total, row) => total + row.weight, 0);
  const sumValid = Math.abs(sum - 100) < 1e-6;

  // Tickares con historia insuficiente para cubrir el lote mas viejo.
  const coverageIssues = useMemo(() => {
    const issues: Array<{ ticker: string; firstTradeDate?: string }> = [];
    for (const row of rows) {
      const history = histories?.[row.ticker];
      if (history && !hasCoverage(history, portfolioEarliest))
        issues.push({ ticker: row.ticker, firstTradeDate: history.firstTradeDate });
    }
    return issues;
  }, [rows, histories, portfolioEarliest]);

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
    return buildSeries(distribute(lots, weights, histories), histories, "Simulated");
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

  const onDestinationSelected = (candidate: SearchCandidate) => {
    setToTicker(candidate.symbol);
    setToName(candidate.name ?? "");
  };
  const onDestinationTyped = () => {
    setToTicker("");
    setToName("");
  };

  const addRow = (candidate: SearchCandidate) => {
    if (rows.some((row) => row.ticker === candidate.symbol)) return;
    setRows((current) => [
      ...current,
      { ticker: candidate.symbol, weight: current.length === 0 ? 100 : 0 },
    ]);
  };
  const removeRow = (ticker: string) =>
    setRows((current) => current.filter((row) => row.ticker !== ticker));
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
    setReplaceAllMode(false);
    setRows([]);
  };

  const hasActive = mode === "replace" ? Boolean(toTicker) : rows.length > 0;

  if (portfolioTickers.length === 0) return null;

  return (
    <section className="space-y-4" aria-label="What-if simulation">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-fg">What if…</h2>
        {hasActive ? (
          <Button variant="ghost" onClick={reset}>
            Reset
          </Button>
        ) : null}
      </div>

      <div className="flex gap-2">
        <Button
          variant={mode === "replace" ? "primary" : "ghost"}
          onClick={() => setMode("replace")}
        >
          Replace a ticker
        </Button>
        <Button
          variant={mode === "distribute" ? "primary" : "ghost"}
          onClick={() => setMode("distribute")}
        >
          Distribute by weights
        </Button>
      </div>

      {mode === "replace" ? (
        <ReplacePanel
          portfolioTickers={portfolioTickers}
          replaceAllMode={replaceAllMode}
          fromTicker={fromTicker}
          toTicker={toTicker}
          toName={toName}
          onReplaceAllChange={(value) => {
            setReplaceAllMode(value);
            setFromTicker("");
            setToTicker("");
            setToName("");
          }}
          onFromTickerChange={(value) => {
            setFromTicker(value);
            setToTicker("");
            setToName("");
          }}
          onDestinationSelected={onDestinationSelected}
          onDestinationTyped={onDestinationTyped}
        />
      ) : (
        <DistributePanel
          rows={rows}
          coverageIssues={coverageIssues}
          sum={sum}
          sumValid={sumValid}
          onAdd={addRow}
          onRemove={removeRow}
          onWeightChange={updateWeight}
          onSplitEvenly={splitEvenly}
        />
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
            <div className="rounded-card border border-border bg-surface p-4">
              <p className="text-xs uppercase tracking-wide text-fg-subtle">
                Original final
              </p>
              <p className="mt-1 text-xl font-semibold text-fg">
                {usd(original.finalValue)}
              </p>
            </div>
            <div className="rounded-card border border-border bg-surface p-4">
              <p className="text-xs uppercase tracking-wide text-fg-subtle">
                Simulated final
              </p>
              <p className="mt-1 text-xl font-semibold text-fg">
                {usd(simulated.finalValue)}
              </p>
            </div>
            <div className="rounded-card border border-border bg-surface p-4">
              <p className="text-xs uppercase tracking-wide text-fg-subtle">
                Growth
              </p>
              <p className="mt-1 text-xl font-semibold text-fg">
                {simulated.growthPct.toFixed(1)}%
              </p>
            </div>
          </div>

          {mode === "replace" && replacements.length > 0 ? (
            <ReplacementDetail
              replacements={replacements}
              histories={histories}
              quotes={quotes}
            />
          ) : null}

          <DividendNotice />
        </>
      ) : null}
    </section>
  );

  function renderStatus() {
    if (mode === "replace") {
      if (!toTicker) {
        return (
          <p className="text-sm text-fg-subtle">
            {replaceAllMode
              ? "Replacing everything in your portfolio."
              : fromTicker
                ? "Pick a destination ticker to compare."
                : "Pick a ticker from your portfolio to substitute."}
          </p>
        );
      }
      if (historiesLoading)
        return <p className="text-sm text-fg-subtle">Loading destination history…</p>;
      if (!destHistory)
        return (
          <p className="text-sm text-danger">
            No price history available for {toTicker}.
          </p>
        );
      if (covered === false)
        return (
          <p className="text-sm text-danger">
            Cannot substitute: {toTicker} only has data since{" "}
            {destHistory.firstTradeDate}, but the earliest lot to replace is{" "}
            {earliestToCover}. Pick a ticker that existed before that date.
          </p>
        );
      return null;
    }

    if (rows.length === 0)
      return (
        <p className="text-sm text-fg-subtle">
          Add one or more tickers and set weights that sum to 100%.
        </p>
      );
    if (!sumValid)
      return (
        <p className="text-sm text-warning">
          Weights must sum to 100%. Current total: {sum.toFixed(1)}%.
        </p>
      );
    if (historiesLoading)
      return <p className="text-sm text-fg-subtle">Loading histories…</p>;
    if (coverageIssues.length > 0)
      return (
        <p className="text-sm text-danger">
          Some tickers don&apos;t cover your earliest lot ({portfolioEarliest}).
          Remove them to compare.
        </p>
      );
    return null;
  }
}
