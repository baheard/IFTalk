/**
 * Game Loader Module
 *
 * Handles game selection and initialization using browser-based ZVM + GlkOte.
 */

import { state, resetNarrationState } from '../core/state.js';
import { dom } from '../core/dom.js';
import { updateStatus } from '../utils/status.js';
import { updateNavButtons } from '../ui/nav-buttons.js';
import { stopNarration } from '../narration/tts-player.js';

/**
 * Track the last generation number received from GlkOte
 * We'll use this to send the correct generation in responses
 */
let lastReceivedGeneration = 0;

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
    console.log('[Game] Starting:', state.currentGameName);

    updateStatus('Starting game...', 'processing');

    // Hide welcome, show gameport and input
    if (dom.welcome) dom.welcome.classList.add('hidden');
    const gameport = document.getElementById('gameport');
    if (gameport) gameport.classList.remove('hidden');
    if (dom.inputArea) dom.inputArea.classList.remove('hidden');

    console.log('[ZVM] Loading game:', gamePath);

    // Verify libraries are loaded
    if (typeof window.ZVM === 'undefined') {
      console.error('[ZVM] ZVM library not loaded');
      updateStatus('Error: Game engine not loaded');
      return;
    }
    if (typeof window.Glk === 'undefined') {
      console.error('[ZVM] Glk library not loaded');
      updateStatus('Error: Glk library not loaded');
      return;
    }
    if (typeof window.GlkOte === 'undefined') {
      console.error('[ZVM] GlkOte library not loaded');
      updateStatus('Error: GlkOte library not loaded');
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
    console.log('[ZVM] Story file loaded:', storyData.byteLength, 'bytes');

    // Create ZVM instance
    const vm = new window.ZVM();
    window.zvmInstance = vm;

    // Prepare VM with story data BEFORE GlkOte.init()
    console.log('[ZVM] Preparing VM...');
    const options = {
      vm: vm,
      Glk: window.Glk,
      GlkOte: window.GlkOte,
      Dialog: window.Dialog
    };
    vm.prepare(storyData, options);

    // Create Game interface for GlkOte
    window.Game = {
      gameport: 'gameport',  // ID of the container element
      spacing: 4,
      accept: function(event) {
        console.log('[Game] Received event:', event.type);

        if (event.type === 'init') {
          // GlkOte has measured the gameport and provided metrics
          console.log('[Game] Init event received with metrics');

          // Initialize Glk first
          console.log('[ZVM] Initializing Glk...');
          window.Glk.init(options);
          console.log('[ZVM] Glk initialized');

          // Start VM after GlkOte UI is fully ready
          // Wait for next animation frame to ensure DOM is settled
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              try {
                console.log('[ZVM] Starting VM...');
                window.zvmInstance.start();
                console.log('[ZVM] VM started successfully');
              } catch (e) {
                console.warn('[ZVM] VM start error (may be non-fatal):', e.message);
                console.error('[ZVM] Full error:', e);
              }
            });
          });

          console.log('[ZVM] Game initialized successfully');
          updateStatus('Ready - Game loaded');

          // Reset generation tracking for new game
          lastReceivedGeneration = 0;

          // Reset narration state
          resetNarrationState();

          updateNavButtons();
          if (dom.userInput) dom.userInput.focus();
        } else if (event.type === 'line' || event.type === 'char') {
          // Handle user input events
          console.log('[Game] Input event:', event);
          // Track the generation from GlkOte's event
          if (event.gen !== undefined) {
            lastReceivedGeneration = event.gen;
          }
          vm.resume(event);
        } else if (event.type === 'specialresponse') {
          // Handle file operations
          console.log('[Game] Special response:', event);
          if (event.gen !== undefined) {
            lastReceivedGeneration = event.gen;
          }
          vm.resume(event);
        }
      }
    };

    // Verify gameport element exists
    const gameportEl = document.getElementById('gameport');
    if (!gameportEl) {
      throw new Error('Gameport element not found');
    }
    console.log('[ZVM] Gameport element found:', gameportEl);

    // Initialize GlkOte - it will use the global window.Game object
    // GlkOte will measure the gameport and call Game.accept() with init event
    console.log('[ZVM] Initializing GlkOte...');
    try {
      window.GlkOte.init();
      console.log('[ZVM] GlkOte.init() called successfully');

      // Hook into GlkOte.update() for output capture
      if (onOutput) {
        hookGlkOteOutput(onOutput);
      }
    } catch (error) {
      console.error('[ZVM] GlkOte.init() error:', error);
      throw error;
    }

    // Stop any existing narration
    stopNarration();

  } catch (error) {
    console.error('[Game] Start error:', error);
    updateStatus('Error: ' + error.message);
  }
}

/**
 * Hook into GlkOte.update() to capture game output for TTS
 * @param {Function} onOutput - Callback for game output
 */
function hookGlkOteOutput(onOutput) {
  if (typeof GlkOte === 'undefined' || !GlkOte.update) {
    console.warn('[Game] GlkOte.update not available for output capture');
    return;
  }

  console.log('[Game] Hooking GlkOte.update for output capture');

  // Save original update function
  const originalUpdate = GlkOte.update;

  // Wrap update to capture text output
  GlkOte.update = function(updateObj) {
    try {
      // Extract text from content structure
      if (updateObj && updateObj.content) {
        let capturedText = '';

        updateObj.content.forEach(windowContent => {
          if (windowContent.text) {
            windowContent.text.forEach(textBlock => {
              if (textBlock.content) {
                textBlock.content.forEach(run => {
                  // Check different possible text formats
                  if (typeof run === 'string') {
                    capturedText += run;
                  } else if (Array.isArray(run) && run.length >= 2) {
                    // Format: ['style', 'text']
                    capturedText += run[1] || '';
                  } else if (run.text) {
                    capturedText += run.text;
                  }
                });
              }
            });
          }
        });

        // If we captured text, pass it to the callback
        if (capturedText.trim()) {
          console.log('[Game] Captured output:', capturedText.substring(0, 100) + '...');
          onOutput(capturedText);
        }
      }
    } catch (error) {
      console.error('[Game] Error capturing output:', error);
    }

    // Call original update function
    return originalUpdate.call(this, updateObj);
  };
}

/**
 * Send command directly to ZVM
 * @param {string} cmd - Command to send
 */
export function sendCommandToGame(cmd) {
  const input = cmd !== undefined ? cmd : (dom.userInput ? dom.userInput.value : '');

  console.log('[Game] Sending command:', input);

  // Send line input event to ZVM via Game.accept()
  try {
    if (typeof Game !== 'undefined' && Game.accept && window.zvmInstance) {
      // Use the generation number from the last event we received
      // GlkOte expects us to respond with the same generation it sent
      const genToSend = lastReceivedGeneration;
      Game.accept({
        type: 'line',
        gen: genToSend,
        value: input,
        terminator: 'enter'
      });
      console.log('[Game] Command sent (gen ' + genToSend + ')');
    } else {
      console.error('[Game] Game not initialized');
    }
  } catch (error) {
    console.error('[Game] Error sending command:', error);
  }
}

/**
 * Initialize game selection handlers
 * @param {Function} onOutput - Callback for game output (for TTS)
 */
export function initGameSelection(onOutput) {
  // Game card click handlers
  document.querySelectorAll('.game-card').forEach(card => {
    card.addEventListener('click', () => {
      const gamePath = card.dataset.game;
      startGame(gamePath, onOutput);
    });
  });

  // Select game button (reload page)
  if (dom.selectGameBtn) {
    dom.selectGameBtn.addEventListener('click', () => {
      location.reload();
    });
  }
}
