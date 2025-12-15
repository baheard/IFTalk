# Bug Fixes & Key Learnings History

## Chunk Creation Separation (Bug Fix - 2025-12-12)

**Bug**: After "skip to end", new text (e.g., from "more" command) had disabled navigation buttons

**Root cause**: Chunks only created when `speakTextChunked()` ran, but skip-to-end set `narrationEnabled = false`, so chunks never created

**Fix**: Extracted chunk creation into separate `createNarrationChunks()` function

**New behavior**:
- Chunks ALWAYS created when new text arrives, regardless of narration state
- `narrationEnabled` now only controls auto-play, not chunk creation
- Navigation buttons now work properly even when narration is disabled

## Stale Audio Race Condition (Bug Fix - 2025-12-12)

**Bug**: When navigating during audio loading, wrong audio would play (e.g., chunk 2's audio playing for chunk 3)

**Root cause**: Socket 'audio-ready' handler would receive ANY audio response, including stale ones from cancelled chunks

**Fix**: `stopNarration()` now calls `socket.off('audio-ready')` to clear ALL pending audio handlers (line 559)

**Scenario prevented**:
1. Chunk 2 requests audio from server
2. User navigates → cancels → chunk 3 starts
3. Old audio from chunk 2 arrives → ignored (handler removed)
4. Chunk 3 requests its own audio → plays correctly

## Voice Command Processing (lines 176-278)

**hasProcessedResult flag**: Only set in `onend` AFTER sending, not in `onresult`

**Bug fix**: Was setting true in `onresult`, preventing auto-send in `onend`

**Behavior**:
- Voice commands (restart/back/stop/pause/play/skip) NEVER sent to IF parser
- During narration, all non-navigation speech is ignored

## Manual Typing Protection (Bug Fix - 2025-12-12)

**Bug**: Voice recognition auto-send would send manually-typed text when recognition ended

**hasManualTyping flag**: Set to `true` on any keydown (except Enter), prevents auto-send

**Implementation**:
- Voice sets input: Flag cleared when voice recognition populates input box (line 234, 239)
- After sending: Flag cleared in both `sendCommand()` (line 1423) and `sendCommandDirect()` (line 1372)
- **Behavior**: If user types anything manually, they MUST press Enter to send (no auto-send)
