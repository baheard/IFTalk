# Navigation Behavior Rules

This document defines the expected UX behavior for navigation controls and text highlighting.

## Core Principle

**Text highlighting always shows where the navigator currently is.**

The highlight reflects the current playback position, even when paused or stopped.

---

## Highlighting Rules

### 1. During Playback
- Highlight the currently playing chunk
- Update in real-time as playback progresses

### 2. When Paused
- **Keep** the highlight on the current chunk
- Shows where playback will resume from

### 3. After Restart Button
- Highlight the **first chunk** immediately, even if paused
- Shows that navigator has moved to beginning

### 4. After Skip to End
- **No highlighting** (navigator is past the last chunk)
- Text is fully read, no current position

### 5. After Back from End
- Highlight the **last chunk**
- Shows navigator has moved back into content

### 6. After Playback Finishes Naturally
- **Remain at end** with no highlighting
- Do NOT automatically restart navigation
- User can press Back to highlight last chunk and continue backward

---

## Navigation Button Behavior

### ⏪ Restart
- Move navigator to beginning
- Highlight first chunk
- **If paused**: Keep paused, show first chunk highlighted
- **If autoplay enabled**: Start playing from first chunk
- **If autoplay disabled**: Show first chunk highlighted but don't play

### ⬅️ Back (Smart Back)
- Within 500ms: Go to previous chunk
- After 500ms: Restart current chunk
- **From end position**: Jump to last chunk and highlight it
- **Auto-resume**: If narration was playing before, resume playback

### ▶️ Play/Pause
- Toggle playback state
- Maintain current chunk position
- Update icon based on state

### ➡️ Forward
- Move to next chunk
- **Auto-resume**: If narration was playing before, resume playback

### ⏩ Skip to End
- Force stop playback completely
- Set `narrationEnabled = false`
- Clear all highlighting (navigator past content)
- **Never auto-resumes** (unlike other navigation buttons)

---

## State Consistency

### Current Position Always Means:
1. Where TTS will resume from when you press Play
2. What chunk gets highlighted (if in valid range)
3. Where Back/Forward navigate relative to

### When playback finishes naturally:
- **Current behavior**: Navigation restarts
- **Desired behavior**: Stay at end position
- **Rationale**: Allows user to easily go Back from end

---

## Implementation Notes

### Variables to Track
- `currentChunkIndex`: Current playback position
- `narrationEnabled`: Whether narration is active
- `isPaused`: Whether playback is paused
- `autoplay`: Whether new text should start playing automatically

### Highlight Logic
```javascript
function shouldShowHighlight(currentChunkIndex, totalChunks) {
  // Highlight shows if navigator is in valid chunk range
  return currentChunkIndex >= 0 && currentChunkIndex < totalChunks;
}
```

### After Natural Playback End
```javascript
// OLD: Restart navigation
currentChunkIndex = 0;

// NEW: Stay at end (no highlight)
currentChunkIndex = totalChunks; // or -1, indicating "past end"
```

---

## Open Questions

1. Should slider position update when navigation moves (e.g., after Restart)?
2. Should clicking on a chunk in the text jump to that position?
3. What happens if new game text arrives while at end? Auto-play or stay stopped?

---

## Related Documentation

- **[design-decisions.md](design-decisions.md)**: Implementation details for navigation state management
- **[text-highlighting-system.md](text-highlighting-system.md)**: Technical details of marker-based highlighting
- **[state-variables.md](state-variables.md)**: Key state flags and their purposes
