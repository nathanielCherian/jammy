export interface Track {
  id: string;
  name: string;
  audioUrl: string;
  startTime: number;
  volume: number;
  color: string;
  enabled: boolean;
}

export type PlaybackState = 'stopped' | 'playing' | 'paused' | 'recording';
