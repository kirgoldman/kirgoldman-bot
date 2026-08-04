-- D1 schema for kirgoldman funnel bot

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,       -- telegram chat id
  started_at INTEGER NOT NULL,  -- unix seconds
  clicked_msg1 INTEGER DEFAULT 0,
  clicked_msg3 INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,           -- msg1_r1 | msg1_r2 | msg3 | msg3_r1 | msg3_r2 | msg4
  due_at INTEGER NOT NULL,      -- unix seconds
  sent INTEGER DEFAULT 0,
  cancelled INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_events_due ON events(due_at, sent, cancelled);
CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id, type);
