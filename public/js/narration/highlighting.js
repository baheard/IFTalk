/**
 * Text Highlighting Module
 *
 * Highlights currently spoken text using CSS Custom Highlight API.
 * Uses marker-based system for precise highlighting.
 */

import { state } from '../core/state.js';

/**
 * Highlight text using marker elements
 * @param {number} chunkIndex - Index of chunk to highlight
 * @returns {boolean} True if successful
 */
export function highlightUsingMarkers(chunkIndex) {
  // Remove previous highlight
  removeHighlight();

  // Make sure we have a current game text element to search within
  if (!state.currentGameTextElement) {
    console.warn(`[Highlight] No currentGameTextElement - cannot highlight`);
    return false;
  }

  // System 1 markers: chunk-marker-start and chunk-marker-end
  // Both have data-chunk="${chunkIndex}" for the same chunk
  const startSelector = `.chunk-marker-start[data-chunk="${chunkIndex}"]`;
  const endSelector = `.chunk-marker-end[data-chunk="${chunkIndex}"]`;

  console.log(`[Highlight] Looking for chunk ${chunkIndex}: start="${startSelector}", end="${endSelector}"`);

  const startMarker = state.currentGameTextElement.querySelector(startSelector);
  const endMarker = state.currentGameTextElement.querySelector(endSelector);

  console.log(`[Highlight] Found: startMarker=${!!startMarker}, endMarker=${!!endMarker}`);

  if (!startMarker) {
    console.warn(`[Highlight] No start marker found for chunk ${chunkIndex}`);
    // Debug: Show what markers exist
    const allMarkers = state.currentGameTextElement.querySelectorAll('.chunk-marker-start, .chunk-marker-end');
    console.log(`[Highlight] Available markers:`, Array.from(allMarkers).map(m => `${m.className}[${m.dataset.chunk}]`));
    return false;
  }

  // For the last chunk, there's no end marker - highlight to end of container
  if (!endMarker && chunkIndex < state.narrationChunks.length - 1) {
    console.warn(`[Highlight] No end marker found for chunk ${chunkIndex} (expected)`);
    return false;
  }

  try {
    // Create range between markers
    const range = new Range();
    range.setStartAfter(startMarker);

    if (endMarker) {
      range.setEndBefore(endMarker);
    } else {
      // Last chunk: highlight to end of the current game text element
      if (state.currentGameTextElement && state.currentGameTextElement.lastChild) {
        range.setEndAfter(state.currentGameTextElement.lastChild);
      }
    }

    // Apply CSS Highlight API
    if (CSS.highlights) {
      const highlight = new Highlight(range);
      CSS.highlights.set('speaking', highlight);
      console.log(`[Highlight] Applied highlight for chunk ${chunkIndex}`);
    }

    return true;
  } catch (e) {
    console.warn(`[Highlight] Failed to highlight chunk ${chunkIndex}:`, e);
    return false;
  }
}

/**
 * Remove highlight when done
 */
export function removeHighlight() {
  if (CSS.highlights) {
    CSS.highlights.delete('speaking');
  }
}

/**
 * Update text highlighting for a specific chunk
 * @param {number} chunkIndex - Chunk index to highlight
 */
export function updateTextHighlight(chunkIndex) {
  if (state.narrationChunks.length === 0 || chunkIndex < 0 || chunkIndex >= state.narrationChunks.length) {
    removeHighlight();
    return;
  }

  // Try marker-based highlighting
  const success = highlightUsingMarkers(chunkIndex);

  if (!success) {
    console.log('[Highlight] Markers failed, text highlighting not available');
    removeHighlight();
  }
}
