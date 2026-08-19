import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
};

/** Contenedor de superficie con borde y radio del sistema de diseno. */
export default function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-card border border-border bg-surface ${className}`}
    >
      {children}
    </div>
  );
}
