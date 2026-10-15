"use client";

import { ReactNode } from "react";
import { ToastContainer } from "@/app/components/Toast";
import {
  ToastProvider as ToastContextProvider,
  useToast,
} from "@/app/hooks/useToast";

function ToastViewport() {
  const { toasts, removeToast } = useToast();
  return <ToastContainer toasts={toasts} onClose={removeToast} />;
}

export function ToastProvider({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <ToastContextProvider>
      {children}
      <ToastViewport />
    </ToastContextProvider>
  );
}
