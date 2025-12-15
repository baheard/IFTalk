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

## 🐛 ISSUE: dfrotz 2.54 Title Banner Regression

**Status:** 🔴 Open - Blocking proper game display

**Date Discovered:** 2025-12-15

### Problem

**Anchorhead title banner not displaying on initial game screen.**

**Expected (dfrotz 2.44 Windows):**
```
The oldest and strongest emotion of mankind
is fear, and the oldest and strongest kind
of fear is fear of the unknown.

-- H.P. Lovecraft

A N C H O R H E A D

[Press 'R' to restore; any other key to begin]
```

**Actual (dfrotz 2.54 WSL):**
```
[blank lines]
[Press 'R' to restore; any other key to begin]
```

### Root Cause

dfrotz 2.54 (WSL Ubuntu version) does not display the game's title banner/splash screen, while dfrotz 2.44 (Windows version) does. This appears to be a regression in dfrotz 2.54.

**Testing Results:**
- ✅ dfrotz 2.44 (Windows): Shows full title banner with quote and game name
- ❌ dfrotz 2.54 (WSL): Only shows blank lines before restore prompt
- Tested with flags: `-h 999` only (same as 2.44) - still no title
- Tested without `-q`, `-m`, `-f ansi` flags - still no title

**Files:**
- `E:\Project\IFTalk\dfrotz.exe` - Old working version (2.44)
- WSL Ubuntu dfrotz - Current version (2.54)

### Possible Solutions

1. **Revert to dfrotz 2.44 (Windows)**
   - ✅ Title banner works
   - ❌ Loses `-q`, `-m`, `-f ansi` flags (not available in 2.44)
   - ❌ Will show "Loading..." messages (need text processor to filter)

2. **Report bug to dfrotz maintainers**
   - File issue at https://gitlab.com/DavidGriffith/frotz
   - Wait for fix in future version
   - May take weeks/months

3. **Find workaround in dfrotz 2.54**
   - Test different flag combinations
   - Check if Z8 games have special banner requirements
   - Try different terminal settings

4. **Client-side title injection** (REJECTED by user)
   - Add custom title in `game-loader.js`
   - Not acceptable - should come from game

### Current Configuration

**config.json:**
```json
"interpreter": "wsl",
"interpreterArgs": ["-d", "Ubuntu", "-u", "root", "--", "dfrotz", "-m", "-f", "ansi", "-h", "999"]
```

**Changes Made (2025-12-15):**
- Removed `-q` flag to try to show banner
- Added Frotz message filtering in `text-processor.js` to handle "Using ANSI formatting" and "Loading" messages

### Next Steps

1. Test other IF games (Zork, Photopia) to see if title banners work in 2.54
2. Check dfrotz 2.54 release notes for known issues
3. Try different Z-machine file versions of Anchorhead
4. Consider hybrid approach: use 2.44 for games with banners, 2.54 for others

---

## ✅ COMPLETED: Architecture Refactoring

**Status:** ✅ All phases complete - Fully refactored to modular ES6 architecture

**Date Completed:** 2025-12-15

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

**Phase 2: Core Infrastructure** ✅ COMPLETE
- [x] core/socket.js - Socket.IO wrapper
- [x] voice/echo-detection.js - Echo filtering
- [x] voice/voice-meter.js - Audio visualization

**Phase 3: Narration System** ✅ COMPLETE
- [x] narration/chunking.js - Text splitting & markers
- [x] narration/highlighting.js - Text highlighting
- [x] narration/tts-player.js - Audio playback
- [x] narration/navigation.js - Chunk navigation

**Phase 4: Voice System** ✅ COMPLETE
- [x] voice/voice-commands.js - Keyword parsing
- [x] voice/recognition.js - Speech recognition

**Phase 5: UI & Game** ✅ COMPLETE
- [x] ui/nav-buttons.js - Navigation controls
- [x] ui/game-output.js - Text rendering
- [x] ui/settings.js - Settings panel
- [x] ui/history.js - Command/voice history
- [x] game/commands.js - Send commands
- [x] game/saves.js - Save/restore
- [x] game/game-loader.js - Game selection

**Phase 6: Integration** ✅ COMPLETE
- [x] js/app.js - Main entry point (wire all modules)
- [x] Update index.html - ES6 module support
- [x] Backup old app.js and server.js

**Server Refactoring** ✅ COMPLETE
- [x] server/core/config.js
- [x] server/core/app.js
- [x] server/game/frotz-manager.js
- [x] server/game/text-processor.js
- [x] server/ai/translator.js
- [x] server/ai/tts.js
- [x] server/index.js - Entry point
- [x] Update package.json

**Testing** ✅ COMPLETE
- [x] Server starts successfully
- [x] All modules load without errors
- [x] Socket.IO connections work

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
