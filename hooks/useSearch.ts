"use client";

import { useEffect, useState } from "react";

/** Candidato de autocompletado devuelto por /api/search. */
export type SearchCandidate = {
  symbol: string;
  name?: string;
};

/**
 * Autocompletado contra /api/search con debounce de 250ms. Centraliza la
 * logica que antes vivia embebida en WhatIfSimulation con un useEffect por
 * modo, de modo que Replace y Distribute comparten el mismo comportamiento.
 */
export function useSearch(query: string) {
  const [results, setResults] = useState<Array<SearchCandidate>>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearching(false);
      return;
    }

    const timer = setTimeout(() => {
      setSearching(true);
      fetch(`/api/search?q=${encodeURIComponent(trimmed)}`)
        .then((response) => response.json())
        .then((data) => setResults(data.results ?? []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  return { results, searching };
}
