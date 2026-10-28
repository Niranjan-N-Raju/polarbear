"use client";

import { appFetch } from "@/lib/api-client";
import { useEffect, useRef, useState } from "react";
import {
  CheckIcon,
  ChevronRightIcon,
  OutlineCloseIcon,
} from "@/app/components/icons";
import { useToast } from "@/app/hooks/useToast";
import type { StoreSelectFranchise, StoreSelectModalProps } from "@/types/store-config";

function TrailingIcon({
  franchiseId,
  isActive,
  selecting,
}: Readonly<{
  franchiseId: string;
  isActive: boolean;
  selecting: string | null;
}>) {
  if (selecting === franchiseId) {
    return (
      <div className="w-4 h-4 border-2 border-brand-orange border-t-transparent rounded-full animate-spin shrink-0" />
    );
  }
  if (isActive) {
    return <CheckIcon />;
  }
  return (
    <ChevronRightIcon className="w-4 h-4 text-gray-300 group-hover:text-brand-orange shrink-0 transition" />
  );
}

export default function StoreSelectModal({
  isOpen,
  canDismiss,
  activeFranchiseId,
  onSelect,
  onDismiss,
}: Readonly<StoreSelectModalProps>) {
  const [franchises, setFranchises] = useState<StoreSelectFranchise[]>([]);
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const { error } = useToast();
  const modalRef = useRef<HTMLDivElement>(null);

  // Keyboard: Escape to dismiss
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && canDismiss) {
        onDismiss();
      }
      // Trap focus within modal
      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, canDismiss, onDismiss]);

  useEffect(() => {
    if (!isOpen) return;

    queueMicrotask(() => {
      setSelecting(null);
      setLoading(true);
      setLoadFailed(false);
      setFranchises([]);
      appFetch("/api/stores")
        .then((r) => r.json())
        .then((data: { franchises?: StoreSelectFranchise[] }) => {
          setFranchises(data.franchises ?? []);
          setLoading(false);
        })
        .catch(() => {
          setLoadFailed(true);
          error("Failed to load stores.");
          setLoading(false);
        });
    });
  }, [isOpen, error]);

  async function handleSelect(franchise: StoreSelectFranchise) {
    setSelecting(franchise._id);
    try {
      const res = await appFetch("/api/stores/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          franchiseId: franchise._id,
          franchiseName: franchise.name,
        }),
      });
      if (res.ok) {
        onSelect(franchise._id, franchise.name);
      } else {
        error("Failed to select store. Please try again.");
        setSelecting(null);
      }
    } catch {
      error("Failed to select store. Please try again.");
      setSelecting(null);
    }
  }

  function renderBody() {
    if (loading) {
      return (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-2 border-brand-orange border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }
    if (loadFailed) {
      return (
        <p className="text-center text-sm text-gray-500 py-6">
          Unable to load stores. Please try again.
        </p>
      );
    }
    if (franchises.length === 0) {
      return (
        <p className="text-center text-sm text-gray-500 py-6">
          No stores available. Contact your administrator.
        </p>
      );
    }
    return (
      <div className="space-y-2.5">
        {franchises.map((f) => {
          const isActive = f._id === activeFranchiseId;
          return (
            <button
              key={f._id}
              onClick={() => handleSelect(f)}
              disabled={selecting !== null}
              className={`w-full text-left rounded-xl border px-4 py-3.5 transition disabled:opacity-60 group ${
                isActive
                  ? "border-brand-orange bg-brand-peach"
                  : "border-brand-beige bg-brand-sand/40 hover:bg-brand-peach hover:border-brand-orange"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className={`font-semibold text-sm truncate ${isActive ? "text-brand-orange" : "text-gray-800 group-hover:text-brand-orange"}`}
                  >
                    {f.name}
                  </p>
                  {f.address && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {f.address}
                    </p>
                  )}
                </div>
                <TrailingIcon
                  franchiseId={f._id}
                  isActive={isActive}
                  selecting={selecting}
                />
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      {/* Backdrop */}
      {canDismiss ? (
        <button
          type="button"
          aria-label="Close store selector"
          className="absolute inset-0 bg-black/50 backdrop-blur-sm w-full cursor-pointer"
          onClick={onDismiss}
        />
      ) : (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      )}

      {/* Modal card */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="store-select-title"
        className="relative z-10 w-full max-w-sm bg-white rounded-2xl shadow-2xl flex flex-col max-h-[80vh]"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div>
            <h2 id="store-select-title" className="text-lg font-bold text-gray-900">Select Store</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {canDismiss
                ? "Switch to a different store"
                : "Choose a store to continue"}
            </p>
          </div>
          {canDismiss && (
            <button
              onClick={onDismiss}
              className="ml-3 p-1.5 rounded-lg text-gray-400 hover:bg-brand-sand hover:text-gray-600 transition shrink-0"
              aria-label="Close"
            >
              <OutlineCloseIcon />
            </button>
          )}
        </div>

        {/* Body — scrollable */}
        <div className="px-6 pb-6 overflow-y-auto">{renderBody()}</div>
      </div>
    </div>
  );
}
