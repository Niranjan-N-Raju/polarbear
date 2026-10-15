import mongoose, { Document, Model, Schema } from "mongoose";

export type WithdrawalType = "withdrawal" | "repayment";

export interface IWithdrawal extends Document {
  franchise: mongoose.Types.ObjectId;
  date: string;
  amount: number;
  type: WithdrawalType;
  reason?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WithdrawalSchema: Schema<IWithdrawal> = new Schema(
  {
    franchise: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Franchise",
      required: true,
    },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    amount: { type: Number, required: true, min: 0 },
    type: { type: String, enum: ["withdrawal", "repayment"], required: true },
    reason: { type: String, trim: true, maxlength: 300 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

WithdrawalSchema.index({ franchise: 1, date: -1 });

// In development, hot-reloads preserve mongoose.models but may carry a stale schema.
// Delete the cached model so the schema is always up-to-date.
if (mongoose.models.Withdrawal) {
  mongoose.deleteModel("Withdrawal");
}

const Withdrawal: Model<IWithdrawal> = mongoose.model<IWithdrawal>("Withdrawal", WithdrawalSchema);

export default Withdrawal;
