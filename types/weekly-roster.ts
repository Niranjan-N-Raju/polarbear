export type WeeklyRosterShift = string;

export interface WeeklyRosterDay {
  date: string;
  shift: WeeklyRosterShift;
}

export interface WeeklyRosterEmployee {
  employeeId: string;
  days: WeeklyRosterDay[];
}

export interface WeeklyRosterData {
  weekStart: string;
  entries: WeeklyRosterEmployee[];
}

export interface PlannedRosterAssignment {
  employeeId: string;
  shift: string;
  shiftName: string;
  startTime: string;
  endTime: string;
}