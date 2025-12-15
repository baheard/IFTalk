/**
 * Socket.IO Communication Module
 *
 * Manages WebSocket connection to server for game commands and responses.
 */

import { state } from './state.js';
import { updateStatus } from '../utils/status.js';

/**
 * Initialize socket connection
 * @returns {SocketIOClient.Socket} Socket instance
 */
export function initSocket() {
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
