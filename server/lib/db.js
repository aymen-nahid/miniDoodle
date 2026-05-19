import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { SLOT_DEFS } from "./slots.js";

let db;

export async function initDb(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS slots (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      position INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_name TEXT NOT NULL,
      slot_id TEXT NOT NULL,
      vote INTEGER NOT NULL CHECK (vote IN (0,1)),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(person_name, slot_id),
      FOREIGN KEY(slot_id) REFERENCES slots(id) ON DELETE CASCADE
    );
  `);

  const insertSlot = db.prepare(
    `INSERT INTO slots (id, label, starts_at, ends_at, position)
     VALUES (@id, @label, @starts_at, @ends_at, @position)
     ON CONFLICT(id) DO UPDATE SET
       label=excluded.label,
       starts_at=excluded.starts_at,
       ends_at=excluded.ends_at,
       position=excluded.position`
  );

  const tx = db.transaction(() => {
    for (const slot of SLOT_DEFS) insertSlot.run(slot);
  });
  tx();
}

export function listSlots() {
  return db
    .prepare("SELECT id, label, starts_at, ends_at FROM slots ORDER BY position ASC")
    .all();
}

export function getVotesByPerson(personName) {
  const rows = db
    .prepare("SELECT slot_id as slotId, vote FROM votes WHERE person_name = ?")
    .all(personName);
  const map = {};
  for (const r of rows) map[r.slotId] = Boolean(r.vote);
  return map;
}

export function upsertVotes(personName, votesMap) {
  const stmt = db.prepare(
    `INSERT INTO votes (person_name, slot_id, vote, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(person_name, slot_id)
     DO UPDATE SET vote=excluded.vote, updated_at=datetime('now')`
  );

  const slotIds = new Set(listSlots().map((s) => s.id));
  const changes = [];

  const tx = db.transaction(() => {
    for (const [slotId, vote] of Object.entries(votesMap)) {
      if (!slotIds.has(slotId)) continue;
      stmt.run(personName, slotId, vote ? 1 : 0);
      changes.push({ slotId, vote: Boolean(vote) });
    }
  });
  tx();

  return { updated: changes.length };
}

