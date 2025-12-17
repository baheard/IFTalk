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
  const input = cmd !== undefined ? cmd : '';

  // Detect if this is a voice command (not manually typed)
  // Use provided value if given, otherwise auto-detect
  if (isVoiceCommand === null) {
    isVoiceCommand = !state.hasManualTyping;
  }

  // Mark that a command is being processed
  state.pendingCommandProcessed = true;
  state.pausedForSound = false;

  state.hasManualTyping = false;

  updateStatus('Sending...', 'processing');

  // Add to command history (show [ENTER] for empty commands)
  addToCommandHistory(input || '[ENTER]', null, null, isVoiceCommand);

  // Track for echo detection
  window.lastCommandWasVoice = isVoiceCommand;

  // Send to ZVM
  sendCommandToGame(input);

  // Reset status after a brief delay
  setTimeout(() => {
    updateStatus('Ready');
  }, 100);
}

/**
 * Send command (legacy function - no longer used with inline keyboard input)
 */
export async function sendCommand() {
  // This function is kept for compatibility but is no longer used
  // Commands are now sent directly from keyboard.js via sendCommandDirect
  console.warn('[Commands] sendCommand() called but is deprecated - use sendCommandDirect() instead');
}
