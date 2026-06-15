import Database from 'better-sqlite3';
import path from 'path';
import { TrackRow, SessionRow, Track, rowToTrack, rowToSession, Session } from './types';

const DB_PATH = path.join(__dirname, '..', 'jammy.db');

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT PRIMARY KEY,
    code       TEXT UNIQUE NOT NULL,
    name       TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tracks (
    id          TEXT PRIMARY KEY,
    session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    audio_url   TEXT NOT NULL,
    start_time  REAL NOT NULL DEFAULT 0,
    volume      REAL NOT NULL DEFAULT 0.8,
    color       TEXT NOT NULL,
    enabled     INTEGER NOT NULL DEFAULT 1,
    created_at  INTEGER NOT NULL
  );
`);

try {
  db.exec('ALTER TABLE sessions ADD COLUMN locked INTEGER NOT NULL DEFAULT 0');
} catch {
  // column already exists — safe to ignore
}

export const queries = {
  insertSession: db.prepare<[string, string, string | null, number]>(
    'INSERT INTO sessions (id, code, name, created_at) VALUES (?, ?, ?, ?)'
  ),

  getSessionByCode: db.prepare<[string], SessionRow>(
    'SELECT * FROM sessions WHERE code = ?'
  ),

  getSessionById: db.prepare<[string], SessionRow>(
    'SELECT * FROM sessions WHERE id = ?'
  ),

  deleteSession: db.prepare<[string]>(
    'DELETE FROM sessions WHERE id = ?'
  ),

  updateSessionName: db.prepare<[string, string]>(
    'UPDATE sessions SET name = ? WHERE id = ?'
  ),

  codeExists: db.prepare<[string], { count: number }>(
    'SELECT COUNT(*) as count FROM sessions WHERE code = ?'
  ),

  insertTrack: db.prepare<[string, string, string, string, number, number, string, number, number]>(
    'INSERT INTO tracks (id, session_id, name, audio_url, start_time, volume, color, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ),

  getTracksBySession: db.prepare<[string], TrackRow>(
    'SELECT * FROM tracks WHERE session_id = ? ORDER BY created_at ASC'
  ),

  getTrack: db.prepare<[string, string], TrackRow>(
    'SELECT * FROM tracks WHERE id = ? AND session_id = ?'
  ),

  updateTrack: db.prepare<[number, number, number, string, string, string]>(
    'UPDATE tracks SET start_time = ?, volume = ?, enabled = ?, name = ?, color = ? WHERE id = ? RETURNING *'
  ),

  deleteTrack: db.prepare<[string, string]>(
    'DELETE FROM tracks WHERE id = ? AND session_id = ?'
  ),
};

export function createSession(id: string, code: string, name: string | null): Session {
  queries.insertSession.run(id, code, name, Date.now());
  return rowToSession(queries.getSessionById.get(id)!);
}

export function getSessionByCode(code: string): Session | null {
  const row = queries.getSessionByCode.get(code.toUpperCase());
  return row ? rowToSession(row) : null;
}

export function getSessionById(id: string): Session | null {
  const row = queries.getSessionById.get(id);
  return row ? rowToSession(row) : null;
}

export function deleteSession(id: string): void {
  queries.deleteSession.run(id);
}

export function updateSessionName(id: string, name: string): void {
  queries.updateSessionName.run(name, id);
}

export function isCodeTaken(code: string): boolean {
  return queries.codeExists.get(code)!.count > 0;
}

export function createTrack(
  id: string,
  sessionId: string,
  name: string,
  audioUrl: string,
  startTime: number,
  volume: number,
  color: string,
  enabled: boolean
): Track {
  queries.insertTrack.run(id, sessionId, name, audioUrl, startTime, volume, color, enabled ? 1 : 0, Date.now());
  return rowToTrack(queries.getTrack.get(id, sessionId)!);
}

export function getTracksBySession(sessionId: string): Track[] {
  return queries.getTracksBySession.all(sessionId).map(rowToTrack);
}

export function getTrack(id: string, sessionId: string): Track | null {
  const row = queries.getTrack.get(id, sessionId);
  return row ? rowToTrack(row) : null;
}

export function updateTrack(
  id: string,
  sessionId: string,
  changes: Partial<Pick<Track, 'startTime' | 'volume' | 'enabled' | 'name' | 'color'>>
): Track | null {
  const existing = queries.getTrack.get(id, sessionId);
  if (!existing) return null;

  const startTime = changes.startTime ?? existing.start_time;
  const volume = changes.volume ?? existing.volume;
  const enabled = changes.enabled !== undefined ? (changes.enabled ? 1 : 0) : existing.enabled;
  const name = changes.name ?? existing.name;
  const color = changes.color ?? existing.color;

  db.prepare(
    'UPDATE tracks SET start_time = ?, volume = ?, enabled = ?, name = ?, color = ? WHERE id = ? AND session_id = ?'
  ).run(startTime, volume, enabled, name, color, id, sessionId);

  return rowToTrack(queries.getTrack.get(id, sessionId)!);
}

export function deleteTrack(id: string, sessionId: string): boolean {
  const result = queries.deleteTrack.run(id, sessionId);
  return result.changes > 0;
}

export default db;
