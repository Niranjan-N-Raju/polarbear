import { redirect } from "next/navigation";
import { getAuthInfo } from "@/lib/auth";
import BillingPageView from "./components/BillingPageView";

export default async function BillingPage() {
  const auth = await getAuthInfo();
  if (auth?.role !== "franchise_admin") redirect("/dashboard");
  return <BillingPageView />;
}