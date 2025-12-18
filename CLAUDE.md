# IFTalk - Interactive Fiction with Voice Control

## Architecture Overview

**🎮 Fully Browser-Based - No Server-Side Game Logic**

- **Frontend**: Vanilla JavaScript (ES6 modules)
- **Game Engine**: ifvms.js (Z-machine interpreter) + GlkOte (display library)
  - Games run **entirely in the browser** (client-side)
  - ZVM interprets Z-code files (.z5, .z8)
  - GlkOte handles display, windowing, and input
- **Backend**: Node.js/Express - **static file server ONLY**
  - No game processing on server
  - **No Socket.IO** - completely removed (was legacy from Frotz architecture)
  - Just serves HTML, JS, CSS, and game files
- **TTS**: Browser Web Speech API (client-side only)
  - Narration runs entirely in browser with `speechSynthesis`
  - No server round-trip for audio generation
- **Speech Recognition**: Web Speech Recognition API (webkitSpeechRecognition)
- **Save/Restore**: Use in-game SAVE and RESTORE commands (ZVM native mechanism)

## File Structure

- `public/js/`: Modular JavaScript (ES6 modules)
  - `app.js`: Main application entry point
  - `game/game-loader.js`: ZVM initialization and game management
  - `game/commands.js`: Command handling
  - `voice/`: Voice recognition modules
  - `narration/`: TTS and narration modules
  - `ui/`: UI components (settings, history, etc.)
- `public/lib/`: Third-party libraries
  - `zvm.js`: ifvms Z-machine interpreter
  - `glkote.js`, `glkapi.js`: GlkOte display library
  - `dialog-stub.js`: Dialog handling
- `public/index.html`: UI structure with two-panel layout
- `public/styles.css`: Styling including gameport, controls, settings panel
- `server/`: Express server (static file serving only)
- `config.json`: Voice settings (browser TTS only)

## Quick Start

```bash
cd /e/Project/IFTalk && npm start
# Access at http://localhost:3000
```

**Architecture:** Browser-based ZVM + GlkOte (runs entirely in browser)

## Working with Claude

**Context Management:** Claude will warn when context usage reaches 85% (15% remaining). Use `/context` to check current usage.

## Third-Party Libraries

### ifvms.js (Z-Machine Interpreter)
- **Current Version**: 1.1.6 (released February 11, 2021) - ✅ Updated December 15, 2024
- **Previous Version**: Copyright 2017 (backed up as zvm.js.backup.2017)
- **GitHub**: [curiousdannii/ifvms.js](https://github.com/curiousdannii/ifvms.js)
- **npm**: [ifvms package](https://www.npmjs.com/package/ifvms)
- **Documentation**: [IFWiki - ZVM (ifvms.js)](https://www.ifwiki.org/ZVM_(ifvms.js))
- **License**: MIT
- **Description**: Third-generation VM engine for web IF interpreters with JIT compiler

### GlkOte (Display Library)
- **Current Version**: 2.2.5 (copyright 2008-2020)
- **Latest Version**: 2.3.7
- **GitHub**: [erkyrath/glkote](https://github.com/erkyrath/glkote)
- **Official Docs**: [eblong.com/zarf/glk/glkote/docs.html](https://eblong.com/zarf/glk/glkote/docs.html)
- **License**: MIT
- **Author**: Andrew Plotkin (erkyrath)
- **Description**: JavaScript display library for IF interfaces

### Other Dependencies
- **jQuery**: 3.7.1 (required by GlkOte)

## Reference Documentation

For detailed technical information, see the `reference/` folder:

### Architecture & Design
- **[ZVM Integration](reference/zvm-integration.md)** - ifvms.js + GlkOte setup and game loading
- **[Design Decisions](reference/design-decisions.md)** - Text processing pipeline, navigation, highlighting, scroll behavior
- **[State Variables](reference/state-variables.md)** - Key state flags and their purposes

### UX & Behavior
- **[Navigation Rules](reference/navigation-rules.md)** - Expected behavior for playback controls and text highlighting

### Implementation Details
- **[Text Highlighting System](reference/text-highlighting-system.md)** - Marker-based highlighting for TTS narration
- **[Bug Fixes History](reference/bug-fixes-history.md)** - Past bugs and solutions for context

### Deprecated (No Longer Used)
- ~~Frotz Configuration~~ - We use browser-based ZVM, not server-side Frotz
- ~~AI Translation~~ - Removed Ollama/OpenAI integration
- ~~ElevenLabs TTS~~ - Browser TTS only
- ~~Socket.IO~~ - Completely removed (Dec 2024)

## Recent Fixes (December 2024)

### December 15, 2024 - Core Fixes
1. **TTS/Narration Fixed** - Removed Socket.IO dependency, now uses browser `speechSynthesis` directly
   - File: `public/js/narration/tts-player.js`
   - TTS no longer hangs on Socket.IO promises
   - Faster response time (no server round-trip)

2. **Socket.IO Removed** - Completely eliminated legacy Socket.IO infrastructure
   - Files: `public/js/app.js`, `public/js/core/socket.js`, `public/js/game/saves.js`
   - App now runs in pure browser mode
   - No server dependencies for game logic or TTS

3. **Game Loading Fixed** - Resolved initialization hang
   - File: `public/js/core/socket.js`
   - Made Socket.IO optional (returns null if not loaded)
   - App initialization now completes successfully

4. **Generation Counter Fixed** - Resolved command rejection issue
   - File: `public/js/game/game-loader.js`
   - Track generation from GlkOte events instead of manual counter
   - Commands now accepted properly by ZVM

5. **VM Start Timing Fixed** - Resolved DOM initialization race condition
   - File: `public/js/game/game-loader.js`
   - Use `requestAnimationFrame` instead of `setTimeout`
   - Prevents "Cannot read properties of null" error

6. **ifvms.js Updated to 1.1.6** - Upgraded from 2017 version
   - File: `public/lib/zvm.js`
   - Fixes read opcode handling in Z-Machine v3-4
   - Better game compatibility (upper window input, screen height measurement)
   - Performance improvements and bug fixes
   - Previous version backed up as `zvm.js.backup.2017`

### December 16, 2024 - UX & Feature Improvements
1. **Comprehensive TTS Logging** - Added detailed logging throughout TTS pipeline
   - Files: `public/js/narration/tts-player.js`, `public/js/app.js`, `public/js/ui/game-output.js`
   - Logs speech synthesis events, chunk creation, voice configuration
   - Easier debugging of narration issues

2. **Microphone Muted by Default** - Changed default mic state
   - File: `public/js/core/state.js:24`
   - `isMuted: true` - mic starts muted, user must enable
   - Prevents accidental voice input on page load

3. **Upper Window Text Narration** - Fixed missing quote/formatted text narration
   - File: `public/js/ui/game-output.js:84-107`
   - Now includes upper window content (quotes, ASCII art) in narration chunks
   - Narration order: Status bar → Upper window → Main content

4. **Autoplay Fixes** - Fixed autoplay not respecting off state
   - Files: `public/js/narration/navigation.js`, `public/js/app.js`, `public/js/core/state.js`
   - Fixed restart button auto-starting when autoplay off
   - Fixed new page auto-starting when autoplay off
   - Added state tracking with logging for debugging
   - Navigation only resumes if actively playing, not just based on autoplay

5. **Settings Panel Fixed** - Fixed settings button not opening panel
   - Files: `public/js/ui/settings.js:20,29`, `public/index.html:22`
   - Changed from `hidden` class to `open` class to match CSS
   - Panel now slides in/out smoothly from right

6. **Speech Speed Control** - Added adjustable speech rate slider
   - Files: `public/index.html:74-81`, `public/styles.css:304-362`, `public/js/ui/settings.js:69-95`
   - Range: 0.5x - 1.5x speed (default 1.0x)
   - Slider with real-time preview
   - Saved to localStorage

7. **Collapsible Settings Sections** - Made all settings sections expandable
   - Files: `public/index.html`, `public/styles.css:264-302`, `public/js/ui/settings.js:58-67`
   - All sections start collapsed
   - Click header to expand/collapse
   - Smooth animations with arrow indicators
   - Minimal 4px spacing between sections

8. **Push-to-Talk Key Changed** - Changed from Alt to Ctrl
   - Files: `public/js/app.js:323,355`, `public/index.html:61`
   - Alt key caused browser menu focus issues
   - Ctrl key works without interfering with browser

9. **Voice Commands Cleanup** - Removed AI translation reference
   - File: `public/index.html:54`
   - Removed outdated "Any other speech - AI translates to command" line

10. **Auto-scroll to Highlight** - Screen scrolls to currently highlighted text
   - File: `public/js/narration/highlighting.js:148-221`
   - Finds next visible element after invisible marker
   - Centers highlighted text in viewport
   - Smooth scroll animation

11. **Title Chunking** - Asterisk-wrapped titles split into separate chunks
   - File: `public/js/narration/chunking.js:24-27`
   - Regex detects `* TITLE *` patterns
   - Creates chunk boundaries before and after titles
   - Enables separate narration of section headers

### December 17, 2024 - Keyboard Input System Overhaul
1. **Removed Old Input System** - Eliminated placeholder input/textarea UI
   - Files: `public/js/app.js`, `public/js/core/dom.js`, `public/js/game/game-loader.js`
   - Removed: `userInput`, `sendBtn`, `inputArea`, `commandHistoryBtn` elements
   - Removed event listeners for old input elements
   - Cleaned up focus and placeholder manipulation code

2. **New Inline Keyboard Input** - Real text input with styled prompt
   - Files: `public/js/input/keyboard.js`, `public/index.html`, `public/styles.css`
   - Text input field with `>` prompt positioned as visual decoration
   - Native browser cursor for editing
   - Click anywhere in game area to focus input
   - Auto-focus when input becomes visible
   - Supports full text editing (click, select, arrow keys, etc.)

3. **Input Mode Detection** - Different behavior for line vs char input
   - File: `public/js/input/keyboard.js`
   - **Line mode**: Shows input field with `>` prompt for typing commands
   - **Char mode**: Hides input entirely, any key advances from anywhere
   - Polls input type every 100ms to update visibility
   - Prevents flash on mode transitions

4. **Echo Suppression** - Detects and skips game command echoes
   - File: `public/js/ui/game-output.js`
   - Detects `glk-input` styled echoes (blue command text)
   - Skips display of echoed commands from game
   - User sees command in input field, not duplicated in output
   - Comprehensive pattern matching for various echo formats

5. **Command Display Cleanup** - Removed manual command echo
   - File: `public/js/game/commands.js`
   - No longer displays user commands with `addGameText()`
   - Commands saved to history only
   - Game handles all output display

6. **Focus Behavior** - Improved keyboard accessibility
   - File: `public/js/input/keyboard.js`
   - Input auto-focuses when visible (line mode)
   - Clicking game content focuses input (unless selecting text)
   - Typing anywhere focuses input automatically
   - No focus flash or jarring transitions

7. **Styling** - Clean visual integration
   - File: `public/styles.css`
   - `>` prompt positioned absolutely inside input area

12. **Autosave System Investigation** - Researched ifvms.js built-in autosave
   - **Critical Finding**: ifvms.js autosave ONLY works for Glulx games, NOT Z-machine games
   - Root cause: `save_allstate()` in glkapi.js requires GiDispa (Glulx dispatch layer)
   - GiDispa is null for Z-machine games (Lost Pig, Anchorhead, Zork, etc.)
   - Error: `Cannot read properties of null (reading 'get_retained_array')`
   - **Solution**: Confirmed custom save-manager.js is the correct approach for Z-machine
   - File: `public/js/game/game-loader.js:82` - Set `do_vm_autosave: false`
   - File: `public/js/game/voxglk.js:335-348` - Restored manual autoSave() calls
   - Files modified but reverted: `public/lib/dialog-stub.js`, `public/lib/glkapi.js`
   - **Documentation**: Updated `reference/save-restore-research.md` with findings
   - See: [Save/Restore Research](reference/save-restore-research.md#critical-finding-z-machine-vs-glulx-autosave-support)

13. **Autosave/Restore Completed** - Fully functional with "bootstrap" technique
   - **The Problem**: After `restore_file()`, VM memory restored but VM frozen (not running)
   - **The Solution**: "Wake" VM by fulfilling intro's pending char input request
   - Files: `public/js/game/voxglk.js`, `public/js/game/save-manager.js`
   - **How it works**:
     1. Game starts, intro shows char input request at gen: 1
     2. autoLoad() restores VM memory + VoxGlk state + display HTML
     3. Send char input with `gen: 1` to fulfill intro's pending request
     4. VM wakes up, processes input in restored state
     5. VM sends fresh update with line input at restored generation
     6. User can send commands normally
   - **Why this works**: Uses intro's char request as "bootstrap trigger" to wake frozen VM
   - **Failed alternatives**: vm.run() (conflicts), cancel input (doesn't help), no wake (VM stays frozen)
   - **Key insight**: Must use `gen: 1` (intro's generation), not restored generation (e.g., 5)
   - **Result**: Clean restore with no error messages, commands work immediately
   - **Documentation**: Updated `reference/save-restore-status.md` with complete details

### What Works Now
- ✅ Game selection and loading
- ✅ Browser-based ZVM game engine
- ✅ Inline keyboard input with mode detection (line/char)
- ✅ **Autosave/restore** - Automatic save after each turn, restores on page load
- ✅ Text-to-speech narration (browser-based) with speed control
- ✅ Upper window (quotes/formatting) narration
- ✅ Text highlighting with auto-scroll during narration
- ✅ Title chunking for asterisk-wrapped section headers
- ✅ Command input and processing with echo suppression
- ✅ Navigation controls (with proper autoplay handling)
- ✅ Voice recognition with Ctrl push-to-talk
- ✅ Settings panel with collapsible sections
- ✅ Speech rate adjustment (0.5x - 1.5x)
- ✅ Auto-focus and click-to-focus behavior
- ✅ Fully offline-capable

## Current Status

See [TODO.md](TODO.md) for current tasks and progress.
