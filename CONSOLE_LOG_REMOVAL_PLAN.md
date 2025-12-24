# Console Log Removal Plan - UPDATED

## Summary (REVISED)
- **Obsolete file removed**: docs/app.js (98KB, 185 logs) - NOT LOADED BY APP ✅ DELETED
- **Total custom code logs**: 38 occurrences across 17 files in docs/js/
- **Strategy**: Remove debug logs, keep critical error handling

## Files NOT Being Modified
- ✅ Third-party libraries (docs/lib/*.js) - external code
- ✅ server.js - backend code (separate concern)
- ✅ test-markers.js - test file
- ✅ docs/app.js - DELETED (obsolete file, not loaded)

## Custom Code Breakdown (Sorted by Count)

### 🟡 Medium Priority - Multiple Logs

#### 1. docs/js/utils/remote-console.js - 7 logs
**Status**: Remote debugging utility
**Action**: Review - decide if keeping entire module
**Risk**: Low (debugging feature)

#### 2. docs/js/app.js - 5 logs
**Types**:
- 2x console.error (initialization errors) - **KEEP**
- 2x console.warn (chunk events, Google Drive sync) - **REVIEW**
**Action**: Keep errors, review warnings

#### 3. docs/js/input/keyboard.js - 4 logs
**Action**: Review each log (likely debug logs)

#### 4. docs/js/game/saves.js - 4 logs
**Content**: "Server-based save/restore not supported" warnings
**Action**: **REMOVE** - deprecated warnings, no longer relevant

#### 5. docs/js/utils/game-settings.js - 3 logs
**Types**: console.error for parsing failures
**Action**: **KEEP** - critical error handling

### 🟢 Low Priority - Single/Minimal Logs

#### 6. docs/js/utils/wake-lock.js - 2 logs
**Content**: Wake Lock API not supported, request failed
**Action**: **KEEP** - important feature detection warnings

#### 7. docs/js/ui/confirm-dialog.js - 2 logs
**Content**: DOM not found, not initialized warnings
**Action**: **KEEP** - important warnings

#### 8. docs/js/input/word-extractor.js - 2 logs
**Content**: Browser compatibility warning, error handling
**Action**: **KEEP** - error handling

#### Files with 1 log each - **REVIEW INDIVIDUALLY**
- docs/js/voice/voice-meter.js (1) - error handling - **KEEP**
- docs/js/utils/audio-feedback.js (1) - error handling - **KEEP**
- docs/js/ui/game-output.js (1) - error handling - **KEEP**
- docs/js/narration/navigation.js (1) - "no chunks" warning - **REVIEW**
- docs/js/narration/highlighting.js (1) - error handling - **KEEP**
- docs/js/narration/chunking.js (1) - error handling - **KEEP**
- docs/js/game/voxglk-renderer.js (1) - "unknown window" warning - **REVIEW**
- docs/js/game/commands.js (1) - deprecated function warning - **KEEP**
- docs/js/core/state.js (1) - unknown, needs review

## Removal Strategy

### Phase 1: Quick Removals (~10 logs)
**Target**: Remove obvious debug/deprecated logs

1. **docs/js/game/saves.js** - Remove all 4 deprecated warnings
   - "Server-based save/restore not supported" messages
   - **Expected reduction**: 4 logs

2. **docs/js/input/keyboard.js** - Review and remove debug logs
   - **Expected reduction**: 2-4 logs

3. **docs/js/app.js** - Review 2 warnings
   - Keep errors, decide on warnings
   - **Expected reduction**: 0-2 logs

4. **docs/js/core/state.js** - Review 1 log
   - **Expected reduction**: 0-1 log

**Total Phase 1 reduction**: ~6-11 logs

### Phase 2: Remote Console Decision
**Target**: docs/js/utils/remote-console.js (7 logs)

**Options**:
A. Keep remote debugging feature → keep all 7 logs
B. Remove remote debugging feature → delete entire file

**Decision needed**: Is remote debugging still useful?

### Phase 3: Review Remaining Warnings
**Target**: Individual console.warn statements

Files to review:
- docs/js/narration/navigation.js (1 warn)
- docs/js/game/voxglk-renderer.js (1 warn)

**Expected reduction**: 0-2 logs

## Execution Plan

### Step 1: Phase 1 - Quick Cleanup
1. Clean **docs/js/game/saves.js** (remove 4 warnings)
2. Clean **docs/js/input/keyboard.js** (review 4 logs)
3. Review **docs/js/app.js** warnings
4. Review **docs/js/core/state.js**
5. Test after changes

### Step 2: Phase 2 - Remote Console
1. Decide if keeping remote debugging
2. Either keep or remove entire module
3. Update any dependencies

### Step 3: Phase 3 - Final Review
1. Review remaining warnings
2. Test thoroughly

### Step 4: Final Testing
- Game loading
- TTS narration
- Voice recognition
- Save/restore
- Settings panel
- All major features

## Expected Final Count

**Current**: 38 logs
**After Phase 1**: ~27-32 logs (remove 6-11)
**After Phase 2**:
- Option A (keep remote-console): ~27-32 logs
- Option B (remove remote-console): ~20-25 logs
**After Phase 3**: ~18-30 logs (53-79% reduction)

## Files to Keep Error Logs

These files have legitimate error handling - **DO NOT remove**:
- docs/js/app.js (errors only)
- docs/js/utils/game-settings.js (all 3 errors)
- docs/js/utils/audio-feedback.js (1 error)
- docs/js/ui/game-output.js (1 error)
- docs/js/voice/voice-meter.js (1 error)
- docs/js/narration/highlighting.js (1 error)
- docs/js/narration/chunking.js (1 error)
- docs/js/input/word-extractor.js (2 errors/warnings)
- docs/js/ui/confirm-dialog.js (2 warnings)
- docs/js/utils/wake-lock.js (2 warnings)
- docs/js/game/commands.js (1 deprecation warning)

## Success Criteria
- ✅ Deleted obsolete docs/app.js (98KB dead code)
- ✅ Remove deprecated warnings from saves.js
- ✅ Remove debug logs from keyboard.js
- ✅ Keep all critical error handling
- ✅ Application works normally
- ✅ No unexpected errors
- ✅ Cleaner, production-ready code

## Risk Assessment
- **No Risk**: Deleting obsolete docs/app.js (not loaded)
- **Low Risk**: Removing debug logs and deprecated warnings
- **Medium Risk**: Removing console.warn (review each carefully)
- **High Risk**: Removing console.error (DON'T remove these)

## Progress
- [x] Identified obsolete file (docs/app.js)
- [x] Deleted obsolete file
- [ ] Phase 1: Quick cleanup
- [ ] Phase 2: Remote console decision
- [ ] Phase 3: Final review
- [ ] Testing
