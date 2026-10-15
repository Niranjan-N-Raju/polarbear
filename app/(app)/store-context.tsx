"use client";

import { createContext, useContext } from "react";
import type { StoreModalContextType } from "@/types/app-shell";

export const StoreModalContext = createContext<StoreModalContextType>({
  openStoreModal: () => {},
  activeStoreId: null,
});

export function useStoreModal() {
  return useContext(StoreModalContext);
}
