"use client";

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import type { Lot } from "@/lib/portfolio/types";
import type { CsvRowError } from "@/lib/csv/parser";

export type PortfolioState = {
  lots: Lot[];
  errors: CsvRowError[];
  fileName: string | null;
  importedAt: string | null;
};

export type PortfolioAction =
  | {
      type: "import";
      payload: { lots: Lot[]; errors: CsvRowError[]; fileName: string };
    }
  | { type: "clear" };

const STORAGE_KEY = "what-if-wealth.portfolio.v1";

const EMPTY_STATE: PortfolioState = {
  lots: [],
  errors: [],
  fileName: null,
  importedAt: null,
};

/** Lee el estado previo de localStorage, tolerando datos corruptos o del schema viejo. */
function readStoredState(): PortfolioState {
  if (typeof window === "undefined") return EMPTY_STATE;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;

    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.lots)) return EMPTY_STATE;

    return { ...EMPTY_STATE, ...parsed };
  } catch {
    return EMPTY_STATE;
  }
}

function reducer(
  state: PortfolioState,
  action: PortfolioAction
): PortfolioState {
  switch (action.type) {
    case "import":
      return {
        lots: action.payload.lots,
        errors: action.payload.errors,
        fileName: action.payload.fileName,
        importedAt: new Date().toISOString(),
      };

    case "clear":
      return EMPTY_STATE;

    default:
      return state;
  }
}

type PortfolioContextValue = {
  state: PortfolioState;
  dispatch: Dispatch<PortfolioAction>;
};

const PortfolioContext = createContext<PortfolioContextValue | null>(null);

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, readStoredState);

  // El estado entero sobrevive un refresh; los errores se conservan para mostrar que se descarto.
  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  return (
    <PortfolioContext.Provider value={{ state, dispatch }}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio(): PortfolioContextValue {
  const ctx = useContext(PortfolioContext);
  if (!ctx)
    throw new Error("usePortfolio must be used within PortfolioProvider.");
  return ctx;
}
