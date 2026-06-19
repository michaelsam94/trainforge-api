#!/usr/bin/env node
/**
 * Import scraped ExRx JSON into local D1 via wrangler.
 *
 * Usage:
 *   node scripts/import-exrx-to-d1.mjs
 *   node scripts/import-exrx-to-d1.mjs --file data/exrx/exercises.json
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_ROOT = path.resolve(__dirname, "..");

function sqlEscape(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function main() {
  const fileArg = process.argv.find((arg) => arg.startsWith("--file="));
  const dataFile = fileArg
    ? path.resolve(API_ROOT, fileArg.split("=")[1])
    : path.join(API_ROOT, "data", "exrx", "exercises.json");

  const payload = JSON.parse(await readFile(dataFile, "utf8"));
  const exercises = payload.exercises ?? [];
  if (!exercises.length) {
    console.error("No exercises found in", dataFile);
    process.exit(1);
  }

  const statements = exercises.map((exercise) => {
    const instructions = JSON.stringify(exercise.instructions ?? []);
    return `INSERT INTO exercises (
      id, slug, name, category, muscle_group, utility, mechanics, force_type,
      preparation, execution, instructions_json, source_url, thumbnail_url,
      local_thumbnail_path, video_url, vimeo_id, is_premium, list_seed, updated_at
    ) VALUES (
      ${sqlEscape(exercise.id)},
      ${sqlEscape(exercise.slug)},
      ${sqlEscape(exercise.name)},
      ${sqlEscape(exercise.category)},
      ${sqlEscape(exercise.muscleGroup)},
      ${sqlEscape(exercise.utility)},
      ${sqlEscape(exercise.mechanics)},
      ${sqlEscape(exercise.force)},
      ${sqlEscape(exercise.preparation)},
      ${sqlEscape(exercise.execution)},
      ${sqlEscape(instructions)},
      ${sqlEscape(exercise.sourceUrl)},
      ${sqlEscape(exercise.thumbnailUrl)},
      ${sqlEscape(exercise.localThumbnail)},
      ${sqlEscape(exercise.videoUrl)},
      ${sqlEscape(exercise.vimeoId)},
      ${exercise.isPremium ? 1 : 0},
      ${sqlEscape(exercise.listSeed)},
      datetime('now')
    ) ON CONFLICT(slug) DO UPDATE SET
      name = excluded.name,
      category = excluded.category,
      muscle_group = excluded.muscle_group,
      utility = excluded.utility,
      mechanics = excluded.mechanics,
      force_type = excluded.force_type,
      preparation = excluded.preparation,
      execution = excluded.execution,
      instructions_json = excluded.instructions_json,
      source_url = excluded.source_url,
      thumbnail_url = excluded.thumbnail_url,
      local_thumbnail_path = excluded.local_thumbnail_path,
      video_url = excluded.video_url,
      vimeo_id = excluded.vimeo_id,
      is_premium = excluded.is_premium,
      list_seed = excluded.list_seed,
      updated_at = datetime('now');`;
  });

  const chunkSize = 50;
  for (let i = 0; i < statements.length; i += chunkSize) {
    const chunk = statements.slice(i, i + chunkSize).join("\n");
    const sqlFile = path.join(API_ROOT, "data", "exrx", `_import_${i}.sql`);
    await import("node:fs/promises").then((fs) => fs.writeFile(sqlFile, chunk, "utf8"));
    execSync(`npx wrangler d1 execute trainforge-db --local -c wrangler.dev.toml --file=${sqlFile}`, {
      cwd: API_ROOT,
      stdio: "inherit",
    });
    console.log(`Imported ${Math.min(i + chunkSize, statements.length)} / ${statements.length}`);
  }

  console.log(`Done. Imported ${exercises.length} exercises into local D1.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
