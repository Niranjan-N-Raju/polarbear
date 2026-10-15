import mongoose, { Document, Model, Schema } from "mongoose";

// Manual monthly P&L inputs for a store. Keyed by field name (e.g. "food", "rent",
// "omGarbageCharges") in a flexible map since new line items are added frequently.
export interface IPnlInput extends Document {
  franchise: mongoose.Types.ObjectId;
  period: string;
  values: Map<string, number>;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PnlInputSchema: Schema<IPnlInput> = new Schema(
  {
    franchise: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Franchise",
      required: true,
    },
    period: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
    values: { type: Map, of: Number, default: {} },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

PnlInputSchema.index({ franchise: 1, period: 1 }, { unique: true });

// In development, hot-reloads preserve mongoose.models but may carry a stale
// schema (e.g. this model's fields changed from discrete numbers to a Map).
// Delete the cached model so the schema is always up-to-date.
if (mongoose.models.PnlInput) {
  mongoose.deleteModel("PnlInput");
}

const PnlInput: Model<IPnlInput> = mongoose.model<IPnlInput>("PnlInput", PnlInputSchema);

export default PnlInput;
