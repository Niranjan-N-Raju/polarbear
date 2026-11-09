import { redirect } from "next/navigation";
import { getAuthInfo } from "@/lib/auth";

export default async function ProductsPage() {
  const auth = await getAuthInfo();
  if (auth?.role !== "admin") redirect("/dashboard");

  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold text-gray-900">Products</h1>
      <p className="text-sm text-gray-500">
        Products will combine raw materials; product management is not set up yet.
      </p>
    </section>
  );
}