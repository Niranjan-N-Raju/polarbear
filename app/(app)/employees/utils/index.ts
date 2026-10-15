import { localDateValue } from "@/lib/date-utils";
import type { Employee, EmployeeForm, EmployeeFormErrors } from "@/types/employees";

export const EMPTY_EMPLOYEE_FORM: EmployeeForm = {
  name: "",
  phone: "",
  position: "",
  employmentType: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  emergencyContactRelationship: "",
  actualDob: "",
  dobInRecords: "",
  aadharNumber: "",
  panNumber: "",
  salary: "",
  bankAccountNumber: "",
  bankName: "",
  bankIfsc: "",
  bankBranch: "",
  dateOfJoining: "",
};

export function todayISO(): string {
  return localDateValue();
}

export function formatAadhar(value: string): string {
  return value.replace(/\D/g, "").slice(0, 12).replace(/(\d{4})(?=\d)/g, "$1 ");
}

export function formatPan(value: string): string {
  let formatted = "";
  for (const character of value.toUpperCase()) {
    const expectsLetter = formatted.length < 5 || formatted.length === 9;
    if (expectsLetter ? /[A-Z]/.test(character) : /\d/.test(character)) formatted += character;
    if (formatted.length === 10) break;
  }
  return formatted;
}

export function adultDateLimit(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 18);
  return localDateValue(date);
}

export function isBirthdayToday(employee: Employee): boolean {
  if (employee.role !== "employee" || !employee.actualDob) return false;
  const [, month, day] = employee.actualDob.slice(0, 10).split("-").map(Number);
  const today = new Date();
  return month === today.getMonth() + 1 && day === today.getDate();
}

export function formatExitDate(archivedAt?: string): string {
  if (!archivedAt) return "—";
  const exit = new Date(archivedAt);
  exit.setUTCDate(exit.getUTCDate() - 1);
  return exit.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function formatJoiningDate(dateOfJoining?: string): string {
  if (!dateOfJoining) return "—";
  return new Date(dateOfJoining).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function validateEmployeeForm(form: EmployeeForm): EmployeeFormErrors {
  const errors: EmployeeFormErrors = {};
  const latestAllowedDob = adultDateLimit();
  if (!form.name.trim()) errors.name = "Full name is required.";
  if (!form.phone) errors.phone = "Phone number is required.";
  else if (!/^\d{10}$/.test(form.phone)) errors.phone = "Phone number must be exactly 10 digits.";
  if (!form.position) errors.position = "Position is required.";
  if (!form.employmentType) errors.employmentType = "Employment type is required.";
  if (!form.dateOfJoining) errors.dateOfJoining = "Date of joining is required.";
  if (!form.actualDob) errors.actualDob = "Actual DOB is required.";
  else if (form.actualDob > latestAllowedDob) errors.actualDob = "Employee must be at least 18 years old.";
  if (!form.dobInRecords) errors.dobInRecords = "DOB in records is required.";
  else if (form.dobInRecords > latestAllowedDob) errors.dobInRecords = "Employee must be at least 18 years old.";
  if (!form.aadharNumber) errors.aadharNumber = "Aadhar number is required.";
  else if (!/^\d{4}\s\d{4}\s\d{4}$/.test(form.aadharNumber)) errors.aadharNumber = "Aadhar number must be 12 digits in 4-4-4 format.";
  if (!form.panNumber) errors.panNumber = "PAN is required.";
  else if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(form.panNumber)) errors.panNumber = "PAN must be 5 letters, 4 digits, and 1 letter.";
  if (!form.bankAccountNumber) errors.bankAccountNumber = "Account number is required.";
  else if (!/^\d+$/.test(form.bankAccountNumber)) errors.bankAccountNumber = "Account number must contain digits only.";
  if (!form.salary) errors.salary = "Monthly salary is required.";
  else if (!/^\d+$/.test(form.salary) || Number(form.salary) <= 0) errors.salary = "Salary must be greater than zero.";
  if (!form.bankName.trim()) errors.bankName = "Bank name is required.";
  if (!form.bankIfsc.trim()) errors.bankIfsc = "IFSC code is required.";
  if (!form.bankBranch.trim()) errors.bankBranch = "Branch name is required.";
  if (!form.emergencyContactName.trim()) errors.emergencyContactName = "Emergency contact name is required.";
  if (!form.emergencyContactPhone) errors.emergencyContactPhone = "Contact number is required.";
  else if (!/^\d{10}$/.test(form.emergencyContactPhone)) errors.emergencyContactPhone = "Contact number must be exactly 10 digits.";
  if (!form.emergencyContactRelationship) errors.emergencyContactRelationship = "Relationship is required.";
  return errors;
}
