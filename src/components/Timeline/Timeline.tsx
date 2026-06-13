import { Track } from '../../types';
import { PIXELS_PER_SECOND, SONG_DURATION, LABEL_WIDTH } from '../../constants';
import { TimelineRuler } from './TimelineRuler';
import { TrackLane } from './TrackLane';
import { Playhead } from './Playhead';
import styles from './Timeline.module.css';

interface Props {
  tracks: Track[];
  clipDurations: Map<string, number>;
  audioBuffers: Map<string, AudioBuffer>;
  currentTime: number;
  isLocked: boolean;
  onSeek: (time: number) => void;
  onTrackStartTimeChange: (id: string, newStart: number) => void;
  onCommitStartTime: (id: string) => void;
  onTrackVolumeChange: (id: string, volume: number) => void;
  onCommitTrackVolume: (id: string) => void;
  onToggleTrackEnabled: (id: string) => void;
  onUploadRecording: (id: string) => void;
  onDiscardRecording: (id: string) => void;
  onDeleteTrack: (id: string) => void;
}

const TOTAL_WIDTH = LABEL_WIDTH + SONG_DURATION * PIXELS_PER_SECOND + 40;

export function Timeline({
  tracks,
  clipDurations,
  audioBuffers,
  currentTime,
  isLocked,
  onSeek,
  onTrackStartTimeChange,
  onCommitStartTime,
  onTrackVolumeChange,
  onCommitTrackVolume,
  onToggleTrackEnabled,
  onUploadRecording,
  onDiscardRecording,
  onDeleteTrack,
}: Props) {
  return (
    <div className={styles.timelineScroll}>
      <div className={styles.timelineInner} style={{ width: TOTAL_WIDTH }}>
        <TimelineRuler onSeek={onSeek} />
        <div className={styles.tracksArea}>
          <Playhead currentTime={currentTime} />
          {tracks.map((track) => (
            <TrackLane
              key={track.id}
              track={track}
              clipDuration={clipDurations.get(track.id) ?? 4}
              audioBuffer={audioBuffers.get(track.id)}
              onStartTimeChange={onTrackStartTimeChange}
              onCommit={onCommitStartTime}
              isLocked={isLocked}
              onVolumeChange={onTrackVolumeChange}
              onCommitVolume={onCommitTrackVolume}
              onToggleEnabled={onToggleTrackEnabled}
              onUploadRecording={onUploadRecording}
              onDiscardRecording={onDiscardRecording}
              onDeleteTrack={onDeleteTrack}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
