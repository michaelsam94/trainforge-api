#!/usr/bin/env node
/**
 * Remove exercises without valid GIFs from D1 and local cache.
 *
 * Usage:
 *   node scripts/remove-invalid-exercises.mjs
 *   node scripts/remove-invalid-exercises.mjs --remote
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(API_ROOT, "data", "exercisedb");
const BROKEN_FILE = path.join(DATA_DIR, "broken-gifs.json");
const EXERCISES_FILE = path.join(DATA_DIR, "exercises.json");

function sqlEscape(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function pruneLocalCache(invalidIds) {
  try {
    const payload = JSON.parse(await readFile(EXERCISES_FILE, "utf8"));
    const before = payload.exercises?.length ?? 0;
    payload.exercises = (payload.exercises ?? []).filter((item) => !invalidIds.has(item.id));
    payload.count = payload.exercises.length;
    payload.prunedAt = new Date().toISOString();
    await writeFile(EXERCISES_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    console.log(`Pruned local cache: ${before} -> ${payload.count}`);
  } catch {
    console.log("No local exercises cache to prune.");
  }
}

async function main() {
  const remote = process.argv.includes("--remote");
  const target = remote ? "--remote" : "--local -c wrangler.dev.toml";

  const payload = JSON.parse(await readFile(BROKEN_FILE, "utf8"));
  const ids = payload.broken.map((item) => item.id);
  if (!ids.length) {
    console.log("No invalid exercise IDs found.");
    return;
  }

  const invalidIds = new Set(ids);
  const statements = ids.map(
    (id) => `DELETE FROM exercises WHERE id = ${sqlEscape(id)};`,
  );

  await mkdir(DATA_DIR, { recursive: true });
  const sqlFile = path.join(DATA_DIR, "_remove_invalid_exercises.sql");
  await writeFile(sqlFile, statements.join("\n"), "utf8");

  execSync(`npx wrangler d1 execute trainforge-db ${target} --file=${sqlFile}`, {
    cwd: API_ROOT,
    stdio: "inherit",
  });

  await pruneLocalCache(invalidIds);

  console.log(
    `Removed ${ids.length} exercises without valid GIFs (${remote ? "remote" : "local"} D1).`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
