import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
};

// primary llena con el color de acento; ghost solo borde y texto.
const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-contrast border border-transparent",
  ghost: "border-border text-fg-muted hover:bg-surface-2",
};

/** Boton base del sistema de diseno, con foco visible para accesibilidad. */
export default function Button({
  variant = "ghost",
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-sm-card px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
