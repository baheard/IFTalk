# ⚠️ DEPRECATED: Frotz Z-Machine Interpreter Documentation

**This document is preserved for historical reference only.**

**Status:** Frotz server-side architecture was abandoned on 2025-12-15

**Reason:** Unix-style line-oriented I/O (stdin/stdout) is fundamentally incompatible with modern web-based interactive fiction. The dfrotz "dumb interface" was designed for terminal environments, not web applications, leading to:
- Fragile status line parsing with regex patterns
- Artificial delays to "guess" when output finished
- No direct access to game state
- Complex infrastructure (WSL, process management, Socket.IO)
- Deployment challenges (requires VPS hosting)

**Current Architecture:** Browser-based ifvms.js + GlkOte - See [reference/zvm-integration.md](reference/zvm-integration.md)

---

# Frotz Z-Machine Interpreter Documentation (Historical)

## Overview

Frotz is an open-source interpreter for Infocom and other Z-Machine games (interactive fiction). It can play story files in formats like Z3, Z4, Z5, Z8, etc.

**Official Repository:** https://github.com/DavidGriffith/frotz
**GitLab Mirror:** https://gitlab.com/DavidGriffith/frotz/

## Frotz Variants

### 1. **dfrotz** - Dumb Interface (What We Use)
- **Purpose:** Terminal/server environments, piping, automation
- **Interface:** Plain text output, no screen control
- **Best For:** Server-side game hosting, scripts, APIs
- **No Configuration Files:** All settings via command-line or runtime commands

### 2. **frotz** - Curses Interface
- **Purpose:** Unix/Linux terminal with full screen control
- **Interface:** ncurses-based, supports colors, formatting, windows
- **Best For:** Local terminal play

### 3. **sfrotz** - SDL Interface
- **Purpose:** Modern graphical interface
- **Interface:** SDL graphics, mouse support, fonts
- **Best For:** Desktop GUI experience

### 4. **Windows Frotz**
- **Purpose:** Native Windows application
- **Interface:** Windows GUI with menus, graphics support
- **Best For:** Windows desktop users

## Current Implementation: dfrotz 2.44

### Version Information
- **Version:** 2.44 (pre-2020)
- **Platform:** Windows (dfrotz.exe)
- **Release Date:** Before February 2020
- **Why This Version:** No pre-compiled Windows binary available for newer versions

### Critical Limitations of v2.44

**Missing Flags (Added in v2.51+):**
- ❌ No `-f` flag for ANSI formatting
- ❌ No `-m` flag for disabling MORE prompts
- ❌ No `-q` flag for quiet mode

**What This Means:**
- Plain text output only (no ANSI escape codes)
- No bold, colors, or underline formatting
- All text is unformatted monospace
- Games are fully playable, just without visual formatting

### Supported Flags in v2.44

**Available Command-Line Options:**
```bash
-a          Watch attribute setting (debug)
-A          Watch attribute testing (debug)
-h #        Screen height in lines
-i          Ignore fatal errors
-I #        Interpreter number to report
-o          Watch object movement (debug)
-O          Watch object locating (debug)
-p          Plain ASCII output only (avoid - degrades text quality)
-P          Alter piracy opcode
-s #        Random number seed value
-S #        Transcript width
-t          Set Tandy bit
-u #        Slots for multiple undo
-w #        Screen width in characters
-x          Expand abbreviations g/x/z
-Z #        Error checking mode (0-3)
```

**Recommendation:** Use no flags (empty array) for best compatibility and default behavior.

## Output Format Analysis

### What dfrotz 2.44 Actually Sends

Based on direct testing and source code analysis:

**Line Endings:**
```
\x0d\x0a (CR+LF - Windows line endings)
```

**NO Special Control Codes:**
- ❌ NO ANSI escape codes for formatting
- ❌ NO ANSI clear screen codes (`\x1b[2J`, `\x1b[H\x1b[J`)
- ❌ NO form feed characters (`\f`, `\x0c`)
- ❌ NO special clear screen markers

**Plain Text Only:**
- Just ASCII characters and `\r\n` line breaks
- Centering done with leading spaces
- Status line sent as regular text

### Line Type Markers (Optional Feature)

dfrotz CAN prepend line type identification characters, but they are **DISABLED by default**.

**Toggle Command:** `\lt` - Toggle display of line type markers

**When Enabled, Each Line Gets a Prefix:**

**Input Prompts (Untimed):**
- `>` = Regular line-oriented input
- `)` = Single-character input ("press any key")
- `}` = Line input with content before cursor

**Input Prompts (Timed):**
- `T` = Regular line-oriented input (timed)
- `t` = Single-character input (timed)
- `D` = Line input with content before cursor (timed)

**Output Lines:**
- `]` = Output line containing the cursor
- `.` = Blank line from span compression
- ` ` (space) = Standard output line

**In Our Setup:** These markers are NOT enabled, so we don't see them in output.

### Raw Output Examples

**Initial Game Start:**
```
                 The oldest and strongest emotion of mankind\x0d\x0a
                 is fear, and the oldest and strongest kind\x0d\x0a
                 of fear is fear of the unknown.\x0d\x0a
  \x0d\x0a
                 -- H.P. Lovecraft\x0d\x0a
. \x0d\x0a
                            A N C H O R H E A D\x0d\x0a
. \x0d\x0a
              [Press 'R' to restore; any other key to begin]\x0d\x0a
)
```

**Status Line Format (After LOOK):**
```
   Outside the Real Estate Office                 day one\x0d\x0a
. \x0d\x0a
  ANCHORHEAD\x0d\x0a
  An interactive gothic by Michael S. Gentry\x0d\x0a
  ...
```

**Status Line Pattern:**
- 1-5 leading spaces
- Location text
- 20+ spaces (padding)
- Score/time/moves text
- `\x0d\x0a`

### Screen Artifacts

**Artifact Characters dfrotz Sends:**
- `.` - Standalone period on a line (paragraph break marker)
- `. )` - Period + space + parenthesis (formatting artifact)
- `. ` - Period + space (spacing artifact)
- Empty lines

**How We Handle Them:**
- Filter out these artifacts (server.js lines 137-143)
- Convert to paragraph breaks (`\n\n`)
- Clean up output for display

## Runtime Commands

dfrotz supports interactive commands while running (type `\` to enter command mode):

### Display Control

**Screen Display:**
- `\s` - Show current contents of whole screen
- `\d` - Discard any buffered output

**Line Hiding:**
- `\lN` - Hide top N lines (orthogonal to compression modes)

**Output Compression:**
- `\cn` (none) - Show whole screen before every input
- `\cm` (max) - Show only lines with new nonblank characters
- `\cs` (spans) - Like max, but emit blank line between spans

### Display Toggles

**Line Information:**
- `\ln` - Toggle display of line numbers
- `\lt` - Toggle display of line type identification chars

### Input Control

**Timeouts:**
- `\t` - Set the number of seconds to wait for timed input (0 = infinite)

### Help

**Information:**
- `\h` - Display help information
- `\v` - Show version information

### Formatting (Newer Versions)

**ANSI/IRC Formatting (v2.51+):**
- `-f ansi` - Enable ANSI escape codes for formatting
- `-f irc` - Enable IRC formatting codes
- `-f normal` - No markup (default)

**Note:** v2.44 does NOT support the `-f` flag.

## Status Line Detection

### How Games Send Status Lines

Z-Machine games use a "split window" model:
- **Upper window (Window 0):** Status line - typically 1-3 lines
- **Lower window (Window 1):** Main game text

dfrotz renders this by:
1. Outputting the upper window content at the top
2. Following with the lower window (main text)
3. No special markers between them

### Detection Strategy (Our Implementation)

**Pattern Matching:**
```javascript
// Pattern: few leading spaces, text, 20+ spaces, more text
if (line.match(/^\s{1,5}\S.{10,}\s{20,}\S/)) {
  statusLine = line.trim();
}
```

**Clear Screen Detection:**
```javascript
// Compare current status line to previous
if (statusLine && lastStatusLine && statusLine !== lastStatusLine) {
  emit('clear-screen'); // Scene change!
}
```

**Why This Works:**
- Status line format is consistent across Z-Machine games
- Always has location (left-aligned) and score/time/moves (right-aligned)
- Wide spacing between elements makes it distinctive
- Changes when player moves to new location

## Frotz Limitations (Dumb Interface)

### Not Supported in dfrotz

**Graphics & Media:**
- ❌ No sound effects
- ❌ No graphics (except ASCII placeholder boxes)
- ❌ No colors (unless ANSI formatting enabled in v2.51+)
- ❌ No fonts

**Screen Control:**
- ❌ No cursor positioning
- ❌ No screen scrolling control
- ❌ No split windows (just text output)
- ❌ No inverse/reverse text
- ❌ No character-level screen manipulation

**Input:**
- ❌ No mouse support
- ❌ No function keys beyond Enter/Backspace

### Games That May Have Issues

**Problematic Game Types:**
- Games with heavy cursor movement (hard to read)
- Games with text windows overlapping (layout broken)
- Games with graphical puzzles (unplayable)
- Games requiring mouse input (impossible)

**Usually Fine:**
- Standard text adventures (Zork, Anchorhead, Photopia)
- Parser-based IF
- Choice-based IF with text menus

## Version Upgrade Path (Future)

### To Get ANSI Formatting (v2.51+)

**Requirements:**
- Compile from source (no Windows binary available)
- Use WSL, MinGW, or Cygwin on Windows

**Benefits:**
- `-f ansi` flag for bold, colors, underline
- `-m` flag to disable MORE prompts
- `-q` flag for quiet startup

**Trade-offs:**
- Significant compilation effort
- Minimal visual improvement (games still playable without)
- Would need to update server.js ANSI processing

**Current Status:** Not worth the effort for our use case.

## Server Integration Notes

### How We Use dfrotz (server.js)

**Spawn Process:**
```javascript
const gameProcess = spawn('./dfrotz.exe', ['Anchorhead.z8'], {
  stdio: ['pipe', 'pipe', 'pipe']
});
```

**No Arguments:** We pass no flags for maximum compatibility.

**Output Processing Pipeline:**
1. Capture stdout from dfrotz
2. Normalize line endings (`\r\n` → `\n`)
3. Detect and extract status line
4. Filter formatting artifacts (`.`, `. )`, `. `)
5. Convert ANSI codes to HTML (even though v2.44 doesn't send them)
6. Wrap sentences for per-sentence highlighting
7. Send to client

**Status Line Tracking:**
```javascript
// Store in session
session.lastStatusLine = statusLine;

// Detect scene changes
if (statusLine && lastStatusLine && statusLine !== lastStatusLine) {
  socket.emit('clear-screen');
}
```

**Input Handling:**
```javascript
// Send command to game
gameProcess.stdin.write(command + '\n');

// Wait for response, process output
setTimeout(() => {
  const { htmlOutput, statusLine } = processFrotzOutput(buffer);
  socket.emit('game-output', htmlOutput);
}, 500);
```

## Testing & Debugging

### Raw Output Inspection

**Test Script (test-frotz-output.cjs):**
```javascript
const { spawn } = require('child_process');
const game = spawn('./dfrotz.exe', ['Anchorhead.z8']);

game.stdout.on('data', (data) => {
  const str = data.toString();
  const chars = str.split('').map(c => {
    const code = c.charCodeAt(0);
    if (code < 32) return '\\x' + code.toString(16).padStart(2, '0');
    return c;
  }).join('');
  console.log('RAW:', chars);
});
```

**What We Learned:**
- Only `\x0d\x0a` for line endings
- No control codes or escape sequences
- Status line is just text with specific spacing pattern
- Input prompts (like `)`) only appear when requesting input

### Debug Logging (server.js)

**Always-On Logging:**
```javascript
const chars = output.split('').map(c => {
  const code = c.charCodeAt(0);
  if (code < 32) return `\\x${code.toString(16).padStart(2, '0')}`;
  return c;
}).join('');
console.log('[Frotz RAW] (' + output.length + ' chars):');
console.log(chars.substring(0, 800));
```

**Benefits:**
- See exactly what dfrotz sends
- Detect unexpected control codes
- Debug status line patterns
- Identify new artifact patterns

## Resources

### Official Documentation
- [dfrotz Manual (ManKier)](https://www.mankier.com/6/dfrotz)
- [Debian dfrotz Manual](https://manpages.debian.org/unstable/frotz/dfrotz.6.en.html)
- [Arch Linux Manual](https://man.archlinux.org/man/extra/frotz-dumb/dfrotz.6.en)

### Source Code
- [GitHub: DavidGriffith/frotz](https://github.com/DavidGriffith/frotz)
- [dumb_input.c](https://raw.githubusercontent.com/DavidGriffith/frotz/master/src/dumb/dumb_input.c) - Input handling
- [dumb_output.c](https://raw.githubusercontent.com/DavidGriffith/frotz/master/src/dumb/dumb_output.c) - Screen rendering

### Related Projects
- [frotz-js](https://github.com/jwoos/frotz-js) - Node.js interface for Frotz
- [restful-frotz](https://github.com/tlef/restful-frotz) - RESTful interface to Frotz

### Z-Machine Standards
- [Z-Machine Standards Document](https://www.inform-fiction.org/zmachine/standards/z1point0/sect08.html)

## Summary: Key Takeaways

### What dfrotz 2.44 Provides
✅ Reliable Z-Machine game execution
✅ Plain text output with consistent line endings
✅ Status line in predictable format
✅ Full game state management
✅ Save/restore functionality
✅ Standard text adventure compatibility

### What It Doesn't Provide
❌ ANSI formatting or colors
❌ Clear screen control codes
❌ Line type prefix markers (by default)
❌ Graphics or sound
❌ Advanced screen manipulation

### Detection Strategy
🔍 Status line = Pattern matching on text format
🔍 Clear screen = Status line change detection
🔍 No special codes or markers needed

### Why This Works
- Server-side processing compensates for limitations
- Pattern matching is reliable for standard IF games
- Plain text is easier to style with HTML/CSS
- No dependency on ANSI/terminal features
- Complete control over presentation layer

---

**Last Updated:** 2025-12-14
**Frotz Version:** 2.44 (dfrotz.exe for Windows)
**Latest Frotz:** 2.55 (source only, February 2025)
