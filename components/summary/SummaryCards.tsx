"use client";

const usd = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

const pct = (value: number) => `${value.toFixed(1)}%`;

type SummaryCardProps = {
  label: string;
  value: string;
  hint?: string;
  accent?: "positive" | "negative" | "neutral";
};

function SummaryCard({
  label,
  value,
  hint,
  accent = "neutral",
}: SummaryCardProps) {
  const accentClass =
    accent === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : accent === "negative"
        ? "text-red-600 dark:text-red-400"
        : "text-zinc-900 dark:text-zinc-100";

  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold ${accentClass}`}>{value}</p>
      {hint ? (
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type SummaryCardsProps = {
  invested: number;
  currentValue: number;
  gain: number;
  growthPct: number;
};

export default function SummaryCards({
  invested,
  currentValue,
  gain,
  growthPct,
}: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryCard label="Invested" value={usd(invested)} />
      <SummaryCard label="Current value" value={usd(currentValue)} />
      <SummaryCard
        label="Gain"
        value={`${gain >= 0 ? "+" : "-"}${usd(Math.abs(gain))}`}
        accent={gain >= 0 ? "positive" : "negative"}
      />
      <SummaryCard
        label="Growth"
        value={pct(growthPct)}
        accent={growthPct >= 0 ? "positive" : "negative"}
      />
    </div>
  );
}
