import { useState, useEffect } from 'react';
import { useTranscriptStore } from '../../store/transcriptStore';
import { SettingsScreen } from './SettingsScreen';

interface SessionEntry {
  videoPath: string;
  exists: boolean;
}

function fileName(videoPath: string): string {
  return videoPath.split(/[\\/]/).pop() ?? videoPath;
}

export function LandingScreen() {
  const { setMode, loadSession } = useTranscriptStore();
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [sessions, setSessions] = useState<SessionEntry[]>([]);

  useEffect(() => {
    window.api.listSessions().then(setSessions).catch(() => {});
  }, []);

  async function handleOpen() {
    setError(null);
    const videoPath = await window.api.openVideoDialog();
    if (!videoPath) return;

    const existing = await window.api.loadSession(videoPath);
    if (existing) {
      window.api.saveSession(existing); // update index so this entry moves to top
      loadSession(existing);
      setMode('review');
      return;
    }

    setMode('processing');
    try {
      const sentences = await window.api.startTranscription(videoPath);
      const session = {
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

  async function handleOpenRecent(videoPath: string) {
    setError(null);
    const session = await window.api.loadSession(videoPath);
    if (!session) {
      setError('Session not found — please re-import this video.');
      return;
    }
    window.api.saveSession(session); // update index so this entry moves to top
    loadSession(session);
    setMode('review');
  }

  async function handleDismiss(videoPath: string) {
    setSessions((prev) => prev.filter((s) => s.videoPath !== videoPath));
    window.api.removeSessionPath(videoPath).catch(() => {});
  }

  return (
    <>
      {showSettings && <SettingsScreen onClose={() => setShowSettings(false)} />}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 24,
        position: 'relative',
      }}>
        <button
          onClick={() => setShowSettings(true)}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'transparent',
            border: '1px solid #334155',
            borderRadius: 6,
            padding: '6px 14px',
            color: '#64748b',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          ⚙ Settings
        </button>

        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>
          Immersive English Player
        </h1>
        <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>
          Watch local videos and learn from every sentence.
        </p>

        {sessions.length > 0 && (
          <div style={{ width: 420 }}>
            <p style={{ color: '#94a3b8', fontSize: 12, margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: 1 }}>
              Recent Videos
            </p>
            <div style={{
              maxHeight: 240,
              overflowY: 'auto',
              border: '1px solid #1e293b',
              borderRadius: 8,
              background: '#0f172a',
            }}>
              {sessions.map((s) => (
                <div
                  key={s.videoPath}
                  onClick={s.exists ? () => handleOpenRecent(s.videoPath) : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    cursor: s.exists ? 'pointer' : 'default',
                    borderBottom: '1px solid #1e293b',
                    opacity: s.exists ? 1 : 0.5,
                  }}
                >
                  <span style={{ fontSize: 14, flexShrink: 0 }}>
                    {s.exists ? '▶' : '⚠'}
                  </span>
                  <span style={{
                    flex: 1,
                    fontSize: 13,
                    color: s.exists ? '#e2e8f0' : '#64748b',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {fileName(s.videoPath)}
                  </span>
                  {!s.exists && (
                    <span style={{ fontSize: 11, color: '#64748b', flexShrink: 0 }}>
                      File missing
                    </span>
                  )}
                  {!s.exists && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDismiss(s.videoPath); }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#475569',
                        cursor: 'pointer',
                        fontSize: 14,
                        padding: '0 2px',
                        flexShrink: 0,
                        lineHeight: 1,
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

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
          + Import New Video
        </button>

        {error && (
          <p style={{ color: '#ef4444', fontSize: 13, margin: 0, maxWidth: 420, textAlign: 'center' }}>
            {error}
          </p>
        )}
      </div>
    </>
  );
}
