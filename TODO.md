# IFTalk TODO

## ✅ Autosave/Restore: WORKING (December 17, 2024)

**Status:** Functional with minor cosmetic issues

### What Works

- ✅ Autosave after each turn
- ✅ Auto-restore on page load
- ✅ VM restores to correct position
- ✅ Display HTML shows saved content immediately
- ✅ Auto-keypress advances past intro (no manual action needed)
- ✅ Input becomes available automatically
- ✅ Game continues from saved position

### Known Issues

**Minor: Transition error messages**
- "I didn't understand that sentence."
- "I beg your pardon?"

**Cause:** Auto-keypress is processed by restored VM as a command
**Impact:** Cosmetic only - doesn't affect functionality
**Fix Priority:** Low - can add filtering later if needed

---

## 📋 Current Tasks

### High Priority

- [ ] **Hide transition error messages** - Filter specific patterns or skip those updates
- [ ] **Add "Restoring..." overlay** - Visual feedback during transition
- [ ] **Test all games** - Verify with Anchorhead, Photopia, Dungeon, Lost Pig
- [ ] **Test edge cases** - Rapid commands, multiple refreshes

### Medium Priority

- [ ] **Chunk index restoration** - Test narration resumes from correct chunk
- [ ] **Visual feedback** - Show "Restored from last session" toast
- [ ] **Clear old autosaves** - Cleanup saves older than 30 days
- [ ] **Storage efficiency** - Consider IndexedDB for large saves

### Low Priority

- [ ] **Autosave indicator** - Visual feedback when autosave occurs
- [ ] **Multiple save slots** - Manual save/load in addition to autosave
- [ ] **Export/import saves** - Download/upload save files

---

## ✅ Recently Completed (December 17, 2024)

### Autosave/Restore Implementation

**Key accomplishments:**
- ✅ Researched ifvms.js + GlkOte save systems
- ✅ Confirmed Z-machine requires custom save system (Glulx-only limitation)
- ✅ Implemented working restore with proper timing
- ✅ Auto-keypress eliminates manual action requirement
- ✅ Display HTML restoration shows saved content immediately

**Lessons learned:**
- Can't restore before vm.start() (VM not initialized)
- Can't call vm.run() after restore (input request conflicts)
- Must restore after first update (VM fully running)
- Display HTML must be restored separately
- Auto-keypress needed to clear intro input

**Documentation created:**
- `reference/save-restore-research.md` - Technical deep dive
- `reference/save-restore-status.md` - Current implementation status

### Keyboard Input System (December 17, 2024)

- ✅ Inline text input with styled `>` prompt
- ✅ Mode detection (line vs char input)
- ✅ Echo suppression for command echoes
- ✅ Auto-focus and click-to-focus behavior

### UX Improvements (December 16, 2024)

- ✅ TTS/Narration working with browser speechSynthesis
- ✅ Upper window (quotes/formatting) narration
- ✅ Settings panel with collapsible sections
- ✅ Speech speed slider (0.5x - 1.5x)
- ✅ Auto-scroll to highlighted text during narration
- ✅ Title chunking for section headers

### Core Fixes (December 15, 2024)

- ✅ Updated ifvms.js to 1.1.6 (from 2017 version)
- ✅ Removed Socket.IO (fully browser-based now)
- ✅ Fixed generation counter (commands accepted properly)
- ✅ Fixed VM start timing (DOM race condition)

---

## 🔧 Technical Architecture

### Current Autosave/Restore Flow

```
1. Game starts normally (shows intro with char input)
   ↓
2. First update arrives (~100ms)
   ↓
3. autoLoad() triggered
   - Restores VM state with restore_file()
   - Restores display HTML (user sees saved content)
   ↓
4. Auto-keypress sent (~200ms later)
   - Clears intro char input
   - VM processes from restored state
   ↓
5. Error messages appear (brief, cosmetic)
   ↓
6. Line input becomes available
   ↓
7. User can play from saved position
```

### Files Modified

**Core implementation:**
- `public/js/game/game-loader.js` - Sets `shouldAutoRestore` flag
- `public/js/game/voxglk.js` - Triggers autoLoad(), sends auto-keypress
- `public/js/game/save-manager.js` - Handles VM + HTML restoration

### Save Data Structure

**localStorage Key:** `iftalk_autosave_${gameName}`

**Format:**
```javascript
{
  timestamp: "2024-12-17T...",
  gameName: "anchorhead",
  gameSignature: "080000...",
  quetzalData: "base64...",     // VM state
  displayHTML: {
    statusBar: "<div>...</div>",
    upperWindow: "<div>...</div>",
    lowerWindow: "<div>...</div>"
  },
  narrationState: {
    currentChunkIndex: 3,
    chunksLength: 9
  }
}
```

---

## 📚 Documentation

**Reference files:**
- `reference/save-restore-research.md` - Deep dive into ifvms.js/GlkOte
- `reference/save-restore-status.md` - Current implementation status
- `reference/design-decisions.md` - Text processing pipeline
- `reference/navigation-rules.md` - Playback controls behavior
- `reference/zvm-integration.md` - ifvms.js + GlkOte setup

---

## Testing

**To test autosave/restore:**
```bash
1. Load game (e.g., Anchorhead)
2. Play for a few turns
3. Refresh page (Ctrl+R)
4. Should restore automatically
5. Brief error messages appear (expected)
6. Continue playing normally
```

**To clear saves:**
```javascript
// In browser console:
localStorage.clear()
```

**To inspect save:**
```javascript
// In browser console:
JSON.parse(localStorage.getItem('iftalk_autosave_anchorhead'))
```
