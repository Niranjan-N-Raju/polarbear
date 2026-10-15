import mongoose, { Document, Model, Schema } from "mongoose";

export type AttendanceStatus = "Present" | "Week Off" | "Absent";

export interface IAttendance extends Document {
  employee: mongoose.Types.ObjectId;
  franchise: mongoose.Types.ObjectId;
  date: string;
  status: AttendanceStatus;
  comment?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceSchema: Schema<IAttendance> = new Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    franchise: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Franchise",
      required: true,
    },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    status: {
      type: String,
      enum: ["Present", "Week Off", "Absent"],
      required: true,
    },
    comment: { type: String, trim: true, maxlength: 500 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

AttendanceSchema.index({ franchise: 1, date: 1, employee: 1 }, { unique: true });

const Attendance: Model<IAttendance> =
  mongoose.models.Attendance ??
  mongoose.model<IAttendance>("Attendance", AttendanceSchema);

export default Attendance;
