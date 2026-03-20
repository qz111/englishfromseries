# Transcript ↔ Video Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bidirectional sync between TranscriptPanel and VideoPlayer in ReviewMode — clicking any sentence seeks the video; active sentence auto-highlights and scrolls as the video plays.

**Architecture:** ReviewMode owns all playback state (`currentTime`, derived `activeSentenceId`). VideoPlayer gains `seek()` on its imperative handle and an `onTimeUpdate` prop. TranscriptPanel replaces its single `onClickSentence` prop with `onSeekSentence` + `onDiagnoseSentence`, and highlights/auto-scrolls the active sentence. The `activeSentenceId` derivation logic is extracted to a pure utility function so it can be unit-tested independently of React.

**Tech Stack:** React, TypeScript, Vitest (no @testing-library/react — test pure functions only)

---

## File Map

| File | Change |
|---|---|
| `src/renderer/src/utils/transcript.ts` | **Create** — pure `getActiveSentenceId` utility |
| `tests/renderer/transcript.test.ts` | **Create** — unit tests for the utility |
| `src/renderer/src/components/WatchMode/VideoPlayer.tsx` | **Modify** — add `seek` to handle, add `onTimeUpdate` prop |
| `src/renderer/src/components/ReviewMode/TranscriptPanel.tsx` | **Modify** — new props, active highlight, ★ button, rowRefs auto-scroll |
| `src/renderer/src/components/ReviewMode/ReviewMode.tsx` | **Modify** — wire `currentTime`, `activeSentenceId`, `handleSeek`, `handleDiagnose` |

---

## Task 1: Pure utility — `getActiveSentenceId`

Extract the active-sentence derivation into a testable pure function before touching any React components.

**Files:**
- Create: `src/renderer/src/utils/transcript.ts`
- Create: `tests/renderer/transcript.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/renderer/transcript.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getActiveSentenceId } from '../../src/renderer/src/utils/transcript';
import { Sentence } from '../../src/types/transcript';

function makeSentence(id: string, startTime: number, endTime: number): Sentence {
  return {
    sentenceId: id,
    startTime,
    endTime,
    text: 'Test sentence.',
    isMarkedByUser: false,
    words: [],
    diagnostics: { pronunciationFlagged: false, vocabularyQueries: [] },
  };
}

const sentences: Sentence[] = [
  makeSentence('s1', 0, 2),
  makeSentence('s2', 2, 5),
  makeSentence('s3', 5, 9),
];

describe('getActiveSentenceId', () => {
  it('returns undefined for empty transcript', () => {
    expect(getActiveSentenceId([], 3)).toBeUndefined();
  });

  it('returns undefined when currentTime is before first sentence', () => {
    expect(getActiveSentenceId(sentences, -1)).toBeUndefined();
  });

  it('returns first sentence at its exact startTime', () => {
    expect(getActiveSentenceId(sentences, 0)).toBe('s1');
  });

  it('returns correct sentence mid-play', () => {
    expect(getActiveSentenceId(sentences, 3.5)).toBe('s2');
  });

  it('returns last sentence when currentTime is past all sentences', () => {
    expect(getActiveSentenceId(sentences, 99)).toBe('s3');
  });

  it('keeps current sentence highlighted across a subtitle gap (karaoke behaviour)', () => {
    // s2 ends at 5, s3 starts at 5 — no gap here, but if gap existed
    // the function should still return s2 until s3.startTime is reached
    const withGap: Sentence[] = [
      makeSentence('s1', 0, 2),
      makeSentence('s2', 2, 4),   // ends at 4
      makeSentence('s3', 6, 9),   // starts at 6 — gap from 4 to 6
    ];
    expect(getActiveSentenceId(withGap, 5)).toBe('s2'); // in the gap, s2 stays active
  });

  it('transitions to next sentence exactly at its startTime', () => {
    expect(getActiveSentenceId(sentences, 5)).toBe('s3');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd "D:\developer_tools\englishfromseries" && npx vitest run tests/renderer/transcript.test.ts
```

Expected: FAIL — `getActiveSentenceId` does not exist yet.

- [ ] **Step 3: Create the utility**

Create `src/renderer/src/utils/transcript.ts`:

```ts
import { Sentence } from '../../../types/transcript';

/**
 * Returns the sentenceId of the sentence currently active at the given playback time.
 * Uses a "karaoke" heuristic: the active sentence is the last one whose startTime
 * is <= currentTime. This keeps a sentence highlighted across subtitle gaps rather
 * than de-highlighting between sentences.
 */
export function getActiveSentenceId(
  sentences: Sentence[],
  currentTime: number
): string | undefined {
  let active: string | undefined;
  for (const s of sentences) {
    if (s.startTime <= currentTime) active = s.sentenceId;
    else break;
  }
  return active;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd "D:\developer_tools\englishfromseries" && npx vitest run tests/renderer/transcript.test.ts
```

Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd "D:\developer_tools\englishfromseries" && git add src/renderer/src/utils/transcript.ts tests/renderer/transcript.test.ts && git commit -m "feat: add getActiveSentenceId pure utility with tests"
```

---

## Task 2: Extend `VideoPlayer` with `seek` and `onTimeUpdate`

**Files:**
- Modify: `src/renderer/src/components/WatchMode/VideoPlayer.tsx`

- [ ] **Step 1: Add `seek` to `VideoPlayerHandle` and wire `onTimeUpdate` prop**

Replace the entire file content:

```tsx
// src/renderer/src/components/WatchMode/VideoPlayer.tsx
import { forwardRef, useImperativeHandle, useRef } from 'react';

export interface VideoPlayerHandle {
  currentTime: () => number;
  togglePlay: () => void;
  seek: (time: number) => void;
}

interface Props {
  videoPath: string;
  onTimeUpdate?: (time: number) => void;
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, Props>(
  ({ videoPath, onTimeUpdate }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    const src = `file:///${videoPath.replace(/\\/g, '/')}`;
    console.log('VideoPlayer src:', src);

    useImperativeHandle(ref, () => ({
      currentTime: () => videoRef.current?.currentTime ?? 0,
      togglePlay: () => {
        const v = videoRef.current;
        if (!v) return;
        if (v.paused) v.play().catch(() => {}); else v.pause();
      },
      seek: (time: number) => {
        if (!videoRef.current) return;
        videoRef.current.currentTime = time;
      },
    }));

    return (
      <video
        ref={videoRef}
        src={src}
        style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
        controls
        onTimeUpdate={(e) => onTimeUpdate?.(e.currentTarget.currentTime)}
        onError={(e) => {
          const v = e.currentTarget;
          console.error('Video error:', v.error?.code, v.error?.message, v.src);
        }}
      />
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';
```

- [ ] **Step 2: Verify TypeScript compilation**

```bash
cd "D:\developer_tools\englishfromseries" && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Run full test suite to confirm nothing broke**

```bash
cd "D:\developer_tools\englishfromseries" && npx vitest run
```

Expected: All tests PASS. WatchMode uses `VideoPlayer` without `onTimeUpdate` — the optional prop means no change needed there.

- [ ] **Step 4: Commit**

```bash
cd "D:\developer_tools\englishfromseries" && git add src/renderer/src/components/WatchMode/VideoPlayer.tsx && git commit -m "feat: add seek() to VideoPlayerHandle and onTimeUpdate prop"
```

---

## Task 3: Rewrite `TranscriptPanel` with active highlight, ★ button, auto-scroll

**Files:**
- Modify: `src/renderer/src/components/ReviewMode/TranscriptPanel.tsx`

- [ ] **Step 1: Rewrite `TranscriptPanel`**

Replace the entire file:

```tsx
// src/renderer/src/components/ReviewMode/TranscriptPanel.tsx
import { useRef, useEffect } from 'react';
import { Sentence } from '../../../../types/transcript';

interface Props {
  sentences: Sentence[];
  activeSentenceId?: string;
  onSeekSentence: (s: Sentence) => void;
  onDiagnoseSentence: (s: Sentence) => void;
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
}: Props) {
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (activeSentenceId) {
      rowRefs.current.get(activeSentenceId)?.scrollIntoView({
        block: 'nearest',
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
```

- [ ] **Step 2: Verify TypeScript compilation**

```bash
cd "D:\developer_tools\englishfromseries" && npx tsc --noEmit
```

Expected: TypeScript error on `ReviewMode.tsx` — it still passes the old `onClickSentence` prop. That is expected and will be fixed in Task 4.

- [ ] **Step 3: Commit**

```bash
cd "D:\developer_tools\englishfromseries" && git add src/renderer/src/components/ReviewMode/TranscriptPanel.tsx && git commit -m "feat: rewrite TranscriptPanel with active highlight, seek/diagnose props, auto-scroll"
```

---

## Task 4: Wire `ReviewMode` — `currentTime`, `activeSentenceId`, `handleSeek`, `handleDiagnose`

**Files:**
- Modify: `src/renderer/src/components/ReviewMode/ReviewMode.tsx`

- [ ] **Step 1: Rewrite `ReviewMode`**

Replace the entire file:

```tsx
// src/renderer/src/components/ReviewMode/ReviewMode.tsx
import { useRef, useState, useMemo } from 'react';
import { useTranscriptStore } from '../../../store/transcriptStore';
import { VideoPlayer, VideoPlayerHandle } from '../WatchMode/VideoPlayer';
import { TranscriptPanel } from './TranscriptPanel';
import { Sentence } from '../../../../types/transcript';
import { DiagnosticMenu } from './DiagnosticMenu';
import { getActiveSentenceId } from '../../utils/transcript';

export function ReviewMode() {
  const { session, setMode } = useTranscriptStore();
  const videoRef = useRef<VideoPlayerHandle>(null);
  const [selected, setSelected] = useState<Sentence | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  const activeSentenceId = useMemo(
    () => getActiveSentenceId(session?.transcript ?? [], currentTime),
    [currentTime, session?.transcript]
  );

  if (!session) return null;

  function handleSeek(s: Sentence) {
    videoRef.current?.seek(s.startTime);
  }

  function handleDiagnose(s: Sentence) {
    setSelected(s);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Top bar */}
      <div style={{
        background: '#1e293b',
        padding: '8px 16px',
        display: 'flex',
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

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: video ~55% */}
        <div style={{ width: '55%', background: '#000', flexShrink: 0 }}>
          <VideoPlayer
            ref={videoRef}
            videoPath={session.videoPath}
            onTimeUpdate={setCurrentTime}
          />
        </div>
        {/* Right: transcript ~45% */}
        <div style={{ flex: 1, borderLeft: '1px solid #1e293b', background: '#0f172a', overflow: 'hidden' }}>
          <TranscriptPanel
            sentences={session.transcript}
            activeSentenceId={activeSentenceId}
            onSeekSentence={handleSeek}
            onDiagnoseSentence={handleDiagnose}
          />
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

- [ ] **Step 2: Verify TypeScript compilation**

```bash
cd "D:\developer_tools\englishfromseries" && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Run full test suite**

```bash
cd "D:\developer_tools\englishfromseries" && npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
cd "D:\developer_tools\englishfromseries" && git add src/renderer/src/components/ReviewMode/ReviewMode.tsx && git commit -m "feat: wire transcript-video sync in ReviewMode"
```

---

## Manual Smoke Test Checklist

After all tasks are complete, open the app and verify:

- [ ] Open a session in ReviewMode.
- [ ] Click an **unmarked** (gray) sentence → video jumps to that timestamp. No DiagnosticMenu opens.
- [ ] Click a **marked** (amber ★) sentence → video jumps to that timestamp. No DiagnosticMenu opens.
- [ ] Click the **★ button** on a marked sentence → DiagnosticMenu opens. Video does NOT seek.
- [ ] Play the video → active sentence updates in real time, indigo highlight tracks playback.
- [ ] Active sentence auto-scrolls into view as video plays through sentences near the bottom/top of the list.
- [ ] Pause video mid-sentence → highlight stays on the paused sentence.
- [ ] Click a sentence while paused → video jumps but stays paused.
