export interface Employee {
  _id: string;
  employeeCode?: string;
  name: string;
  phone?: string;
  position?: string;
  employmentType?: string;
  salary?: number;
  role: string;
  isActive: boolean;
  createdAt: string;
  actualDob?: string;
  dateOfJoining?: string;
  archivedAt?: string;
}

export interface EmployeeDocument {
  fileName: string;
  contentType: string;
  size: number;
}

export interface EmployeeDetails extends Employee {
  dobInRecords?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
  aadharNumber?: string;
  panNumber?: string;
  bankAccountNumber?: string;
  bankName?: string;
  bankIfsc?: string;
  bankBranch?: string;
  aadharDocument?: EmployeeDocument;
  panDocument?: EmployeeDocument;
}

export interface ActiveStore {
  id: string | null;
  name: string | null;
}

export type EmployeeForm = {
  name: string;
  phone: string;
  position: string;
  employmentType: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
  actualDob: string;
  dobInRecords: string;
  aadharNumber: string;
  panNumber: string;
  salary: string;
  bankAccountNumber: string;
  bankName: string;
  bankIfsc: string;
  bankBranch: string;
  dateOfJoining: string;
};

export type EmployeeFormErrors = Partial<Record<keyof EmployeeForm, string>>;
export type EmployeeFormStep = 1 | 2 | 3 | 4;
