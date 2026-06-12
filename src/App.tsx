import { useAudioEngine } from './audio/useAudioEngine';
import { TransportBar } from './components/TransportBar/TransportBar';
import { Timeline } from './components/Timeline/Timeline';
import styles from './App.module.css';

export default function App() {
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
  } = useAudioEngine();

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
        onToggleTrackEnabled={toggleTrackEnabled}
      />
    </div>
  );
}
