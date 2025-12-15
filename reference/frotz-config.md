# ⚠️ DEPRECATED: Frotz Configuration Reference

**This document is preserved for historical reference only.**

**Status:** Frotz server-side architecture was abandoned on 2025-12-15

**Reason:** Unix-style line-oriented I/O (stdin/stdout) is fundamentally incompatible with modern web-based interactive fiction. Browser-based ZVM (ifvms.js + GlkOte) provides direct API access to game state without fragile text parsing.

**Current Architecture:** See [reference/zvm-integration.md](zvm-integration.md)

---

# Frotz Configuration Reference (Historical)

## Last Used dfrotz Version: 2.54 (via WSL)

```json
"interpreter": "wsl",
"interpreterArgs": ["-d", "Ubuntu", "-u", "root", "--", "dfrotz", "-q", "-m", "-f", "ansi", "-h", "999"]
```

**Upgrade completed 2025-12-15:** Successfully migrated from Windows dfrotz 2.44 to WSL Ubuntu dfrotz 2.54.

### Installation

Frotz 2.54 is installed via WSL Ubuntu:

```bash
# Install WSL Ubuntu (if not already installed)
wsl --install -d Ubuntu

# Install frotz in WSL
wsl -d Ubuntu -u root -- bash -c "apt update && apt install -y frotz"

# Verify installation
wsl -d Ubuntu -u root -- dfrotz --version
# Output: FROTZ V2.54 - Dumb interface.
```

### Previous Configuration (dfrotz 2.44 - Windows)

```json
"interpreter": "./dfrotz.exe",
"interpreterArgs": ["-h", "999"]
```

**Limitations of 2.44:**
- No `-f`, `-m`, or `-q` flags (added in v2.51)
- Plain text output only (no ANSI capability)
- Startup messages couldn't be suppressed
- MORE prompts couldn't be disabled

## dfrotz 2.54 Output Format & Test Results

### Test Methodology (2025-12-15)

Comprehensive testing performed on:
- **LostPig.z8** - Modern IF game
- **Anchorhead.z8** - Classic horror IF with formatting

**Test commands:**
```bash
# With ANSI formatting
wsl -d Ubuntu -u root -- dfrotz -q -m -f ansi -h 999 /root/test.z8 <<< 'look'

# Without formatting (comparison)
wsl -d Ubuntu -u root -- dfrotz -q -m -h 999 /root/test.z8 <<< 'look'

# Raw byte analysis
wsl -d Ubuntu -u root -- dfrotz -f ansi /root/test.z8 <<< 'look' | od -An -tx1 -c
```

### Key Findings

1. **ANSI Support Available but Game-Dependent:**
   - Flag `-f ansi` enables ANSI escape code support
   - However, ANSI codes only appear if the game itself uses formatting features
   - Tested games (LostPig, Anchorhead) output plain text even with `-f ansi`
   - Hexadecimal analysis confirmed: no `\x1b[` escape sequences in output
   - Games that DO use bold/italic/color will benefit from `-f ansi`

2. **Startup Message Suppression:**
   - Without `-q`: Shows "Using ANSI formatting." and "Loading /path/to/game.z8."
   - With `-q`: Clean output, no startup messages
   - Essential for clean server-side output parsing

3. **MORE Prompt Handling:**
   - Flag `-m` successfully disables pagination prompts
   - Critical for server use - prevents hanging on long text

4. **Output Quality:**
   - Text output is clean and well-formatted
   - Identical text quality to v2.44
   - Proper paragraph breaks and spacing preserved

## Supported Flags in dfrotz 2.54

All dfrotz 2.44 flags PLUS new additions:

**New in 2.51+ (now available):**
- `-f <type>` - Format codes: `ansi`, `none`, or omit for normal (default: normal)
- `-m` - Turn off MORE prompts
- `-q` - Quiet mode (suppress startup messages)

**Existing flags (from 2.44):**
- `-a` - Watch attribute setting
- `-A` - Watch attribute testing
- `-h #` - Screen height (default: 24)
- `-i` - Ignore fatal errors
- `-I #` - Interpreter number
- `-L <file>` - Load save file
- `-o` - Watch object movement
- `-O` - Watch object locating
- `-p` - Plain ASCII output only
- `-P` - Alter piracy opcode
- `-r <option>` - Set runtime options
- `-R <path>` - Restricted read/write directory
- `-s #` - Random number seed value
- `-S #` - Transcript width
- `-t` - Set Tandy bit
- `-u #` - Slots for multiple undo (default: 100)
- `-v` - Show version information
- `-w #` - Screen width (default: 80)
- `-x` - Expand abbreviations g/x/z
- `-Z #` - Error checking: 0=none, 1=first only (default), 2=all, 3=exit after error

**Current configuration uses:** `-q -m -f ansi -h 999`

**Rationale:**
- `-q`: Clean output for server parsing
- `-m`: No pagination interruptions
- `-f ansi`: Enable formatting support (for games that use it)
- `-h 999`: Large screen height to prevent unwanted breaks

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
