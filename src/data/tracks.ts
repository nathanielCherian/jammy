import { Track } from '../types';

export const INITIAL_TRACKS: Track[] = [
  {
    id: 'track1',
    name: 'Track 1',
    audioUrl: '/audio/audio1.mp3',
    startTime: 0,
    volume: 0.85,
    color: '#e05252',
    enabled: false,
  },
  {
    id: 'track2',
    name: 'Track 2',
    audioUrl: '/audio/audio2.mp3',
    startTime: 2,
    volume: 0.75,
    color: '#52a8e0',
    enabled: false,
  },
  {
    id: 'track3',
    name: 'Track 3',
    audioUrl: '/audio/audio3.mp3',
    startTime: 1,
    volume: 0.75,
    color: '#52e09e',
    enabled: false,
  },
];
