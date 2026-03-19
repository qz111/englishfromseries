// src/renderer/src/components/ReviewMode/DiagnosticMenu.tsx
import { useState } from 'react';
import { Sentence } from '../../../../types/transcript';
import { useTranscriptStore } from '../../../store/transcriptStore';

interface Props {
  sentence: Sentence;
  transcript: Sentence[];
  onClose: () => void;
}

export function DiagnosticMenu({ sentence, transcript, onClose }: Props) {
  const { flagPronunciation, addVocabularyQuery, session } = useTranscriptStore();
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const idx = transcript.findIndex((s) => s.sentenceId === sentence.sentenceId);
  const prev = idx > 0 ? transcript[idx - 1] : undefined;
  const next = idx < transcript.length - 1 ? transcript[idx + 1] : undefined;

  async function handleVocabulary() {
    if (!selectedWord || !session) return;
    setLoading(true);
    setError(null);
    try {
      const aiExplanation = await window.api.callLLM({
        sentenceId: sentence.sentenceId,
        selectedWord,
        type: 'vocabulary',
        currentSentence: sentence.text,
      });
      addVocabularyQuery(sentence.sentenceId, { selectedWord, type: 'vocabulary', aiExplanation });
      const updated = useTranscriptStore.getState().session;
      if (updated) await window.api.saveSession(updated);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'LLM call failed. Try again.');
    }
    setLoading(false);
  }

  async function handleSlang() {
    if (!selectedWord || !session) return;
    setLoading(true);
    setError(null);
    try {
      const aiExplanation = await window.api.callLLM({
        sentenceId: sentence.sentenceId,
        selectedWord,
        type: 'slang',
        currentSentence: sentence.text,
        prevSentence: prev?.text,
        nextSentence: next?.text,
      });
      addVocabularyQuery(sentence.sentenceId, { selectedWord, type: 'slang', aiExplanation });
      const updated = useTranscriptStore.getState().session;
      if (updated) await window.api.saveSession(updated);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'LLM call failed. Try again.');
    }
    setLoading(false);
  }

  function handlePronunciation() {
    flagPronunciation(sentence.sentenceId);
    const updated = useTranscriptStore.getState().session;
    if (updated) window.api.saveSession(updated);
    onClose();
  }

  const existingQueries = sentence.diagnostics.vocabularyQueries;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#1e293b', borderRadius: 12, padding: 24, width: 560, maxWidth: '90vw', maxHeight: '80vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ color: '#94a3b8', fontSize: 13 }}>Diagnostic</span>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        {/* Word chips */}
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 8, marginTop: 0 }}>
          Select a word or phrase, then choose a diagnosis type:
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 16 }}>
          {sentence.words.map((w, i) => (
            <span
              key={i}
              onClick={() => setSelectedWord(selectedWord === w.word ? null : w.word)}
              style={{
                padding: '3px 8px',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 14,
                background: selectedWord === w.word ? '#6366f1' : '#0f172a',
                color: selectedWord === w.word ? '#fff' : '#94a3b8',
                userSelect: 'none',
              }}
            >
              {w.word}
            </span>
          ))}
        </div>

        {/* Three action buttons */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <button
            onClick={handlePronunciation}
            style={{
              flex: 1,
              background: 'rgba(99,102,241,0.15)',
              border: '1px solid #6366f1',
              borderRadius: 8,
              padding: '8px 12px',
              color: '#818cf8',
              cursor: 'pointer',
              fontSize: 13,
              minWidth: 120,
            }}
          >
            🔊 Pronunciation
          </button>
          <button
            onClick={handleVocabulary}
            disabled={!selectedWord || loading}
            style={{
              flex: 1,
              background: 'rgba(16,185,129,0.15)',
              border: '1px solid #10b981',
              borderRadius: 8,
              padding: '8px 12px',
              color: '#34d399',
              cursor: selectedWord && !loading ? 'pointer' : 'not-allowed',
              fontSize: 13,
              opacity: selectedWord && !loading ? 1 : 0.5,
              minWidth: 120,
            }}
          >
            📖 Vocabulary
          </button>
          <button
            onClick={handleSlang}
            disabled={!selectedWord || loading}
            style={{
              flex: 1,
              background: 'rgba(245,158,11,0.15)',
              border: '1px solid #f59e0b',
              borderRadius: 8,
              padding: '8px 12px',
              color: '#fbbf24',
              cursor: selectedWord && !loading ? 'pointer' : 'not-allowed',
              fontSize: 13,
              opacity: selectedWord && !loading ? 1 : 0.5,
              minWidth: 120,
            }}
          >
            🗣 Slang / Idiom
          </button>
        </div>

        {/* Loading / error states */}
        {loading && (
          <p style={{ color: '#64748b', fontSize: 12, margin: '0 0 12px' }}>Asking AI...</p>
        )}
        {error && (
          <p style={{ color: '#ef4444', fontSize: 12, margin: '0 0 12px' }}>
            {error}{' '}
            <button
              onClick={() => setError(null)}
              style={{ background: 'transparent', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: 12, padding: 0 }}
            >
              Dismiss
            </button>
          </p>
        )}

        {/* Existing AI explanations */}
        {existingQueries.map((q, i) => (
          <div
            key={i}
            style={{
              marginTop: 12,
              background: '#0f172a',
              borderRadius: 8,
              padding: 12,
              borderLeft: `2px solid ${q.type === 'vocabulary' ? '#10b981' : '#f59e0b'}`,
            }}
          >
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>
              <strong style={{ color: q.type === 'vocabulary' ? '#34d399' : '#fbbf24' }}>
                {q.selectedWord}
              </strong>
              {' · '}{q.type}
            </div>
            <p style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.6, margin: 0 }}>
              {q.aiExplanation}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
