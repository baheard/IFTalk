/**
 * Game Commands Module
 *
 * Handles sending commands to the game using browser-based ZVM.
 */

import { state } from '../core/state.js';
import { dom } from '../core/dom.js';
import { updateStatus } from '../utils/status.js';
import { addToCommandHistory } from '../ui/history.js';
import { addGameText } from '../ui/game-output.js';
import { sendCommandToGame } from './game-loader.js';

/**
 * Send command directly to game (no AI translation)
 * @param {string} cmd - Command to send
 * @param {boolean} isVoiceCommand - Whether this is a voice command (optional, auto-detected if not provided)
 */
export async function sendCommandDirect(cmd, isVoiceCommand = null) {
  const input = cmd !== undefined ? cmd : (dom.userInput ? dom.userInput.value : '');

  // Detect if this is a voice command (not manually typed)
  // Use provided value if given, otherwise auto-detect
  if (isVoiceCommand === null) {
    isVoiceCommand = !state.hasManualTyping;
  }

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
  addToCommandHistory(input || '[ENTER]', null, null, isVoiceCommand);

  // Send to ZVM
  sendCommandToGame(input);

  // Reset status after a brief delay
  setTimeout(() => {
    updateStatus('Ready');
  }, 100);
}

/**
 * Send command (called from Enter key or send button)
 */
export async function sendCommand() {
  const input = dom.userInput ? dom.userInput.value : '';

  // Capture whether this was manually typed BEFORE resetting the flag
  const wasManuallyTyped = state.hasManualTyping;

  // Mark that a command is being processed
  state.pendingCommandProcessed = true;
  state.pausedForSound = false;

  // Clear input immediately to prevent double-send
  if (dom.userInput) {
    dom.userInput.value = '';
  }
  state.hasManualTyping = false;

  // Send directly without AI translation
  // Pass false for isVoiceCommand if it was manually typed
  sendCommandDirect(input || '', !wasManuallyTyped);
}
