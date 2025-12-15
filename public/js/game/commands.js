/**
 * Game Commands Module
 *
 * Handles sending commands to the game server and processing responses.
 */

import { state, resetNarrationState } from '../core/state.js';
import { dom } from '../core/dom.js';
import { updateStatus } from '../utils/status.js';
import { addGameText } from '../ui/game-output.js';
import { addToCommandHistory } from '../ui/history.js';
import { stopNarration, speakTextChunked } from '../narration/tts-player.js';
import { updateNavButtons } from '../ui/nav-buttons.js';

/**
 * Send command directly to game (no AI translation)
 * @param {string} cmd - Command to send
 * @param {Object} socket - Socket.IO connection
 */
export async function sendCommandDirect(cmd, socket) {
  const input = cmd !== undefined ? cmd : (dom.userInput ? dom.userInput.value : '');

  // Mark that a command is being processed
  state.pendingCommandProcessed = true;
  state.pausedForSound = false;

  // Clear input immediately
  if (dom.userInput) {
    dom.userInput.value = '';
  }
  state.hasManualTyping = false;

  updateStatus('Sending...', 'processing');

  // Show command (empty shows as gray [ENTER])
  addGameText(input, true);

  // Add to command history
  addToCommandHistory(input || '[ENTER]');

  // Send to server
  socket.emit('send-command', input);

  // Wait for response
  socket.once('game-output', async (output) => {
    if (output && output.trim()) {
      // Stop any currently running narration
      stopNarration();

      // Reset narration for new text
      state.pendingNarrationText = output;
      state.narrationChunks = [];
      state.currentChunkIndex = 0;
      state.isPaused = false;

      // Display the game output
      addGameText(output);

      // Auto-narrate if autoplay is enabled and in talk mode
      if (state.autoplayEnabled && state.talkModeActive) {
        state.narrationEnabled = true;
        await speakTextChunked(null, 0, socket);
      }

      updateNavButtons();
    }

    updateStatus('Ready');
    if (dom.userInput) dom.userInput.focus();
  });
}

/**
 * Send command (called from Enter key or send button)
 * @param {Object} socket - Socket.IO connection
 */
export async function sendCommand(socket) {
  const input = dom.userInput ? dom.userInput.value : '';

  // Mark that a command is being processed
  state.pendingCommandProcessed = true;
  state.pausedForSound = false;

  // Clear input immediately to prevent double-send
  if (dom.userInput) {
    dom.userInput.value = '';
  }
  state.hasManualTyping = false;

  // Send directly without AI translation
  sendCommandDirect(input || '', socket);
}
