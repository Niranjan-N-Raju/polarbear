"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/app/hooks/useToast";
import type { SalarySlipData } from "@/types/salary-slip";
import { salaryRequest } from "../../apicall/salary";
import { formatCurrency } from "../../utils";

function Row({ label, value }: Readonly<{ label: string; value: React.ReactNode }>) {
  return (
    <div className="flex border-b border-gray-300">
      <span className="w-1/2 border-r border-gray-300 px-3 py-1.5 font-medium text-gray-700">{label}</span>
      <span className="w-1/2 px-3 py-1.5 text-gray-900">{value}</span>
    </div>
  );
}

export default function SalarySlipPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { error } = useToast();
  const franchiseId = searchParams.get("franchiseId") ?? "";
  const employeeId = searchParams.get("employeeId") ?? "";
  const period = searchParams.get("period") ?? "";
  const [data, setData] = useState<SalarySlipData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSlip = useCallback(async () => {
    if (!franchiseId || !employeeId || !period) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await salaryRequest(
        `/api/salary/slip?franchiseId=${encodeURIComponent(franchiseId)}&employeeId=${encodeURIComponent(employeeId)}&period=${encodeURIComponent(period)}`,
      );
      const result = (await response.json()) as SalarySlipData & { message?: string };
      if (!response.ok) throw new Error(result.message ?? "Failed to load salary slip.");
      setData(result);
    } catch (loadError) {
      error(loadError instanceof Error ? loadError.message : "Failed to load salary slip.");
    } finally {
      setLoading(false);
    }
  }, [franchiseId, employeeId, period, error]);

  useEffect(() => {
    document.title = "Salary Slip · Polar Bear";
    queueMicrotask(() => void loadSlip());
  }, [loadSlip]);

  if (loading) {
    return <p className="px-6 py-14 text-center text-sm text-gray-500">Loading…</p>;
  }
  if (!data) {
    return <p className="px-6 py-14 text-center text-sm text-gray-500">Salary slip not available.</p>;
  }

  const dash = (value: string) => (value ? value : "—");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-brand-sand"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => globalThis.window.print()}
          className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-medium text-white hover:bg-brand-orange/90"
        >
          Print / Save as PDF
        </button>
      </div>

      <div className="mx-auto max-w-2xl border border-gray-400 bg-white text-sm print:border-black">
        <div className="border-b border-gray-400 bg-brand-sand/60 px-4 py-3 text-center print:bg-white">
          {data.store.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.store.logoUrl} alt={`${data.store.name} logo`} className="mx-auto mb-2 h-12 w-auto object-contain" />
          )}
          <p className="text-lg font-bold uppercase tracking-wide text-gray-900">{data.store.name} – Salary Slip</p>
          {data.store.address && <p className="mt-1 whitespace-pre-line text-xs text-gray-600">{data.store.address}</p>}
        </div>

        <div>
          <Row label="Employee Name" value={data.employee.name} />
          <Row label="Bank Name" value={dash(data.employee.bankName)} />
          <Row label="PAN No" value={dash(data.employee.panNumber)} />
          <Row label="Account No" value={dash(data.employee.bankAccountNumber)} />
          <Row label="Designation" value={dash(data.employee.position)} />
          <Row label="Pay Month" value={data.periodLabel} />
        </div>

        <div className="flex border-b border-gray-400 bg-brand-sand/30 text-xs font-semibold uppercase tracking-wide text-gray-600 print:bg-white">
          <span className="w-1/2 border-r border-gray-300 px-3 py-1.5">Attendance</span>
          <span className="w-1/2 px-3 py-1.5"></span>
        </div>
        <Row label="Total Working Days" value={data.attendance.totalWorkingDays} />
        <Row label="Present Days" value={data.attendance.presentDays} />
        <Row label="Absent Days" value={data.attendance.absentDays} />
        <Row label="Extra Days" value={data.attendance.extraDaysTotal} />

        <div className="flex border-b border-gray-400">
          <div className="w-1/2 border-r border-gray-300">
            <p className="border-b border-gray-300 bg-brand-sand/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600 print:bg-white">Earnings</p>
            <div className="flex justify-between border-b border-gray-200 px-3 py-1.5"><span>Basic Salary</span><span>{formatCurrency(data.earnings.basicSalary)}</span></div>
            <div className="flex justify-between border-b border-gray-200 px-3 py-1.5 text-gray-400"><span>HRA</span><span>—</span></div>
            <div className="flex justify-between border-b border-gray-200 px-3 py-1.5 text-gray-400"><span>Conveyance</span><span>—</span></div>
            <div className="flex justify-between border-b border-gray-200 px-3 py-1.5 text-gray-400"><span>Special Allowance</span><span>—</span></div>
            <div className="flex justify-between px-3 py-1.5 text-gray-400"><span>Other Allowance</span><span>—</span></div>
          </div>
          <div className="w-1/2">
            <p className="border-b border-gray-300 bg-brand-sand/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600 print:bg-white">Deductions</p>
            <div className="flex justify-between border-b border-gray-200 px-3 py-1.5 text-gray-400"><span>PF</span><span>—</span></div>
            <div className="flex justify-between border-b border-gray-200 px-3 py-1.5 text-gray-400"><span>ESI</span><span>—</span></div>
            <div className="flex justify-between border-b border-gray-200 px-3 py-1.5 text-gray-400"><span>Professional Tax</span><span>—</span></div>
            <div className="flex justify-between border-b border-gray-200 px-3 py-1.5 text-gray-400"><span>Income Tax</span><span>—</span></div>
            <div className="flex justify-between px-3 py-1.5"><span>Other Deduction</span><span>{data.deductions.advanceTotal > 0 ? formatCurrency(data.deductions.advanceTotal) : "—"}</span></div>
          </div>
        </div>
        <div className="flex border-b border-gray-400 font-semibold">
          <div className="flex w-1/2 justify-between border-r border-gray-300 px-3 py-1.5"><span>Gross Earnings</span><span>{formatCurrency(data.earnings.grossEarnings)}</span></div>
          <div className="flex w-1/2 justify-between px-3 py-1.5"><span>Total Deductions</span><span>{formatCurrency(data.deductions.totalDeductions)}</span></div>
        </div>

        <div className="border-b border-gray-400">
          <p className="border-b border-gray-300 bg-brand-sand/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600 print:bg-white">Incentives</p>
          {data.incentives.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-400">No incentives this period.</p>
          ) : (
            data.incentives.map((incentive, index) => (
              <div key={`${incentive.type}-${index}`} className="flex justify-between border-b border-gray-200 px-3 py-1.5 last:border-0">
                <span>{incentive.type}</span>
                <span>{formatCurrency(incentive.amount)}</span>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-between bg-brand-sand/50 px-3 py-2.5 text-base font-bold text-gray-900 print:bg-white">
          <span>Net Pay</span>
          <span>{formatCurrency(data.netPay)}</span>
        </div>

        <div className="px-4 py-8 text-right">
          <p className="font-bold text-gray-900">{data.store.name}</p>
        </div>
      </div>
    </div>
  );
}
