export interface Track {
  id: string;
  name: string;
  audioUrl: string;
  startTime: number;
  volume: number;
  color: string;
  enabled: boolean;
}

export interface Session {
  id: string;
  code: string;
  name: string | null;
  createdAt: number;
}

export interface TrackRow {
  id: string;
  session_id: string;
  name: string;
  audio_url: string;
  start_time: number;
  volume: number;
  color: string;
  enabled: number;
  created_at: number;
}

export interface SessionRow {
  id: string;
  code: string;
  name: string | null;
  created_at: number;
}

export function rowToTrack(row: TrackRow): Track {
  return {
    id: row.id,
    name: row.name,
    audioUrl: row.audio_url,
    startTime: row.start_time,
    volume: row.volume,
    color: row.color,
    enabled: row.enabled === 1,
  };
}

export function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    createdAt: row.created_at,
  };
}
