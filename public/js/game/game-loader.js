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
import { updateCurrentGameDisplay } from '../ui/settings.js';

/**
 * Start a game using browser-based ZVM
 * @param {string} gamePath - Path to game file
 * @param {Function} onOutput - Callback for game output (for TTS)
 * @param {Function} startTalkMode - Function to start talk mode
 */
export async function startGame(gamePath, onOutput, startTalkMode) {
  console.log('[StartGame] ========== START GAME CALLED ==========');
  console.log('[StartGame] Game path:', gamePath);
  console.log('[StartGame] onOutput callback:', typeof onOutput);
  console.log('[StartGame] startTalkMode callback:', typeof startTalkMode);

  try {
    state.currentGamePath = gamePath;
    // Set game name for save/restore
    state.currentGameName = gamePath.split('/').pop().replace(/\.[^.]+$/, '').toLowerCase();
    console.log('[StartGame] Game name:', state.currentGameName);

    // Update game name display in settings
    updateCurrentGameDisplay(gamePath.split('/').pop());

    updateStatus('Starting game...', 'processing');
    console.log('[StartGame] Status updated to "Starting game..."');

    // Hide welcome, show game output and controls
    console.log('[StartGame] Hiding welcome screen, showing game output');
    if (dom.welcome) dom.welcome.classList.add('hidden');
    const gameOutput = document.getElementById('gameOutput');
    if (gameOutput) gameOutput.classList.remove('hidden');

    // Show controls
    const controls = document.getElementById('controls');
    if (controls) controls.classList.remove('hidden');

    // Initialize keyboard input
    const { initKeyboardInput } = await import('../input/keyboard.js');
    initKeyboardInput();

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
    console.log('[StartGame] Fetching game file from:', gamePath);

    const response = await fetch(gamePath);
    console.log('[StartGame] Fetch response status:', response.status, response.statusText);
    if (!response.ok) {
      throw new Error(`Failed to load game file: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const storyData = arrayBuffer;

    // Create ZVM instance
    console.log('[StartGame] Creating ZVM instance');
    const vm = new window.ZVM();
    window.zvmInstance = vm;
    console.log('[StartGame] ZVM instance created:', vm);

    // Create VoxGlk display engine
    const voxglk = createVoxGlk(onOutput);

    // Set up autoload before Glk initializes (so it's ready for first input request)
    // Skip first input request (usually "press any key" prompt) and restore on second
    let inputRequestCount = 0;
    window.attemptAutoload = async () => {
      inputRequestCount++;
      console.log('[Game] Input request #', inputRequestCount);

      // Check if user requested to skip autoload (restart game)
      const skipAutoload = localStorage.getItem('iftalk_skip_autoload');
      if (skipAutoload === 'true') {
        console.log('[Game] Skip autoload flag set, clearing flag and starting fresh');
        localStorage.removeItem('iftalk_skip_autoload');
        // Also clear the autosave now that we have the game signature
        const gameSignature = vm.get_signature?.();
        if (gameSignature) {
          const autosaveKey = `iftalk_autosave_${gameSignature}`;
          localStorage.removeItem(autosaveKey);
          console.log('[Game] Cleared autosave:', autosaveKey);
        }
        window.attemptAutoload = () => {}; // Don't try again
        return false;
      }

      // First input is usually char input for "press any key", can't restore during that
      // Wait for second input request (after game has started) to restore
      if (inputRequestCount === 1) {
        console.log('[Game] Skipping first input request (press any key prompt)');
        return true; // Return true to signal voxglk to auto-send a key
      }

      const gameSignature = vm.get_signature?.();
      console.log('[Game] Attempting autoload, signature:', gameSignature);

      if (gameSignature) {
        const saveKey = `iftalk_autosave_${gameSignature}`;
        const savedData = localStorage.getItem(saveKey);
        console.log('[Game] Checking for autosave at key:', saveKey);
        console.log('[Game] Autosave data exists:', !!savedData);

        if (savedData) {
          console.log('[Game] Found autosave, restoring...');
          const { autoLoad } = await import('./save-manager.js');
          const success = await autoLoad();
          console.log('[Game] Autoload result:', success);
          // Only try once
          window.attemptAutoload = () => {};
          // Return 'loaded' string if successful so voxglk knows to skip autosave
          return success ? 'loaded' : false;
        } else {
          console.log('[Game] No autosave found, starting fresh');
          return false;
        }
      } else {
        console.log('[Game] No game signature available yet');
      }
    };

    // Prepare options for Glk
    const options = {
      vm: vm,
      Glk: window.Glk,
      GlkOte: voxglk,  // Pass VoxGlk as GlkOte - duck typing!
      Dialog: window.Dialog,
      do_vm_autosave: true  // Enable automatic saves every turn
    };

    // Prepare VM with story data
    vm.prepare(storyData, options);

    // Initialize Glk - this starts everything!
    console.log('[StartGame] Initializing Glk with options:', options);
    window.Glk.init(options);
    // Glk.init() will:
    // 1. Set options.accept to its internal handler
    // 2. Call customDisplay.init(options)
    // 3. customDisplay.init() will call options.accept({type: 'init'})
    // 4. Glk will call vm.start()
    // 5. Game output will come through customDisplay.update()
    console.log('[StartGame] Glk.init() completed');

    updateStatus('Ready - Game loaded');
    console.log('[StartGame] ========== START GAME COMPLETED ==========');

    // Fade out loading overlay
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
      loadingOverlay.classList.add('fade-out');
      console.log('[StartGame] Loading overlay fade-out triggered');
      // Remove from DOM after animation completes
      loadingOverlay.addEventListener('transitionend', () => {
        loadingOverlay.remove();
        console.log('[StartGame] Loading overlay removed from DOM');
      }, { once: true });
    }

    // Save as last played game for auto-resume
    localStorage.setItem('iftalk_last_game', gamePath);
    console.log('[Game] Saved as last played game:', gamePath);

    // Reset narration state
    resetNarrationState();
    updateNavButtons();

    // Don't auto-start talk mode - user clicks the talk mode button to enable

    // Stop any existing narration
    stopNarration();

  } catch (error) {
    console.error('[StartGame] ========== ERROR ==========');
    console.error('[StartGame] Error:', error);
    console.error('[StartGame] Stack:', error.stack);
    updateStatus('Error: ' + error.message);
  }
}

/**
 * Send command to the game
 * @param {string} cmd - Command to send
 */
export function sendCommandToGame(cmd) {
  const input = cmd !== undefined ? cmd : '';

  // Get the current input type from VoxGlk (game may want 'char' or 'line')
  const type = getInputType();

  // For char input with empty string, send Enter key
  const text = (type === 'char' && input === '') ? '\n' : input;

  // Send through our custom display layer with correct type
  sendInput(text, type);
}

/**
 * Initialize game selection handlers
 * @param {Function} onOutput - Callback for game output (for TTS)
 * @param {Function} startTalkMode - Function to start talk mode
 */
export function initGameSelection(onOutput, startTalkMode) {
  // Game card click handlers
  const gameCards = document.querySelectorAll('.game-card');
  console.log('[GameSelection] Found', gameCards.length, 'game cards');

  gameCards.forEach((card, index) => {
    console.log('[GameSelection] Setting up click handler for card', index, 'data-game:', card.dataset.game);
    card.addEventListener('click', (e) => {
      console.log('[GameSelection] 🎮 CLICK EVENT on game card', index);
      console.log('[GameSelection] Event target:', e.target);
      console.log('[GameSelection] Current target:', e.currentTarget);
      const gamePath = card.dataset.game;
      console.log('[GameSelection] Game path from dataset:', gamePath);
      console.log('[GameSelection] Calling startGame with path:', gamePath);
      startGame(gamePath, onOutput, startTalkMode);
    });
  });

  // Select game button (reload page)
  if (dom.selectGameBtn) {
    dom.selectGameBtn.addEventListener('click', () => {
      // Clear last game so it doesn't auto-load
      localStorage.removeItem('iftalk_last_game');
      location.reload();
    });
  }

  // Restart game button (set flag to skip autoload, then reload)
  const restartGameBtn = document.getElementById('restartGameBtn');
  if (restartGameBtn) {
    restartGameBtn.addEventListener('click', () => {
      // Set flag to skip autoload on next page load
      localStorage.setItem('iftalk_skip_autoload', 'true');
      console.log('[GameSelection] Set skip_autoload flag');
      // Reload to restart the game from beginning
      location.reload();
    });
  }

  // Auto-load last played game if it exists
  const lastGame = localStorage.getItem('iftalk_last_game');
  console.log('[GameSelection] Checking for last played game...', lastGame);
  if (lastGame) {
    console.log('[GameSelection] ⚠️ AUTO-LOADING last played game:', lastGame);
    // Use setTimeout to ensure DOM is ready
    setTimeout(() => {
      console.log('[GameSelection] Timeout fired, calling startGame for auto-load');
      startGame(lastGame, onOutput, startTalkMode);
    }, 100);
  } else {
    console.log('[GameSelection] No last game found, showing welcome screen');
    // Fade out loading overlay to reveal welcome screen
    setTimeout(() => {
      const loadingOverlay = document.getElementById('loadingOverlay');
      if (loadingOverlay) {
        loadingOverlay.classList.add('fade-out');
        console.log('[GameSelection] Loading overlay fade-out for welcome screen');
        // Remove from DOM after animation completes
        loadingOverlay.addEventListener('transitionend', () => {
          loadingOverlay.remove();
          console.log('[GameSelection] Loading overlay removed from DOM');
        }, { once: true });
      }
    }, 100);
  }
}
