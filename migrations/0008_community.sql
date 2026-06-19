-- Phase 10 — community forums

CREATE TABLE IF NOT EXISTS forum_threads (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  moderation_flag TEXT NOT NULL DEFAULT 'none' CHECK (moderation_flag IN ('none', 'hidden', 'locked')),
  reply_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS forum_posts (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES forum_threads (id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  moderation_flag TEXT NOT NULL DEFAULT 'none' CHECK (moderation_flag IN ('none', 'hidden')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_forum_threads_updated ON forum_threads (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_posts_thread ON forum_posts (thread_id, created_at ASC);
