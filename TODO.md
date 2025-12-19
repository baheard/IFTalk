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

### Code Review / Cleanup

- [x] **Remove all console.log statements** - Keep console.error and console.warn only (DONE Dec 19)

### High Priority

- [x] **Fix: Remove cleared content from DOM and autosaves** (December 18, 2024)
  - See plan: `C:\Users\bahea\.claude\plans\snappy-gliding-wilkes.md`
  - **Problem**: Intro text stayed in DOM and got saved in autosaves, causing voice to re-read intro on every restore
  - **Solution**: Remove intro from DOM when user progresses past it
  - **Implementation**: Modified `public/js/ui/game-output.js` (lines 271-292)
    - Mark first game-text as `.game-intro`
    - When second game-text is added, remove `.game-intro` from DOM
    - Autosaves no longer include intro (not in DOM)
    - Voice narration won't read intro on restore
  - **Behavior**: Matches iplayif.com/Parchment - cleared content actually removed
  - **Testing needed**:
    - [ ] Start fresh game → verify intro displays
    - [ ] Send first command → verify intro removed from DOM (check DevTools)
    - [ ] Refresh page → verify autorestore doesn't show intro
    - [ ] Test voice narration → verify intro not read on restore
- [x] **'R' key restore from intro screen** (December 19, 2024)
  - Anchorhead's "Press R to restore" now works properly
  - Triggers game's native restore → Dialog.open() → restores from autosave
  - See `reference/save-restore-status.md` for full flow
- [ ] **Polish char input panel**
  - Consider adding visual hints ("Use arrow keys to navigate")
  - Test keyboard shortcuts still work alongside buttons
  - Verify accessibility (screen reader support)

### Medium Priority

- [ ] **Hide transition error messages** - Filter specific patterns or skip those updates
- [ ] **Add "Restoring..." overlay** - Visual feedback during transition
- [ ] **Chunk index restoration** - Test narration resumes from correct chunk
- [ ] **Visual feedback** - Show "Restored from last session" toast
- [ ] **Clear old autosaves** - Cleanup saves older than 30 days
- [ ] **Storage efficiency** - Consider IndexedDB for large saves

### Low Priority

- [ ] **Autosave indicator** - Visual feedback when autosave occurs
- [ ] **Multiple save slots** - Manual save/load in addition to autosave
- [ ] **Export/import saves** - Download/upload save files
- [ ] **Gesture support** - Add swipe gestures as alternative to buttons (char panel)
- [ ] **Collapsible char panel** - Toggle to show/hide for advanced users
- [ ] **Haptic feedback** - Add vibration on button press (mobile)

---

## ✅ Recently Completed

### 'R' Key Restore / Dialog.open Implementation (December 19, 2024)

**Fixed char input sending**: VoxGlk was sending character codes as numbers (82) instead of strings ("R"), causing glkapi.js to interpret all chars as "unknown key".

**Implemented native restore via Dialog.open**:
- When game calls `glk_fileref_create_by_prompt()` for restore, VoxGlk now handles `specialinput`
- Dialog.open checks for saves in priority order: autosave → quicksave → custom saves
- If found, triggers page reload with restore flag
- If nothing found, shows user-friendly alert

**Files modified:**
- `public/js/game/voxglk.js` - Fixed char input format, added specialinput handling
- `public/lib/dialog-stub.js` - Implemented restore priority, triggerAutorestore()
- `public/js/game/game-loader.js` - Added pending restore detection

**Flow**: Press 'R' → Game triggers `glk_fileref_create_by_prompt()` → VoxGlk calls Dialog.open() → Finds autosave → Sets flag + reloads → Game restores automatically

### Messaging Interface (December 18, 2024)

**Re-implemented classic messaging UI:**
- ✅ Text input + Send button in controls panel (below nav controls)
- ✅ Commands appear in game content area (not duplicated)
- ✅ Auto-focus on game load
- ✅ Enter key sends commands
- ✅ Subtle send button styling (de-emphasized, users prefer Enter)
- ✅ Dynamic placeholder based on mic state:
  - Muted: "Type a command..."
  - Listening: "Speak a command..."

### Character Input Panel for Mobile (December 18, 2024)

**Mobile-friendly menu navigation:**
- ✅ Arrow buttons (← ↑ ↓ →) for navigating game menus
- ✅ Enter button (far right, styled like Send)
- ✅ Escape button (square, matches arrow dimensions)
- ✅ Keyboard button (⌨️) - opens virtual keyboard for arbitrary keys
- ✅ Smart input swapping:
  - Line mode: Message input visible
  - Char mode: Char buttons visible (replaces message input)
- ✅ Touch device detection - keyboard button auto-hides on desktop
- ✅ Hidden input technique for mobile keyboard triggering
- ✅ Proper Glk keycode mapping (0xfffffffc for Up, etc.)
- ✅ Mobile-optimized sizing (44x44px desktop, 48x48px mobile)

**Files modified:**
- `public/index.html` - Added char input panel HTML
- `public/styles.css` - Styled panel with responsive sizing
- `public/js/input/keyboard.js` - Button handlers, visibility logic, touch detection
- `public/js/game/game-loader.js` - Panel initialization

### Autosave/Restore Implementation (December 17, 2024)

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

- ✅ Inline text input with styled `>` prompt (reverted to messaging interface)
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

### Character Input Panel Flow

```
User playing game in line mode (typing commands)
  ↓
Game requests char input (e.g., "Press R to restore")
  ↓
getInputType() returns 'char'
  ↓
updateInputVisibility() (polling every 500ms)
  - Hides message input row
  - Shows char input panel
  ↓
Desktop: [← ↑ ↓ → ... [Esc] [⏎]]
Mobile:  [← ↑ ↓ → ... [⌨️] [Esc] [⏎]]
  ↓
User interactions:
  - Taps arrow button → sends Glk keycode (e.g., 0xfffffffc for Up)
  - Taps Enter → sends 0xfffffffa
  - Taps Escape → sends 0xfffffff8
  - Taps Keyboard (mobile) → focuses hidden input → virtual keyboard opens
    → user types key (e.g., "R") → sends to game
  ↓
Game processes char input, returns to line mode
  ↓
updateInputVisibility() detects mode change
  - Hides char input panel
  - Shows message input row
```

### Touch Detection Logic

```javascript
const isTouchDevice = ('ontouchstart' in window) ||      // Touch events API
                      (navigator.maxTouchPoints > 0) ||   // Pointer events
                      (navigator.msMaxTouchPoints > 0);   // IE/Edge legacy
```

**Result:**
- Desktop: Keyboard button hidden (physical keyboard available)
- Mobile/Tablet: Keyboard button visible (virtual keyboard needed)

### Glk Keycode Mappings

```javascript
Arrow Left:  0xfffffffe
Arrow Right: 0xfffffffd
Arrow Up:    0xfffffffc
Arrow Down:  0xfffffffb
Enter:       0xfffffffa
Escape:      0xfffffff8
Backspace:   0xfffffff9 (not used, have Escape instead)
```

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
