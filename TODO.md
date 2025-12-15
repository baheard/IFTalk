# IFTalk TODO

## 🔴 POST-REBOOT: WSL SETUP FOR FROTZ ANSI UPGRADE

**After your system restarts, follow these steps:**

### Step 1: Install Ubuntu Distribution

Open **PowerShell** (regular, not admin) and run:

```powershell
wsl --install -d Ubuntu
```

**What happens:**
- Downloads Ubuntu (~500MB) - takes 5-10 minutes
- Opens Ubuntu terminal automatically
- Asks for username and password

**Username**: Choose something simple (lowercase, no spaces) - like `user` or your name
**Password**: You'll need this for `sudo` commands - pick something you'll remember

### Step 2: Install Frotz in Ubuntu

Once Ubuntu terminal is open, run this command:

```bash
sudo apt update && sudo apt install frotz
```

- Enter your password when prompted
- Type `y` and press Enter when asked to confirm installation

### Step 3: Verify Frotz Installation

```bash
dfrotz --version
```

**Expected output**: `FROTZ V2.54` or `V2.55`

### Step 4: Notify Claude

Once you see the version number, **come back to Claude Code** and let me know it's done!

I'll then:
1. ✅ Backup your current config.json and dfrotz.exe
2. ✅ Update config.json with WSL configuration
3. ✅ Modify server.js to spawn dfrotz via WSL
4. ✅ Test ANSI formatting is working
5. ✅ Update documentation

---

## Current Status (2025-12-14)

### Active Branch: `frotz`

**Status:** ✅ Working - core features complete

**What Works:**
- ✅ Server-side Frotz interpreter via Socket.IO
- ✅ Game loads and responds to commands
- ✅ Voice recognition and TTS narration
- ✅ AI command translation (Ollama)
- ✅ All navigation controls (back, forward, pause, play, skip)
- ✅ Pronunciation dictionary
- ✅ Two-panel input layout (voice + text)
- ✅ Text highlighting system with marker-based implementation

---

## Styling Progress

### ✅ Completed
- [x] Typography - Google Fonts: Crimson Pro (serif) + IBM Plex Mono
- [x] Color Scheme - Refined dark theme (charcoal + muted accents)
- [x] Layout - Game output sizing, mobile responsiveness, touch-friendly buttons
- [x] Text Highlighting - Marker system working correctly

### ⬚ Polish (TODO)
- [ ] Loading states
- [ ] Error message styling
- [ ] Transitions and animations refinement
- [ ] Focus states and accessibility
- [ ] Status bar styling (location, score, moves)

---

## Recent Work

### Text Highlighting System (2025-12-14)

**Status:** ✅ Working - All chunks highlighted correctly

**What was done:**
- Implemented marker-based highlighting system
- Fixed marker selector logic
- Fixed ReferenceError bug (`currentNarrationChunks` → `narrationChunks`)
- Added debug logging for troubleshooting

**See:** [reference/text-highlighting-system.md](reference/text-highlighting-system.md) for detailed implementation

### Next Steps

1. ~~**Test highlighting**~~ ✅ DONE - Working correctly
2. **Edge case testing** - Test with different game text patterns (longer paragraphs, special formatting)
3. **Cleanup** - Remove debug logging once confirmed stable
4. **CSS refinement** - Adjust highlight colors/styling to match theme

---

## In Progress: Architecture Refactoring

**Status:** 🚧 Phase 1 Complete - Proceeding with full implementation

**Commit:** c2bec6d - Phase 1 foundation modules created

### Goal
Transform monolithic codebase into modular ES6 architecture:
- Split `app.js` (3,079 lines) into ~21 focused modules
- Split `server.js` (740 lines) into ~6 focused modules
- Use native ES6 modules (no bundler required)
- Centralized state management
- Clear separation of concerns

### Plan Document
**See:** `C:\Users\bahea\.claude\plans\calm-shimmying-crane.md`

### Module Structure Preview
```
public/js/
├── core/ (state, socket, dom)
├── voice/ (recognition, commands, meter, echo)
├── narration/ (tts-player, chunking, navigation, highlighting)
├── ui/ (game-output, nav-buttons, settings, history)
├── game/ (commands, saves, loader)
└── utils/ (text-processing, pronunciation, status)

server/
├── core/ (app, config)
├── game/ (frotz-manager, text-processor)
└── ai/ (translator, tts)
```

### Benefits
- 📦 **Maintainability:** 100-300 line files vs. 3,000+ line monolith
- 🧪 **Testability:** Can unit test individual modules
- 📖 **Readability:** File names indicate purpose
- 🔄 **Reusability:** Modules can be shared/reused
- 👥 **Collaboration:** Easier for multiple developers

### Implementation Phases
1. **Phase 1:** Foundation (5 modules - state, dom, utils)
2. **Phase 2:** Core Infrastructure (3 modules - socket, echo, meter)
3. **Phase 3:** Narration System (4 modules - chunking, highlighting, tts, navigation)
4. **Phase 4:** Voice System (2 modules - commands, recognition)
5. **Phase 5:** UI & Game (7 modules - output, buttons, saves, loader)
6. **Phase 6:** Main Entry (wire everything together)

### Progress Tracker

**Phase 1: Foundation** ✅ COMPLETE
- [x] core/state.js - Centralized state (27+ variables)
- [x] core/dom.js - DOM element cache
- [x] utils/text-processing.js - Text transformations
- [x] utils/pronunciation.js - Pronunciation dictionary
- [x] utils/status.js - Status bar updates

**Phase 2: Core Infrastructure** ⏳ IN PROGRESS
- [ ] core/socket.js - Socket.IO wrapper
- [ ] voice/echo-detection.js - Echo filtering
- [ ] voice/voice-meter.js - Audio visualization

**Phase 3: Narration System** ⏸️ PENDING
- [ ] narration/chunking.js - Text splitting & markers
- [ ] narration/highlighting.js - Text highlighting
- [ ] narration/tts-player.js - Audio playback
- [ ] narration/navigation.js - Chunk navigation

**Phase 4: Voice System** ⏸️ PENDING
- [ ] voice/voice-commands.js - Keyword parsing
- [ ] voice/recognition.js - Speech recognition

**Phase 5: UI & Game** ⏸️ PENDING
- [ ] ui/nav-buttons.js - Navigation controls
- [ ] ui/game-output.js - Text rendering
- [ ] ui/settings.js - Settings panel
- [ ] ui/history.js - Command/voice history
- [ ] game/commands.js - Send commands
- [ ] game/saves.js - Save/restore
- [ ] game/game-loader.js - Game selection

**Phase 6: Integration** ⏸️ PENDING
- [ ] js/app.js - Main entry point (wire all modules)
- [ ] Update index.html - ES6 module support
- [ ] Delete deprecated code from old app.js

**Server Refactoring** ⏸️ PENDING
- [ ] server/core/config.js
- [ ] server/core/app.js
- [ ] server/game/frotz-manager.js
- [ ] server/game/text-processor.js
- [ ] server/ai/translator.js
- [ ] server/ai/tts.js

**Next Action:** Continue with Phases 2-6 (all at once approach)

---

## Quick Commands

```bash
# Start server
cd /e/Project/IFTalk && npm start

# Access at http://localhost:3000

# Check for running servers
netstat -ano | findstr :3000
tasklist | findstr node

# Kill stuck process
powershell -Command "Stop-Process -Id <PID> -Force"
```

---

## Git History

```
f8b5d5d WIP: ifvms-glkote flow with Parchment-compatible versions
41eff5b Update README with browser-based ZVM architecture
17f1d9e Replace Parchment with ifvms/ZVM + GlkOte
5d1850f Change default voices (THIS IS OUR FROTZ BASE)
12aa9d7 Initial commit: IFTalk voice-controlled IF player
```

Current branch: `frotz` (based on master, files from 5d1850f)
