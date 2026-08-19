"use client";

import { useMemo } from "react";
import { usePortfolio } from "@/state/portfolio-context";

const quantityFormat = new Intl.NumberFormat("en-US", {
  maximumSignificantDigits: 6,
});
const priceFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default function LotTable() {
  const { state, dispatch } = usePortfolio();
  const { lots, errors, fileName, importedAt } = state;

  const symbols = useMemo(
    () => [...new Set(lots.map((lot) => lot.ticker))].sort(),
    [lots]
  );
  const zeroCostCount = useMemo(
    () => lots.filter((lot) => lot.price === 0).length,
    [lots]
  );
  const sortedLots = useMemo(
    () =>
      [...lots].sort(
        (a, b) =>
          a.date.localeCompare(b.date) || a.ticker.localeCompare(b.ticker)
      ),
    [lots]
  );

  return (
    <section className="space-y-6" aria-label="Imported portfolio">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {fileName}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Imported {importedAt ? new Date(importedAt).toLocaleString() : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => dispatch({ type: "clear" })}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Clear portfolio
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Lots
          </p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {lots.length}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Symbols
          </p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {symbols.length}
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {symbols.join(", ")}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Zero cost
          </p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {zeroCostCount}
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Received, not bought
          </p>
        </div>
      </div>

      {lots.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Ticker</th>
                <th className="px-4 py-3 text-right font-medium">Quantity</th>
                <th className="px-4 py-3 text-right font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Comment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {sortedLots.map((lot, index) => (
                <tr
                  key={`${lot.date}-${lot.ticker}-${index}`}
                  className={
                    lot.price === 0
                      ? "bg-amber-50/60 dark:bg-amber-950/30"
                      : undefined
                  }
                >
                  <td className="px-4 py-2.5 tabular-nums text-zinc-700 dark:text-zinc-300">
                    {lot.date}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">
                    {lot.ticker}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                    {quantityFormat.format(lot.quantity)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                    {priceFormat.format(lot.price)}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-500 dark:text-zinc-400">
                    {lot.price === 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                        {lot.comment ?? "Zero cost"}
                      </span>
                    ) : (
                      lot.comment
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {errors.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/30">
          <h3 className="border-b border-red-200 px-4 py-3 text-sm font-semibold text-red-800 dark:border-red-900 dark:text-red-200">
            {errors.length} row{errors.length === 1 ? "" : "s"} rejected
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-red-500 dark:text-red-400">
                <tr>
                  <th className="px-4 py-2 font-medium">Line</th>
                  <th className="px-4 py-2 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100 dark:divide-red-900">
                {errors.map((error, index) => (
                  <tr key={index}>
                    <td className="px-4 py-2 tabular-nums text-red-700 dark:text-red-300">
                      {error.line}
                    </td>
                    <td className="px-4 py-2 text-red-700 dark:text-red-300">
                      {error.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
