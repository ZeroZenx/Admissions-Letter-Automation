import { Pool, type QueryResultRow } from "pg";
import { getServerEnv } from "@/lib/env";

declare global {
  var costaattPool: Pool | undefined;
}

function getPool() {
  if (!global.costaattPool) {
    global.costaattPool = new Pool({
      connectionString: getServerEnv().DATABASE_URL
    });
  }
  return global.costaattPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
  const result = await getPool().query<T>(text, params);
  return result;
}

export async function withTransaction<T>(work: (client: import("pg").PoolClient) => Promise<T>) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const value = await work(client);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
