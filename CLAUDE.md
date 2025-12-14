# IFTalk - Interactive Fiction with Voice Control

## Architecture Overview
- **Frontend**: Vanilla JavaScript (app.js), Socket.IO client
- **Backend**: Node.js, Socket.IO server, Frotz IF interpreter
- **TTS**: Browser Web Speech API (default), ElevenLabs API (optional)
- **Speech Recognition**: Web Speech Recognition API (webkitSpeechRecognition)

## Frotz Configuration (config.json)

### Current dfrotz Version: 2.44

```json
"interpreter": "./dfrotz.exe",
"interpreterArgs": []
```

**Important:** dfrotz version 2.44 does NOT support the `-f`, `-m`, or `-q` flags. These flags were added in version 2.51 (February 2020). No pre-compiled Windows binary exists for v2.51+, so we use v2.44 with no flags.

### dfrotz 2.44 Output Format

- **Plain text only** - No ANSI escape codes for formatting
- **No bold/colors/underline** - All text is unformatted
- **Works perfectly** - Games are fully playable, just without visual formatting
- **Server processing** - The `ansi-to-html` library has nothing to convert (no codes present)

### Supported Flags in dfrotz 2.44

Available flags (use sparingly - most are unnecessary for server use):

- `-a` - Watch attribute setting
- `-A` - Watch attribute testing
- `-h #` - Screen height (requires number)
- `-i` - Ignore fatal errors
- `-I #` - Interpreter number
- `-o` - Watch object movement
- `-O` - Watch object locating
- `-p` - Plain ASCII output only (avoid - degrades text quality)
- `-P` - Alter piracy opcode
- `-s #` - Random number seed value
- `-S #` - Transcript width
- `-t` - Set Tandy bit
- `-u #` - Slots for multiple undo
- `-w #` - Screen width
- `-x` - Expand abbreviations g/x/z
- `-Z #` - Error checking mode (0-3)

**Recommendation:** Use no flags (empty array) for best compatibility.

### Upgrading to Newer Versions

If you need ANSI formatting support (bold text, colors), you would need dfrotz 2.51+:

**Version 2.51+ adds:**
- `-f ansi` - Enable ANSI escape codes for formatting
- `-m` - Disable MORE prompts
- `-q` - Quiet mode (suppress startup messages)

**Problem:** No pre-compiled Windows binary available. Would require:
- Compiling from source using WSL/MinGW/Cygwin
- Significant time investment for minimal visual improvement
- Current v2.44 works perfectly for gameplay

**Latest version:** Frotz 2.55 (February 2025) - source code only

### Status Line Detection

**Two patterns supported** (server.js lines 82-97):

1. **Old pattern**: `) ` marker followed by status content
   ```
   )   Outside the Real Estate Office                      day one
   ```

2. **New pattern**: Few leading spaces, text, 20+ spaces, more text
   ```
      Outside the Real Estate Office                      day one
   ```

**Processing**:
- Server extracts status line (server.js lines 88, 94)
- Compares to previous status line (lines 234-237, 292-295)
- Emits `clear-screen` event when status line changes (lines 235, 293)
- Client clears game output and resets narration state (app.js lines 2054-2063)

### Artifact Filtering

**Filtered patterns** (server.js lines 112-126):
- `.` - Blank line indicator
- `. )` - Paragraph break artifact
- `. ` - Spacing artifact
- Empty lines

**NOT filtered**:
- `)` - Status line marker (intentionally preserved since line 121)

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
2. **Server-side Line Break Processing** (server.js lines 124-165, 199-232):
   - Frotz outputs fixed-width terminal text with `\r\n` line endings and centering whitespace
   - Server normalizes `\r\n` and `\r` to `\n`, then processes line by line:
     - Each line is trimmed (removes centering whitespace)
     - Artifact lines (standalone `.`, `)`, empty) become paragraph breaks
     - Real content lines are preserved with single `<br>` between them
   - Result: Clean text with proper paragraph breaks, no terminal formatting artifacts
   - Game output wrapper (`.game-output-inner`) constrains max-width to 800px for readability
3. **Display vs Narration Split**: Text processed TWO ways:
   - **Display HTML**: Server-processed HTML with `<br><br>` for paragraphs
   - **Narration chunks**: All newlines → spaces, split on `.!?` for smooth TTS
   - **Critical**: Display regenerated to match narration chunks for accurate highlighting
4. **Server sends HTML**: ANSI codes converted to HTML by server (via `ansi-to-html`), client strips tags before TTS
5. **Sentence splitting**: Split on `.!?` only (not newlines)
6. **Pronunciation fixes**: Applied before TTS via localStorage dictionary
7. **Spaced capitals**: "A N C H O R H E A D" → "Anchorhead" (collapsed + title case)

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

## Development Server Management

### Starting the Development Server

```bash
cd /c/source/IFTalk && npm start
```

The server runs on port 3000 by default.

### Checking for Running Servers

```bash
# Check if port 3000 is in use
netstat -ano | findstr :3000

# List all running Node.js processes
tasklist | findstr node
```

### Killing Stuck Processes

When you see "EADDRINUSE" errors (port already in use), you need to kill the existing process:

**Method 1: PowerShell (Recommended)**
```bash
powershell -Command "Stop-Process -Id <PID> -Force"
```

**Method 2: Using netstat to find the PID**
```bash
# Find the process ID using port 3000
netstat -ano | findstr :3000
# Output shows: TCP  0.0.0.0:3000  ...  LISTENING  <PID>

# Kill the process
powershell -Command "Stop-Process -Id <PID> -Force"
```

**Important**: The `taskkill /F /PID` command doesn't work properly in Git Bash because it interprets `/F` as a path. Always use PowerShell for killing processes.

### Multiple Background Servers

Claude Code may start multiple background npm processes. To clean them all up:

1. List all Node processes: `tasklist | findstr node`
2. Kill specific processes or restart your terminal
3. Verify port 3000 is free before starting a new server

### Best Practices

- Always check if the server is already running before starting a new one
- Use the KillShell tool for Claude Code background processes
- Use PowerShell commands for killing Windows processes by PID
- **Restart the server when changes are complete** - after modifying server.js or client files (app.js, styles.css, index.html), restart the server so changes take effect

## Web Agent Screenshots

Screenshots taken by the web-agent-mcp tool are saved to:
```
E:\Project\web-agent-mcp\screenshots\
```

To view a screenshot, use the Read tool with the full path:
```
E:\Project\web-agent-mcp\screenshots\<filename>.png
```

List available screenshots with `mcp__web-agent-mcp__list_screenshots`.
