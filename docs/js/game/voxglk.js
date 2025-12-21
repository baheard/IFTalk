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
let introInputType = null; // Track the input type from the first request (gen 1) for bootstrap

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
  const actualWidth = Math.floor(rect.width) || 800;
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

  // IMPORTANT: Enforce minimum width for VM to prevent mid-word line breaks
  // Z-machine wraps text at character boundaries based on reported width.
  // On narrow mobile screens, this causes ugly mid-word breaks.
  // By reporting a minimum of 80 columns, we get proper text formatting.
  // CSS handles the actual display/wrapping.
  const MIN_COLUMNS = 80;
  const minWidth = MIN_COLUMNS * charWidth;
  const width = Math.max(actualWidth, minWidth);

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
      introInputType = null; // Reset intro input type for new game

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
          skipNextUpdateAfterBootstrap = false;

          // Still process input requests so the game can continue
          if (arg.input) {
            const inputTypes = arg.input.map(i => i.type);
            inputType = inputTypes.includes('char') ? 'char' : 'line';
            inputEnabled = true;
            if (arg.input.length > 0 && arg.input[0].id !== undefined) {
              inputWindowId = arg.input[0].id;
            }
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
          window.shouldAutoRestore = false; // Only once
          const restoreType = window.pendingRestoreType || 'autosave';
          const restoreKey = window.pendingRestoreKey;
          window.pendingRestoreType = null;
          window.pendingRestoreKey = null;

          // Let this update complete normally, then restore
          setTimeout(async () => {
            try {
              const { autoLoad, quickLoad } = await import('./save-manager.js');

              // Call appropriate load function based on type
              let restored;
              if (restoreType === 'quicksave') {
                restored = await quickLoad();
              } else {
                restored = await autoLoad();
              }

              if (restored) {
                // VM state and display HTML restored
                // VoxGlk state (generation, inputWindowId) restored by save-manager
                console.log('[VoxGlk] Restore successful, sending bootstrap input...');
                console.log('[VoxGlk] Current state - generation:', generation, 'inputWindowId:', inputWindowId, 'inputEnabled:', inputEnabled);

                // Wake VM by sending dummy input to fulfill intro's pending request
                setTimeout(() => {

                  // Set flag to suppress next update (the "I beg your pardon" response)
                  skipNextUpdateAfterBootstrap = true;

                  // The intro screen request was created at gen: 1
                  // We need to fulfill it with gen: 1, not the restored generation
                  // IMPORTANT: Must match the input TYPE the VM expects (captured as introInputType)
                  const bootstrapType = introInputType || 'line'; // Default to line if not captured
                  console.log('[VoxGlk] Sending bootstrap input with gen: 1, type:', bootstrapType);

                  if (bootstrapType === 'char') {
                    acceptCallback({
                      type: 'char',
                      gen: 1,  // Intro's original generation
                      window: 1,
                      value: ' '  // Space character
                    });
                  } else {
                    acceptCallback({
                      type: 'line',
                      gen: 1,  // Intro's original generation
                      window: 1,
                      value: '',  // Empty command
                      terminator: 'enter'
                    });
                  }

                }, 100);
              } else {
                console.log('[VoxGlk] Restore returned false');
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

          // EXPERIMENT: Skip reading status bar automatically
          // Set to true to include status bar in narration, false to skip
          const READ_STATUS_BAR = false;

          if (READ_STATUS_BAR && statusBarText && statusBarText.trim() && statusBarChanged) {
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

        // Handle special input requests (file dialogs for save/restore)
        if (arg.specialinput) {

          if (arg.specialinput.type === 'fileref_prompt') {
            const isRestore = arg.specialinput.filemode === 'read';
            const isSave = arg.specialinput.filemode === 'write';
            const gameid = arg.specialinput.gameid;


            // For now, use Dialog.open which will show our file picker
            // Dialog.open(tosave, usage, gameid, callback)
            const writable = !isRestore; // false for restore (read), true for save (write)

            Dialog.open(writable, arg.specialinput.filetype, gameid, (fileref) => {
              // Send response back to Glk
              if (acceptCallback) {
                acceptCallback({
                  type: 'specialresponse',
                  gen: generation,
                  response: 'fileref_prompt',
                  value: fileref
                });
              }
            });

            // Return early - don't process other input until dialog is resolved
            return;
          }
        }

        // Handle input requests
        if (arg.input) {
          const inputTypes = arg.input.map(i => i.type);
          console.log('[VoxGlk] Input request received:', { inputTypes, generation, input: arg.input });

          // Determine if we need char or line input
          inputType = inputTypes.includes('char') ? 'char' : 'line';
          inputEnabled = true;

          // Store the window ID from the first input request
          if (arg.input.length > 0 && arg.input[0].id !== undefined) {
            inputWindowId = arg.input[0].id;
          }

          // Capture the intro input type (first request at gen 1) for bootstrap after restore
          if (generation === 1 && introInputType === null) {
            introInputType = inputType;
            console.log('[VoxGlk] Captured intro input type:', introInputType);
          }

          console.log('[VoxGlk] Input state updated:', { inputType, inputEnabled, inputWindowId, generation });


          // Note: Command line visibility is handled automatically by keyboard.js polling

          // Only autosave on line input (not char input)
          const shouldAutosaveThisTurn = inputType === 'line';

          // Skip first 3 autosaves (title screen interactions)
          // This counter resets on every page load (including restore)
          const shouldSkipFirstN = autosaveCounter < 3;
          if (shouldSkipFirstN && shouldAutosaveThisTurn) {
            autosaveCounter++;
          }

          // Auto-save after each turn (only on line input, skip first 3)
          if (!shouldSkipAutosave && !skipFirstAutosave && shouldAutosaveThisTurn && !shouldSkipFirstN) {
            setTimeout(async () => {
              try {
                const { autoSave } = await import('./save-manager.js');
                await autoSave();
              } catch (error) {
                console.error('[VoxGlk] Auto-save failed:', error);
              }
            }, 100);
          } else if (skipFirstAutosave) {
            skipFirstAutosave = false; // Only skip once
          } else if (!shouldAutosaveThisTurn) {
          }
        } else {
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
      generation = savedGeneration;
      inputWindowId = savedInputWindowId;
      inputEnabled = true;
      inputType = 'line';
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
    // Character input: send character as string (matching GlkOte format)
    // GlkOte sends value as string: "R" for regular chars, "left"/"return"/etc for special keys
    // text can be either a string (regular character) or a special key name
    let charValue;
    if (typeof text === 'string' && text.length === 1) {
      // Regular single character - send as-is
      charValue = text;
    } else if (typeof text === 'string') {
      // Special key name like "left", "return", "escape" - send as-is
      charValue = text;
    } else {
      // Number passed - convert to character (for backwards compatibility)
      charValue = String.fromCharCode(text);
    }
    inputEvent = {
      type: 'char',
      gen: generation,
      window: inputWindowId,
      value: charValue
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
  console.log('[VoxGlk] Sending input event:', inputEvent);
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
}

/**
 * Get VoxGlk interface for calling restore_state
 */
export function getVoxGlk() {
  return window._voxglkInstance;
}

/**
 * Get acceptCallback for sending input events
 * Used by quickLoad to send bootstrap input
 */
export function getAcceptCallback() {
  return acceptCallback;
}

/**
 * Set flag to skip next update after bootstrap
 * Used by quickLoad to suppress "I beg your pardon" message
 */
export function setSkipNextUpdateAfterBootstrap(skip) {
  skipNextUpdateAfterBootstrap = skip;
}
