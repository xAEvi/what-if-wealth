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

type SortKey = "date" | "cost" | "valueNow";

type ReplacementDetailProps = {
  replacements: Array<Replacement>;
  histories: Record<string, PriceHistory> | null;
  quotes: Record<string, number> | null;
};

/**
 * Tabla de detalle de una sustitucion: lote original y su reemplazo, con
 * orden por columna y totales al pie para verificar la preservacion de
 * capital (Cost y Value now suman lo mismo que la simulacion).
 */
export default function ReplacementDetail({
  replacements,
  histories,
  quotes,
}: ReplacementDetailProps) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    const valueOf = (replacement: Replacement): number | null => {
      const history = histories?.[replacement.replacement.ticker];
      const quote = quotes?.[replacement.replacement.ticker];
      if (!history || quote == null) return null;
      return lotValueWithQuote(replacement.replacement, history, quote);
    };

    const dir = sortDir === "asc" ? 1 : -1;
    return [...replacements]
      .map((replacement) => ({
        replacement,
        cost: replacement.replacement.quantity * replacement.replacement.price,
        valueNow: valueOf(replacement),
      }))
      .sort((a, b) => {
        if (sortKey === "date")
          return a.replacement.original.date.localeCompare(
            b.replacement.original.date
          ) * dir;
        if (sortKey === "cost") return (a.cost - b.cost) * dir;
        const av = a.valueNow;
        const bv = b.valueNow;
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return (av - bv) * dir;
      });
  }, [replacements, histories, quotes, sortKey, sortDir]);

  const totals = useMemo(() => {
    let cost = 0;
    let valueNow = 0;
    let missing = false;
    for (const row of rows) {
      cost += row.cost;
      if (row.valueNow == null) missing = true;
      else valueNow += row.valueNow;
    }
    return { cost, valueNow, missing };
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
      <table className="w-full min-w-[640px] text-left text-sm">
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
            <th className="px-4 py-3 font-medium">Replacement</th>
            <th className="px-4 py-3 text-right font-medium">Quantity</th>
            <th className="px-4 py-3 text-right font-medium">Price</th>
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
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, index) => (
            <tr key={`${row.replacement.original.ticker}-${row.replacement.original.date}-${index}`}>
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
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-border bg-surface-2 font-medium">
          <tr>
            <td className="px-4 py-2.5 text-fg-muted" colSpan={4}>
              Total
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums text-fg">
              {usdPrecise(totals.cost)}
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums text-fg">
              {totals.missing ? "—" : usdPrecise(totals.valueNow)}
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
