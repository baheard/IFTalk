# Architecture Comparison: Frotz vs Browser-based

| Aspect | Frotz (Server) | ZVM/GlkOte (Browser) |
|--------|----------------|----------------------|
| **Reliability** | ✅ Proven | ❌ Generation counter issues |
| **Setup** | Requires dfrotz binary | Pure JavaScript |
| **Control** | Full text interception | Complex lifecycle |
| **Styling** | Easy - just HTML/CSS | GlkOte dictates structure |
| **Latency** | Network round-trip | Instant |
| **Offline** | ❌ Needs server | ✅ Could work offline |

## Decision

**Frotz wins on reliability.** We can always revisit browser-based later if needed.

## Why Server-side Frotz Works

- Proven reliability with full text interception
- Easy styling (just HTML/CSS, not constrained by GlkOte structure)
- Complete control over game state and output
- No generation counter or lifecycle management issues
- Socket.IO provides real-time bidirectional communication
