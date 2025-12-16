/**
 * Text Chunking Module
 *
 * Splits game text into narration chunks (sentences) and manages temporary markers.
 */

import { processAndSplitText } from '../utils/text-processing.js';

/**
 * Insert temporary markers (⚐N⚐) BEFORE EVERY delimiter in HTML
 * These markers help track where sentence boundaries should be
 * @param {string} html - HTML content
 * @returns {string} HTML with temporary markers inserted
 */
export function insertTemporaryMarkers(html) {
  if (!html) return html;

  let markerCount = 0;
  let markedHTML = html;

  // Normalize ellipses (...) to a single ellipsis character
  markedHTML = markedHTML.replace(/\.{3,}/g, '…');

  // Mark paragraph breaks (<br><br>)
  markedHTML = markedHTML.replace(/<br\s*\/?>\s*<br\s*\/?>/gi, (match) => {
    return `⚐${markerCount++}⚐${match}`;
  });

  // Mark single <br> after sentences
  markedHTML = markedHTML.replace(/([.!?])\s*<br\s*\/?>/gi, (match, punct) => {
    return `${punct}⚐${markerCount++}⚐${match.substring(punct.length)}`;
  });

  // Mark regular punctuation (skip initials like H.P.)
  markedHTML = markedHTML.replace(/(?<![A-Z.])([.!?…])(?=\s|<|$)/g, (match, punct) => {
    return `${punct}⚐${markerCount++}⚐`;
  });

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
    .replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '. ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<span class="soft-break"><\/span>/gi, ' ');
  tempDiv.innerHTML = htmlForText;
  const plainText = (tempDiv.textContent || tempDiv.innerText || '').trim();

  // Process text for TTS and split into sentences (combined operation)
  // Markers move with the text during processing
  const sentences = processAndSplitText(plainText);

  // Extract marker ID from end of each chunk
  const markerRegex = /⚐(\d+)⚐/;
  const chunks = sentences.map((sentence, index) => {
    const match = sentence.match(markerRegex);
    const markerID = match ? parseInt(match[1]) : null;
    const cleanText = sentence.replace(/⚐\d+⚐/g, '').trim();

    return {
      text: cleanText,
      markerID: markerID,
      index
    };
  });

  return chunks;
}

/**
 * Insert real <span> markers at positions marked by temp markers
 * @param {HTMLElement} container - Container element
 * @param {number[]} markerIDs - Array of marker IDs that survived chunking
 * @param {number} chunkOffset - Offset to add to chunk indices (for multi-container scenarios)
 */
export function insertRealMarkersAtIDs(container, markerIDs, chunkOffset = 0) {
  if (!markerIDs || markerIDs.length === 0) return;

  // Walk through all text nodes to find temporary markers
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  const nodesToProcess = [];
  let node;
  while (node = walker.nextNode()) {
    nodesToProcess.push(node);
  }

  // Process in reverse to avoid position shifts
  for (let i = nodesToProcess.length - 1; i >= 0; i--) {
    let textNode = nodesToProcess[i];
    let text = textNode.textContent;

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
      const finalChunkIndex = chunkOffset + chunkIndex;

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
        endMarker.dataset.chunk = finalChunkIndex;
        endMarker.style.cssText = 'display: none; position: absolute;';

        const startMarker = document.createElement('span');
        startMarker.className = 'chunk-marker-start';
        startMarker.dataset.chunk = finalChunkIndex + 1;
        startMarker.style.cssText = 'display: none; position: absolute;';

        // Replace text node with: before + endMarker + startMarker + after
        const parent = textNode.parentNode;
        if (!parent) continue;

        parent.insertBefore(beforeNode, textNode);
        parent.insertBefore(endMarker, textNode);
        parent.insertBefore(startMarker, textNode);
        parent.insertBefore(afterNode, textNode);
        parent.removeChild(textNode);

        // Update textNode for next iteration - use beforeNode because remaining markers are before this one
        textNode = beforeNode;
        text = beforeNode.textContent;

      } catch (e) {
        console.error('[Markers] Failed to insert marker:', e.message);
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
  const markerRegex = /⚐\d+⚐/g;

  // Remove from DOM text nodes (process inline)
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  let node;
  while (node = walker.nextNode()) {
    if (markerRegex.test(node.textContent)) {
      node.textContent = node.textContent.replace(markerRegex, '');
      markerRegex.lastIndex = 0;  // Reset regex for next test
    }
  }

  // Remove from chunks array (in place)
  for (let i = 0; i < chunks.length; i++) {
    chunks[i] = chunks[i].replace(markerRegex, '');
  }
}
