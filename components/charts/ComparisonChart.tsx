"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const usd = (value: number) =>
  `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export type ComparisonDatum = {
  date: string;
  original?: number;
  substituted?: number;
};

type ComparisonChartProps = {
  data: Array<ComparisonDatum>;
  originalLabel: string;
  substitutedLabel: string;
};

export default function ComparisonChart({
  data,
  originalLabel,
  substitutedLabel,
}: ComparisonChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
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
          formatter={(value, name) => [usd(Number(value)), String(name)]}
          labelStyle={{ fontWeight: 600 }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="original"
          name={originalLabel}
          stroke="#2563eb"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="substituted"
          name={substitutedLabel}
          stroke="#d97706"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
