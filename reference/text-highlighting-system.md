# Text Highlighting System - Temporary Marker Implementation

## Status: ✅ STABLE - All major bugs resolved

**Last Updated:** December 16, 2024 - Fixed upper window highlighting and whitespace issues

## Overview

The temporary marker system preserves original HTML formatting while enabling accurate TTS highlighting. It works by inserting temporary Unicode markers (`⚐N⚐`) at potential chunk boundaries, then determining which markers survive text processing to create the final chunk boundaries.

**Key Innovation:** The split regex was designed to preserve markers within chunks while splitting at the boundaries, solving the critical issue where markers were being removed during the split operation.

## Architecture Note

**Code has been modularized** (as of December 2024). The highlighting system is now split across multiple ES6 modules instead of a monolithic `app.js`:

- `public/js/narration/chunking.js` - Marker insertion and chunk creation
- `public/js/narration/highlighting.js` - CSS Highlight API integration
- `public/js/ui/game-output.js` - Lazy chunking and content rendering
- `public/js/utils/text-processing.js` - Text transformations and sentence splitting

---

## How It Works

### Step 1: Insert Temporary Markers in HTML

**Function:** `insertTemporaryMarkers(html)` in `chunking.js` (line 15)

Insert temporary markers (`⚐0⚐`, `⚐1⚐`, etc.) at ALL potential chunk boundaries:

1. **Paragraph breaks:** `⚐N⚐<br><br>` - Marker BEFORE `<br><br>`
   - `<br><br>` becomes `. ` during processing → creates sentence boundary

2. **Sentence endings:** `text.⚐N⚐` - Marker AFTER `.!?`
   - Only when followed by space/tag/end-of-string
   - Skips initials (H.P., U.S.) using negative lookbehind `/(?<![A-Z])/`

**Example:**
```
Original: "Hello.<br><br>World! How are you?"
Marked:   "Hello.⚐0⚐<br><br>World!⚐1⚐ How are you?⚐2⚐"
```

### Step 2: Process to Plain Text

**Function:** `createNarrationChunks(html)` in `chunking.js` (line 60)

1. Strip HTML tags (keep markers): `<br><br>` → `. `, `<br>` → ` `
2. Apply TTS processing: Collapse spaced capitals, normalize initials, title case
   - "A N C H O R H E A D" → "Anchorhead"
   - "H.P." → "HP"
3. Markers move with the text during transformations

**Example:**
```
After processing: "Hello.⚐0⚐. World!⚐1⚐ How are you?⚐2⚐"
```

### Step 3: Split into Chunks (Critical!)

**Function:** `splitIntoSentences(processedText)` in `text-processing.js` (line 48)

**Split regex:** `/(?<=⚐\d+⚐)\s+|(?<=[.!?])(?!⚐)\s+/`

This regex has TWO patterns:
1. `(?<=⚐\d+⚐)\s+` - Split AFTER marker+space (keeps marker in chunk)
2. `(?<=[.!?])(?!⚐)\s+` - Split after punctuation+space ONLY when NOT followed by marker

**Why this matters:**
- Pattern 1 ensures markers END UP IN THE CHUNKS (not consumed by split)
- Pattern 2 handles punctuation WITHOUT markers (e.g., mid-sentence periods that survived)
- Together: Markers stay attached to chunks, enabling extraction

**Example:**
```
Split: ["Hello.⚐0⚐.", "World!⚐1⚐", "How are you?⚐2⚐"]
       └─ marker 0   └─ marker 1   └─ marker 2
```

### Step 4: Extract Marker IDs from Chunks

Each chunk is parsed to extract its marker ID:
- Regex `/⚐(\d+)⚐/` finds marker at end of chunk
- Last chunk has no marker (expected behavior)
- Returns array: `[{text: "Hello.", markerID: 0, index: 0}, ...]`

**Example:**
```javascript
[
  {text: "Hello.", markerID: 0, index: 0},
  {text: "World!", markerID: 1, index: 1},
  {text: "How are you?", markerID: 2, index: 2}
]
```

### Step 5: Replace Temp Markers with DOM Elements

**Function:** `insertRealMarkersAtIDs(container, markerIDs)` in `chunking.js` (line 100)

For each surviving marker ID:
1. Find the `⚐N⚐` marker in the DOM (using TreeWalker on text nodes)
2. Replace with TWO invisible `<span>` elements:
   - `<span class="chunk-marker-end" data-chunk="N">` - Marks END of chunk N
   - `<span class="chunk-marker-start" data-chunk="N+1">` - Marks START of chunk N+1

**Special case:** Manually insert `<span class="chunk-marker-start" data-chunk="0">` at the very beginning (no temp marker exists there)

**Marker mapping:**
- Chunk 0: start[0] ... end[0], start[1]
- Chunk 1: end[1], start[2]
- Chunk 2: end[2], start[3]
- ...
- Chunk N (last): start[N] ... (no end marker)

### Step 6: Clean Up Temporary Markers

**Function:** `removeTemporaryMarkers(container, chunks)` in `chunking.js` (line 193)

- Walk all text nodes and remove any remaining `⚐N⚐` patterns
- Ensures clean DOM for display

### Step 7: Highlight During TTS

**Function:** `highlightUsingMarkers(chunkIndex)` in `highlighting.js` (line 16)

To highlight chunk N:
1. Query DOM: `.chunk-marker-start[data-chunk="${N}"]` and `.chunk-marker-end[data-chunk="${N}"]`
2. Create Range from `setStartAfter(startMarker)` to `setEndBefore(endMarker)`
3. Apply CSS Highlight API: `CSS.highlights.set('speaking', range)`
4. Last chunk: Highlight to end of container (no end marker exists)

---

## Key Insights

### 1. HTML structure ≠ Processed text structure

**Original HTML:**
```html
"-- H.P. Lovecraft</span><br><br>A N C H O R H E A D"
```

**After processing:**
```
"-- HP Lovecraft. Anchorhead."
```

Text transformations create/remove sentence boundaries. Markers must survive these transformations.

### 2. The Split Regex is Critical

**Problem:** Simple regex `/(?<=[.!?])\s+/` would split at "`.⚐7⚐ `" but REMOVE the marker (it's part of the delimiter).

**Solution:** `/(?<=⚐\d+⚐)\s+|(?<=[.!?])(?!⚐)\s+/` splits at the SPACE while keeping markers intact.

**Result:** "text.⚐7⚐ next" → ["text.⚐7⚐", "next"] ✓ (marker preserved)

### 3. Chunk Authority

- Chunk creation is the single source of truth
- Can't predict boundaries until after full text processing
- Only markers that survive processing create DOM boundaries

### 4. Marker Placement Strategy

- Punctuation: Marker AFTER (`.⚐N⚐`)
- Paragraph breaks: Marker BEFORE (`⚐N⚐<br><br>`)
- This ensures markers are adjacent to the text they should group with

### 5. Last Chunk Behavior

- Expected: No marker at end of final chunk
- Highlighting: Uses start marker + end of container

---

## Example Flow (Anchorhead Opening)

**Original HTML:**
```html
<span>The oldest and strongest emotion of mankind</span>
<span>is fear, and the oldest and strongest kind</span>
<span>of fear is fear of the unknown.</span><br/><br/>
<span>-- H.P. Lovecraft</span><br/><br/>
<span>A N C H O R H E A D</span>
```

**After insertTemporaryMarkers():**
```
14 delimiters found:
[0] <br><br> at "unknown.</span>⚐0⚐<br><br>"
[1] <br><br> at "Lovecraft</span>⚐1⚐<br><br>"
[2] <br><br> at "H E A D</span>⚐2⚐<br><br>"
[3] "." at "unknown.⚐3⚐</span>"
...
```

**After processing + split:**
```
7 chunks created:
Chunk 0: "November, 1997." (marker 0)
Chunk 1: "You take a deep breath...Anchorhead." (marker 1)
Chunk 2: "Squinting up...happen so fast. The strange phone call...life..." (marker 2)
Chunk 3: "Now suddenly here you are...starting to rain." (marker 3)
Chunk 4: "These days, you often find yourself feeling confused and uprooted." (marker 4)
Chunk 5: "You shake yourself...settling in." (marker 5)
Chunk 6: "A sullen belch...you open your umbrella." (marker 6)
```

**DOM structure:**
```html
<div class="game-text">
  <span class="chunk-marker-start" data-chunk="0"></span>
  November, 1997.
  <span class="chunk-marker-end" data-chunk="0"></span>
  <span class="chunk-marker-start" data-chunk="1"></span>
  <br><br>
  You take a deep breath...
  <span class="chunk-marker-end" data-chunk="1"></span>
  <span class="chunk-marker-start" data-chunk="2"></span>
  ...
</div>
```

---

## Files Modified

**Modularized Architecture (December 2024):**

**`public/js/narration/chunking.js`:**
- `insertTemporaryMarkers(html)` line 15 - Inserts `⚐N⚐` at boundaries
- `createNarrationChunks(html)` line 60 - Extracts marker IDs from processed chunks
- `insertRealMarkersAtIDs(container, markerIDs)` line 100 - Replaces temp markers with DOM spans
- `removeTemporaryMarkers(container, chunks)` line 193 - Cleans up remaining temp markers

**`public/js/narration/highlighting.js`:**
- `highlightUsingMarkers(chunkIndex)` line 16 - Queries markers and highlights
- `removeHighlight()` line 129 - Clears CSS highlights
- `updateTextHighlight(chunkIndex)` line 141 - Updates highlight for specific chunk

**`public/js/ui/game-output.js`:**
- `ensureChunksReady()` line 19 - **NEW:** Lazy chunking system
- `addGameText(text, isCommand, isVoiceCommand)` line 121 - Renders game output

**`public/js/utils/text-processing.js`:**
- `splitIntoSentences(processedText)` line 48 - **Critical:** Split regex preserves markers
- `processTextForTTS(text)` line 23 - Normalizes text for speech synthesis

---

## New Features (December 2024)

### Lazy Chunking System

**Function:** `ensureChunksReady()` in `game-output.js` (line 19)

The system now uses **lazy evaluation** for chunk creation:

1. **When text is added:** `addGameText()` just renders HTML, doesn't create chunks
2. **When narration starts:** `ensureChunksReady()` creates chunks on-demand
3. **Benefits:**
   - Faster rendering (no upfront chunking cost)
   - Only chunk when actually needed
   - Reduces wasted computation for non-narrated text

**Validation flag:** `state.chunksValid` tracks whether chunks need regeneration

### Status Line + Main Content Handling

The system now processes **both status line and main game text**:

1. **Status line chunks come first** (indices 0, 1, 2...)
2. **Main content chunks follow** (indices N, N+1, N+2...)
3. **Chunk offset logic:** Main content marker IDs are adjusted by status line chunk count
   - Example: If status has 4 chunks, main content markers `⚐0⚐`, `⚐1⚐` become `⚐4⚐`, `⚐5⚐`
4. **Start markers inserted at beginning of BOTH containers** for proper highlighting

**Key function:** Lines 44-104 in `game-output.js` handle the two-container chunking flow

---

## Bug Fixes History

### Fix #1 - Marker Selector Logic (2025-12-14)

**Problem:** Highlighting function was using wrong selectors for System 1 markers.

**Solution:** Updated `highlightUsingMarkers()` to use correct selectors:
- Both start and end markers for chunk N have `data-chunk="N"`
- Start: `.chunk-marker-start[data-chunk="${chunkIndex}"]`
- End: `.chunk-marker-end[data-chunk="${chunkIndex}"]`

### Fix #2 - ReferenceError Bug (2025-12-14)

**Problem:** Referenced undefined variable `currentNarrationChunks`

**Solution:** Changed to correct variable `narrationChunks` (global state)

### Fix #3 - Split Regex Consuming Markers (2025-12-15) 🔥 CRITICAL

**Problem:** Original regex `/(?<=[.!?])(?:⚐\d+⚐)?\s+/` was REMOVING markers during split:
- Text: "Hello.⚐7⚐ World"
- Split consumed: ".⚐7⚐ " (entire delimiter removed)
- Result: ["Hello", "World"] ❌ marker lost!

**Solution:** New regex `/(?<=⚐\d+⚐)\s+|(?<=[.!?])(?!⚐)\s+/` splits AFTER markers:
- Pattern 1: `(?<=⚐\d+⚐)\s+` - Split after marker (keeps it in chunk)
- Pattern 2: `(?<=[.!?])(?!⚐)\s+` - Split after punct only when no marker follows
- Result: ["Hello.⚐7⚐", "World"] ✓ marker preserved!

This fix was the breakthrough that made the entire system work.

---

## Working Console Output

```
[Markers] Found 14 delimiters
[Markers] Inserted 14 temporary markers before delimiters
[TTS] Split into 7 chunks
[Markers] Chunk 0: marker 0
[Markers]   Raw: "November, 1997.⚐0⚐."
[Markers]   Clean: "November, 1997."
[TTS] Created 7 chunks for narration
[Markers] Inserting real markers for IDs: [0, 1, 2, 3, 4, 5, 6]
[Markers] Inserted real markers for ID 6 (chunk 6)
...
[Markers] Inserted start marker for chunk 0 at beginning
[Highlight] Looking for chunk 0: start=".chunk-marker-start[data-chunk="0"]", end=".chunk-marker-end[data-chunk="0"]"
[Highlight] Found: startMarker=true, endMarker=true
[Highlight] Applied highlight for chunk 0 (start: 0, end: 0)
```

---

## Browser Compatibility

**Required APIs:**
- **Lookbehind regex** (`(?<=pattern)`): Chrome 62+, Firefox 78+, Safari 16.4+
- **CSS Highlight API** (`CSS.highlights`): Chrome 105+, Safari 17.2+, ❌ Firefox not supported

**Graceful Degradation:**
- If CSS Highlights unavailable: Highlighting disabled, TTS still works
- If regex fails: Fallback to text search highlighting (less reliable)

---

## Performance Considerations

- **One-time cost:** Marker insertion + DOM manipulation happens once per text block
- **TreeWalker efficiency:** Fast even with complex HTML structures
- **Regex complexity:** Lookbehind has minimal performance impact in modern browsers
- **Memory:** Temporary markers cleaned up, no leaks

---

## Recent Bug Fixes (December 16, 2024)

### Fix #4 - Upper Window Highlighting Missing 🔥 CRITICAL

**Problem:** Chunks in the upper window (like Anchorhead's Lovecraft quote) were not being highlighted.

**Root Cause:** The `highlightUsingMarkers()` function only searched two containers:
- Status bar (`statusEl`)
- Main game text (`mainEl`)

But missed the upper window (`#upperWindow`), which is used for quotes, formatted text, and ASCII art in many IF games.

**Solution:** Updated `highlighting.js` (line 16) to search three containers in order:
1. Status bar first
2. **Upper window second** (NEW)
3. Main content third

```javascript
const upperEl = document.getElementById('upperWindow');

// Try to find markers in status line first
let startMarker = statusEl ? statusEl.querySelector(startSelector) : null;
// ...

// If not in status, try upper window
if (!startMarker && upperEl) {
  startMarker = upperEl.querySelector(startSelector);
  endMarker = upperEl.querySelector(endSelector);
  containerEl = upperEl;
}

// If not in upper window, try main content
if (!startMarker && mainEl) {
  // ...
}
```

**Result:** ✅ Upper window chunks now highlight correctly

---

### Fix #5 - Leading/Trailing Whitespace in Highlights 🔥 CRITICAL

**Problem:** When highlighting text with leading whitespace (like `"                     A N C H O R H E A D"`), the system was highlighting all the leading spaces, creating large whitespace gaps in the visual highlighting.

**Root Cause:** Our HTML structure differs from other IF interpreters (like Parchment):
- **Our HTML:** Single text node with whitespace + content: `<span>                     A N C H O R H E A D</span>`
- **Parchment HTML:** Separate spans for whitespace and content: `<span>                     </span><span>A </span><span>N </span>...`

When using `selectNodeContents(textNode)` or a single Range for the entire chunk, we selected the ENTIRE text node including all leading/trailing whitespace.

**The Problem with Earlier Approaches:**

1. **Single Range approach** - Highlighted everything including whitespace
2. **TreeWalker with node filtering** - Skipped whitespace-only nodes, but nodes with content+whitespace still highlighted the whitespace

**The Solution: Character-Offset Ranges**

Use TreeWalker to walk text nodes, but create ranges with **character offsets** that exclude leading/trailing whitespace:

```javascript
// Walk text nodes in the chunk range
while (textNode = walker.nextNode()) {
  const text = textNode.textContent;

  // Skip empty nodes
  if (!text.trim()) continue;

  // Find content boundaries (exclude leading/trailing whitespace)
  const startOffset = text.search(/\S/);  // First non-whitespace char
  const endOffset = text.length - (text.match(/\s*$/)?.[0].length || 0);

  // Create range covering ONLY the content
  const range = new Range();
  range.setStart(textNode, startOffset);
  range.setEnd(textNode, endOffset);
  textRanges.push(range);
}

const highlight = new Highlight(...textRanges);
CSS.highlights.set('speaking', highlight);
```

**Why this works:**
1. ✅ Handles nodes with mixed whitespace + content (e.g., `"     ANCHORHEAD"`)
2. ✅ Uses character offsets within text nodes, not full node selection
3. ✅ Each range precisely covers only the visible content
4. ✅ No need to restructure HTML like Parchment does
5. ✅ Works with CSS Highlight API's multiple-range support

**Code Improvements (December 16, 2024):**
- Simplified container search with loop instead of repetitive if/else
- Cleaner variable names and reduced redundancy
- More concise comments explaining "why" not "what"

**Result:** ✅ Text highlights cleanly without any whitespace gaps, even with heavily indented ASCII art

---

## Known Issues (December 2024)

**Status:** ✅ **RESOLVED** - All major highlighting bugs fixed as of December 16, 2024

Previous issues with upper window highlighting and whitespace highlighting have been resolved. The system now works reliably across all container types (status bar, upper window, main content).

---

## Future Improvements

1. **Remove debug logging** - Clean up console.log statements once stable
2. **Error boundary** - Add try-catch around marker insertion for robustness
3. **Fallback for Firefox** - Detect CSS Highlights support, show graceful message
4. **Validation tests** - Add automated tests for chunking and highlighting edge cases
5. **Performance optimization** - Consider caching marker lookups if needed

---

## Summary

The temporary marker system successfully solves the highlighting problem by:
1. ✅ Preserving ALL original HTML formatting
2. ✅ Surviving text processing transformations
3. ✅ Enabling precise chunk boundary detection
4. ✅ Creating reliable DOM anchors for highlighting
5. ✅ Working correctly for complex game text (ellipsis, initials, paragraphs)
6. ✅ Modular architecture with lazy chunking
7. ✅ Multi-container support (status bar, upper window, main content)
8. ✅ Simple Range-based highlighting that works with CSS Highlight API
9. ✅ **STABLE:** All major highlighting bugs resolved (December 16, 2024)

**Key breakthroughs:**
1. **Split regex design** - Keeps markers within chunks instead of removing them during split
2. **Character-offset ranges** - Use `setStart/setEnd` with offsets to exclude leading/trailing whitespace
3. **Three-container search** - Status bar → Upper window → Main content ensures all chunks are found

**Architecture evolution:** The system has been refactored from a monolithic `app.js` into focused ES6 modules, improving maintainability and enabling new features like lazy chunking.

**Current status:** System is working reliably across all IF game types tested (Anchorhead, Photopia, Lost Pig, Dungeon).
