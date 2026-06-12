import { useAudioEngine } from './audio/useAudioEngine';
import { TransportBar } from './components/TransportBar/TransportBar';
import { Timeline } from './components/Timeline/Timeline';
import styles from './App.module.css';

export default function App() {
  const {
    tracks,
    clipDurations,
    playbackState,
    currentTime,
    isLoading,
    play,
    pause,
    stop,
    setTrackStartTime,
    commitTrackStartTime,
    setTrackVolume,
    toggleTrackEnabled,
    audioBuffers,
  } = useAudioEngine();

  return (
    <div className={styles.app}>
      <TransportBar
        playbackState={playbackState}
        currentTime={currentTime}
        isLoading={isLoading}
        onPlay={play}
        onPause={pause}
        onStop={stop}
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
