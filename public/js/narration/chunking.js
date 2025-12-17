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

  // Mark titles wrapped in asterisks (* TITLE *)
  markedHTML = markedHTML.replace(/(\*\s*[^*]+\s*\*)/g, (match) => {
    return `⚐${markerCount++}⚐${match}⚐${markerCount++}⚐`;
  });

  // Mark all-caps titles followed by line breaks (e.g., "THE FIRST DAY<br>")
  markedHTML = markedHTML.replace(/([A-Z][A-Z\s,.'"-]{7,}?)<br\s*\/?>/g, (match, title) => {
    // Verify it's actually mostly uppercase (not just starting with a cap)
    const alphaOnly = title.replace(/[^A-Za-z]/g, '');
    if (alphaOnly.length >= 5 && alphaOnly === alphaOnly.toUpperCase()) {
      return `⚐${markerCount++}⚐${title}⚐${markerCount++}⚐<br>`;
    }
    return match;
  });

  // Mark ALL line breaks - both <br> tags and </div> tags create chunk boundaries
  // GlkOte uses <div> wrappers instead of <br> tags
  // This creates chunks at every line break, making narration more granular

  // Mark <br> tags (if present)
  markedHTML = markedHTML.replace(/<br\s*\/?>/gi, (match) => {
    return `⚐${markerCount++}⚐${match}`;
  });

  // Mark </div> tags (GlkOte line breaks)
  markedHTML = markedHTML.replace(/<\/div>/gi, (match) => {
    return `⚐${markerCount++}⚐${match}`;
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

  // Mark app voice spans before converting to plain text
  // Add ⚑APP⚑ markers around text that should use app voice
  let markedHTML = html.replace(/<span([^>]*data-voice="app"[^>]*)>(.*?)<\/span>/gi, (match, attrs, content) => {
    return `⚑APP⚑${content}⚑APP⚑`;
  });

  // Process HTML to plain text (keeps ⚐N⚐ markers and ⚑APP⚑ markers)
  const tempDiv = document.createElement('div');
  let htmlForText = markedHTML
    // Replace paragraph breaks with period+space
    .replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '. ')
    // Replace single <br> with space
    .replace(/<br\s*\/?>/gi, ' ')
    // Replace </div> with space (GlkOte uses div wrappers for lines)
    .replace(/<\/div>/gi, ' ')
    .replace(/<span class="soft-break"><\/span>/gi, ' ');
  tempDiv.innerHTML = htmlForText;
  const plainText = (tempDiv.textContent || tempDiv.innerText || '').trim();

  // Process text for TTS and split into sentences (combined operation)
  // Markers move with the text during processing
  const sentences = processAndSplitText(plainText);

  // Extract marker ID and voice type from each chunk
  const markerRegex = /⚐(\d+)⚐/;
  const appVoiceRegex = /⚑APP⚑/;
  const chunks = sentences
    .map((sentence, index) => {
      const match = sentence.match(markerRegex);
      const markerID = match ? parseInt(match[1]) : null;
      const useAppVoice = appVoiceRegex.test(sentence);
      const cleanText = sentence.replace(/⚐\d+⚐/g, '').replace(/⚑APP⚑/g, '').trim();

      return {
        text: cleanText,
        markerID: markerID,
        index,
        voice: useAppVoice ? 'app' : 'narrator'
      };
    })
    // Filter out app voice chunks - user commands are displayed but never narrated
    .filter(chunk => chunk.voice !== 'app');

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
 * Remove all temporary markers (⚐N⚐ and ⚑APP⚑) from DOM and text array
 * @param {HTMLElement} container - Container element
 * @param {Array} chunks - Array of chunk objects or strings to clean
 */
export function removeTemporaryMarkers(container, chunks) {
  const markerRegex = /⚐\d+⚐|⚑APP⚑/g;

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
    if (typeof chunks[i] === 'string') {
      chunks[i] = chunks[i].replace(markerRegex, '');
    } else if (chunks[i]?.text) {
      chunks[i].text = chunks[i].text.replace(markerRegex, '');
    }
  }
}
