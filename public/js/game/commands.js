/**
 * Game Commands Module
 *
 * Handles sending commands to the game using browser-based ZVM.
 */

import { state } from '../core/state.js';
import { dom } from '../core/dom.js';
import { updateStatus } from '../utils/status.js';
import { addToCommandHistory } from '../ui/history.js';
import { sendCommandToGame } from './game-loader.js';

/**
 * Send command directly to game (no AI translation)
 * @param {string} cmd - Command to send
 */
export async function sendCommandDirect(cmd) {
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

  // Add to command history (show [ENTER] for empty commands)
  addToCommandHistory(input || '[ENTER]');

  // Send to ZVM
  sendCommandToGame(input);

  // Reset status after a brief delay
  setTimeout(() => {
    updateStatus('Ready');
    if (dom.userInput) dom.userInput.focus();
  }, 100);
}

/**
 * Send command (called from Enter key or send button)
 */
export async function sendCommand() {
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
  sendCommandDirect(input || '');
}
