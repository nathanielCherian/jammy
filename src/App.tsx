import { Track } from './types';
import { useAudioEngine } from './audio/useAudioEngine';
import { TransportBar } from './components/TransportBar/TransportBar';
import { Timeline } from './components/Timeline/Timeline';
import styles from './App.module.css';

interface Props {
  initialTracks: Track[];
  sessionCode: string;
}

export default function App({ initialTracks, sessionCode }: Props) {
  const {
    tracks,
    clipDurations,
    audioBuffers,
    playbackState,
    currentTime,
    isLoading,
    monitorEnabled,
    play,
    pause,
    stop,
    startRecording,
    stopRecording,
    setTrackStartTime,
    commitTrackStartTime,
    setTrackVolume,
    toggleTrackEnabled,
    toggleMonitor,
    uploadRecording,
    discardRecording,
    commitTrackVolume,
    onlineCount,
  } = useAudioEngine(initialTracks, sessionCode);

  const handleRecord = () => {
    if (playbackState === 'recording') {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className={styles.app}>
      <TransportBar
        playbackState={playbackState}
        currentTime={currentTime}
        isLoading={isLoading}
        monitorEnabled={monitorEnabled}
        sessionCode={sessionCode}
        onlineCount={onlineCount}
        onPlay={play}
        onPause={pause}
        onStop={stop}
        onRecord={handleRecord}
        onToggleMonitor={toggleMonitor}
      />
      <Timeline
        tracks={tracks}
        clipDurations={clipDurations}
        audioBuffers={audioBuffers}
        currentTime={currentTime}
        onTrackStartTimeChange={setTrackStartTime}
        onCommitStartTime={commitTrackStartTime}
        onTrackVolumeChange={setTrackVolume}
        onCommitTrackVolume={commitTrackVolume}
        onToggleTrackEnabled={toggleTrackEnabled}
        onUploadRecording={uploadRecording}
        onDiscardRecording={discardRecording}
      />
    </div>
  );
}
