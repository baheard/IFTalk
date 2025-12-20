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

  try {
    // Create main range between markers (or to end of container if last chunk)
    const mainRange = new Range();
    mainRange.setStartAfter(startMarker);
    if (endMarker) {
      mainRange.setEndBefore(endMarker);
    } else {
      mainRange.setEndAfter(containerEl.lastChild);
    }

    // Debug collapsed ranges (indicates marker positioning issue)
    if (mainRange.collapsed) {
      return false;
    }

    // Use TreeWalker to create individual text node ranges (skips excessive whitespace)
    const textRanges = [];
    const walker = document.createTreeWalker(
      containerEl,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
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
      if (!text.trim()) continue;

      // Find content boundaries (exclude leading/trailing whitespace)
      const startOffset = text.search(/\S/);
      const endOffset = text.length - (text.match(/\s*$/)?.[0].length || 0);

      // Create range covering only the content
      const range = new Range();
      range.setStart(textNode, startOffset);
      range.setEnd(textNode, endOffset);
      textRanges.push(range);
    }

    // Apply CSS Highlight API with multiple ranges
    if (CSS.highlights) {
      // Clear existing highlight first (fixes iOS WebKit issue where old highlight persists)
      CSS.highlights.delete('speaking');
      const highlight = new Highlight(...textRanges);
      CSS.highlights.set('speaking', highlight);
      return true;
    }
    return false;
  } catch (e) {
    console.error('[Highlight] Error for chunk', chunkIndex, ':', e.message);
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
  } else {
    // Scroll to the highlighted text
    scrollToHighlightedText(chunkIndex);
  }

  // Dispatch custom event for debugging/testing
  const chunk = state.narrationChunks[chunkIndex];
  const chunkText = typeof chunk === 'string' ? chunk : chunk?.text || '';
  const event = new CustomEvent('chunkHighlighted', {
    detail: {
      chunkIndex,
      chunkText,
      totalChunks: state.narrationChunks.length,
      success
    }
  });
  window.dispatchEvent(event);
}

/**
 * Scroll to the currently highlighted text
 * Uses Visual Viewport API to position text at bottom of visible area.
 * This works automatically whether keyboard is open or closed.
 * @param {number} chunkIndex - Chunk index to scroll to
 */
function scrollToHighlightedText(chunkIndex) {
  // Find the start marker for this chunk
  const containers = [
    window.currentStatusBarElement || document.getElementById('statusBar'),
    document.getElementById('upperWindow'),
    state.currentGameTextElement
  ];

  const startSelector = `.chunk-marker-start[data-chunk="${chunkIndex}"]`;

  for (const container of containers) {
    if (!container) continue;
    const startMarker = container.querySelector(startSelector);
    if (startMarker) {
      // Find the next visible element or text node after the marker
      let targetElement = startMarker.nextSibling;
      while (targetElement && targetElement.nodeType === Node.TEXT_NODE && !targetElement.textContent.trim()) {
        targetElement = targetElement.nextSibling;
      }
      if (!targetElement) break;

      // Get the actual element (if text node, use parent)
      const scrollTarget = targetElement.nodeType === Node.TEXT_NODE
        ? targetElement.parentElement
        : targetElement;

      if (scrollTarget) {
        const gameOutput = document.getElementById('gameOutput');
        const containerRect = gameOutput.getBoundingClientRect();
        const elementRect = scrollTarget.getBoundingClientRect();

        // Use visual viewport height (accounts for keyboard) or fall back to innerHeight
        const visibleHeight = window.visualViewport?.height ?? window.innerHeight;

        // Position element near bottom of visible viewport with small buffer
        const bufferFromBottom = 60;
        const targetPositionFromTop = visibleHeight - bufferFromBottom;

        // Calculate scroll needed to place element at target position
        const relativeTop = elementRect.top - containerRect.top;
        const targetScroll = gameOutput.scrollTop + relativeTop - targetPositionFromTop;

        // Clamp to valid scroll range
        const maxScroll = gameOutput.scrollHeight - gameOutput.clientHeight;
        const clampedScroll = Math.max(0, Math.min(targetScroll, maxScroll));

        gameOutput.scrollTo({
          top: clampedScroll,
          behavior: 'smooth'
        });
      }
      break;
    }
  }
}
