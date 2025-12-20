/**
 * Keyboard Input Module
 *
 * Handles keyboard input via messaging interface in controls panel
 */

import { state } from '../core/state.js';
import { sendCommandDirect } from '../game/commands.js';
import { getInputType, sendInput } from '../game/voxglk.js';

let messageInputEl = null;
let messageInputRowEl = null;
let voiceListeningIndicatorEl = null;
let voiceTranscriptEl = null;
let voiceMeterDotEl = null;

// Char input panel elements
let charInputPanelEl = null;
let charUpBtnEl = null;
let charLeftBtnEl = null;
let charDownBtnEl = null;
let charRightBtnEl = null;
let charEnterBtnEl = null;
let charEscBtnEl = null;
let charKeyboardBtnEl = null;
let hiddenKeyInputEl = null;

// System entry mode state (for SAVE/RESTORE/DELETE prompts)
let systemEntryMode = false;
let systemEntryCallback = null;

// Cached media queries for keyboard detection (performance optimization)
const mqCoarse = window.matchMedia('(pointer: coarse)');
const mqHover = window.matchMedia('(hover: hover)');

/**
 * Initialize keyboard input handling
 */
export function initKeyboardInput() {
  // Query DOM elements for messaging interface
  messageInputEl = document.getElementById('messageInput');
  messageInputRowEl = document.getElementById('messageInputRow');
  voiceListeningIndicatorEl = document.getElementById('voiceListeningIndicator');
  voiceTranscriptEl = document.getElementById('voiceTranscript');
  voiceMeterDotEl = document.getElementById('voiceMeterDot');

  // Query DOM elements for char input panel
  charInputPanelEl = document.getElementById('charInputPanel');
  charUpBtnEl = document.getElementById('charUpBtn');
  charLeftBtnEl = document.getElementById('charLeftBtn');
  charDownBtnEl = document.getElementById('charDownBtn');
  charRightBtnEl = document.getElementById('charRightBtn');
  charEnterBtnEl = document.getElementById('charEnterBtn');
  charEscBtnEl = document.getElementById('charEscBtn');
  charKeyboardBtnEl = document.getElementById('charKeyboardBtn');

  // Create hidden input for arbitrary key capture (keyboard button)
  hiddenKeyInputEl = document.createElement('input');
  hiddenKeyInputEl.id = 'hiddenKeyInput';
  hiddenKeyInputEl.type = 'text';
  hiddenKeyInputEl.maxLength = 1;
  hiddenKeyInputEl.style.position = 'absolute';
  hiddenKeyInputEl.style.left = '-9999px';
  hiddenKeyInputEl.style.opacity = '0';
  hiddenKeyInputEl.setAttribute('aria-hidden', 'true');
  document.body.appendChild(hiddenKeyInputEl);

  // Update input visibility based on input type
  updateInputVisibility();

  // Listen for keydown events on document
  document.addEventListener('keydown', handleKeyPress);

  // Listen for Enter key on message input
  if (messageInputEl) {
    messageInputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendCommand();
      }
    });
  }

  // Add click handlers for char input buttons
  if (charUpBtnEl) {
    charUpBtnEl.addEventListener('click', () => sendInput('up', 'char'));
  }
  if (charLeftBtnEl) {
    charLeftBtnEl.addEventListener('click', () => sendInput('left', 'char'));
  }
  if (charDownBtnEl) {
    charDownBtnEl.addEventListener('click', () => sendInput('down', 'char'));
  }
  if (charRightBtnEl) {
    charRightBtnEl.addEventListener('click', () => sendInput('right', 'char'));
  }
  if (charEnterBtnEl) {
    charEnterBtnEl.addEventListener('click', () => sendInput('return', 'char'));
  }
  if (charEscBtnEl) {
    charEscBtnEl.addEventListener('click', () => sendInput('escape', 'char'));
  }

  // Keyboard button: Focus hidden input to open mobile keyboard
  if (charKeyboardBtnEl) {
    charKeyboardBtnEl.addEventListener('click', () => {
      hiddenKeyInputEl.value = '';
      hiddenKeyInputEl.focus();
    });
  }

  // Capture key from hidden input
  hiddenKeyInputEl.addEventListener('input', (e) => {
    const key = e.target.value;
    if (key.length === 1) {
      // Send key to game
      sendInput(key, 'char');
      hiddenKeyInputEl.blur();
      hiddenKeyInputEl.value = '';
    }
  });

  // Also handle Enter key in hidden input
  hiddenKeyInputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendInput('return', 'char');
      hiddenKeyInputEl.blur();
    }
  });

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
    } else if (inputType === 'line' && messageInputEl) {
      // Line mode - focus message input
      messageInputEl.focus();
    }
  };

  if (lowerWindow) {
    lowerWindow.addEventListener('click', handleGameClick);
  }
  if (gameOutput) {
    gameOutput.addEventListener('click', handleGameClick);
  }

  // Listen for input type changes (poll periodically - check every 500ms)
  setInterval(updateInputVisibility, 500);
}

/**
 * Handle key press
 */
function handleKeyPress(e) {
  // Don't capture if settings panel is open or other modals
  if (document.querySelector('.settings-panel.open')) {
    return;
  }

  // Handle Escape in system entry mode (SAVE/RESTORE/DELETE prompts)
  if (systemEntryMode && e.key === 'Escape') {
    e.preventDefault();
    // Import dynamically to avoid circular dependency
    import('../game/commands.js').then(module => {
      module.cancelMetaInput();
    });
    return;
  }

  const inputType = getInputType();

  // In char mode (press any key), send any key immediately
  if (inputType === 'char') {
    // Don't capture modifier keys alone
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') {
      return;
    }

    // Don't capture if user is typing in the message input
    if (e.target === messageInputEl) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    // Map special keys to Glk key names (for glkapi.js KeystrokeNameMap)
    // These match the string keys expected by glkapi.js (lines 1419-1422)
    const specialKeyNames = {
      'ArrowLeft': 'left',
      'ArrowRight': 'right',
      'ArrowUp': 'up',
      'ArrowDown': 'down',
      'Enter': 'return',
      'Backspace': 'delete',
      'Delete': 'delete',
      'Escape': 'escape',
      'Tab': 'tab',
      'PageUp': 'pageup',
      'PageDown': 'pagedown',
      'Home': 'home',
      'End': 'end',
    };

    // Check if this is a special key
    if (specialKeyNames[e.key]) {
      // Send special key name (string) that glkapi will convert to keycode
      sendInput(specialKeyNames[e.key], 'char');
    } else if (e.key.length === 1) {
      // Regular printable character - send as-is
      sendInput(e.key, 'char');
    }
    // Unknown special keys are ignored
    return;
  }

  // Line input mode - normal command typing
  // Don't capture if user is in other input elements
  if (e.target.isContentEditable || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    return;
  }

  // If typing and not focused on message input, focus it
  if (e.target !== messageInputEl && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (messageInputEl) {
      messageInputEl.focus();
    }
    return; // Let the browser handle the input naturally
  }

  // Mark as manual typing when user types in message input
  if (e.target === messageInputEl) {
    state.hasManualTyping = true;
  }
}

/**
 * Check if device has a physical keyboard
 * Uses pointer and hover media queries to detect touch-only devices
 */
function hasPhysicalKeyboard() {
  // Devices with coarse pointer (touch) and no hover capability = touch-only
  const hasCoarsePointer = mqCoarse.matches;
  const canHover = mqHover.matches;

  // If primary pointer is coarse AND can't hover = touch-only device (no physical keyboard)
  // If can hover OR pointer is fine = has physical keyboard/mouse
  return canHover || !hasCoarsePointer;
}

/**
 * Update input visibility based on input type and mute state
 */
function updateInputVisibility() {
  const inputType = getInputType();
  const hasKeyboard = hasPhysicalKeyboard();
  const isMuted = state.isMuted;

  // Show/hide message input row (line mode only)
  if (messageInputRowEl) {
    const wasHidden = messageInputRowEl.classList.contains('hidden');

    if (inputType === 'line') {
      // Line mode - show message input row
      messageInputRowEl.classList.remove('hidden');

      // Toggle between text input and voice indicator based on mute state
      if (isMuted) {
        // Muted - show text input, hide voice indicator
        if (messageInputEl) messageInputEl.classList.remove('hidden');
        if (voiceListeningIndicatorEl) voiceListeningIndicatorEl.classList.add('hidden');

        // Auto-focus when input becomes visible
        if (wasHidden && messageInputEl) {
          messageInputEl.focus();
        }
      } else {
        // Unmuted - hide text input, show voice indicator
        if (messageInputEl) messageInputEl.classList.add('hidden');
        if (voiceListeningIndicatorEl) voiceListeningIndicatorEl.classList.remove('hidden');
      }
    } else {
      // Char mode or no input - hide message input row
      messageInputRowEl.classList.add('hidden');
    }
  }

  // Show/hide char input panel (char mode only, and only if no physical keyboard)
  if (charInputPanelEl) {
    if (inputType === 'char' && !hasKeyboard) {
      // Char mode on touch-only device - show char input panel
      charInputPanelEl.classList.remove('hidden');
    } else {
      // Line mode, or has physical keyboard - hide char input panel
      charInputPanelEl.classList.add('hidden');
    }
  }
}

/**
 * Update voice indicator state (for speaking animation)
 * @param {boolean} isSpeaking - Whether user is currently speaking
 */
export function setVoiceSpeaking(isSpeaking) {
  if (voiceListeningIndicatorEl) {
    if (isSpeaking) {
      voiceListeningIndicatorEl.classList.add('speaking');
    } else {
      voiceListeningIndicatorEl.classList.remove('speaking');
    }
  }
}

/**
 * Update voice transcript text
 * @param {string} text - Text to display
 * @param {string} mode - 'listening', 'interim', 'confirmed', or 'nav'
 */
export function updateVoiceTranscript(text, mode = 'listening') {
  if (voiceTranscriptEl) {
    voiceTranscriptEl.textContent = text;
    voiceTranscriptEl.classList.remove('interim', 'confirmed', 'nav-command');

    if (mode === 'interim') {
      voiceTranscriptEl.classList.add('interim');
    } else if (mode === 'confirmed') {
      voiceTranscriptEl.classList.add('confirmed');
    } else if (mode === 'nav') {
      voiceTranscriptEl.classList.add('nav-command');
    }
  }
}

/**
 * Send command and clear input
 */
function sendCommand() {
  const cmd = messageInputEl ? messageInputEl.value.trim() : '';

  if (messageInputEl) {
    messageInputEl.value = '';
  }

  if (cmd || cmd === '') {
    // Store last command for echo detection
    window.lastSentCommand = cmd;
    sendCommandDirect(cmd, false); // false = not a voice command
  }
}

/**
 * Show message input
 */
export function showMessageInput() {
  if (messageInputRowEl) {
    messageInputRowEl.classList.remove('hidden');
  }
}

/**
 * Hide message input
 */
export function hideMessageInput() {
  if (messageInputRowEl) {
    messageInputRowEl.classList.add('hidden');
  }
  if (messageInputEl) {
    messageInputEl.value = '';
  }
}

/**
 * Enter system entry mode for meta-commands (SAVE/RESTORE/DELETE)
 * Shows a custom prompt and handles Escape to cancel
 */
export function enterSystemEntryMode(promptText) {
  systemEntryMode = true;
  if (messageInputEl) {
    messageInputEl.placeholder = promptText;
    messageInputEl.value = '';
    messageInputEl.focus();
  }
  showMessageInput();
}

/**
 * Exit system entry mode, restore normal prompt
 */
export function exitSystemEntryMode() {
  systemEntryMode = false;
  if (messageInputEl) {
    messageInputEl.placeholder = 'Enter command...';
  }
}

/**
 * Check if we're in system entry mode
 */
export function isSystemEntryMode() {
  return systemEntryMode;
}
