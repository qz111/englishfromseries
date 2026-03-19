// src/renderer/src/components/ReviewCenter/ReviewCenter.tsx
import { useState } from 'react';
import { useTranscriptStore } from '../../../store/transcriptStore';
import { AudioLoopDeck } from './AudioLoopDeck';

export function ReviewCenter() {
  const { session, setMode } = useTranscriptStore();
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  if (!session) return null;

  const pronunciationSentences = session.transcript.filter(
    (s) => s.diagnostics.pronunciationFlagged
  );

  async function handleExport(format: 'markdown' | 'pdf') {
    setExporting(true);
    setExportStatus(null);
    try {
      const filePath = await window.api.exportSession(session!, format);
      setExportStatus(`Saved: ${filePath}`);
    } catch (e: unknown) {
      setExportStatus(`Export failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
    setExporting(false);
  }

  return (
    <div style={{ padding: 32, height: '100vh', overflowY: 'auto', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <h2 style={{ color: '#e2e8f0', fontSize: 20, fontWeight: 700, margin: 0 }}>
          Review Center
        </h2>
        <button
          onClick={() => setMode('review')}
          style={{
            background: 'transparent',
            color: '#94a3b8',
            border: '1px solid #334155',
            borderRadius: 6,
            padding: '6px 14px',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          ← Back to Review
        </button>
      </div>

      {/* Pronunciation Loop section */}
      <section style={{ marginBottom: 40 }}>
        <h3 style={{ color: '#94a3b8', fontSize: 14, fontWeight: 600, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>
          🔊 Pronunciation Loop
        </h3>
        <AudioLoopDeck
          sentences={pronunciationSentences}
          videoPath={session.videoPath}
        />
      </section>

      {/* Export section */}
      <section>
        <h3 style={{ color: '#94a3b8', fontSize: 14, fontWeight: 600, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>
          📤 Export Notes
        </h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => handleExport('markdown')}
            disabled={exporting}
            style={{
              background: 'rgba(99,102,241,0.15)',
              border: '1px solid #6366f1',
              borderRadius: 8,
              padding: '8px 20px',
              color: '#818cf8',
              cursor: exporting ? 'not-allowed' : 'pointer',
              fontSize: 13,
              opacity: exporting ? 0.6 : 1,
            }}
          >
            Export Markdown
          </button>
          <button
            onClick={() => handleExport('pdf')}
            disabled={exporting}
            style={{
              background: 'rgba(16,185,129,0.15)',
              border: '1px solid #10b981',
              borderRadius: 8,
              padding: '8px 20px',
              color: '#34d399',
              cursor: exporting ? 'not-allowed' : 'pointer',
              fontSize: 13,
              opacity: exporting ? 0.6 : 1,
            }}
          >
            Export PDF
          </button>
        </div>
        {exportStatus && (
          <p style={{ color: exportStatus.startsWith('Export failed') ? '#ef4444' : '#64748b', fontSize: 12, marginTop: 10 }}>
            {exportStatus}
          </p>
        )}
      </section>
    </div>
  );
}
