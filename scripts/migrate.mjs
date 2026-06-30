import { readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

const files = process.argv.slice(2);
if (!files.length) {
  console.error("Usage: node scripts/migrate.mjs <sql-file> [sql-file...]");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  for (const file of files) {
    const absolutePath = path.resolve(file);
    const sql = await readFile(absolutePath, "utf8");
    console.log(`Applying ${file}`);
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
  console.log("Done.");
} finally {
  await client.end();
}
