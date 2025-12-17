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

  console.log('[Keyboard] Initializing input:', {
    commandLineEl: !!commandLineEl,
    commandTextEl: !!commandTextEl,
    commandPromptEl: !!commandPromptEl
  });

  // Command line starts hidden (inline style) - updateCaretVisibility will show when appropriate
  // Update caret visibility based on input type
  updateCaretVisibility();

  // Listen for keydown events on document
  document.addEventListener('keydown', handleKeyPress);

  // Click on game area focuses input (unless selecting text)
  const lowerWindow = document.getElementById('lowerWindow');
  if (lowerWindow) {
    lowerWindow.addEventListener('click', (e) => {
      // Don't interfere with text selection
      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) {
        return;
      }

      // Focus input if it's visible
      if (commandTextEl && commandLineEl.style.display === 'flex') {
        commandTextEl.focus();
      }
    });
  }

  // Listen for input type changes (poll periodically)
  setInterval(updateCaretVisibility, 100);
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

    // Get the character
    let char = e.key;

    // For special keys, map to characters
    if (char === 'Enter') char = '\n';
    else if (char === 'Escape') char = '\x1b';
    else if (char === 'Backspace') char = '\x08';
    else if (char === 'Tab') char = '\t';
    else if (char.length > 1) {
      // For other special keys, use first char
      char = char.charAt(0).toLowerCase();
    }

    // Send as character input
    sendInput(char, 'char');
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
  console.log('[Keyboard] updateCaretVisibility - inputType:', inputType, 'commandLineEl visible:', isVisible);

  // Show command line only in line mode, hide in char mode or when no input requested
  if (commandLineEl) {
    const wasHidden = commandLineEl.style.display !== 'flex';

    if (inputType === 'line') {
      // Line mode - show command line
      commandLineEl.style.display = 'flex';

      // Auto-focus when command line becomes visible
      if (wasHidden && commandTextEl) {
        commandTextEl.focus();
      }
    } else {
      // Char mode or no input - hide command line
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
  if (commandTextEl) {
    commandTextEl.value = '';
  }

  if (cmd || cmd === '') {
    // Store last command for echo detection
    window.lastSentCommand = cmd;
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
