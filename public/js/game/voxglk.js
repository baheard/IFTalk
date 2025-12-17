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
    console.log('[VoxGlk] Window resized, sending arrange event:', metrics);

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

  return {
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
        console.log('[VoxGlk] Initial metrics:', metricsObj);

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
        console.log('[VoxGlk] Update called, type:', arg.type, 'has content:', !!arg.content);

        // Track generation (Glk uses this to prevent old input)
        // Always update generation from Glk - this is the current turn number
        if (arg.gen !== undefined) {
          generation = arg.gen;
        }

        // Process window definitions
        if (arg.windows) {
          arg.windows.forEach(win => {
            windows.set(win.id, win);
          });
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
          console.log('[VoxGlk] Grid windows in update:');
          arg.content.forEach(c => {
            const win = windows.get(c.id);
            if (win && win.type === 'grid') {
              console.log('  Window ID:', c.id, 'lines:', c.lines ? c.lines.length : 0);
            }
          });
          console.log('[VoxGlk] hasUpperWindowContent:', hasUpperWindowContent);

          console.log('[VoxGlk] Status bar check:');
          console.log('  Current HTML:', statusBarHTML);
          console.log('  Last HTML:', lastStatusLine);
          console.log('  Are equal:', statusBarHTML === lastStatusLine);

          // Track status bar changes for TTS (but don't auto-clear screen)
          const statusBarChanged = statusBarHTML !== lastStatusLine;
          console.log('  statusBarChanged:', statusBarChanged);

          // Only clear screen when game explicitly requests it
          const shouldClearScreen = arg.content.some(c => c.clear);

          if (shouldClearScreen) {
            console.log('[VoxGlk] Game requested screen clear');
            clearGameOutput();
          }

          // Render status bar (1 line only)
          const statusBarEl = document.getElementById('statusBar');
          if (statusBarHTML) {
            if (statusBarEl) {
              console.log('[VoxGlk] Adding status bar HTML:', statusBarHTML);
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
              console.log('[VoxGlk] Adding upper window HTML:', upperWindowHTML);
              upperWindowEl.innerHTML = upperWindowHTML;
              upperWindowEl.style.display = ''; // Show upper window
            } else if (upperWindowEl) {
              // Explicitly clear upper window
              console.log('[VoxGlk] Clearing upper window (no HTML)');
              upperWindowEl.innerHTML = '';
              upperWindowEl.style.display = 'none';
            }
          } else if (shouldClearScreen && upperWindowEl) {
            // Game requested screen clear - clear upper window too
            console.log('[VoxGlk] Clearing upper window (screen clear)');
            upperWindowEl.innerHTML = '';
            upperWindowEl.style.display = 'none';
          } else if (hasMainContent && upperWindowEl && !hasUpperWindowContent) {
            // New main content arrived without upper window update - clear stale upper window
            console.log('[VoxGlk] Clearing upper window (new page without upper content)');
            upperWindowEl.innerHTML = '';
            upperWindowEl.style.display = 'none';
          }
          // NOTE: If no main content and upper window wasn't mentioned, preserve existing content (resize responses)

          // Render lower window (main scrolling text)
          if (mainWindowHTML && mainWindowHTML.trim()) {
            console.log('[VoxGlk] Adding main window HTML:', mainWindowHTML);
            addGameText(mainWindowHTML, false); // false = not a command
          }

          // Send plain text to TTS callback
          // IMPORTANT: Only include status bar if it CHANGED (don't re-read same status)
          let textForTTS = '';
          console.log('[VoxGlk] TTS decision:');
          console.log('  statusBarText:', statusBarText);
          console.log('  statusBarChanged:', statusBarChanged);

          if (statusBarText && statusBarText.trim() && statusBarChanged) {
            console.log('  ✓ Including status bar in TTS');
            textForTTS = statusBarText + '\n\n';
            // Mark that status bar should be included in chunks
            window.includeStatusBarInChunks = true;
          } else {
            console.log('  ✗ Skipping status bar (unchanged)');
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

          console.log('[VoxGlk] Final TTS text length:', textForTTS.length);

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

          console.log('[VoxGlk] Input type set to:', inputType);
          // Note: Command line visibility is handled automatically by keyboard.js polling

          // Try to autoload on input requests (game is ready)
          let shouldSkipAutosave = false;
          if (window.attemptAutoload) {
            console.log('[VoxGlk] Triggering autoload attempt');
            const autoloadResult = await window.attemptAutoload();
            console.log('[VoxGlk] Autoload result:', autoloadResult, 'type:', typeof autoloadResult);

            // If autoload happened, skip autosave (don't overwrite what we just loaded)
            if (autoloadResult === 'loaded') {
              console.log('[VoxGlk] Autoload succeeded, skipping autosave');
              shouldSkipAutosave = true;
            } else {
              console.log('[VoxGlk] Autoload result was not "loaded", will autosave. Result was:', autoloadResult);
            }

            // If this is the first char input (press any key prompt), auto-send a key
            if (autoloadResult === true && inputType === 'char') {
              console.log('[VoxGlk] Auto-sending space key to skip intro prompt');
              setTimeout(() => {
                // Send space character
                if (acceptCallback) {
                  acceptCallback({
                    type: 'char',
                    gen: generation,
                    window: inputWindowId,
                    value: 32 // space character code
                  });
                }
              }, 100);
            }
          }

          // Auto-save after each turn (skip if we just autoloaded)
          if (!shouldSkipAutosave) {
            setTimeout(async () => {
              try {
                const { autoSave } = await import('./save-manager.js');
                await autoSave();
                console.log('[VoxGlk] Autosaved after input request');
              } catch (error) {
                console.error('[VoxGlk] Auto-save failed:', error);
              }
            }, 100);
          }
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
      return {
        generation: generation
      };
    },

    /**
     * Display a warning message
     */
    warning: function(msg) {
      console.warn('[VoxGlk] Warning:', msg);
    }
  };
}

/**
 * Send input to the game
 * Call this when the user submits a command
 *
 * @param {string} text - User input text
 * @param {string} type - Input type ('line' or 'char')
 */
export function sendInput(text, type = 'line') {
  if (!acceptCallback) {
    console.error('[VoxGlk] No accept callback - game not initialized');
    return;
  }

  // Build input event based on type
  let inputEvent;

  if (type === 'char') {
    // Character input: send character code
    const charCode = text.length > 0 ? text.charCodeAt(0) : 0;
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

  // Send the input event to Glk
  acceptCallback(inputEvent);

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
