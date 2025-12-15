/**
 * Socket.IO Communication Module
 *
 * Manages WebSocket connection to server for game commands and responses.
 * NOTE: Socket.IO is OPTIONAL - not required for browser-based ZVM or TTS.
 */

import { state } from './state.js';
import { updateStatus } from '../utils/status.js';

/**
 * Initialize socket connection (optional - returns null if Socket.IO not loaded)
 * @returns {SocketIOClient.Socket|null} Socket instance or null
 */
export function initSocket() {
  // Check if Socket.IO is loaded
  if (typeof io === 'undefined') {
    console.log('[Socket] Socket.IO not loaded - running in offline mode (browser-only)');
    return null;
  }

  const socket = io();

  // Connection events
  socket.on('connect', () => {
    updateStatus('Connected');
  });

  socket.on('disconnect', () => {
    updateStatus('Disconnected from server', 'error');
  });

  socket.on('error', (error) => {
    updateStatus('Error: ' + error, 'error');
  });

  return socket;
}
