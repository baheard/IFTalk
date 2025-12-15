# Architecture Comparison

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
