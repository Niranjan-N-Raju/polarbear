"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { focusFirstInvalidField } from "@/app/components/form-validation";
import { login } from "../apicall/login";
import { getSafeNextPath, validateLoginForm } from "../utils/login";

export function useLogin() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [formError, setFormError] = useState("");
  const [isPending, setIsPending] = useState(false);

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
      globalThis.window.sessionStorage.setItem("em_login_success_toast", "1");
      globalThis.window.location.replace(queryNext ?? storedNext ?? "/dashboard");
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

  return {
    email,
    password,
    emailError,
    passwordError,
    formError,
    isPending,
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
    submit,
  };
}
