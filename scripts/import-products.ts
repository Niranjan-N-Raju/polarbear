import { config } from "dotenv";
import { resolve } from "node:path";
import { MongoClient, ObjectId } from "mongodb";

config({ path: resolve(process.cwd(), ".env.local") });

const mongoUri = process.env.MONGODB_URI ?? "";
const targetDatabaseName = process.env.MONGODB_DB ?? "";
const sourceDatabaseName = process.env.SOURCE_MONGODB_DB ?? "inventory_management";
const applyChanges = process.argv.includes("--apply");

if (!mongoUri || !targetDatabaseName) {
  console.error("MONGODB_URI and MONGODB_DB must be set in .env.local.");
  process.exit(1);
}

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

type SourceProduct = {
  name: string;
  normalizedName: string;
  createdAt?: Date;
};

async function main() {
  const client = new MongoClient(mongoUri);

  try {
    await client.connect();

    const sourceDb = client.db(sourceDatabaseName);
    const targetDb = client.db(targetDatabaseName);
    const sourceProducts = await sourceDb
      .collection<SourceProduct>("products")
      .find({ storeId: { $exists: false }, name: { $type: "string" } })
      .toArray();

    const productsByName = new Map<string, SourceProduct>();
    for (const product of sourceProducts) {
      const name = product.name.trim();
      const normalizedName = normalizeName(name);
      if (!name || name.length > 100) {
        throw new Error(`Invalid source product name: ${JSON.stringify(product.name)}`);
      }
      if (!productsByName.has(normalizedName)) {
        productsByName.set(normalizedName, {
          name,
          normalizedName,
          createdAt: product.createdAt,
        });
      }
    }

    if (productsByName.size === 0) {
      console.log(`No global products found in database ${sourceDatabaseName}.`);
      return;
    }

    console.log(
      `${applyChanges ? "Importing" : "Dry run:"} ${productsByName.size} shared products from ${sourceDatabaseName} into ${targetDatabaseName}.`,
    );

    if (!applyChanges) {
      console.log("No database changes made. Run with --apply to import.");
      return;
    }

    const targetProducts = targetDb.collection("products");
    await targetProducts.createIndex({ normalizedName: 1 }, { unique: true });

    const products = [...productsByName.values()];
    const result = await targetProducts.bulkWrite(
      products.map((product) => ({
        updateOne: {
          filter: { normalizedName: product.normalizedName },
          update: {
            $setOnInsert: {
              _id: new ObjectId(),
              name: product.name,
              normalizedName: product.normalizedName,
              createdAt: product.createdAt ?? new Date(),
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );

    console.log(`Import complete: ${result.upsertedCount} new shared products added.`);
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Product import failed.");
  process.exitCode = 1;
});