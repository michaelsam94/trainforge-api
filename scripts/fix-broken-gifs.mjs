#!/usr/bin/env node
/**
 * Clear broken ExerciseDB GIF URLs in D1 (from data/exercisedb/broken-gifs.json).
 *
 * Usage:
 *   node scripts/fix-broken-gifs.mjs
 *   node scripts/fix-broken-gifs.mjs --remote
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_ROOT = path.resolve(__dirname, "..");
const BROKEN_FILE = path.join(API_ROOT, "data", "exercisedb", "broken-gifs.json");

function sqlEscape(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function main() {
  const remote = process.argv.includes("--remote");
  const target = remote ? "--remote -c wrangler.production.toml" : "--local";

  const payload = JSON.parse(await readFile(BROKEN_FILE, "utf8"));
  const ids = payload.broken.map((item) => item.id);
  if (!ids.length) {
    console.log("No broken GIF IDs found.");
    return;
  }

  const statements = ids.map(
    (id) => `UPDATE exercises SET thumbnail_url = NULL, video_url = NULL, local_thumbnail_path = NULL, updated_at = datetime('now') WHERE id = ${sqlEscape(id)};`,
  );

  await mkdir(path.join(API_ROOT, "data", "exercisedb"), { recursive: true });
  const sqlFile = path.join(API_ROOT, "data", "exercisedb", "_fix_broken_gifs.sql");
  await writeFile(sqlFile, statements.join("\n"), "utf8");

  execSync(`npx wrangler d1 execute trainforge-db ${target} --file=${sqlFile}`, {
    cwd: API_ROOT,
    stdio: "inherit",
  });

  console.log(`Cleared broken image URLs for ${ids.length} exercises (${remote ? "remote" : "local"} D1).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
