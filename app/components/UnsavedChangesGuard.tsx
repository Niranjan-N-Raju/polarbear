"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const UNSAVED_CHANGES_WARNING =
  "The changes made will not be saved. Are you ok to leave this screen?";

export default function UnsavedChangesGuard() {
  const router = useRouter();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(
    null,
  );

  const handleLeave = useCallback(() => {
    if (!pendingNavigation) return;
    const nextPath = pendingNavigation;
    setHasUnsavedChanges(false);
    setPendingNavigation(null);
    router.push(nextPath);
  }, [pendingNavigation, router]);

  const handleStay = useCallback(() => {
    setHasUnsavedChanges(false);
    setPendingNavigation(null);
  }, []);

  useEffect(() => {
    const dirtyForms = new Set<HTMLFormElement>();

    function syncDirtyState() {
      setHasUnsavedChanges(dirtyForms.size > 0);
    }

    function markDirty(event: Event) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest('[data-unsaved-ignore="true"]')) return;
      // Track only form edits, not generic page interactions.
      const form = target.closest("form");
      if (!(form instanceof HTMLFormElement)) return;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        const isReadOnlyInput =
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement
            ? target.readOnly
            : false;
        if (target.disabled || isReadOnlyInput) return;
        dirtyForms.add(form);
        syncDirtyState();
      }
    }

    function markCleanOnSubmit(event: Event) {
      const target = event.target;
      if (target instanceof HTMLFormElement) dirtyForms.delete(target);
      syncDirtyState();
    }

    function markCleanOnExplicitReset(event: Event) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      // Modal close/cancel buttons can explicitly clear unsaved state.
      if (!target.closest('[data-unsaved-reset="true"]')) return;
      dirtyForms.clear();
      syncDirtyState();
      setPendingNavigation(null);
    }

    function markCleanOnExternalSignal() {
      dirtyForms.clear();
      syncDirtyState();
      setPendingNavigation(null);
    }

    const observer = new MutationObserver(() => {
      for (const form of dirtyForms) {
        if (!form.isConnected) dirtyForms.delete(form);
      }
      syncDirtyState();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener("input", markDirty, true);
    document.addEventListener("change", markDirty, true);
    document.addEventListener("submit", markCleanOnSubmit, true);
    document.addEventListener("click", markCleanOnExplicitReset, true);
    globalThis.addEventListener("unsaved:clear", markCleanOnExternalSignal);

    return () => {
      document.removeEventListener("input", markDirty, true);
      document.removeEventListener("change", markDirty, true);
      document.removeEventListener("submit", markCleanOnSubmit, true);
      document.removeEventListener("click", markCleanOnExplicitReset, true);
      globalThis.removeEventListener(
        "unsaved:clear",
        markCleanOnExternalSignal,
      );
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    function handleAnchorNavigation(event: MouseEvent) {
      if (!hasUnsavedChanges) return;
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      const nextUrl = new URL(anchor.href, globalThis.location.href);
      if (nextUrl.origin !== globalThis.location.origin) return;

      const currentPath = `${globalThis.location.pathname}${globalThis.location.search}${globalThis.location.hash}`;
      const nextPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
      if (currentPath === nextPath) return;

      // Pause navigation and show a custom confirmation modal instead.
      event.preventDefault();
      event.stopPropagation();
      setPendingNavigation(nextPath);
    }

    document.addEventListener("click", handleAnchorNavigation, true);
    return () => {
      document.removeEventListener("click", handleAnchorNavigation, true);
    };
  }, [hasUnsavedChanges]);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      // Browsers only support native prompts on tab close/refresh.
      if (!hasUnsavedChanges) return;
      event.preventDefault();
    }

    globalThis.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      globalThis.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  if (!pendingNavigation) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45" aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-xl border border-brand-beige p-6">
        <h2 className="text-lg font-bold text-gray-900">Unsaved Changes</h2>
        <p className="mt-2 text-sm text-gray-600">{UNSAVED_CHANGES_WARNING}</p>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleStay}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
          >
            Stay
          </button>
          <button
            type="button"
            onClick={handleLeave}
            className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-white hover:bg-brand-orange/90 transition"
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}
