-- TrainForge D1 schema v002 — sessions + onboarding

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS onboarding_responses (
  user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  goals_json TEXT NOT NULL,
  fitness_level TEXT NOT NULL,
  equipment_json TEXT NOT NULL,
  schedule_json TEXT NOT NULL,
  completed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
