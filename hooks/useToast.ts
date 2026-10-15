import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { ToastMessage } from "@/app/components/Toast";

interface ToastContextValue {
  toasts: ToastMessage[];
  addToast: (
    message: string,
    type?: "success" | "error" | "info",
    duration?: number,
  ) => string;
  removeToast: (id: string) => void;
  success: (message: string, duration?: number) => string;
  error: (message: string, duration?: number) => string;
  info: (message: string, duration?: number) => string;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback(
    (
      message: string,
      type: "success" | "error" | "info" = "info",
      duration = 4000,
    ) => {
      const id = Math.random().toString(36).substring(2, 11);
      const newToast: ToastMessage = { id, message, type, duration };
      setToasts((prev) => [...prev, newToast]);
      return id;
    },
    [],
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const success = useCallback(
    (message: string, duration?: number) => {
      return addToast(message, "success", duration);
    },
    [addToast],
  );

  const error = useCallback(
    (message: string, duration?: number) => {
      return addToast(message, "error", duration);
    },
    [addToast],
  );

  const info = useCallback(
    (message: string, duration?: number) => {
      return addToast(message, "info", duration);
    },
    [addToast],
  );

  const value = useMemo(
    () => ({ toasts, addToast, removeToast, success, error, info }),
    [toasts, addToast, removeToast, success, error, info],
  );

  return createElement(ToastContext.Provider, { value }, children);
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }

  return context;
}
