CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 120),
  course TEXT NOT NULL CHECK(length(course) BETWEEN 1 AND 80),
  dueDate TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('planned','in-progress','completed')),
  notes TEXT NOT NULL CHECK(length(notes) <= 1500),
  updatedAt TEXT NOT NULL
);
