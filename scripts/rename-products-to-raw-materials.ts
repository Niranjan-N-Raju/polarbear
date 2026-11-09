import { config } from "dotenv";
import { resolve } from "node:path";
import { MongoClient } from "mongodb";

config({ path: resolve(process.cwd(), ".env.local") });

const mongoUri = process.env.MONGODB_URI ?? "";
const databaseName = process.env.MONGODB_DB ?? "";
const applyChanges = process.argv.includes("--apply");

if (!mongoUri || !databaseName) {
  console.error("MONGODB_URI and MONGODB_DB must be set in .env.local.");
  process.exit(1);
}

async function main() {
  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    const db = client.db(databaseName);
    const collections = await db.listCollections({}, { nameOnly: true }).toArray();
    const collectionNames = new Set(collections.map(({ name }) => name));
    const hasProducts = collectionNames.has("products");
    const hasRawMaterials = collectionNames.has("raw_materials");

    if (hasProducts && hasRawMaterials) {
      throw new Error(
        "Both products and raw_materials collections exist. Resolve them before renaming; no changes were made."
      );
    }
    if (!hasProducts) {
      console.log(
        hasRawMaterials
          ? `Collection already renamed in ${databaseName}.`
          : `Neither collection exists in ${databaseName}; nothing to rename.`
      );
      return;
    }

    if (!applyChanges) {
      console.log(
        `Dry run: rename ${databaseName}.products to ${databaseName}.raw_materials. No database changes made. Run with --apply to rename.`
      );
      return;
    }

    await db.collection("products").rename("raw_materials");
    console.log(
      `Renamed ${databaseName}.products to ${databaseName}.raw_materials. Document IDs and indexes are preserved.`
    );
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Raw materials collection rename failed."
  );
  process.exitCode = 1;
});