# IFTalk - Interactive Fiction with Voice Control

## Architecture Overview

- **Frontend**: Vanilla JavaScript (app.js), Socket.IO client
- **Backend**: Node.js, Socket.IO server, Frotz IF interpreter
- **TTS**: Browser Web Speech API (default), ElevenLabs API (optional)
- **Speech Recognition**: Web Speech Recognition API (webkitSpeechRecognition)

## File Structure

- `public/app.js`: All client-side logic (~1600 lines)
- `public/index.html`: UI structure with two-panel layout
- `public/styles.css`: Styling including sentence highlighting + settings panel
- `server.js`: Socket.IO + Frotz bridge + optional ElevenLabs TTS
- `config.json`: Voice settings (browser/ElevenLabs) + pronunciation dictionary

## Quick Start

```bash
cd /e/Project/IFTalk && npm start
# Access at http://localhost:3000
```

**Current Branch:** `frotz` - Server-side Frotz interpreter implementation via Socket.IO

## Reference Documentation

For detailed technical information, see the `reference/` folder:

### Configuration & Setup
- **[Frotz Configuration](reference/frotz-config.md)** - dfrotz version info, flags, status line detection, artifact filtering
- **[Server Management](reference/server-management.md)** - Starting server, checking processes, killing stuck processes, web agent screenshots

### Architecture & Design
- **[Architecture Comparison](reference/architecture-comparison.md)** - Frotz vs browser-based ZVM/GlkOte
- **[Design Decisions](reference/design-decisions.md)** - Text processing pipeline, navigation, AI translation, highlighting, scroll behavior
- **[State Variables](reference/state-variables.md)** - Key state flags and their purposes

### UX & Behavior
- **[Navigation Rules](reference/navigation-rules.md)** - Expected behavior for playback controls and text highlighting

### Implementation Details
- **[Text Highlighting System](reference/text-highlighting-system.md)** - Marker-based highlighting for TTS narration
- **[Bug Fixes History](reference/bug-fixes-history.md)** - Past bugs and solutions for context

## Current Status

See [TODO.md](TODO.md) for current tasks and progress.
