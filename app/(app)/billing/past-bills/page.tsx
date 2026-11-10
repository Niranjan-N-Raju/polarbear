import { redirect } from "next/navigation";
import { getAuthInfo } from "@/lib/auth";
import { businessDateValue } from "@/lib/date-utils";
import PastBillsPageView from "../components/PastBillsPageView";

export default async function PastBillsPage() {
  const auth = await getAuthInfo();
  if (auth?.role !== "franchise_admin") redirect("/dashboard");
  return <PastBillsPageView today={businessDateValue()} />;
}