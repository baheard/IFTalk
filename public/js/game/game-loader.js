/**
 * Game Loader Module
 *
 * Handles game selection and initialization.
 */

import { state, resetNarrationState } from '../core/state.js';
import { dom } from '../core/dom.js';
import { updateStatus } from '../utils/status.js';
import { addGameText, clearGameOutput } from '../ui/game-output.js';
import { updateNavButtons } from '../ui/nav-buttons.js';
import { stopNarration } from '../narration/tts-player.js';

/**
 * Start a game
 * @param {string} gamePath - Path to game file
 * @param {Object} socket - Socket.IO connection
 * @param {Function} startTalkMode - Function to start talk mode
 */
export async function startGame(gamePath, socket, startTalkMode) {
  try {
    state.currentGamePath = gamePath;
    // Set game name for save/restore
    state.currentGameName = gamePath.split('/').pop().replace(/\.[^.]+$/, '').toLowerCase();
    console.log('[Game] Starting:', state.currentGameName);

    updateStatus('Starting game...', 'processing');

    // Hide welcome, show input
    if (dom.welcome) dom.welcome.classList.add('hidden');
    if (dom.inputArea) dom.inputArea.classList.remove('hidden');

    // Request game start
    socket.emit('start-game', gamePath);

    // Wait for initial output
    socket.once('game-output', (output) => {
      clearGameOutput();

      // Stop any existing narration
      stopNarration();

      // Reset narration state for new game
      state.pendingNarrationText = output;
      resetNarrationState();

      // Display the game output
      addGameText(output);

      // Update UI
      updateNavButtons();

      // Auto-start talk mode
      if (startTalkMode) startTalkMode();
      if (dom.userInput) dom.userInput.focus();
    });

  } catch (error) {
    console.error('[Game] Start error:', error);
    updateStatus('Error: ' + error.message);
  }
}

/**
 * Initialize game selection handlers
 * @param {Object} socket - Socket.IO connection
 * @param {Function} startTalkMode - Function to start talk mode
 */
export function initGameSelection(socket, startTalkMode) {
  // Game card click handlers
  document.querySelectorAll('.game-card').forEach(card => {
    card.addEventListener('click', () => {
      const gamePath = card.dataset.game;
      startGame(gamePath, socket, startTalkMode);
    });
  });

  // Select game button (reload page)
  if (dom.selectGameBtn) {
    dom.selectGameBtn.addEventListener('click', () => {
      location.reload();
    });
  }
}
