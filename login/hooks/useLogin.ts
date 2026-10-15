"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { focusFirstInvalidField } from "@/app/components/form-validation";
import { login } from "../apicall/login";
import { getSafeNextPath, validateLoginForm } from "../utils/login";

// Hardcoded until real OTP delivery (SMS/email) is wired up.
const DEMO_OTP = "1234";

export function useLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [formError, setFormError] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState("/dashboard");

  async function submit() {
    const validation = validateLoginForm(email, password);
    setEmailError(validation.emailError);
    setPasswordError(validation.passwordError);
    setFormError("");
    if (validation.emailError || validation.passwordError) {
      focusFirstInvalidField("login-form");
      return;
    }

    setIsPending(true);
    const result = await login(email, password);
    setIsPending(false);
    if (result.success) {
      const queryNext = getSafeNextPath(searchParams.get("next"));
      const storedNext = getSafeNextPath(globalThis.window.sessionStorage.getItem("em_return_to"));
      globalThis.window.sessionStorage.removeItem("em_return_to");
      setPendingRedirect(queryNext ?? storedNext ?? "/dashboard");
      setOtpStep(true);
      return;
    }

    const message = result.error ?? "Login failed. Please try again.";
    if (/email or password|password/i.test(message)) {
      setPasswordError(message);
      focusFirstInvalidField("login-form");
    } else if (/email/i.test(message)) {
      setEmailError(message);
      focusFirstInvalidField("login-form");
    } else {
      setFormError(message);
    }
  }

  async function verifyOtp() {
    if (!/^\d{4}$/.test(otp)) {
      setOtpError("Enter the 4-digit code.");
      return;
    }

    setIsVerifyingOtp(true);
    if (otp !== DEMO_OTP) {
      setIsVerifyingOtp(false);
      setOtpError("Incorrect code. Please try again.");
      return;
    }

    globalThis.window.sessionStorage.setItem("em_login_success_toast", "1");
    router.push(pendingRedirect);
  }

  return {
    email,
    password,
    emailError,
    passwordError,
    formError,
    isPending,
    otpStep,
    otp,
    otpError,
    isVerifyingOtp,
    loggedOutDueToInactivity: searchParams.get("reason") === "inactive",
    setEmail: (value: string) => {
      setEmail(value);
      setEmailError("");
      setFormError("");
    },
    setPassword: (value: string) => {
      setPassword(value);
      setPasswordError("");
      setFormError("");
    },
    setOtp: (value: string) => {
      setOtp(value);
      setOtpError("");
    },
    backToLogin: () => {
      setOtpStep(false);
      setOtp("");
      setOtpError("");
    },
    submit,
    verifyOtp,
  };
}
