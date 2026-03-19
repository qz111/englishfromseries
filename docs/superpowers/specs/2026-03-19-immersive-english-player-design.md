# Immersive English Learning Video Player — Design Spec
**Date:** 2026-03-19
**Status:** Approved

---

## 1. Overview

A Windows desktop application that creates a focused English learning loop: **Watch → Mark → Diagnose → Review**. Users watch local video files without subtitles, mark confusing sentences in real time, then diagnose and review them in a second pass with AI-powered explanations.

---

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Framework | Electron + React + TypeScript |
| State management | Zustand (renderer process) |
| Main ↔ Renderer bridge | Electron IPC with typed channels via `contextBridge` |
| Audio extraction | Bundled FFmpeg binary (subprocess) |
| Video playback | FFmpeg pipe → HTML5 `<video>` element |
| Transcription | OpenAI Whisper API (word-level timestamps) |
| LLM | OpenAI GPT-4o or Anthropic Claude — user-selectable in settings |
| Export | Markdown + PDF |
| Tests | Vitest (unit), nock (API mocking) |

---

## 3. Architecture

Two Electron processes communicating over typed IPC:

**Renderer Process (React UI)**
- Video Player Panel
- Transcript Side Panel
- Diagnostic Menu
- Review & Export Center
- Zustand store — owns the transcript progressive hydration state

**Main Process (Node.js)**
- `FFmpegService` — audio extraction + video transcoding via bundled binary
- `WhisperService` — calls OpenAI Whisper API, returns sentence + word timestamps
- `LLMService` — calls GPT-4o or Claude API based on user settings
- `SessionStore` — reads/writes session JSON to disk, auto-saves after every mutation
- `ExportService` — generates Markdown and PDF from session data

All heavy tasks (FFmpeg, API calls) run in the main process and are fully async. The renderer is never blocked.

---

## 4. UI Layout

### Watch Mode (First Pass)
- Full-width video player, no subtitles
- Bottom control bar: play/pause (Space), seek bar, and a prominent **MARK button (R key)**
- Status bar: sentence count marked so far

### Review Mode (Second Pass)
- Video player shrinks to left panel (~55% width)
- Transcript scrolls on the right (~45% width)
  - Normal sentences: dim gray
  - Marked sentences (★): amber highlight
  - Fully diagnosed sentences (✓): green highlight
- Clicking a marked sentence pauses video and opens the Diagnostic Menu

### Diagnostic Menu
**Step 1 — Highlight:** Word tokens of the sentence are displayed as clickable chips. User clicks to select a word or phrase.

**Step 2 — Choose diagnosis type:**
- **Pronunciation** — no word selection needed; flags the full sentence for audio loop review. No LLM call.
- **Vocabulary** — requires word selection; LLM explains the word in the context of the current sentence only.
- **Slang / Idiom** — requires phrase selection; LLM explains with the previous sentence + current sentence + next sentence as context.

AI explanation appears inline below the word chips after the API returns.

---

## 5. Data Model — Progressive Hydration

```json
{
  "videoPath": "/path/to/video.mp4",
  "createdAt": "2026-03-19T10:00:00Z",
  "transcript": [
    {
      "sentenceId": "s_001",
      "startTime": 12.5,
      "endTime": 15.2,
      "text": "I mean, it's a moo point.",

      "isMarkedByUser": true,

      "words": [
        { "word": "I", "start": 12.5, "end": 12.6 },
        { "word": "mean,", "start": 12.6, "end": 12.8 },
        { "word": "it's", "start": 12.8, "end": 13.0 },
        { "word": "a", "start": 13.0, "end": 13.1 },
        { "word": "moo", "start": 13.1, "end": 13.4 },
        { "word": "point.", "start": 13.4, "end": 13.8 }
      ],

      "diagnostics": {
        "pronunciationFlagged": false,
        "vocabularyQueries": [
          {
            "selectedWord": "moo point",
            "type": "slang",
            "aiExplanation": "A humorous play on 'moot point'..."
          }
        ]
      }
    }
  ]
}
```

**Hydration steps:**
1. **Step 1 (Whisper):** `sentenceId`, `startTime`, `endTime`, `text`, `words[]` populated. `isMarkedByUser: false`, `diagnostics: null`.
2. **Step 2 (user marks):** `isMarkedByUser` flips to `true`. Auto-saved immediately.
3. **Step 3 (diagnosis):** `diagnostics` object populated. Auto-saved after each LLM result.

---

## 6. Session Persistence

The session JSON file is the single source of truth. It is stored alongside the video file (or in a configurable sessions folder).

**On video open:**
- If a session file exists for this video path → load from disk, skip FFmpeg and Whisper, jump directly to Review Mode.
- If no session file → run FFmpeg + Whisper, create session file, start in Watch Mode.

**Auto-save:** After every state mutation (mark, diagnose, LLM result), the session JSON is written to disk immediately. No manual save required.

---

## 7. LLM Prompt Strategy

### Vocabulary prompt
```
Context sentence: "{currentSentence}"
Selected word: "{selectedWord}"

Explain what "{selectedWord}" means in the context of this specific sentence.
Be concise. Provide one example sentence. English only.
```

### Slang / Idiom prompt
```
Previous sentence: "{prevSentence}"
Current sentence: "{currentSentence}"
Next sentence: "{nextSentence}"
Selected phrase: "{selectedWord}"

Explain what "{selectedWord}" means in this conversational context, including
any cultural nuance or idiomatic usage. Be concise. Provide one example sentence.
English only.
```

---

## 8. Review & Export Center

**Audio Loop Deck:** Lists all sentences where `pronunciationFlagged: true`. Each entry loops the exact audio segment (using FFmpeg trim) infinitely until the user moves to the next.

**Export (Markdown + PDF):**
- Full transcript with marked sentences highlighted
- Each vocabulary/slang query: original sentence, selected word, AI explanation, query type
- Pronunciation-flagged sentences listed separately

---

## 9. Error Handling

| Failure | Behavior |
|---|---|
| FFmpeg fails | Error dialog with stderr output. Offer retry with different file. Session not created. |
| Whisper API fails | Inline error in processing UI with Retry button. Session not created until success. |
| LLM API fails | Inline error in Diagnostic Menu with Retry button. No partial data written. |

All API calls: 30-second timeout, async, main process only.

---

## 10. Hotkeys

| Key | Action |
|---|---|
| Space | Play / Pause |
| R | Mark current sentence as confusing |

---

## 11. Testing

- **Unit (Vitest):** Zustand store mutations, session file load/save, LLM prompt builders
- **Integration (Vitest + nock):** IPC handlers — FFmpeg subprocess, Whisper API call, LLM call with mocked responses
- **E2E:** Not in initial scope
