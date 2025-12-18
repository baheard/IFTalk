/**
 * Keyboard Input Module
 *
 * Handles direct keyboard input for typing commands inline
 */

import { state } from '../core/state.js';
import { sendCommandDirect } from '../game/commands.js';
import { getInputType, sendInput } from '../game/voxglk.js';

let currentCommand = '';
let commandTextEl = null;
let commandLineEl = null;
let commandPromptEl = null;

/**
 * Initialize keyboard input handling
 */
export function initKeyboardInput() {
  // Query DOM elements now that we know the DOM is ready
  commandTextEl = document.getElementById('commandText');
  commandLineEl = document.getElementById('commandLine');
  commandPromptEl = document.querySelector('.command-prompt');

  console.log('[Keyboard] DOM elements initialized:', {
    commandLineEl: !!commandLineEl,
    commandTextEl: !!commandTextEl,
    commandPromptEl: !!commandPromptEl
  });

  // Command line starts hidden (inline style) - updateCaretVisibility will show when appropriate
  // Update caret visibility based on input type
  updateCaretVisibility();

  // Listen for keydown events on document
  document.addEventListener('keydown', handleKeyPress);

  // Click on game area - different behavior based on mode
  const lowerWindow = document.getElementById('lowerWindow');
  const gameOutput = document.getElementById('gameOutput');

  const handleGameClick = (e) => {
    // Don't interfere with text selection
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      return;
    }

    const inputType = getInputType();

    if (inputType === 'char') {
      // Char mode - tap anywhere to send Enter
      e.preventDefault();
      sendInput('\n', 'char');
    } else if (inputType === 'line' && commandTextEl && commandLineEl.style.display === 'flex') {
      // Line mode - focus input
      commandTextEl.focus();
    }
  };

  if (lowerWindow) {
    lowerWindow.addEventListener('click', handleGameClick);
  }
  if (gameOutput) {
    gameOutput.addEventListener('click', handleGameClick);
  }

  // Listen for input type changes (poll periodically - check every 500ms)
  setInterval(updateCaretVisibility, 500);
}

/**
 * Handle key press
 */
function handleKeyPress(e) {
  // Don't capture if settings panel is open or other modals
  if (document.querySelector('.settings-panel.open')) {
    return;
  }

  const inputType = getInputType();

  // In char mode (press any key), send any key immediately
  if (inputType === 'char') {
    // Don't capture modifier keys alone
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    // Map special keys to Glk keycodes (from glkapi.js Const values)
    const specialKeyCodes = {
      'ArrowLeft': 0xfffffffe,
      'ArrowRight': 0xfffffffd,
      'ArrowUp': 0xfffffffc,
      'ArrowDown': 0xfffffffb,
      'Enter': 0xfffffffa,
      'Backspace': 0xfffffff9,
      'Delete': 0xfffffff9,
      'Escape': 0xfffffff8,
      'Tab': 0xfffffff7,
      'PageUp': 0xfffffff6,
      'PageDown': 0xfffffff5,
      'Home': 0xfffffff4,
      'End': 0xfffffff3,
    };

    // Check if this is a special key
    if (specialKeyCodes[e.key]) {
      // Send special keycode directly
      sendInput(specialKeyCodes[e.key], 'char');
    } else if (e.key.length === 1) {
      // Regular printable character - send as-is
      sendInput(e.key, 'char');
    } else {
      // Unknown special key - ignore
      console.log('[Keyboard] Ignoring unknown special key:', e.key);
    }
    return;
  }

  // Line input mode - normal command typing
  // Don't capture if user is in other input elements (except our command input)
  if (e.target !== commandTextEl && (e.target.isContentEditable || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
    return;
  }

  // If typing and not focused on command input, focus it
  if (e.target !== commandTextEl && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (commandTextEl) {
      commandTextEl.focus();
    }
    return; // Let the browser handle the input naturally
  }

  // Only handle special keys when our input is focused
  if (e.target === commandTextEl) {
    // Handle Enter key - send command
    if (e.key === 'Enter') {
      e.preventDefault();
      console.log('[Keyboard] Enter pressed, sending command');
      sendCommand();
      return;
    }

    // Handle Escape - clear command
    if (e.key === 'Escape') {
      e.preventDefault();
      if (commandTextEl) {
        commandTextEl.value = '';
      }
      return;
    }

    // Mark as manual typing
    state.hasManualTyping = true;
  }
}

/**
 * Update command display
 */
function updateDisplay() {
  if (commandTextEl) {
    commandTextEl.value = currentCommand;
  }
}

/**
 * Update caret visibility based on input type
 */
function updateCaretVisibility() {
  const inputType = getInputType();
  const isVisible = commandLineEl?.style.display === 'flex';

  // Show command line only in line mode, hide in char mode or when no input requested
  if (commandLineEl) {
    const wasHidden = commandLineEl.style.display !== 'flex';

    if (inputType === 'line') {
      // Line mode - show command line with prompt
      commandLineEl.style.display = 'flex';

      // Auto-focus when command line becomes visible
      if (wasHidden && commandTextEl) {
        commandTextEl.focus();
      }
    } else {
      // Char mode or no input - hide command line (tap screen to advance)
      commandLineEl.style.display = 'none';
    }
  }
}

/**
 * Scroll command line into view when user starts typing
 */
function scrollCommandLineIntoView() {
  if (commandLineEl) {
    commandLineEl.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }
}

/**
 * Send command and clear input
 */
function sendCommand() {
  const cmd = commandTextEl ? commandTextEl.value.trim() : '';
  console.log('[Keyboard] sendCommand called with:', cmd);

  if (commandTextEl) {
    commandTextEl.value = '';
  }

  if (cmd || cmd === '') {
    // Store last command for echo detection
    window.lastSentCommand = cmd;
    console.log('[Keyboard] Calling sendCommandDirect');
    sendCommandDirect(cmd, false); // false = not a voice command
  }
}

/**
 * Show command line
 */
export function showCommandLine() {
  if (commandLineEl) {
    commandLineEl.style.display = 'flex';
  }
}

/**
 * Hide command line
 */
export function hideCommandLine() {
  if (commandLineEl) {
    commandLineEl.style.display = 'none';
  }
  currentCommand = '';
  updateDisplay();
}
