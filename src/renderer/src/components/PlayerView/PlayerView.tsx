// src/renderer/src/components/PlayerView/PlayerView.tsx
import { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { useTranscriptStore } from '../../../store/transcriptStore';
import { VideoPlayer, VideoPlayerHandle } from '../WatchMode/VideoPlayer';
import { TranscriptPanel } from '../ReviewMode/TranscriptPanel';
import { DiagnosticMenu } from '../ReviewMode/DiagnosticMenu';
import { Sentence } from '../../../../types/transcript';
import { getActiveSentenceId } from '../../utils/transcript';

export function PlayerView() {
  const { session, mode, setMode, toggleMark } = useTranscriptStore();
  const videoRef = useRef<VideoPlayerHandle>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Sentence | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoWidthPct, setVideoWidthPct] = useState(65);

  const markedCount = session?.transcript.filter((s) => s.isMarkedByUser).length ?? 0;

  const activeSentenceId = useMemo(
    () => getActiveSentenceId(session?.transcript ?? [], currentTime),
    [currentTime, session?.transcript]
  );

  // Mark the sentence at the current playback position
  const handleMark = useCallback(() => {
    if (!session || !videoRef.current) return; // internal guard — safe when session is null
    const time = videoRef.current.currentTime();
    const sentence = session.transcript.find(
      (s) => time >= s.startTime && time <= s.endTime
    );
    if (sentence && !sentence.isMarkedByUser) {
      toggleMark(sentence.sentenceId);
      const updated = useTranscriptStore.getState().session;
      if (updated) window.api.saveSession(updated);
    }
  }, [session, toggleMark]);

  // Seek to a sentence; also write currentTime directly to avoid a one-tick
  // lag before the next timeupdate event fires (which would delay transcript scroll)
  const handleSeek = useCallback((s: Sentence) => {
    videoRef.current?.seek(s.startTime);
    setCurrentTime(s.startTime);
  }, []); // videoRef and setCurrentTime are both stable

  const handleDiagnose = useCallback((s: Sentence) => {
    setSelected(s);
  }, []); // setSelected is stable

  const handleToggleMark = useCallback((s: Sentence) => {
    toggleMark(s.sentenceId);
    const updated = useTranscriptStore.getState().session;
    if (updated) window.api.saveSession(updated);
  }, [toggleMark]);

  // Drag the divider between video and transcript to resize panels
  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    function onMouseMove(ev: MouseEvent) {
      if (!mainContentRef.current) return;
      const rect = mainContentRef.current.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setVideoWidthPct(Math.min(85, Math.max(25, pct)));
    }
    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  // Keyboard handler is mode-agnostic: Space plays/pauses, R marks sentence
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

  // Guard comes AFTER all hooks
  if (!session) return null;

  const isReview = mode === 'review';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>

      {/* ReviewMode top bar — only rendered in review mode */}
      {isReview && (
        <div style={{
          display: 'flex',
          background: '#1e293b',
          padding: '8px 16px',
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
      )}

      {/* Main content row */}
      <div ref={mainContentRef} style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Video container — full width in watch, user-resizable in review */}
        <div style={{
          width: isReview ? `${videoWidthPct}%` : '100%',
          background: '#000',
          flexShrink: 0,
        }}>
          <VideoPlayer
            ref={videoRef}
            videoPath={session.videoPath}
            onTimeUpdate={setCurrentTime}
          />
        </div>

        {/* Draggable divider — only in review mode */}
        {isReview && (
          <div
            onMouseDown={handleDividerMouseDown}
            style={{
              width: 4,
              flexShrink: 0,
              cursor: 'col-resize',
              background: '#1e293b',
            }}
          />
        )}

        {/* Transcript panel wrapper — hidden in watch mode */}
        {/* display: block (not flex) so TranscriptPanel fills full wrapper width */}
        <div style={{
          display: isReview ? 'block' : 'none',
          flex: 1,
          background: '#0f172a',
          overflow: 'hidden',
        }}>
          <TranscriptPanel
            sentences={session.transcript}
            activeSentenceId={activeSentenceId}
            onSeekSentence={handleSeek}
            onDiagnoseSentence={handleDiagnose}
            onToggleMark={handleToggleMark}
          />
        </div>
      </div>

      {/* WatchMode bottom toolbar — only rendered in watch mode */}
      {!isReview && (
        <div style={{
          display: 'flex',
          background: '#1e293b',
          padding: '10px 16px',
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
      )}

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
