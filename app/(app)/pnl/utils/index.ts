export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export function formatPeriodLabel(period: string): string {
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(
    new Date(`${period}-01T00:00:00`),
  );
}

export function formatRangeLabel(from: string, to: string): string {
  const fromLabel = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(`${from}T00:00:00`));
  const toLabel = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${to}T00:00:00`));
  return `${fromLabel} – ${toLabel}`;
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? "" : "−"}${Math.abs(value).toFixed(1)}%`;
}
