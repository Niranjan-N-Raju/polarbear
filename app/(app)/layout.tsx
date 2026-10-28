import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthInfo } from "@/lib/auth";
import AppShell from "./AppShell";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const franchiseId = cookieStore.get("em_franchise")?.value ?? "";
  const franchiseName = cookieStore.get("em_franchise_name")?.value ?? "";
  const auth = await getAuthInfo();
  if (!auth) redirect("/login");

  return (
    <AppShell
      franchiseId={franchiseId}
      initialFranchiseName={franchiseName}
      userRole={auth.role}
      userName={auth.name ?? ""}
      mustChangePassword={auth.mustChangePassword === true}
    >
      {children}
    </AppShell>
  );
}
