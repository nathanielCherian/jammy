import { Track } from './types';
import { useAudioEngine } from './audio/useAudioEngine';
import { TransportBar } from './components/TransportBar/TransportBar';
import { Timeline } from './components/Timeline/Timeline';
import styles from './App.module.css';

interface Props {
  initialTracks: Track[];
  sessionCode: string;
  initialName?: string | null;
}

export default function App({ initialTracks, sessionCode, initialName = null }: Props) {
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
    deleteTrack,
    commitTrackVolume,
    seek,
    onlineCount,
    exportMix,
    isExporting,
    sessionName,
    renameSession,
  } = useAudioEngine(initialTracks, sessionCode, initialName);

  const isLocked = playbackState === 'playing' || playbackState === 'recording';

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
        onExportMp3={exportMix}
        isExporting={isExporting}
        sessionName={sessionName}
        onRenameSession={renameSession}
      />
      <Timeline
        tracks={tracks}
        clipDurations={clipDurations}
        audioBuffers={audioBuffers}
        currentTime={currentTime}
        isLocked={isLocked}
        onSeek={seek}
        onTrackStartTimeChange={setTrackStartTime}
        onCommitStartTime={commitTrackStartTime}
        onTrackVolumeChange={setTrackVolume}
        onCommitTrackVolume={commitTrackVolume}
        onToggleTrackEnabled={toggleTrackEnabled}
        onUploadRecording={uploadRecording}
        onDiscardRecording={discardRecording}
        onDeleteTrack={deleteTrack}
      />
    </div>
  );
}
