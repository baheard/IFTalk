# Critical Design Decisions

## Keyboard Input System (December 17, 2024)

1. **Inline Text Input**: Real `<input type="text">` field integrated into game output
   - Positioned at bottom of `lowerWindow` as last child
   - `>` prompt positioned absolutely as visual decoration (not editable)
   - Transparent background, monospace font matches game text
   - Native browser cursor for full editing capabilities

2. **Input Mode Detection**: Polls `getInputType()` every 100ms
   - **Line mode**: Shows input with `>` prompt, accepts text commands
   - **Char mode**: Hides input entirely, any keypress sends immediately
   - Prevents flash on transitions by starting hidden

3. **Echo Suppression**: Detects and skips game command echoes
   - Pattern matching for `glk-input` styled spans (blue echo text)
   - Compares plaintext against `window.lastSentCommand`
   - Skips display if content is ONLY an echo (not mixed with response)

4. **Focus Management**:
   - Auto-focus when input becomes visible (char → line transition)
   - Click anywhere in game area focuses input (unless selecting text)
   - Typing anywhere focuses input automatically
   - No focus manipulation in char mode (input hidden)

5. **No Manual Command Display**: Commands saved to history only, not echoed to output
   - User sees command in input field while typing
   - Game handles all output display (including echoed commands if applicable)
   - Cleaner separation of input vs output

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

## ~~AI Translation with Confidence Scoring~~ (DEPRECATED - Removed December 2024)

_AI translation has been removed. Commands are now sent directly to the game parser._

## ~~Unified Mode Toggle System~~ (DEPRECATED - Removed December 2024)

_AI mode toggle has been removed. All commands go directly to the game._

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

## ~~Two-Panel Input Layout~~ (DEPRECATED - Removed December 17, 2024)

_Old two-panel input system has been removed. Now uses inline keyboard input at bottom of game output._

**Current Input System**:
- Single inline text input field at bottom of `lowerWindow`
- No separate input panels or areas
- Command history accessible via history button
- Voice commands work via keyboard shortcuts and voice recognition

## Pronunciation Dictionary System

- **Client-side** (app.js lines 571-598): localStorage-backed, editable via settings panel
- **Server-side** (server.js lines 260-270): Same dictionary applied to ElevenLabs
- **Auto-detection**: Spaced capitals "A N C H O R H E A D" → "Anchorhead" → Title case
- Settings panel (⚙️) allows adding/removing pronunciation fixes
