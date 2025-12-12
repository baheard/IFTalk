# IFTalk - Interactive Fiction with Voice Control

## Architecture Overview
- **Frontend**: Vanilla JavaScript (app.js), Socket.IO client
- **Backend**: Node.js, Socket.IO server, Frotz IF interpreter
- **TTS**: Browser Web Speech API (default), ElevenLabs API (optional)
- **Speech Recognition**: Web Speech Recognition API (webkitSpeechRecognition)

## Key State Variables (app.js)
- `isNarrating`: Currently playing audio
- `narrationEnabled`: Whether narration should play
- `isPaused`: Narration paused (not stopped)
- `isMuted`: Microphone muted (NOT audio muted)
- `listeningEnabled`: Continuous voice recognition active
- `talkModeActive`: Both listening and narration active together
- `currentChunkIndex`: Position in sentence array for navigation
- `currentChunkStartTime`: Timestamp for smart back button (500ms threshold)

## Critical Design Decisions

### Text Processing Pipeline
1. **Chunk Creation Always Happens**: `createNarrationChunks()` (lines 873-976) is called for ALL new game text, regardless of whether narration auto-starts
   - This ensures navigation buttons always work, even when narration is disabled
   - Previously, chunks were only created inside `speakTextChunked()`, causing UI bugs when skipping to end
2. **Display vs Narration Split**: Text processed TWO ways:
   - **Narration chunks**: All newlines → spaces, split on `.!?` for smooth TTS
   - **Display HTML**: Uses null-byte markers (`\x00LINEBREAK\x00`, `\x00PARAGRAPH\x00`) to preserve formatting, then converts to `<br>` tags
   - **Critical**: Display regenerated to match narration chunks for accurate highlighting
3. **Server sends HTML**: ANSI codes converted to HTML by server (via `ansi-to-html`), client strips tags before TTS
4. **Sentence splitting**: Split on `.!?` only (not newlines)
5. **Pronunciation fixes**: Applied before TTS via localStorage dictionary
6. **Spaced capitals**: "A N C H O R H E A D" → "Anchorhead" (collapsed + title case)

### Smart Back Button (lines 634-646)
- Within 500ms: Go to previous chunk
- After 500ms: Restart current chunk
- Mimics music player behavior

### Per-Sentence Highlighting
- Text wrapped in `<span class="sentence-chunk" data-chunk-index="N">`
- Only currently-speaking sentence gets `.speaking` class
- Highlight updates on each chunk, not entire text block

### Mute Button Behavior
- Mutes **microphone input** (stops listening)
- Does NOT mute audio output (narration continues)
- Auto-unmutes when starting talk mode
- Alt key = push-to-talk (hold to temporarily unmute)

### Navigation State Management
- `isNavigating` flag prevents concurrent navigation operations
- 100ms delay between navigation actions to prevent race conditions
- Pause/play button icon based on: `isNarrating && narrationEnabled && !isPaused`
- **Auto-resume behavior differs by button**:
  - ⬅️ Back / ➡️ Forward / ⏪ Restart: Auto-resume if `narrationEnabled` was true (lines 1065-1149)
  - ⏩ Skip All: Force stops completely, sets `narrationEnabled = false`, never resumes (lines 1152-1191)
- **Force stop critical**: `skipToEnd()` MUST set `narrationEnabled = false` FIRST before stopping audio, otherwise async loop continues to next chunk
- Voice commands: "skip all", "skip to end", "end" all trigger force stop (line 369)

### AI Translation with Confidence Scoring
- **Server** (server.js lines 188-258): Returns JSON `{command, confidence, reasoning}`
- **Client** (app.js lines 1327-1359): Handles both old string format and new JSON (backward compatible)
- **Visual feedback**: Voice transcript shows "🤖 Translating..." with pulsing purple background while AI processes (lines 1466-1468, 1481-1482)
- **Confidence levels**:
  - 90-100: High (no indicator shown)
  - 70-89: Medium (shows percentage)
  - <70: Low (shows ⚠️ warning with reasoning)
- **Context-aware**: Server includes last room description (600 chars) in AI prompt for spatial awareness
- **Temperature**: 0.1 for deterministic translations
- **Object preservation**: Prompt explicitly instructs to preserve objects in "look at X" / "examine X" commands (lines 201-202, 212-214)
  - "look at alley" → "EXAMINE ALLEY" (NOT just "LOOK")
  - "look around" → "LOOK" (no object specified)

### Unified Mode Toggle System
- **Single toggle** in Text Input panel header controls BOTH text and voice input (lines 1463-1468)
- **AI Mode** (checked/default): Commands translated by AI before sending
- **Direct Mode** (unchecked): Commands sent directly to game parser
- **Voice readback**: App Voice reads back recognized command before executing (line 407, 412)
- **Navigation commands**: back, skip, pause, play, stop, restart always work regardless of mode (lines 306-373)
- **Special commands**: "next", "enter", "more" always send empty string (press Enter); "print [text]" always direct

## Recent Additions & Key Learnings

### Chunk Creation Separation (Bug Fix - 2025-12-12)
- **Bug**: After "skip to end", new text (e.g., from "more" command) had disabled navigation buttons
- **Root cause**: Chunks only created when `speakTextChunked()` ran, but skip-to-end set `narrationEnabled = false`, so chunks never created
- **Fix**: Extracted chunk creation into separate `createNarrationChunks()` function
- **New behavior**: Chunks ALWAYS created when new text arrives, regardless of narration state
- `narrationEnabled` now only controls auto-play, not chunk creation
- Navigation buttons now work properly even when narration is disabled

### Stale Audio Race Condition (Bug Fix - 2025-12-12)
- **Bug**: When navigating during audio loading, wrong audio would play (e.g., chunk 2's audio playing for chunk 3)
- **Root cause**: Socket 'audio-ready' handler would receive ANY audio response, including stale ones from cancelled chunks
- **Fix**: `stopNarration()` now calls `socket.off('audio-ready')` to clear ALL pending audio handlers (line 559)
- **Scenario prevented**:
  1. Chunk 2 requests audio from server
  2. User navigates → cancels → chunk 3 starts
  3. Old audio from chunk 2 arrives → ignored (handler removed)
  4. Chunk 3 requests its own audio → plays correctly

### Voice Command Processing (lines 176-278)
- **hasProcessedResult flag**: Only set in `onend` AFTER sending, not in `onresult`
- **Bug fix**: Was setting true in `onresult`, preventing auto-send in `onend`
- Voice commands (restart/back/stop/pause/play/skip) NEVER sent to IF parser
- During narration, all non-navigation speech is ignored

### Manual Typing Protection (Bug Fix - 2025-12-12)
- **Bug**: Voice recognition auto-send would send manually-typed text when recognition ended
- **hasManualTyping flag**: Set to `true` on any keydown (except Enter), prevents auto-send
- **Voice sets input**: Flag cleared when voice recognition populates input box (line 234, 239)
- **After sending**: Flag cleared in both `sendCommand()` (line 1423) and `sendCommandDirect()` (line 1372)
- **Behavior**: If user types anything manually, they MUST press Enter to send (no auto-send)

### Two-Panel Input Layout (index.html lines 131-163)
- **Left panel (Voice)**: Only visible when talk mode is active
  - Voice input with meter + live transcript
  - Voice command history: Shows last 3 by default, expands to 20 with "Show More"
  - Expand/collapse state saved to localStorage
  - Navigation commands (stop, play, back, skip) highlighted in orange
- **Right panel (Text)**: Always visible
  - Text input + command history (last 10) with translation display
  - Command history shows: `"go north" → N` when AI translates
- Voice history separate from command history
- **Voice history management** (lines 67-125):
  - Stores up to 20 items with metadata `{text, isNavCommand}`
  - Compact view: Shows last 3 with aging classes (old, older)
  - Expanded view: Shows up to 20 items without aging effects
  - Auto-hides expand button if ≤3 items

### Pronunciation Dictionary System
- **Client-side** (app.js lines 571-598): localStorage-backed, editable via settings panel
- **Server-side** (server.js lines 260-270): Same dictionary applied to ElevenLabs
- **Auto-detection**: Spaced capitals "A N C H O R H E A D" → "Anchorhead" → Title case
- Settings panel (⚙️) allows adding/removing pronunciation fixes

### Text Processing Split Architecture
- **Display text** (addGameText): Preserves formatting, wraps sentences for highlighting
- **TTS text** (speakTextChunked): Removes ALL newlines, collapses spaces, fixes pronunciation
- **Critical**: They process SEPARATELY - display ≠ what TTS speaks
- Spaced capitals auto-collapsed: `/\b([A-Z])\s+(?=[A-Z](?:\s+[A-Z]|\s*\b))/g`

### Scroll & Highlight Behavior
- **New text**: `scrollIntoView({block: 'start'})` shows TOP of text, not bottom
- **During narration**: Current sentence scrolls to `block: 'center'`
- **Slider scrubbing**: Updates highlight in real-time while dragging
- Function `updateTextHighlight(chunkIndex)` handles all highlight updates

### Error Suppression
- **Browser TTS**: `interrupted` error silenced (happens on normal pause/stop)
- **Speech recognition**: `no-speech` and `network` errors silenced (cosmetic)
- Only unexpected errors shown to user

### Voice Transcript States
- **Interim**: Gray italic while speaking
- **Confirmed**: Purple background, bold, lingers 2 seconds
- **History**: Moves to scrolling history above, shows last 3 with fading opacity

## File Structure
- `public/app.js`: All client-side logic (~1600 lines)
- `public/index.html`: UI structure with two-panel layout
- `public/styles.css`: Styling including sentence highlighting + settings panel
- `server.js`: Socket.IO + Frotz bridge + optional ElevenLabs TTS
- `config.json`: Voice settings (browser/ElevenLabs) + pronunciation dictionary
