"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Icon } from "./Icon";

type Toast = { id: number; message: string; tone: "default" | "error"; action?: { label: string; run: () => void } };
type Ctx = (message: string, opts?: { tone?: Toast["tone"]; action?: Toast["action"] }) => void;

const ToastContext = createContext<Ctx>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const push = useCallback<Ctx>((message, opts) => {
    const id = ++idRef.current;
    setToasts((t) => [...t.slice(-2), { id, message, tone: opts?.tone ?? "default", action: opts?.action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts?.action ? 6000 : 3500);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center gap-2 px-4 bottom-[calc(84px+env(safe-area-inset-bottom))] md:bottom-6 md:left-60"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={`animate-rise pointer-events-auto flex max-w-md items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-[var(--shadow)] ${
              t.tone === "error" ? "bg-critical text-white" : "bg-ink text-panel"
            }`}
          >
            {t.tone === "error" ? <Icon name="alert" size={18} /> : <Icon name="check" size={18} />}
            <span>{t.message}</span>
            {t.action && (
              <button
                className="ml-1 rounded-md px-2 py-1 font-bold underline underline-offset-2"
                onClick={() => {
                  t.action!.run();
                  setToasts((all) => all.filter((x) => x.id !== t.id));
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
