-- TrainForge D1 schema v003 — training plans

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('generating', 'ready', 'failed')),
  week_start TEXT NOT NULL,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS plan_days (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES plans (id) ON DELETE CASCADE,
  day_index INTEGER NOT NULL,
  scheduled_date TEXT NOT NULL,
  title TEXT NOT NULL,
  focus TEXT,
  estimated_minutes INTEGER NOT NULL,
  sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS plan_exercises (
  id TEXT PRIMARY KEY,
  plan_day_id TEXT NOT NULL REFERENCES plan_days (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sets INTEGER,
  reps TEXT,
  duration_seconds INTEGER,
  notes TEXT,
  sort_order INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_plans_user_id ON plans (user_id);
CREATE INDEX IF NOT EXISTS idx_plans_user_created ON plans (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plan_days_plan_id ON plan_days (plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_exercises_day_id ON plan_exercises (plan_day_id);
