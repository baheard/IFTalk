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

  // Process status line first (if exists AND should be included)
  if (hasStatus && statusEl && shouldIncludeStatus) {
    const statusMarkedHTML = insertTemporaryMarkers(statusHTML);
    const statusChunksWithMarkers = createNarrationChunks(statusMarkedHTML);
    const { chunks: statusChunks, markerIDs: statusMarkerIDs } =
      extractChunksAndMarkers(statusChunksWithMarkers);

    // Prefix first status chunk with "Status: " for clarity
    if (statusChunks.length > 0 && statusChunks[0].text.trim()) {
      statusChunks[0].text = 'Status: ' + statusChunks[0].text;
    }

    // Apply markers to status element
    statusEl.innerHTML = statusMarkedHTML;
    insertRealMarkersAtIDs(statusEl, statusMarkerIDs);

    // Insert start marker for chunk 0 BEFORE first marker position
    if (statusMarkerIDs.length > 0) {
      const firstMarkerID = statusMarkerIDs[0];
      const tempMarkerRegex = new RegExp(`⚐${firstMarkerID}⚐`);
      const walker = document.createTreeWalker(statusEl, NodeFilter.SHOW_TEXT);
      let textNode;
      while (textNode = walker.nextNode()) {
        if (tempMarkerRegex.test(textNode.textContent)) {
          const startMarker = document.createElement('span');
          startMarker.className = 'chunk-marker-start';
          startMarker.dataset.chunk = 0;
          startMarker.style.cssText = 'display: none; position: absolute;';
          textNode.parentNode.insertBefore(startMarker, textNode);
          break;
        }
      }
    } else if (statusEl.firstChild) {
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
  }

  // Process upper window second (if exists) - for quotes, formatted text, etc.
  if (hasUpper && upperEl) {
    const upperMarkedHTML = insertTemporaryMarkers(upperHTML, true); // Skip line breaks for formatting
    const upperChunksWithMarkers = createNarrationChunks(upperMarkedHTML);
    const { chunks: upperChunks, markerIDs: upperMarkerIDs } =
      extractChunksAndMarkers(upperChunksWithMarkers);

    // Apply markers to upper window element (NO renumbering - keep original marker IDs!)
    upperEl.innerHTML = upperMarkedHTML;

    // Pass original marker IDs with chunk offset info
    insertRealMarkersAtIDs(upperEl, upperMarkerIDs, chunkOffset);

    // Insert start marker BEFORE first marker position
    if (upperMarkerIDs.length > 0) {
      const firstMarkerID = upperMarkerIDs[0];
      const tempMarkerRegex = new RegExp(`⚐${firstMarkerID}⚐`);
      const walker = document.createTreeWalker(upperEl, NodeFilter.SHOW_TEXT);
      let textNode;
      while (textNode = walker.nextNode()) {
        if (tempMarkerRegex.test(textNode.textContent)) {
          const startMarker = document.createElement('span');
          startMarker.className = 'chunk-marker-start';
          startMarker.dataset.chunk = chunkOffset;
          startMarker.style.cssText = 'display: none; position: absolute;';
          textNode.parentNode.insertBefore(startMarker, textNode);
          break;
        }
      }
    } else if (upperEl.firstChild) {
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
    let mainMarkedHTML = insertTemporaryMarkers(mainHTML);
    const mainChunksWithMarkers = createNarrationChunks(mainMarkedHTML);
    const { chunks: mainChunks, markerIDs: mainMarkerIDs } =
      extractChunksAndMarkers(mainChunksWithMarkers);

    // Check if this is a system message - prefix first chunk with "System: " for narration
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = mainHTML;
    const hasSystemMessage = tempDiv.querySelector('.system-message') !== null;

    if (hasSystemMessage && mainChunks.length > 0 && mainChunks[0].text.trim()) {
      mainChunks[0].text = 'System: ' + mainChunks[0].text;
    }

    // Apply markers to main element (NO renumbering - keep original marker IDs!)
    mainEl.innerHTML = mainMarkedHTML;

    // Pass original marker IDs (not sequential indices) with chunk offset info
    insertRealMarkersAtIDs(mainEl, mainMarkerIDs, chunkOffset);

    // Insert start marker for first chunk
    // IMPORTANT: Insert it BEFORE the first marker position, not at container beginning
    // This ensures chunk 0 doesn't include filtered-out app voice content
    if (mainMarkerIDs.length > 0) {
      // Find the first temp marker in the DOM
      const firstMarkerID = mainMarkerIDs[0];
      const tempMarkerRegex = new RegExp(`⚐${firstMarkerID}⚐`);

      const walker = document.createTreeWalker(mainEl, NodeFilter.SHOW_TEXT);
      let textNode;
      while (textNode = walker.nextNode()) {
        if (tempMarkerRegex.test(textNode.textContent)) {
          // Found the first marker - insert start[chunkOffset] right before this text node
          const startMarker = document.createElement('span');
          startMarker.className = 'chunk-marker-start';
          startMarker.dataset.chunk = chunkOffset;
          startMarker.style.cssText = 'display: none; position: absolute;';
          textNode.parentNode.insertBefore(startMarker, textNode);
          break;
        }
      }
    } else if (mainEl.firstChild) {
      // No markers (shouldn't happen, but fallback to old behavior)
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
  // Skip if this is the game echoing our last command via glk-input style
  if (!isCommand) {
    // Check if this is ONLY a glk-input echo (no other content)
    const glkInputMatch = text.match(/<span class="glk-input"[^>]*>(.*?)<\/span>/);
    if (glkInputMatch && text.replace(/<[^>]*>/g, '').trim() === glkInputMatch[1].trim()) {
      return null;
    }

    // Also check against last sent command
    if (window.lastSentCommand) {
      const plainText = text.replace(/<[^>]*>/g, '').trim().toLowerCase();
      const lastCmd = window.lastSentCommand.trim().toLowerCase();


      // Check various echo patterns
      const isEcho =
        plainText === lastCmd ||
        plainText === `>${lastCmd}` ||
        plainText === `> ${lastCmd}` ||
        plainText.startsWith(`>${lastCmd}\n`) ||
        plainText.startsWith(`> ${lastCmd}\n`) ||
        // Check if it's ONLY the command (not followed by other text)
        (plainText.split('\n')[0].trim() === lastCmd && plainText.split('\n').length === 1);

      if (isEcho) {
        window.lastSentCommand = null; // Clear so we don't skip future legitimate text
        return null;
      }
    }
  }

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
    // Game text - cleared only when Z-machine sends clear command
    div.className = 'game-text';

    // Stop any active narration when new content arrives
    if (state.isNarrating) {
      stopNarration();
    }

    // LAZY CHUNKING: Just render HTML, don't create chunks yet
    // Chunks will be created on-demand when narration is requested
    div.innerHTML = text;

    // Add mic icon to glk-input spans if they were voice commands
    if (window.lastCommandWasVoice && window.lastSentCommand) {
      const glkInputs = div.querySelectorAll('span.glk-input');
      const lastCmd = window.lastSentCommand.trim().toLowerCase();

      glkInputs.forEach(span => {
        const spanText = span.textContent.trim().toLowerCase();
        // Check if this glk-input matches the last voice command
        if (spanText === lastCmd || spanText === `>${lastCmd}` || spanText === `> ${lastCmd}`) {
          // Add mic icon before the text
          const micIcon = document.createElement('span');
          micIcon.className = 'voice-command-icon';
          micIcon.textContent = '🎤 ';
          micIcon.style.cssText = 'opacity: 0.7; margin-right: 0.3em;';
          span.insertBefore(micIcon, span.firstChild);

          // Clear the flag so we don't keep adding icons
          window.lastCommandWasVoice = false;
        }
      });
    }

    // Invalidate existing chunks - they're for old content
    state.chunksValid = false;
    state.narrationChunks = []; // Clear old chunks to prevent reading stale data
    state.currentChunkIndex = 0;
    state.currentChunkStartTime = 0;
  }

  if (dom.lowerWindow) {
    // Append new content before the command line (keep command line at bottom)
    const commandLine = document.getElementById('commandLine');
    if (commandLine && commandLine.parentElement === dom.lowerWindow) {
      dom.lowerWindow.insertBefore(div, commandLine);
    } else {
      dom.lowerWindow.appendChild(div);
    }
  }

  // Smart scroll: skip blank lines and scroll to first actual text
  function scrollToFirstText(container) {
    if (!container) return;

    // Find first descendant (not just direct child) with visible text
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          // Skip spacer divs
          if (node.classList?.contains('blank-line-spacer')) {
            return NodeFilter.FILTER_SKIP;
          }
          // Check if this element has visible text
          const text = node.textContent?.trim();
          if (text && text.length > 0) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        }
      }
    );

    const firstTextElement = walker.nextNode();
    const scrollTarget = firstTextElement || container;
    // Check if element is already visible in viewport
    const rect = scrollTarget.getBoundingClientRect();
    const gameOutput = document.getElementById('gameOutput');
    if (!gameOutput) return;

    const containerRect = gameOutput.getBoundingClientRect();
    const isVisible = (
      rect.top >= containerRect.top &&
      rect.bottom <= containerRect.bottom
    );

    // Only scroll if not already visible
    // Use 'nearest' to preserve existing scroll position and margins
    if (!isVisible) {
      scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // Scroll behavior:
  // - First content on screen (fresh screen): scroll to top so user reads from beginning
  // - Otherwise: scroll to bottom
  // Note: gameOutput is the scrollable container, not lowerWindow
  const existingContent = dom.lowerWindow?.querySelectorAll('.game-text, .user-command');
  const isFirstOnScreen = existingContent && existingContent.length <= 1;

  if (isFirstOnScreen) {
    scrollToFirstText(div);
  } else if (dom.gameOutput) {
    dom.gameOutput.scrollTop = dom.gameOutput.scrollHeight;
  }

  // Track for highlighting (only for game text, not commands)
  if (!isCommand) {
    state.currentGameTextElement = div;
  }

  return div;
}

/**
 * Clear all game output (but preserve command line)
 * Called when Z-machine sends a clear window command.
 * Removes all content from DOM to free memory.
 */
export function clearGameOutput() {
  if (dom.lowerWindow) {
    // Extract command line first (it might be nested inside a game-text div)
    const commandLine = document.getElementById('commandLine');

    // Clear everything from DOM
    dom.lowerWindow.innerHTML = '';

    // Re-append command line directly to lowerWindow
    if (commandLine) {
      dom.lowerWindow.appendChild(commandLine);
    }
  }
  resetNarrationState();
}
