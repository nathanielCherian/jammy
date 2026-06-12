import { useCallback, useEffect, useRef, useState } from 'react';
import { Track, PlaybackState } from '../types';
import { INITIAL_TRACKS } from '../data/tracks';
import { SONG_DURATION } from '../constants';
import { AudioEngine } from './audioEngine';
import { Recorder } from './recorder';

const REC_COLORS = ['#ff7043', '#ab47bc', '#26a69a', '#ef5350', '#7e57c2', '#26c6da'];

export function useAudioEngine() {
  const [tracks, setTracks] = useState<Track[]>(INITIAL_TRACKS);
  const [playbackState, setPlaybackState] = useState<PlaybackState>('stopped');
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
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

  useEffect(() => {
    engineRef.current.loadBuffers(INITIAL_TRACKS).then(() => {
      const durations = new Map(
        INITIAL_TRACKS.map((t) => [t.id, engineRef.current.getBufferDuration(t.id)])
      );
      const buffers = new Map(
        INITIAL_TRACKS.flatMap((t) => {
          const buf = engineRef.current.getBuffer(t.id);
          return buf ? [[t.id, buf] as [string, AudioBuffer]] : [];
        })
      );
      setClipDurations(durations);
      setAudioBuffers(buffers);
      setIsLoading(false);
    });
    return () => recorderRef.current.release();
  }, []);

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
      };

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
    async (_id: string) => {
      if (playbackState === 'playing') {
        await engineRef.current.play(tracksRef.current);
      }
    },
    [playbackState]
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
  };
}
