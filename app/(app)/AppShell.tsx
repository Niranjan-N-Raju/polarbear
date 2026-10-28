"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import StoreSelectModal from "./StoreSelectModal";
import { StoreModalContext } from "./store-context";
import { useToast } from "@/app/hooks/useToast";
import SessionTimeoutModal from "@/app/components/SessionTimeoutModal";
import UnsavedChangesGuard from "@/app/components/UnsavedChangesGuard";
import { logoutAndRedirectToLogin } from "@/lib/client-session";
import type { AppShellProps } from "@/types/app-shell";

const SESSION_PROMPT_AFTER_MS = 40 * 60 * 1000;
const SESSION_PROMPT_DURATION_SECONDS = 60;

export default function AppShell({
  children,
  franchiseId,
  initialFranchiseName,
  userRole,
  userName,
  mustChangePassword = false,
}: Readonly<AppShellProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const { error: showError, success: showSuccess } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [sessionPromptOpen, setSessionPromptOpen] = useState(false);
  const [isExtendingSession, setIsExtendingSession] = useState(false);
  const [sessionPromptSecondsLeft, setSessionPromptSecondsLeft] = useState(
    SESSION_PROMPT_DURATION_SECONDS,
  );
  const [sessionTimerVersion, setSessionTimerVersion] = useState(0);
  const [activeFranchiseId, setActiveFranchiseId] = useState(franchiseId);
  const [activeFranchiseName, setActiveFranchiseName] =
    useState(initialFranchiseName);
  // True while we're auto-checking/selecting on first load (no franchise cookie yet)
  // Global admins never need a store — skip entirely
  // Accounts that must change their password cannot use store APIs yet.
  const needsStore = !mustChangePassword && userRole !== "admin" && userRole !== "sub_admin";
  const [autoSelecting, setAutoSelecting] = useState(
    !franchiseId && needsStore,
  );
  // How many stores this user can access (0 = loading/unknown)
  const [storeCount, setStoreCount] = useState(0);
  const loggingOutRef = useRef(false);

  useEffect(() => {
    if (autoSelecting || globalThis.window.sessionStorage.getItem("em_login_success_toast") !== "1") return;
    globalThis.window.sessionStorage.removeItem("em_login_success_toast");
    const frame = requestAnimationFrame(() => showSuccess("Signed in successfully."));
    return () => cancelAnimationFrame(frame);
  }, [autoSelecting, pathname, showSuccess]);

  useEffect(() => {
    if (!needsStore) return;
    fetch("/api/stores")
      .then((r) => r.json())
      .then((data: { franchises?: unknown[] }) => {
        setStoreCount((data.franchises ?? []).length);
      })
      .catch(() => {});
  }, [needsStore]);

  const canDismiss = !!activeFranchiseName;

  useEffect(() => {
    // Global admins don't belong to any store
    if (!needsStore) return;
    // Already have an active franchise — nothing to do
    if (franchiseId) return;

    async function checkFranchises() {
      try {
        const res = await fetch("/api/stores");
        if (!res.ok) {
          setModalOpen(true);
          return;
        }
        const data = (await res.json()) as {
          franchises?: { _id: string; name: string }[];
        };
        const list = data.franchises ?? [];

        if (list.length === 1) {
          // Only one franchise — select it automatically, no popup needed
          const f = list[0];
          const selectRes = await fetch("/api/stores/select", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              franchiseId: f._id,
              franchiseName: f.name,
            }),
          });
          if (selectRes.ok) {
            setActiveFranchiseId(f._id);
            setActiveFranchiseName(f.name);
          } else {
            // Fallback: show the modal
            setModalOpen(true);
          }
        } else {
          // Zero or multiple franchises — show the picker
          setModalOpen(true);
        }
      } catch {
        setModalOpen(true);
      } finally {
        setAutoSelecting(false);
      }
    }

    void checkFranchises();
  }, [franchiseId, needsStore]);

  useEffect(() => {
    // Start inactivity timer whenever route changes or session is refreshed.
    const timer = globalThis.setTimeout(() => {
      setSessionPromptSecondsLeft(SESSION_PROMPT_DURATION_SECONDS);
      setSessionPromptOpen(true);
    }, SESSION_PROMPT_AFTER_MS);

    return () => {
      globalThis.clearTimeout(timer);
    };
  }, [pathname, sessionTimerVersion]);

  // Real user activity (typing, clicking, scrolling) should also push the timer out,
  // not just route changes — otherwise the warning fires while actively using a page.
  useEffect(() => {
    if (sessionPromptOpen) return;
    let lastReset = Date.now();
    function resetOnActivity() {
      const now = Date.now();
      if (now - lastReset < 30_000) return; // throttle
      lastReset = now;
      setSessionTimerVersion((value) => value + 1);
    }
    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"] as const;
    for (const eventName of events) {
      document.addEventListener(eventName, resetOnActivity, { passive: true });
    }
    return () => {
      for (const eventName of events) {
        document.removeEventListener(eventName, resetOnActivity);
      }
    };
  }, [sessionPromptOpen]);

  const logoutWithReturnPath = useCallback(
    async (reason?: "inactive") => {
      // Guard against duplicate redirects from overlapping timeout/effect paths.
      if (loggingOutRef.current) return;
      loggingOutRef.current = true;

      const returnTo = `${pathname}${globalThis.location.search}`;
      await logoutAndRedirectToLogin(router, returnTo, reason);
    },
    [pathname, router],
  );

  useEffect(() => {
    if (!sessionPromptOpen) return;
    // Visual countdown only; hard logout is enforced by the timeout below.
    const interval = globalThis.setInterval(() => {
      setSessionPromptSecondsLeft((prev) => {
        return prev > 0 ? prev - 1 : 0;
      });
    }, 1000);

    return () => {
      globalThis.clearInterval(interval);
    };
  }, [logoutWithReturnPath, sessionPromptOpen]);

  useEffect(() => {
    if (!sessionPromptOpen || isExtendingSession) return;

    // Fail-safe auto logout if user ignores the session prompt.
    const timeout = globalThis.setTimeout(() => {
      void logoutWithReturnPath("inactive");
    }, SESSION_PROMPT_DURATION_SECONDS * 1000);

    return () => {
      globalThis.clearTimeout(timeout);
    };
  }, [isExtendingSession, logoutWithReturnPath, sessionPromptOpen]);

  const handleExtendSession = useCallback(async () => {
    if (isExtendingSession) return;
    setIsExtendingSession(true);

    try {
      const response = await fetch("/api/auth/extend", { method: "POST" });
      if (!response.ok) {
        throw new Error("Session extension failed");
      }

      setSessionPromptOpen(false);
      setSessionTimerVersion((value) => value + 1);
    } catch {
      showError("Session expired. Please sign in again.");
      await logoutWithReturnPath();
    } finally {
      setIsExtendingSession(false);
    }
  }, [isExtendingSession, showError, logoutWithReturnPath]);

  function handleSelect(id: string, name: string) {
    setActiveFranchiseId(id);
    setActiveFranchiseName(name);
    setModalOpen(false);
    router.refresh();
  }

  const contextValue = useMemo(
    () => ({
      openStoreModal: () => setModalOpen(true),
      activeStoreId: activeFranchiseId || null,
    }),
    [activeFranchiseId],
  );

  return (
    <StoreModalContext.Provider value={contextValue}>
      <div className="flex min-h-screen bg-transparent">
        <div className="print:hidden">
          <Sidebar
            franchiseName={activeFranchiseName}
            userRole={userRole}
            userName={userName}
            storeCount={storeCount}
          />
        </div>
        <div className="min-w-0 flex-1 flex flex-col overflow-auto pt-14 md:pt-0 print:pt-0">
          {autoSelecting ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-brand-orange border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <main
              key={activeFranchiseId || "no-store"}
              className="mx-auto min-w-0 w-full max-w-[1440px] flex-1 px-4 py-5 md:px-8 md:py-8 print:max-w-none print:p-0"
            >
              {children}
            </main>
          )}
        </div>
      </div>

      <StoreSelectModal
        isOpen={modalOpen && needsStore}
        canDismiss={canDismiss}
        activeFranchiseId={activeFranchiseId}
        onSelect={handleSelect}
        onDismiss={() => setModalOpen(false)}
      />

      <SessionTimeoutModal
        isOpen={sessionPromptOpen}
        isExtending={isExtendingSession}
        secondsLeft={sessionPromptSecondsLeft}
        onLogout={logoutWithReturnPath}
        onContinue={handleExtendSession}
      />

      <UnsavedChangesGuard />
    </StoreModalContext.Provider>
  );
}
