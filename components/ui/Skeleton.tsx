type SkeletonProps = {
  className?: string;
};

/** Bloque gris pulsante que ocupa el lugar de contenido mientras carga. */
export default function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-card bg-surface-2 ${className}`}
      aria-hidden="true"
    />
  );
}
