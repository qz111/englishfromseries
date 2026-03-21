# Player Mode Switch — Preserve Video Position Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix video resetting to 0:00 when switching between Watch and Review modes by merging both mode components into a single `PlayerView` that keeps one `<VideoPlayer>` instance always mounted.

**Architecture:** Replace the conditional `<WatchMode>` / `<ReviewMode>` rendering in `App.tsx` with a single `<PlayerView>` component. `PlayerView` owns one `videoRef` and renders one `<VideoPlayer>` for the lifetime of the session. WatchMode chrome (bottom toolbar) and ReviewMode chrome (top bar + transcript panel) are toggled via `display: none / flex` based on the Zustand `mode` field — no unmounting occurs.

**Tech Stack:** React 18, TypeScript, Zustand, Electron (renderer process), Vitest

**Spec:** `docs/superpowers/specs/2026-03-21-player-mode-switch-design.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| **Create** | `src/renderer/src/components/PlayerView/PlayerView.tsx` | Merged component: owns `videoRef`, renders single `<VideoPlayer>`, toggles mode chrome via CSS |
| **Modify** | `src/renderer/src/App.tsx` | Swap `<WatchMode>` + `<ReviewMode>` for `<PlayerView>` |
| **Delete** | `src/renderer/src/components/WatchMode/WatchMode.tsx` | No longer needed |
| **Delete** | `src/renderer/src/components/ReviewMode/ReviewMode.tsx` | No longer needed |
| **No change** | `src/renderer/src/components/WatchMode/VideoPlayer.tsx` | Imported as-is by `PlayerView` |
| **No change** | `src/renderer/src/components/ReviewMode/TranscriptPanel.tsx` | Imported as-is by `PlayerView` |
| **No change** | `src/renderer/src/components/ReviewMode/DiagnosticMenu.tsx` | Imported as-is by `PlayerView` |
| **No change** | `src/renderer/store/transcriptStore.ts` | No store changes |

---

## Task 1: Create `PlayerView.tsx`

**Files:**
- Create: `src/renderer/src/components/PlayerView/PlayerView.tsx`

> **Context:** This component merges `WatchMode.tsx` and `ReviewMode.tsx`. The single `<VideoPlayer>` instance is always mounted. Mode chrome is toggled via inline `display` style. `onTimeUpdate` is always wired so `activeSentenceId` is ready the moment the user enters review mode. `handleSeek` writes both to the `<video>` element and to `currentTime` state directly to avoid a one-tick lag in transcript highlighting.

> **Note on testing:** The renderer has no React component testing infrastructure (`@testing-library/react` / jsdom not configured). Component behaviour is verified by running the Electron app in Task 3. The store logic is already covered by `tests/renderer/transcriptStore.test.ts` and needs no changes.

- [ ] **Step 1: Create the file with the full implementation**

```tsx
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
  const [selected, setSelected] = useState<Sentence | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  const markedCount = session?.transcript.filter((s) => s.isMarkedByUser).length ?? 0;

  const activeSentenceId = useMemo(
    () => getActiveSentenceId(session?.transcript ?? [], currentTime),
    [currentTime, session?.transcript]
  );

  // Mark the sentence at the current playback position
  const handleMark = useCallback(() => {
    if (!session || !videoRef.current) return;
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
  function handleSeek(s: Sentence) {
    videoRef.current?.seek(s.startTime);
    setCurrentTime(s.startTime);
  }

  function handleDiagnose(s: Sentence) {
    setSelected(s);
  }

  function handleToggleMark(s: Sentence) {
    toggleMark(s.sentenceId);
    const updated = useTranscriptStore.getState().session;
    if (updated) window.api.saveSession(updated);
  }

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

  if (!session) return null;

  const isReview = mode === 'review';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>

      {/* ReviewMode top bar — hidden in watch mode */}
      <div style={{
        display: isReview ? 'flex' : 'none',
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

      {/* Main content row */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Video container — full width in watch, 55% in review */}
        <div style={{
          width: isReview ? '55%' : '100%',
          background: '#000',
          flexShrink: 0,
        }}>
          <VideoPlayer
            ref={videoRef}
            videoPath={session.videoPath}
            onTimeUpdate={setCurrentTime}
          />
        </div>

        {/* Transcript panel wrapper — hidden in watch mode */}
        {/* display toggling is on this div; TranscriptPanel has no style prop */}
        <div style={{
          display: isReview ? 'flex' : 'none',
          flex: 1,
          borderLeft: '1px solid #1e293b',
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

      {/* WatchMode bottom toolbar — hidden in review mode */}
      <div style={{
        display: isReview ? 'none' : 'flex',
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
```

- [ ] **Step 2: Verify TypeScript compiles (no new errors)**

Run from repo root:
```bash
npx tsc --noEmit
```
Expected: no errors referencing `PlayerView.tsx`. Warnings about the soon-to-be-deleted files are fine at this point.

---

## Task 2: Wire `PlayerView` into `App.tsx` and delete old mode files

**Files:**
- Modify: `src/renderer/src/App.tsx`
- Delete: `src/renderer/src/components/WatchMode/WatchMode.tsx`
- Delete: `src/renderer/src/components/ReviewMode/ReviewMode.tsx`

- [ ] **Step 1: Update `App.tsx`**

Replace the entire file content with:

```tsx
import { useTranscriptStore } from '../store/transcriptStore';
import { LandingScreen } from './components/LandingScreen';
import { ProcessingScreen } from './components/ProcessingScreen';
import { PlayerView } from './components/PlayerView/PlayerView';
import { ReviewCenter } from './components/ReviewCenter/ReviewCenter';

export default function App() {
  const mode = useTranscriptStore((s) => s.mode);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0f172a', color: '#e2e8f0', overflow: 'hidden' }}>
      {mode === 'landing' && <LandingScreen />}
      {mode === 'processing' && <ProcessingScreen />}
      {(mode === 'watch' || mode === 'review') && <PlayerView />}
      {mode === 'review-center' && <ReviewCenter />}
    </div>
  );
}
```

- [ ] **Step 2: Delete `WatchMode.tsx`**

```bash
rm src/renderer/src/components/WatchMode/WatchMode.tsx
```

- [ ] **Step 3: Delete `ReviewMode.tsx`**

```bash
rm src/renderer/src/components/ReviewMode/ReviewMode.tsx
```

- [ ] **Step 4: Verify TypeScript compiles clean**

```bash
npx tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 5: Run the test suite to confirm no regressions**

```bash
npm test
```
Expected: all existing tests pass (store + utility tests are unaffected by this change).

- [ ] **Step 6: Commit (stage all changes first, then commit)**

```bash
git add src/renderer/src/App.tsx \
        src/renderer/src/components/PlayerView/PlayerView.tsx && \
git rm src/renderer/src/components/WatchMode/WatchMode.tsx \
       src/renderer/src/components/ReviewMode/ReviewMode.tsx && \
git commit -m "feat: merge WatchMode+ReviewMode into PlayerView to preserve video position"
```

---

## Task 3: Manual Verification in Electron

> Run the app and walk through the checklist. No automated component tests exist for renderer UI — this is the acceptance gate.

- [ ] **Step 1: Start the app**

```bash
npm run dev
```

- [ ] **Step 2: Load a video and verify Watch mode looks correct**

- Video fills full width
- Bottom toolbar shows marked count, MARK [R] button, and "Review →" button

- [ ] **Step 3: Play the video for a few seconds, note the timestamp**

- [ ] **Step 4: Switch to Review mode — verify position and play state are preserved**

Pause the video first, note the timestamp. Click "Review →". The video **must remain paused at the same timestamp** — no jump to 0:00, no visible flash, no auto-play.

- [ ] **Step 5: Verify Review mode layout**

- Top bar shows "← Watch" and "Review Center →" buttons
- Video occupies ~55% left
- Transcript panel occupies ~45% right
- Transcript highlights the active sentence

- [ ] **Step 6: Click a sentence in the transcript — verify seek works**

Click a sentence row. Video should seek to that sentence's `startTime` and transcript should immediately highlight it (no lag).

- [ ] **Step 7: Switch back to Watch mode — verify position is preserved**

Click "← Watch". Video must continue from the timestamp it was at in review mode.

- [ ] **Step 8: Verify R key marks in both modes**

Press R during Watch mode → sentence is marked. Switch to Review, press R while video is playing → sentence is marked. The keyboard handler is mode-agnostic.

- [ ] **Step 9: Verify Space bar toggles playback in both modes**

Press Space → video pauses/plays in both Watch and Review mode.

- [ ] **Step 10: Verify DiagnosticMenu still opens in Review mode**

Click the diagnose action on a sentence in the transcript panel → DiagnosticMenu overlay appears.
