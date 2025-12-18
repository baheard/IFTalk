# Save/Restore Implementation Status

**Last Updated:** December 17, 2024

## Current Status: ✅ FULLY WORKING

Autosave/restore is fully functional with clean transitions.

## What Works

- ✅ Autosave after each turn (saves VM state + display HTML + VoxGlk state)
- ✅ Auto-restore on page load
- ✅ VM restores to correct position
- ✅ Display HTML shows saved content immediately
- ✅ VM wakes up and processes commands normally
- ✅ Input becomes available automatically
- ✅ Game continues from saved position
- ✅ Clean transition with no error messages

## How It Works

The restore process uses a "bootstrap" technique to wake the VM:

1. **Save** (on each turn):
   - VM state via `restore_file()` (Quetzal format)
   - VoxGlk state (generation counter, inputWindowId)
   - Display HTML (statusBar, upperWindow, lowerWindow)
   - Verification data (PC, stack depths)

2. **Restore** (on page load):
   - VM starts normally, shows intro screen
   - First update arrives with char input request (gen: 1)
   - `autoLoad()` restores VM memory to saved state
   - VoxGlk state restored (generation → 5, inputWindowId → 1)
   - Display HTML restored (user sees saved content immediately)
   - **Key step**: Send char input with `gen: 1` to fulfill intro's pending request
   - This "wakes" the VM, which is now in restored state
   - VM sends fresh update with line input at correct generation
   - User can send commands normally

## Implementation Details

### Files Modified

- `public/js/game/game-loader.js` - Sets flag to trigger restore after VM starts
- `public/js/game/voxglk.js` - Triggers autoLoad() on first update, sends bootstrap char input
- `public/js/game/save-manager.js` - Handles VM restore, VoxGlk state restore, and display HTML restoration

### Key Code

**Bootstrap technique (voxglk.js):**
```javascript
if (restored) {
    // Wake VM by sending dummy input to fulfill intro char request
    setTimeout(() => {
        // The intro screen char request was created at gen: 1
        // We need to fulfill it with gen: 1, not the restored gen: 5
        acceptCallback({
            type: 'char',
            gen: 1,  // Intro's original generation
            window: 1,
            value: 10  // Enter key
        });
    }, 100);
}
```

**Restore logic (save-manager.js):**
```javascript
autoLoad() {
    // Restore VM memory
    vm.restore_file(bytes.buffer);

    // Restore VoxGlk state (generation, inputWindowId)
    window._voxglkInstance.restore_state(
        saveData.voxglkState.generation,
        saveData.voxglkState.inputWindowId
    );

    // Restore display HTML (preserve command line element)
    const commandLine = document.getElementById('commandLine');
    lowerWindowEl.innerHTML = saveData.displayHTML.lowerWindow;
    lowerWindowEl.appendChild(commandLine);
}
```

## Timing Sequence

1. Game starts (shows intro, char input active at gen: 1)
2. First update arrives with char input request
3. autoLoad() called:
   - Restores VM memory to saved state
   - Restores VoxGlk state (generation: 5, inputWindowId: 1)
   - Restores display HTML
4. User sees saved content immediately
5. Bootstrap char input sent (gen: 1, value: Enter)
6. VM wakes up, processes input in restored state
7. VM sends fresh update with line input at gen: 5
8. User can send commands normally (no error messages!)

## Why This Approach Works

### Why restore_file() Freezes the VM

**Understanding the Problem**: `restore_file()` is designed to be called FROM WITHIN the VM (as part of the RESTORE opcode), not from external JavaScript.

**How RESTORE Normally Works (In-Game)**:
1. Game code calls RESTORE opcode (like calling a function)
2. VM saves current PC (program counter - where it is in the code)
3. VM restores memory from save file
4. VM RETURNS to game code with result code (2 = success)
5. Game code sees result, prints "Restored", continues executing
6. VM keeps running - it never stopped!

**What Happens with External restore_file()**:
1. JavaScript calls `vm.restore_file(buffer)`
2. VM restores memory from buffer
3. VM returns result (2) to JavaScript
4. **But... there's no game code waiting!**
5. **VM is frozen** at the saved PC, but that instruction isn't running
6. **No execution happening** - the VM is like a paused video

**Analogy**:
- **In-game RESTORE**: Like hibernating your laptop (saves state and continues running after resume)
- **External restore_file()**: Like restoring a disk image to a powered-off computer (memory loaded, but CPU not running)

**Why the input event wakes the VM**:
- Glk delivers the input event to the VM
- VM starts processing the input (CPU "wakes up")
- VM is already in restored state (memory was restored earlier)
- VM executes from restored position and sends fresh update
- VM keeps running normally from that point

### The "Bootstrap" Technique

**Problem**: After `restore_file()`, the VM memory is restored but the VM is **frozen** - not actively running.

**Solution**: "Wake" the VM by fulfilling the intro's pending char input request.

1. ✅ **Intro's char request is still active** - Created at gen: 1, waiting for input
2. ✅ **Send char input with gen: 1** - Glk accepts it because generation matches
3. ✅ **VM wakes up** - Glk delivers input to VM, which starts processing
4. ✅ **VM is in restored state** - Memory already restored (PC 74744, gen: 5)
5. ✅ **VM sends fresh update** - With line input at correct generation
6. ✅ **No conflicts** - We don't call vm.run() or cancel input

### Attempted Alternatives (Failed)

1. **Call vm.run() after restore** - ❌ Throws "window already has keyboard request"
2. **Cancel input before vm.run()** - ❌ Inputs get recreated, vm.run() still fails
3. **Don't wake VM at all** - ❌ VM stays frozen, doesn't process user commands
4. **Send char input with restored gen: 5** - ❌ Glk rejects (intro request expects gen: 1)

## Critical Implementation Notes

### DO
- ✅ Send bootstrap char input with `gen: 1` to wake VM
- ✅ Restore VoxGlk state (generation, inputWindowId)
- ✅ Preserve command line element during HTML restore
- ✅ Use `restore_file()` for VM memory restoration

### DON'T
- ❌ Call `vm.run()` after restore (conflicts with input requests)
- ❌ Try to cancel input requests (doesn't prevent vm.run() errors)
- ❌ Send bootstrap input with restored generation (use gen: 1)
- ❌ Use ifvms.js built-in autosave (Glulx-only, doesn't work for Z-machine)

## Testing

To test autosave/restore:
1. Load a game (e.g., Anchorhead)
2. Play for a few turns (each turn autosaves)
3. Reload the page (Ctrl+R)
4. ✅ Should restore to last position automatically
5. ✅ Saved content displays immediately
6. ✅ Input prompt appears
7. ✅ Commands work normally
8. ✅ No error messages or glitches

