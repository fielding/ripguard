"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { BRAND } from "@/content/brand";

type ToastType = "success" | "error" | "info";

type Toast = {
  id: number;
  message: string;
  type: ToastType;
  link?: { label: string; href: string };
};

type ToastContextValue = {
  toast: (
    message: string,
    type?: ToastType,
    link?: { label: string; href: string }
  ) => void;
};

const ToastContext = createContext<ToastContextValue>({
  toast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback(
    (
      message: string,
      type: ToastType = "info",
      link?: { label: string; href: string }
    ) => {
      const id = nextId++;
      // Every error should offer a path to a human. Call sites can still
      // pass a more specific link, which wins over the support fallback.
      const resolvedLink =
        link ??
        (type === "error"
          ? { label: "Get help on Telegram", href: BRAND.supportUrl }
          : undefined);
      setToasts((prev) => [...prev, { id, message, type, link: resolvedLink }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, type === "error" ? 10000 : 5000);
    },
    []
  );

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto z-[100] flex flex-col gap-2 max-w-sm pb-safe">
          {toasts.map((t) => {
            const toneClasses =
              t.type === "success"
                ? "border-cyan/40 bg-cyan/[0.06]"
                : t.type === "error"
                  ? "border-danger/40 bg-danger/[0.06]"
                  : "border-line-strong bg-surface-strong/95";
            const dotClasses =
              t.type === "success"
                ? "bg-cyan"
                : t.type === "error"
                  ? "bg-danger"
                  : "bg-subtle";
            return (
              <div
                key={t.id}
                role="alert"
                aria-live={t.type === "error" ? "assertive" : "polite"}
                className={`rounded-lg border backdrop-blur-md px-4 py-3 text-sm text-foreground animate-[slideIn_0.2s_ease-out] ${toneClasses}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 flex items-start gap-2.5">
                    <span
                      aria-hidden
                      className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${dotClasses}`}
                    />
                    <div className="min-w-0">
                      <p className="leading-snug">{t.message}</p>
                      {t.link && (
                        <a
                          href={t.link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted underline decoration-line hover:text-cyan hover:decoration-cyan transition-colors mt-1 inline-block"
                        >
                          {t.link.label}
                        </a>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => dismiss(t.id)}
                    className="text-subtle hover:text-foreground shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2 -my-1 transition-colors"
                    aria-label="Dismiss notification"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ToastContext.Provider>
  );
}
