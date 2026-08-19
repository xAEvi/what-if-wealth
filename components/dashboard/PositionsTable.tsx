"use client";

import type { Position } from "@/lib/portfolio/engine";

const usd = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

type PositionsTableProps = {
  positions: Array<Position>;
  totalValue: number;
  selectedTicker: string | null;
  onSelectTicker: (ticker: string) => void;
};

/**
 * Desglose por posicion con barra de peso (valor / total) y filtro cruzado:
 * al hacer click en una fila se filtra la tabla de lotes por ese ticker.
 */
export default function PositionsTable({
  positions,
  totalValue,
  selectedTicker,
  onSelectTicker,
}: PositionsTableProps) {
  return (
    <div className="overflow-x-auto rounded-card border border-border">
      <table className="w-full min-w-[560px] text-left text-sm">
        <caption className="sr-only">
          Positions by value, click a row to filter purchases
        </caption>
        <thead className="border-b border-border bg-surface-2 text-xs uppercase tracking-wide text-fg-subtle">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Position</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Value</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Invested</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Gain</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Growth</th>
            <th scope="col" className="px-4 py-3 font-medium">Weight</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {positions.map((position) => {
            const gain = position.value - position.invested;
            const weight =
              totalValue > 0 ? (position.value / totalValue) * 100 : 0;
            const selected = selectedTicker === position.ticker;
            return (
              <tr
                key={position.ticker}
                onClick={() => onSelectTicker(position.ticker)}
                aria-selected={selected}
                className={`cursor-pointer transition-colors hover:bg-surface-2 ${
                  selected ? "bg-accent/5" : ""
                }`}
              >
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
                <td className="px-4 py-2.5">
                  <div className="h-2 w-full max-w-32 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${weight}%` }}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
