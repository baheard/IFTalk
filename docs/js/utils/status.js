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
    dom.status.textContent = message;
    dom.status.className = 'status ' + type;
  }
}
