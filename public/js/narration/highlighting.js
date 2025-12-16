/**
 * Text Highlighting Module
 *
 * Highlights currently spoken text using CSS Custom Highlight API.
 * Uses marker-based system for precise highlighting.
 */

import { state } from '../core/state.js';

/**
 * Highlight text using marker elements
 * Searches in status line, upper window, and main content elements
 * @param {number} chunkIndex - Index of chunk to highlight
 * @returns {boolean} True if successful
 */
export function highlightUsingMarkers(chunkIndex) {
  // Find markers in status bar, upper window, or main content (in that order)
  const containers = [
    window.currentStatusBarElement || document.getElementById('statusBar'),
    document.getElementById('upperWindow'),
    state.currentGameTextElement
  ];

  const startSelector = `.chunk-marker-start[data-chunk="${chunkIndex}"]`;
  const endSelector = `.chunk-marker-end[data-chunk="${chunkIndex}"]`;

  let startMarker, endMarker, containerEl;
  for (const container of containers) {
    if (!container) continue;
    startMarker = container.querySelector(startSelector);
    if (startMarker) {
      endMarker = container.querySelector(endSelector);
      containerEl = container;
      break;
    }
  }

  if (!startMarker) {
    return false;
  }

  console.log('[Highlight] Chunk', chunkIndex, 'in', containerEl?.id || containerEl?.className);

  try {
    // Create main range between markers (or to end of container if last chunk)
    const mainRange = new Range();
    mainRange.setStartAfter(startMarker);
    if (endMarker) {
      mainRange.setEndBefore(endMarker);
    } else {
      mainRange.setEndAfter(containerEl.lastChild);
    }

    // Use TreeWalker to create individual text node ranges (skips excessive whitespace)
    const textRanges = [];
    const walker = document.createTreeWalker(
      containerEl,  // Walk the specific container, not commonAncestor
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          // Only accept text nodes that are within our range
          if (mainRange.intersectsNode(node)) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_REJECT;
        }
      }
    );

    let textNode;
    while (textNode = walker.nextNode()) {
      const text = textNode.textContent;

      // Skip empty text nodes
      if (!text.trim()) {
        continue;
      }

      // Find content boundaries (exclude leading/trailing whitespace)
      // Solves: "                     A N C H O R H E A D" would highlight all leading spaces
      const startOffset = text.search(/\S/);  // First non-whitespace char
      const endOffset = text.length - (text.match(/\s*$/)?.[0].length || 0);

      // Create range covering only the content
      const range = new Range();
      range.setStart(textNode, startOffset);
      range.setEnd(textNode, endOffset);
      textRanges.push(range);

      if (console.log) {
        const content = text.substring(startOffset, endOffset);
        console.log('[Highlight]   Including:', JSON.stringify(content.substring(0, 50)));
      }
    }

    console.log(`[Highlight]   Created ${textRanges.length} text node ranges`);

    // Apply CSS Highlight API with multiple ranges
    if (CSS.highlights) {
      const highlight = new Highlight(...textRanges);
      CSS.highlights.set('speaking', highlight);
      console.log('[Highlight]   ✓ CSS Highlight set with', textRanges.length, 'ranges');
      return true;
    } else {
      console.warn('[Highlight]   ✗ CSS.highlights API not available');
      return false;
    }
  } catch (e) {
    console.error('[Highlight]   ✗ Exception:', e.message, e.stack);
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

  // Use marker-based highlighting (per design spec)
  const success = highlightUsingMarkers(chunkIndex);

  if (!success) {
    removeHighlight();
  }

  // Dispatch custom event for debugging/testing
  const event = new CustomEvent('chunkHighlighted', {
    detail: {
      chunkIndex,
      chunkText: state.narrationChunks[chunkIndex],
      totalChunks: state.narrationChunks.length,
      success
    }
  });
  window.dispatchEvent(event);
}
