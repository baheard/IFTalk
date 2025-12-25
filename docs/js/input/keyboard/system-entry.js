/**
 * System Entry Mode Module
 *
 * Handles system entry mode for meta-commands (SAVE/RESTORE/DELETE).
 */

// System entry mode state
let systemEntryMode = false;
let messageInputEl = null;

/**
 * Initialize system entry module
 */
export function initSystemEntry() {
  messageInputEl = document.getElementById('messageInput');
}

/**
 * Enter system entry mode for meta-commands (SAVE/RESTORE/DELETE)
 * Shows a custom prompt and handles Escape to cancel
 * @param {string} promptText - The prompt text to display
 * @param {Function} showMessageInputFn - Function to show the message input
 * @param {Function} hasPhysicalKeyboardFn - Function to check for physical keyboard
 */
export function enterSystemEntryMode(promptText, showMessageInputFn, hasPhysicalKeyboardFn) {
  systemEntryMode = true;
  if (messageInputEl) {
    messageInputEl.placeholder = promptText;
    messageInputEl.value = '';
    messageInputEl.classList.add('system-entry');
    // Focus on desktop only (mobile keyboard stays closed)
    if (hasPhysicalKeyboardFn && hasPhysicalKeyboardFn()) {
      messageInputEl.focus();
    }
  }
  if (showMessageInputFn) {
    showMessageInputFn();
  }
}

/**
 * Exit system entry mode, restore normal prompt
 */
export function exitSystemEntryMode() {
  systemEntryMode = false;
  if (messageInputEl) {
    messageInputEl.placeholder = 'Type command...';
    messageInputEl.classList.remove('system-entry');
  }
}

/**
 * Check if we're in system entry mode
 * @returns {boolean} True if in system entry mode
 */
export function isSystemEntryMode() {
  return systemEntryMode;
}
