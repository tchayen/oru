CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  cli_version TEXT NOT NULL,
  command TEXT NOT NULL,
  flags TEXT NOT NULL,
  os TEXT NOT NULL,
  arch TEXT NOT NULL,
  node_version TEXT NOT NULL,
  is_ci INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  exit_code INTEGER NOT NULL
);

CREATE INDEX idx_events_received_at ON events(received_at);
CREATE INDEX idx_events_command ON events(command);
