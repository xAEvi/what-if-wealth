import Skeleton from "./Skeleton";

/** Placeholder de una franja de resumen: cuatro bloques en linea. */
export function SummaryStripSkeleton() {
  return (
    <div className="sticky top-[100px] z-20 -mx-4 mb-6 border-b border-border bg-surface/90 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-8 gap-y-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex items-baseline gap-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Placeholder de un grafico de lineas: rectangulo con lineas adentro. */
export function ChartSkeleton() {
  return (
    <div className="rounded-card border border-border p-4">
      <Skeleton className="mb-4 h-4 w-32" />
      <Skeleton className="h-[300px] w-full" />
    </div>
  );
}

/** Placeholder de tabla: encabezado y N filas pulsantes. */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-card border border-border">
      <Skeleton className="h-10 w-full rounded-none" />
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex gap-4 p-4">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
