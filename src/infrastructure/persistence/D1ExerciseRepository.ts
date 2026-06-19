import type { ExerciseDifficulty, ExerciseListQuery, ExerciseLocation, ExerciseRecord } from "@/domain/exercise";
import type { IExerciseRepository } from "@/application/ports/exercise";

function hashSeed(seed: string): number {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

type ExerciseRow = {
  id: string;
  slug: string;
  name: string;
  category: string;
  muscle_group: string | null;
  utility: string | null;
  mechanics: string | null;
  force_type: string | null;
  preparation: string | null;
  execution: string | null;
  instructions_json: string;
  equipments_json: string;
  location: ExerciseRecord["location"];
  difficulty: ExerciseRecord["difficulty"];
  source_url: string;
  thumbnail_url: string | null;
  local_thumbnail_path: string | null;
  video_url: string | null;
  vimeo_id: string | null;
  is_premium: number;
  list_seed: string | null;
  created_at: string;
  updated_at: string;
};

function toRecord(row: ExerciseRow): ExerciseRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    muscleGroup: row.muscle_group,
    utility: row.utility,
    mechanics: row.mechanics,
    forceType: row.force_type,
    preparation: row.preparation,
    execution: row.execution,
    instructions: JSON.parse(row.instructions_json) as string[],
    equipments: JSON.parse(row.equipments_json) as string[],
    location: row.location ?? "both",
    difficulty: row.difficulty ?? "medium",
    sourceUrl: row.source_url,
    thumbnailUrl: row.thumbnail_url,
    localThumbnailPath: row.local_thumbnail_path,
    videoUrl: row.video_url,
    vimeoId: row.vimeo_id,
    isPremium: row.is_premium === 1,
    listSeed: row.list_seed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class D1ExerciseRepository implements IExerciseRepository {
  constructor(private readonly db: D1Database) {}

  async list(query: ExerciseListQuery): Promise<{ items: ExerciseRecord[]; total: number }> {
    const filters: string[] = [];
    const params: unknown[] = [];

    if (query.q) {
      filters.push("LOWER(name) LIKE ?");
      params.push(`%${query.q.toLowerCase()}%`);
    }
    if (query.category) {
      filters.push("category = ?");
      params.push(query.category);
    }
    if (query.muscleGroup) {
      filters.push("muscle_group = ?");
      params.push(query.muscleGroup);
    }
    if (query.location === "home") {
      filters.push("(location = 'home' OR location = 'both')");
    } else if (query.location === "gym") {
      filters.push("(location = 'gym' OR location = 'both')");
    } else if (query.location === "both") {
      filters.push("location = 'both'");
    }
    if (query.difficulty) {
      filters.push("difficulty = ?");
      params.push(query.difficulty);
    }

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const countRow = await this.db
      .prepare(`SELECT COUNT(*) AS total FROM exercises ${where}`)
      .bind(...params)
      .first<{ total: number }>();

    const rows = await this.db
      .prepare(
        `SELECT * FROM exercises ${where} ORDER BY name ASC LIMIT ? OFFSET ?`,
      )
      .bind(...params, query.limit, query.offset)
      .all<ExerciseRow>();

    return {
      items: (rows.results ?? []).map(toRecord),
      total: countRow?.total ?? 0,
    };
  }

  async getBySlug(slug: string): Promise<ExerciseRecord | null> {
    const row = await this.db
      .prepare("SELECT * FROM exercises WHERE slug = ?")
      .bind(slug)
      .first<ExerciseRow>();

    return row ? toRecord(row) : null;
  }

  async upsertMany(exercises: ExerciseRecord[]): Promise<number> {
    if (!exercises.length) return 0;

    const statements = exercises.map((exercise) =>
      this.db
        .prepare(
          `INSERT INTO exercises (
            id, slug, name, category, muscle_group, utility, mechanics, force_type,
            preparation, execution, instructions_json, equipments_json, location, difficulty,
            source_url, thumbnail_url, local_thumbnail_path, video_url, vimeo_id, is_premium,
            list_seed, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(slug) DO UPDATE SET
            name = excluded.name,
            category = excluded.category,
            muscle_group = excluded.muscle_group,
            utility = excluded.utility,
            mechanics = excluded.mechanics,
            force_type = excluded.force_type,
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
            vimeo_id = excluded.vimeo_id,
            is_premium = excluded.is_premium,
            list_seed = excluded.list_seed,
            updated_at = datetime('now')`,
        )
        .bind(
          exercise.id,
          exercise.slug,
          exercise.name,
          exercise.category,
          exercise.muscleGroup,
          exercise.utility,
          exercise.mechanics,
          exercise.forceType,
          exercise.preparation,
          exercise.execution,
          JSON.stringify(exercise.instructions),
          JSON.stringify(exercise.equipments),
          exercise.location,
          exercise.difficulty,
          exercise.sourceUrl,
          exercise.thumbnailUrl,
          exercise.localThumbnailPath,
          exercise.videoUrl,
          exercise.vimeoId,
          exercise.isPremium ? 1 : 0,
          exercise.listSeed,
        ),
    );

    await this.db.batch(statements);
    return exercises.length;
  }

  async sampleByCategories(input: {
    categories: string[];
    location?: ExerciseLocation;
    difficulties?: ExerciseDifficulty[];
    perCategory: number;
    seed: string;
  }): Promise<Map<string, ExerciseRecord[]>> {
    const result = new Map<string, ExerciseRecord[]>();

    for (const category of input.categories) {
      const filters = ["category = ?"];
      const params: unknown[] = [category];

      if (input.location === "home") {
        filters.push("(location = 'home' OR location = 'both')");
      } else if (input.location === "gym") {
        filters.push("(location = 'gym' OR location = 'both')");
      }

      if (input.difficulties?.length) {
        const placeholders = input.difficulties.map(() => "?").join(", ");
        filters.push(`difficulty IN (${placeholders})`);
        params.push(...input.difficulties);
      }

      const where = `WHERE ${filters.join(" AND ")}`;
      const countRow = await this.db
        .prepare(`SELECT COUNT(*) AS total FROM exercises ${where}`)
        .bind(...params)
        .first<{ total: number }>();

      const total = countRow?.total ?? 0;
      if (!total) {
        result.set(category, []);
        continue;
      }

      const window = Math.max(input.perCategory * 4, 24);
      const offset = total > window ? hashSeed(`${input.seed}:${category}`) % (total - window + 1) : 0;

      const rows = await this.db
        .prepare(`SELECT * FROM exercises ${where} ORDER BY name ASC LIMIT ? OFFSET ?`)
        .bind(...params, window, offset)
        .all<ExerciseRow>();

      result.set(category, (rows.results ?? []).slice(0, input.perCategory).map(toRecord));
    }

    return result;
  }
}
