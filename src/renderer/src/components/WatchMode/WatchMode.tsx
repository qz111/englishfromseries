// src/renderer/src/components/WatchMode/WatchMode.tsx
import { useRef, useEffect, useCallback } from 'react';
import { useTranscriptStore } from '../../../store/transcriptStore';
import { VideoPlayer, VideoPlayerHandle } from './VideoPlayer';

export function WatchMode() {
  const { session, markSentence, setMode } = useTranscriptStore();
  const videoRef = useRef<VideoPlayerHandle>(null);
  const markedCount = session?.transcript.filter((s) => s.isMarkedByUser).length ?? 0;

  const handleMark = useCallback(() => {
    if (!session || !videoRef.current) return;
    const currentTime = videoRef.current.currentTime();
    const sentence = session.transcript.find(
      (s) => currentTime >= s.startTime && currentTime <= s.endTime
    );
    if (sentence && !sentence.isMarkedByUser) {
      markSentence(sentence.sentenceId);
      const updated = useTranscriptStore.getState().session;
      if (updated) window.api.saveSession(updated);
    }
  }, [session, markSentence]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'r' || e.key === 'R') {
        handleMark();
      } else if (e.key === ' ') {
        e.preventDefault();
        videoRef.current?.togglePlay();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleMark]);

  if (!session) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <VideoPlayer ref={videoRef} videoPath={session.videoPath} />
      </div>
      <div style={{
        background: '#1e293b',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span style={{ color: '#64748b', fontSize: 13 }}>
          {markedCount} sentence{markedCount !== 1 ? 's' : ''} marked
        </span>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={handleMark}
            style={{
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              padding: '6px 20px',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            ● MARK [R]
          </button>
          <button
            onClick={() => setMode('review')}
            style={{
              background: 'transparent',
              color: '#94a3b8',
              border: '1px solid #334155',
              borderRadius: 6,
              padding: '6px 16px',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Review →
          </button>
        </div>
      </div>
    </div>
  );
}
