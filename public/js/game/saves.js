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

  console.log('[Saves] Saved game:', saveData.game);
  updateStatus(`Game saved (${saves.length} total saves)`);
}

/**
 * Restore game from most recent save
 * @param {Object} socket - Socket.IO connection
 */
export function restoreLatest(socket) {
  const saves = getSaves();

  if (saves.length === 0) {
    updateStatus('No saves found', 'error');
    return;
  }

  // Get most recent save for current game
  const currentGameSaves = saves.filter(s => s.game === state.currentGameName);

  if (currentGameSaves.length === 0) {
    updateStatus('No saves for current game', 'error');
    return;
  }

  const latest = currentGameSaves[0];

  console.log('[Saves] Restoring latest save:', latest.game, new Date(latest.timestamp));
  updateStatus('Restoring save...');

  socket.emit('restore-data', { data: latest.data });
}

/**
 * Restore game from specific save slot
 * @param {number} slot - Save slot number (0-based)
 * @param {Object} socket - Socket.IO connection
 */
export function restoreFromSlot(slot, socket) {
  const saves = getSaves();

  if (slot < 0 || slot >= saves.length) {
    updateStatus('Invalid save slot', 'error');
    return;
  }

  const save = saves[slot];

  console.log('[Saves] Restoring slot', slot, ':', save.game, new Date(save.timestamp));
  updateStatus('Restoring save...');

  socket.emit('restore-data', { data: save.data });
}

/**
 * Initialize save/restore handlers
 * @param {Object} socket - Socket.IO connection
 */
export function initSaveHandlers(socket) {
  // Listen for save data from server
  socket.on('save-data', (saveData) => {
    saveGame(saveData);
  });
}
