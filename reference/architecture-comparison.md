# Architecture Comparison

## Why Frotz Was Abandoned (2025-12-15)

**Primary Reason:** Unix-style line-oriented I/O is fundamentally incompatible with modern web-based interactive fiction.

### The Fundamental Problem

Frotz's dfrotz ("dumb interface") was designed for **terminal environments**, not web applications. It uses a simple stdin/stdout model:

```
stdin  →  [dfrotz process]  →  stdout
"look"                         "You see a door.\n"
```

This terminal-centric design creates insurmountable problems for web integration:

#### 1. **No API, Just Text Streams**
- Game state is locked inside the Frotz process
- Only interface is raw text input/output
- No way to query current room, inventory, or game state
- Must parse text output to infer what happened

#### 2. **Fragile Status Line Detection**
```javascript
// Had to guess status lines with regex patterns like this:
if (line.match(/^\s{1,5}\S.{10,}\s{20,}\S/)) {
  statusLine = line.trim(); // Hope this is right!
}
```

#### 3. **Artificial Delays for Output**
```javascript
// Had to guess when Frotz finished writing:
gameProcess.stdin.write(command + '\n');
setTimeout(() => {
  const output = buffer.toString(); // Hope it's done!
}, 500); // Magic number!
```

#### 4. **Complex Infrastructure Stack**
```
User → Browser → WebSocket → Node.js → dfrotz process (WSL) → Z-machine
                  ↑                          ↑
            Network latency            Process spawn overhead
```

#### 5. **Deployment Nightmares**
- Requires VPS ($4-6/month minimum)
- Need WSL on Windows or Linux server
- Process management (spawn, kill, restart)
- Socket.IO session handling
- Binary dependencies (dfrotz)

### Browser-Based Solution

ifvms.js + GlkOte provides a **proper API**:

```javascript
// Direct API access to game state:
vm.start();  // Start game
GlkOte.update(data);  // Process game output
vm.sendLine(command);  // Send command

// No parsing needed - structured data:
{
  type: "line",
  content: "You see a door.",
  window: 1
}
```

**Benefits:**
- Instant response (no network/process overhead)
- Direct access to game state
- Free static hosting (no VPS needed)
- No binary dependencies
- Unlimited concurrent users

### The Bottom Line

**Frotz is a terminal app, not a web app.** Trying to force stdin/stdout into a modern web interface is like using a screwdriver as a hammer - technically possible, but the wrong tool for the job.

---

## Current Architecture: Browser-Based ZVM + GlkOte ✅

| Aspect | ZVM/GlkOte (Browser) ⭐ CURRENT | Frotz (Server-Side) |
|--------|-------------------------------|---------------------|
| **Setup** | ✅ Pure JavaScript | Requires WSL + dfrotz binary |
| **Deployment** | ✅ Static files only | Needs Node.js + Socket.IO server |
| **Hosting** | ✅ Free (GitHub Pages, Netlify, Vercel) | Requires VPS ($4-6/month minimum) |
| **Latency** | ✅ Instant (no network) | Network round-trip per command |
| **Offline** | ✅ Works offline after load | ❌ Requires server connection |
| **Scalability** | ✅ Unlimited concurrent users | Limited by server resources |
| **State Management** | ✅ Client-side only | Server manages sessions |
| **Styling** | GlkOte structure (constrained) | Full HTML/CSS control |
| **Text Processing** | Direct access to game output | Full text interception |
| **Dependencies** | jQuery + GlkOte + ifvms | WSL, dfrotz, Socket.IO, server |

## Decision Rationale

**We chose browser-based ZVM for:**

1. **Simplicity**: No backend game logic, just serve static files
2. **Cost**: Free hosting vs $4-6/month VPS
3. **Scalability**: No server bottleneck
4. **Deployment**: Single `npm build` → upload to CDN
5. **Maintenance**: No server to monitor/update

## Why Browser-Based Works

- ✅ ifvms.js is a mature, stable Z-machine interpreter
- ✅ GlkOte provides reliable display layer
- ✅ Games run entirely client-side (no server state)
- ✅ Perfect for small-to-medium IF games
- ✅ Easy to add new games (just drop .z5/.z8 files)

## Tradeoffs We Accept

- GlkOte controls display structure (less styling flexibility)
- Must download entire game file to browser
- Limited to Z-machine games (no Glulx support in ifvms)
- JavaScript interpreter overhead vs native code

## When to Reconsider Server-Side

**Use Frotz/server-side if:**
- You need Glulx support (large modern IF games)
- You want complete control over text rendering
- You need server-side game state management
- You're processing game output with AI (would require server anyway)

**Current choice is optimal for:**
- Z-machine games (vast majority of classic IF)
- Voice-controlled IF with browser TTS
- Simple, maintainable deployment
- No ongoing hosting costs
