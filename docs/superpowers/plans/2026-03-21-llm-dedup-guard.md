# LLM Dedup Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent redundant LLM API calls in DiagnosticMenu when the user selects a word/phrase that already has a cached explanation of the same type.

**Architecture:** Add a one-line early-return guard at the top of `handleVocabulary` and `handleSlang` in `DiagnosticMenu.tsx`. If `existingQueries` already contains an entry matching `(selectedWord, type)`, the function returns silently before calling `setLoading` or the LLM API. No store changes, no new components, no new state.

**Tech Stack:** React 18, TypeScript, Vitest

---

## File Map

| File | Change |
|------|--------|
| `src/renderer/src/components/ReviewMode/DiagnosticMenu.tsx` | Add dedup guard to `handleVocabulary` and `handleSlang` |

No new files. No other files change.

---

## Task 1: Add dedup guard to `handleVocabulary` and `handleSlang`

**Files:**
- Modify: `src/renderer/src/components/ReviewMode/DiagnosticMenu.tsx:23-25,43-45`

**Background for the implementer:**

`DiagnosticMenu.tsx` has two async handlers that call the LLM API:
- `handleVocabulary` (line 23) — for word/phrase vocabulary explanations
- `handleSlang` (line 43) — for slang/idiom explanations

Both currently call the LLM unconditionally as long as `selectedWord` is set and `session` is non-null. We need to add a check: if `existingQueries` already has an entry where `q.selectedWord === selectedWord` AND `q.type` matches, skip the call silently.

`existingQueries` is defined on line 72:
```ts
const existingQueries = (liveSentence ?? sentence).diagnostics.vocabularyQueries;
```
It is a `VocabularyQuery[]` where each entry has `{ selectedWord: string, type: 'vocabulary' | 'slang', aiExplanation: string }`.

**Note on testability:** The dedup guard is a one-line `Array.some` check embedded in a React component that depends on `window.api`. The project has no React component test infrastructure (no React Testing Library setup). Writing a unit test would require a full component harness that doesn't exist. Instead, we verify via the existing store tests (to confirm no regressions) and a manual smoke test.

- [ ] **Step 1: Read the current file to understand exact line numbers**

```bash
# In D:/developer_tools/englishfromseries
# Read the file before editing to confirm current line numbers
```

Open `src/renderer/src/components/ReviewMode/DiagnosticMenu.tsx` and locate:
- `handleVocabulary` — the line `if (!selectedWord || !session) return;`
- `handleSlang` — the same guard line

- [ ] **Step 2: Add the dedup guard to `handleVocabulary`**

In `handleVocabulary`, after the existing null-guard `if (!selectedWord || !session) return;` and before `setLoading(true)`, insert one line:

```ts
async function handleVocabulary() {
  if (!selectedWord || !session) return;
  if (existingQueries.some(q => q.selectedWord === selectedWord && q.type === 'vocabulary')) return;
  setLoading(true);
  setError(null);
  // ...rest of function unchanged
}
```

The full updated `handleVocabulary` function should look like:

```ts
async function handleVocabulary() {
  if (!selectedWord || !session) return;
  if (existingQueries.some(q => q.selectedWord === selectedWord && q.type === 'vocabulary')) return;
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
```

- [ ] **Step 3: Add the dedup guard to `handleSlang`**

Same pattern. After `if (!selectedWord || !session) return;`, insert:

```ts
async function handleSlang() {
  if (!selectedWord || !session) return;
  if (existingQueries.some(q => q.selectedWord === selectedWord && q.type === 'slang')) return;
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
```

- [ ] **Step 4: Run all tests — confirm no regressions**

```bash
npm test
```

Expected: all 22 tests pass. The change adds no new logic to the store, so all existing tests remain valid.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/ReviewMode/DiagnosticMenu.tsx
git commit -m "feat: skip LLM call when word+type explanation already cached"
```

---

## Task 2: Manual smoke test

No automated component test infrastructure exists in this project. Verify the behavior manually in the running app.

- [ ] **Step 1: Launch the app**

```bash
npm run dev
```

- [ ] **Step 2: Open a video session in ReviewMode**

Open any session that has at least one marked sentence.

- [ ] **Step 3: Open DiagnosticMenu on a marked sentence**

Click the `★` button on a marked sentence to open the DiagnosticMenu.

- [ ] **Step 4: Add a vocabulary explanation**

Highlight a word (e.g., "world"), click **📖 Vocabulary**. Wait for the AI explanation to appear in the history list below.

- [ ] **Step 5: Verify dedup — same word, same type**

Without closing the menu, highlight the same word ("world") again and click **📖 Vocabulary** again.

Expected: nothing happens — no "Asking AI..." spinner, no new history entry appended. The existing explanation stays as-is.

- [ ] **Step 6: Verify new word is NOT blocked**

Highlight a different word (e.g., "Hello"), click **📖 Vocabulary**.

Expected: the spinner appears, the LLM is called, and a new explanation is appended to the history.

- [ ] **Step 7: Verify cross-type is NOT blocked**

Highlight the original word ("world") again, click **🗣 Slang / Idiom**.

Expected: the LLM is called (vocabulary and slang are different types — no dedup). A new slang explanation is appended.

- [ ] **Step 8: Verify after reload**

Close and reopen the app, navigate back to the same sentence's DiagnosticMenu.

Expected: all previous explanations are visible. Clicking the cached word+type combo again still silently skips the LLM call.
