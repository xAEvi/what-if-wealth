"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  buildSeries,
  distribute,
  generateDcaLots,
  replaceAll,
  replaceAllWithDetails,
  replaceTickerWithDetails,
  substituteTicker,
  type DcaFrequency,
  type Replacement,
} from "@/lib/portfolio/engine";
import { hasCoverage } from "@/lib/market/coverage";
import { usePortfolio } from "@/state/portfolio-context";
import { useToast } from "@/state/toast-context";
import { useHistories } from "@/hooks/useHistories";
import { useQuotes } from "@/hooks/useQuotes";
import dynamic from "next/dynamic";
import type { ComparisonDatum } from "@/components/charts/ComparisonChart";
import DividendNotice from "@/components/common/DividendNotice";
import Button from "@/components/ui/Button";
import ReplacePanel from "./ReplacePanel";
import DistributePanel from "./DistributePanel";
import ReplacementDetail from "./ReplacementDetail";
import DcaPanel from "./DcaPanel";
import type { SearchCandidate } from "@/hooks/useSearch";
import type { WeightRow } from "./types";

// recharts se carga bajo demanda para no bloquear el primer pintado.
const ComparisonChart = dynamic(
  () => import("@/components/charts/ComparisonChart"),
  { ssr: false }
);
const PortfolioCharts = dynamic(
  () => import("@/components/charts/PortfolioCharts"),
  { ssr: false }
);

type Mode = "replace" | "distribute" | "dca";

const usd = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

export default function WhatIfSimulation() {
  const { state } = usePortfolio();
  const { lots } = state;
  const { toast } = useToast();

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
  // Version diferida: el recalculo de la simulacion no compite con cada tecla.
  const deferredRows = useDeferredValue(rows);

  // Estado del modo "Invest from Zero" (aportes periodicos).
  const [dcaRows, setDcaRows] = useState<Array<WeightRow>>([]);
  const [dcaAmount, setDcaAmount] = useState(0);
  const [dcaFrequency, setDcaFrequency] = useState<DcaFrequency>("monthly");
  const [dcaStart, setDcaStart] = useState("");
  const deferredDcaRows = useDeferredValue(dcaRows);

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
        : mode === "distribute"
          ? rows.map((row) => row.ticker)
          : dcaRows.map((row) => row.ticker);
    return [...new Set([...portfolioTickers, ...extra])];
  }, [mode, portfolioTickers, toTicker, rows, dcaRows]);

  const { histories, loading: historiesLoading } = useHistories(
    allTickers,
    portfolioEarliest
  );
  const { quotes } = useQuotes(allTickers);

  // Historias para el modo DCA: deben arrancar en la fecha de inicio del
  // aporte, no en la del portafolio real, o la serie no alcanza fechas viejas.
  const dcaTickers = dcaStart ? dcaRows.map((row) => row.ticker) : [];
  const {
    histories: dcaHistories,
    loading: dcaHistoriesLoading,
  } = useHistories(dcaTickers, dcaStart);

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

  // Validacion del modo DCA: los tickers deben cubrir la fecha de inicio.
  const dcaSum = dcaRows.reduce((total, row) => total + row.weight, 0);
  const dcaSumValid = Math.abs(dcaSum - 100) < 1e-6;
  const dcaStartInFuture =
    dcaStart !== "" && dcaStart > new Date().toISOString().slice(0, 10);
  const dcaCoverageIssues = useMemo(() => {
    const issues: Array<{ ticker: string; firstTradeDate?: string }> = [];
    if (!dcaStart) return issues;
    for (const row of dcaRows) {
      const history = dcaHistories?.[row.ticker];
      if (history && !hasCoverage(history, dcaStart))
        issues.push({ ticker: row.ticker, firstTradeDate: history.firstTradeDate });
    }
    return issues;
  }, [dcaRows, dcaStart, dcaHistories]);

  const dcaLots = useMemo(() => {
    if (mode !== "dca" || !dcaHistories) return null;
    if (
      !dcaStart ||
      dcaStartInFuture ||
      !dcaSumValid ||
      dcaRows.length === 0 ||
      dcaCoverageIssues.length > 0 ||
      dcaAmount <= 0
    )
      return null;
    return generateDcaLots(
      deferredDcaRows,
      dcaAmount,
      dcaFrequency,
      dcaStart,
      dcaHistories
    );
  }, [
    mode,
    dcaHistories,
    dcaStart,
    dcaStartInFuture,
    dcaSumValid,
    dcaRows.length,
    dcaCoverageIssues,
    dcaAmount,
    deferredDcaRows,
    dcaFrequency,
  ]);

  const dcaSeries = useMemo(
    () =>
      dcaLots && dcaHistories
        ? buildSeries(dcaLots, dcaHistories, "DCA")
        : null,
    [dcaLots, dcaHistories]
  );

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
    const weights = deferredRows.map((row) => ({
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
    deferredRows,
    sumValid,
    coverageIssues,
    lots,
    rows.length,
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

  // Avisa una sola vez al pasar a pesos invalidos, no en cada tecla.
  const prevInvalid = useRef(false);
  useEffect(() => {
    const invalid = mode === "distribute" && rows.length > 0 && !sumValid;
    if (invalid && !prevInvalid.current)
      toast({
        id: "weights-invalid",
        message: "Weights must sum to 100%.",
        tone: "warning",
      });
    prevInvalid.current = invalid;
  }, [mode, rows.length, sumValid, toast]);

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
    setDcaRows([]);
    setDcaAmount(0);
    setDcaFrequency("monthly");
    setDcaStart("");
  };

  const hasActive =
    mode === "replace"
      ? Boolean(toTicker)
      : mode === "distribute"
        ? rows.length > 0
        : dcaRows.length > 0;

  // Handlers del modo DCA (aportes periodicos).
  const addDcaRow = (candidate: SearchCandidate) => {
    if (dcaRows.some((row) => row.ticker === candidate.symbol)) return;
    setDcaRows((current) => [
      ...current,
      { ticker: candidate.symbol, weight: current.length === 0 ? 100 : 0 },
    ]);
  };
  const removeDcaRow = (ticker: string) =>
    setDcaRows((current) => current.filter((row) => row.ticker !== ticker));
  const updateDcaWeight = (ticker: string, raw: string) => {
    const value = Number(raw);
    const weight = Number.isFinite(value)
      ? Math.max(0, Math.min(100, value))
      : 0;
    setDcaRows((current) =>
      current.map((row) => (row.ticker === ticker ? { ...row, weight } : row))
    );
  };
  const splitDcaEvenly = () => {
    if (dcaRows.length === 0) return;
    const share = 100 / dcaRows.length;
    setDcaRows((current) => current.map((row) => ({ ...row, weight: share })));
  };

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
        <Button
          variant={mode === "dca" ? "primary" : "ghost"}
          onClick={() => setMode("dca")}
        >
          Invest from zero
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
      ) : mode === "distribute" ? (
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
      ) : (
        <DcaPanel
          rows={dcaRows}
          sum={dcaSum}
          sumValid={dcaSumValid}
          coverageIssues={dcaCoverageIssues}
          amount={dcaAmount}
          frequency={dcaFrequency}
          startDate={dcaStart}
          onAdd={addDcaRow}
          onRemove={removeDcaRow}
          onWeightChange={updateDcaWeight}
          onSplitEvenly={splitDcaEvenly}
          onAmountChange={setDcaAmount}
          onFrequencyChange={setDcaFrequency}
          onStartChange={setDcaStart}
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

      {mode === "dca" && dcaSeries ? (
        <>
          <PortfolioCharts points={dcaSeries.points} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-card border border-border bg-surface p-4">
              <p className="text-xs uppercase tracking-wide text-fg-subtle">
                Invested
              </p>
              <p className="mt-1 text-xl font-semibold text-fg">
                {usd(dcaSeries.totalInvested)}
              </p>
            </div>
            <div className="rounded-card border border-border bg-surface p-4">
              <p className="text-xs uppercase tracking-wide text-fg-subtle">
                Value now
              </p>
              <p className="mt-1 text-xl font-semibold text-fg">
                {usd(dcaSeries.finalValue)}
              </p>
            </div>
            <div className="rounded-card border border-border bg-surface p-4">
              <p className="text-xs uppercase tracking-wide text-fg-subtle">
                Growth
              </p>
              <p className="mt-1 text-xl font-semibold text-fg">
                {dcaSeries.growthPct.toFixed(1)}%
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

    if (mode === "dca") {
      if (dcaRows.length === 0)
        return (
          <p className="text-sm text-fg-subtle">
            Add the tickers you invest in and set the amount per period.
          </p>
        );
      if (dcaAmount <= 0)
        return (
          <p className="text-sm text-fg-subtle">
            Enter an amount to invest per period.
          </p>
        );
      if (!dcaStart)
        return (
          <p className="text-sm text-fg-subtle">
            Pick a start date in the past to begin the contributions.
          </p>
        );
      if (dcaStartInFuture)
        return (
          <p className="text-sm text-danger">
            The start date can&apos;t be in the future.
          </p>
        );
      if (!dcaSumValid)
        return (
          <p className="text-sm text-warning">
            Weights must sum to 100%. Current total: {dcaSum.toFixed(1)}%.
          </p>
        );
      if (dcaHistoriesLoading)
        return <p className="text-sm text-fg-subtle">Loading histories…</p>;
      if (dcaCoverageIssues.length > 0)
        return (
          <p className="text-sm text-danger">
            Some tickers don&apos;t cover your start date ({dcaStart}). Pick an
            earlier date or different tickers.
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
