import { Suspense } from "react";
import SalarySlipPage from "./components/SalarySlipPage";

export default function SalarySlipRoute() {
  return (
    <Suspense fallback={null}>
      <SalarySlipPage />
    </Suspense>
  );
}
