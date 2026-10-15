import { config } from "dotenv";
import { resolve } from "node:path";
import { MongoClient, ObjectId } from "mongodb";

config({ path: resolve(process.cwd(), ".env.local") });

const mongoUri = process.env.MONGODB_URI ?? "";
const databaseName = process.env.MONGODB_DB ?? "";
const applyChanges = process.argv.includes("--apply");

if (!mongoUri || !databaseName) {
  console.error("MONGODB_URI and MONGODB_DB must be set in .env.local.");
  process.exit(1);
}

type ProductDocument = {
  _id: ObjectId;
  name: string;
  normalizedName?: string;
  storeId?: string | ObjectId;
  createdAt?: Date;
};

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

async function main() {
  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    const db = client.db(databaseName);
    const products = db.collection<ProductDocument>("products");
    const inventory = db.collection("inventory_items");
    const dumpedInventory = db.collection("dumped_inventory");
    const documents = await products.find({ name: { $type: "string" } }).toArray();
    const groups = new Map<string, ProductDocument[]>();

    for (const product of documents) {
      const name = product.name.trim();
      const normalizedName = normalizeName(name);
      if (!name || name.length > 100) {
        throw new Error(`Invalid product name: ${JSON.stringify(product.name)}`);
      }
      const group = groups.get(normalizedName) ?? [];
      group.push({ ...product, name, normalizedName });
      groups.set(normalizedName, group);
    }

    const referenceCounts = new Map<string, number>();
    for (const product of documents) {
      const [inventoryCount, dumpedCount] = await Promise.all([
        inventory.countDocuments({ productId: product._id }),
        dumpedInventory.countDocuments({ productId: product._id }),
      ]);
      referenceCounts.set(String(product._id), inventoryCount + dumpedCount);
    }

    const plans = [...groups.entries()].map(([normalizedName, group]) => {
      const ordered = group.sort((left, right) => {
        const referenceDifference =
          (referenceCounts.get(String(right._id)) ?? 0) -
          (referenceCounts.get(String(left._id)) ?? 0);
        if (referenceDifference !== 0) return referenceDifference;
        return String(left._id).localeCompare(String(right._id));
      });
      return { normalizedName, canonical: ordered[0], duplicates: ordered.slice(1) };
    });
    const duplicateCount = plans.reduce((count, plan) => count + plan.duplicates.length, 0);

    console.log(
      `${applyChanges ? "Migrating" : "Dry run:"} ${documents.length} product records into ${groups.size} shared products; ${duplicateCount} duplicates to merge in ${databaseName}.`,
    );
    if (!applyChanges) {
      console.log("No database changes made. Run with --apply to migrate.");
      return;
    }

    const indexes = await products.listIndexes().toArray();
    const storeScopedIndex = indexes.find(
      (index) =>
        index.key.storeId === 1 && index.key.normalizedName === 1,
    );
    if (storeScopedIndex?.name) {
      await products.dropIndex(storeScopedIndex.name);
    }

    let repointedReferences = 0;
    for (const plan of plans) {
      const { canonical, normalizedName } = plan;
      for (const duplicate of plan.duplicates) {
        const inventoryRows = await inventory.find({ productId: duplicate._id }).toArray();
        for (const row of inventoryRows) {
          const existingRow = await inventory.findOne({
            storeId: row.storeId,
            productId: canonical._id,
            expiryDate: row.expiryDate,
          });
          if (existingRow) {
            await inventory.updateOne(
              { _id: existingRow._id },
              { $inc: { quantity: row.quantity }, $set: { product: canonical.name } },
            );
            await inventory.deleteOne({ _id: row._id });
          } else {
            await inventory.updateOne(
              { _id: row._id },
              { $set: { productId: canonical._id, product: canonical.name } },
            );
          }
          repointedReferences++;
        }

        const dumpedResult = await dumpedInventory.updateMany(
          { productId: duplicate._id },
          { $set: { productId: canonical._id, product: canonical.name } },
        );
        repointedReferences += dumpedResult.modifiedCount;
        await products.deleteOne({ _id: duplicate._id });
      }

      await products.updateOne(
        { _id: canonical._id },
        { $set: { name: canonical.name, normalizedName }, $unset: { storeId: "" } },
      );
    }

    await products.createIndex({ normalizedName: 1 }, { unique: true });
    console.log(
      `Migration complete: ${groups.size} shared products, ${duplicateCount} duplicates merged, ${repointedReferences} stock/history references updated.`,
    );
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Shared product migration failed.");
  process.exitCode = 1;
});