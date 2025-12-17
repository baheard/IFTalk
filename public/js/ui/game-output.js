/**
 * Game Output Module
 *
 * Handles rendering game text and commands to the screen.
 * Uses lazy chunking - chunks are created on-demand when narration starts.
 */

import { state, resetNarrationState } from '../core/state.js';
import { dom } from '../core/dom.js';
import { escapeHtml } from '../utils/text-processing.js';
import { insertTemporaryMarkers, createNarrationChunks, insertRealMarkersAtIDs, removeTemporaryMarkers } from '../narration/chunking.js';
import { stopNarration } from '../narration/tts-player.js';

/**
 * Extract chunks and marker IDs in a single pass
 * @param {Array} chunksWithMarkers - Array of {text, markerID, index, voice} objects
 * @returns {{chunks: Array, markerIDs: number[]}} Extracted chunks (with voice info) and marker IDs
 */
function extractChunksAndMarkers(chunksWithMarkers) {
  const chunks = [];
  const markerIDs = [];

  for (const item of chunksWithMarkers) {
    // Preserve full chunk object (including voice type)
    chunks.push({
      text: item.text,
      voice: item.voice || 'narrator'
    });
    if (item.markerID !== null) {
      markerIDs.push(item.markerID);
    }
  }

  return { chunks, markerIDs };
}

/**
 * Ensure chunks are ready for narration
 * Creates chunks on-demand from status line + game text (lazy evaluation)
 * @returns {boolean} True if chunks are ready
 */
export function ensureChunksReady() {
  // If chunks are already valid, nothing to do
  if (state.chunksValid && state.narrationChunks.length > 0) {
    return true;
  }

  // Get elements
  const statusEl = window.currentStatusBarElement || document.getElementById('statusBar');
  const upperEl = document.getElementById('upperWindow');
  const mainEl = state.currentGameTextElement;

  // Get HTML
  const statusHTML = statusEl ? statusEl.innerHTML : '';
  const upperHTML = upperEl ? upperEl.innerHTML : '';
  const mainHTML = mainEl ? mainEl.innerHTML : '';

  const hasStatus = statusHTML && statusHTML.trim();
  const hasUpper = upperHTML && upperHTML.trim();
  const hasMain = mainHTML && mainHTML.trim();

  if (!hasStatus && !hasUpper && !hasMain) {
    return false;
  }

  let allChunks = [];
  let chunkOffset = 0;

  // Check if status bar should be included (set by voxglk when status bar changes)
  const shouldIncludeStatus = window.includeStatusBarInChunks !== false; // Default true for first load
  console.log('[EnsureChunks] Should include status bar:', shouldIncludeStatus);

  // Process status line first (if exists AND should be included)
  if (hasStatus && statusEl && shouldIncludeStatus) {
    const statusMarkedHTML = insertTemporaryMarkers(statusHTML);
    const statusChunksWithMarkers = createNarrationChunks(statusMarkedHTML);
    const { chunks: statusChunks, markerIDs: statusMarkerIDs } =
      extractChunksAndMarkers(statusChunksWithMarkers);

    // Apply markers to status element
    statusEl.innerHTML = statusMarkedHTML;
    insertRealMarkersAtIDs(statusEl, statusMarkerIDs);

    // Insert start marker for chunk 0
    if (statusEl.firstChild) {
      const startMarker = document.createElement('span');
      startMarker.className = 'chunk-marker-start';
      startMarker.dataset.chunk = 0;
      startMarker.style.cssText = 'display: none; position: absolute;';
      statusEl.insertBefore(startMarker, statusEl.firstChild);
    }

    removeTemporaryMarkers(statusEl, statusChunks);

    allChunks = allChunks.concat(statusChunks);
    chunkOffset = statusChunks.length;
  } else if (hasStatus && statusEl && !shouldIncludeStatus) {
    console.log('[EnsureChunks] Skipping status bar (unchanged)');
  }

  // Process upper window second (if exists) - for quotes, formatted text, etc.
  if (hasUpper && upperEl) {
    const upperMarkedHTML = insertTemporaryMarkers(upperHTML);
    const upperChunksWithMarkers = createNarrationChunks(upperMarkedHTML);
    const { chunks: upperChunks, markerIDs: upperMarkerIDs } =
      extractChunksAndMarkers(upperChunksWithMarkers);

    // Apply markers to upper window element (NO renumbering - keep original marker IDs!)
    upperEl.innerHTML = upperMarkedHTML;

    // Pass original marker IDs with chunk offset info
    insertRealMarkersAtIDs(upperEl, upperMarkerIDs, chunkOffset);

    // Insert start marker at beginning of upper window
    if (upperEl.firstChild) {
      const startMarker = document.createElement('span');
      startMarker.className = 'chunk-marker-start';
      startMarker.dataset.chunk = chunkOffset;
      startMarker.style.cssText = 'display: none; position: absolute;';
      upperEl.insertBefore(startMarker, upperEl.firstChild);
    }

    removeTemporaryMarkers(upperEl, upperChunks);

    allChunks = allChunks.concat(upperChunks);
    chunkOffset += upperChunks.length;
  }

  // Process main content third (if exists)
  if (hasMain && mainEl) {
    console.log('[CHUNK DEBUG] Main HTML:', mainHTML);
    let mainMarkedHTML = insertTemporaryMarkers(mainHTML);
    console.log('[CHUNK DEBUG] Marked HTML:', mainMarkedHTML);
    const mainChunksWithMarkers = createNarrationChunks(mainMarkedHTML);
    console.log('[CHUNK DEBUG] Chunks with markers:', mainChunksWithMarkers);
    const { chunks: mainChunks, markerIDs: mainMarkerIDs } =
      extractChunksAndMarkers(mainChunksWithMarkers);
    console.log('[CHUNK DEBUG] Final chunks:', mainChunks);
    console.log('[CHUNK DEBUG] Marker IDs:', mainMarkerIDs);

    // Apply markers to main element (NO renumbering - keep original marker IDs!)
    mainEl.innerHTML = mainMarkedHTML;

    // Pass original marker IDs (not sequential indices) with chunk offset info
    insertRealMarkersAtIDs(mainEl, mainMarkerIDs, chunkOffset);

    // ALWAYS insert start marker at beginning of main content
    if (mainEl.firstChild) {
      const startMarker = document.createElement('span');
      startMarker.className = 'chunk-marker-start';
      startMarker.dataset.chunk = chunkOffset;
      startMarker.style.cssText = 'display: none; position: absolute;';
      mainEl.insertBefore(startMarker, mainEl.firstChild);
    }

    removeTemporaryMarkers(mainEl, mainChunks);

    allChunks = allChunks.concat(mainChunks);
  }

  state.narrationChunks = allChunks;

  // Mark chunks as valid
  state.chunksValid = true;
  return true;
}

/**
 * Add text to game output
 * @param {string} text - Text to add (HTML or plain text)
 * @param {boolean} isCommand - Whether this is a user command
 * @param {boolean} isVoiceCommand - Whether this was a voice command
 * @returns {HTMLElement} The created element
 */
export function addGameText(text, isCommand = false, isVoiceCommand = false) {
  const div = document.createElement('div');

  if (isCommand) {
    // Add voice-command class if this was spoken
    div.className = isVoiceCommand ? 'user-command voice-command' : 'user-command';

    // Don't show [ENTER] for empty commands - just show >
    if (text === '' || text === '[ENTER]') {
      const icon = isVoiceCommand ? '🎤 ' : '';
      div.innerHTML = `<span class="command-label">&gt;</span> ${icon}<span style="color: #999;">[ENTER]</span>`;
    } else {
      const icon = isVoiceCommand ? '🎤 ' : '';
      div.innerHTML = `<span class="command-label">&gt;</span> ${icon}${escapeHtml(text)}`;
    }
  } else {
    div.className = 'game-text';

    // Stop any active narration when new content arrives
    if (state.isNarrating) {
      stopNarration();
    }

    // LAZY CHUNKING: Just render HTML, don't create chunks yet
    // Chunks will be created on-demand when narration is requested
    div.innerHTML = text;

    // Invalidate existing chunks - they're for old content
    state.chunksValid = false;
    state.currentChunkIndex = 0;
    state.currentChunkStartTime = 0;
  }

  if (dom.lowerWindow) {
    dom.lowerWindow.appendChild(div);
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
  if (dom.lowerWindow) {
    dom.lowerWindow.innerHTML = '';
  }
  resetNarrationState();
}
