/**
 * Shared browser fetch for app API calls. Handles session-level failures globally:
 * 401 -> redirect to /login (with return path); 403 PASSWORD_CHANGE_REQUIRED -> /profile.
 */
let redirecting = false;

function currentPath(): string {
  const { pathname, search } = globalThis.location;
  return `${pathname}${search}`;
}

function redirectTo(url: string) {
  if (redirecting) return;
  redirecting = true;
  globalThis.location.assign(url);
}

async function handleSessionFailure(response: Response): Promise<void> {
  if (typeof globalThis.window === "undefined" || !globalThis.location) return;
  if (response.status === 401) {
    if (globalThis.location.pathname === "/login") return;
    const loginUrl = new URL("/login", globalThis.location.origin);
    loginUrl.searchParams.set("next", currentPath());
    redirectTo(`${loginUrl.pathname}${loginUrl.search}`);
    return;
  }
  if (response.status === 403 && !globalThis.location.pathname.startsWith("/profile")) {
    try {
      const data = (await response.clone().json()) as { code?: string };
      if (data?.code === "PASSWORD_CHANGE_REQUIRED") {
        redirectTo("/profile?passwordChangeRequired=1");
      }
    } catch {
      // Non-JSON 403 bodies are handled by the caller.
    }
  }
}

export async function appFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  if (response.status === 401 || response.status === 403) {
    await handleSessionFailure(response);
  }
  return response;
}
