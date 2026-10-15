export interface LoginResult {
  error?: string;
  success?: boolean;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = (await response.json()) as { message?: string };
    if (!response.ok) return { error: data.message || "Login failed. Please try again." };
    return { success: true };
  } catch {
    return { error: "Unable to reach the server. Please try again later." };
  }
}
