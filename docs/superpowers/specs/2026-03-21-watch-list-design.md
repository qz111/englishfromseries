# Design: Watch List on Landing Screen

**Date:** 2026-03-21
**Status:** Approved

## Problem

The landing screen currently has no memory of previously processed videos. Every time the user wants to re-open a video they have already transcribed, they must go through the file picker dialog again and remember where the file lives. Sessions are already cached as `<videoPath>.session.json` files, but nothing surfaces them on startup.

## Solution

Extend `SessionStore` to maintain a self-managed index of known video paths. The landing screen reads this index on mount and displays a "Recent Videos" list. Users click an entry to jump straight into the session; missing files are shown with a warning and a dismiss button.

## Architecture

### SessionStore index

`SessionStore` gains a `session-index.json` file stored in Electron's `app.getPath('userData')` directory (e.g. `AppData\Roaming\englishfromseries\`). The file contains a plain JSON array of video path strings: `string[]`.

**Constructor change:** `SessionStore` accepts a `userDataPath: string` constructor argument. The caller (`registerHandlers` in `handlers.ts`) passes `app.getPath('userData')` at construction time. This avoids calling `app.getPath()` before the `ready` event.

**Updated methods:**
- `save(session)` — externally unchanged; internally the index registration is performed inside `_write()` (the serial queue method) so it is always sequenced with the session write. Registration moves an existing path to the end of the array (remove + push) so the list reflects recency of last access, not just first import.
- `load(videoPath)` — unchanged
- `listPaths(): Promise<string[]>` — reads and returns the index array (returns `[]` if file does not exist yet)
- `removePath(videoPath): Promise<void>` — removes a single entry from the index via the same `saveQueue` and uses the same atomic tmp-rename pattern as session writes to prevent corruption. Does NOT delete the `.session.json` file.

**Write safety:** All reads and writes to `session-index.json` are serialized through the existing `saveQueue` and use the atomic tmp-rename pattern (`index.json.tmp` → `index.json`) already used for session files. This prevents concurrent writes from clobbering each other.

### IPC layer

Two new channels added to `channels.ts`:

| Channel | Input | Output | Description |
|---------|-------|--------|-------------|
| `LIST_SESSIONS` | — | `{ videoPath: string; exists: boolean }[]` | Reads index, checks each path existence with `fs.access` in parallel (`Promise.all`), returns combined result |
| `REMOVE_SESSION_PATH` | `videoPath: string` | `void` | Removes path from the index |

`LIST_SESSIONS` performs `fs.access` checks in the main process using `Promise.all` (not a serial loop). The renderer derives the display filename from the path using a string split — no `path` module import needed in the renderer.

### Preload / window.api

Two new methods exposed via `contextBridge`:

```ts
listSessions(): Promise<{ videoPath: string; exists: boolean }[]>
removeSessionPath(videoPath: string): Promise<void>
```

**`src/preload/index.d.ts`:** The current declaration `api: unknown` must be replaced with a fully typed interface that includes all existing methods plus the two new ones. This is required for TypeScript to accept `window.api.listSessions()` and `window.api.removeSessionPath()` in the renderer without errors.

### LandingScreen

On mount, `LandingScreen` calls `window.api.listSessions()` and stores the result in local state. Entries are displayed in reverse order (last element in the array = most recently accessed = shown first).

**Layout (when list has entries):**

```
┌─────────────────────────────────────────┐
│  Immersive English Player               │
│  Watch local videos and learn...        │
│                                         │
│  Recent Videos                          │
│  ┌───────────────────────────────────┐  │
│  │ ▶  episode01.mp4                  │  │
│  │ ▶  lesson_02.mkv                  │  │
│  │ ⚠  old_video.mp4  [File missing] ✕│  │
│  └───────────────────────────────────┘  │
│                                         │
│        [ + Import New Video ]           │
└─────────────────────────────────────────┘
```

- If the list is empty, the screen looks exactly as today (no "Recent Videos" section rendered)
- Valid entries: `▶` icon + filename, full row is clickable
- Missing entries: `⚠` icon + filename + "File missing" label + `✕` dismiss button; row is not clickable
- List has `maxHeight` with `overflowY: auto` scroll for long histories
- "Open Video" button is renamed to **"+ Import New Video"** for clarity; behavior unchanged

**Click handlers:**
- Valid entry click → `window.api.loadSession(videoPath)` → if session found, `loadSession(session)` + `setMode('review')`; if session file is unexpectedly missing, show an inline error message ("Session not found — please re-import this video") without navigating away
- `✕` dismiss → `window.api.removeSessionPath(videoPath)` → remove entry from local state immediately (optimistic update)

## Files Changed

| File | Change |
|------|--------|
| `src/main/services/SessionStore.ts` | Accept `userDataPath` in constructor; add `listPaths()`, `removePath()`; register/move path inside `_write()` |
| `src/main/ipc/channels.ts` | Add `LIST_SESSIONS`, `REMOVE_SESSION_PATH` |
| `src/main/ipc/handlers.ts` | Pass `app.getPath('userData')` to `SessionStore` constructor; add handlers for two new channels |
| `src/preload/index.ts` | Expose `listSessions()`, `removeSessionPath()` |
| `src/preload/index.d.ts` | Replace `api: unknown` with a fully typed `Api` interface covering all existing + new methods |
| `src/renderer/src/components/LandingScreen.tsx` | Load and render watch list on mount, handle open/dismiss |

## What Does Not Change

- Session file format (`<videoPath>.session.json`) — no migration needed
- `loadSession` / `saveSession` IPC — reused as-is for opening a watch list entry
- All other screens and modes

## Success Criteria

- Landing screen shows previously processed videos on startup, most recently accessed first
- Clicking a valid entry opens the session and goes to review mode without re-transcribing
- Re-opening a video moves it to the top of the list
- Missing entries show a warning indicator; clicking ✕ removes them from the list without deleting the session file
- Opening a video via "Import New Video" still works exactly as before
- Newly processed videos appear in the list on next app launch (index updated on `save()`)
- No data corruption under rapid concurrent saves (all index writes serialized through `saveQueue`)
