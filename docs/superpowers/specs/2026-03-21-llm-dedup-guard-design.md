# LLM Dedup Guard — Design Spec

**Date:** 2026-03-21
**Status:** Approved

## Problem

When a user selects a word or phrase in the DiagnosticMenu and clicks Vocabulary or Slang, the app always calls the LLM API — even if that exact `(selectedWord, type)` combination already has a cached explanation in `vocabularyQueries`. This wastes API credits and adds unnecessary latency.

## Audit: What's Already Working

Before this spec was written, the following requirements were verified as already implemented:

- **Skip Redundant Whisper Calls** — `LandingScreen.tsx` calls `loadSession(videoPath)` first; if `{videoPath}.session.json` exists, Whisper is never called.
- **Preserve State & Explanations** — The session JSON fully serializes `isMarkedByUser`, `diagnostics`, and `vocabularyQueries`. All state round-trips through `SessionStore`.
- **Active Editing on Cached Files** — Cached sessions load into ReviewMode; the "← Watch" button and the ⚑ toggle button (added separately) allow adding new marks at any time.
- **History display** — `DiagnosticMenu` already displays all cached `vocabularyQueries` for the open sentence at the bottom of the panel.

## Scope

One file changes:

- `src/renderer/src/components/ReviewMode/DiagnosticMenu.tsx` — add dedup guard to `handleVocabulary` and `handleSlang`

## Design

### Dedup guard

Add one early-return check at the top of each handler, immediately after the existing null-guards and before `setLoading(true)`:

```ts
async function handleVocabulary() {
  if (!selectedWord || !session) return;
  if (existingQueries.some(q => q.selectedWord === selectedWord && q.type === 'vocabulary')) return;
  setLoading(true);
  // ...rest unchanged
}

async function handleSlang() {
  if (!selectedWord || !session) return;
  if (existingQueries.some(q => q.selectedWord === selectedWord && q.type === 'slang')) return;
  setLoading(true);
  // ...rest unchanged
}
```

### Matching logic

A duplicate is defined as: same `selectedWord` (exact string match) AND same `type` (`'vocabulary'` or `'slang'`). Case sensitivity follows whatever the user highlighted — no normalization needed.

### Behavior when duplicate detected

Silent skip — nothing happens. No error, no loading state, no UI change. The user can see the existing explanation already displayed in the history list below.

### Behavior for new word/type combos

Unchanged — the LLM is called as before and the result is appended to `vocabularyQueries`.

## Out of Scope

- No changes to pronunciation flagging (it has no LLM call)
- No cross-sentence dedup (each sentence's `vocabularyQueries` is independent)
- No normalization of selected text (case, whitespace) — exact match only
- No UI indication that a call was skipped
- **Rapid double-click race (pre-existing, not introduced here):** If a user clicks Vocabulary twice before the first async call completes and React re-renders the `disabled` state, two identical LLM calls can still fire. The dedup guard only catches duplicates already persisted to `vocabularyQueries`. Closing this would require an in-flight `useRef` guard — out of scope for this iteration.
