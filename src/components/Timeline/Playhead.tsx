import { PIXELS_PER_SECOND, LABEL_WIDTH } from '../../constants';
import styles from './Timeline.module.css';

interface Props {
  currentTime: number;
}

export function Playhead({ currentTime }: Props) {
  const x = LABEL_WIDTH + currentTime * PIXELS_PER_SECOND;
  return (
    <div className={styles.playhead} style={{ transform: `translateX(${x}px)` }} />
  );
}
