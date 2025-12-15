# IFTalk TODO

## 📋 COMPREHENSIVE ARCHITECTURE REVIEW (2025-12-15)

**⚠️ ACTION REQUIRED: Review architectural improvements plan**

**Plan Location:** `C:\Users\bahea\.claude\plans\spicy-wandering-wall.md`

**Summary**: After migrating from Frotz to browser-based ZVM, comprehensive code exploration revealed:
- 🔴 **Critical bugs** blocking functionality (TTS/ZVM integration broken, generation counter mismatch)
- 🟡 **Architectural debt** affecting maintainability (state management complexity, async race conditions)
- 🟢 **Code organization** opportunities for improvement (app.js cleanup, event duplication)

**Key Findings**:
1. TTS system still expects server Socket.IO but game now runs in browser (narration completely broken)
2. Generation counter mismatch between app and GlkOte (commands rejected)
3. Async initialization race conditions (voice selection, socket readiness)
4. 71+ mutable state variables with no validation or transaction safety
5. Fragile ZVM output capture that could break if GlkOte changes format

**Estimated Effort**: 5-7 days for complete implementation across 4 phases
**Priority**: Fix critical bugs (Phase 1) first to restore narration functionality

👉 **Review the full plan before proceeding with any implementation**

---

## Current Status (2025-12-15)

### Browser-Based ZVM Architecture ✅

**Status:** ✅ Core migration complete - Testing in progress

**What Works:**
- ✅ Browser-based ZVM (ifvms.js) + GlkOte display
- ✅ Games run entirely client-side (no server game logic)
- ✅ Static file serving only (simplified backend)
- ✅ Voice recognition and TTS narration
- ✅ AI command translation (Ollama/OpenAI/Claude)
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

## ✅ COMPLETED: Browser-Based ZVM Migration

**Status:** ✅ Migration complete - Frotz server-side architecture replaced

**Date Completed:** 2025-12-15

### What Changed
Migrated from server-side Frotz (dfrotz via WSL/Socket.IO) to browser-based ZVM:
- Replaced Frotz with ifvms.js (browser Z-machine interpreter)
- Implemented GlkOte display layer for IF games
- Simplified backend to static file server only
- Removed server-side game state management
- Games now run entirely client-side

### Why Abandon Frotz?

**Primary Reason:** Unix-style line-oriented I/O is fundamentally incompatible with modern web-based interactive fiction

**Technical Limitations:**
- **Line-based I/O:** Frotz expects traditional terminal input/output (stdin/stdout with line breaks)
- **No state exposure:** Game state locked inside Frotz process, inaccessible to web UI
- **Status line parsing:** Required fragile regex patterns to detect room changes
- **Output buffering:** Had to guess when Frotz finished outputting text (500ms delays)
- **Complex infrastructure:** Required WSL on Windows, process management, Socket.IO
- **Deployment complexity:** Server-side game logic requires VPS hosting ($4-6/month)

**Browser-based advantages:**
- Direct access to game state and output via GlkOte API
- Immediate response (no network latency)
- Free static hosting (GitHub Pages, Netlify, Vercel)
- Simpler architecture (no process management)
- Unlimited concurrent users (no server bottleneck)

### Module Structure (Post-Migration)
```
public/js/
├── core/ (state, dom)
├── voice/ (recognition, commands, meter, echo)
├── narration/ (tts-player, chunking, navigation, highlighting)
├── ui/ (game-output, nav-buttons, settings, history)
├── game/ (commands, saves, loader)
└── utils/ (text-processing, pronunciation, status)

server/
├── core/ (app, config) - Static file serving only
└── ai/ (translator) - Optional AI translation
```

**Removed:**
- `server/game/frotz-manager.js` - No longer needed
- `server/game/text-processor.js` - Text processing now client-side
- All Socket.IO game commands (only AI translation uses Socket.IO now)

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
5d1850f Change default voices
12aa9d7 Initial commit: IFTalk voice-controlled IF player
```

**Architecture Evolution:**
1. **v1 (5d1850f):** Server-side Frotz via WSL + Socket.IO
2. **v2 (current):** Browser-based ifvms.js + GlkOte
