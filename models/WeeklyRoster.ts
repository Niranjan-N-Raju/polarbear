import mongoose, { Document, Model, Schema } from "mongoose";

export interface IWeeklyRosterDay {
  date: string;
  shift: string;
}

export interface IWeeklyRosterEntry {
  employee: mongoose.Types.ObjectId;
  days: IWeeklyRosterDay[];
}

export interface IWeeklyRoster extends Document {
  franchise: mongoose.Types.ObjectId;
  weekStart: string;
  entries: IWeeklyRosterEntry[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WeeklyRosterDaySchema = new Schema<IWeeklyRosterDay>(
  {
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    shift: { type: String, required: true, trim: true, maxlength: 80 },
  },
  { _id: false },
);

const WeeklyRosterEntrySchema = new Schema<IWeeklyRosterEntry>(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    days: { type: [WeeklyRosterDaySchema], required: true },
  },
  { _id: false },
);

const WeeklyRosterSchema: Schema<IWeeklyRoster> = new Schema(
  {
    franchise: { type: mongoose.Schema.Types.ObjectId, ref: "Franchise", required: true },
    weekStart: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    entries: { type: [WeeklyRosterEntrySchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

WeeklyRosterSchema.index({ franchise: 1, weekStart: 1 }, { unique: true });

if (mongoose.models.WeeklyRoster) {
  mongoose.deleteModel("WeeklyRoster");
}

const WeeklyRoster: Model<IWeeklyRoster> = mongoose.model<IWeeklyRoster>("WeeklyRoster", WeeklyRosterSchema);

export default WeeklyRoster;