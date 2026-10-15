interface ClientRouter {
  push: (href: string) => void;
}

export async function logoutAndRedirectToLogin(
  router: ClientRouter,
  returnTo: string,
  reason?: "inactive",
) {
  const shouldRememberReturnTo = reason === "inactive";

  // Use sessionStorage instead of localStorage to reduce XSS exposure.
  // sessionStorage is cleared when the tab closes.
  if (shouldRememberReturnTo) {
    globalThis.sessionStorage.setItem("em_return_to", returnTo);
  } else {
    globalThis.sessionStorage.removeItem("em_return_to");
  }

  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } finally {
    const loginUrl = new URL("/login", globalThis.location.origin);
    if (shouldRememberReturnTo) {
      loginUrl.searchParams.set("next", returnTo);
      loginUrl.searchParams.set("reason", "inactive");
    }
    router.push(`${loginUrl.pathname}${loginUrl.search}`);
  }
}
