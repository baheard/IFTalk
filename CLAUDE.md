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
  - No Socket.IO game commands
  - Just serves HTML, JS, CSS, and game files
- **TTS**: Browser Web Speech API (client-side only)
- **Speech Recognition**: Web Speech Recognition API (webkitSpeechRecognition)
- **AI Translation**: REMOVED - direct command input only

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

## Current Status

See [TODO.md](TODO.md) for current tasks and progress.
