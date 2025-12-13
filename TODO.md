# IFTalk TODO - Interactive Fiction Integration

## Current Status (2025-12-13)

### Summary
After extensive debugging of both Parchment and direct ZVM approaches, both have fundamental issues with VM lifecycle and generation counter management. The games load and display correctly, but the interactive command loop never fully engages.

---

## Branch Status

### `parchment-prototype` Branch
**Status:** ⚠️ Commands fail due to generation counter desync

**What Works:**
- ✅ Game loads from IF Archive (raw .z8 files)
- ✅ Authentic iplayif.com styling
- ✅ Clean visual presentation
- ✅ Fixed generation counter initialization (set to 1)

**What Doesn't Work:**
- ❌ Commands fail - Parchment's internal GlkOte counter desyncs with our counter
- ❌ Voice commands cause WrongGeneration errors
- ❌ No game responses to input

**Issue Details:**
- We maintain `parchmentGeneration` counter
- Parchment has internal `GlkOte.generation` that we can't access/sync
- Our counter says 1, game expects something different
- Need to read from `window.parchment.options.GlkOte.generation` instead

**Commits:**
- `b0a4aee` - Parchment prototype with generation counter issues documented

---

### `master` Branch (ZVM + GlkOte)
**Status:** ⚠️ VM loads but never starts running

**What Works:**
- ✅ Game loads from IF Archive
- ✅ No errors in console (buffer access error fixed)
- ✅ Uses smaller raw .z8 files (520KB vs 700KB)
- ✅ Fixed generation counter initialization
- ✅ Proper options object structure

**What Doesn't Work:**
- ❌ VM never actually starts executing
- ❌ `GlkOte.generation` stays `undefined`
- ❌ Commands ignored with "Ignoring repeated generation number: 1"
- ❌ No game responses to any input

**Issue Details:**
- `vm.prepare(storyData, options)` succeeds
- `Glk.init(options)` is called but VM doesn't start
- The visual display works but interactive loop never engages
- Matches glkote-term test pattern but still doesn't work

**Recent Commits:**
- `61de5e0` - Fix generation counter initialization
- `fa4454b` - Remove manual vm.start() call
- `cd21343` - Refactor ZVM initialization to match examples

---

## Technical Investigation

### What We Learned

**From Examples ([glkote-term](https://github.com/curiousdannii/glkote-term/blob/master/tests/zvm.js), [ifvms.js](https://github.com/curiousdannii/ifvms.js/issues/10)):**
1. Create VM: `const vm = new ZVM()`
2. Build options: `{ vm, Glk, GlkOte, Dialog }`
3. Prepare VM: `vm.prepare(storyData, options)`
4. Initialize Glk: `Glk.init(options)` - *should* start VM

We're doing all these steps, but step 4 doesn't actually start the VM.

**Generation Counter Problem:**
- GlkOte tracks generation internally
- We shouldn't maintain our own counter
- Should read from `GlkOte.generation` or let GlkOte handle it entirely
- But when VM doesn't start, `GlkOte.generation` stays `undefined`

**Key Insight:**
The generation counter issue is a *symptom*, not the root cause. The real problem is the VM execution loop never starts.

---

## Comparison: Parchment vs Direct ZVM

| Aspect | Parchment | Direct ZVM |
|--------|-----------|------------|
| **Setup Complexity** | Simple | Complex |
| **File Size** | Larger (.z8.js: 700KB) | Smaller (.z8: 520KB) |
| **Control** | Abstracted/Limited | Full control |
| **Issues** | Generation desync | VM won't start |
| **Debugging** | Through wrapper | Direct access |
| **Status** | Commands fail | VM never runs |

---

## Next Steps

### Option 1: Deep Dive into Parchment Source
- Study actual Parchment production code (not just examples)
- Understand how runner.js handles initialization
- Figure out how to access/sync with internal GlkOte.generation
- **Difficulty:** High - requires understanding complex codebase

### Option 2: Debug Glk.init() Lifecycle
- Add extensive logging to understand why VM doesn't start
- Check if there's a missing event or callback
- Try different initialization sequences
- **Difficulty:** High - debugging library internals

### Option 3: Try Simpler IF Interpreter
- Look for alternatives to ZVM + GlkOte
- Maybe Glulx with Quixe is better documented?
- Consider different IF format entirely
- **Difficulty:** Medium - start fresh but with unknowns

### Option 4: Study Working Implementation
- Clone and run Parchment locally
- Step through their actual initialization code
- Copy their exact pattern
- **Difficulty:** Medium - learn from working code

### Option 5: Different Approach Entirely
- Use server-side IF interpreter
- Browser connects via WebSocket
- Simpler client-side code
- **Difficulty:** Medium - different architecture

---

## Files Modified (This Session)

### `parchment-prototype` branch:
- `public/index.html` - Parchment CDN scripts
- `public/app.js` - Simplified startGame(), fixed gen counter
- `public/styles.css` - Removed overrides for authentic styling
- `CLAUDE.md` - Updated with findings

### `master` branch:
- `public/app.js` - Multiple refactorings of ZVM init sequence

---

## Open Questions

1. **Why doesn't `Glk.init(options)` start the VM?**
   - Are we missing a required option property?
   - Is there an async callback we're not handling?
   - Does the Game.accept() pattern need something different?

2. **How does production Parchment avoid generation issues?**
   - Do they track it differently?
   - Is there a sync mechanism we're missing?

3. **Is the glkapi.js version incompatible with ifvms ZVM?**
   - Versions we're using: glkote@latest, ifvms@1.1.6
   - Are these known to work together?

4. **Should we be using a Dialog object?**
   - Examples include Dialog in options
   - We don't have one - could this be critical?

---

## Resources

- [glkote-term ZVM test](https://github.com/curiousdannii/glkote-term/blob/master/tests/zvm.js) - Working example
- [ifvms.js usage discussion](https://github.com/curiousdannii/ifvms.js/issues/10) - API patterns
- [ZVM implementation gist](https://gist.github.com/curiousdannii/237b91a12f136ed617c2e778509575ef) - Core logic
- [Parchment repository](https://github.com/curiousdannii/parchment) - Production code
- [GlkOte documentation](https://eblong.com/zarf/glk/glkote/docs.html) - API reference

---

## Previous Working State

**Note:** Neither branch currently has fully working command input.

The closest we got:
- Visual display works in both branches
- Game intro text appears correctly
- TTS capture hooks are in place
- But no branch has working interactive commands

Last fully working version would need to be found in earlier commits before this refactoring effort.
