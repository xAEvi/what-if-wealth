"use client";

/** Aviso del supuesto de reinversion de dividendos que asume el ajuste. */
export default function DividendNotice() {
  return (
    <p className="text-xs text-zinc-500 dark:text-zinc-400">
      Values assume dividends are reinvested (adjusted close), so they are not a
      statement of account. Current value uses live quotes.
    </p>
  );
}
