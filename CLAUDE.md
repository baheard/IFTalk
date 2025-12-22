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
- **Save/Restore**: Custom system with autosave + `save [name]` / `restore [name]` commands

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

### Development & Debugging
- **[Remote Debugging](reference/remote-debugging.md)** - iOS/mobile debugging via LogTail
- **[Reference Index](reference/README.md)** - Full table of contents for all reference docs

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

### December 18, 2024 - Per-Game Settings System
1. **Organized Per-Game Settings** - Centralized storage for game-specific preferences
   - Files: `public/js/utils/game-settings.js` (new), `public/js/ui/settings.js`, `public/js/game/game-loader.js:13,31`
   - Settings stored as JSON objects in localStorage: `gameSettings_LostPig`, `gameSettings_Anchorhead`, etc.
   - Each game remembers its own: narrator voice, app voice, speech rate
   - Settings automatically reload when switching games
   - Default fallback when no game-specific settings saved
   - **Extensible architecture** ready for future per-game preferences:
     - Current: narratorVoice, appVoice, speechRate
     - Future: autoplay, highlightColor, fontSize, etc.
   - Clean API:
     - Settings: `getGameSetting()`, `setGameSetting()`, `loadGameSettings()`, `reloadSettingsForGame()`
     - Data management: `getGameData()`, `hasGameData()`, `clearAllGameData()`, `listAllGames()`
   - **Save data kept separate** (performance/size) but **logically grouped** via helper functions
   - Helpers manage settings + saves together: `clearAllGameData('lostpig')` removes settings, quicksave, and glkote save
   - Separation of concerns: game-settings.js (storage) → settings.js (UI) → game-loader.js (triggers)
   - Status messages show game name when changing settings: "Narrator voice: Karen (lostpig)"

### December 22, 2024 - Mobile Keyboard Scroll Fix
1. **Mobile Keyboard Aware Scrolling** - New content scrolls into view even with keyboard open
   - File: `public/js/utils/scroll.js:45-81`
   - `scrollToNewContent()` now uses Visual Viewport API (same as narration scroll logic)
   - Detects actual visible height when keyboard is open
   - Accounts for viewport offset when viewport shifts down
   - Positions new content in upper portion of visible area (8% buffer from top)
   - **Before**: New content could be hidden behind mobile keyboard
   - **After**: New content always visible at top of viewport, even with keyboard open
   - Uses smooth scroll animation for better UX
   - Consistent behavior whether narration is active or not
   - **Note**: Does NOT auto-scroll when keyboard opens/closes - only when NEW content arrives

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

---

## Web Agent MCP Configuration

This project uses the `web-agent-mcp` server for browser automation, screenshot testing, and web debugging.

### Context-Efficient Screenshot Practices

**IMPORTANT**: Follow these guidelines when taking screenshots to minimize context token usage:

#### Default Behavior (Automatic)
- Screenshots save ONLY 800px lowRes by default (saves ~50-60% context tokens & disk space)
- High resolution images are NOT saved unless you specify `hiRes: true`
- Filename is exactly what you specify (no suffix added)

#### When to Use Each Feature

**Default: Just take the screenshot** (lowRes only, most common)
- Use for: Visual verification, checking layouts, confirming page state
- Example: `screenshot({ filename: 'page.png' })`
- Result: Saves `page.png` (800px lowRes)
- **This is what you should do 90% of the time**

**Use `hiRes: true` ONLY when:**
- Fine visual details are critical (design review, pixel-perfect verification)
- 800px lowRes is insufficient for the task
- User explicitly requests full resolution
- Example: `screenshot({ filename: 'detailed.png', hiRes: true })`
- Result: Saves `detailed.png` (full resolution, NO lowRes version)
- **Rarely needed - ask yourself if you really need this**

#### Screenshot Examples for IFTalk

```javascript
// MOST COMMON: Basic screenshot (lowRes only, default)
await mcp__web-agent-mcp__screenshot({
  filename: 'game-interface.png',
  directory: 'E:\\Project\\IFTalk-messaging\\screenshots'
});
// Saves: E:\Project\IFTalk-messaging\screenshots\game-interface.png (800px lowRes)

// Full-page screenshot
await mcp__web-agent-mcp__screenshot({
  filename: 'full-page.png',
  fullPage: true,
  directory: 'E:\\Project\\IFTalk-messaging\\screenshots'
});

// RARE: High resolution (only if needed)
await mcp__web-agent-mcp__screenshot({
  filename: 'design-review.png',
  hiRes: true,
  directory: 'E:\\Project\\IFTalk-messaging\\screenshots'
});
```

### Console Tools for Debugging

The web-agent-mcp server supports capturing and executing JavaScript in the browser console - useful for debugging IFTalk's client-side code.

#### get_console_logs Tool

**Purpose**: Retrieve console messages (console.log, console.warn, console.error, etc.) from the browser.

**Parameters**:
- `clear` (optional, boolean): Clear the console log buffer after reading (default: false)
- `filter` (optional, string): Filter messages by type (log, warn, error, info, debug) or by text content
- `limit` (optional, number): Max messages to return (default: 50, use 0 for all)

**Usage Examples**:
```javascript
// Get last 50 console logs (default, saves context)
await mcp__web-agent-mcp__get_console_logs({});

// Get only error messages
await mcp__web-agent-mcp__get_console_logs({ filter: 'error' });

// Get last 10 messages only
await mcp__web-agent-mcp__get_console_logs({ limit: 10 });

// Search for ZVM-related logs
await mcp__web-agent-mcp__get_console_logs({ filter: 'ZVM', limit: 20 });

// Search for TTS/narration logs
await mcp__web-agent-mcp__get_console_logs({ filter: 'TTS', limit: 20 });
```

**Notes**:
- **Default returns only 50 most recent messages to save context**
- Console messages are captured automatically from the moment the page loads
- Messages include timestamp, type (log/warn/error/info/debug), text content, and source location
- Use `limit` parameter to control context usage (lower = less context)
- Useful for debugging Vue components, event handlers, ZVM, and TTS code

#### execute_console Tool

**Purpose**: Execute JavaScript code in the browser console and return the result.

**Parameters**:
- `code` (required, string): JavaScript code to execute in the browser context

**Usage Examples**:
```javascript
// Query the DOM
await mcp__web-agent-mcp__execute_console({
  code: 'document.querySelector("#gameport").textContent'
});

// Check ZVM state
await mcp__web-agent-mcp__execute_console({
  code: 'window.vm ? "VM loaded" : "VM not loaded"'
});

// Check TTS state
await mcp__web-agent-mcp__execute_console({
  code: 'window.speechSynthesis.speaking'
});

// Manipulate the page for testing
await mcp__web-agent-mcp__execute_console({
  code: 'document.querySelector("#mic-toggle").click(); "Toggled mic"'
});
```

**Notes**:
- Code executes in the current page context with full access to the DOM and global scope
- The last expression in the code is returned as the result
- Do not use `return` statements (causes "Illegal return statement" error)
- Console output from the executed code is captured and available via `get_console_logs`
- Useful for debugging, testing, and dynamically manipulating pages

### Web Navigation Workflow

#### Single Action Instructions
When the user provides a **specific single navigation/interaction instruction** (e.g., "click this button", "navigate to this URL", "take a screenshot"), complete ONLY that action and then **STOP and await further instructions**.

Examples of single actions:
- "Navigate to [URL]"
- "Click [element]"
- "Type [text] into [field]"
- "Take a screenshot"
- "Scroll down"

#### Multi-Step Task Instructions
When the user provides a **higher-level task** (e.g., "test the login flow", "find and fill out the form"), you may proceed with multiple actions to complete the entire task without stopping after each step.

Examples of multi-step tasks:
- "Test the game interface"
- "Test the TTS narration controls"
- "Test voice input with various commands"
