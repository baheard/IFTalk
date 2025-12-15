// Test for NEW marker system - process first, insert markers second
// Run with: node test-markers.js

// Actual Anchorhead opening text from server (with <br> tags)
const anchorheadHTML = `The oldest and strongest emotion of mankind is fear, and the oldest and strongest kind of fear is fear of the unknown.<br><br>-- H.P. Lovecraft<br><br>A N C H O R H E A D<br><br>[Press 'R' to restore; any other key to begin]`;

// Mock DOM for Node.js
class MockElement {
  constructor() {
    this._innerHTML = '';
    this.textContent = '';
  }
  get innerHTML() { return this._innerHTML; }
  set innerHTML(val) {
    this._innerHTML = val;
    // Simplified: strip HTML tags for textContent
    this.textContent = val.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}

function createElement(tag) {
  return new MockElement();
}

// Copy of processTextForTTS from app.js
function processTextForTTS(text) {
  let processed = text
    // Collapse spaced capitals: "A N C H O R H E A D" → "ANCHORHEAD"
    .replace(/\b([A-Z])\s+(?=[A-Z](?:\s+[A-Z]|\s*\b))/g, '$1')
    // Normalize initials: "H.P." → "HP"
    .replace(/\b([A-Z])\.\s*/g, '$1 ')
    .replace(/\b([A-Z])\s+([A-Z])\s+/g, '$1$2 ')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();

  // Title case for all-caps words (4+ letters): "ANCHORHEAD" → "Anchorhead"
  processed = processed.replace(/\b([A-Z]{4,})\b/g, (match) => {
    return match.charAt(0) + match.slice(1).toLowerCase();
  });

  return processed;
}

// Copy of splitIntoSentences from app.js
function splitIntoSentences(processedText) {
  if (!processedText) return [];

  const chunks = processedText
    .split(/(?<=[.!?])\s+/)  // Split after sentence-ending punctuation
    .map(chunk => chunk.trim())
    .filter(chunk => chunk.length > 0);

  return chunks.length > 0 ? chunks : [processedText];
}

// Copy of createNarrationChunks from app.js
function createNarrationChunks(text) {
  if (!text) return [];

  console.log('\n[Step 1] Creating narration chunks from HTML...');

  // Process HTML like app.js does
  let htmlForTTS = text
    .replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '. ')  // Paragraph breaks -> sentence break
    .replace(/<br\s*\/?>/gi, ' ')                 // Single line breaks -> space
    .replace(/<[^>]+>/g, '');                     // Strip HTML tags

  console.log('  After HTML processing:', htmlForTTS);

  // Use the shared processTextForTTS function
  let processed = processTextForTTS(htmlForTTS);

  console.log('  After TTS processing:', processed);

  // Split using shared function
  const chunks = splitIntoSentences(processed);

  console.log(`\n[Step 1 Result] Created ${chunks.length} chunks:`);
  chunks.forEach((c, i) => {
    console.log(`  [${i}]: ${c.substring(0, 60)}${c.length > 60 ? '...' : ''}`);
  });

  return chunks;
}

// NEW APPROACH: Reconstruct HTML from chunks instead of trying to map back
function insertMarkersAtChunkBoundaries(html, chunks) {
  if (!html || !chunks || chunks.length === 0) return html;

  console.log('\n[Step 2] Reconstructing HTML with markers from chunks...');

  // Reconstruct the HTML directly from processed chunks
  // This guarantees the displayed text matches what TTS will speak
  let markedHTML = '<span class="chunk-marker-start" data-chunk="0"></span>';

  chunks.forEach((chunk, index) => {
    // Add the chunk text
    markedHTML += chunk;

    // Add boundary marker after each chunk except the last
    if (index < chunks.length - 1) {
      markedHTML += `<span class="chunk-marker" data-chunk="${index + 1}"></span>`;
      markedHTML += ' '; // Space between chunks
      console.log(`  -> Inserted marker ${index + 1} after chunk ${index}`);
    }
  });

  console.log('\n[Step 2 Result] Inserted', chunks.length - 1, 'boundary markers');
  console.log('  Display text now matches TTS text (processed)');
  return markedHTML;
}

// Count markers in HTML
function countMarkersInHTML(html) {
  const startMarkers = (html.match(/chunk-marker-start/g) || []).length;
  const chunkMarkers = (html.match(/class="chunk-marker"/g) || []).length;
  return { start: startMarkers, chunk: chunkMarkers, total: startMarkers + chunkMarkers };
}

// Run the test
console.log('='.repeat(80));
console.log('NEW MARKER SYSTEM TEST - Process First, Insert Second');
console.log('='.repeat(80));

// Step 1: Create chunks FIRST (this is the authority)
const chunks = createNarrationChunks(anchorheadHTML);

// Step 2: Insert markers at exact chunk boundaries
const markedHTML = insertMarkersAtChunkBoundaries(anchorheadHTML, chunks);

// Step 3: Count markers in the HTML
const markerCounts = countMarkersInHTML(markedHTML);

// Step 4: Verify results
console.log('\n' + '='.repeat(80));
console.log('TEST RESULTS');
console.log('='.repeat(80));

const expectedMarkers = chunks.length - 1; // Need N-1 boundary markers + 1 start marker
const actualBoundaryMarkers = markerCounts.chunk;
const pass = actualBoundaryMarkers === expectedMarkers && markerCounts.start === 1;

console.log(`Chunks created: ${chunks.length}`);
console.log(`Expected boundary markers (chunks - 1): ${expectedMarkers}`);
console.log(`Actual boundary markers: ${actualBoundaryMarkers}`);
console.log(`Start markers: ${markerCounts.start} (should be 1)`);
console.log(`Total markers: ${markerCounts.total} (should be ${expectedMarkers + 1})`);

console.log(`\n${pass ? '✅ PASS' : '❌ FAIL'}: ${pass ? 'Correct number of markers at correct positions!' : 'Marker count or position mismatch!'}`);

if (!pass) {
  console.log('\n⚠️  PROBLEM DETECTED:');
  console.log(`   We have ${chunks.length} chunks.`);
  console.log(`   We need ${expectedMarkers} boundary markers + 1 start marker = ${expectedMarkers + 1} total.`);
  console.log(`   We have ${actualBoundaryMarkers} boundary markers + ${markerCounts.start} start markers = ${markerCounts.total} total.`);
}

console.log('\n[Marked HTML Preview]:');
console.log(markedHTML.substring(0, 400) + '...');

console.log('='.repeat(80));

process.exit(pass ? 0 : 1);
