import mongoose, { Document, Model, Schema } from "mongoose";

export interface IIncentive extends Document {
  franchise: mongoose.Types.ObjectId;
  employee: mongoose.Types.ObjectId;
  period: string;
  type: string;
  amount: number;
  paidEarly: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const IncentiveSchema: Schema<IIncentive> = new Schema(
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
    paidEarly: { type: Boolean, default: false },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

IncentiveSchema.index({ franchise: 1, employee: 1, period: 1 });

const Incentive: Model<IIncentive> =
  mongoose.models.Incentive ?? mongoose.model<IIncentive>("Incentive", IncentiveSchema);

export default Incentive;
