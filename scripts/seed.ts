/**
 * Seed script — wipes all data and inserts one Super Admin user.
 * Run: NODE_ENV=development npx tsx scripts/seed.ts --confirm-wipe=<database-name>
 *
 * Requires MONGODB_URI to be set in .env.local
 * Optional: SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD override the defaults.
 *
 * SEED_ADMIN_PASSWORD is required — there is no default. Set it explicitly.
 */

import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });

// Require an explicit local environment before allowing destructive seeding.
if (process.env.NODE_ENV !== "development") {
  console.error(
    "ERROR: Set NODE_ENV=development to run this destructive seed script.",
  );
  process.exit(1);
}

import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB;
if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set. Add it to .env.local");
  process.exit(1);
}
if (!MONGODB_DB) {
  console.error("MONGODB_DB is not set. Add it to .env.local");
  process.exit(1);
}
if (!process.argv.includes(`--confirm-wipe=${MONGODB_DB}`)) {
  console.error(
    `ERROR: Seeding deletes all users and stores. Re-run with --confirm-wipe=${MONGODB_DB} to confirm the target database.`,
  );
  process.exit(1);
}

const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@pb.com";
const adminPassword = process.env.SEED_ADMIN_PASSWORD;
if (!adminPassword) {
  console.error(
    "ERROR: SEED_ADMIN_PASSWORD is not set. Add it to .env.local before seeding.",
  );
  process.exit(1);
}

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: {
    type: String,
    enum: ["admin", "sub_admin", "franchise_admin", "employee"],
    default: "employee",
  },
  franchises: [{ type: mongoose.Schema.Types.ObjectId, ref: "Franchise" }],
});

const FranchiseSchema = new mongoose.Schema(
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
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const User = mongoose.models.User ?? mongoose.model("User", UserSchema);
const Franchise =
  mongoose.models.Franchise ?? mongoose.model("Franchise", FranchiseSchema);

async function seed() {
  await mongoose.connect(MONGODB_URI as string, { dbName: MONGODB_DB });

  // Wipe all existing data
  await User.deleteMany({});
  await Franchise.deleteMany({});
  console.log("✓ Cleared users and franchises collections.");

  // Insert Super Admin
  // adminPassword is guaranteed non-empty by the check above that exits if unset
  const hashedPassword = await bcrypt.hash(adminPassword!, 12);
  await User.create({
    email: adminEmail,
    password: hashedPassword,
    name: "Super Admin",
    role: "admin",
    franchises: [],
  });
  console.log(`✓ Super Admin created — email: ${adminEmail}`);
  console.log("  (password stored as bcrypt hash — keep it safe)");

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
