import { useRef, useState, useEffect } from 'react';
import { Track } from '../../types';
import { PIXELS_PER_SECOND, TRACK_HEIGHT } from '../../constants';
import styles from './Timeline.module.css';

const CLIP_PADDING = 10; // top + bottom px from lane edge
const CLIP_HEIGHT = TRACK_HEIGHT - CLIP_PADDING * 2;

interface Props {
  track: Track;
  clipDuration: number;
  audioBuffer?: AudioBuffer;
  isLocked: boolean;
  onStartTimeChange: (id: string, newStart: number) => void;
  onCommit: (id: string) => void;
  onUpload: (id: string) => void;
  onDiscard: (id: string) => void;
}

export function Clip({ track, clipDuration, audioBuffer, isLocked, onStartTimeChange, onCommit, onUpload, onDiscard }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const originalStart = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const left = track.startTime * PIXELS_PER_SECOND;
  const width = Math.max(40, clipDuration * PIXELS_PER_SECOND);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioBuffer) return;
    drawWaveform(canvas, audioBuffer, width, CLIP_HEIGHT);
  }, [audioBuffer, width]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isLocked) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartX.current = e.clientX;
    originalStart.current = track.startTime;
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const deltaPixels = e.clientX - dragStartX.current;
    const deltaSeconds = deltaPixels / PIXELS_PER_SECOND;
    const newStart = Math.max(0, originalStart.current + deltaSeconds);
    onStartTimeChange(track.id, newStart);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    onCommit(track.id);
  };

  return (
    <div
      className={`${styles.clip} ${isDragging ? styles.clipDragging : ''} ${track.pending ? styles.clipPending : ''} ${isLocked ? styles.clipLocked : ''}`}
      style={{
        left,
        width,
        background: track.color,
        borderColor: lighten(track.color),
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <canvas
        ref={canvasRef}
        className={styles.waveform}
        width={width}
        height={CLIP_HEIGHT}
      />
      <span className={styles.clipLabel}>{track.name}</span>
      {track.pending && (
        <div className={styles.pendingActions} onPointerDown={(e) => e.stopPropagation()}>
          <button
            className={`${styles.pendingBtn} ${styles.pendingUpload}`}
            onClick={(e) => { e.stopPropagation(); onUpload(track.id); }}
            title="Upload recording"
          >
            ↑ Upload
          </button>
          <button
            className={`${styles.pendingBtn} ${styles.pendingDiscard}`}
            onClick={(e) => { e.stopPropagation(); onDiscard(track.id); }}
            title="Discard recording"
          >
            ✕ Discard
          </button>
        </div>
      )}
    </div>
  );
}

function drawWaveform(canvas: HTMLCanvasElement, buffer: AudioBuffer, width: number, height: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const data = buffer.getChannelData(0);
  const step = Math.max(1, Math.floor(data.length / width));
  const amp = height / 2;

  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1;

  for (let x = 0; x < width; x++) {
    let min = 0;
    let max = 0;
    const start = x * step;
    for (let i = 0; i < step; i++) {
      const s = data[start + i] ?? 0;
      if (s < min) min = s;
      if (s > max) max = s;
    }
    ctx.beginPath();
    ctx.moveTo(x + 0.5, amp - max * amp);
    ctx.lineTo(x + 0.5, amp - min * amp);
    ctx.stroke();
  }
}

function lighten(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + 50);
  const g = Math.min(255, ((n >> 8) & 0xff) + 50);
  const b = Math.min(255, (n & 0xff) + 50);
  return `rgb(${r},${g},${b})`;
}
