import mongoose, { Document, Model, Schema } from "mongoose";
import { encryptField } from "@/lib/crypto";

interface IUserDocumentFile {
  fileId: mongoose.Types.ObjectId;
  fileName: string;
  contentType: string;
  size: number;
}

export interface IUser extends Document {
  email: string;
  password: string; // stored as bcrypt hash
  name: string;
  role: "admin" | "sub_admin" | "franchise_admin" | "employee";
  isActive: boolean;
  sessionVersion: number;
  mustChangePassword?: boolean;
  preferredLanguage?: "en" | "kn";
  archivedAt?: Date;
  franchises: mongoose.Types.ObjectId[];
  createdBy?: mongoose.Types.ObjectId;
  phone?: string;
  position?: string;
  employmentType?: "full_time" | "part_time";
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
  actualDob?: Date;
  dobInRecords?: Date;
  aadharNumber?: string;
  panNumber?: string;
  salary?: number;
  bankAccountNumber?: string;
  bankName?: string;
  bankIfsc?: string;
  bankBranch?: string;
  aadharDocument?: IUserDocumentFile;
  panDocument?: IUserDocumentFile;
  dateOfJoining?: Date;
  createdAt: Date;
}

const UserSchema: Schema<IUser> = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["admin", "sub_admin", "franchise_admin", "employee"],
      default: "employee",
    },
    isActive: { type: Boolean, default: true },
    sessionVersion: { type: Number, default: 0, min: 0 },
    // Set by the backend when an admin issues a password; cleared on self-service change.
    mustChangePassword: { type: Boolean, default: false },
    preferredLanguage: { type: String, enum: ["en", "kn"], default: "en" },
    archivedAt: { type: Date },
    franchises: [{ type: mongoose.Schema.Types.ObjectId, ref: "Franchise" }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    phone: { type: String, trim: true },
    position: { type: String, trim: true },
    employmentType: {
      type: String,
      enum: ["full_time", "part_time"],
    },
    emergencyContactName: { type: String, trim: true },
    emergencyContactPhone: { type: String, trim: true },
    emergencyContactRelationship: { type: String, trim: true },
    actualDob: { type: Date },
    dobInRecords: { type: Date },
    aadharNumber: { type: String, trim: true },
    panNumber: { type: String, trim: true },
    salary: { type: Number, min: 0 },
    bankAccountNumber: { type: String, trim: true },
    bankName: { type: String, trim: true },
    bankIfsc: { type: String, trim: true },
    bankBranch: { type: String, trim: true },
    aadharDocument: {
      type: new Schema(
        {
          fileId: { type: mongoose.Schema.Types.ObjectId, required: true },
          fileName: { type: String, required: true },
          contentType: { type: String, required: true },
          size: { type: Number, required: true },
        },
        { _id: false },
      ),
    },
    panDocument: {
      type: new Schema(
        {
          fileId: { type: mongoose.Schema.Types.ObjectId, required: true },
          fileName: { type: String, required: true },
          contentType: { type: String, required: true },
          size: { type: Number, required: true },
        },
        { _id: false },
      ),
    },
    dateOfJoining: { type: Date },
  },
  { timestamps: true },
);

// Database indexes for query performance
UserSchema.index({ franchises: 1 });
UserSchema.index({ createdBy: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ createdBy: 1, role: 1 });

// In development, hot-reloads preserve mongoose.models but may carry a stale
// schema (e.g. an enum added after first load). Delete the cached model so the
// schema is always up-to-date. In production the module only loads once anyway.
if (mongoose.models.User) {
  mongoose.deleteModel("User");
}

// Encrypt PII fields before saving. Uses AES-256-GCM when FIELD_ENCRYPTION_KEY
// is set; falls back to plaintext with a warning (see lib/crypto.ts).
const SENSITIVE_FIELDS = [
  "aadharNumber",
  "panNumber",
  "bankAccountNumber",
  "bankName",
  "bankIfsc",
  "bankBranch",
] as const;

UserSchema.pre("save", function (next) {
  for (const field of SENSITIVE_FIELDS) {
    const val = this[field as keyof typeof this] as string | undefined;
    if (this.isModified(field) && val) {
      (this as unknown as Record<string, unknown>)[field] = encryptField(val);
    }
  }
  next();
});

const User: Model<IUser> = mongoose.model<IUser>("User", UserSchema);

export default User;
