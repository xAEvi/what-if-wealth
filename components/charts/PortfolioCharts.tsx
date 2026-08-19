"use client";

import { useState } from "react";
import {
  Brush,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SeriesPoint } from "@/lib/portfolio/types";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type View = "value" | "growth" | "both";

const VALUE_COLOR = "#2563eb";
const GROWTH_COLOR = "#059669";
const INVESTED_COLOR = "#a1a1aa";

const usd = (value: number) =>
  `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const pct = (value: number) => `${value.toFixed(1)}%`;

/**
 * Grafica unica de portafolio con toggle Value / Growth / Both. En Value y
 * Both superpone la linea punteada de capital invertido para leer la brecha,
 * y un Brush permite acotar el rango temporal.
 */
export default function PortfolioCharts({
  points,
}: {
  points: Array<SeriesPoint>;
}) {
  const [view, setView] = useState<View>("value");



  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-fg">Performance</h3>
        <div className="flex gap-2">
          <Button
            variant={view === "value" ? "primary" : "ghost"}
            onClick={() => setView("value")}
          >
            Value
          </Button>
          <Button
            variant={view === "growth" ? "primary" : "ghost"}
            onClick={() => setView("growth")}
          >
            Growth
          </Button>
          <Button
            variant={view === "both" ? "primary" : "ghost"}
            onClick={() => setView("both")}
          >
            Both
          </Button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={points} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="currentColor"
            opacity={0.1}
          />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={48} />
          {view !== "growth" ? (
            <YAxis
              yAxisId="value"
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => usd(v)}
              width={72}
            />
          ) : null}
          {view !== "value" ? (
            <YAxis
              yAxisId="growth"
              orientation="right"
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => pct(v)}
              width={56}
            />
          ) : null}
          <Tooltip
            formatter={(value, name) => {
              const isGrowth =
                view === "growth" ||
                (view === "both" && String(name) === "Growth");
              return [isGrowth ? pct(Number(value)) : usd(Number(value)), String(name)];
            }}
            labelStyle={{ fontWeight: 600 }}
          />
          {view !== "growth" ? <Legend /> : null}

          {view !== "growth" ? (
            <Line
              yAxisId="value"
              type="monotone"
              dataKey="invested"
              name="Invested"
              stroke={INVESTED_COLOR}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
            />
          ) : null}
          {view !== "growth" ? (
            <Line
              yAxisId="value"
              type="monotone"
              dataKey="value"
              name="Value"
              stroke={VALUE_COLOR}
              strokeWidth={2}
              dot={false}
            />
          ) : null}
          {view !== "value" ? (
            <Line
              yAxisId="growth"
              type="monotone"
              dataKey="growthPct"
              name="Growth"
              stroke={GROWTH_COLOR}
              strokeWidth={2}
              dot={false}
            />
          ) : null}

          <Brush
            dataKey="date"
            height={20}
            stroke={INVESTED_COLOR}
            travellerWidth={8}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
