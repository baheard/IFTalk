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

## Third-Party Libraries

### ifvms.js (Z-Machine Interpreter)
- **Current Version**: Copyright 2017 (specific version unknown)
- **Latest Version**: 1.1.6 (released February 11, 2021)
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

### Critical Bug Fixes
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

### What Works Now
- ✅ Game selection and loading
- ✅ Browser-based ZVM game engine
- ✅ Text-to-speech narration (browser-based)
- ✅ Command input and processing
- ✅ Navigation controls
- ✅ Voice recognition
- ✅ Fully offline-capable

## Current Status

See [TODO.md](TODO.md) for current tasks and progress.
