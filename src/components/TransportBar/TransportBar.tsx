import { useEffect, useRef, useState } from 'react';
import { PlaybackState } from '../../types';
import styles from './TransportBar.module.css';

interface Props {
  playbackState: PlaybackState;
  currentTime: number;
  isLoading: boolean;
  monitorEnabled: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onRecord: () => void;
  onToggleMonitor: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ds = Math.floor((seconds % 1) * 10);
  return `${m}:${String(s).padStart(2, '0')}.${ds}`;
}

export function TransportBar({
  playbackState,
  currentTime,
  isLoading,
  monitorEnabled,
  onPlay,
  onPause,
  onStop,
  onRecord,
  onToggleMonitor,
}: Props) {
  const isPlaying = playbackState === 'playing';
  const isRecording = playbackState === 'recording';
  const isPaused = playbackState === 'paused';

  // Elapsed recording time (counts up independently of playhead)
  const [recElapsed, setRecElapsed] = useState(0);
  const recStartRef = useRef<number | null>(null);
  const recRafRef = useRef(0);

  useEffect(() => {
    if (isRecording) {
      recStartRef.current = performance.now();
      setRecElapsed(0);
      const tick = () => {
        setRecElapsed((performance.now() - recStartRef.current!) / 1000);
        recRafRef.current = requestAnimationFrame(tick);
      };
      recRafRef.current = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(recRafRef.current);
    }
  }, [isRecording]);

  return (
    <div className={styles.bar}>
      <span className={styles.logo}>jammy</span>

      <div className={styles.controls}>
        <button
          className={`${styles.btn} ${styles.playPause}`}
          onClick={isPlaying || isRecording ? onPause : onPlay}
          disabled={isLoading}
          title={isPlaying || isRecording ? 'Pause' : 'Play'}
        >
          {isLoading ? (
            <span className={styles.spinner} />
          ) : isPlaying || isRecording ? (
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

      <div className={styles.divider} />

      <div className={styles.controls}>
        <button
          className={`${styles.btn} ${styles.record} ${isRecording ? styles.recordActive : ''}`}
          onClick={onRecord}
          disabled={isLoading || isPaused}
          title={isRecording ? 'Stop recording' : 'Record'}
        >
          <RecordIcon />
        </button>
        <button
          className={`${styles.btn} ${styles.monitor} ${!monitorEnabled ? styles.monitorOff : ''}`}
          onClick={onToggleMonitor}
          title={
            monitorEnabled
              ? 'Monitor ON — you hear the mix while recording. Turn off to prevent feedback from speakers.'
              : 'Monitor OFF — mix is silenced during recording.'
          }
        >
          {monitorEnabled ? <MonitorOnIcon /> : <MonitorOffIcon />}
        </button>
      </div>

      <div className={styles.divider} />

      <span className={styles.time}>{formatTime(currentTime)}</span>

      {isRecording && (
        <div className={styles.recIndicator}>
          <span className={styles.recDot} />
          <span className={styles.recLabel}>REC</span>
          <span className={styles.recTime}>{formatTime(recElapsed)}</span>
        </div>
      )}

      {isRecording && monitorEnabled && (
        <span className={styles.headphoneHint}>Use headphones to prevent feedback</span>
      )}
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

function RecordIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <circle cx="7" cy="7" r="5" />
    </svg>
  );
}

function MonitorOnIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <polygon points="2,5 6,5 10,2 10,14 6,11 2,11" />
      <path d="M12 5 Q15 8 12 11" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    </svg>
  );
}

function MonitorOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <polygon points="2,5 6,5 10,2 10,14 6,11 2,11" />
      <line x1="12" y1="4" x2="15" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
