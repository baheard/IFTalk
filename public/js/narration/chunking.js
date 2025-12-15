/**
 * Text Chunking Module
 *
 * Splits game text into narration chunks (sentences) and manages temporary markers.
 */

import { processTextForTTS, splitIntoSentences } from '../utils/text-processing.js';

/**
 * Insert temporary markers (⚐N⚐) BEFORE EVERY delimiter in HTML
 * These markers help track where sentence boundaries should be
 * @param {string} html - HTML content
 * @returns {string} HTML with temporary markers inserted
 */
export function insertTemporaryMarkers(html) {
  if (!html) return html;

  console.log('[Markers] Original HTML length:', html.length);

  let markerCount = 0;
  let markedHTML = html;

  // First, mark paragraph breaks (<br><br>) since they become ". " during processing
  markedHTML = markedHTML.replace(/<br\s*\/?>\s*<br\s*\/?>/gi, (match) => {
    const marker = `⚐${markerCount}⚐`;
    markerCount++;
    return marker + match;  // Marker BEFORE <br><br>
  });

  // Then, mark regular punctuation followed by space/tag/end
  // BUT skip periods that are part of single-letter initials (H.P., U.S., etc.)
  // Use negative lookbehind to exclude periods preceded by uppercase letters
  markedHTML = markedHTML.replace(/(?<![A-Z])([.!?])(?=\s|<|$)/g, (match, punct) => {
    const marker = `⚐${markerCount}⚐`;
    markerCount++;
    return punct + marker;  // Marker AFTER punctuation
  });

  console.log('[Markers] Inserted', markerCount, 'temporary markers');
  return markedHTML;
}

/**
 * Create narration chunks from HTML with temporary markers
 * Returns array of {text, markerID, index} for each chunk
 * @param {string} html - HTML with temporary markers
 * @returns {Array<{text: string, markerID: number|null, index: number}>} Chunks
 */
export function createNarrationChunks(html) {
  if (!html) return [];

  // Process HTML to plain text (keeps ⚐N⚐ markers)
  const tempDiv = document.createElement('div');
  let htmlForText = html
    .replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '. ')  // Paragraph breaks -> sentence break
    .replace(/<br\s*\/?>/gi, ' ')                 // Single line breaks -> space
    .replace(/<span class="soft-break"><\/span>/gi, ' ');  // Soft breaks -> space
  tempDiv.innerHTML = htmlForText;
  const plainText = (tempDiv.textContent || tempDiv.innerText || '').trim();

  // Process text for TTS (markers move with the text during processing)
  const processedText = processTextForTTS(plainText);

  // Split into sentences
  const sentences = splitIntoSentences(processedText);

  console.log('[TTS] Split into', sentences.length, 'chunks');

  // Extract marker ID from end of each chunk
  const markerRegex = /⚐(\d+)⚐/;
  return sentences.map((sentence, index) => {
    const match = sentence.match(markerRegex);
    const markerID = match ? parseInt(match[1]) : null;

    // Remove marker from text for TTS playback
    const cleanText = sentence.replace(/⚐\d+⚐/g, '').trim();

    console.log(`[Markers] Chunk ${index}: marker ${markerID !== null ? markerID : 'none (last chunk)'}`);
    console.log(`[Markers]   Clean: "${cleanText.substring(0, 80)}..."`);

    return {
      text: cleanText,       // For TTS playback
      markerID: markerID,    // For inserting DOM markers
      index
    };
  });
}

/**
 * Insert real <span> markers at positions marked by temp markers
 * @param {HTMLElement} container - Container element
 * @param {number[]} markerIDs - Array of marker IDs that survived chunking
 */
export function insertRealMarkersAtIDs(container, markerIDs) {
  if (!markerIDs || markerIDs.length === 0) {
    console.log('[Markers] No marker IDs to insert');
    return;
  }

  console.log('[Markers] Inserting real markers for IDs:', markerIDs);

  // Walk through all text nodes to find temporary markers
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    null
  );

  const nodesToProcess = [];
  let node;
  while (node = walker.nextNode()) {
    nodesToProcess.push(node);
  }

  // Process in reverse to avoid position shifts
  for (let i = nodesToProcess.length - 1; i >= 0; i--) {
    const textNode = nodesToProcess[i];
    const text = textNode.textContent;

    // Find all markers in this text node
    const markerRegex = /⚐(\d+)⚐/g;
    const matches = [];
    let match;

    while ((match = markerRegex.exec(text)) !== null) {
      const markerID = parseInt(match[1]);
      if (markerIDs.includes(markerID)) {
        matches.push({
          id: markerID,
          index: match.index,
          length: match[0].length
        });
      }
    }

    // Insert real markers in reverse order (to preserve positions)
    for (let j = matches.length - 1; j >= 0; j--) {
      const markerMatch = matches[j];
      const chunkIndex = markerIDs.indexOf(markerMatch.id);

      try {
        // Split text node at marker position
        const beforeText = text.substring(0, markerMatch.index);
        const afterText = text.substring(markerMatch.index + markerMatch.length);

        // Create new text nodes
        const beforeNode = document.createTextNode(beforeText);
        const afterNode = document.createTextNode(afterText);

        // Create real marker spans
        const endMarker = document.createElement('span');
        endMarker.className = 'chunk-marker-end';
        endMarker.dataset.chunk = chunkIndex;
        endMarker.style.cssText = 'display: none; position: absolute;';

        const startMarker = document.createElement('span');
        startMarker.className = 'chunk-marker-start';
        startMarker.dataset.chunk = chunkIndex + 1;
        startMarker.style.cssText = 'display: none; position: absolute;';

        // Replace text node with: before + endMarker + startMarker + after
        const parent = textNode.parentNode;
        if (!parent) {
          console.warn(`[Markers] Skipping ID ${markerMatch.id}: text node has no parent`);
          continue;
        }
        parent.insertBefore(beforeNode, textNode);
        parent.insertBefore(endMarker, textNode);
        parent.insertBefore(startMarker, textNode);
        parent.insertBefore(afterNode, textNode);
        parent.removeChild(textNode);

        console.log(`[Markers] Inserted real markers for ID ${markerMatch.id} (chunk ${chunkIndex})`);
      } catch (e) {
        console.warn(`[Markers] Failed to insert markers for ID ${markerMatch.id}:`, e);
      }
    }
  }
}

/**
 * Remove all temporary markers (⚐N⚐) from DOM and text array
 * @param {HTMLElement} container - Container element
 * @param {string[]} chunks - Array of chunk texts to clean
 */
export function removeTemporaryMarkers(container, chunks) {
  // Remove from DOM
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    null
  );

  const nodesToClean = [];
  let node;
  while (node = walker.nextNode()) {
    if (/⚐\d+⚐/.test(node.textContent)) {
      nodesToClean.push(node);
    }
  }

  nodesToClean.forEach(textNode => {
    textNode.textContent = textNode.textContent.replace(/⚐\d+⚐/g, '');
  });

  // Remove from chunks array (modify in place)
  for (let i = 0; i < chunks.length; i++) {
    chunks[i] = chunks[i].replace(/⚐\d+⚐/g, '');
  }

  console.log('[Markers] Removed all temporary markers');
}
