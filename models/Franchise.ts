import mongoose, { Document, Model, Schema } from "mongoose";
import { DEFAULT_POSITION_OPTIONS } from "@/lib/employee-positions";

export interface IFranchiseLogo {
  fileId: mongoose.Types.ObjectId;
  contentType: string;
}

export interface IFranchiseShift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

export interface IFranchise extends Document {
  name: string;
  storeCode: string;
  description?: string;
  address?: string;
  phone?: string;
  storeType: "company" | "franchise";
  ownerName?: string;
  ownerPhone?: string;
  ownerEmail?: string;
  logo?: IFranchiseLogo;
  shifts: IFranchiseShift[];
  positions: string[];
  salaryCycleType?: "calendar_month" | "custom";
  salaryCycleStartDay?: number;
  salaryCycleEndDay?: number;
  salaryCycleConfiguredAt?: Date;
  isActive: boolean;
  archivedAt?: Date;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const FranchiseSchema: Schema<IFranchise> = new Schema(
  {
    name: { type: String, required: true, trim: true },
    storeCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    description: { type: String, trim: true },
    address: { type: String, trim: true },
    phone: { type: String, trim: true },
    storeType: {
      type: String,
      enum: ["company", "franchise"],
      default: "franchise",
    },
    ownerName: { type: String, trim: true },
    ownerPhone: { type: String, trim: true },
    ownerEmail: { type: String, lowercase: true, trim: true },
    logo: {
      type: new Schema(
        {
          fileId: { type: mongoose.Schema.Types.ObjectId, required: true },
          contentType: { type: String, required: true },
        },
        { _id: false },
      ),
      required: false,
    },
    shifts: {
      type: [
        new Schema<IFranchiseShift>(
          {
            id: { type: String, required: true, trim: true, maxlength: 80 },
            name: { type: String, required: true, trim: true, maxlength: 40 },
            startTime: { type: String, required: true, match: /^(?:[01]\d|2[0-3]):[0-5]\d$/ },
            endTime: { type: String, required: true, match: /^(?:[01]\d|2[0-3]):[0-5]\d$/ },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    positions: { type: [String], default: DEFAULT_POSITION_OPTIONS },
    salaryCycleType: {
      type: String,
      enum: ["calendar_month", "custom"],
    },
    salaryCycleStartDay: { type: Number, min: 1, max: 31 },
    salaryCycleEndDay: { type: Number, min: 1, max: 31 },
    salaryCycleConfiguredAt: { type: Date },
    isActive: { type: Boolean, default: true },
    archivedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

// Database indexes for query performance
FranchiseSchema.index({ createdBy: 1 });
FranchiseSchema.index({ isActive: 1 });
FranchiseSchema.index({ storeType: 1, isActive: 1 });

if (mongoose.models.Franchise) {
  mongoose.deleteModel("Franchise");
}

const Franchise: Model<IFranchise> = mongoose.model<IFranchise>(
  "Franchise",
  FranchiseSchema,
);

export default Franchise;
