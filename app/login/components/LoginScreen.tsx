"use client";

import { useEffect, useState } from "react";
import { FieldError, fieldClass } from "@/app/components/form-validation";
import { ChevronRightIcon, EyeIcon, EyeSlashIcon } from "@/app/components/icons";
import { useLogin } from "../hooks/useLogin";

export function LoginScreen() {
  const loginState = useLogin();
  const [showPassword, setShowPassword] = useState(false);
  useEffect(() => { document.title = "Login · Polar Bear"; }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-brand-sand px-4 py-6 sm:px-8 sm:py-10">
      <div className="relative mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-5xl overflow-hidden rounded-[28px] border border-brand-beige bg-white shadow-[0_24px_70px_rgba(36,50,58,0.12)] sm:min-h-[calc(100vh-5rem)] lg:grid-cols-[0.95fr_1.05fr]">
        <aside className="relative hidden overflow-hidden bg-brand-teal p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full border-[32px] border-brand-yellow/40" />
          <div className="absolute -bottom-28 -left-20 h-72 w-72 rounded-full border-[46px] border-brand-orange/30" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-lg font-black text-brand-teal shadow-sm">PB</div>
              <span className="text-lg font-semibold tracking-wide">Polar Bear</span>
            </div>
            <div className="mt-24 max-w-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-yellow">Store operations</p>
              <h1 className="mt-4 text-4xl font-semibold leading-tight">Keep every shift moving.</h1>
              <p className="mt-5 text-sm leading-7 text-white/75">One focused workspace for people, attendance, inventory, and the details that keep your stores ready.</p>
            </div>
          </div>
          <p className="relative text-xs text-white/60">Polar Bear Management Platform · Secure workspace</p>
        </aside>

        <main className="flex items-center justify-center bg-white px-6 py-10 sm:px-12">
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
              <div className="mb-8">
                <p className="inline-block rounded-full bg-brand-orange/10 px-3 py-1 text-sm font-semibold uppercase tracking-[0.18em] text-brand-orange lg:rounded-none lg:bg-transparent lg:px-0 lg:py-0">Welcome back</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-gray-900">Sign in to your workspace</h2>
                <p className="mt-2 text-sm leading-6 text-gray-500">Use your account credentials to continue.</p>
              </div>

              {loginState.loggedOutDueToInactivity && <div className="mb-5 rounded-xl border border-brand-yellow bg-brand-yellow/20 px-4 py-3 text-sm text-gray-800">You were logged out due to inactivity. Please sign in again.</div>}

              <form id="login-form" method="post" onSubmit={(event) => { event.preventDefault(); void loginState.submit(); }} noValidate className="space-y-5">
                {loginState.formError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{loginState.formError}</div>}
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-700">Email address</label>
                  <div className="relative">
                    <svg className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <input id="email" name="email" type="email" autoComplete="email" value={loginState.email} onChange={(event) => loginState.setEmail(event.target.value)} aria-invalid={Boolean(loginState.emailError)} aria-describedby={loginState.emailError ? "login-email-error" : undefined} required placeholder="you@example.com" className={`w-full rounded-xl border bg-brand-sand/40 py-3 pl-11 pr-4 text-sm text-gray-900 placeholder-gray-400 transition focus:outline-none focus:ring-2 lg:bg-white ${fieldClass(Boolean(loginState.emailError), "border-brand-beige focus:border-brand-teal focus:ring-brand-teal/20 lg:border-gray-300")}`} />
                  </div>
                  <FieldError id="login-email-error" message={loginState.emailError} />
                </div>
                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-medium text-gray-700">Password</label>
                  <div className="relative">
                    <svg className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-12V7a4 4 0 10-8 0v2" />
                    </svg>
                    <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={loginState.password} onChange={(event) => loginState.setPassword(event.target.value)} aria-invalid={Boolean(loginState.passwordError)} aria-describedby={loginState.passwordError ? "login-password-error" : undefined} required placeholder="Enter your password" className={`w-full rounded-xl border bg-brand-sand/40 py-3 pl-11 pr-11 text-sm text-gray-900 placeholder-gray-400 transition focus:outline-none focus:ring-2 lg:bg-white ${fieldClass(Boolean(loginState.passwordError), "border-brand-beige focus:border-brand-teal focus:ring-brand-teal/20 lg:border-gray-300")}`} />
                    <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label={showPassword ? "Hide password" : "Show password"}>
                      {showPassword ? <EyeSlashIcon className="h-[18px] w-[18px]" /> : <EyeIcon className="h-[18px] w-[18px]" />}
                    </button>
                  </div>
                  <FieldError id="login-password-error" message={loginState.passwordError} />
                </div>
                <button type="submit" disabled={loginState.isPending} className="group mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-orange px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(244,117,33,0.22)] transition hover:bg-brand-orange/90 focus:outline-none focus:ring-2 focus:ring-brand-orange focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
                  {loginState.isPending ? "Signing in…" : (<>Sign in<ChevronRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" /></>)}
                </button>
              </form>
              <p className="mt-8 text-center text-xs text-gray-400">Protected access for authorized store teams.</p>
          </div>
        </main>
      </div>
    </div>
  );
}
