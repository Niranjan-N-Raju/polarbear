import mongoose, { Document, Model, Schema } from "mongoose";

/**
 * Records that an attendance entry was explicitly removed so the roster default is not
 * re-materialized for that (franchise, employee, date). Shared with the Express backend.
 */
export interface IAttendanceRemoval extends Document {
  franchise: mongoose.Types.ObjectId;
  employee: mongoose.Types.ObjectId;
  date: string;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceRemovalSchema: Schema<IAttendanceRemoval> = new Schema(
  {
    franchise: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Franchise",
      required: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, collection: "attendance_removals" },
);

AttendanceRemovalSchema.index({ franchise: 1, employee: 1, date: 1 }, { unique: true });

const AttendanceRemoval: Model<IAttendanceRemoval> =
  mongoose.models.AttendanceRemoval ??
  mongoose.model<IAttendanceRemoval>("AttendanceRemoval", AttendanceRemovalSchema);

export default AttendanceRemoval;
