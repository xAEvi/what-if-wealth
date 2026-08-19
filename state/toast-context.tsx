"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Tone = "neutral" | "success" | "danger" | "warning";

type Toast = {
  id: string;
  message: string;
  tone: Tone;
};

type ToastInput = {
  id?: string;
  message: string;
  tone?: Tone;
};

type ToastContextValue = {
  toast: (input: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "border-border bg-surface text-fg",
  success: "border-success/40 bg-success/10 text-success",
  danger: "border-danger/40 bg-danger/10 text-danger",
  warning: "border-warning/40 bg-warning/10 text-warning",
};

const AUTO_DISMISS_MS = 3500;

/**
 * Proveedor de toasts liviano: apila mensajes abajo a la derecha, se autodescarta
 * y deduplica por `id` para no amontonar avisos repetidos (p. ej. busquedas sin
 * resultados mientras se escribe).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Array<Toast>>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback(
    ({ id, message, tone = "neutral" }: ToastInput) => {
      const key = id ?? `${message}-${Date.now()}`;
      const existing = timers.current.get(key);
      if (existing) clearTimeout(existing);

      setToasts((current) => [
        ...current.filter((toast) => toast.id !== key),
        { id: key, message, tone },
      ]);

      const timer = setTimeout(() => dismiss(key), AUTO_DISMISS_MS);
      timers.current.set(key, timer);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-center gap-3 rounded-card border px-4 py-2 text-sm shadow-card ${TONE_CLASSES[toast.tone]}`}
          >
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss"
              className="text-fg-subtle transition-colors hover:text-fg"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider.");
  return ctx;
}
