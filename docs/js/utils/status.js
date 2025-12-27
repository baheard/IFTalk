/**
 * Status Message Utilities
 *
 * Functions for updating the status bar.
 */

import { dom } from '../core/dom.js';

/**
 * Update status bar message
 * @param {string} message - Status message to display
 * @param {string} type - Status type ('error', 'success', '')
 */
export function updateStatus(message, type = '') {
  if (dom.status) {
    // Update the status text span, not the whole status bar (preserves version number)
    const statusText = dom.status.querySelector('.status-text');
    if (statusText) {
      statusText.textContent = message;
    } else {
      // Fallback for backwards compatibility
      dom.status.textContent = message;
    }
    dom.status.className = 'status ' + type;
  }
}
