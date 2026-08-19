"use client";

import { useMemo, useState } from "react";
import { lotValueWithQuote } from "@/lib/portfolio/engine";
import type { Lot } from "@/lib/portfolio/types";
import { usePortfolio } from "@/state/portfolio-context";
import { useHistories } from "@/hooks/useHistories";
import { useQuotes } from "@/hooks/useQuotes";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";

const PAGE_SIZE = 25;

const quantityFormat = new Intl.NumberFormat("en-US", {
  maximumSignificantDigits: 6,
});
const priceFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const usd = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
const signed = (value: number) =>
  `${value >= 0 ? "+" : "-"}${usd(Math.abs(value))}`;

type SortKey =
  | "date"
  | "ticker"
  | "quantity"
  | "price"
  | "valueNow"
  | "costTotal"
  | "gain";

type EnrichedLot = {
  lot: Lot;
  costTotal: number;
  valueNow: number | null;
  gain: number | null;
};

type LotTableProps = {
  linkedTicker?: string | null;
  onLinkedTickerChange?: (ticker: string | null) => void;
};

export default function LotTable({
  linkedTicker = null,
  onLinkedTickerChange,
}: LotTableProps) {
  const { state, dispatch } = usePortfolio();
  const { lots, errors, fileName, importedAt } = state;
  const [collapsed, setCollapsed] = useState(false);

  const [search, setSearch] = useState("");
  const [zeroOnly, setZeroOnly] = useState(false);
  const [activeTickers, setActiveTickers] = useState<Array<string>>([]);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);

  const tickers = useMemo(
    () => [...new Set(lots.map((lot) => lot.ticker))].sort(),
    [lots]
  );
  const earliest = useMemo(
    () =>
      lots.reduce(
        (min, lot) => (lot.date < min ? lot.date : min),
        lots[0]?.date ?? ""
      ),
    [lots]
  );
  const { histories } = useHistories(tickers, earliest);
  const { quotes } = useQuotes(tickers);
  const loading = !histories || !quotes;

  // Valor de mercado actual de cada lote, valuando la cantidad ajustada.
  const valueByLot = useMemo(() => {
    const map = new Map<Lot, number>();
    if (!histories || !quotes) return map;
    for (const lot of lots) {
      const history = histories[lot.ticker];
      const quote = quotes[lot.ticker];
      if (history && quote != null)
        map.set(lot, lotValueWithQuote(lot, history, quote));
    }
    return map;
  }, [lots, histories, quotes]);

  const enriched = useMemo<Array<EnrichedLot>>(
    () =>
      lots.map((lot) => {
        const costTotal = lot.quantity * lot.price;
        const valueNow = valueByLot.has(lot) ? valueByLot.get(lot)! : null;
        return {
          lot,
          costTotal,
          valueNow,
          gain: valueNow != null ? valueNow - costTotal : null,
        };
      }),
    [lots, valueByLot]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return enriched.filter(({ lot }) => {
      if (activeTickers.length > 0 && !activeTickers.includes(lot.ticker))
        return false;
      if (zeroOnly && lot.price !== 0) return false;
      if (linkedTicker && lot.ticker !== linkedTicker) return false;
      if (query) {
        const haystack = `${lot.date} ${lot.comment ?? ""}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [enriched, activeTickers, zeroOnly, linkedTicker, search]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const get = (row: EnrichedLot): number | string | null => {
      switch (sortKey) {
        case "date":
          return row.lot.date;
        case "ticker":
          return row.lot.ticker;
        case "quantity":
          return row.lot.quantity;
        case "price":
          return row.lot.price;
        case "costTotal":
          return row.costTotal;
        case "valueNow":
          return row.valueNow;
        case "gain":
          return row.gain;
      }
    };
    // Los valores nulos (sin cotizacion aun) van siempre al final.
    return [...filtered].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string" && typeof bv === "string")
        return av.localeCompare(bv) * dir;
      return ((av as number) - (bv as number)) * dir;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = sorted.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE
  );

  const toggleTicker = (ticker: string) =>
    setActiveTickers((current) =>
      current.includes(ticker)
        ? current.filter((t) => t !== ticker)
        : [...current, ticker]
    );

  const changeSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(0);
  };

  const zeroCostCount = lots.filter((lot) => lot.price === 0).length;

  const sortIndicator = (key: SortKey) =>
    key === sortKey ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  return (
    <section className="space-y-6" aria-label="Imported portfolio">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-expanded={!collapsed}
            className="flex items-center gap-2 rounded-sm-card border border-border px-3 py-1.5 text-sm font-medium text-fg-muted transition-colors hover:bg-surface-2"
          >
            <span
              className={`inline-block transition-transform ${collapsed ? "-rotate-90" : ""}`}
              aria-hidden
            >
              ▾
            </span>
            {collapsed ? "Show purchases" : "Hide purchases"}
          </button>
          <div>
            <h2 className="text-lg font-semibold text-fg">{fileName}</h2>
            <p className="text-sm text-fg-subtle">
              Imported {importedAt ? new Date(importedAt).toLocaleString() : ""}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => dispatch({ type: "clear" })}
          className="rounded-sm-card border border-border px-3 py-1.5 text-sm font-medium text-fg-muted transition-colors hover:bg-surface-2"
        >
          Clear portfolio
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-card border border-border p-4">
              <p className="text-xs uppercase tracking-wide text-fg-subtle">
                Lots
              </p>
              <p className="mt-1 text-2xl font-semibold text-fg">
                {lots.length}
              </p>
            </div>
            <div className="rounded-card border border-border p-4">
              <p className="text-xs uppercase tracking-wide text-fg-subtle">
                Symbols
              </p>
              <p className="mt-1 text-2xl font-semibold text-fg">
                {tickers.length}
              </p>
              <p className="text-sm text-fg-subtle">{tickers.join(", ")}</p>
            </div>
            <div className="rounded-card border border-border p-4">
              <p className="text-xs uppercase tracking-wide text-fg-subtle">
                Zero cost
              </p>
              <p className="mt-1 text-2xl font-semibold text-fg">
                {zeroCostCount}
              </p>
              <p className="text-sm text-fg-subtle">Received, not bought</p>
            </div>
          </div>

          {/* Controles: busqueda, chips de ticker, toggle de costo cero. */}
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
              placeholder="Search date or comment…"
              className="w-full max-w-xs rounded-sm-card border border-border bg-surface px-3 py-1.5 text-sm text-fg placeholder:text-fg-subtle sm:w-64"
            />
            <label className="flex cursor-pointer items-center gap-2 text-sm text-fg-muted">
              <input
                type="checkbox"
                checked={zeroOnly}
                onChange={(event) => {
                  setZeroOnly(event.target.checked);
                  setPage(0);
                }}
                className="h-4 w-4 accent-warning"
              />
              Zero-cost only
            </label>
          </div>

          {linkedTicker ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-fg-subtle">Filtered by position:</span>
              <Badge tone="accent">
                {linkedTicker}
                <button
                  type="button"
                  onClick={() => onLinkedTickerChange?.(null)}
                  className="ml-1 font-bold"
                  aria-label={`Clear ${linkedTicker} filter`}
                >
                  ✕
                </button>
              </Badge>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {tickers.map((ticker) => {
              const active = activeTickers.includes(ticker);
              return (
                <button
                  key={ticker}
                  type="button"
                  onClick={() => {
                    toggleTicker(ticker);
                    setPage(0);
                  }}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-fg-muted hover:bg-surface-2"
                  }`}
                >
                  {ticker}
                </button>
              );
            })}
          </div>

          {/* Vista de escritorio: tabla con orden y paginacion. */}
          <div className="hidden overflow-x-auto rounded-card border border-border sm:block">
            <table className="w-full min-w-[820px] text-left text-sm">
              <caption className="sr-only">
                Purchases, {sorted.length} rows after filters
              </caption>
              <thead className="border-b border-border bg-surface-2 text-xs uppercase tracking-wide text-fg-subtle">
                <tr>
                  <SortHeader label="Date" column="date" onClick={changeSort} indicator={sortIndicator} />
                  <SortHeader label="Ticker" column="ticker" onClick={changeSort} indicator={sortIndicator} />
                  <SortHeader label="Quantity" column="quantity" onClick={changeSort} indicator={sortIndicator} align="right" />
                  <SortHeader label="Cost / share" column="price" onClick={changeSort} indicator={sortIndicator} align="right" />
                  <SortHeader label="Cost total" column="costTotal" onClick={changeSort} indicator={sortIndicator} align="right" />
                  <SortHeader label="Value now" column="valueNow" onClick={changeSort} indicator={sortIndicator} align="right" />
                  <SortHeader label="Gain" column="gain" onClick={changeSort} indicator={sortIndicator} align="right" />
                  <th className="px-4 py-3 font-medium">Comment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <SkeletonRows />
                ) : (
                  pageRows.map((row, index) => (
                    <LotRow
                      key={`${row.lot.date}-${row.lot.ticker}-${index}`}
                      row={row}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Vista movil: tarjetas de lote en grilla 2x2. */}
          <div className="space-y-3 sm:hidden">
            {loading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-28 w-full rounded-card" />
              ))
            ) : (
              pageRows.map((row, index) => (
                <LotCard
                  key={`${row.lot.date}-${row.lot.ticker}-${index}`}
                  row={row}
                />
              ))
            )}
          </div>

          <Pagination
            page={safePage}
            totalPages={totalPages}
            total={sorted.length}
            onPage={(next) => setPage(next)}
          />

          {errors.length > 0 && (
            <div className="rounded-card border border-danger/40 bg-danger/5">
              <h3 className="border-b border-danger/40 px-4 py-3 text-sm font-semibold text-danger">
                {errors.length} row{errors.length === 1 ? "" : "s"} rejected
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-danger/70">
                    <tr>
                      <th className="px-4 py-2 font-medium">Line</th>
                      <th className="px-4 py-2 font-medium">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-danger/20">
                    {errors.map((error, index) => (
                      <tr key={index}>
                        <td className="px-4 py-2 tabular-nums text-danger">
                          {error.line}
                        </td>
                        <td className="px-4 py-2 text-danger">
                          {error.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function SortHeader({
  label,
  column,
  onClick,
  indicator,
  align = "left",
}: {
  label: string;
  column: SortKey;
  onClick: (key: SortKey) => void;
  indicator: (key: SortKey) => string;
  align?: "left" | "right";
}) {
  return (
    <th
      className="px-4 py-3 font-medium"
      aria-sort={
        indicator(column)
          ? indicator(column).includes("▲")
            ? "ascending"
            : "descending"
          : "none"
      }
    >
      <button
        type="button"
        onClick={() => onClick(column)}
        className={`inline-flex items-center gap-1 hover:text-fg ${
          align === "right" ? "flex-row-reverse" : ""
        }`}
      >
        {label}
        <span className="text-[0.7em]">{indicator(column)}</span>
      </button>
    </th>
  );
}

function LotRow({ row }: { row: EnrichedLot }) {
  const { lot, costTotal, valueNow, gain } = row;
  const gainClass =
    gain == null
      ? "text-fg-muted"
      : gain >= 0
        ? "text-success"
        : "text-danger";
  return (
    <tr
      className={lot.price === 0 ? "bg-warning/5" : undefined}
    >
      <td className="px-4 py-2.5 tabular-nums text-fg-muted">{lot.date}</td>
      <td className="px-4 py-2.5 font-medium text-fg">{lot.ticker}</td>
      <td className="px-4 py-2.5 text-right tabular-nums text-fg-muted">
        {quantityFormat.format(lot.quantity)}
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums text-fg-muted">
        {priceFormat.format(lot.price)}
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums text-fg-muted">
        {priceFormat.format(costTotal)}
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums text-fg-muted">
        {valueNow != null ? priceFormat.format(valueNow) : "—"}
      </td>
      <td className={`px-4 py-2.5 text-right tabular-nums ${gainClass}`}>
        {gain != null ? signed(gain) : "—"}
      </td>
      <td className="px-4 py-2.5 text-fg-subtle">
        {lot.price === 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
            {lot.comment ?? "Zero cost"}
          </span>
        ) : (
          lot.comment
        )}
      </td>
    </tr>
  );
}

function LotCard({ row }: { row: EnrichedLot }) {
  const { lot, costTotal, valueNow, gain } = row;
  const gainClass =
    gain == null ? "text-fg-muted" : gain >= 0 ? "text-success" : "text-danger";
  return (
    <div
      className={`rounded-card border border-border p-4 ${
        lot.price === 0 ? "bg-warning/5" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-fg">{lot.ticker}</span>
        <span className="text-xs tabular-nums text-fg-subtle">{lot.date}</span>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-xs text-fg-subtle">Quantity</dt>
          <dd className="tabular-nums text-fg-muted">
            {quantityFormat.format(lot.quantity)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-fg-subtle">Cost / share</dt>
          <dd className="tabular-nums text-fg-muted">
            {priceFormat.format(lot.price)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-fg-subtle">Cost total</dt>
          <dd className="tabular-nums text-fg-muted">
            {priceFormat.format(costTotal)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-fg-subtle">Value now</dt>
          <dd className="tabular-nums text-fg-muted">
            {valueNow != null ? priceFormat.format(valueNow) : "—"}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-fg-subtle">Gain</dt>
          <dd className={`tabular-nums ${gainClass}`}>
            {gain != null ? signed(gain) : "—"}
          </dd>
        </div>
      </dl>
      {lot.price === 0 ? (
        <p className="mt-2 text-xs text-warning">{lot.comment ?? "Zero cost"}</p>
      ) : null}
    </div>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <tr key={index} className="divide-x-0">
          <td className="px-4 py-2.5" colSpan={8}>
            <Skeleton className="h-4 w-full" />
          </td>
        </tr>
      ))}
    </>
  );
}

function Pagination({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (next: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between text-sm text-fg-subtle">
      <span>
        {total} lot{total === 1 ? "" : "s"}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          onClick={() => onPage(Math.max(0, page - 1))}
          disabled={page === 0}
        >
          Previous
        </Button>
        <span className="tabular-nums">
          {page + 1} / {totalPages}
        </span>
        <Button
          variant="ghost"
          onClick={() => onPage(Math.min(totalPages - 1, page + 1))}
          disabled={page >= totalPages - 1}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
