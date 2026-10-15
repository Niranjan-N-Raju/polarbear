import mongoose, { Document, Model, Schema } from "mongoose";

export interface ISaleExpense {
  name: string;
  amount: number;
}

export interface ISale extends Document {
  franchise: mongoose.Types.ObjectId;
  date: string;
  totalSale: number;
  swiggy: number;
  zomato: number;
  upi: number;
  upiCharge: number;
  cash: number;
  expenses: ISaleExpense[];
  totalExpenses: number;
  bankingCash: number;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SaleExpenseSchema = new Schema<ISaleExpense>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const SaleSchema: Schema<ISale> = new Schema(
  {
    franchise: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Franchise",
      required: true,
    },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    totalSale: { type: Number, required: true, min: 0 },
    swiggy: { type: Number, required: true, min: 0 },
    zomato: { type: Number, required: true, min: 0 },
    upi: { type: Number, required: true, min: 0 },
    upiCharge: { type: Number, required: true, min: 0 },
    cash: { type: Number, required: true },
    expenses: { type: [SaleExpenseSchema], default: [] },
    totalExpenses: { type: Number, required: true, min: 0 },
    bankingCash: { type: Number, required: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

SaleSchema.index({ franchise: 1, date: 1 }, { unique: true });

const Sale: Model<ISale> =
  mongoose.models.Sale ?? mongoose.model<ISale>("Sale", SaleSchema);

export default Sale;
