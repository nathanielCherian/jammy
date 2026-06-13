import { Track } from './types';

// In dev, requests go to '' (same-origin, proxied by Vite to localhost:3001).
// In production, set VITE_API_URL to the backend's public URL.
export const API_URL = import.meta.env.VITE_API_URL ?? '';

export interface Session {
  id: string;
  code: string;
  name: string | null;
  createdAt: number;
}

export async function createSession(name?: string): Promise<Session> {
  const res = await fetch(`${API_URL}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Failed to create session');
  return res.json();
}

export async function getSession(code: string): Promise<{ session: Session; tracks: Track[] }> {
  const res = await fetch(`${API_URL}/sessions/${code.toUpperCase()}`);
  if (res.status === 404) throw new Error('Session not found');
  if (!res.ok) throw new Error('Failed to load session');
  return res.json();
}

export async function patchTrack(
  code: string,
  trackId: string,
  updates: Partial<Pick<Track, 'startTime' | 'volume' | 'enabled' | 'name' | 'color'>>
): Promise<Track> {
  const res = await fetch(`${API_URL}/sessions/${code.toUpperCase()}/tracks/${trackId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Update failed');
  const { track } = await res.json();
  return track;
}

export async function uploadTrack(
  code: string,
  blob: Blob,
  meta: Pick<Track, 'name' | 'startTime' | 'volume' | 'color'>,
  socketId?: string
): Promise<Track> {
  const form = new FormData();
  form.append('file', blob, 'recording.webm');
  form.append('metadata', JSON.stringify({ ...meta, socketId }));
  const res = await fetch(`${API_URL}/sessions/${code.toUpperCase()}/tracks`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error('Upload failed');
  const { track } = await res.json();
  return { ...track, audioUrl: API_URL + track.audioUrl };
}
