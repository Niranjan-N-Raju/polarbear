import mongoose, { Document, Model, Schema } from "mongoose";

export interface IExtraDay extends Document {
  franchise: mongoose.Types.ObjectId;
  employee: mongoose.Types.ObjectId;
  period: string;
  type: string;
  days: number;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ExtraDaySchema: Schema<IExtraDay> = new Schema(
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
    period: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
    type: { type: String, required: true, trim: true, maxlength: 100 },
    days: { type: Number, required: true, min: 0 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

ExtraDaySchema.index({ franchise: 1, employee: 1, period: 1 });

const ExtraDay: Model<IExtraDay> =
  mongoose.models.ExtraDay ?? mongoose.model<IExtraDay>("ExtraDay", ExtraDaySchema);

export default ExtraDay;
