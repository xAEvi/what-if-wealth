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

const pct = (value: number) => `${value.toFixed(1)}%`;

export default function GrowthChart({
  points,
}: {
  points: Array<SeriesPoint>;
}) {
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
          tickFormatter={(v: number) => pct(v)}
          width={64}
        />
        <Tooltip
          formatter={(value) => [pct(Number(value)), "Growth"]}
          labelStyle={{ fontWeight: 600 }}
        />
        <Line
          type="monotone"
          dataKey="growthPct"
          stroke="#059669"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
