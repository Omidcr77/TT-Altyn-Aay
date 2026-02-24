import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const showToast = (message: string, type: ToastType = "info") => {
    const item: ToastItem = { id: Date.now() + Math.random(), message, type };
    setItems((prev) => [...prev, item]);
    setTimeout(() => {
      setItems((prev) => prev.filter((x) => x.id !== item.id));
    }, 3200);
  };

  const value = useMemo(() => ({ showToast }), []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
        {items.map((item) => (
          <div
            key={item.id}
            className={`rounded-lg px-4 py-2 text-white shadow text-sm ${
              item.type === "success" ? "bg-emerald-600" : item.type === "error" ? "bg-red-600" : "bg-slate-800"
            }`}
          >
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
