import { redirect } from "next/navigation";
import { getAuthInfo } from "@/lib/auth";
import RawMaterialsPage from "./components/RawMaterialsPage";

export default async function RawMaterialsRoute() {
  const auth = await getAuthInfo();
  if (auth?.role !== "admin") redirect("/dashboard");
  return <RawMaterialsPage />;
}