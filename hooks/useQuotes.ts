"use client";

import { useEffect, useState } from "react";

/** Descarga las cotizaciones en vivo de varios tickers, via /api/quote. */
export function useQuotes(tickers: Array<string>): {
  quotes: Record<string, number> | null;
  loading: boolean;
} {
  const [quotes, setQuotes] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(false);
  const tickerKey = tickers.join(",");

  useEffect(() => {
    if (tickers.length === 0) return;
    let cancelled = false;
    setLoading(true);

    fetch(`/api/quote?tickers=${encodeURIComponent(tickerKey)}`)
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setQuotes(data.quotes ?? {});
      })
      .catch(() => {
        if (!cancelled) setQuotes({});
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tickerKey, tickers.length]);

  return { quotes, loading };
}
