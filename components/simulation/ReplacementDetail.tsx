"use client";

import { useMemo, useState } from "react";
import type { Replacement } from "@/lib/portfolio/engine";
import type { PriceHistory } from "@/lib/portfolio/types";
import { lotValueWithQuote } from "@/lib/portfolio/engine";

const usdPrecise = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
const quantityFormat = new Intl.NumberFormat("en-US", {
  maximumSignificantDigits: 6,
});
const signedPct = (value: number) =>
  `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;

type SortKey = "date" | "cost" | "valueNow" | "gain" | "gainPct";

type Row = {
  replacement: Replacement;
  cost: number;
  valueNow: number | null;
  gain: number | null;
  gainPct: number | null;
};

type ReplacementDetailProps = {
  replacements: Array<Replacement>;
  histories: Record<string, PriceHistory> | null;
  quotes: Record<string, number> | null;
};

/**
 * Tabla de detalle de una sustitucion: lote original y su reemplazo, con
 * orden por columna, columnas de ganancia (monto y %) y totales al pie para
 * verificar la preservacion de capital.
 */
export default function ReplacementDetail({
  replacements,
  histories,
  quotes,
}: ReplacementDetailProps) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo<Array<Row>>(() => {
    const valueOf = (replacement: Replacement): number | null => {
      const history = histories?.[replacement.replacement.ticker];
      const quote = quotes?.[replacement.replacement.ticker];
      if (!history || quote == null) return null;
      return lotValueWithQuote(replacement.replacement, history, quote);
    };

    const dir = sortDir === "asc" ? 1 : -1;
    return [...replacements]
      .map((replacement) => {
        const cost =
          replacement.replacement.quantity * replacement.replacement.price;
        const valueNow = valueOf(replacement);
        const gain = valueNow != null ? valueNow - cost : null;
        const gainPct =
          cost > 0 && gain != null ? (gain / cost) * 100 : null;
        return { replacement, cost, valueNow, gain, gainPct };
      })
      .sort((a, b) => {
        if (sortKey === "date")
          return (
            a.replacement.original.date.localeCompare(
              b.replacement.original.date
            ) * dir
          );
        const pick = (row: Row): number | null => {
          switch (sortKey) {
            case "cost":
              return row.cost;
            case "valueNow":
              return row.valueNow;
            case "gain":
              return row.gain;
            case "gainPct":
              return row.gainPct;
            default:
              return null;
          }
        };
        const av = pick(a);
        const bv = pick(b);
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return (av - bv) * dir;
      });
  }, [replacements, histories, quotes, sortKey, sortDir]);

  const totals = useMemo(() => {
    let cost = 0;
    let valueNow = 0;
    let gain = 0;
    let missing = false;
    for (const row of rows) {
      cost += row.cost;
      if (row.valueNow == null || row.gain == null) missing = true;
      else {
        valueNow += row.valueNow;
        gain += row.gain;
      }
    }
    const gainPct = cost > 0 && !missing ? (gain / cost) * 100 : null;
    return { cost, valueNow, gain, gainPct, missing };
  }, [rows]);

  const changeSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((c) => (c === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const indicator = (key: SortKey) =>
    key === sortKey ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  return (
    <div className="overflow-x-auto rounded-card border border-border">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="border-b border-border bg-surface-2 text-xs uppercase tracking-wide text-fg-subtle">
          <tr>
            <th
              className="px-4 py-3 font-medium"
              aria-sort={
                sortKey === "date"
                  ? sortDir === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
              }
            >
              <SortButton label="Date" onClick={() => changeSort("date")} indicator={indicator("date")} />
            </th>
            <th scope="col" className="px-4 py-3 font-medium">Replacement</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Quantity</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Price</th>
            <th
              className="px-4 py-3 text-right font-medium"
              aria-sort={
                sortKey === "cost"
                  ? sortDir === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
              }
            >
              <SortButton label="Cost" onClick={() => changeSort("cost")} indicator={indicator("cost")} align="right" />
            </th>
            <th
              className="px-4 py-3 text-right font-medium"
              aria-sort={
                sortKey === "valueNow"
                  ? sortDir === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
              }
            >
              <SortButton label="Value now" onClick={() => changeSort("valueNow")} indicator={indicator("valueNow")} align="right" />
            </th>
            <th
              className="px-4 py-3 text-right font-medium"
              aria-sort={
                sortKey === "gain"
                  ? sortDir === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
              }
            >
              <SortButton label="Gain" onClick={() => changeSort("gain")} indicator={indicator("gain")} align="right" />
            </th>
            <th
              className="px-4 py-3 text-right font-medium"
              aria-sort={
                sortKey === "gainPct"
                  ? sortDir === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
              }
            >
              <SortButton label="Gain %" onClick={() => changeSort("gainPct")} indicator={indicator("gainPct")} align="right" />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, index) => {
            const gainClass =
              row.gain == null
                ? "text-fg-muted"
                : row.gain >= 0
                  ? "text-success"
                  : "text-danger";
            const gainPctClass =
              row.gainPct == null
                ? "text-fg-muted"
                : row.gainPct >= 0
                  ? "text-success"
                  : "text-danger";
            return (
              <tr
                key={`${row.replacement.original.ticker}-${row.replacement.original.date}-${index}`}
              >
                <td className="px-4 py-2.5 tabular-nums text-fg-muted">
                  {row.replacement.original.date}
                </td>
                <td className="px-4 py-2.5 font-medium text-fg">
                  <span className="text-fg-subtle line-through">
                    {row.replacement.original.ticker}
                  </span>{" "}
                  <span className="text-fg-subtle">→</span>{" "}
                  {row.replacement.replacement.ticker}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-fg-muted">
                  {quantityFormat.format(row.replacement.replacement.quantity)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-fg-muted">
                  {usdPrecise(row.replacement.replacement.price)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-fg-muted">
                  {usdPrecise(row.cost)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-fg-muted">
                  {row.valueNow != null ? usdPrecise(row.valueNow) : "—"}
                </td>
                <td className={`px-4 py-2.5 text-right tabular-nums ${gainClass}`}>
                  {row.gain != null ? usdPrecise(row.gain) : "—"}
                </td>
                <td
                  className={`px-4 py-2.5 text-right tabular-nums ${gainPctClass}`}
                >
                  {row.gainPct != null ? signedPct(row.gainPct) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="border-t border-border bg-surface-2 font-medium">
          <tr>
            <td className="px-4 py-2.5 text-fg-muted" colSpan={5}>
              Total
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums text-fg">
              {usdPrecise(totals.valueNow)}
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums text-fg">
              {totals.missing ? "—" : usdPrecise(totals.gain)}
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums text-fg">
              {totals.gainPct != null ? signedPct(totals.gainPct) : "—"}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function SortButton({
  label,
  onClick,
  indicator,
  align = "left",
}: {
  label: string;
  onClick: () => void;
  indicator: string;
  align?: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 hover:text-fg ${
        align === "right" ? "flex-row-reverse" : ""
      }`}
    >
      {label}
      <span className="text-[0.7em]">{indicator}</span>
    </button>
  );
}
