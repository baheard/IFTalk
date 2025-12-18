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
    let mainMarkedHTML = insertTemporaryMarkers(mainHTML);
    const mainChunksWithMarkers = createNarrationChunks(mainMarkedHTML);
    const { chunks: mainChunks, markerIDs: mainMarkerIDs } =
      extractChunksAndMarkers(mainChunksWithMarkers);

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
    div.className = 'game-text';

    // Stop any active narration when new content arrives
    if (state.isNarrating) {
      stopNarration();
    }

    // LAZY CHUNKING: Just render HTML, don't create chunks yet
    // Chunks will be created on-demand when narration is requested
    div.innerHTML = text;

    // Trim excessive leading blank lines (max 1)
    if (dom.lowerWindow && dom.lowerWindow.children.length === 0) {
      // This is the first content in lower window
      let leadingBlankCount = 0;
      const children = Array.from(div.children);

      for (const child of children) {
        if (child.classList.contains('blank-line-spacer') ||
            (child.textContent && child.textContent.trim() === '')) {
          leadingBlankCount++;
        } else {
          break; // Found non-blank content
        }
      }

      // Remove all leading blanks except first one (if any)
      if (leadingBlankCount > 1) {
        for (let i = 1; i < leadingBlankCount; i++) {
          children[i].remove();
        }
      }
    }

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

  scrollToFirstText(div);

  // After new game text is added, ensure command line stays in view
  // Use requestAnimationFrame to wait for DOM updates and layout
  if (!isCommand) {
    requestAnimationFrame(() => {
      const commandLine = document.getElementById('commandLine');
      const lowerWindow = dom.lowerWindow;

      // If command line is visible, scroll to bottom to keep it in view
      if (commandLine && commandLine.style.display === 'flex' && lowerWindow) {
        // Scroll the lower window to the bottom
        lowerWindow.scrollTop = lowerWindow.scrollHeight;
      }
    });
  }

  // Track for highlighting (only for game text, not commands)
  if (!isCommand) {
    state.currentGameTextElement = div;
  }

  return div;
}

/**
 * Clear all game output (but preserve command line)
 */
export function clearGameOutput() {
  if (dom.lowerWindow) {
    // Extract command line first (it might be nested inside a game-text div)
    const commandLine = document.getElementById('commandLine');

    // Clear everything
    dom.lowerWindow.innerHTML = '';

    // Re-append command line directly to lowerWindow
    if (commandLine) {
      dom.lowerWindow.appendChild(commandLine);
    }
  }
  resetNarrationState();
}
