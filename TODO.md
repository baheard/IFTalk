# IFTalk TODO - Interactive Fiction Integration

## Current Status (2025-12-13)

### Summary
Server-side Frotz approach is working reliably. Major styling improvements completed for typography and color scheme. Next focus is mobile responsiveness.

---

## Active Branch: `frotz`

**Status:** ✅ Working - styling in progress

**What Works:**
- ✅ Server-side Frotz interpreter via Socket.IO
- ✅ Game loads and responds to commands
- ✅ Voice recognition and TTS narration
- ✅ AI command translation (Ollama)
- ✅ All navigation controls (back, forward, pause, play, skip)
- ✅ Pronunciation dictionary
- ✅ Two-panel input layout (voice + text)

---

## Styling Progress

### ✅ Typography (COMPLETED)
- [x] Added Google Fonts: Crimson Pro (serif) + IBM Plex Mono
- [x] Game text now uses elegant serif font (18px, line-height 1.9)
- [x] Commands use clean monospace (IBM Plex Mono)
- [x] Welcome screen with literary styling
- [x] Consistent font family across all UI elements

### ✅ Color Scheme (COMPLETED)
Implemented refined dark theme - elegant, neutral, literary feel:

| Variable | Color | Purpose |
|----------|-------|---------|
| `--bg-primary` | `#0d0f12` | Deep charcoal background |
| `--bg-secondary` | `#14171c` | Slightly lighter surfaces |
| `--bg-surface` | `#1a1e24` | Cards and panels |
| `--bg-elevated` | `#22272e` | Elevated elements |
| `--accent-primary` | `#8b9dc3` | Muted blue-gray (buttons, links) |
| `--accent-warm` | `#c4a35a` | Warm gold (highlights, headers) |
| `--text-primary` | `#e6e4e0` | Cream white text |
| `--text-secondary` | `#a8a5a0` | Muted secondary text |

- [x] Removed saturated purple/pink gradients
- [x] Neutral charcoal backgrounds
- [x] Muted accent colors
- [x] Warm gold for speaking highlights
- [x] CSS variables for easy theming

### ✅ Layout (COMPLETED)
- [x] Game output area sizing and padding improved
- [x] Mobile responsiveness - comprehensive breakpoints added:
  - Tablet (900px): Condensed header, smaller dropdowns
  - Mobile (768px): Stacked layout, touch-friendly buttons, full-width panels
  - Small mobile (480px): Compact typography and controls
  - Landscape phone: Optimized for horizontal viewing
- [x] Touch-friendly button sizes (min 44-48px)
- [x] Voice panel hidden when not in talk mode (mobile)

### ⬚ Polish (TODO)
- [ ] Loading states
- [ ] Error message styling
- [ ] Transitions and animations refinement
- [ ] Focus states and accessibility
- [ ] Status bar styling (location, score, moves)

---

## Text Highlighting Implementation (2025-12-14)

### Problem Statement
Highlighting during narration was failing because:
- **Display HTML** contains original Frotz formatting (soft-breaks, ANSI colors, spaced capitals like "A N C H O R H E A D")
- **Narration chunks** are heavily processed (collapsed capitals, normalized spacing, title-cased)
- Text mismatch caused CSS Highlight API search to fail (searching for "anchorhead." in text containing "a n c h o r h e a d")

### Solution: Pre-Insert Invisible Markers
Instead of searching for processed text in original DOM, insert invisible `<span>` markers at sentence boundaries BEFORE any text processing:

1. Parse original HTML into DOM tree
2. Walk text nodes looking for sentence endings (`.!?`)
3. Insert invisible marker spans at sentence boundaries
4. Render HTML with markers embedded
5. When highlighting, find markers and create Range objects between them

This preserves ALL original HTML formatting while enabling reliable highlighting.

### Implementation Details

**New Function: `insertSentenceMarkersInHTML()` (app.js ~line 1332)**
- Parses HTML, walks text nodes with TreeWalker
- Detects sentence starts (first non-whitespace) and ends (`.!?` followed by whitespace)
- Inserts `<span class="chunk-marker-start" data-chunk="N">` and `chunk-marker-end` markers
- Markers have `display: none; position: absolute;` to be completely invisible
- Returns modified HTML with markers embedded

**Updated: `addGameText()` (app.js ~line 561-567)**
- Simplified from ~50 lines to 6 lines
- Calls `insertSentenceMarkersInHTML()` before rendering
- No longer needs complex sentence wrapping logic

**New Function: `highlightUsingMarkers()` (app.js ~line 743)**
- Queries DOM for start/end markers by chunk index
- Creates Range object between markers using `range.setStartAfter()` and `range.setEndBefore()`
- Applies CSS Highlight API with `CSS.highlights.set('speaking', highlight)`
- Returns `true` on success, `false` if markers not found

**Updated: `updateTextHighlight()` (app.js ~line 1636)**
- Tries marker-based highlighting first
- Falls back to text search if markers not found
- Graceful degradation ensures partial functionality

**Updated: `findTextRange()` (app.js ~line 627-730)**
- Improved whitespace normalization during character mapping
- Now normalizes WHILE building the map (not after), keeping positions aligned

**Extracted: `processTextForTTS()` (app.js ~line 1086)**
- Shared function for consistent text processing
- Collapses spaced capitals, normalizes initials, title-cases all-caps words
- Used by both chunk creation and text search

### Current Status
- ✅ Highlighting working for 50%+ of sentences using markers
- ✅ Preserves all original HTML formatting (soft-breaks, colors, ANSI styling)
- ✅ Graceful degradation (falls back to text search when markers not found)
- ✅ No visual artifacts from markers
- ⚠️ **Partial coverage**: 2 markers inserted but 4 chunks created (see below)

### Why Marker Count Differs from Chunk Count

**The Discrepancy:**
Console logs show:
```
[Markers] Pre-inserted 2 sentence markers in HTML
[TTS] Created 4 chunks
```

**Root Cause:**
Sentence splitting happens at TWO different points with DIFFERENT text:

1. **`insertSentenceMarkersInHTML()`** (app.js ~line 1332):
   - Runs on ORIGINAL HTML: `"Welcome to &lt;span class='soft-break'&gt;&lt;/span&gt;H.P. Lovecraft's &lt;span class='soft-break'&gt;&lt;/span&gt;A N C H O R H E A D"`
   - Splits on `.!?` → Finds 2 sentences (splits after "H.P.")
   - Inserts 2 markers (chunks 0-1)

2. **`createNarrationChunks()`** (app.js ~line 1180-1229):
   - Runs on PROCESSED text: `"Welcome to H P Lovecraft's Anchorhead"` (after `processTextForTTS()`)
   - Normalizes "H.P." → "H P" (period removed, creates new split point)
   - Splits on `.!?` → Finds 4 sentences
   - Creates 4 chunks (0-3)

**Result:**
- Chunks 0-1: Have markers ✅ (use `highlightUsingMarkers()`)
- Chunks 2-3: No markers ⚠️ (fall back to `highlightSpokenText()` text search)

### Next Steps for Improvement

**Option 1: Align Sentence Splitting (Recommended)**
Make `insertSentenceMarkersInHTML()` use the SAME splitting logic as `createNarrationChunks()`:
- Apply `processTextForTTS()` to extracted text BEFORE splitting
- This would create 4 markers matching 4 chunks (100% coverage)
- Trade-off: More complex marker insertion logic

**Option 2: Leave As-Is**
Current approach works for majority of text:
- 50% coverage with markers is acceptable
- Fallback handles remaining cases
- Simpler code, less chance of bugs

**Option 3: Reverse Dependency**
Have `createNarrationChunks()` query markers instead of splitting:
- Count existing markers in DOM
- Extract text between each marker pair
- Guarantees chunk count = marker count
- Trade-off: Chunks wouldn't reflect text processing until after rendering

### Files Modified This Session

**`public/app.js`**
- Added `processTextForTTS()` - Shared text processing function (~line 1086)
- Added `insertSentenceMarkersInHTML()` - Pre-insert markers in HTML (~line 1332)
- Added `highlightUsingMarkers()` - Highlight using marker elements (~line 743)
- Updated `addGameText()` - Insert markers before rendering (~line 561-567)
- Updated `createNarrationChunks()` - Removed old marker insertion (~line 1325-1329)
- Updated `updateTextHighlight()` - Try markers first, fall back to search (~line 1636)
- Updated `findTextRange()` - Improved whitespace normalization (~line 627-730)

**No changes to:** `server.js`, `styles.css`, `index.html`

### Key Learnings

1. **User insight was critical**: Suggesting to insert markers "before it's parsed out into tts" completely changed the approach
2. **Marker-based highlighting is superior**: Preserves ALL formatting, more reliable than text search
3. **Text transformation is the enemy**: Any processing creates mismatches - solve by marking BEFORE processing
4. **Graceful degradation essential**: Fallback ensures partial functionality is better than total failure
5. **Sentence splitting needs consistency**: Processing creates new sentence boundaries - must align both algorithms for 100% coverage

---

## Next Steps

### Polish Priority
1. Loading spinner/states for game commands
2. Error message styling
3. Accessibility improvements (focus states, ARIA labels)
4. Status bar with game info

---

## Architecture: Frotz vs Browser-based

| Aspect | Frotz (Server) | ZVM/GlkOte (Browser) |
|--------|----------------|----------------------|
| **Reliability** | ✅ Proven | ❌ Generation counter issues |
| **Setup** | Requires dfrotz binary | Pure JavaScript |
| **Control** | Full text interception | Complex lifecycle |
| **Styling** | Easy - just HTML/CSS | GlkOte dictates structure |
| **Latency** | Network round-trip | Instant |
| **Offline** | ❌ Needs server | ✅ Could work offline |

**Decision:** Frotz wins on reliability. We can always revisit browser-based later.

---

## Files Modified This Session

- `public/index.html`
  - Added Google Fonts link (Crimson Pro, IBM Plex Mono)
  - Changed default input mode to Direct (unchecked toggle)
- `public/styles.css` - Complete styling overhaul
  - CSS custom properties (variables) for theming
  - Crimson Pro serif font for game text
  - IBM Plex Mono for commands
  - Refined dark color palette (charcoal + muted accents)
  - Comprehensive mobile responsive breakpoints (900px, 768px, 480px, landscape)
  - Touch-friendly button sizing
  - Active state for talk mode button

---

## Server Running

```bash
cd /e/Project/IFTalk && npm start
# Access at http://localhost:3003
```

**Note:** This `frotz` branch uses port 3003 for the server-side Frotz implementation.

---

## Git History

```
f8b5d5d WIP: ifvms-glkote flow with Parchment-compatible versions
41eff5b Update README with browser-based ZVM architecture
17f1d9e Replace Parchment with ifvms/ZVM + GlkOte
5d1850f Change default voices (THIS IS OUR FROTZ BASE)
12aa9d7 Initial commit: IFTalk voice-controlled IF player
```

Current branch: `frotz` (based on master, files from 5d1850f)
