import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSession } from '../../api';
import styles from './SessionLanding.module.css';

export default function SessionLanding() {
  const navigate = useNavigate();
  useEffect(() => { document.title = 'Jammy — Collaborative Browser DAW'; }, []);

  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    try {
      const session = await createSession();
      navigate(`/session/${session.code}`);
    } catch {
      setError('Could not reach the server. Is the backend running?');
      setCreating(false);
    }
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) {
      setError('Session codes are 6 characters.');
      return;
    }
    navigate(`/session/${code}`);
  };

  return (
    <div className={styles.page}>
      <footer className={styles.footer}>
        Created by{' '}
        <a href="https://nathanielc.com/" target="_blank" rel="noopener noreferrer">
          Nathaniel Cherian
        </a>
      </footer>
      <div className={styles.card}>
        <h1 className={styles.logo}>JAMMY</h1>
        <p className={styles.tagline}>Collaborative audio recording in the browser</p>

        <div className={styles.section}>
          <button className={styles.primaryBtn} onClick={handleCreate} disabled={creating}>
            {creating ? 'Creating…' : 'New session'}
          </button>
          <p className={styles.hint}>Get a shareable code to send to collaborators</p>
        </div>

        <div className={styles.divider}><span>or</span></div>

        <form className={styles.section} onSubmit={handleJoin}>
          <input
            className={styles.input}
            type="text"
            placeholder="Enter session code"
            value={joinCode}
            onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setError(''); }}
            maxLength={6}
            spellCheck={false}
            autoCapitalize="characters"
          />
          <button className={styles.secondaryBtn} type="submit">
            Join session
          </button>
        </form>

        {error && <p className={styles.error}>{error}</p>}
      </div>
    </div>
  );
}
