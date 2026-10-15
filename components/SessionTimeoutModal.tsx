"use client";

interface SessionTimeoutModalProps {
  isOpen: boolean;
  isExtending: boolean;
  secondsLeft: number;
  onLogout: () => void;
  onContinue: () => void;
}

function formatSeconds(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function SessionTimeoutModal({
  isOpen,
  isExtending,
  secondsLeft,
  onLogout,
  onContinue,
}: Readonly<SessionTimeoutModalProps>) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45" aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-xl border border-brand-beige p-6">
        <h2 className="text-lg font-bold text-gray-900">Session Timeout</h2>
        <p className="mt-2 text-sm text-gray-600">
          Your session is about to expire. Do you want to continue your session?
        </p>
        <p className="mt-2 text-sm font-semibold text-brand-orange">
          Auto logout in {formatSeconds(secondsLeft)}
        </p>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onLogout}
            disabled={isExtending}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
          >
            Logout
          </button>
          <button
            type="button"
            onClick={onContinue}
            disabled={isExtending}
            className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-white hover:bg-brand-orange/90 disabled:opacity-80 disabled:cursor-not-allowed transition inline-flex items-center gap-2"
          >
            <span>Continue</span>
            {isExtending && (
              <span
                className="h-4 w-4 rounded-full border-2 border-white/70 border-t-transparent animate-spin"
                aria-label="Loading"
              />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
