# Manual Mark Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a ⚑ flag toggle button to every TranscriptPanel sentence row so users can manually mark/unmark sentences during ReviewMode, fixing cases where the WatchMode hotkey was mistimed.

**Architecture:** Rename `markSentence → toggleMark` in the Zustand store (flip boolean instead of always true), add `onToggleMark` prop to TranscriptPanel, render an always-visible ⚑ button per row, and wire `handleToggleMark` in ReviewMode. WatchMode keeps its existing guard so the hotkey can only mark (never accidentally unmark) during playback.

**Tech Stack:** React 18, Zustand, Electron, Vitest, TypeScript

---

## File Map

| File | Change |
|------|--------|
| `src/renderer/store/transcriptStore.ts` | Rename `markSentence → toggleMark`; flip boolean |
| `tests/renderer/transcriptStore.test.ts` | Update test name + call site; add toggle-off assertion |
| `src/renderer/src/components/ReviewMode/TranscriptPanel.tsx` | Add `onToggleMark` prop; render ⚑ button on every row |
| `src/renderer/src/components/ReviewMode/ReviewMode.tsx` | Add `handleToggleMark`; pass `onToggleMark` to TranscriptPanel |
| `src/renderer/src/components/WatchMode/WatchMode.tsx` | Rename `markSentence → toggleMark` at call site |

---

## Task 1: Update the store — rename `markSentence` to `toggleMark` and flip boolean

**Files:**
- Modify: `tests/renderer/transcriptStore.test.ts:32-37`
- Modify: `src/renderer/store/transcriptStore.ts:9,21-31`

- [ ] **Step 1: Update the test — rename call site and add toggle-off case**

Open `tests/renderer/transcriptStore.test.ts`. Replace the existing `'marks a sentence'` test block (lines 32–37) with:

```ts
it('toggles a sentence mark on', () => {
  useTranscriptStore.getState().loadSession(makeSession());
  useTranscriptStore.getState().toggleMark('s_001');
  const s = useTranscriptStore.getState().session!.transcript[0];
  expect(s.isMarkedByUser).toBe(true);
});

it('toggles a sentence mark off', () => {
  useTranscriptStore.getState().loadSession(makeSession());
  useTranscriptStore.getState().toggleMark('s_001'); // mark
  useTranscriptStore.getState().toggleMark('s_001'); // unmark
  const s = useTranscriptStore.getState().session!.transcript[0];
  expect(s.isMarkedByUser).toBe(false);
});
```

- [ ] **Step 2: Run the tests — expect two failures**

```bash
npm test -- --reporter=verbose tests/renderer/transcriptStore.test.ts
```

Expected: the two new `toggleMark` tests fail with `TypeError: ... toggleMark is not a function`. All other tests pass.

- [ ] **Step 3: Update the store interface and implementation**

In `src/renderer/store/transcriptStore.ts`:

Replace the interface line:
```ts
markSentence: (sentenceId: string) => void;
```
With:
```ts
toggleMark: (sentenceId: string) => void;
```

Replace the implementation (the `markSentence` block):
```ts
markSentence: (sentenceId) =>
  set((state) => ({
    session: state.session
      ? {
          ...state.session,
          transcript: state.session.transcript.map((s) =>
            s.sentenceId === sentenceId ? { ...s, isMarkedByUser: true } : s
          ),
        }
      : null,
  })),
```
With:
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

- [ ] **Step 4: Run the store tests — all must pass**

```bash
npm test -- --reporter=verbose tests/renderer/transcriptStore.test.ts
```

Expected: all 5 tests pass (loads session, toggles on, toggles off, flags pronunciation, adds vocabulary query).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/store/transcriptStore.ts tests/renderer/transcriptStore.test.ts
git commit -m "feat: rename markSentence to toggleMark, flip boolean for toggle"
```

---

## Task 2: Update WatchMode — rename call site

**Files:**
- Modify: `src/renderer/src/components/WatchMode/WatchMode.tsx:7,18,22`

WatchMode currently imports and calls `markSentence`. After the store rename it will fail to compile. The guard `if (sentence && !sentence.isMarkedByUser)` stays — the hotkey still only marks, never unmarks, during playback.

- [ ] **Step 0: Confirm baseline — all tests pass before touching WatchMode**

```bash
npm test
```

Expected: all 5 tests pass. If any fail, fix before continuing.

- [ ] **Step 1: Update WatchMode.tsx**

In `src/renderer/src/components/WatchMode/WatchMode.tsx`:

Line 7 — change the destructure:
```ts
const { session, markSentence, setMode } = useTranscriptStore();
```
To:
```ts
const { session, toggleMark, setMode } = useTranscriptStore();
```

Line 18 — change the call:
```ts
markSentence(sentence.sentenceId);
```
To:
```ts
toggleMark(sentence.sentenceId);
```

Line 22 — update the `useCallback` dependency array:
```ts
}, [session, markSentence]);
```
To:
```ts
}, [session, toggleMark]);
```

- [ ] **Step 2: Run all tests to confirm no regressions**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/WatchMode/WatchMode.tsx
git commit -m "fix: update WatchMode to call toggleMark (renamed from markSentence)"
```

---

## Task 3: Add ⚑ flag button to TranscriptPanel

**Files:**
- Modify: `src/renderer/src/components/ReviewMode/TranscriptPanel.tsx:5-10,48-53,117-138`

- [ ] **Step 1: Add `onToggleMark` to the Props interface**

In `TranscriptPanel.tsx`, replace the `interface Props` block (lines 5–10):
```ts
interface Props {
  sentences: Sentence[];
  activeSentenceId?: string;
  onSeekSentence: (s: Sentence) => void;
  onDiagnoseSentence: (s: Sentence) => void;
}
```
With:
```ts
interface Props {
  sentences: Sentence[];
  activeSentenceId?: string;
  onSeekSentence: (s: Sentence) => void;
  onDiagnoseSentence: (s: Sentence) => void;
  onToggleMark: (s: Sentence) => void;
}
```

- [ ] **Step 2: Destructure the new prop in the component signature**

Replace the component signature (lines 48–53):
```ts
export function TranscriptPanel({
  sentences,
  activeSentenceId,
  onSeekSentence,
  onDiagnoseSentence,
}: Props) {
```
With:
```ts
export function TranscriptPanel({
  sentences,
  activeSentenceId,
  onSeekSentence,
  onDiagnoseSentence,
  onToggleMark,
}: Props) {
```

- [ ] **Step 3: Add the ⚑ flag button to each row**

Inside the sentence row's JSX (between the `<span>` and the existing `{s.isMarkedByUser && ...}` diagnostic button), add the flag button. The full controls area after the text span should be:

```tsx
<span style={{ flex: 1 }}>
  {sentenceIcon(s, isActive)}{s.text}
</span>
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
```

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: all tests pass. TypeScript may show a compile error in `ReviewMode.tsx` (missing prop) — that's expected and will be fixed in Task 4.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/ReviewMode/TranscriptPanel.tsx
git commit -m "feat: add flag toggle button to TranscriptPanel sentence rows"
```

---

## Task 4: Wire `handleToggleMark` in ReviewMode

**Files:**
- Modify: `src/renderer/src/components/ReviewMode/ReviewMode.tsx:11,28-30,69-74`

- [ ] **Step 1: Pull `toggleMark` from the store**

On line 11, update the destructure:
```ts
const { session, setMode } = useTranscriptStore();
```
To:
```ts
const { session, setMode, toggleMark } = useTranscriptStore();
```

- [ ] **Step 2: Add `handleToggleMark` function**

After the `handleDiagnose` function (around line 30), add:
```ts
function handleToggleMark(s: Sentence) {
  toggleMark(s.sentenceId);
  const updated = useTranscriptStore.getState().session;
  if (updated) window.api.saveSession(updated); // fire-and-forget — matches handlePronunciation in DiagnosticMenu
}
```

- [ ] **Step 3: Pass `onToggleMark` to TranscriptPanel**

Update the `<TranscriptPanel>` JSX (around lines 69–74):
```tsx
<TranscriptPanel
  sentences={session.transcript}
  activeSentenceId={activeSentenceId}
  onSeekSentence={handleSeek}
  onDiagnoseSentence={handleDiagnose}
  onToggleMark={handleToggleMark}
/>
```

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: all tests pass, no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/ReviewMode/ReviewMode.tsx
git commit -m "feat: wire handleToggleMark in ReviewMode, connect to TranscriptPanel"
```

---

## Task 5: Manual smoke test

These are quick visual checks in the running app. No automated test needed — the behavior is pure UI interaction.

- [ ] **Step 1: Build and launch**

```bash
npm run dev
```

- [ ] **Step 2: Verify ⚑ button on all sentences**

Open any video session in ReviewMode. Every sentence row should show a dim gray `⚑` button on the right side.

- [ ] **Step 3: Mark via ⚑ button**

Click `⚑` on an unmarked sentence. Expected:
- The `⚑` turns amber (`#fbbf24`)
- The sentence background turns amber-tinted
- The `★` diagnostic button appears next to the `⚑`

- [ ] **Step 4: Unmark via ⚑ button**

Click the amber `⚑` on the marked sentence. Expected:
- The `⚑` returns to dim gray
- Amber background disappears
- `★` diagnostic button disappears

- [ ] **Step 5: Clicking ⚑ does not seek**

Click `⚑` on any sentence. The video should NOT jump to that sentence's start time. Only clicking the sentence text area should seek.

- [ ] **Step 6: WatchMode hotkey still only marks**

Switch to WatchMode, play a sentence, press R. It marks. Press R again on the same sentence — it should NOT unmark (the guard prevents it).

- [ ] **Step 7: Mark persists after reload**

In ReviewMode, click `⚑` to mark a sentence. Close the app and reopen it (or reload via DevTools). Navigate back to ReviewMode. The sentence should still be marked (amber `⚑` visible). This verifies `saveSession` was called successfully.
