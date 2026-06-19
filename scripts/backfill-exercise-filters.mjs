#!/usr/bin/env node
/**
 * Backfill location & difficulty on exercises from cached JSON.
 *
 * Usage:
 *   node scripts/backfill-exercise-filters.mjs
 *   node scripts/backfill-exercise-filters.mjs --remote
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import {
  classifyExerciseDifficulty,
  classifyExerciseLocation,
} from "./lib/classify-exercise.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(API_ROOT, "data", "exercisedb");
const EXERCISES_FILE = path.join(DATA_DIR, "exercises.json");

function sqlEscape(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function main() {
  const remote = process.argv.includes("--remote");
  const target = remote ? "--remote" : "--local -c wrangler.dev.toml";

  const payload = JSON.parse(await readFile(EXERCISES_FILE, "utf8"));
  const exercises = payload.exercises ?? [];

  const statements = exercises.map((exercise) => {
    const equipments = exercise.equipments ?? [];
    const location = classifyExerciseLocation(equipments);
    const difficulty = classifyExerciseDifficulty(exercise.name, equipments);
    exercise.location = location;
    exercise.difficulty = difficulty;

    return `UPDATE exercises SET
      equipments_json = ${sqlEscape(JSON.stringify(equipments))},
      location = ${sqlEscape(location)},
      difficulty = ${sqlEscape(difficulty)},
      updated_at = datetime('now')
    WHERE id = ${sqlEscape(exercise.id)};`;
  });

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(
    EXERCISES_FILE,
    `${JSON.stringify({ ...payload, count: exercises.length, exercises }, null, 2)}\n`,
    "utf8",
  );

  const chunkSize = 50;
  for (let i = 0; i < statements.length; i += chunkSize) {
    const sqlFile = path.join(DATA_DIR, `_backfill_filters_${i}.sql`);
    await writeFile(sqlFile, statements.slice(i, i + chunkSize).join("\n"), "utf8");
    execSync(`npx wrangler d1 execute trainforge-db ${target} --file=${sqlFile}`, {
      cwd: API_ROOT,
      stdio: "inherit",
    });
    console.log(`Updated ${Math.min(i + chunkSize, statements.length)} / ${statements.length}`);
  }

  console.log(`Backfilled filters for ${exercises.length} exercises (${remote ? "remote" : "local"}).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
