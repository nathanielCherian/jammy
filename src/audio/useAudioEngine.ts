import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Track, PlaybackState } from '../types';
import { SONG_DURATION } from '../constants';
import { AudioEngine } from './audioEngine';
import { Recorder } from './recorder';
import { API_URL, uploadTrack, deleteTrack as deleteTrackApi, updateSessionName as updateSessionNameApi } from '../api';
import { encodeToMp3 } from './mp3Encoder';

const REC_COLORS = ['#ff7043', '#ab47bc', '#26a69a', '#ef5350', '#7e57c2', '#26c6da'];

export function useAudioEngine(initialTracks: Track[] = [], sessionCode = '', initialName: string | null = null, initialLocked = false) {
  const [tracks, setTracks] = useState<Track[]>(initialTracks);
  const [playbackState, setPlaybackState] = useState<PlaybackState>('stopped');
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(initialTracks.length > 0);
  const [clipDurations, setClipDurations] = useState<Map<string, number>>(new Map());
  const [audioBuffers, setAudioBuffers] = useState<Map<string, AudioBuffer>>(new Map());
  const [monitorEnabled, setMonitorEnabled] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [sessionName, setSessionName] = useState<string | null>(initialName);
  const [sessionLocked] = useState(initialLocked);

  const engineRef = useRef(new AudioEngine());
  const recorderRef = useRef(new Recorder());
  const rafRef = useRef(0);
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

  const [onlineCount, setOnlineCount] = useState(1);
  const socketRef = useRef<Socket | null>(null);

  const clipDurationsRef = useRef(clipDurations);
  clipDurationsRef.current = clipDurations;

  const playbackStateRef = useRef(playbackState);
  playbackStateRef.current = playbackState;

  const pendingSocketUpdatesRef = useRef<Array<() => void>>([]);

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
    if (!sessionCode) return;
    const socket = io();
    socketRef.current = socket;
    socket.emit('join', { code: sessionCode });

    socket.on('session:state', ({ onlineCount: n }: { onlineCount: number }) => setOnlineCount(n));
    socket.on('user:joined',   ({ onlineCount: n }: { onlineCount: number }) => setOnlineCount(n));
    socket.on('user:left',     ({ onlineCount: n }: { onlineCount: number }) => setOnlineCount(n));
    socket.on('session:nameUpdated', ({ name }: { name: string }) => setSessionName(name));

    const enqueue = (fn: () => void) => {
      if (playbackStateRef.current === 'playing' || playbackStateRef.current === 'recording') {
        pendingSocketUpdatesRef.current.push(fn);
      } else {
        fn();
      }
    };

    socket.on('track:updated', ({ trackId, changes }: { trackId: string; changes: Partial<Track> }) => {
      enqueue(() => {
        setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, ...changes } : t)));
        if (changes.volume !== undefined) engineRef.current.setVolume(trackId, changes.volume);
        if (changes.enabled !== undefined) {
          const vol = tracksRef.current.find((t) => t.id === trackId)?.volume ?? 1;
          engineRef.current.setEnabled(trackId, changes.enabled, vol);
        }
      });
    });

    socket.on('track:added', ({ track }: { track: Track }) => {
      if (tracksRef.current.find((t) => t.id === track.id)) return;
      const resolved = { ...track, audioUrl: API_URL + track.audioUrl };
      enqueue(() => {
        engineRef.current.loadBuffers([resolved]).then(() => {
          const dur = engineRef.current.getBufferDuration(resolved.id);
          const buf = engineRef.current.getBuffer(resolved.id);
          setTracks((prev) => [...prev, resolved]);
          setClipDurations((prev) => new Map(prev).set(resolved.id, dur));
          if (buf) setAudioBuffers((prev) => new Map(prev).set(resolved.id, buf));
        });
      });
    });

    socket.on('track:deleted', ({ trackId }: { trackId: string }) => {
      enqueue(() => {
        engineRef.current.removeBuffer(trackId);
        setTracks((prev) => prev.filter((t) => t.id !== trackId));
        setClipDurations((prev) => { const m = new Map(prev); m.delete(trackId); return m; });
        setAudioBuffers((prev) => { const m = new Map(prev); m.delete(trackId); return m; });
      });
    });

    return () => { socket.disconnect(); socketRef.current = null; };
  }, [sessionCode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (playbackState === 'playing' || playbackState === 'recording') {
      const tick = () => {
        const t = engineRef.current.getCurrentTime();
        const endTime = tracksRef.current.reduce((max, track) => {
          const end = track.startTime + (clipDurationsRef.current.get(track.id) ?? 0);
          return end > max ? end : max;
        }, 0) || SONG_DURATION;
        if (playbackStateRef.current !== 'recording' && t >= endTime) {
          engineRef.current.stop();
          setPlaybackState('stopped');
          setCurrentTime(0);
          for (const fn of pendingSocketUpdatesRef.current) fn();
          pendingSocketUpdatesRef.current = [];
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
    for (const fn of pendingSocketUpdatesRef.current) fn();
    pendingSocketUpdatesRef.current = [];
  }, []);

  const startRecording = useCallback(async () => {
    if (sessionLocked) return;
    if (playbackState === 'stopped' || playbackState === 'paused') {
      await engineRef.current.play(tracksRef.current);
    }
    recordStartTimeRef.current = engineRef.current.getCurrentTime();
    try {
      await recorderRef.current.start();
    } catch (err) {
      engineRef.current.stop();
      setPlaybackState('stopped');
      setCurrentTime(0);
      const msg = err instanceof Error ? err.message : 'Microphone access failed';
      alert(`Recording failed: ${msg}`);
      return;
    }
    setPlaybackState('recording');
  }, [playbackState]);

  const stopRecording = useCallback(async () => {
    const blob = await recorderRef.current.stop();
    engineRef.current.stop();
    setPlaybackState('stopped');
    setCurrentTime(0);

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
    if (sessionLocked) return;
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, startTime: newStart } : t)));
  }, [sessionLocked]);

  const commitTrackStartTime = useCallback(
    async (id: string) => {
      if (sessionLocked) return;
      const track = tracksRef.current.find((t) => t.id === id);
      if (track && !track.pending && sessionCode) {
        socketRef.current?.emit('track:update', { trackId: id, changes: { startTime: track.startTime } });
      }
      if (playbackState === 'playing') {
        await engineRef.current.play(tracksRef.current);
      }
    },
    [playbackState, sessionCode]
  );

  const setTrackVolume = useCallback((id: string, volume: number) => {
    if (sessionLocked) return;
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, volume } : t)));
    engineRef.current.setVolume(id, volume);
  }, [sessionLocked]);

  const toggleTrackEnabled = useCallback((id: string) => {
    if (sessionLocked) return;
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const newEnabled = !t.enabled;
        engineRef.current.setEnabled(id, newEnabled, t.volume);
        if (!t.pending && sessionCode) {
          socketRef.current?.emit('track:update', { trackId: id, changes: { enabled: newEnabled } });
        }
        return { ...t, enabled: newEnabled };
      })
    );
  }, [sessionCode]);

  const seek = useCallback(async (time: number) => {
    if (playbackState === 'recording') return;
    engineRef.current.seek(time);
    setCurrentTime(time);
    if (playbackState === 'playing') {
      await engineRef.current.play(tracksRef.current);
    }
  }, [playbackState]);

  const commitTrackVolume = useCallback((id: string) => {
    if (sessionLocked) return;
    const track = tracksRef.current.find((t) => t.id === id);
    if (track && !track.pending && sessionCode) {
      socketRef.current?.emit('track:update', { trackId: id, changes: { volume: track.volume } });
    }
  }, [sessionCode]);

  const toggleMonitor = useCallback(() => {
    setMonitorEnabled((prev) => {
      engineRef.current.setMonitorEnabled(!prev);
      return !prev;
    });
  }, []);

  const renameSession = useCallback(async (name: string) => {
    if (sessionLocked) return;
    setSessionName(name);
    if (sessionCode) {
      updateSessionNameApi(sessionCode, name).catch((err) =>
        console.warn('Rename failed:', err)
      );
    }
  }, [sessionCode]);

  const exportMix = useCallback(async () => {
    setIsExporting(true);
    try {
      const audioBuffer = await engineRef.current.exportMix(tracksRef.current);
      const blob = encodeToMp3(audioBuffer);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = sessionName ? `${sessionName} - jammy.mp3` : 'jammy-mix.mp3';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  }, []);

  const uploadRecording = useCallback(async (id: string) => {
    if (sessionLocked) return;
    const blob = pendingBlobsRef.current.get(id);
    const track = tracksRef.current.find((t) => t.id === id);
    if (!blob || !track || !sessionCode) return;

    try {
      const uploaded = await uploadTrack(sessionCode, blob, {
        name: track.name,
        startTime: track.startTime,
        volume: track.volume,
        color: track.color,
      }, socketRef.current?.id);

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

  const deleteTrack = useCallback(async (id: string) => {
    if (sessionLocked) return;
    const track = tracksRef.current.find((t) => t.id === id);
    if (!track) return;
    pendingBlobsRef.current.delete(id);
    engineRef.current.removeBuffer(id);
    setTracks((prev) => prev.filter((t) => t.id !== id));
    setClipDurations((prev) => { const m = new Map(prev); m.delete(id); return m; });
    setAudioBuffers((prev) => { const m = new Map(prev); m.delete(id); return m; });
    if (!track.pending && sessionCode) {
      deleteTrackApi(sessionCode, id, socketRef.current?.id).catch((err) =>
        console.warn('Delete failed:', err)
      );
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
    deleteTrack,
    commitTrackVolume,
    seek,
    onlineCount,
    exportMix,
    isExporting,
    sessionName,
    renameSession,
    sessionLocked,
  };
}
