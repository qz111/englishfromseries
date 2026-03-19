// src/renderer/src/components/ReviewCenter/AudioLoopDeck.tsx
import { useRef, useEffect, useState } from 'react';
import { Sentence } from '../../../../types/transcript';

interface Props {
  sentences: Sentence[];
  videoPath: string;
}

export function AudioLoopDeck({ sentences, videoPath }: Props) {
  const [index, setIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const current = sentences[index];

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !current) return;

    video.currentTime = current.startTime;
    video.play().catch(() => {});

    function handleTimeUpdate() {
      if (!video || !current) return;
      if (video.currentTime >= current.endTime) {
        video.currentTime = current.startTime;
        video.play().catch(() => {});
      }
    }

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
      video.pause();
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [index, current]);

  if (sentences.length === 0) {
    return (
      <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>
        No sentences flagged for pronunciation review.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: '#0f172a', borderRadius: 8, padding: '10px 14px', borderLeft: '2px solid #6366f1' }}>
        <p style={{ color: '#e2e8f0', fontSize: 13, margin: '0 0 4px' }}>"{current.text}"</p>
        <p style={{ color: '#475569', fontSize: 11, margin: 0 }}>
          {index + 1} of {sentences.length} · {current.startTime.toFixed(1)}s – {current.endTime.toFixed(1)}s
        </p>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={() => setIndex(Math.max(0, index - 1))}
          disabled={index === 0}
          style={{
            background: '#1e293b',
            color: index === 0 ? '#334155' : '#94a3b8',
            border: '1px solid #334155',
            borderRadius: 6,
            padding: '6px 16px',
            cursor: index === 0 ? 'not-allowed' : 'pointer',
            fontSize: 13,
          }}
        >
          ← Prev
        </button>
        <button
          onClick={() => setIndex(Math.min(sentences.length - 1, index + 1))}
          disabled={index === sentences.length - 1}
          style={{
            background: '#1e293b',
            color: index === sentences.length - 1 ? '#334155' : '#94a3b8',
            border: '1px solid #334155',
            borderRadius: 6,
            padding: '6px 16px',
            cursor: index === sentences.length - 1 ? 'not-allowed' : 'pointer',
            fontSize: 13,
          }}
        >
          Next →
        </button>
      </div>
      {/* Hidden video element for audio playback */}
      <video
        ref={videoRef}
        src={`file://${videoPath}`}
        style={{ display: 'none' }}
      />
    </div>
  );
}
