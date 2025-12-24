# IFTalk TODO

## ✅ Completed - December 23, 2024

### UX Improvements
*******- ✅ **Escape key & Clear button** - Press Esc or click X to clear command input
*********- ✅ **Shortened prompts** - Removed verbose "send nothing to cancel" text from system prompts
********- ✅ **Adjustable listen timeout** - 2-10s range (default 3s), Settings → Voice & Input
********- ✅ **Removed 'exit' command** - Only 'quit' remains for quitting games
*********- ✅ **System message auto-narration** - Save/restore messages now speak automatically in app voice
- ✅ **Removed save limit** - Unlimited custom saves (was limited to 5)
- ✅ **Screen lock audio fix** - Audio feedback silenced when screen is locked
- ✅ **Sound effects toggle** - Settings → Audio → Sound Effects (disable all audio feedback)
- ✅ **Louder error sounds** - Low confidence 2x louder, blocked command 60% louder
*******- ✅ **Back/skip N commands** - Voice commands like "back 3", "skip 5", "go back 2", etc.
- ✅ **Favicon test page** - `docs/favicon-test.html` with 20 favicon design options
- ✅ **Sound test page** - `docs/sound-test.html` with 10 pulse sound options for testing
- ✅ **Voice lock fix** - Status now shows "Listening... Say 'unlock'" when screen locked

### Files Modified
- `docs/js/input/keyboard.js` - Escape key handler, clear button
- `docs/js/game/commands.js` - Removed save limit, removed 'exit' command, shortened prompts
- `docs/js/core/app-commands.js` - Removed 'exit' from QUIT array
- `docs/js/ui/game-output.js` - Auto-narration for system messages
- `docs/js/narration/recognition.js` - Listen timeout implementation, voice lock status fix
- `docs/js/ui/settings.js` - Listen timeout slider, sound effects toggle
- `docs/js/utils/audio-feedback.js` - Screen lock check, sound effects toggle check, increased volumes
- `docs/index.html` - Clear button, listen timeout slider, sound effects toggle, voice command help updated
- `docs/styles.css` - Clear button styling
- `docs/js/voice/voice-commands.js` - Added back/skip N pattern matching
- `docs/js/app.js` - Added backN and skipN handlers
- `docs/favicon-test.html` - New test page with 20 favicon designs
- `docs/sound-test.html` - New test page with 10 pulse sound options

---

## 📋 Remaining Tasks

### Medium Priority
- [ ] **Hide transition error messages** - Filter "I didn't understand that sentence" after autorestore
- [ ] **Add "Restoring..." overlay** - Visual feedback during transition
- [ ] **Chunk index restoration** - Test narration resumes from correct chunk
- [ ] **Visual feedback** - Show "Restored from last session" toast
- [ ] **Clear old autosaves** - Cleanup saves older than 30 days
- [ ] **Storage efficiency** - Consider IndexedDB for large saves

### Low Priority
- [ ] **Autosave indicator** - Visual feedback when autosave occurs
- [ ] **Export/import saves** - Download/upload save files
- [ ] **Gesture support** - Add swipe gestures as alternative to buttons (char panel)
- [ ] **Collapsible char panel** - Toggle to show/hide for advanced users
- [ ] **Haptic feedback** - Add vibration on button press (mobile)

---

## ✅ Previously Completed

### Autosave/Restore: WORKING (December 17, 2024)
- ✅ Autosave after each turn
- ✅ Auto-restore on page load
- ✅ VM restores to correct position
- ✅ Display HTML shows saved content immediately
- ✅ Auto-keypress advances past intro
- ✅ Input becomes available automatically

**Known Issues:**
- Minor transition error messages ("I didn't understand that sentence") - cosmetic only

### 'R' Key Restore / Dialog.open (December 19, 2024)
- ✅ Fixed char input sending (was sending numbers instead of strings)
- ✅ Implemented native restore via Dialog.open
- ✅ Anchorhead's "Press R to restore" now works properly

### Messaging Interface (December 18, 2024)
- ✅ Text input + Send button in controls panel
- ✅ Commands appear in game content area
- ✅ Auto-focus on game load
- ✅ Dynamic placeholder based on mic state

### Character Input Panel for Mobile (December 18, 2024)
- ✅ Arrow buttons (← ↑ ↓ →) for game menus
- ✅ Enter and Escape buttons
- ✅ Keyboard button (⌨️) for virtual keyboard on mobile
- ✅ Smart input swapping (line mode vs char mode)
- ✅ Touch device detection
- ✅ Proper Glk keycode mapping

### UX Improvements (December 16, 2024)
- ✅ TTS/Narration with browser speechSynthesis
- ✅ Upper window narration
- ✅ Settings panel with collapsible sections
- ✅ Speech speed slider (0.5x - 1.5x)
- ✅ Auto-scroll to highlighted text
- ✅ Title chunking for section headers

### Core Fixes (December 15, 2024)
- ✅ Updated ifvms.js to 1.1.6
- ✅ Removed Socket.IO (fully browser-based)
- ✅ Fixed generation counter
- ✅ Fixed VM start timing

---

## 📚 Documentation

**Reference files:**
- `reference/save-restore-research.md` - Deep dive into ifvms.js/GlkOte
- `reference/save-restore-status.md` - Current implementation status
- `reference/design-decisions.md` - Text processing pipeline
- `reference/navigation-rules.md` - Playback controls behavior
- `reference/zvm-integration.md` - ifvms.js + GlkOte setup
- `CLAUDE.md` - Project instructions and architecture overview

---

## 🔧 Quick Reference

### Testing Autosave/Restore
```bash
1. Load game (e.g., Anchorhead)
2. Play for a few turns
3. Refresh page (Ctrl+R)
4. Should restore automatically
5. Continue playing normally
```

### Clear Saves
```javascript
// In browser console:
localStorage.clear()
```

### Inspect Save Data
```javascript
// In browser console:
JSON.parse(localStorage.getItem('iftalk_autosave_anchorhead'))
```

### Listen Timeout Setting
- Default: 3 seconds
- Range: 2-10 seconds
- Location: Settings → Voice & Input → Listen Timeout

### Sound Effects Control
- Toggle: Settings → Audio → Sound Effects
- When disabled: All command beeps, confirmations, and error sounds are silenced
- TTS narration still works when disabled
