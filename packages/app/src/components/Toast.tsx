"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

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
      setToasts((prev) => [...prev, { id, message, type, link }]);
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
        <div
          className="fixed bottom-4 left-4 right-4 sm:left-auto z-[100] flex flex-col gap-2 max-w-sm pb-safe"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              role="alert"
              aria-live={t.type === "error" ? "assertive" : "polite"}
              className={`rounded-lg px-4 py-3 text-sm shadow-lg border backdrop-blur-md animate-[slideIn_0.2s_ease-out] ${
                t.type === "success"
                  ? "bg-green-500/15 border-green-500/30 text-green-300"
                  : t.type === "error"
                    ? "bg-red-500/15 border-red-500/30 text-red-300"
                    : "bg-white/10 border-white/20 text-white/80"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p>{t.message}</p>
                  {t.link && (
                    <a
                      href={t.link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs underline opacity-70 hover:opacity-100 mt-1 inline-block"
                    >
                      {t.link.label}
                    </a>
                  )}
                </div>
                <button
                  onClick={() => dismiss(t.id)}
                  className="text-white/40 hover:text-white/70 shrink-0"
                  aria-label="Dismiss notification"
                >
                  &#x2715;
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
