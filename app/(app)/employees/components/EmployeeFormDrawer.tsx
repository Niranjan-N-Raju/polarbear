"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/app/hooks/useToast";
import {
  CopyIcon,
} from "@/app/components/icons";
import {
  FieldError,
  fieldClass,
  focusFirstInvalidField,
} from "@/app/components/form-validation";
import { DatePicker } from "@/app/components/DatePicker";
import { dateValueFromDate } from "@/lib/date-utils";
import { employeesRequest } from "../apicall/employees";
import type {
  ActiveStore,
  Employee,
  EmployeeDetails,
  EmployeeDocument,
  EmployeeForm,
  EmployeeFormErrors,
  EmployeeFormStep,
} from "@/types/employees";
import {
  EMPTY_EMPLOYEE_FORM,
  adultDateLimit,
  formatAadhar,
  formatPan,
  validateEmployeeForm,
} from "../utils";

const STEP_FIELDS: Record<EmployeeFormStep, Array<keyof EmployeeForm>> = {
  1: [
    "name",
    "phone",
    "position",
    "employmentType",
    "dateOfJoining",
    "actualDob",
    "dobInRecords",
  ],
  2: ["salary", "bankAccountNumber", "bankName", "bankIfsc", "bankBranch"],
  3: [
    "emergencyContactName",
    "emergencyContactPhone",
    "emergencyContactRelationship",
  ],
  4: ["aadharNumber", "panNumber"],
};

const EMPTY_FORM = EMPTY_EMPLOYEE_FORM;

interface EmployeeFormDrawerProps {
  activeStore: ActiveStore;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  employee?: Employee;
  editingEmployeeId?: string | null;
}

export default function EmployeeFormDrawer({
  activeStore,
  onClose,
  onSaved,
  employee,
  editingEmployeeId: editingEmployeeIdProp,
}: EmployeeFormDrawerProps) {
  const { error, success } = useToast();
  const editingEmployeeId = editingEmployeeIdProp ?? employee?._id ?? null;
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  // Drives the slide-in transition; flips to true a frame after mount.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loadingEmployeeDetails, setLoadingEmployeeDetails] = useState(Boolean(employee));
  const [fieldErrors, setFieldErrors] = useState<EmployeeFormErrors>({});
  const [loadedPositions, setLoadedPositions] = useState<{
    storeId: string;
    positions: string[];
  } | null>(null);
  const positionOptions = activeStore.id && loadedPositions?.storeId === activeStore.id
    ? loadedPositions.positions
    : [];
  const [currentStep, setCurrentStep] = useState<EmployeeFormStep>(1);
  const [aadharFile, setAadharFile] = useState<File | null>(null);
  const [panFile, setPanFile] = useState<File | null>(null);
  const [aadharDocument, setAadharDocument] = useState<EmployeeDocument | null>(null);
  const [panDocument, setPanDocument] = useState<EmployeeDocument | null>(null);
  const [documentErrors, setDocumentErrors] = useState<{
    aadhar?: string;
    pan?: string;
  }>({});
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setDrawerOpen(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const storeId = activeStore.id;
    if (!storeId) return;
    let cancelled = false;
    employeesRequest(`/api/stores/positions?franchiseId=${encodeURIComponent(storeId)}`)
      .then(async (response) => {
        const data = await response.json() as { positions?: string[]; message?: string };
        if (!response.ok) throw new Error(data.message ?? "Failed to load store positions.");
        if (!cancelled) setLoadedPositions({ storeId, positions: data.positions ?? [] });
      })
      .catch((loadError: unknown) => {
        if (!cancelled) error(loadError instanceof Error ? loadError.message : "Failed to load store positions.");
      });
    return () => {
      cancelled = true;
    };
  }, [activeStore.id, error]);

  useEffect(() => {
    let cancelled = false;
    const raf = requestAnimationFrame(() => {
      if (cancelled) return;
      setLoadingEmployeeDetails(Boolean(employee));
      setFieldErrors({});
      setCurrentStep(1);
      setAadharFile(null);
      setPanFile(null);
      setAadharDocument(null);
      setPanDocument(null);
      setDocumentErrors({});
      setForm(
        employee
          ? {
              ...EMPTY_FORM,
              name: employee.name,
              phone: employee.phone ?? "",
              position: employee.position ?? "",
              employmentType: employee.employmentType ?? "",
              dateOfJoining: employee.dateOfJoining
                ? dateValueFromDate(employee.dateOfJoining)
                : "",
            }
          : EMPTY_FORM,
      );
      setTimeout(() => nameRef.current?.focus(), 50);

      if (!employee) return;
      employeesRequest(`/api/users/${employee._id}`)
        .then(async (response) => {
          const data = (await response.json()) as {
            user?: EmployeeDetails;
            message?: string;
          };
          if (cancelled) return;
          if (!response.ok || !data.user) {
            error(data.message ?? "Failed to load employee details.");
            return;
          }

          const details = data.user;
          setAadharDocument(details.aadharDocument ?? null);
          setPanDocument(details.panDocument ?? null);
          setForm({
            name: details.name ?? "",
            phone: details.phone ?? "",
            position: details.position ?? "",
            employmentType: details.employmentType ?? "",
            emergencyContactName: details.emergencyContactName ?? "",
            emergencyContactPhone: details.emergencyContactPhone ?? "",
            emergencyContactRelationship: details.emergencyContactRelationship ?? "",
            actualDob: details.actualDob ? dateValueFromDate(details.actualDob) : "",
            dobInRecords: details.dobInRecords ? dateValueFromDate(details.dobInRecords) : "",
            aadharNumber: formatAadhar(details.aadharNumber ?? ""),
            panNumber: details.panNumber ?? "",
            salary: details.salary !== undefined ? String(details.salary) : "",
            bankAccountNumber: details.bankAccountNumber ?? "",
            bankName: details.bankName ?? "",
            bankIfsc: details.bankIfsc ?? "",
            bankBranch: details.bankBranch ?? "",
            dateOfJoining: details.dateOfJoining
              ? dateValueFromDate(details.dateOfJoining)
              : "",
          });
        })
        .catch(() => {
          if (!cancelled) error("Failed to load employee details.");
        })
        .finally(() => {
          if (!cancelled) setLoadingEmployeeDetails(false);
        });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [employee, error]);

  function updateFormField<K extends keyof EmployeeForm>(field: K, value: EmployeeForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function closeModal() {
    setLoadingEmployeeDetails(false);
    setFieldErrors({});
    setCurrentStep(1);
    setAadharFile(null);
    setPanFile(null);
    setDocumentErrors({});
    setDrawerOpen(false);
    setTimeout(onClose, 200);
  }

  function goToNextStep() {
    const allErrors = validateEmployeeForm(form);
    const stepErrors = Object.fromEntries(
      Object.entries(allErrors).filter(([field]) =>
        STEP_FIELDS[currentStep].includes(field as keyof EmployeeForm),
      ),
    ) as EmployeeFormErrors;
    if (Object.keys(stepErrors).length > 0) {
      setFieldErrors(stepErrors);
      focusFirstInvalidField("emp-form");
      return;
    }
    setFieldErrors({});
    setCurrentStep((step) => Math.min(4, step + 1) as EmployeeFormStep);
  }

  function getStepForField(field: keyof EmployeeForm): EmployeeFormStep {
    if (STEP_FIELDS[1].includes(field)) return 1;
    if (STEP_FIELDS[2].includes(field)) return 2;
    if (STEP_FIELDS[3].includes(field)) return 3;
    return 4;
  }

  function selectDocument(type: "aadhar" | "pan", file: File | undefined) {
    const setFile = type === "aadhar" ? setAadharFile : setPanFile;
    if (!file) {
      setFile(null);
      return;
    }
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
    let message = "";
    if (!allowedTypes.includes(file.type)) {
      message = "Choose a PDF, JPEG, or PNG file.";
    } else if (file.size > 5 * 1024 * 1024) {
      message = "Document must be 5 MB or smaller.";
    }
    setDocumentErrors((current) => ({ ...current, [type]: message || undefined }));
    setFile(message ? null : file);
  }

  async function uploadDocuments(employeeId: string) {
    const uploads = [
      { type: "aadhar", file: aadharFile },
      { type: "pan", file: panFile },
    ].filter((item): item is { type: "aadhar" | "pan"; file: File } => Boolean(item.file));

    for (const { type, file } of uploads) {
      const body = new FormData();
      body.append("file", file);
      const response = await employeesRequest(`/api/users/${employeeId}/documents/${type}`, {
        method: "POST",
        body,
      });
      if (!response.ok) {
        const data = (await response.json()) as { message?: string };
        throw new Error(data.message ?? `Failed to upload ${type} document.`);
      }
    }
  }

  async function saveEmployee() {
    const validationErrors = validateEmployeeForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      const firstInvalidField = Object.keys(validationErrors)[0] as keyof EmployeeForm;
      setCurrentStep(getStepForField(firstInvalidField));
      focusFirstInvalidField("emp-form");
      return;
    }
    setFieldErrors({});
    if (!activeStore.id) {
      error("No active store selected. Please select a store first.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await employeesRequest(
        editingEmployeeId ? `/api/users/${editingEmployeeId}` : "/api/users",
        {
          method: editingEmployeeId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            ...(editingEmployeeId ? {} : { role: "employee", franchiseIds: [activeStore.id] }),
            phone: form.phone.trim() || undefined,
            position: form.position || undefined,
            employmentType: form.employmentType || undefined,
            emergencyContactName: form.emergencyContactName.trim() || undefined,
            emergencyContactPhone: form.emergencyContactPhone.trim() || undefined,
            emergencyContactRelationship: form.emergencyContactRelationship.trim() || undefined,
            actualDob: form.actualDob || undefined,
            dobInRecords: form.dobInRecords || undefined,
            aadharNumber: form.aadharNumber.trim() || undefined,
            panNumber: form.panNumber.trim() || undefined,
            salary: form.salary ? Number(form.salary) : undefined,
            bankAccountNumber: form.bankAccountNumber.trim() || undefined,
            bankName: form.bankName.trim() || undefined,
            bankIfsc: form.bankIfsc.trim() || undefined,
            bankBranch: form.bankBranch.trim() || undefined,
            dateOfJoining: form.dateOfJoining || undefined,
          }),
        },
      );
      const responseText = await res.text();
      let data: { message?: string; user?: { _id: string } } = {};
      try {
        data = JSON.parse(responseText) as { message?: string; user?: { _id: string } };
      } catch {
        data.message = responseText;
      }
      if (!res.ok) {
        error(data.message ?? (editingEmployeeId ? "Failed to update employee." : "Failed to create employee."));
        return;
      }
      const employeeId = editingEmployeeId ?? data.user?._id;
      if (!employeeId) throw new Error("Employee ID was not returned.");
      await uploadDocuments(employeeId);
      globalThis.dispatchEvent(new Event("unsaved:clear"));
      closeModal();
      success(editingEmployeeId ? "Employee updated successfully." : "Employee created successfully.");
      await onSaved();
    } catch (caughtError) {
      error(
        caughtError instanceof Error
          ? caughtError.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${drawerOpen ? "opacity-100" : "opacity-0"}`}
        style={{ height: "100vh" }}
        aria-hidden="true"
        onClick={closeModal}
      />
      <div className="fixed inset-y-0 right-0 z-50 flex max-w-full pointer-events-none">
        <div
          className={`h-full w-screen max-w-2xl bg-white shadow-2xl pointer-events-auto flex flex-col transition-transform duration-200 ease-out ${drawerOpen ? "translate-x-0" : "translate-x-full"}`}
        >
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {editingEmployeeId ? "Edit Employee" : "Add Employee"}
              </h3>
              {activeStore.name && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {`Will be assigned to `}
                  <span className="font-medium text-brand-teal">{activeStore.name}</span>
                </p>
              )}
            </div>
            <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition text-xl leading-none" aria-label="Close">
              ×
            </button>
          </div>

          <div className="border-b border-gray-100 px-6 py-3">
            <div className="grid grid-cols-4">
              {[
                { step: 1 as const, label: "Personal" },
                { step: 2 as const, label: "Bank" },
                { step: 3 as const, label: "Emergency" },
                { step: 4 as const, label: "Documents" },
              ].map(({ step, label }) => (
                <div key={step} className="flex min-w-0 items-center">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${currentStep >= step ? "bg-brand-orange text-white" : "bg-gray-100 text-gray-500"}`}>
                    {step}
                  </span>
                  <span className={`ml-2 hidden truncate text-xs font-medium sm:inline ${currentStep === step ? "text-gray-900" : "text-gray-500"}`}>
                    {label}
                  </span>
                  {step < 4 && (
                    <span aria-hidden="true" className={`mx-2 h-px min-w-3 flex-1 sm:mx-3 ${currentStep > step ? "bg-brand-orange" : "bg-gray-200"}`} />
                  )}
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs font-medium text-gray-600 sm:hidden">
              Step {currentStep} of 4 · {["Personal Details", "Bank Details", "Emergency Contact Details", "Identity Documents"][currentStep - 1]}
            </p>
          </div>

          {loadingEmployeeDetails ? (
            <div className="flex min-h-64 flex-1 items-center justify-center" role="status" aria-label="Loading employee details">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-orange border-t-transparent" />
            </div>
          ) : (
            <div className="overflow-y-auto px-6 py-5 flex-1">
              <form id="emp-form" method="post" onSubmit={(event) => event.preventDefault()} noValidate autoComplete="off" className="flex flex-col gap-6">
                <div className={currentStep === 1 ? "block" : "hidden"}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Personal Details</p>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="emp-name" className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
                      <input id="emp-name" ref={nameRef} type="text" autoComplete="off" value={form.name} onChange={(e) => updateFormField("name", e.target.value)} aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? "emp-name-error" : undefined} required placeholder="John Doe" className={`w-full rounded-lg border px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 ${fieldClass(Boolean(fieldErrors.name))}`} />
                      <div id="emp-name-error"><FieldError message={fieldErrors.name} /></div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="emp-position" className="mb-1 block text-sm font-medium text-gray-700">Position <span className="text-red-500">*</span></label>
                        <select id="emp-position" required autoComplete="off" value={form.position} onChange={(event) => updateFormField("position", event.target.value)} aria-invalid={Boolean(fieldErrors.position)} aria-describedby={fieldErrors.position ? "emp-position-error" : undefined} className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 ${fieldClass(Boolean(fieldErrors.position))}`}>
                          <option value="">Select position</option>
                          {form.position && !positionOptions.includes(form.position) && <option value={form.position}>{form.position} (current)</option>}
                          {positionOptions.map((position) => <option key={position} value={position}>{position}</option>)}
                        </select>
                        <FieldError id="emp-position-error" message={fieldErrors.position} />
                      </div>
                      <div>
                        <label htmlFor="emp-employment-type" className="mb-1 block text-sm font-medium text-gray-700">Employment Type <span className="text-red-500">*</span></label>
                        <select id="emp-employment-type" required autoComplete="off" value={form.employmentType} onChange={(event) => updateFormField("employmentType", event.target.value)} aria-invalid={Boolean(fieldErrors.employmentType)} aria-describedby={fieldErrors.employmentType ? "emp-employment-type-error" : undefined} className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 ${fieldClass(Boolean(fieldErrors.employmentType))}`}>
                          <option value="">Select type</option><option value="full_time">Full Time</option><option value="part_time">Part Time</option>
                        </select>
                        <FieldError id="emp-employment-type-error" message={fieldErrors.employmentType} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="emp-phone" className="block text-sm font-medium text-gray-700 mb-1">Phone Number <span className="text-red-500">*</span></label>
                        <input id="emp-phone" type="tel" inputMode="numeric" autoComplete="off" required maxLength={10} value={form.phone} onChange={(e) => updateFormField("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} aria-invalid={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? "emp-phone-error" : undefined} placeholder="9876543210" className={`w-full rounded-lg border px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 ${fieldClass(Boolean(fieldErrors.phone))}`} />
                        <div id="emp-phone-error"><FieldError message={fieldErrors.phone} /></div>
                      </div>
                      <div>
                        <label htmlFor="emp-date-of-joining" className="block text-sm font-medium text-gray-700 mb-1">Date of Joining <span className="text-red-500">*</span></label>
                        <DatePicker id="emp-date-of-joining" value={form.dateOfJoining} onChange={(nextValue) => updateFormField("dateOfJoining", nextValue)} ariaInvalid={Boolean(fieldErrors.dateOfJoining)} ariaDescribedBy={fieldErrors.dateOfJoining ? "emp-date-of-joining-error" : undefined} className={`w-full rounded-lg border px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 ${fieldClass(Boolean(fieldErrors.dateOfJoining))}`} />
                        <FieldError id="emp-date-of-joining-error" message={fieldErrors.dateOfJoining} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="emp-actual-dob" className="block text-sm font-medium text-gray-700 mb-1">Actual DOB <span className="text-red-500">*</span></label>
                        <DatePicker id="emp-actual-dob" max={adultDateLimit()} value={form.actualDob} onChange={(nextValue) => updateFormField("actualDob", nextValue)} ariaInvalid={Boolean(fieldErrors.actualDob)} ariaDescribedBy={fieldErrors.actualDob ? "emp-actual-dob-error" : undefined} className={`w-full rounded-lg border px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 ${fieldClass(Boolean(fieldErrors.actualDob))}`} />
                        <div id="emp-actual-dob-error"><FieldError message={fieldErrors.actualDob} /></div>
                      </div>
                      <div>
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <label htmlFor="emp-dob-records" className="block text-sm font-medium text-gray-700">DOB in Records <span className="text-red-500">*</span></label>
                          <button type="button" onClick={() => updateFormField("dobInRecords", form.actualDob)} disabled={!form.actualDob} aria-label="Copy actual DOB to DOB in records" title="Copy actual DOB" className="rounded-md p-1 text-brand-teal transition hover:bg-brand-sand hover:text-brand-sky disabled:cursor-not-allowed disabled:opacity-40"><CopyIcon className="h-4 w-4" /></button>
                        </div>
                        <DatePicker id="emp-dob-records" max={adultDateLimit()} value={form.dobInRecords} onChange={(nextValue) => updateFormField("dobInRecords", nextValue)} ariaInvalid={Boolean(fieldErrors.dobInRecords)} ariaDescribedBy={fieldErrors.dobInRecords ? "emp-dob-records-error" : undefined} className={`w-full rounded-lg border px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 ${fieldClass(Boolean(fieldErrors.dobInRecords))}`} />
                        <div id="emp-dob-records-error"><FieldError message={fieldErrors.dobInRecords} /></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={currentStep === 3 ? "block" : "hidden"}>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Emergency Contact Details</p>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="emp-emergency-name" className="mb-1 block text-sm font-medium text-gray-700">Name <span className="text-red-500">*</span></label>
                        <input id="emp-emergency-name" type="text" autoComplete="off" required value={form.emergencyContactName} onChange={(event) => updateFormField("emergencyContactName", event.target.value)} aria-invalid={Boolean(fieldErrors.emergencyContactName)} aria-describedby={fieldErrors.emergencyContactName ? "emp-emergency-name-error" : undefined} placeholder="Contact person name" className={`w-full rounded-lg border px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 ${fieldClass(Boolean(fieldErrors.emergencyContactName))}`} />
                        <FieldError id="emp-emergency-name-error" message={fieldErrors.emergencyContactName} />
                      </div>
                      <div>
                        <label htmlFor="emp-emergency-phone" className="mb-1 block text-sm font-medium text-gray-700">Contact Number <span className="text-red-500">*</span></label>
                        <input id="emp-emergency-phone" type="tel" inputMode="numeric" autoComplete="off" required maxLength={10} value={form.emergencyContactPhone} onChange={(event) => updateFormField("emergencyContactPhone", event.target.value.replace(/\D/g, "").slice(0, 10))} aria-invalid={Boolean(fieldErrors.emergencyContactPhone)} aria-describedby={fieldErrors.emergencyContactPhone ? "emp-emergency-phone-error" : undefined} placeholder="9876543210" className={`w-full rounded-lg border px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 ${fieldClass(Boolean(fieldErrors.emergencyContactPhone))}`} />
                        <FieldError id="emp-emergency-phone-error" message={fieldErrors.emergencyContactPhone} />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="emp-emergency-relationship" className="mb-1 block text-sm font-medium text-gray-700">Relationship <span className="text-red-500">*</span></label>
                      <select id="emp-emergency-relationship" autoComplete="off" required value={form.emergencyContactRelationship} onChange={(event) => updateFormField("emergencyContactRelationship", event.target.value)} aria-invalid={Boolean(fieldErrors.emergencyContactRelationship)} aria-describedby={fieldErrors.emergencyContactRelationship ? "emp-emergency-relationship-error" : undefined} className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 ${fieldClass(Boolean(fieldErrors.emergencyContactRelationship))}`}>
                        <option value="">Select relationship</option><option value="Father">Father</option><option value="Mother">Mother</option><option value="Wife">Wife</option><option value="Husband">Husband</option><option value="Brother">Brother</option><option value="Sister">Sister</option><option value="Uncle">Uncle</option><option value="Aunty">Aunty</option>
                      </select>
                      <FieldError id="emp-emergency-relationship-error" message={fieldErrors.emergencyContactRelationship} />
                    </div>
                  </div>
                </div>

                <div className={currentStep === 2 ? "block" : "hidden"}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Bank Details</p>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="emp-salary" className="mb-1 block text-sm font-medium text-gray-700">Monthly Salary <span className="text-red-500">*</span></label>
                      <div className="relative"><span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-gray-500">₹</span><input id="emp-salary" type="text" inputMode="numeric" autoComplete="off" required value={form.salary} onChange={(event) => updateFormField("salary", event.target.value.replace(/\D/g, ""))} aria-invalid={Boolean(fieldErrors.salary)} aria-describedby={fieldErrors.salary ? "emp-salary-error" : undefined} placeholder="25000" className={`w-full rounded-lg border py-2 pl-8 pr-3 text-sm text-black focus:outline-none focus:ring-2 ${fieldClass(Boolean(fieldErrors.salary))}`} /></div>
                      <FieldError id="emp-salary-error" message={fieldErrors.salary} />
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="emp-bank-account" className="block text-sm font-medium text-gray-700 mb-1">Account Number <span className="text-red-500">*</span></label>
                        <input id="emp-bank-account" type="text" inputMode="numeric" autoComplete="off" required value={form.bankAccountNumber} onChange={(e) => updateFormField("bankAccountNumber", e.target.value.replace(/\D/g, ""))} aria-invalid={Boolean(fieldErrors.bankAccountNumber)} aria-describedby={fieldErrors.bankAccountNumber ? "emp-bank-account-error" : undefined} placeholder="0123456789" className={`w-full rounded-lg border px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 ${fieldClass(Boolean(fieldErrors.bankAccountNumber))}`} />
                        <div id="emp-bank-account-error"><FieldError message={fieldErrors.bankAccountNumber} /></div>
                      </div>
                      <div>
                        <label htmlFor="emp-bank-name" className="block text-sm font-medium text-gray-700 mb-1">Bank Name <span className="text-red-500">*</span></label>
                        <input id="emp-bank-name" type="text" autoComplete="off" required value={form.bankName} onChange={(e) => updateFormField("bankName", e.target.value)} aria-invalid={Boolean(fieldErrors.bankName)} aria-describedby={fieldErrors.bankName ? "emp-bank-name-error" : undefined} placeholder="State Bank of India" className={`w-full rounded-lg border px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 ${fieldClass(Boolean(fieldErrors.bankName))}`} />
                        <FieldError id="emp-bank-name-error" message={fieldErrors.bankName} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="emp-bank-ifsc" className="block text-sm font-medium text-gray-700 mb-1">IFSC Code <span className="text-red-500">*</span></label>
                        <input id="emp-bank-ifsc" type="text" autoComplete="off" required value={form.bankIfsc} onChange={(e) => updateFormField("bankIfsc", e.target.value.toUpperCase())} aria-invalid={Boolean(fieldErrors.bankIfsc)} aria-describedby={fieldErrors.bankIfsc ? "emp-bank-ifsc-error" : undefined} placeholder="SBIN0001234" maxLength={11} className={`w-full rounded-lg border px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 ${fieldClass(Boolean(fieldErrors.bankIfsc))}`} />
                        <FieldError id="emp-bank-ifsc-error" message={fieldErrors.bankIfsc} />
                      </div>
                      <div>
                        <label htmlFor="emp-bank-branch" className="block text-sm font-medium text-gray-700 mb-1">Branch Name <span className="text-red-500">*</span></label>
                        <input id="emp-bank-branch" type="text" autoComplete="off" required value={form.bankBranch} onChange={(e) => updateFormField("bankBranch", e.target.value)} aria-invalid={Boolean(fieldErrors.bankBranch)} aria-describedby={fieldErrors.bankBranch ? "emp-bank-branch-error" : undefined} placeholder="MG Road Branch" className={`w-full rounded-lg border px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 ${fieldClass(Boolean(fieldErrors.bankBranch))}`} />
                        <FieldError id="emp-bank-branch-error" message={fieldErrors.bankBranch} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className={currentStep === 4 ? "block" : "hidden"}>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Identity Documents</p>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="emp-aadhar" className="mb-1 block text-sm font-medium text-gray-700">Aadhar Card No. <span className="text-red-500">*</span></label>
                        <input id="emp-aadhar" type="text" inputMode="numeric" autoComplete="off" required value={form.aadharNumber} onChange={(event) => updateFormField("aadharNumber", formatAadhar(event.target.value))} aria-invalid={Boolean(fieldErrors.aadharNumber)} aria-describedby={fieldErrors.aadharNumber ? "emp-aadhar-error" : undefined} placeholder="1234 5678 9012" maxLength={14} className={`w-full rounded-lg border px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 ${fieldClass(Boolean(fieldErrors.aadharNumber))}`} />
                        <FieldError id="emp-aadhar-error" message={fieldErrors.aadharNumber} />
                      </div>
                      <div>
                        <label htmlFor="emp-pan" className="mb-1 block text-sm font-medium text-gray-700">PAN Card No. <span className="text-red-500">*</span></label>
                        <input id="emp-pan" type="text" autoComplete="off" required value={form.panNumber} onChange={(event) => updateFormField("panNumber", formatPan(event.target.value))} pattern="[A-Z]{5}[0-9]{4}[A-Z]" aria-invalid={Boolean(fieldErrors.panNumber)} aria-describedby={fieldErrors.panNumber ? "emp-pan-error" : undefined} placeholder="ABCDE1234F" maxLength={10} className={`w-full rounded-lg border px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 ${fieldClass(Boolean(fieldErrors.panNumber))}`} />
                        <FieldError id="emp-pan-error" message={fieldErrors.panNumber} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {[
                        { type: "aadhar" as const, label: "Upload Aadhar Card", file: aadharFile, document: aadharDocument },
                        { type: "pan" as const, label: "Upload PAN Card", file: panFile, document: panDocument },
                      ].map(({ type, label, file, document }) => (
                        <div key={type}>
                          <label htmlFor={`emp-${type}-document`} className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
                          <input id={`emp-${type}-document`} type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => selectDocument(type, event.target.files?.[0])} className="block w-full rounded-lg border border-gray-300 text-xs text-gray-600 file:mr-3 file:border-0 file:bg-brand-sand file:px-3 file:py-2 file:text-xs file:font-medium file:text-brand-teal hover:file:bg-brand-beige" />
                          <p className="mt-1 text-xs text-gray-400">PDF, JPEG or PNG, max 5 MB</p>
                          {file && <p className="mt-1 truncate text-xs text-brand-teal">{file.name}</p>}
                          {!file && document && editingEmployeeId && <a href={`/api/users/${editingEmployeeId}/documents/${type}`} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs font-medium text-brand-sky hover:underline">View {document.fileName}</a>}
                          <FieldError message={documentErrors[type]} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </form>
            </div>
          )}

          {!loadingEmployeeDetails && (
            <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
              <button type="button" data-unsaved-reset="true" onClick={() => { if (currentStep === 1) closeModal(); else setCurrentStep((step) => (step - 1) as EmployeeFormStep); }} className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition">
                {currentStep === 1 ? "Cancel" : "Back"}
              </button>
              {currentStep < 4 ? (
                <button type="button" onClick={goToNextStep} className="flex-1 rounded-lg bg-brand-orange py-2 text-sm font-medium text-white transition hover:bg-brand-orange/90">Next</button>
              ) : (
                <button type="button" onClick={() => void saveEmployee()} disabled={submitting} className="flex-1 bg-brand-orange text-white text-sm font-medium py-2 rounded-lg hover:bg-brand-orange/90 transition disabled:opacity-60">
                  {submitting ? editingEmployeeId ? "Saving…" : "Creating…" : editingEmployeeId ? "Save Changes" : "Create Employee"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}