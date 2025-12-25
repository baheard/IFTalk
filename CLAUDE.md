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
  - **No Socket.IO** - completely removed (was legacy from Frotz architecture)
  - Just serves HTML, JS, CSS, and game files
- **TTS**: Browser Web Speech API (client-side only)
  - Narration runs entirely in browser with `speechSynthesis`
  - No server round-trip for audio generation
- **Speech Recognition**: Web Speech Recognition API (webkitSpeechRecognition)
- **Save/Restore**: Custom system with autosave + `save [name]` / `restore [name]` commands

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

## Working with Claude

**Context Management:** Claude will warn when context usage reaches 85% (15% remaining). Use `/context` to check current usage.

## Third-Party Libraries

### ifvms.js (Z-Machine Interpreter)
- **Current Version**: 1.1.6 (released February 11, 2021) - ✅ Updated December 15, 2024
- **Previous Version**: Copyright 2017 (backed up as zvm.js.backup.2017)
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

### Development & Debugging
- **[Remote Debugging](reference/remote-debugging.md)** - iOS/mobile debugging via LogTail
- **[Reference Index](reference/README.md)** - Full table of contents for all reference docs

### Deprecated (No Longer Used)
- ~~Frotz Configuration~~ - We use browser-based ZVM, not server-side Frotz
- ~~AI Translation~~ - Removed Ollama/OpenAI integration
- ~~ElevenLabs TTS~~ - Browser TTS only
- ~~Socket.IO~~ - Completely removed (Dec 2024)

## Recent Fixes (December 2024)

### December 15, 2024 - Core Fixes
1. **TTS/Narration Fixed** - Removed Socket.IO dependency, now uses browser `speechSynthesis` directly
   - File: `public/js/narration/tts-player.js`
   - TTS no longer hangs on Socket.IO promises
   - Faster response time (no server round-trip)

2. **Socket.IO Removed** - Completely eliminated legacy Socket.IO infrastructure
   - Files: `public/js/app.js`, `public/js/core/socket.js`, `public/js/game/saves.js`
   - App now runs in pure browser mode
   - No server dependencies for game logic or TTS

3. **Game Loading Fixed** - Resolved initialization hang
   - File: `public/js/core/socket.js`
   - Made Socket.IO optional (returns null if not loaded)
   - App initialization now completes successfully

4. **Generation Counter Fixed** - Resolved command rejection issue
   - File: `public/js/game/game-loader.js`
   - Track generation from GlkOte events instead of manual counter
   - Commands now accepted properly by ZVM

5. **VM Start Timing Fixed** - Resolved DOM initialization race condition
   - File: `public/js/game/game-loader.js`
   - Use `requestAnimationFrame` instead of `setTimeout`
   - Prevents "Cannot read properties of null" error

6. **ifvms.js Updated to 1.1.6** - Upgraded from 2017 version
   - File: `public/lib/zvm.js`
   - Fixes read opcode handling in Z-Machine v3-4
   - Better game compatibility (upper window input, screen height measurement)
   - Performance improvements and bug fixes
   - Previous version backed up as `zvm.js.backup.2017`

### December 16, 2024 - UX & Feature Improvements
1. **Comprehensive TTS Logging** - Added detailed logging throughout TTS pipeline
   - Files: `public/js/narration/tts-player.js`, `public/js/app.js`, `public/js/ui/game-output.js`
   - Logs speech synthesis events, chunk creation, voice configuration
   - Easier debugging of narration issues

2. **Microphone Muted by Default** - Changed default mic state
   - File: `public/js/core/state.js:24`
   - `isMuted: true` - mic starts muted, user must enable
   - Prevents accidental voice input on page load

3. **Upper Window Text Narration** - Fixed missing quote/formatted text narration
   - File: `public/js/ui/game-output.js:84-107`
   - Now includes upper window content (quotes, ASCII art) in narration chunks
   - Narration order: Status bar → Upper window → Main content

4. **Autoplay Fixes** - Fixed autoplay not respecting off state
   - Files: `public/js/narration/navigation.js`, `public/js/app.js`, `public/js/core/state.js`
   - Fixed restart button auto-starting when autoplay off
   - Fixed new page auto-starting when autoplay off
   - Added state tracking with logging for debugging
   - Navigation only resumes if actively playing, not just based on autoplay

5. **Settings Panel Fixed** - Fixed settings button not opening panel
   - Files: `public/js/ui/settings.js:20,29`, `public/index.html:22`
   - Changed from `hidden` class to `open` class to match CSS
   - Panel now slides in/out smoothly from right

6. **Speech Speed Control** - Added adjustable speech rate slider
   - Files: `public/index.html:74-81`, `public/styles.css:304-362`, `public/js/ui/settings.js:69-95`
   - Range: 0.5x - 1.5x speed (default 1.0x)
   - Slider with real-time preview
   - Saved to localStorage

7. **Collapsible Settings Sections** - Made all settings sections expandable
   - Files: `public/index.html`, `public/styles.css:264-302`, `public/js/ui/settings.js:58-67`
   - All sections start collapsed
   - Click header to expand/collapse
   - Smooth animations with arrow indicators
   - Minimal 4px spacing between sections

8. **Push-to-Talk Key Changed** - Changed from Alt to Ctrl
   - Files: `public/js/app.js:323,355`, `public/index.html:61`
   - Alt key caused browser menu focus issues
   - Ctrl key works without interfering with browser

9. **Voice Commands Cleanup** - Removed AI translation reference
   - File: `public/index.html:54`
   - Removed outdated "Any other speech - AI translates to command" line

10. **Auto-scroll to Highlight** - Screen scrolls to currently highlighted text
   - File: `public/js/narration/highlighting.js:148-221`
   - Finds next visible element after invisible marker
   - Centers highlighted text in viewport
   - Smooth scroll animation

11. **Title Chunking** - Asterisk-wrapped titles split into separate chunks
   - File: `public/js/narration/chunking.js:24-27`
   - Regex detects `* TITLE *` patterns
   - Creates chunk boundaries before and after titles
   - Enables separate narration of section headers

### December 17, 2024 - Keyboard Input System Overhaul
1. **Removed Old Input System** - Eliminated placeholder input/textarea UI
   - Files: `public/js/app.js`, `public/js/core/dom.js`, `public/js/game/game-loader.js`
   - Removed: `userInput`, `sendBtn`, `inputArea`, `commandHistoryBtn` elements
   - Removed event listeners for old input elements
   - Cleaned up focus and placeholder manipulation code

2. **New Inline Keyboard Input** - Real text input with styled prompt
   - Files: `public/js/input/keyboard.js`, `public/index.html`, `public/styles.css`
   - Text input field with `>` prompt positioned as visual decoration
   - Native browser cursor for editing
   - Click anywhere in game area to focus input
   - Auto-focus when input becomes visible
   - Supports full text editing (click, select, arrow keys, etc.)

3. **Input Mode Detection** - Different behavior for line vs char input
   - File: `public/js/input/keyboard.js`
   - **Line mode**: Shows input field with `>` prompt for typing commands
   - **Char mode**: Hides input entirely, any key advances from anywhere
   - Polls input type every 100ms to update visibility
   - Prevents flash on mode transitions

4. **Echo Suppression** - Detects and skips game command echoes
   - File: `public/js/ui/game-output.js`
   - Detects `glk-input` styled echoes (blue command text)
   - Skips display of echoed commands from game
   - User sees command in input field, not duplicated in output
   - Comprehensive pattern matching for various echo formats

5. **Command Display Cleanup** - Removed manual command echo
   - File: `public/js/game/commands.js`
   - No longer displays user commands with `addGameText()`
   - Commands saved to history only
   - Game handles all output display

6. **Focus Behavior** - Improved keyboard accessibility
   - File: `public/js/input/keyboard.js`
   - Input auto-focuses when visible (line mode)
   - Clicking game content focuses input (unless selecting text)
   - Typing anywhere focuses input automatically
   - No focus flash or jarring transitions

7. **Styling** - Clean visual integration
   - File: `public/styles.css`
   - `>` prompt positioned absolutely inside input area

12. **Autosave System Investigation** - Researched ifvms.js built-in autosave
   - **Critical Finding**: ifvms.js autosave ONLY works for Glulx games, NOT Z-machine games
   - Root cause: `save_allstate()` in glkapi.js requires GiDispa (Glulx dispatch layer)
   - GiDispa is null for Z-machine games (Lost Pig, Anchorhead, Zork, etc.)
   - Error: `Cannot read properties of null (reading 'get_retained_array')`
   - **Solution**: Confirmed custom save-manager.js is the correct approach for Z-machine
   - File: `public/js/game/game-loader.js:82` - Set `do_vm_autosave: false`
   - File: `public/js/game/voxglk.js:335-348` - Restored manual autoSave() calls
   - Files modified but reverted: `public/lib/dialog-stub.js`, `public/lib/glkapi.js`
   - **Documentation**: Updated `reference/save-restore-research.md` with findings
   - See: [Save/Restore Research](reference/save-restore-research.md#critical-finding-z-machine-vs-glulx-autosave-support)

13. **Autosave/Restore Completed** - Fully functional with "bootstrap" technique
   - **The Problem**: After `restore_file()`, VM memory restored but VM frozen (not running)
   - **The Solution**: "Wake" VM by fulfilling intro's pending char input request
   - Files: `public/js/game/voxglk.js`, `public/js/game/save-manager.js`
   - **How it works**:
     1. Game starts, intro shows char input request at gen: 1
     2. autoLoad() restores VM memory + VoxGlk state + display HTML
     3. Send char input with `gen: 1` to fulfill intro's pending request
     4. VM wakes up, processes input in restored state
     5. VM sends fresh update with line input at restored generation
     6. User can send commands normally
   - **Why this works**: Uses intro's char request as "bootstrap trigger" to wake frozen VM
   - **Failed alternatives**: vm.run() (conflicts), cancel input (doesn't help), no wake (VM stays frozen)
   - **Key insight**: Must use `gen: 1` (intro's generation), not restored generation (e.g., 5)
   - **Result**: Clean restore with no error messages, commands work immediately
   - **Documentation**: Updated `reference/save-restore-status.md` with complete details

### December 18, 2024 - Per-Game Settings System
1. **Organized Per-Game Settings** - Centralized storage for game-specific preferences
   - Files: `public/js/utils/game-settings.js` (new), `public/js/ui/settings.js`, `public/js/game/game-loader.js:13,31`
   - Settings stored as JSON objects in localStorage: `gameSettings_LostPig`, `gameSettings_Anchorhead`, etc.
   - Each game remembers its own: narrator voice, app voice, speech rate
   - Settings automatically reload when switching games
   - Default fallback when no game-specific settings saved
   - **Extensible architecture** ready for future per-game preferences:
     - Current: narratorVoice, appVoice, speechRate
     - Future: autoplay, highlightColor, fontSize, etc.
   - Clean API:
     - Settings: `getGameSetting()`, `setGameSetting()`, `loadGameSettings()`, `reloadSettingsForGame()`
     - Data management: `getGameData()`, `hasGameData()`, `clearAllGameData()`, `listAllGames()`
   - **Save data kept separate** (performance/size) but **logically grouped** via helper functions
   - Helpers manage settings + saves together: `clearAllGameData('lostpig')` removes settings, quicksave, and glkote save
   - Separation of concerns: game-settings.js (storage) → settings.js (UI) → game-loader.js (triggers)
   - Status messages show game name when changing settings: "Narrator voice: Karen (lostpig)"

### December 22, 2024 - Mobile Keyboard Scroll Fix
1. **Mobile Keyboard Aware Scrolling** - New content scrolls into view even with keyboard open
   - File: `public/js/utils/scroll.js:45-81`
   - `scrollToNewContent()` now uses Visual Viewport API (same as narration scroll logic)
   - Detects actual visible height when keyboard is open
   - Accounts for viewport offset when viewport shifts down
   - Positions new content in upper portion of visible area (8% buffer from top)
   - **Before**: New content could be hidden behind mobile keyboard
   - **After**: New content always visible at top of viewport, even with keyboard open
   - Uses smooth scroll animation for better UX
   - Consistent behavior whether narration is active or not
   - **Note**: Does NOT auto-scroll when keyboard opens/closes - only when NEW content arrives

### December 24, 2024 - ChatGPT Hints Input Re-enabling Fix
1. **Fixed Input Re-enabling Race Condition** - Hints work reliably on repeated clicks
   - File: `docs/js/game/voxglk.js:842-847`
   - Game responds synchronously to commands, but code was disabling input after game re-enabled it
   - Now checks if generation advanced before disabling input
   - **Before**: Second hint request failed with "input not enabled" error
   - **After**: Can click hints button multiple times without errors
   - Added detailed logging with emoji indicators (🟢🔴⚡📤) for debugging

2. **ChatGPT Window Opening** - Simplified to new tab each time
   - File: `docs/js/features/hints.js:354`
   - Opens ChatGPT in new tab with `_blank` target
   - **Known limitation**: Multiple ChatGPT tabs may open on repeated hint requests
   - Cross-origin restrictions prevent reliable window reuse
   - Users can manually close extra tabs as needed

3. **Google Drive Sync Improvements** - Game-specific sync and local-only conflict backups
   - Files: `docs/js/utils/gdrive-sync.js`
   - **Sync scoped to current game**: Sync button only syncs saves for the currently loaded game
   - **Confirmation before overwrite**: User must confirm before Drive overwrites local saves
   - **Local-only backups**: Conflict backups now stored in localStorage instead of Drive
     - Faster (no network round-trip)
     - Works offline
     - Preserves your local work before overwrite
     - Keeps last 2 backups per save type per game
     - Backup key format: `iftalk_backup_autosave_lostpig_1703435022000`
   - **Removed unused code**: Deleted `downloadAllSaves()` function and Drive backup infrastructure
   - **Simplified architecture**: Backups are local, Drive is canonical/shared version

4. **Code Refactoring & Optimization** - Phase 1-3 of comprehensive refactoring plan (IN PROGRESS)
   - **Plan**: See [reference/refactoring-plan.md](reference/refactoring-plan.md) for complete details
   - **Phase 1 ✅ Complete**: Deleted deprecated Socket.IO files (-105 lines)
     - Removed `docs/js/game/saves.js` (68 lines) - Legacy Socket.IO save system
     - Removed `docs/js/core/socket.js` (37 lines) - Deprecated Socket.IO wrapper
   - **Phase 2 ✅ Complete**: Storage abstraction layer (-150-200 lines)
     - Created `docs/js/utils/storage/storage-api.js` - Centralized localStorage API
     - Migrated `game-settings.js`, `pronunciation.js`, `audio-feedback.js` to use storage API
     - Eliminated ~150-200 lines of localStorage boilerplate code
   - **Phase 3 🔄 In Progress**: Save manager deduplication (~100+ lines eliminated so far)
     - Created `getCurrentDisplayState()` helper function (37 lines)
     - Created `performSave()` base function (73 lines) - used by all save functions
     - Refactored `quickSave()`: 80 lines → 9 lines (-71 lines)
     - Refactored `customSave()`: 75 lines → 7 lines (-68 lines)
     - Refactored `autoSave()`: 86 lines → 14 lines (-72 lines)
     - **Next**: Create `performRestore()` and refactor load functions
   - **Status**: ~300-400 lines eliminated across Phases 1-3, zero bugs introduced
   - **Remaining**: Phases 4-7 pending (see refactoring plan for details)

5. **Settings Menu Reorganization** - Comprehensive UX improvements and restructuring
   - Files: `docs/index.html`, `docs/js/ui/settings/settings-panel.js`, `docs/js/features/hints.js`, `docs/styles/settings.css`
   - **Menu Structure Changes**:
     - Quick Actions defaults to open (not collapsed)
     - Accordion behavior: expanding one section collapses others (top-level only)
     - Nested sections (like Cloud Sync submenu) toggle independently
   - **Repositioned Items**:
     - "Tap to Examine" moved to top of Voice & Input, description updated: "Tap words to enter them in the command input"
     - "Sound Effects" moved below "Master Volume" in Audio section
     - "Get ChatGPT Hint" now a button in Quick Actions (with hint type selector in modal)
   - **Cloud Sync Submenu** - Organized under Saves & Data
     - Auto-export toggle (triggers Google sign-in)
     - Sign in with Google section
     - Sync to Drive / Sync from Drive buttons
     - Sign Out button
   - **Button Grouping** - Background panels for visual hierarchy
     - Quick Save/Restore grouped with subtle background panel
     - Export File/Import File grouped (stacked vertically, not side-by-side)
     - 2px gap between grouped buttons, 8px padding around group
     - Max width 180px for alignment
   - **View Backup Saves** - New backup management dialog
     - Shows up to 5 autosave backups, 2 quicksave backups
     - Displays timestamp for each backup
     - Restore button reloads page with selected backup
     - Creates safety backup before restoring (exempt from limit)
   - **Removed Items**:
     - "Sync from GitHub (coming soon)" - already implemented
     - "Auto-export (coming soon)" - moved to Cloud Sync submenu
   - **Bug Fixes**:
     - Fixed buttons showing `display: block` instead of `display: flex`
     - JavaScript now preserves flex display for buttons when toggling visibility
     - Submenu clicks no longer collapse parent sections

6. **Backup System Improvements** - Hierarchical backup limits and triggers
   - Files: `docs/js/game/save-manager.js`, `docs/js/utils/gdrive/gdrive-sync.js`
   - **Backup Limits by Type**:
     - Autosaves: 5 backups (more frequent usage)
     - Quicksave/Customsave: 2 backups each
   - **Backup Triggers**:
     - **All save types**: When overwritten from Google Drive sync
     - **Autosaves only**:
       - Every 2 minutes during gameplay (automatic timer)
       - When user restores an existing backup (safety backup)
       - When overwritten from Drive sync
   - **Safety Backups**: Exempt from limits when created during restore operations
   - **Implementation**:
     - `createBackup(saveType, exemptFromLimit)` - Unified backup creation
     - `cleanupOldBackups(gameId, saveType)` - Type-aware cleanup (5 or 2 backups)
     - `createConflictBackup()` updated for Google Drive sync conflicts
     - Automatic 2-minute timer creates autosave backups continuously

### December 25, 2024 - Voice Recognition, Wake Lock, Lock Screen & Push-to-Talk
1. **Voice Recognition Restart on Page Lifecycle Events** - Fixed listening mode getting "stuck" after minimize/lock/rotation
   - File: `docs/js/app.js`
   - **Root Cause**: Browser terminates voice recognition when page is hidden, minimized, or device locks
   - **Previous Behavior**: Voice recognition would not restart when user returned to app
   - **New Behavior**: Comprehensive event handling restarts recognition automatically:
     - **visibilitychange**: Restarts when page becomes visible (tab switch, minimize, unlock)
     - **orientationchange**: Restarts after screen rotation (500ms delay for transition)
     - **focus**: Restarts when window regains focus (app switching, lock screen)
     - **pageshow**: Restarts when page restored from bfcache (iOS/mobile back button)
   - All handlers check `state.listeningEnabled` and `!state.isRecognitionActive` before restarting
   - Detailed console logging for debugging (e.g., "Page visible - restarting voice recognition")
   - **Result**: Voice recognition now reliably resumes after minimize, lock, rotation, or app switch
   - **Note**: Recognition continues listening even when muted (to hear "unmute" command)

2. **Wake Lock Reliability Improvements** - Fixed screen powering off despite wake lock being enabled
   - Files: `docs/js/utils/wake-lock.js`, `docs/js/utils/lock-screen.js`
   - **Root Cause**: Wake lock can be silently released by browser/OS, with no automatic retry
   - **Previous Behavior**: Wake lock would fail silently or not re-acquire after page visibility changes
   - **New Behavior**: Robust wake lock management with multiple safeguards:
     - **Automatic retry**: If wake lock is released by system, automatically retries after 2 seconds
     - **Periodic check**: Checks every 10 seconds if wake lock is still active, re-acquires if lost
     - **Page visibility handling**: Only requests wake lock when page is visible (prevents silent failures)
     - **Event-driven re-acquisition**: Responds to visibilitychange events to re-acquire wake lock
     - **Comprehensive logging**: Emoji-coded console logs for all wake lock events:
       - 🟢 Enabling, 🔴 Disabling, ✅ Acquired, 🔓 Released, ❌ Failed, 🔄 Retrying
       - 🔒 Lock screen enable, 🎮 User interaction, 👁️ Visibility change, ⏸️ Page hidden
   - **Lock Screen Integration**: Lock screen automatically enables wake lock when locked
     - Stores previous state and restores it on unlock
     - Logs all state changes for debugging
   - **Result**: Screen stays awake reliably during gameplay and when lock screen is active
   - **Note**: Wake lock is automatically enabled when lock screen is activated, even if toggle is off

3. **Lock Screen Robustness Improvements** - Better protection against accidental browser navigation
   - Files: `docs/js/utils/lock-screen.js`, `docs/styles.css`
   - **Root Cause**: Mobile Chrome may not enter fullscreen, or user can easily exit it, exposing browser controls
   - **Previous Behavior**: Fullscreen would fail silently, leaving browser tab/navigation buttons accessible
   - **New Behavior**: Multiple layers of protection:
     - **Fullscreen monitoring**: Detects when fullscreen is exited while screen is locked
     - **Visual warning**: Bright orange warning banner at top if fullscreen fails or is exited
       - "⚠️ Browser controls visible - Be careful not to tap browser buttons"
       - Animated pulsing to draw attention
     - **Tap shields**: Invisible 100px zones at top AND bottom of lock screen absorb accidental taps
       - Covers areas where browser controls typically appear (address bar, tabs, navigation)
       - Prevents touches from reaching browser UI elements
     - **Comprehensive logging**:
       - ✅ "Fullscreen activated" when successful
       - ⚠️ "Fullscreen API not supported" if API unavailable
       - ❌ "Fullscreen request failed" with error details
       - ⚠️ "Fullscreen exited while screen locked" if user exits
   - **Result**: Visual feedback when fullscreen protection isn't available, reduced accidental navigation
   - **Note**: On devices where fullscreen API doesn't work, warning helps user avoid accidental taps

4. **Push-to-Talk Mode** - Solution for car Bluetooth audio conflicts
   - Files: `docs/js/core/state.js`, `docs/js/voice/recognition.js`, `docs/js/app.js`, `docs/index.html`, `docs/styles.css`
   - **Problem**: Continuous listening keeps car Bluetooth in low-quality "call mode" (HFP profile)
     - TTS narration plays through call audio instead of high-quality media audio
     - Car thinks user is always on phone call
     - Music/media may pause or be interrupted
     - Browser switches between HFP and A2DP profiles causing stuttering
   - **Solution**: Optional push-to-talk mode for Bluetooth-friendly operation
   - **Settings Toggle**: Settings → Voice & Input → "Push-to-Talk Mode"
     - Default: OFF (continuous listening - current behavior)
     - Description: "Hold mic button to speak (recommended for car Bluetooth)"
   - **Behavior When Enabled**:
     - **Hold mic button** to activate voice recognition (like walkie-talkie)
     - Mic is OFF when button not pressed → Bluetooth stays in media mode (A2DP)
     - TTS narration plays through high-quality media profile
     - When button pressed → Bluetooth briefly switches to call mode for voice input
     - Button released → Recognition stops, Bluetooth returns to media mode
   - **Visual Feedback**:
     - Bright blue glow when button is held (`.push-to-talk-active` CSS class)
     - Status shows "🎤 Listening... Speak now!" when active
     - Status shows "Hold mic button to speak" when idle
   - **Implementation Details**:
     - `state.pushToTalkMode` flag stored in localStorage (`iftalk_push_to_talk`)
     - Mouse events: `mousedown`/`mouseup`/`mouseleave` for desktop
     - Touch events: `touchstart`/`touchend`/`touchcancel` for mobile
     - Recognition auto-restart disabled in `recognition.onend` when push-to-talk enabled
     - Click handler on mic button disabled in push-to-talk mode (only hold works)
   - **Result**: Users can choose between hands-free (lower audio quality) or button-press (high audio quality)
   - **Note**: Voice commands (pause, skip, etc.) still work while button is held

### December 23, 2024 - Tooltip System, Tap-to-Examine Improvements & Input Clearing
1. **Unified Tooltip System** - Consolidated all tooltip behavior into single function
   - Files: `docs/js/app.js`, `docs/styles.css`
   - Single `initHelpTooltips()` handles all tooltip types (game cards, settings, voice help)
   - Click to toggle on all platforms (desktop + mobile)
   - Clicking tooltip icon again now closes it properly
   - Clicking outside closes all tooltips
   - Consistent behavior across entire app

2. **Fixed Mobile Tooltip Hover Persistence** - CSS hover no longer interferes on mobile
   - File: `docs/styles.css`
   - Wrapped all `:hover` rules in `@media (hover: hover) and (pointer: fine)`
   - Mobile taps no longer activate persistent CSS :hover states
   - Tooltip visibility controlled entirely by JavaScript `.active` class on mobile
   - **Before**: Tapping tooltip icon closed it via JS, but CSS :hover kept it visible
   - **After**: Tapping icon reliably toggles tooltip on/off on mobile

3. **Unified Hover Styling** - All help icons use consistent gray opacity change
   - Files: `docs/styles.css`
   - All icons: opacity 0.5 → 1.0 on hover (no primary color change)
   - Removed scaling, background color changes
   - Simple, elegant, consistent across app
   - Icons: `.game-meta`, `.setting-help-icon`, `.voice-help-icon`

4. **Fixed Text Cursor on Desktop** - Text I-beam cursor now shows when tap-to-examine disabled
   - Files: `docs/js/app.js`, `docs/styles.css`
   - Root cause: `.game-text` had `cursor: default` which overrode `#lowerWindow` cursor
   - Fixed: `.game-text { cursor: text }` by default, `cursor: default` when feature enabled
   - Added initial body class setup on page load
   - **Before**: Default cursor always, even with feature disabled
   - **After**: Text cursor for selection when disabled, default cursor when enabled

5. **Tap-to-Examine Input Visibility** - Input scrolls into view when clicking words on mobile
   - File: `docs/js/input/keyboard.js`
   - Added `scrollIntoView()` after focusing input in `populateInputWithWord()`
   - 100ms delay allows keyboard to appear first, then scrolls
   - **Before**: Clicking word after minimizing keyboard left input hidden behind keyboard
   - **After**: Input always visible when keyboard appears

6. **Improved Scroll Detection** - Better differentiation between scrolling and tapping
   - File: `docs/js/input/keyboard.js`
   - Increased scroll threshold from 10px → 50px
   - Removed duplicate event listeners (only `lowerWindow`, not `gameOutput`)
   - Fixed event bubbling issue that bypassed scroll detection
   - **Before**: Scrolling often triggered word tapping, duplicate events
   - **After**: Reliable scroll detection, no false taps, cleaner code

7. **Back/Skip N Commands** - Multi-line navigation with voice commands
   - Files: `docs/js/voice/voice-commands.js`, `docs/js/app.js`, `docs/index.html`
   - Voice commands: "back 3", "skip 5", "go back 2", "forward 4", etc.
   - Supports number words: "back three", "skip five", etc. (one through ten)
   - Supports numeric digits: "back 3", "skip 7", etc.
   - Added `backN` and `skipN` handlers that call `skipToChunk()` with offset
   - Help section updated with examples

8. **Favicon Test Page** - Design gallery for choosing icon
   - File: `docs/favicon-test.html`
   - 20 different favicon design options (Speech Bubble, Microphone, Book, etc.)
   - Each shown at both 16×16 and 64×64 sizes
   - Canvas-based rendering with pixel-perfect designs
   - Download buttons for each size
   - Interactive preview gallery with hover effects

9. **Sound Test Page** - Audio feedback testing gallery
   - File: `docs/sound-test.html`
   - 10 pulse sound variations for app command feedback
   - Each with different frequency, duration, wave type, and envelope
   - Visual waveform previews for each sound
   - Technical specs displayed (frequency, duration, wave type, envelope)
   - Adjustable master volume slider
   - Sounds: Gentle Tap, Muffled Ding, Crisp Click, Soft Blip, Quick Chirp, etc.

10. **Voice Lock Fix** - Status now confirms voice is listening when screen locked
    - File: `docs/js/voice/recognition.js`
    - Status shows "🎤 Listening... Say 'unlock'" when screen is locked
    - Status shows "🎤 Listening... Speak now!" when unlocked
    - **Before**: Status didn't update when voice recognition restarted while locked
    - **After**: User always knows voice is active and listening for "unlock" command
    - Voice recognition continues working in background when locked

11. **Escape Key & Clear Button** - Enhanced input clearing with system mode cancellation
    - Files: `docs/index.html`, `docs/js/input/keyboard.js`, `docs/styles.css`
    - **Clear button styling**: Changed from `.btn-clear-input` to `.btn-nav` to match settings button
    - **Button alignment**: Clear button now has same dimensions as settings button and aligns properly
    - **Escape key functionality**:
      - Press Esc to clear command input
      - Press Esc to cancel system mode (SAVE/RESTORE/DELETE prompts)
    - **Clear button functionality**:
      - Click X button to clear command input
      - Click X button to cancel system mode if active
    - Consolidated duplicate Escape handlers into single implementation
    - Both clear methods now handle system entry mode gracefully

### What Works Now
- ✅ Game selection and loading
- ✅ Browser-based ZVM game engine
- ✅ Inline keyboard input with mode detection (line/char)
- ✅ **Autosave/restore** - Automatic save after each turn, restores on page load
- ✅ Text-to-speech narration (browser-based) with speed control
- ✅ Upper window (quotes/formatting) narration
- ✅ Text highlighting with auto-scroll during narration
- ✅ Title chunking for asterisk-wrapped section headers
- ✅ Command input and processing with echo suppression
- ✅ Navigation controls (with proper autoplay handling)
- ✅ Voice recognition with Ctrl push-to-talk
- ✅ Settings panel with collapsible sections
- ✅ Speech rate adjustment (0.5x - 1.5x)
- ✅ Auto-focus and click-to-focus behavior
- ✅ Fully offline-capable

## Current Status

**Active Refactoring**: Code cleanup and optimization in progress (Dec 24, 2024)
- See **[Refactoring Plan](reference/refactoring-plan.md)** for detailed phase-by-phase plan
- Status: Phase 3 of 7 in progress (~300-400 lines eliminated so far)
- See [TODO.md](TODO.md) for other tasks and progress

---

## Web Agent MCP Configuration

This project uses the `web-agent-mcp` server for browser automation, screenshot testing, and web debugging.

### Context-Efficient Screenshot Practices

**IMPORTANT**: Follow these guidelines when taking screenshots to minimize context token usage:

#### Default Behavior (Automatic)
- Screenshots save ONLY 800px lowRes by default (saves ~50-60% context tokens & disk space)
- High resolution images are NOT saved unless you specify `hiRes: true`
- Filename is exactly what you specify (no suffix added)

#### When to Use Each Feature

**Default: Just take the screenshot** (lowRes only, most common)
- Use for: Visual verification, checking layouts, confirming page state
- Example: `screenshot({ filename: 'page.png' })`
- Result: Saves `page.png` (800px lowRes)
- **This is what you should do 90% of the time**

**Use `hiRes: true` ONLY when:**
- Fine visual details are critical (design review, pixel-perfect verification)
- 800px lowRes is insufficient for the task
- User explicitly requests full resolution
- Example: `screenshot({ filename: 'detailed.png', hiRes: true })`
- Result: Saves `detailed.png` (full resolution, NO lowRes version)
- **Rarely needed - ask yourself if you really need this**

#### Screenshot Examples for IFTalk

```javascript
// MOST COMMON: Basic screenshot (lowRes only, default)
await mcp__web-agent-mcp__screenshot({
  filename: 'game-interface.png',
  directory: 'E:\\Project\\IFTalk-messaging\\screenshots'
});
// Saves: E:\Project\IFTalk-messaging\screenshots\game-interface.png (800px lowRes)

// Full-page screenshot
await mcp__web-agent-mcp__screenshot({
  filename: 'full-page.png',
  fullPage: true,
  directory: 'E:\\Project\\IFTalk-messaging\\screenshots'
});

// RARE: High resolution (only if needed)
await mcp__web-agent-mcp__screenshot({
  filename: 'design-review.png',
  hiRes: true,
  directory: 'E:\\Project\\IFTalk-messaging\\screenshots'
});
```

### Console Tools for Debugging

The web-agent-mcp server supports capturing and executing JavaScript in the browser console - useful for debugging IFTalk's client-side code.

#### get_console_logs Tool

**Purpose**: Retrieve console messages (console.log, console.warn, console.error, etc.) from the browser.

**Parameters**:
- `clear` (optional, boolean): Clear the console log buffer after reading (default: false)
- `filter` (optional, string): Filter messages by type (log, warn, error, info, debug) or by text content
- `limit` (optional, number): Max messages to return (default: 50, use 0 for all)

**Usage Examples**:
```javascript
// Get last 50 console logs (default, saves context)
await mcp__web-agent-mcp__get_console_logs({});

// Get only error messages
await mcp__web-agent-mcp__get_console_logs({ filter: 'error' });

// Get last 10 messages only
await mcp__web-agent-mcp__get_console_logs({ limit: 10 });

// Search for ZVM-related logs
await mcp__web-agent-mcp__get_console_logs({ filter: 'ZVM', limit: 20 });

// Search for TTS/narration logs
await mcp__web-agent-mcp__get_console_logs({ filter: 'TTS', limit: 20 });
```

**Notes**:
- **Default returns only 50 most recent messages to save context**
- Console messages are captured automatically from the moment the page loads
- Messages include timestamp, type (log/warn/error/info/debug), text content, and source location
- Use `limit` parameter to control context usage (lower = less context)
- Useful for debugging Vue components, event handlers, ZVM, and TTS code

#### execute_console Tool

**Purpose**: Execute JavaScript code in the browser console and return the result.

**Parameters**:
- `code` (required, string): JavaScript code to execute in the browser context

**Usage Examples**:
```javascript
// Query the DOM
await mcp__web-agent-mcp__execute_console({
  code: 'document.querySelector("#gameport").textContent'
});

// Check ZVM state
await mcp__web-agent-mcp__execute_console({
  code: 'window.vm ? "VM loaded" : "VM not loaded"'
});

// Check TTS state
await mcp__web-agent-mcp__execute_console({
  code: 'window.speechSynthesis.speaking'
});

// Manipulate the page for testing
await mcp__web-agent-mcp__execute_console({
  code: 'document.querySelector("#mic-toggle").click(); "Toggled mic"'
});
```

**Notes**:
- Code executes in the current page context with full access to the DOM and global scope
- The last expression in the code is returned as the result
- Do not use `return` statements (causes "Illegal return statement" error)
- Console output from the executed code is captured and available via `get_console_logs`
- Useful for debugging, testing, and dynamically manipulating pages

### Web Navigation Workflow

#### Single Action Instructions
When the user provides a **specific single navigation/interaction instruction** (e.g., "click this button", "navigate to this URL", "take a screenshot"), complete ONLY that action and then **STOP and await further instructions**.

Examples of single actions:
- "Navigate to [URL]"
- "Click [element]"
- "Type [text] into [field]"
- "Take a screenshot"
- "Scroll down"

#### Multi-Step Task Instructions
When the user provides a **higher-level task** (e.g., "test the login flow", "find and fill out the form"), you may proceed with multiple actions to complete the entire task without stopping after each step.

Examples of multi-step tasks:
- "Test the game interface"
- "Test the TTS narration controls"
- "Test voice input with various commands"
