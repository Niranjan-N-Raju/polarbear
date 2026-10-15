export function getSafeNextPath(path: string | null): string | null {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.startsWith("/api/")) {
    return null;
  }
  return path;
}

export function validateLoginForm(email: string, password: string): {
  emailError: string;
  passwordError: string;
} {
  return {
    emailError: email.trim() ? "" : "Email address is required.",
    passwordError: password ? "" : "Password is required.",
  };
}
