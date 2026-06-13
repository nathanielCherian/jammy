import { PIXELS_PER_SECOND, SONG_DURATION, LABEL_WIDTH } from '../../constants';
import styles from './Timeline.module.css';

interface Props {
  onSeek: (time: number) => void;
}

export function TimelineRuler({ onSeek }: Props) {
  const ticks: React.ReactNode[] = [];

  for (let s = 0; s <= SONG_DURATION; s++) {
    const x = LABEL_WIDTH + s * PIXELS_PER_SECOND;
    ticks.push(
      <div key={`major-${s}`} className={styles.majorTick} style={{ left: x }}>
        <span className={styles.tickLabel}>{formatRulerTime(s)}</span>
      </div>
    );
    if (s < SONG_DURATION) {
      ticks.push(
        <div
          key={`minor-${s}`}
          className={styles.minorTick}
          style={{ left: x + PIXELS_PER_SECOND / 2 }}
        />
      );
    }
  }

  const getTime = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return Math.max(0, (e.clientX - rect.left - LABEL_WIDTH) / PIXELS_PER_SECOND);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    onSeek(getTime(e));
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons === 0) return;
    onSeek(getTime(e));
  };

  return (
    <div
      className={`${styles.ruler} ${styles.rulerInteractive}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
    >
      {ticks}
    </div>
  );
}

function formatRulerTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}
