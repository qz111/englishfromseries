import { useEffect, useState } from 'react';

export function ProcessingScreen() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const removeListener = window.api.onTranscriptionProgress((p) => setProgress(Math.round(p * 100)));
    return removeListener;
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      gap: 16,
    }}>
      <p style={{ color: '#94a3b8', fontSize: 16, margin: 0 }}>Transcribing audio...</p>
      <div style={{ width: 300, height: 6, background: '#1e293b', borderRadius: 4 }}>
        <div style={{
          width: `${progress}%`,
          height: '100%',
          background: '#6366f1',
          borderRadius: 4,
          transition: 'width 0.3s',
        }} />
      </div>
      <p style={{ color: '#475569', fontSize: 13, margin: 0 }}>{progress}%</p>
    </div>
  );
}
