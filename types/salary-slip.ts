export interface SalarySlipAdvance {
  type: string;
  amount: number;
}

export interface SalarySlipIncentive {
  type: string;
  amount: number;
  paidEarly?: boolean;
}

export interface SalarySlipExtraDay {
  type: string;
  days: number;
}

export interface SalarySlipData {
  store: { name: string; address: string; phone: string; logoUrl: string };
  period: string;
  periodLabel: string;
  employee: {
    name: string;
    position: string;
    employmentType: string;
    bankName: string;
    bankAccountNumber: string;
    bankIfsc: string;
    panNumber: string;
  };
  attendance: {
    totalWorkingDays: number;
    presentDays: number;
    weekOffDays: number;
    absentDays: number;
    extraDays: SalarySlipExtraDay[];
    extraDaysTotal: number;
  };
  earnings: {
    basicSalary: number;
    grossEarnings: number;
  };
  deductions: {
    advances: SalarySlipAdvance[];
    advanceTotal: number;
    paidEarlyIncentiveTotal?: number;
    totalDeductions: number;
  };
  incentives: SalarySlipIncentive[];
  incentiveTotal: number;
  netPay: number;
}
