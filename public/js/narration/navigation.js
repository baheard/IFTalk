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
    console.log('[TTS] Navigation already in progress, ignoring');
    return;
  }

  let targetIndex = state.currentChunkIndex + offset;

  // Special case: if at end and going back, jump to last chunk
  if (offset === -1 && state.currentChunkIndex >= state.narrationChunks.length) {
    targetIndex = state.narrationChunks.length - 1;
    console.log(`[TTS] Back from end: jumping to last chunk ${targetIndex}`);
  }
  // Smart back button: if going back and within 500ms, go to previous chunk
  else if (offset === -1) {
    const timeSinceStart = Date.now() - state.currentChunkStartTime;
    if (timeSinceStart < 500 && state.currentChunkIndex > 0) {
      targetIndex = state.currentChunkIndex - 1;
      console.log(`[TTS] Smart back: within 500ms, going to previous chunk ${targetIndex}`);
    } else {
      targetIndex = state.currentChunkIndex;
      console.log(`[TTS] Smart back: past 500ms, restarting current chunk ${targetIndex}`);
    }
  }

  if (targetIndex < 0 || targetIndex >= state.narrationChunks.length) {
    console.log('[TTS] Cannot skip - out of bounds');
    return;
  }

  console.log(`[TTS] Skipping from chunk ${state.currentChunkIndex} to ${targetIndex}`);

  state.isNavigating = true;

  // Check if narration is enabled (should resume after navigation)
  const shouldResume = state.narrationEnabled;

  // Stop current playback immediately
  stopNarration();
  state.currentChunkIndex = targetIndex;

  // Small delay to prevent rapid navigation loops
  setTimeout(() => {
    state.isNavigating = false;

    // Update highlighting
    updateTextHighlight(targetIndex);

    // Auto-resume if narration was enabled
    if (shouldResume) {
      console.log(`[TTS] Auto-resuming from chunk ${targetIndex}`);
      state.isPaused = false;
      state.narrationEnabled = true;
      speakTextChunked(null, targetIndex);
    } else {
      // Just update highlight if not playing
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

  console.log('[TTS] Skipping to start');

  state.isNavigating = true;
  state.currentChunkStartTime = 0;

  // Check if narration is enabled (should resume after navigation)
  const shouldResume = state.narrationEnabled;

  stopNarration();
  state.currentChunkIndex = 0;

  setTimeout(() => {
    state.isNavigating = false;

    // Always update highlighting to first chunk
    updateTextHighlight(0);

    // Start playing if: (was playing before) OR (autoplay is enabled)
    if (shouldResume || state.autoplayEnabled) {
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

  console.log('[TTS] FORCE SKIP TO END - stopping all narration');

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

  console.log('[TTS] Force stop complete - position:', state.currentChunkIndex + 1, '/', state.narrationChunks.length);
}
