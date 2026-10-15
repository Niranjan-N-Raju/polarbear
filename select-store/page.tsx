import { redirect } from "next/navigation";

// Store selection is now handled via in-app modal (StoreSelectModal).
// If anyone navigates here directly, send them to the dashboard.
export default function SelectFranchisePage() {
  redirect("/dashboard");
}
