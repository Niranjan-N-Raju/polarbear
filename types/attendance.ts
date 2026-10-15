export type AttendanceStatus = "Present" | "Week Off" | "Absent";

export interface AttendanceEmployee {
  _id: string;
  name: string;
  phone?: string;
  isActive?: boolean;
  dateOfJoining?: string;
  archivedAt?: string;
}

export interface AttendanceRecord {
  employeeId: string;
  date: string;
  status: AttendanceStatus;
  comment: string;
}

export interface AttendanceCycleRange {
  type: "calendar_month" | "custom";
  startDay: number;
  from: string;
  to: string;
}