import alasql from "alasql";

/**
 * In-memory SQL database (AlaSQL).
 *
 * Lives in the memory of the running server process. On Vercel this means data
 * survives as long as the function instance stays warm and is lost on cold
 * starts / redeploys. Swap this module for Postgres/Turso if you need durability.
 */

export type Participant = {
  id: string;
  groupId: string;
  name: string;
  lat: number;
  lng: number;
  updatedAt: number;
};

type Db = InstanceType<typeof alasql.Database>;

const globalForDb = globalThis as unknown as { __dinnerDb?: Db };

function createDb(): Db {
  const db = new alasql.Database("dinner");
  db.exec(`
    CREATE TABLE groups (
      id STRING PRIMARY KEY,
      createdAt NUMBER
    );
    CREATE TABLE participants (
      id STRING,
      groupId STRING,
      name STRING,
      lat NUMBER,
      lng NUMBER,
      updatedAt NUMBER
    );
  `);
  return db;
}

// Reuse across hot reloads in dev and across invocations of a warm instance.
const db: Db = globalForDb.__dinnerDb ?? (globalForDb.__dinnerDb = createDb());

function ensureGroup(groupId: string) {
  const rows = db.exec("SELECT id FROM groups WHERE id = ?", [groupId]) as unknown[];
  if (rows.length === 0) {
    db.exec("INSERT INTO groups VALUES (?, ?)", [groupId, Date.now()]);
  }
}

export function listParticipants(groupId: string): Participant[] {
  return db.exec(
    "SELECT * FROM participants WHERE groupId = ? ORDER BY updatedAt ASC",
    [groupId],
  ) as Participant[];
}

export function upsertParticipant(p: Omit<Participant, "updatedAt">): Participant {
  ensureGroup(p.groupId);
  const now = Date.now();
  const existing = db.exec(
    "SELECT id FROM participants WHERE groupId = ? AND id = ?",
    [p.groupId, p.id],
  ) as unknown[];
  if (existing.length > 0) {
    db.exec(
      "UPDATE participants SET name = ?, lat = ?, lng = ?, updatedAt = ? WHERE groupId = ? AND id = ?",
      [p.name, p.lat, p.lng, now, p.groupId, p.id],
    );
  } else {
    db.exec("INSERT INTO participants VALUES (?, ?, ?, ?, ?, ?)", [
      p.id, p.groupId, p.name, p.lat, p.lng, now,
    ]);
  }
  return { ...p, updatedAt: now };
}

export function deleteParticipant(groupId: string, id: string): void {
  db.exec("DELETE FROM participants WHERE groupId = ? AND id = ?", [groupId, id]);
}
