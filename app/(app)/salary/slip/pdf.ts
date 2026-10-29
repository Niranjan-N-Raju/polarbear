import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { SalarySlipData } from "@/types/salary-slip";

const dash = (value: string) => value || "-";
// jsPDF's standard fonts don't have the ₹ glyph, which renders as a box and breaks text width/alignment.
const formatCurrency = (value: number) => `Rs. ${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;

async function loadLogoDataUrl(logoUrl: string): Promise<string | null> {
  try {
    const response = await fetch(logoUrl);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateSalarySlipPdf(data: SalarySlipData): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  let titleY = 50;

  if (data.store.logoUrl) {
    const logoDataUrl = await loadLogoDataUrl(data.store.logoUrl);
    if (logoDataUrl) {
      const logoHeight = 36;
      doc.addImage(logoDataUrl, pageWidth / 2 - 24, 20, 48, logoHeight);
      titleY = 20 + logoHeight + 16;
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`${data.store.name} - Salary Slip`, pageWidth / 2, titleY, { align: "center" });
  let headerBottomY = titleY + 24;
  if (data.store.address) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const addressLines = doc.splitTextToSize(data.store.address, pageWidth - margin * 2);
    doc.text(addressLines, pageWidth / 2, titleY + 16, { align: "center" });
    headerBottomY += addressLines.length * 10;
  }

  autoTable(doc, {
    startY: headerBottomY,
    margin: { left: margin, right: margin },
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 5 },
    body: [
      ["Employee Name", data.employee.name, "Bank Name", dash(data.employee.bankName)],
      ["PAN No", dash(data.employee.panNumber), "Account No", dash(data.employee.bankAccountNumber)],
      ["Designation", dash(data.employee.position), "Pay Month", data.periodLabel],
    ],
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 110 },
      2: { fontStyle: "bold", cellWidth: 110 },
    },
  });

  let cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  autoTable(doc, {
    startY: cursorY + 10,
    margin: { left: margin, right: margin },
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 5 },
    body: [
      ["Total Working Days", String(data.attendance.totalWorkingDays), "Present Days", String(data.attendance.presentDays)],
      ["Absent Days", String(data.attendance.absentDays), "Extra Days", String(data.attendance.extraDaysTotal)],
    ],
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 110 },
      2: { fontStyle: "bold", cellWidth: 110 },
    },
  });

  cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  autoTable(doc, {
    startY: cursorY + 10,
    margin: { left: margin, right: margin },
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 5 },
    head: [["Earnings", "Amount", "Deductions", "Amount"]],
    body: [
      ["Basic Salary", formatCurrency(data.earnings.basicSalary), "PF", "-"],
      ["HRA", "-", "ESI", "-"],
      ["Conveyance", "-", "Professional Tax", "-"],
      ["Special Allowance", "-", "Income Tax", "-"],
      ["Other Allowance", "-", "Other Deduction", data.deductions.advanceTotal > 0 ? formatCurrency(data.deductions.advanceTotal) : "-"],
      ...((data.deductions.paidEarlyIncentiveTotal ?? 0) > 0 ? [["", "", "Incentives already paid", formatCurrency(data.deductions.paidEarlyIncentiveTotal ?? 0)]] : []),
    ],
    foot: [["Gross Earnings", formatCurrency(data.earnings.grossEarnings), "Total Deductions", formatCurrency(data.deductions.totalDeductions)]],
    footStyles: { fontStyle: "bold", fillColor: [245, 240, 230], textColor: [20, 20, 20] },
    headStyles: { fillColor: [245, 240, 230], textColor: [20, 20, 20] },
  });

  cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  autoTable(doc, {
    startY: cursorY + 10,
    margin: { left: margin, right: margin },
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 5 },
    head: [["Incentives", "Amount"]],
    body:
      data.incentives.length > 0
        ? data.incentives.map((incentive) => [`${incentive.type}${incentive.paidEarly ? " (Paid early)" : ""}`, formatCurrency(incentive.amount)])
        : [["No incentives this period.", "-"]],
    headStyles: { fillColor: [245, 240, 230], textColor: [20, 20, 20] },
  });

  cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  autoTable(doc, {
    startY: cursorY + 10,
    margin: { left: margin, right: margin },
    theme: "grid",
    styles: { fontSize: 11, cellPadding: 7, fontStyle: "bold" },
    body: [["Net Pay", formatCurrency(data.netPay)]],
    columnStyles: { 1: { halign: "right" } },
  });

  cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(data.store.name, pageWidth - margin, cursorY + 50, { align: "right" });

  const fileName = `${data.employee.name.replaceAll(/\s+/g, "-")}-${data.period}-salary-slip.pdf`;
  doc.save(fileName);
}
