# Frotz Configuration Reference

## Current dfrotz Version: 2.44

```json
"interpreter": "./dfrotz.exe",
"interpreterArgs": []
```

**Important:** dfrotz version 2.44 does NOT support the `-f`, `-m`, or `-q` flags. These flags were added in version 2.51 (February 2020). No pre-compiled Windows binary exists for v2.51+, so we use v2.44 with no flags.

## dfrotz 2.44 Output Format

- **Plain text only** - No ANSI escape codes for formatting
- **No bold/colors/underline** - All text is unformatted
- **Works perfectly** - Games are fully playable, just without visual formatting
- **Server processing** - The `ansi-to-html` library has nothing to convert (no codes present)

## Supported Flags in dfrotz 2.44

Available flags (use sparingly - most are unnecessary for server use):

- `-a` - Watch attribute setting
- `-A` - Watch attribute testing
- `-h #` - Screen height (requires number)
- `-i` - Ignore fatal errors
- `-I #` - Interpreter number
- `-o` - Watch object movement
- `-O` - Watch object locating
- `-p` - Plain ASCII output only (avoid - degrades text quality)
- `-P` - Alter piracy opcode
- `-s #` - Random number seed value
- `-S #` - Transcript width
- `-t` - Set Tandy bit
- `-u #` - Slots for multiple undo
- `-w #` - Screen width
- `-x` - Expand abbreviations g/x/z
- `-Z #` - Error checking mode (0-3)

**Recommendation:** Use no flags (empty array) for best compatibility.

## Upgrading to Newer Versions

If you need ANSI formatting support (bold text, colors), you would need dfrotz 2.51+:

**Version 2.51+ adds:**
- `-f ansi` - Enable ANSI escape codes for formatting
- `-m` - Disable MORE prompts
- `-q` - Quiet mode (suppress startup messages)

**Problem:** No pre-compiled Windows binary available. Would require:
- Compiling from source using WSL/MinGW/Cygwin
- Significant time investment for minimal visual improvement
- Current v2.44 works perfectly for gameplay

**Latest version:** Frotz 2.55 (February 2025) - source code only

## Status Line Detection

**Two patterns supported** (server.js lines 82-97):

1. **Old pattern**: `) ` marker followed by status content
   ```
   )   Outside the Real Estate Office                      day one
   ```

2. **New pattern**: Few leading spaces, text, 20+ spaces, more text
   ```
      Outside the Real Estate Office                      day one
   ```

**Processing**:
- Server extracts status line (server.js lines 88, 94)
- Compares to previous status line (lines 234-237, 292-295)
- Emits `clear-screen` event when status line changes (lines 235, 293)
- Client clears game output and resets narration state (app.js lines 2054-2063)

## Artifact Filtering

**Filtered patterns** (server.js lines 112-126):
- `.` - Blank line indicator
- `. )` - Paragraph break artifact
- `. ` - Spacing artifact
- Empty lines

**NOT filtered**:
- `)` - Status line marker (intentionally preserved since line 121)
