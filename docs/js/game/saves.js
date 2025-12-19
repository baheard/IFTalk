/**
 * Save/Restore Module
 *
 * Manages game saves in browser localStorage.
 */

import { state } from '../core/state.js';
import { updateStatus } from '../utils/status.js';

/**
 * Get saves from localStorage
 * @returns {Array} Array of save objects
 */
function getSaves() {
  const saves = localStorage.getItem('ifTalkSaves');
  return saves ? JSON.parse(saves) : [];
}

/**
 * Save current game state
 * @param {Object} saveData - Save data from server {game, data, timestamp}
 */
export function saveGame(saveData) {
  const saves = getSaves();

  // Add new save
  saves.unshift({
    game: saveData.game,
    data: saveData.data,
    timestamp: saveData.timestamp
  });

  // Keep only last 10 saves
  if (saves.length > 10) {
    saves.splice(10);
  }

  localStorage.setItem('ifTalkSaves', JSON.stringify(saves));

  updateStatus(`Game saved (${saves.length} total saves)`);
}

/**
 * Restore game from most recent save
 * NOTE: Save/restore via server Socket.IO is disabled for browser-based ZVM.
 * ZVM has its own native save mechanism accessible via game commands.
 */
export function restoreLatest() {
  console.warn('[Saves] Server-based save/restore not supported with browser ZVM');
  console.warn('[Saves] Use in-game SAVE and RESTORE commands instead');
  updateStatus('Use in-game RESTORE command', 'error');
}

/**
 * Restore game from specific save slot
 * NOTE: Save/restore via server Socket.IO is disabled for browser-based ZVM.
 * ZVM has its own native save mechanism accessible via game commands.
 * @param {number} slot - Save slot number (0-based)
 */
export function restoreFromSlot(slot) {
  console.warn('[Saves] Server-based save/restore not supported with browser ZVM');
  console.warn('[Saves] Use in-game SAVE and RESTORE commands instead');
  updateStatus('Use in-game RESTORE command', 'error');
}

/**
 * Initialize save/restore handlers
 * NOTE: Socket.IO save handlers removed - browser-based ZVM uses native save mechanism
 */
export function initSaveHandlers() {
  // No initialization needed for browser-based ZVM saves
}
