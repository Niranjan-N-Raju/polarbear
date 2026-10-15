"use client";

import { useEffect } from "react";
import {
  CheckCircleIcon,
  ErrorCircleIcon,
  InfoCircleIcon,
  CloseIcon,
} from "@/app/components/icons";

export interface ToastMessage {
  id: string;
  message: string;
  type: "success" | "error" | "info";
  duration?: number;
}

interface ToastProps {
  toast: ToastMessage;
  onClose: (id: string) => void;
}

const TOAST_BG: Record<ToastMessage["type"], string> = {
  success: "bg-white border-brand-teal/30",
  error: "bg-white border-red-300",
  info: "bg-white border-brand-sky/30",
};

const TOAST_TEXT: Record<ToastMessage["type"], string> = {
  success: "text-brand-teal",
  error: "text-red-700",
  info: "text-brand-sky",
};

const TOAST_ICON: Record<ToastMessage["type"], string> = {
  success: "text-brand-teal",
  error: "text-red-600",
  info: "text-brand-sky",
};

export function Toast({ toast, onClose }: Readonly<ToastProps>) {
  useEffect(() => {
    const duration = toast.duration ?? 4000;
    const timer = setTimeout(() => onClose(toast.id), duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onClose]);

  const bgColor = TOAST_BG[toast.type];
  const textColor = TOAST_TEXT[toast.type];
  const iconColor = TOAST_ICON[toast.type];

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${bgColor} ${textColor} text-sm font-medium shadow-lg pointer-events-auto`}
      role="alert"
    >
      <div className={`flex-shrink-0 w-5 h-5 ${iconColor}`}>
        {toast.type === "success" && <CheckCircleIcon />}
        {toast.type === "error" && <ErrorCircleIcon />}
        {toast.type === "info" && <InfoCircleIcon />}
      </div>
      <p className="flex-1">{toast.message}</p>
      <button
        onClick={() => onClose(toast.id)}
        className="flex-shrink-0 ml-2 text-current opacity-70 hover:opacity-100 transition"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onClose: (id: string) => void;
}

export function ToastContainer({
  toasts,
  onClose,
}: Readonly<ToastContainerProps>) {
  return (
    <div className="fixed top-4 right-4 z-[9999999] space-y-2 max-w-sm pointer-events-none">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  );
}
