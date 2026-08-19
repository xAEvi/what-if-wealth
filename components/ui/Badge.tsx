import type { ReactNode } from "react";

type Tone = "neutral" | "accent" | "warning" | "success" | "danger";

type BadgeProps = {
  children: ReactNode;
  tone?: Tone;
  className?: string;
};

// Cada tono combina fondo y texto semanticos del sistema de diseno.
const TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-fg-muted",
  accent: "bg-accent/10 text-accent",
  warning: "bg-warning/10 text-warning",
  success: "bg-success/10 text-success",
  danger: "bg-danger/10 text-danger",
};

/** Etiqueta compacta para estados, categorias o indicadores. */
export default function Badge({
  children,
  tone = "neutral",
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-sm-card px-2 py-0.5 text-xs font-medium ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
