"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/app/hooks/useToast";
import { EyeIcon, EyeSlashIcon } from "@/app/components/icons";
import {
  FieldError,
  fieldClass,
  focusFirstInvalidField,
} from "@/app/components/form-validation";
import type { CurrentUser } from "@/types/common";
import { profileRequest } from "../apicall/profile";
import { validateProfilePassword } from "../utils";

const ROLE_LABELS: Record<string, string> = {
  admin: "Super Admin",
  sub_admin: "Sub Admin",
  franchise_admin: "Store Admin",
  employee: "Employee",
};

export default function ProfilePage() {
  useEffect(() => { document.title = "Profile · Polar Bear"; }, []);
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  // Set when the account must replace an admin-issued password before using the app.
  // Markup is identical during hydration (loading spinner), so reading the URL here is safe.
  const [mustChangePassword, setMustChangePassword] = useState(
    () =>
      typeof globalThis.location !== "undefined" &&
      new URLSearchParams(globalThis.location.search).get("passwordChangeRequired") === "1",
  );

  // Name form
  const [name, setName] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState("");

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  // Field-level errors for password form
  const [currentPwError, setCurrentPwError] = useState("");
  const [newPwError, setNewPwError] = useState("");
  const [confirmPwError, setConfirmPwError] = useState("");

  // Password visibility toggles
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const { success, error } = useToast();
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    profileRequest("/api/me")
      .then((r) => r.json())
      .then((data: CurrentUser & { message?: string }) => {
        if ("message" in data) return;
        setMe(data);
        setName(data.name);
        if (data.mustChangePassword) setMustChangePassword(true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleNameSave(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setNameError("");

    // Validate name
    if (!name.trim()) {
      setNameError("Full name is required.");
      focusFirstInvalidField("profile-name-form");
      return;
    }

    setNameSaving(true);
    try {
      const res = await profileRequest("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        setNameError(data.message ?? "Failed to update name.");
        focusFirstInvalidField("profile-name-form");
        return;
      }
      setMe((prev) => (prev ? { ...prev, name } : prev));
      setNameError("");
      success("Name updated successfully.");
    } catch {
      setNameError("Network error. Please try again.");
    } finally {
      setNameSaving(false);
    }
  }

  async function handlePasswordSave(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();

    // Clear all field errors first
    setCurrentPwError("");
    setNewPwError("");
    setConfirmPwError("");

    const validationError = validateProfilePassword(currentPassword, newPassword, confirmPassword);
    if (validationError) {
      if (!currentPassword.trim()) setCurrentPwError(validationError);
      else if (!newPassword.trim() || newPassword.length < 12 || /uppercase|special|number|same as/i.test(validationError)) {
        setNewPwError(validationError);
      } else {
        setConfirmPwError(validationError);
      }
      focusFirstInvalidField("profile-password-form");
      return;
    }

    setPwSaving(true);
    try {
      const res = await profileRequest("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        const message = data.message ?? "Failed to update password.";
        if (/current password|incorrect/i.test(message)) {
          setCurrentPwError(message);
        } else {
          setNewPwError(message);
        }
        focusFirstInvalidField("profile-password-form");
        return;
      }
      // Clear all fields on success
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setCurrentPwError("");
      setNewPwError("");
      setConfirmPwError("");
      setShowCurrentPw(false);
      setShowNewPw(false);
      setShowConfirmPw(false);
      success("Password updated successfully.");
      if (mustChangePassword) {
        // Reload into the full app with the newly issued session.
        globalThis.location.assign("/dashboard");
        return;
      }
    } catch {
      error("Network error. Please try again.");
      // Clear all fields on network error
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setCurrentPwError("");
      setNewPwError("");
      setConfirmPwError("");
      setShowCurrentPw(false);
      setShowNewPw(false);
      setShowConfirmPw(false);
    } finally {
      setPwSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-brand-orange border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-brand-beige bg-white/80 p-6 shadow-[0_10px_30px_rgba(36,50,58,0.05)]">
        <p className="hidden text-xs font-semibold uppercase tracking-[0.18em] text-brand-teal sm:block">Account settings</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">My Profile</h2>
        <p className="mt-2 text-sm text-gray-500">
          Manage your account details
        </p>
      </div>

      {mustChangePassword && (
        <div
          role="alert"
          className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <p className="font-semibold">You must change your password before continuing.</p>
          <p className="mt-1">
            Your password was set by an administrator. Choose a new password below to unlock the rest of the app.
          </p>
        </div>
      )}

      {/* Two-column layout: left = identity card + update name, right = change password */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* LEFT column */}
        <div className="space-y-6">
          {/* Identity card */}
          <div className="bg-white rounded-2xl border border-brand-beige shadow-sm p-5 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-brand-orange/10 flex items-center justify-center text-brand-orange font-bold text-xl shrink-0">
              {me?.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 truncate">{me?.name}</p>
              <p className="text-sm text-gray-500 truncate">{me?.email}</p>
              <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-orange/10 text-brand-orange">
                {ROLE_LABELS[me?.role ?? ""] ?? me?.role}
              </span>
            </div>
          </div>

          {/* Update name */}
          <div className="bg-white rounded-2xl border border-brand-beige shadow-sm p-5 space-y-4">
            <h3 className="font-semibold text-gray-900">Update Name</h3>
            <form
              id="profile-name-form"
              method="post"
              onSubmit={handleNameSave}
              noValidate
              className="space-y-3"
            >
              <div>
                <label
                  htmlFor="profile-name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Full Name
                </label>
                <input
                  id="profile-name"
                  ref={nameRef}
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setNameError("");
                  }}
                  aria-invalid={Boolean(nameError)}
                  aria-describedby={nameError ? "profile-name-error" : undefined}
                  className={`w-full rounded-xl border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition ${fieldClass(Boolean(nameError), "border-brand-beige focus:border-brand-orange focus:ring-brand-orange/40")}`}
                />
                <FieldError id="profile-name-error" message={nameError} />
              </div>
              <button
                type="submit"
                disabled={nameSaving}
                className="w-full py-2.5 rounded-xl bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange/90 transition disabled:opacity-60"
              >
                {nameSaving ? "Saving…" : "Save Name"}
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT column — Change password */}
        <div className="bg-white rounded-2xl border border-brand-beige shadow-sm p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">Change Password</h3>
          <form
            id="profile-password-form"
            method="post"
            onSubmit={handlePasswordSave}
            noValidate
            className="space-y-3"
          >
            <div>
              <label
                htmlFor="profile-current-pw"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Current Password
              </label>
              <div className="relative">
                <input
                  id="profile-current-pw"
                  type={showCurrentPw ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    setCurrentPwError("");
                  }}
                  aria-invalid={Boolean(currentPwError)}
                  aria-describedby={currentPwError ? "profile-current-pw-error" : undefined}
                  placeholder="Enter current password"
                  className={`w-full rounded-xl border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition ${fieldClass(Boolean(currentPwError), "border-brand-beige focus:border-brand-orange focus:ring-brand-orange/40")}`}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw(!showCurrentPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition"
                >
                  {showCurrentPw ? <EyeSlashIcon /> : <EyeIcon />}
                </button>
              </div>
              <FieldError id="profile-current-pw-error" message={currentPwError} />
            </div>
            <div>
              <label
                htmlFor="profile-new-pw"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                New Password
              </label>
              <div className="relative">
                <input
                  id="profile-new-pw"
                  type={showNewPw ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setNewPwError("");
                  }}
                  aria-invalid={Boolean(newPwError)}
                  aria-describedby={newPwError ? "profile-new-pw-error" : undefined}
                  placeholder="Min. 12 characters with uppercase, number & special char"
                  className={`w-full rounded-xl border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition ${fieldClass(Boolean(newPwError), "border-brand-beige focus:border-brand-orange focus:ring-brand-orange/40")}`}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition"
                >
                  {showNewPw ? <EyeSlashIcon /> : <EyeIcon />}
                </button>
              </div>
              <FieldError id="profile-new-pw-error" message={newPwError} />
            </div>
            <div>
              <label
                htmlFor="profile-confirm-pw"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  id="profile-confirm-pw"
                  type={showConfirmPw ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setConfirmPwError("");
                  }}
                  aria-invalid={Boolean(confirmPwError)}
                  aria-describedby={confirmPwError ? "profile-confirm-pw-error" : undefined}
                  placeholder="Repeat new password"
                  className={`w-full rounded-xl border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition ${fieldClass(Boolean(confirmPwError), "border-brand-beige focus:border-brand-orange focus:ring-brand-orange/40")}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPw(!showConfirmPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition"
                >
                  {showConfirmPw ? <EyeSlashIcon /> : <EyeIcon />}
                </button>
              </div>
              <FieldError id="profile-confirm-pw-error" message={confirmPwError} />
            </div>
            <button
              type="submit"
              disabled={pwSaving}
              className="w-full py-2.5 rounded-xl bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange/90 transition disabled:opacity-60"
            >
              {pwSaving ? "Updating…" : "Update Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
