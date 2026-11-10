"use client";

import { faPrint, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { formatINR, type SavedBill } from "@/lib/billing";

export function BillReceipt({ bill, onClose }: { bill: SavedBill; onClose?: () => void }) {
  return (
    <section className="space-y-5 rounded-xl border border-gray-200 bg-white p-6" aria-label={`Bill ${bill.billNumber}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4 print:hidden">
        <h2 className="font-semibold text-gray-900">Bill details</h2>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => window.print()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"><FontAwesomeIcon icon={faPrint} aria-hidden="true" /> Print receipt</button>
          {onClose && <button type="button" title="Close bill details" aria-label="Close bill details" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50"><FontAwesomeIcon icon={faXmark} aria-hidden="true" /></button>}
        </div>
      </div>
      <div className="billing-receipt mx-auto max-w-2xl space-y-4 border-y border-gray-200 py-6">
        <h2 className="break-words text-xl font-semibold">{bill.storeName}</h2>
        <h3 className="break-words text-lg font-semibold">Bill {bill.billNumber}</h3>
        <p className="text-sm text-gray-600">{new Date(bill.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</p>
        <p className="text-sm">{bill.orderType === "dineIn" ? "Dine-in" : "Takeaway"} / {bill.tableNumber ? `Token ${bill.tableNumber}` : "Token not recorded"}</p>
        {bill.customer && <div className="break-words text-sm"><p>{[bill.customer.firstName, bill.customer.middleName, bill.customer.lastName].filter(Boolean).join(" ")}</p><p>{bill.customer.mobile}</p></div>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-y border-gray-200 text-left"><tr><th className="py-2" scope="col">Product</th><th className="px-2 py-2 text-right" scope="col">Qty</th><th className="px-2 py-2 text-right" scope="col">Price</th><th className="py-2 text-right" scope="col">Amount</th></tr></thead>
            <tbody className="divide-y divide-gray-100">{bill.items.map((item) => <tr key={item.productId}><td className="max-w-40 break-words py-3">{item.name}</td><td className="px-2 py-3 text-right">{item.quantity}</td><td className="whitespace-nowrap px-2 py-3 text-right">{formatINR(item.unitPricePaise)}</td><td className="whitespace-nowrap py-3 text-right">{formatINR(item.amountPaise)}</td></tr>)}</tbody>
          </table>
        </div>
        <dl className="ml-auto max-w-xs space-y-2 border-t border-gray-200 pt-4 text-sm">
          <div className="flex justify-between gap-4"><dt>Subtotal</dt><dd>{formatINR(bill.subtotalPaise)}</dd></div>
          <div className="flex justify-between gap-4"><dt>GST ({bill.gstPercent}%)</dt><dd>{formatINR(bill.gstPaise)}</dd></div>
          <div className="flex justify-between gap-4 border-t border-gray-200 pt-3 text-base font-semibold"><dt>Total</dt><dd>{formatINR(bill.totalPaise)}</dd></div>
        </dl>
      </div>
    </section>
  );
}