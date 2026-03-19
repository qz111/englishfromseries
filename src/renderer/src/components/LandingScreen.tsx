import { useState } from 'react';
import { useTranscriptStore } from '../../store/transcriptStore';
import { Session, Sentence } from '../../../types/transcript';

export function LandingScreen() {
  const { setMode, loadSession } = useTranscriptStore();
  const [error, setError] = useState<string | null>(null);

  async function handleOpen() {
    setError(null);
    const videoPath = await window.api.openVideoDialog();
    if (!videoPath) return;

    // Check for existing session
    const existing = await window.api.loadSession(videoPath);
    if (existing) {
      loadSession(existing);
      setMode('review');
      return;
    }

    // New video — start transcription
    setMode('processing');
    try {
      const sentences: Sentence[] = await window.api.startTranscription(videoPath);
      const session: Session = {
        videoPath,
        createdAt: new Date().toISOString(),
        transcript: sentences,
      };
      await window.api.saveSession(session);
      loadSession(session);
      setMode('watch');
    } catch (e: unknown) {
      setMode('landing');
      setError(e instanceof Error ? e.message : 'Transcription failed.');
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      gap: 24,
    }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>
        Immersive English Player
      </h1>
      <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>
        Watch local videos and learn from every sentence.
      </p>
      <button
        onClick={handleOpen}
        style={{
          background: '#6366f1',
          color: 'white',
          border: 'none',
          borderRadius: 8,
          padding: '12px 32px',
          fontSize: 16,
          cursor: 'pointer',
          fontWeight: 600,
        }}
      >
        Open Video
      </button>
      {error && (
        <p style={{ color: '#ef4444', fontSize: 13, margin: 0, maxWidth: 400, textAlign: 'center' }}>
          {error}
        </p>
      )}
    </div>
  );
}
