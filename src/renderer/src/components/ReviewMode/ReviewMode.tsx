// src/renderer/src/components/ReviewMode/ReviewMode.tsx
import { useRef, useState } from 'react';
import { useTranscriptStore } from '../../../store/transcriptStore';
import { VideoPlayer, VideoPlayerHandle } from '../WatchMode/VideoPlayer';
import { TranscriptPanel } from './TranscriptPanel';
import { Sentence } from '../../../../types/transcript';

export function ReviewMode() {
  const { session, setMode } = useTranscriptStore();
  const videoRef = useRef<VideoPlayerHandle>(null);
  const [selected, setSelected] = useState<Sentence | null>(null);

  if (!session) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Top bar */}
      <div style={{
        background: '#1e293b',
        padding: '8px 16px',
        display: 'flex',
        gap: 12,
        justifyContent: 'flex-end',
        flexShrink: 0,
      }}>
        <button
          onClick={() => setMode('watch')}
          style={{ background: 'transparent', color: '#94a3b8', border: '1px solid #334155', borderRadius: 6, padding: '4px 14px', cursor: 'pointer', fontSize: 12 }}
        >
          ← Watch
        </button>
        <button
          onClick={() => setMode('review-center')}
          style={{ background: 'transparent', color: '#94a3b8', border: '1px solid #334155', borderRadius: 6, padding: '4px 14px', cursor: 'pointer', fontSize: 12 }}
        >
          Review Center →
        </button>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: video ~55% */}
        <div style={{ width: '55%', background: '#000', flexShrink: 0 }}>
          <VideoPlayer ref={videoRef} videoPath={session.videoPath} />
        </div>
        {/* Right: transcript ~45% */}
        <div style={{ flex: 1, borderLeft: '1px solid #1e293b', background: '#0f172a', overflow: 'hidden' }}>
          <TranscriptPanel
            sentences={session.transcript}
            onClickSentence={(s) => setSelected(s)}
          />
        </div>
      </div>

      {/* Diagnostic Menu placeholder — Task 13 */}
      {selected && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setSelected(null)}
        >
          <div
            style={{ background: '#1e293b', borderRadius: 12, padding: 24, color: '#94a3b8', fontSize: 14 }}
            onClick={(e) => e.stopPropagation()}
          >
            Diagnostic Menu coming in Task 13 — sentence: "{selected.text}"
            <br /><button onClick={() => setSelected(null)} style={{ marginTop: 12, background: 'transparent', border: '1px solid #334155', color: '#94a3b8', padding: '4px 12px', borderRadius: 6, cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
