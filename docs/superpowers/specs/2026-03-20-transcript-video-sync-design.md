# Transcript ↔ Video Sync — Design Spec

**Date:** 2026-03-20
**Feature:** Bidirectional sync between the transcript panel and the video player in ReviewMode.

---

## Problem

The transcript panel and video player in ReviewMode are currently isolated. Clicking a sentence does not move the video, and the video's playback position does not affect the transcript. Users cannot navigate the video via the transcript or see which sentence is currently playing.

---

## Requirements

1. **Transcript → Video (Seek):** Clicking any sentence row seeks the video to that sentence's `startTime`.
2. **Video → Transcript (Highlight):** As the video plays, the sentence whose `startTime ≤ currentTime < nextSentence.startTime` is highlighted and auto-scrolled into view.
3. **Diagnostic access preserved:** Marked (★) sentences still open the DiagnosticMenu via a small ★ icon button on the row — separate from the seek click.

---

## Architecture

All coordination lives in `ReviewMode`. It owns playback state and passes narrow props down to `VideoPlayer` and `TranscriptPanel`. No store changes.

```
ReviewMode
  ├── currentTime (state)
  ├── activeSentenceId (derived via useMemo)
  ├── VideoPlayer  ← seek(time), onTimeUpdate(time)
  └── TranscriptPanel  ← activeSentenceId, onSeekSentence, onDiagnoseSentence
```

---

## Component Changes

### `VideoPlayer`

**Handle interface** — updated (add `seek`, keep existing methods):
```ts
export interface VideoPlayerHandle {
  currentTime: () => number;
  togglePlay: () => void;
  seek: (time: number) => void;
}
```
`seek` implementation sets `currentTime` only — it does **not** call `.play()`. The video remains paused or playing in whatever state it was in before the seek, so users can scrub through the transcript without auto-resuming playback.
```ts
seek: (time: number) => {
  if (!videoRef.current) return;
  videoRef.current.currentTime = time;
}
```

**Props** — add one optional callback (optional for backward compat with `WatchMode`, which does not need time sync):
```ts
onTimeUpdate?: (time: number) => void
```
Wired to the native `<video onTimeUpdate>` event:
```tsx
onTimeUpdate={e => props.onTimeUpdate?.(e.currentTarget.currentTime)}
```

---

### `ReviewMode`

```ts
const [currentTime, setCurrentTime] = useState(0);

const activeSentenceId = useMemo(() => {
  const sentences = session.transcript;
  let active: string | undefined;
  for (const s of sentences) {
    if (s.startTime <= currentTime) active = s.sentenceId;
    else break;
  }
  return active;
}, [currentTime, session.transcript]);
```

- Passes `onTimeUpdate={t => setCurrentTime(t)}` to `VideoPlayer`.
- Defines `handleSeek(s: Sentence)` → `videoRef.current?.seek(s.startTime)`.
- Defines `handleDiagnose(s: Sentence)` → `setSelected(s)`.
- Passes both to `TranscriptPanel` along with `activeSentenceId`.

> **Note on reference stability:** The `useMemo` depends on `session.transcript` (the array reference). The Zustand store must return a new array reference when the transcript changes and preserve the same reference when it does not — standard Zustand/Immer behaviour.

> **Note on `endTime`:** `Sentence` has an `endTime` field. We deliberately ignore it as the upper boundary. Using it strictly would cause the highlight to disappear in gaps between subtitles. The "last sentence whose `startTime ≤ currentTime`" heuristic keeps a sentence highlighted until the next one starts — the correct karaoke-style behaviour.

---

### `TranscriptPanel`

**Props** (replaces old `onClickSentence`):
```ts
interface Props {
  sentences: Sentence[];
  activeSentenceId?: string;
  onSeekSentence: (s: Sentence) => void;
  onDiagnoseSentence: (s: Sentence) => void;
}
```

**Row behaviour:**
- Every row is clickable → `onSeekSentence(s)`. **Breaking change from current code:** the existing `isMarkedByUser` guard on `onClick` must be removed so that all rows trigger seek regardless of marked status.
- Marked rows (`isMarkedByUser`) render an inline ★ button (right side) → `onDiagnoseSentence(s)`. The button stops click propagation so it doesn't also trigger seek.
- Active row (`s.sentenceId === activeSentenceId`) gets a distinct highlight: e.g. `background: rgba(99,102,241,0.15)`, left border `#6366f1`.

**Auto-scroll:**
```ts
const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

useEffect(() => {
  if (activeSentenceId) {
    rowRefs.current.get(activeSentenceId)?.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth',
    });
  }
}, [activeSentenceId]);
```

Each row element registers itself, with cleanup on unmount to avoid stale entries:
```tsx
ref={el => {
  if (el) rowRefs.current.set(s.sentenceId, el);
  else rowRefs.current.delete(s.sentenceId);
}}
```

---

## Visual States

| State | Style |
|---|---|
| Untouched sentence | Gray text, no border |
| Marked sentence (★) | Amber text, amber left border, amber background tint |
| Active (playing) sentence | Indigo left border, indigo background tint |
| Marked + active | Indigo highlight takes precedence |
| Diagnosed sentence (✓) | Green text, green left border |

---

## Data Flow

```
<video onTimeUpdate>  →  onTimeUpdate(t)  →  setCurrentTime(t)
                                              ↓
                                     activeSentenceId (useMemo)
                                              ↓
                                     TranscriptPanel highlights + scrolls

Sentence row click  →  onSeekSentence(s)  →  videoRef.seek(s.startTime)
★ button click      →  onDiagnoseSentence(s)  →  setSelected(s)  →  DiagnosticMenu
```

---

## Out of Scope

- WatchMode transcript sync (separate feature).
- Touch / mobile interactions.
- Sentence `endTime` as strict upper boundary (see note in ReviewMode section above).
