/**
 * One-time backfill for orphan stores missing createdBy.
 * Default is dry-run; add --apply to persist changes.
 *
 * Usage:
 *   npx tsx scripts/backfill-store-creators.ts --email test1@gmail.com
 *   npx tsx scripts/backfill-store-creators.ts --email test1@gmail.com --apply
 *   npx tsx scripts/backfill-store-creators.ts --email test1@gmail.com --codes TEST-1-STORE-1,TEST --apply
 */

import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });

if (process.env.NODE_ENV === "production") {
  console.error("ERROR: Refusing to run in production.");
  process.exit(1);
}

import mongoose from "mongoose";

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
const REQUIRED_MONGODB_URI: string = MONGODB_URI;

// ── Parse CLI args ─────────────────────────────────────────────────────────────

type Args = { email: string | undefined; apply: boolean; codes: string[] };

function parseArgs(argv: string[]): Args {
  const out: Args = { email: undefined, apply: false, codes: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--apply") {
      out.apply = true;
      continue;
    }
    if (argv[i] === "--email") {
      out.email = argv[i + 1];
      i++;
      continue;
    }
    if (argv[i] === "--codes") {
      out.codes = (argv[i + 1] ?? "")
        .split(",")
        .map((v) => v.trim().toUpperCase())
        .filter(Boolean);
      i++;
    }
  }
  return out;
}

// ── Minimal schemas (standalone — no model imports) ───────────────────────────

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  name: String,
  role: String,
  franchises: [{ type: mongoose.Schema.Types.ObjectId, ref: "Franchise" }],
});

const FranchiseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    storeCode: { type: String, required: true, unique: true, uppercase: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

const User =
  (mongoose.models.User as mongoose.Model<mongoose.AnyObject>) ??
  mongoose.model("User", UserSchema);
const Franchise =
  (mongoose.models.Franchise as mongoose.Model<mongoose.AnyObject>) ??
  mongoose.model("Franchise", FranchiseSchema);

function ensureObjectId(
  value: unknown,
  fieldName: string,
): mongoose.Types.ObjectId {
  if (value instanceof mongoose.Types.ObjectId) {
    return value;
  }

  if (typeof value === "string" && mongoose.isValidObjectId(value)) {
    return new mongoose.Types.ObjectId(value);
  }

  throw new Error(`Invalid ObjectId value for ${fieldName}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { email, apply, codes } = parseArgs(process.argv.slice(2));

  if (!email?.trim()) {
    console.error(
      "Missing required --email argument.\n" +
        "Example: npx tsx scripts/backfill-store-creators.ts --email test1@gmail.com --apply",
    );
    process.exit(1);
  }

  await mongoose.connect(REQUIRED_MONGODB_URI, { dbName: MONGODB_DB });

  const normalizedEmail = email.toLowerCase().trim();
  const userDocs = await User.find({ email: normalizedEmail })
    .select("_id name email role")
    .lean();

  const user = Array.isArray(userDocs) ? userDocs[0] : userDocs;

  if (!user?._id) {
    console.error(`User not found for email: ${normalizedEmail}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const userId = ensureObjectId(user._id, "user._id");

  const orphanClause = {
    $or: [{ createdBy: { $exists: false } }, { createdBy: null }],
  };
  const query: mongoose.FilterQuery<mongoose.AnyObject> = { ...orphanClause };
  if (codes.length > 0) query.storeCode = { $in: codes };

  const targets = (await Franchise.find(query)
    .select("_id name storeCode createdBy")
    .sort({ createdAt: -1 })
    .lean()) as mongoose.AnyObject[];

  console.log("Backfill target user:", {
    id: userId.toHexString(),
    name: user.name,
    email: user.email,
    role: user.role,
  });
  console.log("Dry run:", !apply);
  console.log("Matching orphan stores:", targets.length);

  if (targets.length > 0) {
    console.table(
      targets.map((s) => ({
        id: String(s._id),
        name: s.name,
        storeCode: s.storeCode,
        createdBy: s.createdBy ? String(s.createdBy) : null,
      })),
    );
  }

  if (!apply) {
    console.log("\nNo data changed. Re-run with --apply to persist updates.");
    await mongoose.disconnect();
    return;
  }

  if (targets.length === 0) {
    console.log("No orphan stores to update.");
    await mongoose.disconnect();
    return;
  }

  const storeIds = targets.map((s) => s._id as mongoose.Types.ObjectId);

  const storeResult = await Franchise.updateMany(
    { _id: { $in: storeIds } },
    { $set: { createdBy: userId } },
  );
  const userResult = await User.updateOne(
    { _id: userId },
    { $addToSet: { franchises: { $each: storeIds } } },
  );

  console.log(
    `\n✓ Updated stores (createdBy set): ${storeResult.modifiedCount}`,
  );
  console.log(`✓ Updated user franchise list:    ${userResult.modifiedCount}`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    /* no-op */
  }
  process.exit(1);
});
