export interface IncentiveEntry {
  id: string;
  type: string;
  amount: number;
}

export interface ExtraDayEntry {
  id: string;
  type: string;
  days: number;
}

export interface AdvanceEntry {
  id: string;
  type: string;
  amount: number;
}

export interface SalaryProjection {
  employeeId: string;
  name: string;
  position: string;
  employmentType: string;
  salary: number;
  paidDays: number;
  absentDays: number;
  weekOffDays: number;
  missingDays: number;
  futureDays: number;
  eligibleDays: number;
  incentives: IncentiveEntry[];
  incentiveTotal: number;
  extraDays: ExtraDayEntry[];
  extraDaysTotal: number;
  advances: AdvanceEntry[];
  advanceTotal: number;
  earnedSalary: number;
  projectedSalary: number;
}

export interface SalaryData {
  store: { id: string; name: string };
  cycle: {
    configured: boolean;
    startDay: number;
    endDay: number;
    from: string;
    to: string;
    totalDays: number;
  };
  projections: SalaryProjection[];
}
