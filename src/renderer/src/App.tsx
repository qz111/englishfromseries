import { useTranscriptStore } from '../store/transcriptStore';
import { LandingScreen } from './components/LandingScreen';
import { ProcessingScreen } from './components/ProcessingScreen';
import { WatchMode } from './components/WatchMode/WatchMode';
import { ReviewMode } from './components/ReviewMode/ReviewMode';
import { ReviewCenter } from './components/ReviewCenter/ReviewCenter';

export default function App() {
  const mode = useTranscriptStore((s) => s.mode);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0f172a', color: '#e2e8f0', overflow: 'hidden' }}>
      {mode === 'landing' && <LandingScreen />}
      {mode === 'processing' && <ProcessingScreen />}
      {mode === 'watch' && <WatchMode />}
      {mode === 'review' && <ReviewMode />}
      {mode === 'review-center' && <ReviewCenter />}
    </div>
  );
}
