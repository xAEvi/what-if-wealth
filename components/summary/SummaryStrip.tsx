"use client";

const usd = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
const pct = (value: number) => `${value.toFixed(1)}%`;

type SummaryStripProps = {
  invested: number;
  currentValue: number;
  gain: number;
  growthPct: number;
};

type Tone = "neutral" | "positive" | "negative";

/**
 * Barra de resumen siempre visible al scrollear (sticky debajo del header y
 * los tabs). Resume el P&L sin obligar a buscarlo entre graficas y tablas.
 */
export default function SummaryStrip({
  invested,
  currentValue,
  gain,
  growthPct,
}: SummaryStripProps) {
  const gainPositive = gain >= 0;
  const growthPositive = growthPct >= 0;

  return (
    <div className="sticky top-[100px] z-20 -mx-4 mb-6 border-b border-border bg-surface/90 px-4 py-3 backdrop-blur">
      <dl className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-8 gap-y-2">
        <Metric label="Invested" value={usd(invested)} />
        <Metric label="Current value" value={usd(currentValue)} />
        <Metric
          label="Gain"
          value={`${gainPositive ? "+" : "-"}${usd(Math.abs(gain))}`}
          tone={gainPositive ? "positive" : "negative"}
        />
        <Metric
          label="Growth"
          value={pct(growthPct)}
          tone={growthPositive ? "positive" : "negative"}
        />
      </dl>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: Tone;
}) {
  const toneClass =
    tone === "positive"
      ? "text-success"
      : tone === "negative"
        ? "text-danger"
        : "text-fg";

  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-xs uppercase tracking-wide text-fg-subtle">
        {label}
      </dt>
      <dd className={`text-lg font-semibold tabular-nums ${toneClass}`}>
        {value}
      </dd>
    </div>
  );
}
