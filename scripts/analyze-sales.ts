/**
 * Read-only analysis of a store's imported sales data — surfaces trends, expense
 * breakdowns, and anomalies worth a second look.
 *
 * Run: npx tsx scripts/analyze-sales.ts ["Store Name"]
 * Requires MONGODB_URI / MONGODB_DB in .env.local.
 */

import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });

import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB;
if (!MONGODB_URI || !MONGODB_DB) {
  console.error("MONGODB_URI and MONGODB_DB must be set in .env.local");
  process.exit(1);
}

const storeName = process.argv[2] ?? "Store 1";

const SaleExpenseSchema = new mongoose.Schema({ name: String, amount: Number }, { _id: false });
const SaleSchema = new mongoose.Schema({
  franchise: mongoose.Schema.Types.ObjectId,
  date: String,
  totalSale: Number,
  swiggy: Number,
  zomato: Number,
  upi: Number,
  upiCharge: Number,
  cash: Number,
  expenses: [SaleExpenseSchema],
  totalExpenses: Number,
  bankingCash: Number,
});
const FranchiseSchema = new mongoose.Schema({ name: String });

const Sale = mongoose.models.Sale ?? mongoose.model("Sale", SaleSchema);
const Franchise = mongoose.models.Franchise ?? mongoose.model("Franchise", FranchiseSchema);

interface SaleDoc {
  date: string;
  totalSale: number;
  swiggy: number;
  zomato: number;
  upi: number;
  upiCharge: number;
  cash: number;
  expenses: { name: string; amount: number }[];
  totalExpenses: number;
  bankingCash: number;
}

function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - avg) ** 2)));
}

function datesBetween(from: string, to: string): string[] {
  const dates: string[] = [];
  const current = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  while (current <= end) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, "0");
    const d = String(current.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

async function run() {
  await mongoose.connect(MONGODB_URI as string, { dbName: MONGODB_DB });

  const franchise = await Franchise.findOne({ name: new RegExp(`^${storeName}$`, "i") });
  if (!franchise) {
    console.error(`Store "${storeName}" not found.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const sales = (await Sale.find({ franchise: franchise._id }).sort({ date: 1 }).lean()) as unknown as SaleDoc[];
  if (sales.length === 0) {
    console.log(`No sales records found for "${storeName}".`);
    await mongoose.disconnect();
    return;
  }

  console.log(`=== Sales analysis for "${franchise.name}" ===`);
  console.log(`Records: ${sales.length} (${sales[0].date} to ${sales[sales.length - 1].date})\n`);

  // --- Overall totals ---
  const totalSale = sales.reduce((s, r) => s + r.totalSale, 0);
  const totalOnline = sales.reduce((s, r) => s + r.swiggy + r.zomato, 0);
  const totalUpi = sales.reduce((s, r) => s + r.upi, 0);
  const totalUpiCharge = sales.reduce((s, r) => s + r.upiCharge, 0);
  const totalExpenses = sales.reduce((s, r) => s + r.totalExpenses, 0);
  const totalCash = sales.reduce((s, r) => s + r.cash, 0);
  console.log("--- Overall ---");
  console.log(`Total sales: ₹${totalSale.toLocaleString("en-IN")}`);
  console.log(`Average daily sale: ₹${round(mean(sales.map((r) => r.totalSale)))}`);
  console.log(`Online (Swiggy+Zomato) share: ${round((totalOnline / totalSale) * 100)}%`);
  console.log(`UPI share: ${round((totalUpi / totalSale) * 100)}% | UPI charges: ₹${totalUpiCharge.toLocaleString("en-IN")} (${round((totalUpiCharge / totalUpi) * 100, 2)}% of UPI volume)`);
  console.log(`Cash share: ${round((totalCash / totalSale) * 100)}%`);
  console.log(`Total expenses: ₹${totalExpenses.toLocaleString("en-IN")} (${round((totalExpenses / totalSale) * 100)}% of sales)\n`);

  // --- Monthly trend ---
  const monthly = new Map<string, { sale: number; online: number; expenses: number; count: number }>();
  for (const r of sales) {
    const month = r.date.slice(0, 7);
    const entry = monthly.get(month) ?? { sale: 0, online: 0, expenses: 0, count: 0 };
    entry.sale += r.totalSale;
    entry.online += r.swiggy + r.zomato;
    entry.expenses += r.totalExpenses;
    entry.count += 1;
    monthly.set(month, entry);
  }
  const months = [...monthly.keys()].sort();
  console.log("--- Monthly trend ---");
  let prevSale: number | null = null;
  for (const month of months) {
    const m = monthly.get(month)!;
    const growth = prevSale !== null ? ` (${m.sale >= prevSale ? "+" : ""}${round(((m.sale - prevSale) / prevSale) * 100)}% MoM)` : "";
    console.log(`  ${month}: ₹${m.sale.toLocaleString("en-IN")} sales, ${round((m.online / m.sale) * 100)}% online, ${round((m.expenses / m.sale) * 100)}% expenses, ${m.count} days recorded${growth}`);
    prevSale = m.sale;
  }
  console.log();

  // --- Day-of-week pattern ---
  const byWeekday: number[][] = Array.from({ length: 7 }, () => []);
  for (const r of sales) {
    const day = new Date(`${r.date}T00:00:00`).getDay();
    byWeekday[day].push(r.totalSale);
  }
  console.log("--- Average sale by day of week ---");
  for (let day = 0; day < 7; day += 1) {
    if (byWeekday[day].length === 0) continue;
    console.log(`  ${WEEKDAY_NAMES[day]}: ₹${round(mean(byWeekday[day]))} avg (${byWeekday[day].length} days)`);
  }
  console.log();

  // --- Top expense categories ---
  const expenseByName = new Map<string, number>();
  for (const r of sales) {
    for (const item of r.expenses) {
      expenseByName.set(item.name, (expenseByName.get(item.name) ?? 0) + item.amount);
    }
  }
  const topExpenses = [...expenseByName.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log("--- Top expense categories ---");
  for (const [name, amount] of topExpenses) {
    console.log(`  ${name}: ₹${amount.toLocaleString("en-IN")} (${round((amount / totalExpenses) * 100)}% of total expenses)`);
  }
  console.log();

  // --- Missing days (gaps in the calendar with no sale record) ---
  const allDates = datesBetween(sales[0].date, sales[sales.length - 1].date);
  const recordedDates = new Set(sales.map((r) => r.date));
  const missingDates = allDates.filter((d) => !recordedDates.has(d));
  console.log(`--- Missing days: ${missingDates.length} of ${allDates.length} ---`);
  if (missingDates.length > 0 && missingDates.length <= 30) {
    console.log(`  ${missingDates.join(", ")}`);
  } else if (missingDates.length > 30) {
    console.log(`  (too many to list — first few: ${missingDates.slice(0, 10).join(", ")}...)`);
  }
  console.log();

  // --- Anomalies: sales far outside the norm (>2 standard deviations from the mean) ---
  const saleValues = sales.map((r) => r.totalSale);
  const avgSale = mean(saleValues);
  const sdSale = stddev(saleValues);
  const outliers = sales.filter((r) => Math.abs(r.totalSale - avgSale) > 2 * sdSale);
  console.log(`--- Sales outliers (>2 std dev from mean of ₹${round(avgSale)}) ---`);
  for (const r of outliers) {
    console.log(`  ${r.date}: ₹${r.totalSale.toLocaleString("en-IN")} (${r.totalSale > avgSale ? "unusually high" : "unusually low"})`);
  }
  console.log();

  // --- Expense ratio outliers ---
  const expenseRatios = sales.map((r) => (r.totalSale > 0 ? r.totalExpenses / r.totalSale : 0));
  const avgRatio = mean(expenseRatios);
  const sdRatio = stddev(expenseRatios);
  const highExpenseDays = sales.filter((r, i) => r.totalSale > 0 && expenseRatios[i] - avgRatio > 2 * sdRatio);
  console.log(`--- Days with unusually high expense ratio (avg ${round(avgRatio * 100)}%) ---`);
  for (const r of highExpenseDays) {
    console.log(`  ${r.date}: ${round((r.totalExpenses / r.totalSale) * 100)}% of sales spent on expenses (₹${r.totalExpenses})`);
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
