// src/renderer/src/components/ReviewMode/TranscriptPanel.tsx
import { useRef, useEffect } from 'react';
import { Sentence } from '../../../../types/transcript';

interface Props {
  sentences: Sentence[];
  activeSentenceId?: string;
  onSeekSentence: (s: Sentence) => void;
  onDiagnoseSentence: (s: Sentence) => void;
  onToggleMark: (s: Sentence) => void;
}

function sentenceColor(s: Sentence, isActive: boolean): string {
  if (isActive) return '#818cf8'; // indigo — currently playing
  const hasDiagnosis =
    s.diagnostics.pronunciationFlagged || s.diagnostics.vocabularyQueries.length > 0;
  if (hasDiagnosis) return '#34d399'; // green — diagnosed
  if (s.isMarkedByUser) return '#fbbf24'; // amber — marked
  return '#475569'; // gray — untouched
}

function sentenceBorder(s: Sentence, isActive: boolean): string {
  if (isActive) return '#6366f1';
  const hasDiagnosis =
    s.diagnostics.pronunciationFlagged || s.diagnostics.vocabularyQueries.length > 0;
  if (hasDiagnosis) return '#34d399';
  if (s.isMarkedByUser) return '#fbbf24';
  return 'transparent';
}

function sentenceBackground(s: Sentence, isActive: boolean): string {
  if (isActive) return 'rgba(99,102,241,0.15)';
  const hasDiagnosis =
    s.diagnostics.pronunciationFlagged || s.diagnostics.vocabularyQueries.length > 0;
  if (hasDiagnosis) return 'rgba(52,211,153,0.08)';
  if (s.isMarkedByUser) return 'rgba(251,191,36,0.08)';
  return 'transparent';
}

function sentenceIcon(s: Sentence, isActive: boolean): string {
  if (isActive) return '▶ ';
  const hasDiagnosis =
    s.diagnostics.pronunciationFlagged || s.diagnostics.vocabularyQueries.length > 0;
  if (hasDiagnosis) return '✓ ';
  return '';
  // Note: marked sentences have no text-prefix icon — the inline ★ button is the exclusive affordance.
}

export function TranscriptPanel({
  sentences,
  activeSentenceId,
  onSeekSentence,
  onDiagnoseSentence,
  onToggleMark,
}: Props) {
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (activeSentenceId) {
      rowRefs.current.get(activeSentenceId)?.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      });
    }
  }, [activeSentenceId]);

  return (
    <div
      style={{
        overflowY: 'auto',
        padding: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        height: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: '#475569',
          padding: '0 4px',
          marginBottom: 4,
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}
      >
        Transcript
      </div>
      {sentences.map((s) => {
        const isActive = s.sentenceId === activeSentenceId;
        return (
          <div
            key={s.sentenceId}
            ref={(el) => {
              if (el) rowRefs.current.set(s.sentenceId, el);
              else rowRefs.current.delete(s.sentenceId);
            }}
            onClick={() => onSeekSentence(s)}
            style={{
              fontSize: 12,
              color: sentenceColor(s, isActive),
              padding: '6px 8px',
              borderRadius: 6,
              borderLeft: `2px solid ${sentenceBorder(s, isActive)}`,
              background: sentenceBackground(s, isActive),
              cursor: 'pointer',
              lineHeight: 1.5,
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 6,
            }}
          >
            <span style={{ flex: 1 }}>
              {sentenceIcon(s, isActive)}{s.text}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleMark(s); }}
              title={s.isMarkedByUser ? 'Remove mark' : 'Add mark'}
              style={{
                background: 'transparent',
                border: 'none',
                color: s.isMarkedByUser ? '#fbbf24' : '#475569',
                cursor: 'pointer',
                fontSize: 12,
                padding: '1px 4px',
                flexShrink: 0,
                lineHeight: 1.4,
              }}
            >
              ⚑
            </button>
            {s.isMarkedByUser && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDiagnoseSentence(s);
                }}
                title="Open diagnostic"
                style={{
                  background: 'transparent',
                  border: '1px solid #fbbf24',
                  borderRadius: 4,
                  color: '#fbbf24',
                  cursor: 'pointer',
                  fontSize: 10,
                  padding: '1px 5px',
                  flexShrink: 0,
                  lineHeight: 1.4,
                }}
              >
                ★
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
