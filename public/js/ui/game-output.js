/**
 * Game Output Module
 *
 * Handles rendering game text and commands to the screen.
 * Manages text processing, marker insertion, and highlighting setup.
 */

import { state, resetNarrationState } from '../core/state.js';
import { dom } from '../core/dom.js';
import { escapeHtml } from '../utils/text-processing.js';
import { insertTemporaryMarkers, createNarrationChunks, insertRealMarkersAtIDs, removeTemporaryMarkers } from '../narration/chunking.js';
import { stopNarration } from '../narration/tts-player.js';

/**
 * Add text to game output
 * @param {string} text - Text to add (HTML or plain text)
 * @param {boolean} isCommand - Whether this is a user command
 * @returns {HTMLElement} The created element
 */
export function addGameText(text, isCommand = false) {
  const div = document.createElement('div');

  if (isCommand) {
    div.className = 'user-command';

    // Don't show [ENTER] for empty commands - just show >
    if (text === '' || text === '[ENTER]') {
      div.innerHTML = `<span class="command-label">&gt;</span> <span style="color: #999;">[ENTER]</span>`;
    } else {
      div.innerHTML = `<span class="command-label">&gt;</span> ${escapeHtml(text)}`;
    }
  } else {
    div.className = 'game-text';

    // IMPORTANT: Stop any active narration before replacing chunks
    if (state.isNarrating) {
      console.log('[TTS] New text arriving - stopping current narration');
      stopNarration();
      state.currentChunkIndex = 0;
      state.currentChunkStartTime = 0;
    }

    // MARKER SYSTEM: Insert temporary markers, create chunks, insert real markers
    const markedHTML = insertTemporaryMarkers(text);
    div.innerHTML = markedHTML;

    const chunksWithMarkers = createNarrationChunks(markedHTML);
    state.narrationChunks = chunksWithMarkers.map(c => c.text);
    const survivingMarkerIDs = chunksWithMarkers.map(c => c.markerID).filter(id => id !== null);
    console.log('[TTS] Created', state.narrationChunks.length, 'chunks for narration');

    insertRealMarkersAtIDs(div, survivingMarkerIDs);

    // Insert start marker for chunk 0 at the very beginning
    if (div.firstChild) {
      const startMarker = document.createElement('span');
      startMarker.className = 'chunk-marker-start';
      startMarker.dataset.chunk = 0;
      startMarker.style.cssText = 'display: none; position: absolute;';
      div.insertBefore(startMarker, div.firstChild);
      console.log('[Markers] Inserted start marker for chunk 0');
    }

    removeTemporaryMarkers(div, state.narrationChunks);
  }

  if (dom.gameOutputInner) {
    dom.gameOutputInner.appendChild(div);
  }

  // Scroll to show the TOP of new text
  div.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Track for highlighting (only for game text, not commands)
  if (!isCommand) {
    state.currentGameTextElement = div;
  }

  return div;
}

/**
 * Clear all game output
 */
export function clearGameOutput() {
  if (dom.gameOutputInner) {
    dom.gameOutputInner.innerHTML = '';
  }
  resetNarrationState();
}
