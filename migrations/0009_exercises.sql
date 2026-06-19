-- TrainForge D1 schema v009 — global exercise catalog (ExRx import)

CREATE TABLE IF NOT EXISTS exercises (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  muscle_group TEXT,
  utility TEXT,
  mechanics TEXT,
  force_type TEXT,
  preparation TEXT,
  execution TEXT,
  instructions_json TEXT NOT NULL DEFAULT '[]',
  source_url TEXT NOT NULL,
  thumbnail_url TEXT,
  local_thumbnail_path TEXT,
  video_url TEXT,
  vimeo_id TEXT,
  is_premium INTEGER NOT NULL DEFAULT 0,
  list_seed TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_exercises_name ON exercises (name);
CREATE INDEX IF NOT EXISTS idx_exercises_slug ON exercises (slug);
CREATE INDEX IF NOT EXISTS idx_exercises_muscle_group ON exercises (muscle_group);
CREATE INDEX IF NOT EXISTS idx_exercises_category ON exercises (category);
