/**
 * Bulk-imports historical daily sales from an Excel workbook (one sheet per month)
 * directly into MongoDB, with an interactive per-day confirmation before each write.
 *
 * Run: npx tsx scripts/import-sales.ts <path-to-file.xlsx> ["Store Name"] [--from=YYYY-MM-DD]
 *
 * --from restricts the import to dates on/after that cutoff (e.g. --from=2025-11-12
 * to skip everything already entered manually up to Nov 11).
 *
 * Expected columns per sheet (header row, case-insensitive):
 *   Date | Sale | Swiggy/Zomato | Paytm | Cash | Expenses | Handover cash | Charges | Total | Comments
 *
 * Column mapping:
 *   Date            -> date
 *   Sale            -> totalSale
 *   Swiggy/Zomato   -> swiggy (zomato is always stored as 0 — the sheet doesn't split them)
 *   Paytm           -> upi
 *   Charges         -> upiCharge
 *   Expenses        -> one expense line item named "General", amount = Expenses
 *   Cash            -> not trusted; `cash` is recomputed as totalSale - swiggy - upi (app's own formula)
 *   Handover cash    -> not trusted; `bankingCash` is recomputed as cash - totalExpenses
 *   Total, Comments are shown for context only and are not stored.
 *
 * Rows that already exist for a given store+date are auto-skipped (never overwritten,
 * never even prompted for). Every remaining day is shown and must be confirmed
 * individually before it's written to the database.
 *
 * Requires MONGODB_URI / MONGODB_DB in .env.local.
 */

import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });

// Refuse to run in production
if (process.env.NODE_ENV === "production") {
  console.error(
    "ERROR: Refusing to run the import script in a production environment.",
  );
  process.exit(1);
}

import mongoose from "mongoose";
import ExcelJS from "exceljs";
import { createInterface } from "node:readline/promises";

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB;
if (!MONGODB_URI || !MONGODB_DB) {
  console.error("MONGODB_URI and MONGODB_DB must be set in .env.local");
  process.exit(1);
}

const rawArgs = process.argv.slice(2);
const positional = rawArgs.filter((arg) => !arg.startsWith("--"));
const flags = Object.fromEntries(
  rawArgs
    .filter((arg) => arg.startsWith("--"))
    .map((arg) => {
      const [key, ...rest] = arg.slice(2).split("=");
      return [key, rest.join("=")];
    }),
);

const filePath = positional[0];
const storeName = positional[1] ?? "Store 1";
const fromDate = flags.from; // e.g. "2025-11-12"
const defaultYear = flags.year ? Number(flags.year) : undefined;
if (!filePath) {
  console.error('Usage: npx tsx scripts/import-sales.ts <path-to-file.xlsx> ["Store Name"] [--from=YYYY-MM-DD] [--year=YYYY]');
  process.exit(1);
}
if (fromDate && !/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
  console.error("--from must be in YYYY-MM-DD format.");
  process.exit(1);
}
if (flags.year && (!defaultYear || !Number.isInteger(defaultYear))) {
  console.error("--year must be a whole number, e.g. --year=2025.");
  process.exit(1);
}

const SaleExpenseSchema = new mongoose.Schema(
  { name: { type: String, required: true }, amount: { type: Number, required: true, min: 0 } },
  { _id: false },
);
const SaleSchema = new mongoose.Schema(
  {
    franchise: { type: mongoose.Schema.Types.ObjectId, ref: "Franchise", required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    totalSale: { type: Number, required: true, min: 0 },
    swiggy: { type: Number, required: true, min: 0 },
    zomato: { type: Number, required: true, min: 0 },
    upi: { type: Number, required: true, min: 0 },
    upiCharge: { type: Number, required: true, min: 0 },
    cash: { type: Number, required: true },
    expenses: { type: [SaleExpenseSchema], default: [] },
    totalExpenses: { type: Number, required: true, min: 0 },
    bankingCash: { type: Number, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
SaleSchema.index({ franchise: 1, date: 1 }, { unique: true });

const FranchiseSchema = new mongoose.Schema({
  name: String,
  createdBy: mongoose.Schema.Types.ObjectId,
});
const UserSchema = new mongoose.Schema({ role: String });

const Sale = mongoose.models.Sale ?? mongoose.model("Sale", SaleSchema);
const Franchise = mongoose.models.Franchise ?? mongoose.model("Franchise", FranchiseSchema);
const User = mongoose.models.User ?? mongoose.model("User", UserSchema);

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in value) return String(value.text ?? "").trim();
  if (typeof value === "object" && "result" in value) return String(value.result ?? "").trim();
  return String(value).trim();
}

function toNumber(value: ExcelJS.CellValue): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = cellText(value).replace(/,/g, "");
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Converts a Date cell or common string date formats to a YYYY-MM-DD string (local, no UTC shift). */
function toISODate(value: ExcelJS.CellValue): string | null {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const text = cellText(value);
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, day, month, year] = dmy;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return null;
}

const MONTH_NAMES = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** Resolves the sheet's month (1-12) and year from its name, e.g. "October" or "October 2025". */
function resolveSheetMonthYear(sheetName: string): { month: number; year: number | null } | null {
  const lower = sheetName.toLowerCase();
  const monthIndex = MONTH_NAMES.findIndex((name) => lower.includes(name) || lower.includes(name.slice(0, 3)));
  if (monthIndex === -1) return null;
  const yearMatch = sheetName.match(/\b(20\d{2})\b/);
  return { month: monthIndex + 1, year: yearMatch ? Number(yearMatch[1]) : null };
}

/** Resolves a day-only value like "19th" or "1" against the sheet's month/year. */
function resolveDayOnlyDate(value: ExcelJS.CellValue, sheetName: string): string | null {
  const text = cellText(value);
  const dayMatch = text.match(/^(\d{1,2})(st|nd|rd|th)?$/i);
  if (!dayMatch) return null;
  const day = Number(dayMatch[1]);
  if (day < 1 || day > 31) return null;
  const sheetMonth = resolveSheetMonthYear(sheetName);
  if (!sheetMonth) return null;
  const year = sheetMonth.year ?? defaultYear;
  if (!year) return null;
  return `${year}-${String(sheetMonth.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

interface Candidate {
  sheet: string;
  row: number;
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
  comment: string;
  expenseGap: number;
}

interface SkippedRow {
  sheet: string;
  row: number;
  reason: string;
}

interface HeaderCell {
  colNumber: number;
  text: string;
}

/** Reads header row 1 as an ordered list, since some sheets repeat "Date"/"Amount"/"Comments" for the side expense-breakup tables. */
function readHeaderCells(worksheet: ExcelJS.Worksheet): HeaderCell[] {
  const cells: HeaderCell[] = [];
  worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cells.push({ colNumber, text: cellText(cell.value).toLowerCase() });
  });
  return cells;
}

function firstHeaderCol(headers: HeaderCell[], ...labels: string[]): number | undefined {
  return headers.find((h) => labels.includes(h.text))?.colNumber;
}

/** Finds every side "Date | Amount | Comments" (in either order) expense-breakup block after the main table's Date column. */
function findExpenseBlocks(headers: HeaderCell[], mainDateCol: number): { dateCol: number; amountCol: number; nameCol: number }[] {
  const blocks: { dateCol: number; amountCol: number; nameCol: number }[] = [];
  for (let i = 0; i < headers.length; i += 1) {
    const header = headers[i];
    if (header.text !== "date" || header.colNumber === mainDateCol) continue;
    let amountCol: number | undefined;
    let nameCol: number | undefined;
    for (const candidate of [headers[i + 1], headers[i + 2]]) {
      if (!candidate) continue;
      if (candidate.text === "amount") amountCol = candidate.colNumber;
      if (candidate.text === "comments" || candidate.text === "comment") nameCol = candidate.colNumber;
    }
    if (amountCol && nameCol) blocks.push({ dateCol: header.colNumber, amountCol, nameCol });
  }
  return blocks;
}

/** Collects itemized expenses across every block/row in a sheet, grouped by resolved calendar date. Robust to Amount/Comments being swapped in a row. */
function collectItemizedExpenses(
  worksheet: ExcelJS.Worksheet,
  blocks: { dateCol: number; amountCol: number; nameCol: number }[],
): Map<string, { name: string; amount: number }[]> {
  const byDate = new Map<string, { name: string; amount: number }[]>();
  for (const block of blocks) {
    let currentDate: string | null = null;
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const dateValue = row.getCell(block.dateCol).value;
      // A blank date carries forward from the last filled date above it in this same table.
      const resolvedDate = toISODate(dateValue) ?? resolveDayOnlyDate(dateValue, worksheet.name);
      if (resolvedDate) currentDate = resolvedDate;
      const date = currentDate;
      if (!date) continue; // no date seen yet in this table — can't attribute this entry to a day

      const cellA = row.getCell(block.amountCol).value;
      const cellB = row.getCell(block.nameCol).value;
      // Determine amount vs name by actual value type, since some rows have them swapped relative to the header.
      const amount = typeof cellA === "number" ? cellA : typeof cellB === "number" ? cellB : 0;
      const name = (typeof cellA === "number" ? cellText(cellB) : cellText(cellA)) || cellText(typeof cellA === "number" ? cellB : cellA);
      if (!amount || amount <= 0 || !name) continue;

      const list = byDate.get(date) ?? [];
      list.push({ name, amount });
      byDate.set(date, list);
    }
  }
  return byDate;
}

async function run() {
  await mongoose.connect(MONGODB_URI as string, { dbName: MONGODB_DB });

  const franchise = await Franchise.findOne({ name: new RegExp(`^${storeName}$`, "i") });
  if (!franchise) {
    console.error(`Store "${storeName}" not found.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  let createdBy = franchise.createdBy as mongoose.Types.ObjectId | undefined;
  if (!createdBy) {
    const admin = await User.findOne({ role: "admin" }).select("_id");
    createdBy = admin?._id;
  }
  if (!createdBy) {
    console.error("Could not determine a user to attribute imported sales to (no store owner or admin found).");
    await mongoose.disconnect();
    process.exit(1);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const candidates: Candidate[] = [];
  const skippedInvalid: SkippedRow[] = [];

  for (const worksheet of workbook.worksheets) {
    const headers = readHeaderCells(worksheet);

    const dateCol = firstHeaderCol(headers, "date");
    const saleCol = firstHeaderCol(headers, "sale");
    const swiggyCol = firstHeaderCol(headers, "swiggy");
    const zomatoCol = firstHeaderCol(headers, "zomato");
    const combinedSwiggyZomatoCol = firstHeaderCol(headers, "swiggy/zomato", "swiggy / zomato");
    const paytmCol = firstHeaderCol(headers, "paytm");
    const expensesCol = firstHeaderCol(headers, "expenses");
    const chargesCol = firstHeaderCol(headers, "charges");
    const commentsCol = firstHeaderCol(headers, "comments");

    if (!dateCol || !saleCol) {
      console.warn(`Sheet "${worksheet.name}": couldn't find Date/Sale columns, skipping sheet.`);
      continue;
    }

    const expenseBlocks = findExpenseBlocks(headers, dateCol);
    const itemizedByDate = collectItemizedExpenses(worksheet, expenseBlocks);

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const dateValue = row.getCell(dateCol).value;
      const saleValue = row.getCell(saleCol).value;
      if (dateValue === null || dateValue === undefined || cellText(saleValue) === "") {
        continue; // blank/separator row
      }

      const date = toISODate(dateValue) ?? resolveDayOnlyDate(dateValue, worksheet.name);
      if (!date) {
        skippedInvalid.push({ sheet: worksheet.name, row: rowNumber, reason: `Unrecognized date value: "${cellText(dateValue)}"` });
        continue;
      }

      const totalSale = toNumber(saleValue);
      const swiggy = swiggyCol
        ? toNumber(row.getCell(swiggyCol).value)
        : combinedSwiggyZomatoCol
          ? toNumber(row.getCell(combinedSwiggyZomatoCol).value)
          : 0;
      const zomato = zomatoCol ? toNumber(row.getCell(zomatoCol).value) : 0;
      const upi = paytmCol ? toNumber(row.getCell(paytmCol).value) : 0;
      const upiCharge = chargesCol ? toNumber(row.getCell(chargesCol).value) : 0;
      const expenseAmount = expensesCol ? toNumber(row.getCell(expensesCol).value) : 0;
      const comment = commentsCol ? cellText(row.getCell(commentsCol).value) : "";

      if ([totalSale, swiggy, zomato, upi, upiCharge, expenseAmount].some((value) => value < 0)) {
        skippedInvalid.push({ sheet: worksheet.name, row: rowNumber, reason: "A required amount is negative." });
        continue;
      }

      const cash = totalSale - swiggy - zomato - upi;
      const totalExpenses = expenseAmount;
      const bankingCash = cash - totalExpenses;

      // Prefer the itemized breakup (real names) over a lump sum; reconcile against the day's trusted Expenses total.
      const itemized = itemizedByDate.get(date) ?? [];
      const itemizedTotal = itemized.reduce((sum, item) => sum + item.amount, 0);
      const expenseGap = totalExpenses - itemizedTotal; // >0: unexplained remainder; <0: itemized exceeds the sheet's total; 0: clean

      candidates.push({ sheet: worksheet.name, row: rowNumber, date, totalSale, swiggy, zomato, upi, upiCharge, cash, expenses: itemized, totalExpenses, bankingCash, comment, expenseGap });
    }
  }

  candidates.sort((a, b) => a.date.localeCompare(b.date));

  const beforeCutoff = fromDate ? candidates.filter((c) => c.date < fromDate) : [];
  const afterCutoff = fromDate ? candidates.filter((c) => c.date >= fromDate) : candidates;

  const existingDates = new Set(
    (
      await Sale.find({ franchise: franchise._id, date: { $in: afterCutoff.map((c) => c.date) } })
        .select("date")
        .lean()
    ).map((doc) => (doc as unknown as { date: string }).date),
  );
  const alreadyExists = afterCutoff.filter((c) => existingDates.has(c.date));
  const toReview = afterCutoff.filter((c) => !existingDates.has(c.date));

  console.log(`Store: ${franchise.name}`);
  console.log(`Rows parsed: ${candidates.length}`);
  if (fromDate) console.log(`Skipped (before ${fromDate}): ${beforeCutoff.length}`);
  console.log(`Skipped (already in database): ${alreadyExists.length}`);
  console.log(`Skipped (invalid): ${skippedInvalid.length}`);
  console.log(`Awaiting your confirmation: ${toReview.length}\n`);

  if (flags["dry-run"] !== undefined) {
    console.log("Dry run — no prompts, nothing written. Rows that would be reviewed:");
    for (const candidate of toReview) {
      const gapNote = candidate.expenseGap > 0 ? ` ⚠ ₹${candidate.expenseGap} unexplained` : candidate.expenseGap < 0 ? ` ⚠ itemized exceeds total by ₹${-candidate.expenseGap}` : "";
      console.log(`  ${candidate.date} (sheet "${candidate.sheet}", row ${candidate.row}) — Sale: ${candidate.totalSale}, Swiggy: ${candidate.swiggy}, Zomato: ${candidate.zomato}, Expenses: ${candidate.totalExpenses} [${candidate.expenses.map((item) => `${item.name}=${item.amount}`).join(", ")}]${gapNote}`);
    }
    if (skippedInvalid.length > 0) {
      console.log("\nInvalid rows:");
      for (const item of skippedInvalid) {
        console.log(`  - [${item.sheet}] row ${item.row}: ${item.reason}`);
      }
    }
    await mongoose.disconnect();
    return;
  }

  let inserted = 0;
  let skippedByUser = 0;
  let aborted = false;
  const differenceLog: { date: string; note: string }[] = [];

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  for (const candidate of toReview) {
    let finalExpenses = candidate.expenses;
    let finalTotalExpenses = candidate.totalExpenses;
    let finalBankingCash = candidate.bankingCash;
    let skipThisDay = false;

    if (candidate.expenseGap > 0) {
      // Unexplained remainder — auto-label it "General" rather than asking every time.
      finalExpenses = [...candidate.expenses, { name: "General", amount: candidate.expenseGap }];
      differenceLog.push({ date: candidate.date, note: `₹${candidate.expenseGap} labeled "General"` });
    } else if (candidate.expenseGap < 0) {
      console.log(`\n${candidate.date} (sheet "${candidate.sheet}", row ${candidate.row})`);
      if (candidate.expenses.length > 0) {
        console.log(`  Itemized: ${candidate.expenses.map((item) => `${item.name}=${item.amount}`).join(", ")}`);
      }
      if (candidate.comment) console.log(`  Comment: ${candidate.comment}`);

      const excess = -candidate.expenseGap;
      const itemizedTotal = candidate.totalExpenses - candidate.expenseGap;
      console.log(`  ⚠ Itemized expenses (₹${itemizedTotal}) exceed the sheet's Expenses total (₹${candidate.totalExpenses}) by ₹${excess}.`);
      const answer = (await rl.question(`  Enter the correct total, or Enter to use ₹${itemizedTotal}, 'skip' this day, 'quit': `)).trim();
      if (answer.toLowerCase() === "quit" || answer.toLowerCase() === "q") {
        aborted = true;
        differenceLog.push({ date: candidate.date, note: "quit before resolving" });
        break;
      } else if (answer.toLowerCase() === "skip" || answer.toLowerCase() === "n") {
        skipThisDay = true;
        differenceLog.push({ date: candidate.date, note: "skipped" });
      } else {
        let overrideTotal = answer ? Number(answer) : itemizedTotal;
        let attempts = 0;
        // Guard against typos/echo glitches producing an implausible amount (e.g. a doubled-up number).
        while (Number.isFinite(overrideTotal) && overrideTotal > candidate.totalSale && attempts < 3) {
          const confirm = (await rl.question(`  ₹${overrideTotal} is more than the day's Sale (₹${candidate.totalSale}) — that looks like a typo. Re-enter the total, or 'skip': `)).trim();
          if (confirm.toLowerCase() === "skip" || confirm.toLowerCase() === "n") { overrideTotal = NaN; break; }
          overrideTotal = confirm ? Number(confirm) : itemizedTotal;
          attempts += 1;
        }
        if (!Number.isFinite(overrideTotal) || overrideTotal < 0) {
          console.log("  Invalid amount, skipping this day.");
          skipThisDay = true;
          differenceLog.push({ date: candidate.date, note: "skipped (invalid override amount entered)" });
        } else {
          finalTotalExpenses = overrideTotal;
          finalBankingCash = candidate.cash - overrideTotal;
          differenceLog.push({ date: candidate.date, note: `total set to ₹${overrideTotal}` });
        }
      }
    }

    if (skipThisDay) {
      skippedByUser += 1;
      continue;
    }

    try {
      await Sale.create({
        franchise: franchise._id,
        date: candidate.date,
        totalSale: candidate.totalSale,
        swiggy: candidate.swiggy,
        zomato: candidate.zomato,
        upi: candidate.upi,
        upiCharge: candidate.upiCharge,
        cash: candidate.cash,
        expenses: finalExpenses,
        totalExpenses: finalTotalExpenses,
        bankingCash: finalBankingCash,
        createdBy,
      });
      inserted += 1;
      if (candidate.expenseGap !== 0) console.log("  ✓ Saved.");
    } catch (err) {
      if (typeof err === "object" && err !== null && "code" in err && (err as { code?: number }).code === 11000) {
        console.log(`  ✗ ${candidate.date} already exists, skipped.`);
      } else {
        console.log(`  ✗ ${candidate.date} failed to save: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  rl.close();

  console.log("\nImport finished.");
  if (aborted) console.log("(Stopped early at your request — remaining rows were not reviewed.)");
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Skipped by you: ${skippedByUser}`);
  console.log(`  Skipped (already existed): ${alreadyExists.length}`);
  if (fromDate) console.log(`  Skipped (before cutoff): ${beforeCutoff.length}`);
  console.log(`  Skipped (invalid): ${skippedInvalid.length}`);
  if (skippedInvalid.length > 0) {
    console.log("\nInvalid rows:");
    for (const item of skippedInvalid) {
      console.log(`  - [${item.sheet}] row ${item.row}: ${item.reason}`);
    }
  }
  if (differenceLog.length > 0) {
    console.log("\nDates with expense differences:");
    for (const item of differenceLog) {
      console.log(`  - ${item.date}: ${item.note}`);
    }
  }

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
