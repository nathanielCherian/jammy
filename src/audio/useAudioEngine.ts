import { useCallback, useEffect, useRef, useState } from 'react';
import { Track, PlaybackState } from '../types';
import { SONG_DURATION } from '../constants';
import { AudioEngine } from './audioEngine';
import { Recorder } from './recorder';
import { uploadTrack, patchTrack } from '../api';

const REC_COLORS = ['#ff7043', '#ab47bc', '#26a69a', '#ef5350', '#7e57c2', '#26c6da'];

export function useAudioEngine(initialTracks: Track[] = [], sessionCode = '') {
  const [tracks, setTracks] = useState<Track[]>(initialTracks);
  const [playbackState, setPlaybackState] = useState<PlaybackState>('stopped');
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(initialTracks.length > 0);
  const [clipDurations, setClipDurations] = useState<Map<string, number>>(new Map());
  const [audioBuffers, setAudioBuffers] = useState<Map<string, AudioBuffer>>(new Map());
  const [monitorEnabled, setMonitorEnabled] = useState(true);

  const engineRef = useRef(new AudioEngine());
  const recorderRef = useRef(new Recorder());
  const rafRef = useRef(0);
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

  const recordStartTimeRef = useRef(0);
  const recordingCounterRef = useRef(0);
  const pendingBlobsRef = useRef<Map<string, Blob>>(new Map());

  useEffect(() => {
    if (initialTracks.length === 0) {
      setIsLoading(false);
      return () => recorderRef.current.release();
    }
    engineRef.current.loadBuffers(initialTracks).then(() => {
      const durations = new Map(
        initialTracks.map((t) => [t.id, engineRef.current.getBufferDuration(t.id)])
      );
      const buffers = new Map(
        initialTracks.flatMap((t) => {
          const buf = engineRef.current.getBuffer(t.id);
          return buf ? [[t.id, buf] as [string, AudioBuffer]] : [];
        })
      );
      setClipDurations(durations);
      setAudioBuffers(buffers);
      setIsLoading(false);
    });
    return () => recorderRef.current.release();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (playbackState === 'playing' || playbackState === 'recording') {
      const tick = () => {
        const t = engineRef.current.getCurrentTime();
        if (t >= SONG_DURATION) {
          engineRef.current.stop();
          setPlaybackState('stopped');
          setCurrentTime(0);
          return;
        }
        setCurrentTime(t);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(rafRef.current);
    }
  }, [playbackState]);

  const play = useCallback(async () => {
    await engineRef.current.play(tracksRef.current);
    setPlaybackState('playing');
  }, []);

  const pause = useCallback(async () => {
    await engineRef.current.pause();
    setPlaybackState('paused');
  }, []);

  const stop = useCallback(() => {
    engineRef.current.stop();
    setPlaybackState('stopped');
    setCurrentTime(0);
  }, []);

  const startRecording = useCallback(async () => {
    // Start playback if not already playing
    if (playbackState === 'stopped' || playbackState === 'paused') {
      await engineRef.current.play(tracksRef.current);
    }
    recordStartTimeRef.current = engineRef.current.getCurrentTime();
    await recorderRef.current.start();
    setPlaybackState('recording');
  }, [playbackState]);

  const stopRecording = useCallback(async () => {
    const blob = await recorderRef.current.stop();
    setPlaybackState('playing');

    try {
      const ctx = engineRef.current.getAudioContext();
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      recordingCounterRef.current += 1;
      const recNum = recordingCounterRef.current;
      const id = `rec-${recNum}`;
      const color = REC_COLORS[(recNum - 1) % REC_COLORS.length];
      const newTrack: Track = {
        id,
        name: `Rec ${recNum}`,
        audioUrl: '',
        startTime: recordStartTimeRef.current,
        volume: 0.85,
        color,
        enabled: true,
        pending: true,
      };

      pendingBlobsRef.current.set(id, blob);
      engineRef.current.addBuffer(id, audioBuffer);

      setTracks((prev) => [...prev, newTrack]);
      setClipDurations((prev) => new Map(prev).set(id, audioBuffer.duration));
      setAudioBuffers((prev) => new Map(prev).set(id, audioBuffer));
    } catch (err) {
      console.warn('Failed to decode recording:', err);
    }
  }, []);

  const setTrackStartTime = useCallback((id: string, newStart: number) => {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, startTime: newStart } : t)));
  }, []);

  const commitTrackStartTime = useCallback(
    async (id: string) => {
      const track = tracksRef.current.find((t) => t.id === id);
      if (track && !track.pending && sessionCode) {
        patchTrack(sessionCode, id, { startTime: track.startTime }).catch((err) =>
          console.warn('Failed to save track position:', err)
        );
      }
      if (playbackState === 'playing') {
        await engineRef.current.play(tracksRef.current);
      }
    },
    [playbackState, sessionCode]
  );

  const setTrackVolume = useCallback((id: string, volume: number) => {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, volume } : t)));
    engineRef.current.setVolume(id, volume);
  }, []);

  const toggleTrackEnabled = useCallback((id: string) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const newEnabled = !t.enabled;
        engineRef.current.setEnabled(id, newEnabled, t.volume);
        return { ...t, enabled: newEnabled };
      })
    );
  }, []);

  const toggleMonitor = useCallback(() => {
    setMonitorEnabled((prev) => {
      engineRef.current.setMonitorEnabled(!prev);
      return !prev;
    });
  }, []);

  const uploadRecording = useCallback(async (id: string) => {
    const blob = pendingBlobsRef.current.get(id);
    const track = tracksRef.current.find((t) => t.id === id);
    if (!blob || !track || !sessionCode) return;

    try {
      const uploaded = await uploadTrack(sessionCode, blob, {
        name: track.name,
        startTime: track.startTime,
        volume: track.volume,
        color: track.color,
      });

      // Swap the temp local track for the server-confirmed one
      pendingBlobsRef.current.delete(id);
      engineRef.current.renameBuffer(id, uploaded.id);
      setTracks((prev) =>
        prev.map((t) => (t.id === id ? { ...uploaded, enabled: t.enabled } : t))
      );
      setClipDurations((prev) => {
        const dur = prev.get(id);
        const next = new Map(prev);
        next.delete(id);
        if (dur !== undefined) next.set(uploaded.id, dur);
        return next;
      });
      setAudioBuffers((prev) => {
        const buf = prev.get(id);
        const next = new Map(prev);
        next.delete(id);
        if (buf) next.set(uploaded.id, buf);
        return next;
      });
    } catch (err) {
      console.warn('Upload failed:', err);
    }
  }, [sessionCode]);

  const discardRecording = useCallback((id: string) => {
    pendingBlobsRef.current.delete(id);
    engineRef.current.removeBuffer(id);
    setTracks((prev) => prev.filter((t) => t.id !== id));
    setClipDurations((prev) => { const m = new Map(prev); m.delete(id); return m; });
    setAudioBuffers((prev) => { const m = new Map(prev); m.delete(id); return m; });
  }, []);

  return {
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
  };
}
