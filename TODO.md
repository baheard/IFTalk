# IFTalk TODO

## ✅ Recent Completions (December 16, 2024)

### Major Fixes
- ✅ **TTS/Narration** - Working with browser speechSynthesis
- ✅ **Upper Window Narration** - Quotes and formatted text now narrated
- ✅ **Autoplay Behavior** - Fixed restart/navigation auto-start issues
- ✅ **Settings Panel** - Fixed button not opening panel (class mismatch)
- ✅ **Microphone Default** - Now starts muted by default
- ✅ **Push-to-Talk** - Changed Alt → Ctrl (fixes browser menu focus issue)

### Features Added
- ✅ **Speech Speed Slider** - Adjustable 0.5x - 1.5x with localStorage persistence
- ✅ **Collapsible Settings** - All sections expandable with smooth animations
- ✅ **Comprehensive Logging** - TTS pipeline fully instrumented for debugging
- ✅ **State Tracking** - Autoplay state changes logged with stack traces
- ✅ **Auto-scroll to Highlight** - Screen scrolls to currently highlighted text during narration
- ✅ **Title Chunking** - Asterisk-wrapped titles (* TITLE *) split into separate narration chunks

### Library Updates
- ✅ **ifvms.js 1.1.6** - Updated from 2017 version (Dec 15, 2024)

---

## 📋 Current Tasks

### High Priority
- [ ] Test TTS narration thoroughly across all 4 games
- [ ] Verify upper window content narration (quotes, ASCII art)
- [ ] Test autoplay behavior edge cases

### Medium Priority
- [ ] Verify responsive layout on mobile devices (768px, 480px breakpoints)
- [ ] Review voice recognition accuracy with different accents
- [ ] Performance testing with longer game sessions

### Low Priority
- [ ] Improve loading states visual feedback
- [ ] Polish error message styling
- [ ] Enhance focus states for keyboard navigation
- [ ] Consider upgrading GlkOte from 2.2.5 → 2.3.7

---

## Current Architecture

### VoxGlk Custom Display Engine

**Files:**
- `public/js/game/voxglk.js` - Display interface (init, update, error)
- `public/js/game/voxglk-renderer.js` - HTML renderer with space preservation
- `public/js/narration/chunking.js` - TTS marker system (currently broken)

**Data Flow:**
```
ZVM (ifvms.js game engine)
  ↓ calls Glk API
glkapi.js
  ↓ GlkOte.update(updateObj)
VoxGlk.update()
  ↓ VoxGlkRenderer.renderUpdate()
  ↓ HTML with white-space: pre
#gameOutputInner (rendered output)
  ↓ chunking.js inserts markers
TTS narration with highlighting
```

**Key Features:**
- Browser-based Z-machine interpreter (ifvms.js)
- Custom VoxGlk renderer (replaces GlkOte UI)
- Preserves spaces via `white-space: pre` CSS
- Responsive layout (768px, 480px breakpoints)
- Voice recognition (Web Speech API)
- TTS narration (Web Speech API)

---

## What Works ✅

### Core Functionality
- ✅ Game loading and playback (all 4 games: Anchorhead, Photopia, Dungeon, Lost Pig)
- ✅ Character input (single keypress)
- ✅ Line input (command entry)
- ✅ Voice recognition with Ctrl push-to-talk
- ✅ TTS narration with browser speechSynthesis
- ✅ Text highlighting during narration
- ✅ Responsive mobile layout (768px, 480px breakpoints)
- ✅ Status line rendering
- ✅ Upper window rendering (quotes, formatted text)
- ✅ Generation counter sync

### UI Features
- ✅ Settings panel (slide-in from right)
- ✅ Collapsible settings sections
- ✅ Speech speed control (0.5x - 1.5x)
- ✅ Voice selection (narration + app voices)
- ✅ Pronunciation dictionary
- ✅ Navigation controls (play/pause, skip, restart)
- ✅ Autoplay toggle
- ✅ Microphone mute toggle

### Voice Control
- ✅ Navigation commands (restart, back, stop, pause, play, skip, skip all)
- ✅ Game commands (next, enter, more, print [text])
- ✅ Keyboard shortcuts (←/→ nav, M mute, Ctrl push-to-talk, Esc stop)

---

## Quick Commands

```bash
# Start server
cd /e/Project/IFTalk && npm start

# Access at http://localhost:3000
```

---

## Version History

**Architecture Evolution:**
1. **v1:** Server-side Frotz via WSL + Socket.IO (removed Dec 2024)
2. **v2:** Browser-based Parchment (replaced Dec 2024)
3. **v3 (current):** Browser-based ifvms.js + VoxGlk custom renderer

**Current Libraries:**
- ifvms.js: 1.1.6 (updated Dec 15, 2024) ✅
- GlkOte: 2.2.5 (latest: 2.3.7)
- jQuery: 3.7.1

**Key Settings:**
- Speech Rate: 0.5x - 1.5x (default 1.0x)
- Microphone: Muted by default
- Push-to-Talk: Ctrl key
- Autoplay: Toggle in settings
- Settings Sections: Collapsible (start collapsed)
