import { redirect } from "next/navigation";
import { getAuthInfo } from "@/lib/auth";
import ProductsPageView from "./ProductsPageView";

export default async function ProductsPage() {
  const auth = await getAuthInfo();
  if (auth?.role !== "admin") redirect("/dashboard");

  return <ProductsPageView />;
}