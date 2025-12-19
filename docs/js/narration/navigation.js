/**
 * Narration Navigation Module
 *
 * Controls for navigating through narration chunks (sentences).
 * Supports skip forward/back, restart, and skip to end.
 */

import { state } from '../core/state.js';
import { stopNarration } from './tts-player.js';
import { updateTextHighlight, removeHighlight } from './highlighting.js';
import { updateStatus } from '../utils/status.js';
import { dom } from '../core/dom.js';

/**
 * Navigate chunks (skip forward or backward)
 * @param {number} offset - Number of chunks to skip (negative = backward)
 * @param {Function} speakTextChunked - Function to resume narration
 */
export function skipToChunk(offset, speakTextChunked) {
  // Prevent concurrent navigation
  if (state.isNavigating) {
    return;
  }

  let targetIndex = state.currentChunkIndex + offset;

  // Special case: if at end and going back, jump to last chunk
  if (offset === -1 && state.currentChunkIndex >= state.narrationChunks.length) {
    targetIndex = state.narrationChunks.length - 1;
  }
  // Smart back button: if going back and within 3 seconds, go to previous chunk
  // When paused, always go to previous chunk (don't replay current)
  else if (offset === -1) {
    const timeSinceStart = Date.now() - state.currentChunkStartTime;
    // If paused OR within 3 seconds of start, go to previous chunk
    if ((state.isPaused || timeSinceStart < 3000) && state.currentChunkIndex > 0) {
      targetIndex = state.currentChunkIndex - 1;
    } else {
      targetIndex = state.currentChunkIndex;
    }
  }

  if (targetIndex < 0 || targetIndex >= state.narrationChunks.length) {
    return;
  }


  state.isNavigating = true;

  // Stop current playback but preserve highlighting (we'll update it next)
  stopNarration(true);
  state.currentChunkIndex = targetIndex;

  // Small delay to prevent rapid navigation loops
  setTimeout(async () => {
    state.isNavigating = false;

    // Update highlighting to new chunk
    updateTextHighlight(targetIndex);

    // If in autoplay mode, start playing from new position
    if (state.autoplayEnabled) {
      state.isPaused = false;
      state.narrationEnabled = true;
      speakTextChunked(null, targetIndex);
    } else {
      // Just update highlight if not in autoplay mode
      state.isPaused = true;
    }
  }, 100);
}

/**
 * Skip to beginning
 * @param {Function} speakTextChunked - Function to resume narration
 */
export function skipToStart(speakTextChunked) {
  if (state.narrationChunks.length === 0 || state.isNavigating) return;


  state.isNavigating = true;
  state.currentChunkStartTime = 0;

  // Stop but preserve highlighting (we'll update it next)
  stopNarration(true);
  state.currentChunkIndex = 0;

  setTimeout(async () => {
    state.isNavigating = false;

    // Always update highlighting to first chunk
    updateTextHighlight(0);

    // If in autoplay mode, start playing from beginning
    if (state.autoplayEnabled) {
      state.isPaused = false;
      state.narrationEnabled = true;
      speakTextChunked(null, 0);
    } else {
      // Stay paused but keep first chunk highlighted
      state.isPaused = true;
    }
  }, 100);
}

/**
 * Skip to end (stop all narration and jump to end)
 */
export function skipToEnd() {
  if (state.narrationChunks.length === 0) return;


  // Force stop everything immediately
  state.narrationEnabled = false;
  state.isPaused = true;
  state.isNavigating = false;

  // Stop audio immediately
  if (state.currentAudio) {
    state.currentAudio.pause();
    state.currentAudio.currentTime = 0;
    state.currentAudio = null;
  }

  // Stop browser TTS
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
  }

  state.isNarrating = false;

  // Jump past end (no highlighting)
  state.currentChunkIndex = state.narrationChunks.length;
  state.currentChunkStartTime = 0;

  updateStatus('⏩ Skipped to end');

  // Remove all highlighting
  removeHighlight();

  // Scroll to bottom
  if (dom.gameOutput) {
    dom.gameOutput.scrollTop = dom.gameOutput.scrollHeight;
  }
}
