import { redirect } from "next/navigation";
import { getAuthInfo } from "@/lib/auth";
import ProductCategoriesPageView from "./components/ProductCategoriesPageView";

export default async function ProductCategoriesPage() {
  const auth = await getAuthInfo();
  if (auth?.role !== "admin") redirect("/dashboard");

  return <ProductCategoriesPageView />;
}