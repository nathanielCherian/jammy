import { useCallback, useEffect, useRef, useState } from 'react';
import { Track, PlaybackState } from '../types';
import { INITIAL_TRACKS } from '../data/tracks';
import { SONG_DURATION } from '../constants';
import { AudioEngine } from './audioEngine';

export function useAudioEngine() {
  const [tracks, setTracks] = useState<Track[]>(INITIAL_TRACKS);
  const [playbackState, setPlaybackState] = useState<PlaybackState>('stopped');
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [clipDurations, setClipDurations] = useState<Map<string, number>>(new Map());
  const [audioBuffers, setAudioBuffers] = useState<Map<string, AudioBuffer>>(new Map());

  const engineRef = useRef(new AudioEngine());
  const rafRef = useRef(0);
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

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
  }, []);

  useEffect(() => {
    if (playbackState === 'playing') {
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

  return {
    tracks,
    clipDurations,
    audioBuffers,
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
  };
}
