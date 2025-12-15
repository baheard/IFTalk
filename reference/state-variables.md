# Key State Variables Reference

These are the primary state variables used in `app.js` to manage application behavior:

| Variable | Type | Purpose |
|----------|------|---------|
| `isNarrating` | Boolean | Currently playing audio |
| `narrationEnabled` | Boolean | Whether narration should play (controls auto-play) |
| `isPaused` | Boolean | Narration paused (not stopped) |
| `isMuted` | Boolean | Microphone muted (NOT audio muted) |
| `listeningEnabled` | Boolean | Continuous voice recognition active |
| `talkModeActive` | Boolean | Both listening and narration active together |
| `currentChunkIndex` | Number | Position in sentence array for navigation |
| `currentChunkStartTime` | Number | Timestamp for smart back button (500ms threshold) |
| `isNavigating` | Boolean | Prevents concurrent navigation operations |
| `hasProcessedResult` | Boolean | Flag to prevent duplicate voice command processing |
| `hasManualTyping` | Boolean | Set when user types manually, prevents auto-send |

## Important Notes

- `narrationEnabled` only controls auto-play, NOT chunk creation
- `isMuted` affects microphone input, NOT audio output
- `isNavigating` includes 100ms delay to prevent race conditions
- Chunks are ALWAYS created when new text arrives, regardless of `narrationEnabled`
