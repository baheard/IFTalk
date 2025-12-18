/**
 * VoxGlk - Voice-Enabled Glk Display Engine
 *
 * Custom Glk display layer for IFTalk that renders beautiful frotz-style HTML
 * and integrates seamlessly with TTS/voice features.
 */

import { renderUpdate } from './voxglk-renderer.js';
import { addGameText, clearGameOutput } from '../ui/game-output.js';
import { state } from '../core/state.js';

/**
 * State
 */
let generation = 0;
let windows = new Map();
let onTextOutput = null; // Callback for TTS
let acceptCallback = null; // Callback to send input back to Glk
let inputEnabled = false; // Is input currently enabled?
let inputType = null; // Type of input requested: 'line' or 'char' (null until game requests)
let inputWindowId = null; // Window ID for the current input request
let lastStatusLine = ''; // Track status line for scene change detection
let resizeTimeout = null; // Debounce resize events
let skipFirstAutosave = false; // Skip first autosave if we're about to restore
let skipNextUpdateAfterBootstrap = false; // Skip next update after bootstrap input (suppress "I beg your pardon")
let autosaveCounter = 0; // Count autosaves to skip the first N

/**
 * Calculate metrics based on actual window dimensions
 * @returns {Object} Metrics object for Glk
 */
function calculateMetrics() {
  // Get game output container
  const gameOutput = document.getElementById('gameOutput');
  if (!gameOutput) {
    // Fallback to hardcoded values
    return {
      width: 800,
      height: 600,
      outspacingx: 0,
      outspacingy: 0,
      inspacingx: 0,
      inspacingy: 0,
      buffercharwidth: 8,
      buffercharheight: 16,
      buffermarginx: 0,
      buffermarginy: 0,
      gridcharwidth: 8,
      gridcharheight: 16,
      gridmarginx: 0,
      gridmarginy: 0,
      graphicsmarginx: 0,
      graphicsmarginy: 0
    };
  }

  // Get actual dimensions
  const rect = gameOutput.getBoundingClientRect();
  const width = Math.floor(rect.width) || 800;
  const height = Math.floor(rect.height) || 600;

  // Measure character dimensions using a temporary element
  const testDiv = document.createElement('div');
  testDiv.style.cssText = 'position: absolute; visibility: hidden; font-family: var(--font-mono); font-size: 16px; line-height: 1.4; white-space: pre;';
  testDiv.textContent = 'M'.repeat(10); // Use 10 characters to get average
  document.body.appendChild(testDiv);

  const testRect = testDiv.getBoundingClientRect();
  const charWidth = Math.ceil(testRect.width / 10) || 8;
  const charHeight = Math.ceil(testRect.height) || 16;

  document.body.removeChild(testDiv);

  return {
    width: width,
    height: height,
    outspacingx: 0,
    outspacingy: 0,
    inspacingx: 0,
    inspacingy: 0,
    buffercharwidth: charWidth,
    buffercharheight: charHeight,
    buffermarginx: 0,
    buffermarginy: 0,
    gridcharwidth: charWidth,
    gridcharheight: charHeight,
    gridmarginx: 0,
    gridmarginy: 0,
    graphicsmarginx: 0,
    graphicsmarginy: 0
  };
}

/**
 * Handle window resize - send arrange event to Glk
 */
function handleResize() {
  if (!acceptCallback) return;

  // Debounce resize events
  if (resizeTimeout) {
    clearTimeout(resizeTimeout);
  }

  resizeTimeout = setTimeout(() => {
    const metrics = calculateMetrics();

    acceptCallback({
      type: 'arrange',
      gen: generation,
      metrics: metrics
    });
  }, 250); // Wait 250ms after resize stops
}

/**
 * Create VoxGlk display interface
 * This is what Glk will use (passed as options.GlkOte)
 *
 * @param {Function} textOutputCallback - Callback for TTS (receives plain text)
 * @returns {Object} - VoxGlk interface with init(), update(), error() methods
 */
export function createVoxGlk(textOutputCallback) {
  onTextOutput = textOutputCallback;

  const voxglk = {
    /**
     * Called by Glk.init() when it's ready
     * Setup display, then call options.accept({type: 'init'}) to start the game
     */
    init: function(options) {
      generation = 0;
      windows.clear();
      lastStatusLine = '';
      inputEnabled = false;
      inputType = 'line';
      inputWindowId = null;
      autosaveCounter = 0; // Reset counter for new game session

      // Store the accept callback - we'll use it to send input later
      acceptCallback = options.accept;

      // Clear display and hide windows initially
      const statusBar = document.getElementById('statusBar');
      const upperWindow = document.getElementById('upperWindow');
      const lowerWindow = document.getElementById('lowerWindow');

      if (statusBar) {
        statusBar.innerHTML = '';
        statusBar.style.display = 'none'; // Start hidden
      }
      if (upperWindow) {
        upperWindow.innerHTML = '';
        upperWindow.style.display = 'none'; // Start hidden
      }
      if (lowerWindow) {
        // Extract command line first (it might be nested)
        const commandLine = document.getElementById('commandLine');

        // Clear everything
        lowerWindow.innerHTML = '';

        // Re-append command line
        if (commandLine) {
          lowerWindow.appendChild(commandLine);
        }
      }

      // Set up window resize listener
      window.addEventListener('resize', handleResize);

      // Tell Glk we're ready - this will trigger VM.start()
      if (acceptCallback) {
        const metricsObj = calculateMetrics();

        acceptCallback({
          type: 'init',
          gen: generation,
          metrics: metricsObj
        });
      }
    },

    /**
     * Called by Glk when the game has output
     * This is where VoxGlk renders the game data to beautiful HTML
     */
    update: async function(arg) {
      try {

        // Track generation (Glk uses this to prevent old input)
        // Always update generation from Glk - this is the current turn number
        if (arg.gen !== undefined) {
          generation = arg.gen;
        }

        // Suppress output after bootstrap input (the "I beg your pardon" response)
        if (skipNextUpdateAfterBootstrap) {
          console.log('[VoxGlk] Suppressing update after bootstrap input');
          skipNextUpdateAfterBootstrap = false;

          // Still process input requests so the game can continue
          if (arg.input) {
            const inputTypes = arg.input.map(i => i.type);
            inputType = inputTypes.includes('char') ? 'char' : 'line';
            inputEnabled = true;
            if (arg.input.length > 0 && arg.input[0].id !== undefined) {
              inputWindowId = arg.input[0].id;
            }
            console.log('[VoxGlk] Input request after bootstrap:', { type: inputType, enabled: inputEnabled });
          }
          return; // Skip rendering
        }

        // Process window definitions
        if (arg.windows) {
          arg.windows.forEach(win => {
            windows.set(win.id, win);
          });
        }

        // Auto-restore AFTER first update completes (VM is fully running)
        let shouldSkipAutosave = false;
        if (window.shouldAutoRestore) {
          console.log('[VoxGlk] Will trigger auto-restore after this update completes...');
          window.shouldAutoRestore = false; // Only once

          // Let this update complete normally, then restore
          setTimeout(async () => {
            try {
              console.log('[VoxGlk] Auto-restore triggered after initial update completed');
              const { autoLoad } = await import('./save-manager.js');
              const restored = await autoLoad();

              if (restored) {
                console.log('[VoxGlk] ✅ Auto-restore successful');
                console.log('[VoxGlk] acceptCallback exists:', !!acceptCallback);
                console.log('[VoxGlk] zvmInstance exists:', !!window.zvmInstance);
                // VM state and display HTML restored
                // VoxGlk state (generation, inputWindowId) restored by save-manager

                // Wake VM by sending dummy input to fulfill intro char request
                setTimeout(() => {
                  console.log('[VoxGlk] Sending dummy input to wake VM...');

                  // Set flag to suppress next update (the "I beg your pardon" response)
                  skipNextUpdateAfterBootstrap = true;

                  // The intro screen char request was created at gen: 1
                  // We need to fulfill it with gen: 1, not the restored gen: 5
                  acceptCallback({
                    type: 'char',
                    gen: 1,  // Intro's original generation
                    window: 1,
                    value: 10  // Enter key
                  });

                  console.log('[VoxGlk] Dummy char input sent (gen: 1) - will suppress next update');
                }, 100);
              } else {
                console.log('[VoxGlk] Auto-restore returned false');
              }
            } catch (error) {
              console.error('[VoxGlk] Auto-restore failed:', error);
            }
          }, 100);
        }

        // Use VoxGlk renderer to convert to frotz HTML
        if (arg.content) {
          const { statusBarHTML, statusBarText, upperWindowHTML, upperWindowText, mainWindowHTML, plainText } = renderUpdate(arg, windows);

          // Check if upper window was explicitly mentioned in this update
          const hasUpperWindowContent = arg.content.some(c => {
            const win = windows.get(c.id);
            return win && win.type === 'grid' && c.lines && c.lines.length > 1;
          });

          // Log all grid windows for debugging
          arg.content.forEach(c => {
            const win = windows.get(c.id);
            if (win && win.type === 'grid') {
            }
          });


          // Track status bar changes for TTS (but don't auto-clear screen)
          const statusBarChanged = statusBarHTML !== lastStatusLine;

          // Only clear screen when game explicitly requests it
          const shouldClearScreen = arg.content.some(c => c.clear);

          if (shouldClearScreen) {
            clearGameOutput();
          }

          // Render status bar (1 line only)
          const statusBarEl = document.getElementById('statusBar');
          if (statusBarHTML) {
            if (statusBarEl) {
              statusBarEl.innerHTML = statusBarHTML;
              statusBarEl.style.display = ''; // Show status bar
              // Store reference for chunking
              window.currentStatusBarElement = statusBarEl;
            }
            lastStatusLine = statusBarHTML;
          }
          // NOTE: Don't clear status bar if not in update - preserve it
          // The game doesn't send status bar on every update

          // Render upper window (multi-line quotes, maps, etc.)
          const upperWindowEl = document.getElementById('upperWindow');
          const hasMainContent = mainWindowHTML && mainWindowHTML.trim();

          if (hasUpperWindowContent) {
            // Upper window was mentioned in this update - update it (even if empty)
            if (upperWindowHTML && upperWindowEl) {
              upperWindowEl.innerHTML = upperWindowHTML;
              upperWindowEl.style.display = ''; // Show upper window

            } else if (upperWindowEl) {
              // Explicitly clear upper window
              upperWindowEl.innerHTML = '';
              upperWindowEl.style.display = 'none';
            }
          } else if (shouldClearScreen && upperWindowEl) {
            // Game requested screen clear - clear upper window too
            upperWindowEl.innerHTML = '';
            upperWindowEl.style.display = 'none';
          } else if (hasMainContent && upperWindowEl && !hasUpperWindowContent) {
            // New main content arrived without upper window update - clear stale upper window
            upperWindowEl.innerHTML = '';
            upperWindowEl.style.display = 'none';
          }
          // NOTE: If no main content and upper window wasn't mentioned, preserve existing content (resize responses)

          // Render lower window (main scrolling text)
          if (mainWindowHTML && mainWindowHTML.trim()) {
            addGameText(mainWindowHTML, false); // false = not a command
          }

          // Send plain text to TTS callback
          // IMPORTANT: Only include status bar if it CHANGED (don't re-read same status)
          let textForTTS = '';

          if (statusBarText && statusBarText.trim() && statusBarChanged) {
            textForTTS = statusBarText + '\n\n';
            // Mark that status bar should be included in chunks
            window.includeStatusBarInChunks = true;
          } else {
            // Don't include status bar in chunks
            window.includeStatusBarInChunks = false;
          }
          // Add upper window text if present
          if (upperWindowText && upperWindowText.trim()) {
            textForTTS += upperWindowText + '\n\n';
          }
          if (plainText.trim()) {
            textForTTS += plainText;
          }


          if (textForTTS.trim() && onTextOutput) {
            onTextOutput(textForTTS);
          }
        }

        // Handle input requests
        if (arg.input) {
          const inputTypes = arg.input.map(i => i.type);

          // Determine if we need char or line input
          inputType = inputTypes.includes('char') ? 'char' : 'line';
          inputEnabled = true;

          // Store the window ID from the first input request
          if (arg.input.length > 0 && arg.input[0].id !== undefined) {
            inputWindowId = arg.input[0].id;
          }

          console.log('[VoxGlk] Input request:', { type: inputType, enabled: inputEnabled, windowId: inputWindowId });

          // Note: Command line visibility is handled automatically by keyboard.js polling

          // Only autosave on line input (not char input)
          const shouldAutosaveThisTurn = inputType === 'line';

          // Skip first 2 autosaves (intro + first blank command)
          // This counter resets on every page load (including restore)
          const shouldSkipFirstN = autosaveCounter < 2;
          if (shouldSkipFirstN && shouldAutosaveThisTurn) {
            autosaveCounter++;
            console.log('[VoxGlk] Skipping autosave', autosaveCounter, 'of 2');
          }

          // Auto-save after each turn (only on line input, skip first 2)
          if (!shouldSkipAutosave && !skipFirstAutosave && shouldAutosaveThisTurn && !shouldSkipFirstN) {
            setTimeout(async () => {
              try {
                const { autoSave } = await import('./save-manager.js');
                await autoSave();
                console.log('[VoxGlk] Auto-saved (autosave count:', autosaveCounter + 1, ')');
              } catch (error) {
                console.error('[VoxGlk] Auto-save failed:', error);
              }
            }, 100);
          } else if (skipFirstAutosave) {
            console.log('[VoxGlk] Skipping first autosave (will restore from saved state)');
            skipFirstAutosave = false; // Only skip once
          } else if (!shouldAutosaveThisTurn) {
            console.log('[VoxGlk] Not autosaving (input type is', inputType, ', only save on line input)');
          }
        } else {
          console.log('[VoxGlk] No input request in this update');
        }

      } catch (error) {
        console.error('[VoxGlk] Error in update():', error);
      }
    },

    /**
     * Called by ZVM on fatal errors
     */
    error: function(msg) {
      console.error('[VoxGlk] Fatal error:', msg);
      alert('Game Error: ' + msg);
    },

    /**
     * Optional logging
     */
    log: function(msg) {
      // Silent logging - can be enabled for debugging if needed
    },

    /**
     * Get reference to a library (Dialog, etc.)
     */
    getlibrary: function(name) {
      if (name === 'Dialog') {
        return window.Dialog;
      }
      return null;
    },

    /**
     * Save display state (for autosave)
     */
    save_allstate: function() {
      // Save the current display content so it can be restored
      const statusBarEl = document.getElementById('statusBar');
      const upperWindowEl = document.getElementById('upperWindow');
      const lowerWindowEl = document.getElementById('lowerWindow');

      return {
        generation: generation,
        inputWindowId: inputWindowId,
        displayState: {
          statusBarHTML: statusBarEl?.innerHTML || '',
          upperWindowHTML: upperWindowEl?.innerHTML || '',
          lowerWindowHTML: lowerWindowEl?.innerHTML || ''
        }
      };
    },

    /**
     * Restore VoxGlk state after VM restore
     */
    restore_state: function(savedGeneration, savedInputWindowId) {
      console.log('[VoxGlk] Restoring VoxGlk state:', { savedGeneration, savedInputWindowId });
      generation = savedGeneration;
      inputWindowId = savedInputWindowId;
      inputEnabled = true;
      inputType = 'line';
      console.log('[VoxGlk] VoxGlk state restored:', { generation, inputWindowId, inputEnabled, inputType });
    },

    /**
     * Display a warning message
     */
    warning: function(msg) {
      console.warn('[VoxGlk] Warning:', msg);
    }
  };

  // Store instance globally for access from save-manager
  window._voxglkInstance = voxglk;

  return voxglk;
}

/**
 * Send input to the game
 * Call this when the user submits a command
 *
 * @param {string} text - User input text
 * @param {string} type - Input type ('line' or 'char')
 */
export function sendInput(text, type = 'line') {
  console.log('[VoxGlk] sendInput called:', { text, type, generation, inputWindowId, inputEnabled });

  if (!acceptCallback) {
    console.error('[VoxGlk] No accept callback - game not initialized');
    return;
  }

  // Build input event based on type
  let inputEvent;

  if (type === 'char') {
    // Character input: send character code
    // text can be either a string (regular character) or a number (special keycode)
    const charCode = typeof text === 'number' ? text : (text.length > 0 ? text.charCodeAt(0) : 0);
    inputEvent = {
      type: 'char',
      gen: generation,
      window: inputWindowId,
      value: charCode
    };
  } else {
    // Line input: send text string
    inputEvent = {
      type: 'line',
      gen: generation,
      window: inputWindowId,
      value: text,
      terminator: 'enter'
    };
  }

  console.log('[VoxGlk] Sending input event to VM:', inputEvent);

  // Send the input event to Glk
  acceptCallback(inputEvent);

  console.log('[VoxGlk] Input event sent, disabling input');

  // Disable input until next request
  inputEnabled = false;
}


/**
 * Get current generation (for debugging)
 */
export function getGeneration() {
  return generation;
}

/**
 * Check if input is currently enabled
 */
export function isInputEnabled() {
  return inputEnabled;
}

/**
 * Get current input type ('line' or 'char')
 */
export function getInputType() {
  return inputType;
}

/**
 * Get current input window ID
 */
export function getInputWindowId() {
  return inputWindowId;
}

/**
 * Set flag to skip first autosave (when restoring from saved state)
 */
export function setSkipFirstAutosave(skip) {
  skipFirstAutosave = skip;
  console.log('[VoxGlk] skipFirstAutosave set to:', skip);
}

/**
 * Get VoxGlk interface for calling restore_state
 */
export function getVoxGlk() {
  return window._voxglkInstance;
}
