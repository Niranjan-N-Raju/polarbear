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
  // sessionStorage is cleared when the tab closes. Storage can throw (private mode,
  // blocked storage); that must never prevent the logout request or redirect.
  try {
    if (shouldRememberReturnTo) {
      globalThis.sessionStorage.setItem("em_return_to", returnTo);
    } else {
      globalThis.sessionStorage.removeItem("em_return_to");
    }
  } catch {
    // Ignore storage failures.
  }

  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // Network failure: still send the user to the login page.
  } finally {
    const loginUrl = new URL("/login", globalThis.location.origin);
    if (shouldRememberReturnTo) {
      loginUrl.searchParams.set("next", returnTo);
      loginUrl.searchParams.set("reason", "inactive");
    }
    router.push(`${loginUrl.pathname}${loginUrl.search}`);
  }
}
