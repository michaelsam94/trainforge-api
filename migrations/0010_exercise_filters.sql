-- TrainForge D1 schema v010 — exercise location & difficulty filters

ALTER TABLE exercises ADD COLUMN equipments_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE exercises ADD COLUMN location TEXT NOT NULL DEFAULT 'both';
ALTER TABLE exercises ADD COLUMN difficulty TEXT NOT NULL DEFAULT 'medium';

CREATE INDEX IF NOT EXISTS idx_exercises_location ON exercises (location);
CREATE INDEX IF NOT EXISTS idx_exercises_difficulty ON exercises (difficulty);
