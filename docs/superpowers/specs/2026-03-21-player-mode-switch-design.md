# Design: Preserve Video Playback Position Across Mode Switches

**Date:** 2026-03-21
**Status:** Approved

## Problem

Switching between Watch (Play/Mark) mode and Review mode causes the video to reset to `currentTime = 0`. The root cause is that `App.tsx` conditionally renders `<WatchMode>` and `<ReviewMode>` as separate components — each owns a separate `<VideoPlayer>` instance. When the mode changes, React unmounts one component and mounts the other, destroying the `<video>` element and its playback state.

## Solution: Merge WatchMode + ReviewMode into PlayerView

Replace the two conditional mode components with a single always-mounted `PlayerView` component. It renders one `<VideoPlayer>` instance for the lifetime of the session and toggles the surrounding chrome (toolbars, transcript panel) using CSS (`display: none / flex`) based on `mode`.

## Architecture

### New component: `PlayerView`

Located at `src/renderer/src/components/PlayerView/PlayerView.tsx`.

Replaces both `WatchMode.tsx` and `ReviewMode.tsx` in `App.tsx`:

```
App.tsx
  {mode === 'watch' || mode === 'review'} → <PlayerView />
```

### Layout structure

```
<div style={{ display: flex, flexDirection: column, height: 100vh }}>
  <!-- ReviewMode top bar: display flex when review, none when watch -->
  <TopBar />

  <!-- Main content row -->
  <div style={{ display: flex, flex: 1 }}>
    <!-- Video container: width 100% (watch) or 55% (review) -->
    <div style={{ width: mode === 'review' ? '55%' : '100%' }}>
      <VideoPlayer ref={videoRef} ... />   ← single instance, always mounted
    </div>

    <!-- Transcript panel: display block when review, none when watch -->
    <TranscriptPanel style={{ display: mode === 'review' ? ... : 'none' }} />
  </div>

  <!-- WatchMode bottom toolbar: display flex when watch, none when review -->
  <WatchToolbar />
</div>
```

The `<VideoPlayer>` (and the underlying `<video>` element) is never unmounted. Width changes from 100% → 55% on switch to review; the browser resizes the video in place.

### State

- `videoRef: RefObject<VideoPlayerHandle>` — owned by `PlayerView`, passed to child chrome components as needed
- `currentTime: number` — local state in `PlayerView`, updated via `onTimeUpdate`; drives `activeSentenceId` for transcript highlighting (currently owned by `ReviewMode`)
- `selected: Sentence | null` — local state for the DiagnosticMenu popover (currently owned by `ReviewMode`)
- No changes to `transcriptStore`

### Keyboard handler

The `keydown` listener (Space = toggle play, R = mark sentence) currently lives in `WatchMode`. It moves to `PlayerView` and fires regardless of which mode is active — marking still works in review mode.

## Files Changed

| File | Change |
|------|--------|
| `src/renderer/src/App.tsx` | Replace `{mode === 'watch' && <WatchMode>}` + `{mode === 'review' && <ReviewMode>}` with `{(mode === 'watch' || mode === 'review') && <PlayerView>}` |
| `src/renderer/src/components/PlayerView/PlayerView.tsx` | New file — merged logic from WatchMode + ReviewMode |
| `src/renderer/src/components/WatchMode/WatchMode.tsx` | Delete |
| `src/renderer/src/components/ReviewMode/ReviewMode.tsx` | Delete |
| `src/renderer/src/components/WatchMode/VideoPlayer.tsx` | No changes — stays in place, imported by PlayerView |
| `src/renderer/src/components/ReviewMode/TranscriptPanel.tsx` | No changes — imported by PlayerView |
| `src/renderer/src/components/ReviewMode/DiagnosticMenu.tsx` | No changes — imported by PlayerView |

## What Does Not Change

- `VideoPlayer.tsx` — no changes to the player component or its handle interface
- `transcriptStore.ts` — no new fields; `setMode()` is called exactly as before
- `TranscriptPanel.tsx`, `DiagnosticMenu.tsx` — consumed as-is by PlayerView

## Success Criteria

- Switching from Watch → Review and back preserves `currentTime` with no visible seek or flash
- Paused/playing state is preserved across the switch
- Marking sentences, transcript highlighting, and DiagnosticMenu all work correctly in their respective modes
