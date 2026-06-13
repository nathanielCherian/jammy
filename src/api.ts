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
