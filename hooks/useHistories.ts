"use client";

import { useCallback, useEffect, useState } from "react";
import type { PriceHistory } from "@/lib/portfolio/types";

/**
 * Descarga los historicos de varios tickers desde `from`, via /api/history.
 * El cache del server evita repetir requests a Yahoo al cambiar de simulacion.
 */
export function useHistories(
  tickers: Array<string>,
  from: string
): {
  histories: Record<string, PriceHistory> | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
} {
  const [histories, setHistories] = useState<Record<
    string,
    PriceHistory
  > | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const tickerKey = tickers.join(",");

  useEffect(() => {
    if (tickers.length === 0) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(
      `/api/history?tickers=${encodeURIComponent(tickerKey)}&from=${encodeURIComponent(from)}`
    )
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
          return;
        }
        setHistories(data.histories ?? {});
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load market data.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tickerKey, from, attempt, tickers.length]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  return { histories, loading, error, reload };
}
