#!/usr/bin/env node
import postgres from "postgres";
import { readFile } from "node:fs/promises";

const dbUrl = process.env.POSTGRES_URL;
if (!dbUrl) {
  console.error("POSTGRES_URL is not set.");
  process.exit(1);
}

const sql = postgres(dbUrl, {
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1") ? false : "require",
  prepare: false,
});

try {
  const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
  await sql.unsafe(schema);
  console.log("Database schema applied successfully.");
} finally {
  await sql.end({ timeout: 5 });
}
