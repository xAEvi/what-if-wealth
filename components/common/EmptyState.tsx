"use client";

import CsvDropzone from "@/components/csv/CsvDropzone";

// Seis filas del sample para que el usuario vea la forma esperada del CSV.
const SAMPLE_ROWS = [
  { symbol: "SPYG", date: "2024-08-01", price: "$108.20", qty: "10" },
  { symbol: "SPYG", date: "2025-02-10", price: "$115.50", qty: "5.5" },
  { symbol: "VXUS", date: "2024-08-15", price: "$62.40", qty: "12" },
  { symbol: "VXUS", date: "2025-03-01", price: "$65.00", qty: "8" },
  { symbol: "SMH", date: "2024-12-10", price: "$198.00", qty: "4" },
  { symbol: "BTC-USD", date: "2025-03-07", price: "$0.00", qty: "0.000009" },
];

/** Estado vacio ilustrado: dropzone, descarga del sample y preview. */
export default function EmptyState() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="text-4xl" aria-hidden>
          📊
        </span>
        <h2 className="text-xl font-semibold text-fg">
          Start with your Yahoo portfolio
        </h2>
        <p className="max-w-md text-sm text-fg-subtle">
          Import the CSV you exported from Yahoo Finance to value it against live
          market history and run what-if simulations.
        </p>
      </div>

      <CsvDropzone />

      <div className="flex items-center justify-center">
        <a
          href="/portfolio-sample.csv"
          download="portfolio-sample.csv"
          className="inline-flex items-center gap-2 rounded-sm-card border border-border px-3 py-1.5 text-sm font-medium text-fg-muted transition-colors hover:bg-surface-2"
        >
          ⬇ Download sample CSV
        </a>
      </div>

      <div className="overflow-x-auto rounded-card border border-border">
        <table className="w-full min-w-[480px] text-left text-sm">
          <caption className="px-4 pt-3 text-left text-xs uppercase tracking-wide text-fg-subtle">
            Sample preview
          </caption>
          <thead className="text-xs uppercase tracking-wide text-fg-subtle">
            <tr>
              <th className="px-4 py-2 font-medium">Symbol</th>
              <th className="px-4 py-2 font-medium">Trade Date</th>
              <th className="px-4 py-2 text-right font-medium">Price</th>
              <th className="px-4 py-2 text-right font-medium">Quantity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {SAMPLE_ROWS.map((row, index) => (
              <tr key={index}>
                <td className="px-4 py-2 font-medium text-fg">{row.symbol}</td>
                <td className="px-4 py-2 tabular-nums text-fg-muted">
                  {row.date}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-fg-muted">
                  {row.price}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-fg-muted">
                  {row.qty}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
