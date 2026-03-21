// src/renderer/src/components/ReviewMode/ReviewMode.tsx
import { useRef, useState, useMemo } from 'react';
import { useTranscriptStore } from '../../../store/transcriptStore';
import { VideoPlayer, VideoPlayerHandle } from '../WatchMode/VideoPlayer';
import { TranscriptPanel } from './TranscriptPanel';
import { Sentence } from '../../../../types/transcript';
import { DiagnosticMenu } from './DiagnosticMenu';
import { getActiveSentenceId } from '../../utils/transcript';

export function ReviewMode() {
  const { session, setMode } = useTranscriptStore();
  const videoRef = useRef<VideoPlayerHandle>(null);
  const [selected, setSelected] = useState<Sentence | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  const activeSentenceId = useMemo(
    () => getActiveSentenceId(session?.transcript ?? [], currentTime),
    [currentTime, session?.transcript]
  );

  if (!session) return null;

  function handleSeek(s: Sentence) {
    videoRef.current?.seek(s.startTime);
    setCurrentTime(s.startTime);
  }

  function handleDiagnose(s: Sentence) {
    setSelected(s);
  }

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
          <VideoPlayer
            ref={videoRef}
            videoPath={session.videoPath}
            onTimeUpdate={setCurrentTime}
          />
        </div>
        {/* Right: transcript ~45% */}
        <div style={{ flex: 1, borderLeft: '1px solid #1e293b', background: '#0f172a', overflow: 'hidden' }}>
          <TranscriptPanel
            sentences={session.transcript}
            activeSentenceId={activeSentenceId}
            onSeekSentence={handleSeek}
            onDiagnoseSentence={handleDiagnose}
          />
        </div>
      </div>

      {selected && (
        <DiagnosticMenu
          sentence={selected}
          transcript={session.transcript}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
