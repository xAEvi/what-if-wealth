import type { PriceHistory } from "@/lib/portfolio/types";

/**
 * Un ticker sirve como reemplazo si ya cotizaba en o antes del lote mas viejo
 * a sustituir; si no, la simulacion arrancaria tarde y el crecimiento quedaria inflado.
 */
export function hasCoverage(
  history: PriceHistory,
  earliestLotDate: string
): boolean {
  return (
    Boolean(history.firstTradeDate) && history.firstTradeDate <= earliestLotDate
  );
}
