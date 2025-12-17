# IFTalk TODO

## ✅ Recent Completions

### December 17, 2024 - Keyboard Input System
- ✅ **Inline Keyboard Input** - New text input system with styled `>` prompt
- ✅ **Input Mode Detection** - Auto-hide on char mode, show on line mode
- ✅ **Echo Suppression** - Detects and skips glk-input command echoes
- ✅ **Focus Behavior** - Auto-focus, click-to-focus, no flash transitions
- ✅ **Old Input Removal** - Cleaned up userInput, sendBtn, inputArea elements

### December 16, 2024 - UX & Features
- ✅ **TTS/Narration** - Working with browser speechSynthesis
- ✅ **Upper Window Narration** - Quotes and formatted text now narrated
- ✅ **Autoplay Behavior** - Fixed restart/navigation auto-start issues
- ✅ **Settings Panel** - Fixed button not opening panel (class mismatch)
- ✅ **Microphone Default** - Now starts muted by default
- ✅ **Push-to-Talk** - Changed Alt → Ctrl (fixes browser menu focus issue)
- ✅ **Speech Speed Slider** - Adjustable 0.5x - 1.5x with localStorage persistence
- ✅ **Collapsible Settings** - All sections expandable with smooth animations
- ✅ **Comprehensive Logging** - TTS pipeline fully instrumented for debugging
- ✅ **State Tracking** - Autoplay state changes logged with stack traces
- ✅ **Auto-scroll to Highlight** - Screen scrolls to currently highlighted text during narration
- ✅ **Title Chunking** - Asterisk-wrapped titles (* TITLE *) split into separate narration chunks

### December 15, 2024 - Core Fixes
- ✅ **ifvms.js 1.1.6** - Updated from 2017 version
- ✅ **Socket.IO Removed** - Completely eliminated legacy infrastructure
- ✅ **Generation Counter Fixed** - Commands now accepted properly by ZVM
- ✅ **VM Start Timing Fixed** - Resolved DOM initialization race condition

---

## 📋 Current Tasks

### High Priority
- [ ] Test keyboard input across all games (line and char modes)
- [ ] Verify echo suppression works for all command formats
- [ ] Test TTS narration thoroughly across all 4 games
- [ ] Test focus behavior (auto-focus, click-to-focus, typing to focus)

### Medium Priority
- [ ] Verify responsive layout on mobile devices (768px, 480px breakpoints)
- [ ] Review voice recognition accuracy with different accents
- [ ] Performance testing with longer game sessions
- [ ] Test keyboard navigation accessibility

### Low Priority
- [ ] Improve loading states visual feedback
- [ ] Polish error message styling
- [ ] Consider upgrading GlkOte from 2.2.5 → 2.3.7
- [ ] Add keyboard shortcut help overlay

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
- ✅ Inline keyboard input with mode detection (line/char)
- ✅ Character input (single keypress, hidden input, any key advances)
- ✅ Line input (command entry with styled `>` prompt)
- ✅ Echo suppression (glk-input detection and filtering)
- ✅ Focus management (auto-focus, click-to-focus, typing-to-focus)
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
