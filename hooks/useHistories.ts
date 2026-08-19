"use client";

import { useCallback, useEffect, useState } from "react";
import type { PriceHistory } from "@/lib/portfolio/types";

const CACHE_TTL = 12 * 60 * 60 * 1000; // 12h, igual que el cache del server.
const PREFIX = "what-if-wealth.history.v1";

/**
 * Descarga los historicos de varios tickers desde `from`, via /api/history.
 * El cache del server evita repetir requests a Yahoo; ademas se espeja en
 * localStorage para sobrevivir un refresh sin re-fetchear.
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

  const cacheKey = `${PREFIX}:${tickerKey}:${from}`;

  useEffect(() => {
    if (tickers.length === 0) return;
    let cancelled = false;

    // En el primer intento usamos el espejo local si esta fresco.
    if (attempt === 0) {
      const cached = readCache(cacheKey);
      if (cached) {
        setHistories(cached);
        setLoading(false);
        return;
      }
    }

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
        const next = data.histories ?? {};
        writeCache(cacheKey, next);
        setHistories(next);
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
  }, [tickerKey, from, attempt, tickers.length, cacheKey]);

  const reload = useCallback(() => {
    // Invalida el espejo local para forzar un refetch de la red.
    try {
      localStorage.removeItem(`${PREFIX}:${tickerKey}:${from}`);
    } catch {
      // localStorage puede no estar disponible; se ignora.
    }
    setAttempt((value) => value + 1);
  }, [tickerKey, from]);

  return { histories, loading, error, reload };
}

function readCache(key: string): Record<string, PriceHistory> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as { expires: number; data: Record<string, PriceHistory> };
    if (Date.now() > entry.expires) return null;
    return entry.data;
  } catch {
    return null;
  }
}

function writeCache(key: string, data: Record<string, PriceHistory>) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ expires: Date.now() + CACHE_TTL, data })
    );
  } catch {
    // Sin persistencia (modo privado, cuota) el cache en memoria alcanza.
  }
}
