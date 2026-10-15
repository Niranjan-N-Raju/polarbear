import mongoose, { Document, Model, Schema } from "mongoose";

export interface IAdvance extends Document {
  franchise: mongoose.Types.ObjectId;
  employee: mongoose.Types.ObjectId;
  period: string;
  type: string;
  amount: number;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AdvanceSchema: Schema<IAdvance> = new Schema(
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
    amount: { type: Number, required: true, min: 0 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

AdvanceSchema.index({ franchise: 1, employee: 1, period: 1 });

const Advance: Model<IAdvance> =
  mongoose.models.Advance ?? mongoose.model<IAdvance>("Advance", AdvanceSchema);

export default Advance;
