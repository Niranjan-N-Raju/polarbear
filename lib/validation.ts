import { z } from "zod";

/**
 * Password complexity: 12+ characters, at least one uppercase, one lowercase,
 * one digit, one special character.
 */
export const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters.")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter.")
  .regex(/[0-9]/, "Password must contain at least one digit.")
  .regex(
    /[^A-Za-z0-9]/,
    "Password must contain at least one special character.",
  );

/** RFC 5322 simplified email validation */
export const emailSchema = z
  .string()
  .min(1, "Email is required.")
  .max(254, "Email is too long.")
  .email("Invalid email format.")
  .transform((v) => v.toLowerCase().trim());

/** Generic name field */
export const nameSchema = z
  .string()
  .min(1, "Name is required.")
  .max(100, "Name must be 100 characters or fewer.")
  .transform((v) => v.trim());

/** Phone number (optional) */
export const phoneSchema = z
  .string()
  .max(20, "Phone number too long.")
  .optional()
  .transform((v) => v?.trim());

const storePhoneSchema = z
  .string()
  .optional()
  .transform((value) => value?.trim())
  .refine(
    (value) => !value || /^\d{10}$/.test(value),
    "Phone number must be exactly 10 digits.",
  );

const optionalDigitsSchema = (message: string) =>
  z
    .string()
    .optional()
    .refine((v) => !v || /^\d+$/.test(v), message);

const optionalAadharSchema = z
  .preprocess(
    (value) => (typeof value === "string" ? value.replace(/\s/g, "") : value),
    z.string().optional(),
  )
  .refine((v) => !v || /^\d{12}$/.test(v), "Aadhar number must be 12 digits.");

const optionalPanSchema = z
  .string()
  .optional()
  .transform((v) => v?.toUpperCase())
  .refine(
    (v) => !v || /^[A-Z]{5}\d{4}[A-Z]$/.test(v),
    "PAN must be 5 letters, 4 digits, and 1 letter.",
  );

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const franchiseIdsSchema = z
  .array(z.string().regex(OBJECT_ID_PATTERN, "Invalid store id."))
  .max(50)
  .optional();

/** True when value is a finite number with at most 2 decimal places. */
export function hasAtMostTwoDecimals(value: number): boolean {
  if (!Number.isFinite(value)) return false;
  return Math.abs(Math.round(value * 100) - value * 100) < 1e-6;
}

/** Positive money amount with at most 2 decimals. */
const salarySchema = z
  .number()
  .positive("Salary must be greater than zero.")
  .refine(hasAtMostTwoDecimals, "Salary can have at most 2 decimal places.");

/** Store code */
export const storeCodeSchema = z
  .string()
  .min(1, "Store code is required.")
  .max(20, "Store code must be 20 characters or fewer.")
  .transform((v) => v.trim().toUpperCase());

/** Generic short text with max length */
export const shortTextSchema = (maxLen = 200) =>
  z
    .string()
    .max(maxLen, `Must be ${maxLen} characters or fewer.`)
    .optional()
    .transform((v) => v?.trim());

/** Date string validator */
export const dateStringSchema = z
  .string()
  .optional()
  .refine(
    (v) => {
      if (!v) return true;
      const d = new Date(v);
      return !isNaN(d.getTime());
    },
    { message: "Invalid date format." },
  );

/** Login request body schema */
export const loginBodySchema = z.object({
  email: z.string().min(1, "Email is required.").max(254),
  password: z.string().min(1, "Password is required.").max(200),
});

/** Create user request body schema */
export const createUserBodySchema = z.object({
  name: nameSchema,
  email: emailSchema.optional(),
  password: passwordSchema.optional(),
  role: z
    .enum(["admin", "sub_admin", "franchise_admin", "employee"])
    .optional(),
  franchiseIds: franchiseIdsSchema,
  phone: phoneSchema,
  position: z.string().trim().min(1).max(60).optional(),
  employmentType: z.enum(["full_time", "part_time"]).optional(),
  emergencyContactName: shortTextSchema(100),
  emergencyContactPhone: phoneSchema,
  emergencyContactRelationship: shortTextSchema(50),
  actualDob: dateStringSchema,
  dobInRecords: dateStringSchema,
  aadharNumber: optionalAadharSchema,
  panNumber: optionalPanSchema,
  salary: salarySchema.optional(),
  bankAccountNumber: optionalDigitsSchema(
    "Account number must contain digits only.",
  ),
  bankName: shortTextSchema(100),
  bankIfsc: shortTextSchema(20),
  bankBranch: shortTextSchema(100),
  dateOfJoining: dateStringSchema,
});

/** Create store request body schema */
export const createStoreBodySchema = z.object({
  name: nameSchema.pipe(z.string().max(100, "Store name must be 100 characters or fewer.")),
  storeCode: storeCodeSchema,
  address: shortTextSchema(300),
  phone: storePhoneSchema,
  emergencyContactName: shortTextSchema(100),
  emergencyContactPhone: phoneSchema,
  emergencyContactRelationship: shortTextSchema(50),
  description: shortTextSchema(500),
  storeType: z.enum(["company", "franchise"]).optional(),
  ownerName: shortTextSchema(100),
  ownerPhone: storePhoneSchema,
  ownerEmail: z.preprocess(
    (value) => (value === "" ? undefined : value),
    emailSchema.optional(),
  ),
});

export const storeArchiveBodySchema = z.object({
  archived: z.boolean(),
});

/** Update profile request body schema */
export const updateProfileBodySchema = z.object({
  name: nameSchema.optional(),
  currentPassword: z.string().max(200).optional(),
  newPassword: passwordSchema.optional(),
});

/** Patch user body schema */
export const patchUserBodySchema = z.object({
  name: nameSchema.optional(),
  role: z
    .enum(["admin", "sub_admin", "franchise_admin", "employee"])
    .optional(),
  franchiseIds: franchiseIdsSchema,
  phone: phoneSchema,
  position: z.string().trim().min(1).max(60).optional(),
  employmentType: z.enum(["full_time", "part_time"]).optional(),
  emergencyContactName: shortTextSchema(100),
  emergencyContactPhone: phoneSchema,
  emergencyContactRelationship: shortTextSchema(50),
  actualDob: dateStringSchema,
  dobInRecords: dateStringSchema,
  aadharNumber: optionalAadharSchema,
  panNumber: optionalPanSchema,
  salary: salarySchema.optional(),
  bankAccountNumber: optionalDigitsSchema(
    "Account number must contain digits only.",
  ),
  bankName: shortTextSchema(100),
  bankIfsc: shortTextSchema(20),
  bankBranch: shortTextSchema(100),
  dateOfJoining: dateStringSchema,
});

/**
 * Limit request body size. Returns parsed JSON or null if body exceeds limit.
 */
export async function parseBodyWithLimit(
  request: Request,
  maxBytes = 100_000,
): Promise<unknown | null> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > maxBytes) {
    return null;
  }

  const text = await request.text();
  if (text.length > maxBytes) {
    return null;
  }

  return JSON.parse(text);
}
