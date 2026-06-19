#!/usr/bin/env node
/**
 * Import all exercises from ExerciseDB free API (no API key required).
 *
 * API docs: https://oss.exercisedb.dev/docs
 * Base URL: https://oss.exercisedb.dev/api/v1/exercises
 *
 * Usage:
 *   node scripts/import-exercisedb.mjs
 *   node scripts/import-exercisedb.mjs --skip-d1
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
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
const OUTPUT_FILE = path.join(DATA_DIR, "exercises.json");
const PROGRESS_FILE = path.join(DATA_DIR, "progress.json");
const BROKEN_FILE = path.join(DATA_DIR, "broken-gifs.json");

const API_BASE = "https://oss.exercisedb.dev/api/v1/exercises";
const PAGE_SIZE = 25;
const REQUEST_DELAY_MS = 1200;
const MAX_RETRIES = 5;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(url) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    const response = await fetch(url);
    if (response.ok) return response.json();

    if (response.status === 429 && attempt < MAX_RETRIES) {
      const waitMs = REQUEST_DELAY_MS * attempt * 3;
      console.warn(`  rate limited, waiting ${waitMs}ms (attempt ${attempt}/${MAX_RETRIES})`);
      await sleep(waitMs);
      continue;
    }

    throw new Error(`ExerciseDB API error ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }

  throw new Error("ExerciseDB API failed after retries");
}

function sqlEscape(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

function toSlug(exerciseId, name) {
  const fromName = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${exerciseId}--${fromName}`.slice(0, 120);
}

function mapExercise(item) {
  const instructions = (item.instructions ?? []).map((step) =>
    step.replace(/^Step:\d+\s*/i, "").trim(),
  );
  const equipments = item.equipments ?? [];

  return {
    id: item.exerciseId,
    slug: toSlug(item.exerciseId, item.name),
    name: item.name,
    category: item.bodyParts?.[0] ?? "general",
    muscleGroup: item.targetMuscles?.[0] ?? null,
    utility: null,
    mechanics: null,
    force: null,
    preparation: instructions[0] ?? null,
    execution: instructions.slice(1).join(" ") || null,
    instructions,
    sourceUrl: `https://oss.exercisedb.dev/exercise/${item.exerciseId}`,
    thumbnailUrl: item.gifUrl,
    localThumbnail: null,
    videoUrl: item.gifUrl,
    vimeoId: null,
    isPremium: false,
    listSeed: "exercisedb-v1",
    bodyParts: item.bodyParts ?? [],
    equipments,
    location: classifyExerciseLocation(equipments),
    difficulty: classifyExerciseDifficulty(item.name, equipments),
    targetMuscles: item.targetMuscles ?? [],
    secondaryMuscles: item.secondaryMuscles ?? [],
    gifUrl: item.gifUrl,
  };
}

async function fetchAllExercises(existing = [], resumeCursor = null) {
  const all = [...existing];
  const seen = new Set(all.map((item) => item.id));
  let after = resumeCursor ?? undefined;
  let page = 0;

  while (true) {
    page += 1;
    const url = new URL(API_BASE);
    url.searchParams.set("limit", String(PAGE_SIZE));
    if (after) url.searchParams.set("after", after);

    console.log(`Fetching page ${page}...`);
    const payload = await fetchPage(url);
    const batch = payload.data ?? [];
    const fresh = batch.map(mapExercise).filter((item) => !seen.has(item.id));

    for (const item of fresh) {
      seen.add(item.id);
      all.push(item);
    }

    console.log(`  +${fresh.length} (total ${all.length}/${payload.meta?.total ?? "?"})`);

    await writeFile(
      OUTPUT_FILE,
      `${JSON.stringify({ importedAt: new Date().toISOString(), count: all.length, exercises: all }, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      PROGRESS_FILE,
      `${JSON.stringify({
        nextCursor: payload.meta?.nextCursor ?? null,
        hasNextPage: payload.meta?.hasNextPage ?? false,
        total: payload.meta?.total ?? null,
        downloaded: all.length,
        updatedAt: new Date().toISOString(),
      }, null, 2)}\n`,
      "utf8",
    );

    if (!payload.meta?.hasNextPage || !payload.meta?.nextCursor) break;
    after = payload.meta.nextCursor;
    await sleep(REQUEST_DELAY_MS);
  }

  return all;
}

async function importToD1(exercises, remote = false) {
  const target = remote ? "--remote" : "--local -c wrangler.dev.toml";
  const statements = exercises.map((exercise) => {
    const instructions = JSON.stringify(exercise.instructions ?? []);
    const equipments = JSON.stringify(exercise.equipments ?? []);
    const location = exercise.location ?? classifyExerciseLocation(exercise.equipments ?? []);
    const difficulty =
      exercise.difficulty ?? classifyExerciseDifficulty(exercise.name, exercise.equipments ?? []);

    return `INSERT INTO exercises (
      id, slug, name, category, muscle_group, utility, mechanics, force_type,
      preparation, execution, instructions_json, equipments_json, location, difficulty,
      source_url, thumbnail_url, local_thumbnail_path, video_url, vimeo_id, is_premium,
      list_seed, updated_at
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
      ${sqlEscape(equipments)},
      ${sqlEscape(location)},
      ${sqlEscape(difficulty)},
      ${sqlEscape(exercise.sourceUrl)},
      ${sqlEscape(exercise.thumbnailUrl)},
      ${sqlEscape(exercise.localThumbnail)},
      ${sqlEscape(exercise.videoUrl)},
      ${sqlEscape(exercise.vimeoId)},
      0,
      ${sqlEscape(exercise.listSeed)},
      datetime('now')
    ) ON CONFLICT(slug) DO UPDATE SET
      id = excluded.id,
      name = excluded.name,
      category = excluded.category,
      muscle_group = excluded.muscle_group,
      preparation = excluded.preparation,
      execution = excluded.execution,
      instructions_json = excluded.instructions_json,
      equipments_json = excluded.equipments_json,
      location = excluded.location,
      difficulty = excluded.difficulty,
      source_url = excluded.source_url,
      thumbnail_url = excluded.thumbnail_url,
      local_thumbnail_path = excluded.local_thumbnail_path,
      video_url = excluded.video_url,
      list_seed = excluded.list_seed,
      updated_at = datetime('now');`;
  });

  const clearSql = path.join(DATA_DIR, "_clear.sql");
  await writeFile(clearSql, "DELETE FROM exercises WHERE list_seed != 'exercisedb-v1' OR list_seed IS NULL;\n", "utf8");
  execSync(`npx wrangler d1 execute trainforge-db ${target} --file=${clearSql}`, {
    cwd: API_ROOT,
    stdio: "inherit",
  });

  const chunkSize = 50;
  for (let i = 0; i < statements.length; i += chunkSize) {
    const chunk = statements.slice(i, i + chunkSize).join("\n");
    const sqlFile = path.join(DATA_DIR, `_import_${i}.sql`);
    await writeFile(sqlFile, chunk, "utf8");
    execSync(`npx wrangler d1 execute trainforge-db ${target} --file=${sqlFile}`, {
      cwd: API_ROOT,
      stdio: "inherit",
    });
    console.log(`Imported ${Math.min(i + chunkSize, statements.length)} / ${statements.length}`);
  }
}

async function filterInvalidExercises(exercises) {
  try {
    const payload = JSON.parse(await readFile(BROKEN_FILE, "utf8"));
    const brokenIds = new Set((payload.broken ?? []).map((item) => item.id));
    const before = exercises.length;
    const filtered = exercises.filter((exercise) => !brokenIds.has(exercise.id));
    const removed = before - filtered.length;
    if (removed) {
      console.log(`Excluded ${removed} exercises without valid GIFs`);
    }
    return filtered;
  } catch {
    return exercises;
  }
}

async function main() {
  const skipD1 = process.argv.includes("--skip-d1");
  const remote = process.argv.includes("--remote");
  const fromCache = process.argv.includes("--from-cache");
  await mkdir(DATA_DIR, { recursive: true });

  let exercises;
  if (fromCache) {
    const prior = JSON.parse(await readFile(OUTPUT_FILE, "utf8"));
    exercises = prior.exercises ?? [];
    if (!exercises.length) {
      throw new Error(`No cached exercises in ${OUTPUT_FILE}. Run without --from-cache first.`);
    }
    console.log(`Using ${exercises.length} cached exercises from ${OUTPUT_FILE}`);
  } else {
    console.log("Downloading exercises from ExerciseDB (free, no API key)...");
    let existing = [];
    let resumeCursor = null;
    try {
      const prior = JSON.parse(await readFile(OUTPUT_FILE, "utf8"));
      existing = prior.exercises ?? [];
      if (existing.length) {
        console.log(`Resuming from ${existing.length} previously downloaded exercises`);
      }
    } catch {
      // fresh import
    }
    try {
      const progress = JSON.parse(await readFile(PROGRESS_FILE, "utf8"));
      if (progress.hasNextPage && progress.nextCursor) {
        resumeCursor = progress.nextCursor;
        console.log(`Continuing after cursor ${resumeCursor}`);
      }
    } catch {
      // no progress file
    }

    exercises = await fetchAllExercises(existing, resumeCursor);

    await writeFile(
      OUTPUT_FILE,
      `${JSON.stringify({ importedAt: new Date().toISOString(), count: exercises.length, exercises }, null, 2)}\n`,
      "utf8",
    );
    console.log(`Saved ${exercises.length} exercises to ${OUTPUT_FILE}`);
  }

  if (!skipD1) {
    exercises = await filterInvalidExercises(exercises);
    console.log(`Importing into ${remote ? "remote" : "local"} D1...`);
    await importToD1(exercises, remote);
    console.log("Done.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
