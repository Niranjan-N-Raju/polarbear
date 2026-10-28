import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAuthInfo } from "@/lib/auth";
import { LoginScreen } from "./components/LoginScreen";

export default async function LoginPage() {
  const auth = await getAuthInfo();
  if (auth) redirect(auth.mustChangePassword ? "/profile?passwordChangeRequired=1" : "/dashboard");

  return (
    <Suspense fallback={null}>
      <LoginScreen />
    </Suspense>
  );
}
