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

**Updated methods:**
- `save(session)` — unchanged externally; internally also registers `session.videoPath` in the index if absent
- `load(videoPath)` — unchanged
- `listPaths(): Promise<string[]>` — reads and returns the index array (returns `[]` if file does not exist yet)
- `removePath(videoPath): Promise<void>` — removes a single entry from the index (does NOT delete the `.session.json` file)

`SessionStore` imports `app` from Electron directly to resolve `userData`. No constructor changes.

### IPC layer

Two new channels added to `channels.ts`:

| Channel | Input | Output | Description |
|---------|-------|--------|-------------|
| `LIST_SESSIONS` | — | `{ videoPath: string; exists: boolean }[]` | Reads index, checks each path with `fs.access`, returns combined result |
| `REMOVE_SESSION_PATH` | `videoPath: string` | `void` | Removes path from the index |

`LIST_SESSIONS` performs the `fs.access` check in the main process (filesystem access). The renderer derives the display filename from the path using a string split — no `path` module import needed in the renderer.

### Preload / window.api

Two new methods exposed via `contextBridge`:

```ts
listSessions(): Promise<{ videoPath: string; exists: boolean }[]>
removeSessionPath(videoPath: string): Promise<void>
```

### LandingScreen

On mount, `LandingScreen` calls `window.api.listSessions()` and stores the result in local state. Entries are displayed in reverse order (most recently added last in the index = shown first, so we reverse the array).

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
- Valid entry click → `window.api.loadSession(videoPath)` → if session found, `loadSession(session)` + `setMode('review')`; if somehow not found (race condition), fall through to open dialog
- `✕` dismiss → `window.api.removeSessionPath(videoPath)` → remove entry from local state immediately (optimistic update)

## Files Changed

| File | Change |
|------|--------|
| `src/main/services/SessionStore.ts` | Add `listPaths()`, `removePath()`, register path on `save()` |
| `src/main/ipc/channels.ts` | Add `LIST_SESSIONS`, `REMOVE_SESSION_PATH` |
| `src/main/ipc/handlers.ts` | Add handlers for the two new channels |
| `src/preload/index.ts` | Expose `listSessions()`, `removeSessionPath()` |
| `src/preload/index.d.ts` | Add type declarations for the two new methods |
| `src/renderer/src/components/LandingScreen.tsx` | Load and render watch list, handle open/dismiss |

## What Does Not Change

- Session file format (`<videoPath>.session.json`) — no migration needed
- `loadSession` / `saveSession` IPC — reused as-is for opening a watch list entry
- All other screens and modes

## Success Criteria

- Landing screen shows previously processed videos on startup
- Clicking a valid entry opens the session and goes to review mode without re-transcribing
- Missing entries show a warning indicator; clicking ✕ removes them from the list without deleting the session file
- Opening a video via "Import New Video" still works exactly as before
- Newly processed videos appear in the list on next app launch (index updated on `save()`)
