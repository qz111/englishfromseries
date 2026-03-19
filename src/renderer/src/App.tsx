import { useTranscriptStore } from '../store/transcriptStore';
import { LandingScreen } from './components/LandingScreen';
import { ProcessingScreen } from './components/ProcessingScreen';
import { WatchMode } from './components/WatchMode/WatchMode';

export default function App() {
  const mode = useTranscriptStore((s) => s.mode);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0f172a', color: '#e2e8f0', overflow: 'hidden' }}>
      {mode === 'landing' && <LandingScreen />}
      {mode === 'processing' && <ProcessingScreen />}
      {mode === 'watch' && <WatchMode />}
      {mode === 'review' && <div style={{ padding: 32, color: '#94a3b8' }}>Review Mode — coming in Task 12</div>}
      {mode === 'review-center' && <div style={{ padding: 32, color: '#94a3b8' }}>Review Center — coming in Task 14</div>}
    </div>
  );
}
