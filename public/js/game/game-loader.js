/**
 * Game Loader Module
 *
 * Handles game selection and initialization using browser-based ZVM with custom display.
 */

import { state, resetNarrationState } from '../core/state.js';
import { dom } from '../core/dom.js';
import { updateStatus } from '../utils/status.js';
import { updateNavButtons } from '../ui/nav-buttons.js';
import { stopNarration } from '../narration/tts-player.js';
import { createVoxGlk, sendInput, getInputType } from './voxglk.js';

/**
 * Start a game using browser-based ZVM
 * @param {string} gamePath - Path to game file
 * @param {Function} onOutput - Callback for game output (for TTS)
 * @param {Function} startTalkMode - Function to start talk mode
 */
export async function startGame(gamePath, onOutput, startTalkMode) {
  try {
    state.currentGamePath = gamePath;
    // Set game name for save/restore
    state.currentGameName = gamePath.split('/').pop().replace(/\.[^.]+$/, '').toLowerCase();

    updateStatus('Starting game...', 'processing');

    // Hide welcome, show game output and input
    if (dom.welcome) dom.welcome.classList.add('hidden');
    const gameOutput = document.getElementById('gameOutput');
    if (gameOutput) gameOutput.classList.remove('hidden');
    if (dom.inputArea) dom.inputArea.classList.remove('hidden');

    // Verify ZVM is loaded
    if (typeof window.ZVM === 'undefined') {
      console.error('[ZVM] ZVM library not loaded');
      updateStatus('Error: Game engine not loaded');
      return;
    }

    // Verify Glk is loaded
    if (typeof window.Glk === 'undefined') {
      console.error('[ZVM] Glk library not loaded');
      updateStatus('Error: Glk library not loaded');
      return;
    }

    // Fetch the story file as binary data
    updateStatus('Downloading game file...', 'processing');

    const response = await fetch(gamePath);
    if (!response.ok) {
      throw new Error(`Failed to load game file: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const storyData = arrayBuffer;

    // Create ZVM instance
    const vm = new window.ZVM();
    window.zvmInstance = vm;

    // Create VoxGlk display engine
    const voxglk = createVoxGlk(onOutput);

    // Prepare options for Glk
    const options = {
      vm: vm,
      Glk: window.Glk,
      GlkOte: voxglk,  // Pass VoxGlk as GlkOte - duck typing!
      Dialog: window.Dialog
    };

    // Prepare VM with story data
    vm.prepare(storyData, options);

    // Initialize Glk - this starts everything!
    window.Glk.init(options);
    // Glk.init() will:
    // 1. Set options.accept to its internal handler
    // 2. Call customDisplay.init(options)
    // 3. customDisplay.init() will call options.accept({type: 'init'})
    // 4. Glk will call vm.start()
    // 5. Game output will come through customDisplay.update()

    updateStatus('Ready - Game loaded');

    // Reset narration state
    resetNarrationState();
    updateNavButtons();

    // Auto-start talk mode
    if (startTalkMode) startTalkMode();
    if (dom.userInput) dom.userInput.focus();

    // Stop any existing narration
    stopNarration();

  } catch (error) {
    console.error('[Game] Start error:', error);
    updateStatus('Error: ' + error.message);
  }
}

/**
 * Send command to the game
 * @param {string} cmd - Command to send (optional, uses input field if not provided)
 */
export function sendCommandToGame(cmd) {
  const input = cmd !== undefined ? cmd : (dom.userInput ? dom.userInput.value : '');

  // Get the current input type from VoxGlk (game may want 'char' or 'line')
  const type = getInputType();

  // For char input with empty string, send Enter key
  const text = (type === 'char' && input === '') ? '\n' : input;

  // Send through our custom display layer with correct type
  sendInput(text, type);

  // Clear the input field
  if (dom.userInput) {
    dom.userInput.value = '';
  }
}

/**
 * Initialize game selection handlers
 * @param {Function} onOutput - Callback for game output (for TTS)
 * @param {Function} startTalkMode - Function to start talk mode
 */
export function initGameSelection(onOutput, startTalkMode) {
  // Game card click handlers
  document.querySelectorAll('.game-card').forEach(card => {
    card.addEventListener('click', () => {
      const gamePath = card.dataset.game;
      startGame(gamePath, onOutput, startTalkMode);
    });
  });

  // Select game button (reload page)
  if (dom.selectGameBtn) {
    dom.selectGameBtn.addEventListener('click', () => {
      location.reload();
    });
  }
}
