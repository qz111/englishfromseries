# Manual Mark Toggle — Design Spec

**Date:** 2026-03-21
**Status:** Approved

## Problem

The hotkey-based marking system in WatchMode is not always perfectly timed. Users need a way to manually add or remove a mark (`isMarkedByUser`) on any sentence during the ReviewMode phase.

---

## Scope

Three files change:

1. `src/renderer/store/transcriptStore.ts` — store action
2. `src/renderer/src/components/ReviewMode/TranscriptPanel.tsx` — UI + new prop
3. `src/renderer/src/components/ReviewMode/ReviewMode.tsx` — wiring
4. `src/renderer/src/components/WatchMode/WatchMode.tsx` — caller update (rename only)

---

## 1. Store: `toggleMark`

- **Rename** `markSentence → toggleMark` in `transcriptStore.ts`
- **Change** implementation: flip `isMarkedByUser` (`!s.isMarkedByUser`) instead of always setting `true`
- **WatchMode hotkey** (`R` key): keep the existing guard `if (sentence && !sentence.isMarkedByUser)` before calling `toggleMark`, so mid-playback pressing R still only marks (never unmarks accidentally)

```ts
toggleMark: (sentenceId) =>
  set((state) => ({
    session: state.session
      ? {
          ...state.session,
          transcript: state.session.transcript.map((s) =>
            s.sentenceId === sentenceId ? { ...s, isMarkedByUser: !s.isMarkedByUser } : s
          ),
        }
      : null,
  })),
```

---

## 2. TranscriptPanel: `⚑` flag button + `onToggleMark` prop

### New prop

```ts
interface Props {
  sentences: Sentence[];
  activeSentenceId?: string;
  onSeekSentence: (s: Sentence) => void;
  onDiagnoseSentence: (s: Sentence) => void;
  onToggleMark: (s: Sentence) => void;  // NEW
}
```

### Row layout

Each sentence row renders two right-side controls:

```
[ sentence text ............. ] [ ⚑ toggle ] [ ★ diagnose (marked only) ]
```

- The `⚑` flag button is **always visible** on every sentence
- **Unmarked state**: dim slate color `#475569`, no border fill
- **Marked state**: amber `#fbbf24`, matching sentence highlight
- `onClick`: calls `onToggleMark(s)` + `e.stopPropagation()` (prevents seek)
- The existing bordered `★` diagnostic button is **unchanged** — still only renders when `isMarkedByUser: true`

### Flag button style

```tsx
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
```

---

## 3. ReviewMode: wiring

```tsx
const { session, setMode, toggleMark } = useTranscriptStore();

function handleToggleMark(s: Sentence) {
  toggleMark(s.sentenceId);
  const updated = useTranscriptStore.getState().session;
  if (updated) window.api.saveSession(updated);
}

// Pass to TranscriptPanel:
<TranscriptPanel
  sentences={session.transcript}
  activeSentenceId={activeSentenceId}
  onSeekSentence={handleSeek}
  onDiagnoseSentence={handleDiagnose}
  onToggleMark={handleToggleMark}
/>
```

---

## Out of Scope

- No changes to WatchMode's visual UI (hotkey marking remains as-is)
- No changes to DiagnosticMenu
- No changes to ReviewCenter or ExportService (they read `isMarkedByUser` directly from session data — the toggle doesn't break them)
- No new keyboard shortcuts
