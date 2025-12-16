# IFTalk TODO

## 🐛 Current Issue: TTS Marker Insertion Failure

**Problem:** Text-to-speech chunk markers fail to insert into the DOM, causing the warning:
```
[Markers] Skipping ID N: text node has no parent
```

### Root Cause Analysis (2024-12-15)

**The Issue:**
GlkOte splits content into **multiple style runs with the same style name**. For example, Anchorhead's opening screen has a single line with 3 separate "normal" runs:

```javascript
Line 3: [
  "normal", "                         ",  // Run 1: 25 spaces
  "normal", "                                               ",  // Run 2: 47 spaces
  "normal", "                            "   // Run 3: 28 spaces
]
```

**Current Processing:**
1. `voxglk-renderer.js` flattens all runs into a single HTML string (line 165-188):
   ```javascript
   for (let i = 0; i < contentArray.length; i += 2) {
     currentLine += `<span style="...">${text}</span>`;  // Creates separate <span> for each run
   }
   ```

2. `chunking.js` inserts temporary markers (⚐N⚐) into the HTML at sentence boundaries

3. When we try to find markers in the DOM, they may be split across multiple `<span>` boundaries:
   - Span 1 ends with: `"...text⚐"`
   - Span 2 starts with: `"12⚐more..."`
   - Result: Marker `⚐12⚐` is split, can't be found in any single text node

**Impact:**
- Most markers fail to insert (only 2-3 out of 14 succeed)
- Text highlighting during narration doesn't work properly
- Sentence boundaries lost

**Next Steps:**
1. Update ifvms.js to latest version (may change data format)
2. Re-evaluate marker insertion strategy after update
3. Consider alternative approaches:
   - Insert markers before GlkOte rendering
   - Track run boundaries during flattening
   - Use DOM positions instead of text markers

---

## 📋 Current Tasks

### High Priority
- [ ] **Update ifvms.js** to latest version
- [ ] **Re-test TTS marker system** after ifvms update
- [ ] **Fix marker insertion** if issue persists after update

### Medium Priority
- [ ] Test TTS narration with all games
- [ ] Verify responsive layout on mobile devices
- [ ] Review and update voice recognition accuracy

### Low Priority
- [ ] Loading states styling
- [ ] Error message styling
- [ ] Focus states and accessibility improvements
- [ ] Add transitions and animations

---

## Current Architecture

### VoxGlk Custom Display Engine

**Files:**
- `public/js/game/voxglk.js` - Display interface (init, update, error)
- `public/js/game/voxglk-renderer.js` - HTML renderer with space preservation
- `public/js/narration/chunking.js` - TTS marker system (currently broken)

**Data Flow:**
```
ZVM (ifvms.js game engine)
  ↓ calls Glk API
glkapi.js
  ↓ GlkOte.update(updateObj)
VoxGlk.update()
  ↓ VoxGlkRenderer.renderUpdate()
  ↓ HTML with white-space: pre
#gameOutputInner (rendered output)
  ↓ chunking.js inserts markers
TTS narration with highlighting
```

**Key Features:**
- Browser-based Z-machine interpreter (ifvms.js)
- Custom VoxGlk renderer (replaces GlkOte UI)
- Preserves spaces via `white-space: pre` CSS
- Responsive layout (768px, 480px breakpoints)
- Voice recognition (Web Speech API)
- TTS narration (Web Speech API)

---

## What Works ✅

- Game loading and playback (all 4 games tested)
- Character input (single keypress)
- Line input (command entry)
- Voice recognition
- Basic TTS narration
- Responsive mobile layout
- Status line rendering
- Generation counter sync

## What's Broken ❌

- TTS marker insertion (12/14 markers fail)
- Text highlighting during narration
- Sentence boundary detection in multi-run content

---

## Quick Commands

```bash
# Start server
cd /e/Project/IFTalk && npm start

# Access at http://localhost:3000
```

---

## Version History

**Architecture Evolution:**
1. **v1:** Server-side Frotz via WSL + Socket.IO (removed Dec 2024)
2. **v2:** Browser-based Parchment (replaced Dec 2024)
3. **v3 (current):** Browser-based ifvms.js + VoxGlk custom renderer

**Current Libraries:**
- ifvms.js: Copyright 2017 (version unknown) - **needs update to 1.1.6**
- GlkOte: 2.2.5 (latest: 2.3.7)
- jQuery: 3.7.1
