export interface Track {
  id: string;
  name: string;
  audioUrl: string;
  startTime: number;
  volume: number;
  color: string;
  enabled: boolean;
  pending?: boolean; // recorded locally, not yet uploaded to backend
}

export type PlaybackState = 'stopped' | 'playing' | 'paused' | 'recording';
