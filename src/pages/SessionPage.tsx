import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Track } from '../types';
import { getSession, API_URL } from '../api';
import App from '../App';
import styles from './SessionPage.module.css';

type Status = 'loading' | 'error' | 'ready';

export default function SessionPage() {
  const { code } = useParams<{ code: string }>();
  const [status, setStatus] = useState<Status>('loading');
  const [tracks, setTracks] = useState<Track[]>([]);

  useEffect(() => {
    if (!code) { setStatus('error'); return; }
    getSession(code)
      .then(({ tracks: remoteTracks }) => {
        const resolved = remoteTracks.map((t) => ({
          ...t,
          audioUrl: API_URL + t.audioUrl,
        }));
        setTracks(resolved);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, [code]);

  if (status === 'loading') {
    return (
      <div className={styles.center}>
        <div className={styles.spinner} />
        <p className={styles.label}>Loading session…</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={styles.center}>
        <p className={styles.errorTitle}>Session not found</p>
        <p className={styles.errorSub}>The code <strong>{code}</strong> doesn't exist.</p>
        <Link to="/" className={styles.homeLink}>← Back to home</Link>
      </div>
    );
  }

  return <App initialTracks={tracks} sessionCode={code!} />;
}
