// src/renderer/src/components/ReviewMode/TranscriptPanel.tsx
import { Sentence } from '../../../../types/transcript';

interface Props {
  sentences: Sentence[];
  onClickSentence: (sentence: Sentence) => void;
}

function sentenceColor(s: Sentence): string {
  const hasDiagnosis =
    s.diagnostics.pronunciationFlagged || s.diagnostics.vocabularyQueries.length > 0;
  if (hasDiagnosis) return '#34d399'; // green — diagnosed
  if (s.isMarkedByUser) return '#fbbf24'; // amber — marked, not yet diagnosed
  return '#475569'; // gray — untouched
}

function sentenceIcon(s: Sentence): string {
  const hasDiagnosis =
    s.diagnostics.pronunciationFlagged || s.diagnostics.vocabularyQueries.length > 0;
  if (hasDiagnosis) return '✓ ';
  if (s.isMarkedByUser) return '★ ';
  return '';
}

export function TranscriptPanel({ sentences, onClickSentence }: Props) {
  return (
    <div style={{
      overflowY: 'auto',
      padding: 8,
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      height: '100%',
      boxSizing: 'border-box',
    }}>
      <div style={{ fontSize: 10, color: '#475569', padding: '0 4px', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
        Transcript
      </div>
      {sentences.map((s) => (
        <div
          key={s.sentenceId}
          onClick={() => s.isMarkedByUser && onClickSentence(s)}
          style={{
            fontSize: 12,
            color: sentenceColor(s),
            padding: '6px 8px',
            borderRadius: 6,
            borderLeft: `2px solid ${s.isMarkedByUser ? sentenceColor(s) : 'transparent'}`,
            background: s.isMarkedByUser ? `${sentenceColor(s)}14` : 'transparent',
            cursor: s.isMarkedByUser ? 'pointer' : 'default',
            lineHeight: 1.5,
          }}
        >
          {sentenceIcon(s)}{s.text}
        </div>
      ))}
    </div>
  );
}
