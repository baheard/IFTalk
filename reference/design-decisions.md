# Critical Design Decisions

## Text Processing Pipeline

1. **Chunk Creation Always Happens**: `createNarrationChunks()` is called for ALL new game text, regardless of whether narration auto-starts
   - This ensures navigation buttons always work, even when narration is disabled
   - Previously, chunks were only created inside `speakTextChunked()`, causing UI bugs when skipping to end

2. **GlkOte Output Processing**:
   - GlkOte provides structured game output (not raw text streams)
   - Text comes pre-formatted from the Z-machine via proper API
   - No parsing needed - game state accessible directly
   - Game output wrapper (`.game-output-inner`) constrains max-width to 800px for readability

3. **Display vs Narration Split**: Text processed TWO ways:
   - **Display HTML**: Structured HTML from GlkOte with proper formatting
   - **Narration chunks**: All newlines → spaces, split on `.!?` for smooth TTS
   - **Critical**: Display regenerated to match narration chunks for accurate highlighting

4. **Client-side Processing**: All text processing happens in browser
   - No server-side text manipulation needed
   - Direct access to game output via GlkOte API

5. **Sentence splitting**: Split on `.!?` only (not newlines)

6. **Pronunciation fixes**: Applied before TTS via localStorage dictionary

7. **Spaced capitals**: "A N C H O R H E A D" → "Anchorhead" (collapsed + title case)

## Smart Back Button (lines 634-646)

- Within 500ms: Go to previous chunk
- After 500ms: Restart current chunk
- Mimics music player behavior

## Per-Sentence Highlighting

- Text wrapped in `<span class="sentence-chunk" data-chunk-index="N">`
- Only currently-speaking sentence gets `.speaking` class
- Highlight updates on each chunk, not entire text block

## Mute Button Behavior

- Mutes **microphone input** (stops listening)
- Does NOT mute audio output (narration continues)
- Auto-unmutes when starting talk mode
- Alt key = push-to-talk (hold to temporarily unmute)

## Navigation State Management

- `isNavigating` flag prevents concurrent navigation operations
- 100ms delay between navigation actions to prevent race conditions
- Pause/play button icon based on: `isNarrating && narrationEnabled && !isPaused`
- **Auto-resume behavior differs by button**:
  - ⬅️ Back / ➡️ Forward / ⏪ Restart: Auto-resume if `narrationEnabled` was true (lines 1065-1149)
  - ⏩ Skip All: Force stops completely, sets `narrationEnabled = false`, never resumes (lines 1152-1191)
- **Force stop critical**: `skipToEnd()` MUST set `narrationEnabled = false` FIRST before stopping audio, otherwise async loop continues to next chunk
- Voice commands: "skip all", "skip to end", "end" all trigger force stop (line 369)

## AI Translation with Confidence Scoring

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

## Unified Mode Toggle System

- **Single toggle** in Text Input panel header controls BOTH text and voice input (lines 1463-1468)
- **AI Mode** (checked/default): Commands translated by AI before sending
- **Direct Mode** (unchecked): Commands sent directly to game parser
- **Voice readback**: App Voice reads back recognized command before executing (line 407, 412)
- **Navigation commands**: back, skip, pause, play, stop, restart always work regardless of mode (lines 306-373)
- **Special commands**: "next", "enter", "more" always send empty string (press Enter); "print [text]" always direct

## Text Processing Split Architecture

- **Display text** (addGameText): Preserves formatting, wraps sentences for highlighting
- **TTS text** (speakTextChunked): Removes ALL newlines, collapses spaces, fixes pronunciation
- **Critical**: They process SEPARATELY - display ≠ what TTS speaks
- Spaced capitals auto-collapsed: `/\b([A-Z])\s+(?=[A-Z](?:\s+[A-Z]|\s*\b))/g`

## Scroll & Highlight Behavior

- **New text**: `scrollIntoView({block: 'start'})` shows TOP of text, not bottom
- **During narration**: Current sentence scrolls to `block: 'center'`
- **Slider scrubbing**: Updates highlight in real-time while dragging
- Function `updateTextHighlight(chunkIndex)` handles all highlight updates

## Error Suppression

- **Browser TTS**: `interrupted` error silenced (happens on normal pause/stop)
- **Speech recognition**: `no-speech` and `network` errors silenced (cosmetic)
- Only unexpected errors shown to user

## Voice Transcript States

- **Interim**: Gray italic while speaking
- **Confirmed**: Purple background, bold, lingers 2 seconds
- **History**: Moves to scrolling history above, shows last 3 with fading opacity

## Two-Panel Input Layout (index.html lines 131-163)

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

## Pronunciation Dictionary System

- **Client-side** (app.js lines 571-598): localStorage-backed, editable via settings panel
- **Server-side** (server.js lines 260-270): Same dictionary applied to ElevenLabs
- **Auto-detection**: Spaced capitals "A N C H O R H E A D" → "Anchorhead" → Title case
- Settings panel (⚙️) allows adding/removing pronunciation fixes
