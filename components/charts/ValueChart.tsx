"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SeriesPoint } from "@/lib/portfolio/types";

const usd = (value: number) =>
  `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function ValueChart({ points }: { points: Array<SeriesPoint> }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart
        data={points}
        margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="currentColor"
          opacity={0.1}
        />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={48} />
        <YAxis
          tick={{ fontSize: 11 }}
          tickFormatter={(v: number) => usd(v)}
          width={72}
        />
        <Tooltip
          formatter={(value) => [usd(Number(value)), "Value"]}
          labelStyle={{ fontWeight: 600 }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#2563eb"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
