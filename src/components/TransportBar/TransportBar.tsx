import { PlaybackState } from '../../types';
import styles from './TransportBar.module.css';

interface Props {
  playbackState: PlaybackState;
  currentTime: number;
  isLoading: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ds = Math.floor((seconds % 1) * 10);
  return `${m}:${String(s).padStart(2, '0')}.${ds}`;
}

export function TransportBar({ playbackState, currentTime, isLoading, onPlay, onPause, onStop }: Props) {
  const isPlaying = playbackState === 'playing';

  return (
    <div className={styles.bar}>
      <span className={styles.logo}>jammy</span>
      <div className={styles.controls}>
        <button
          className={`${styles.btn} ${styles.playPause}`}
          onClick={isPlaying ? onPause : onPlay}
          disabled={isLoading}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isLoading ? (
            <span className={styles.spinner} />
          ) : isPlaying ? (
            <PauseIcon />
          ) : (
            <PlayIcon />
          )}
        </button>
        <button
          className={`${styles.btn} ${styles.stop}`}
          onClick={onStop}
          disabled={isLoading || playbackState === 'stopped'}
          title="Stop"
        >
          <StopIcon />
        </button>
      </div>
      <span className={styles.time}>{formatTime(currentTime)}</span>
      {isLoading && <span className={styles.loadingLabel}>Loading samples…</span>}
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <polygon points="3,1 14,8 3,15" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="3" y="2" width="4" height="12" rx="1" />
      <rect x="9" y="2" width="4" height="12" rx="1" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <rect x="2" y="2" width="10" height="10" rx="1" />
    </svg>
  );
}
