import { Track } from '../../types';
import { Clip } from './Clip';
import styles from './Timeline.module.css';

interface Props {
  track: Track;
  clipDuration: number;
  audioBuffer?: AudioBuffer;
  onStartTimeChange: (id: string, newStart: number) => void;
  onCommit: (id: string) => void;
  onVolumeChange: (id: string, volume: number) => void;
  onCommitVolume: (id: string) => void;
  onToggleEnabled: (id: string) => void;
  onUploadRecording: (id: string) => void;
  onDiscardRecording: (id: string) => void;
}

export function TrackLane({ track, clipDuration, audioBuffer, onStartTimeChange, onCommit, onVolumeChange, onCommitVolume, onToggleEnabled, onUploadRecording, onDiscardRecording }: Props) {
  return (
    <div className={`${styles.lane} ${!track.enabled ? styles.laneDisabled : ''}`}>
      <div className={styles.laneLabel}>
        <button
          className={`${styles.enableToggle} ${track.enabled ? styles.enableToggleOn : styles.enableToggleOff}`}
          onClick={() => onToggleEnabled(track.id)}
          title={track.enabled ? 'Disable track' : 'Enable track'}
          style={{ '--track-color': track.color } as React.CSSProperties}
        />
        <span className={styles.trackName}>{track.name}</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={track.volume}
          className={styles.volumeSlider}
          onChange={(e) => onVolumeChange(track.id, parseFloat(e.target.value))}
          onPointerUp={() => onCommitVolume(track.id)}
          title={`Volume: ${Math.round(track.volume * 100)}%`}
        />
      </div>
      <div className={styles.laneClipArea}>
        <Clip
          track={track}
          clipDuration={clipDuration}
          audioBuffer={audioBuffer}
          onStartTimeChange={onStartTimeChange}
          onCommit={onCommit}
          onUpload={onUploadRecording}
          onDiscard={onDiscardRecording}
        />
      </div>
    </div>
  );
}
