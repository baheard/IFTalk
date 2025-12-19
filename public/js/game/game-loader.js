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
import { updateCurrentGameDisplay, reloadSettingsForGame } from '../ui/settings.js';

/**
 * Start a game using browser-based ZVM
 * @param {string} gamePath - Path to game file
 * @param {Function} onOutput - Callback for game output (for TTS)
 */
export async function startGame(gamePath, onOutput) {

  try {
    state.currentGamePath = gamePath;
    // Set game name for save/restore
    state.currentGameName = gamePath.split('/').pop().replace(/\.[^.]+$/, '').toLowerCase();

    // Update game name display in settings
    updateCurrentGameDisplay(gamePath.split('/').pop());

    // Reload per-game settings (voices, speech rate, etc.)
    reloadSettingsForGame();

    updateStatus('Starting game...', 'processing');

    // Hide welcome, show game output and controls
    if (dom.welcome) dom.welcome.classList.add('hidden');
    const gameOutput = document.getElementById('gameOutput');
    if (gameOutput) gameOutput.classList.remove('hidden');

    // Show controls and message input
    const controls = document.getElementById('controls');
    if (controls) controls.classList.remove('hidden');
    const messageInputRow = document.getElementById('messageInputRow');
    if (messageInputRow) messageInputRow.classList.remove('hidden');
    const charInputPanel = document.getElementById('charInputPanel');
    if (charInputPanel) charInputPanel.classList.add('hidden'); // Hidden initially, shown by updateInputVisibility

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
      Dialog: window.Dialog,
      do_vm_autosave: false  // Disabled - ifvms.js autosave only works for Glulx, not Z-machine
    };

    // Prepare VM with story data
    vm.prepare(storyData, options);

    // Check if user requested to skip autoload (restart game)
    const skipAutoload = localStorage.getItem('iftalk_skip_autoload');
    if (skipAutoload === 'true') {
      localStorage.removeItem('iftalk_skip_autoload');
      localStorage.removeItem(`iftalk_autosave_${state.currentGameName}`);
    }

    // Check for pending restore request (from 'R' key restore dialog)
    const pendingRestoreJson = sessionStorage.getItem('iftalk_pending_restore');
    if (pendingRestoreJson) {
      sessionStorage.removeItem('iftalk_pending_restore');
      try {
        const pendingRestore = JSON.parse(pendingRestoreJson);
        // Set flag for restore - VoxGlk will handle it
        window.shouldAutoRestore = true;
        window.pendingRestoreType = pendingRestore.type;
        window.pendingRestoreKey = pendingRestore.key;
      } catch (e) {
        console.error('[GameLoader] Failed to parse pending restore:', e);
      }
    }

    // Check for autosave - will restore after VM starts (on first update)
    const autosaveKey = `iftalk_autosave_${state.currentGameName}`;
    const hasAutosave = !skipAutoload && !pendingRestoreJson && localStorage.getItem(autosaveKey) !== null;


    // Flag to trigger auto-restore on first update (after VM is running)
    if (hasAutosave) {
      window.shouldAutoRestore = true;
    }

    // Initialize Glk - this starts everything!
    window.Glk.init(options);
    // Glk.init() will:
    // 1. Set options.accept to its internal handler
    // 2. Call customDisplay.init(options)
    // 3. customDisplay.init() will call options.accept({type: 'init'})
    // 4. Glk will call vm.start()
    // 5. Game output will come through customDisplay.update()

    // Autosave restore is now done BEFORE Glk.init() above (no delayed restore needed)

    updateStatus('Ready - Game loaded');

    // Fade out loading overlay (with delay for content to settle)
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
      // Wait 200ms before starting fade to let content load
      setTimeout(() => {
        loadingOverlay.classList.add('fade-out');
        // Remove from DOM after animation completes
        loadingOverlay.addEventListener('transitionend', () => {
          loadingOverlay.remove();

          // Dispatch event so save-manager knows fade is complete
          window.dispatchEvent(new CustomEvent('loadingFadeComplete'));

          // Focus command input after overlay is gone (if not restoring)
          if (!hasAutosave) {
            setTimeout(() => {
              const messageInput = document.getElementById('messageInput');
              if (messageInput) {
                messageInput.focus();
              }
            }, 100);
          }
        }, { once: true });
      }, 200);
    }

    // Save as last played game for auto-resume
    localStorage.setItem('iftalk_last_game', gamePath);

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
 */
export function initGameSelection(onOutput) {
  // Game card click handlers
  const gameCards = document.querySelectorAll('.game-card');

  gameCards.forEach((card, index) => {
    card.addEventListener('click', (e) => {
      const gamePath = card.dataset.game;
      startGame(gamePath, onOutput);
    });

    // Check for autosave and update badge
    const gamePath = card.dataset.game;
    if (gamePath) {
      const gameName = gamePath.split('/').pop().replace(/\.[^.]+$/, '').toLowerCase();
      const autosaveKey = `iftalk_autosave_${gameName}`;
      const hasSave = localStorage.getItem(autosaveKey) !== null;

      const badge = card.querySelector('[data-save-indicator]');
      if (badge && hasSave) {
        badge.classList.add('has-save');
      }
    }
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
      // Show confirmation dialog
      const confirmed = confirm(
        '⚠️ Restart Game?\n\n' +
        'This will restart the game from the beginning.\n' +
        'Your autosave will be lost.\n\n' +
        'Are you sure you want to continue?'
      );

      if (confirmed) {
        // Set flag to skip autoload on next page load
        localStorage.setItem('iftalk_skip_autoload', 'true');
        // Reload to restart the game from beginning
        location.reload();
      }
    });
  }

  // Auto-load last played game if it exists
  const lastGame = localStorage.getItem('iftalk_last_game');
  if (lastGame) {
    // Use setTimeout to ensure DOM is ready
    setTimeout(() => {
      startGame(lastGame, onOutput);
    }, 100);
  } else {
    // Fade out loading overlay to reveal welcome screen
    setTimeout(() => {
      const loadingOverlay = document.getElementById('loadingOverlay');
      if (loadingOverlay) {
        loadingOverlay.classList.add('fade-out');
        // Remove from DOM after animation completes
        loadingOverlay.addEventListener('transitionend', () => {
          loadingOverlay.remove();
        }, { once: true });
      }
    }, 100);
  }
}
