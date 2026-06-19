-- TrainForge D1 schema v006 — wearable sync

CREATE TABLE IF NOT EXISTS wearable_connections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('fitbit', 'garmin', 'apple_health')),
  external_user_id TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TEXT,
  scopes TEXT,
  consent_granted_at TEXT NOT NULL,
  consent_version TEXT NOT NULL DEFAULT '1.0',
  data_retention_days INTEGER NOT NULL DEFAULT 90,
  last_synced_at TEXT,
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'error')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wearable_connections_user_provider
  ON wearable_connections (user_id, provider);

CREATE TABLE IF NOT EXISTS wearable_metrics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT NOT NULL,
  recorded_date TEXT NOT NULL,
  synced_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wearable_metrics_unique
  ON wearable_metrics (user_id, provider, metric_type, recorded_date);

CREATE INDEX IF NOT EXISTS idx_wearable_metrics_user_date
  ON wearable_metrics (user_id, recorded_date DESC);
