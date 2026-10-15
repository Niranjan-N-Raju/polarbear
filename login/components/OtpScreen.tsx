"use client";

import { useEffect, useRef } from "react";
import { FieldError } from "@/app/components/form-validation";
import { ChevronLeftDoubleIcon, ChevronRightIcon } from "@/app/components/icons";

export function OtpScreen({
  otp,
  otpError,
  isVerifyingOtp,
  onChange,
  onSubmit,
  onBack,
}: Readonly<{
  otp: string;
  otpError: string;
  isVerifyingOtp: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
}>) {
  const boxRefs = useRef<Array<HTMLInputElement | null>>([]);
  const autoSubmittedOtp = useRef<string | null>(null);

  useEffect(() => {
    boxRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (otp.length === 4 && autoSubmittedOtp.current !== otp) {
      autoSubmittedOtp.current = otp;
      onSubmit();
    }
  }, [otp, onSubmit]);

  function setDigit(index: number, digit: string) {
    const chars = otp.padEnd(4, " ").split("");
    chars[index] = digit;
    onChange(chars.join("").trimEnd());
  }

  function handleBoxChange(index: number, rawValue: string) {
    const digits = rawValue.replace(/\D/g, "");
    if (digits.length <= 1) {
      setDigit(index, digits);
      if (digits && index < 3) boxRefs.current[index + 1]?.focus();
      return;
    }
    // Handles pasting a full code into a single box.
    onChange(digits.slice(0, 4));
    boxRefs.current[Math.min(digits.length, 4) - 1]?.focus();
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !otp[index] && index > 0) {
      boxRefs.current[index - 1]?.focus();
    } else if (event.key === "ArrowLeft" && index > 0) {
      boxRefs.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < 3) {
      boxRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (!pasted) return;
    event.preventDefault();
    onChange(pasted);
    boxRefs.current[Math.min(pasted.length, 4) - 1]?.focus();
  }

  return (
    <div className="w-full max-w-md">
      <div className="relative -mx-6 -mt-10 mb-8 overflow-hidden bg-brand-teal px-6 pb-9 pt-8 text-white shadow-[0_18px_30px_-12px_rgba(0,0,0,0.35)] sm:-mx-12 lg:hidden">
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-sm font-black text-brand-teal shadow-sm">PB</div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-yellow">Polar Bear</p>
            <p className="text-base font-semibold">Store Operations</p>
          </div>
        </div>
      </div>
      <div className="mb-4 flex gap-1.5 lg:hidden">
        <span className="h-1 w-8 rounded-full bg-brand-orange" />
        <span className="h-1 w-5 rounded-full bg-brand-yellow" />
      </div>

      <button type="button" onClick={onBack} className="mb-6 hidden items-center gap-1.5 text-sm font-medium text-gray-500 transition hover:text-gray-700 lg:inline-flex">
        <ChevronLeftDoubleIcon className="h-4 w-4" />
        Back to sign in
      </button>

      <div className="mb-8">
        <p className="inline-block rounded-full bg-brand-orange/10 px-3 py-1 text-sm font-semibold uppercase tracking-[0.18em] text-brand-orange lg:rounded-none lg:bg-transparent lg:px-0 lg:py-0">Verify it&apos;s you</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-gray-900">Enter verification code</h2>
        <p className="mt-2 text-sm leading-6 text-gray-500">We sent a 4-digit code to your account. Enter it below to continue.</p>
      </div>

      <form
        id="otp-form"
        method="post"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        noValidate
        className="space-y-5"
      >
        <div>
          <label htmlFor="otp-1" className="mb-2 block text-sm font-medium text-gray-700">
            Verification code
          </label>
          <div className="flex justify-between gap-3">
            {[0, 1, 2, 3].map((index) => (
              <input
                key={index}
                id={`otp-${index + 1}`}
                ref={(element) => { boxRefs.current[index] = element; }}
                type="text"
                inputMode="numeric"
                autoComplete={index === 0 ? "one-time-code" : "off"}
                maxLength={1}
                value={otp[index] ?? ""}
                onChange={(event) => handleBoxChange(index, event.target.value)}
                onKeyDown={(event) => handleKeyDown(index, event)}
                onPaste={handlePaste}
                placeholder="0"
                aria-label={`Digit ${index + 1} of 4`}
                aria-invalid={Boolean(otpError)}
                aria-describedby={otpError ? "otp-error" : undefined}
                required
                className={`h-14 w-full rounded-xl border bg-brand-sand/40 text-center text-2xl font-semibold text-gray-900 placeholder-gray-300 transition focus:outline-none focus:ring-2 lg:bg-white ${otpError ? "border-red-400 focus:border-red-500 focus:ring-red-500/20" : "border-brand-beige focus:border-brand-teal focus:ring-brand-teal/20 lg:border-gray-300"}`}
              />
            ))}
          </div>
          <FieldError id="otp-error" message={otpError} />
          <p className="mt-2 text-xs text-gray-400">Demo mode: use 1234.</p>
        </div>
        <button
          type="submit"
          disabled={isVerifyingOtp}
          className="group mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-orange px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(244,117,33,0.22)] transition hover:bg-brand-orange/90 focus:outline-none focus:ring-2 focus:ring-brand-orange focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isVerifyingOtp ? "Verifying…" : (<>Verify &amp; continue<ChevronRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" /></>)}
        </button>
        <button type="button" onClick={onBack} className="w-full text-center text-sm font-medium text-gray-500 transition hover:text-gray-700 lg:hidden">
          Back to sign in
        </button>
      </form>
      <p className="mt-8 text-center text-xs text-gray-400">Protected access for authorized store teams.</p>
    </div>
  );
}
