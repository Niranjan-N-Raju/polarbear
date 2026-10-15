export interface AttritionEmployeeInput {
  dateOfJoining?: Date | string | null;
  archivedAt?: Date | string | null;
  isActive?: boolean;
}

export interface MonthlyAttrition {
  month: string; // YYYY-MM
  monthLabel: string; // e.g. "Mar 2026"
  headcount: number;
  leavers: number;
  rate: number; // percentage, rounded to 1 decimal
}

function toUtcDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/** The employee's last active day is the day before archivedAt (see app/api/users/[id]/route.ts archive logic). */
function effectiveExitDate(archivedAt: Date): Date {
  return new Date(archivedAt.getTime() - 24 * 60 * 60 * 1000);
}

/**
 * Computes monthly attrition rate = (employees who left that month / headcount at the
 * start of that month) * 100, for the last `months` calendar months ending with the
 * current month. All comparisons use UTC to avoid local-timezone off-by-one bugs.
 */
export function computeMonthlyAttrition(
  employees: AttritionEmployeeInput[],
  months = 6,
  referenceDate: Date = new Date(),
): MonthlyAttrition[] {
  const anchorYear = referenceDate.getUTCFullYear();
  const anchorMonth = referenceDate.getUTCMonth();

  const results: MonthlyAttrition[] = [];
  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const monthStart = new Date(Date.UTC(anchorYear, anchorMonth - offset, 1));
    const monthEnd = new Date(Date.UTC(anchorYear, anchorMonth - offset + 1, 1));

    let headcount = 0;
    let leavers = 0;

    for (const employee of employees) {
      if (!employee.dateOfJoining) continue;
      const joinedAt = toUtcDate(employee.dateOfJoining);
      if (joinedAt >= monthEnd) continue; // hadn't joined yet by this month

      const archivedAt = employee.archivedAt ? toUtcDate(employee.archivedAt) : null;
      const exitedAt = archivedAt ? effectiveExitDate(archivedAt) : null;

      // Present at the start of the month: joined before it, and not yet exited.
      if (joinedAt < monthStart && (!exitedAt || exitedAt >= monthStart)) {
        headcount += 1;
      }

      // Left during this month.
      if (exitedAt && exitedAt >= monthStart && exitedAt < monthEnd) {
        leavers += 1;
      }
    }

    const monthLabel = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "UTC" }).format(monthStart);
    results.push({
      month: `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, "0")}`,
      monthLabel,
      headcount,
      leavers,
      rate: headcount > 0 ? Math.round((leavers / headcount) * 1000) / 10 : 0,
    });
  }

  return results;
}
