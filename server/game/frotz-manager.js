/**
 * Frotz Process Manager
 *
 * Manages Frotz interpreter process lifecycle and I/O.
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { config } from '../core/config.js';
import { processFrotzOutput } from './text-processor.js';

// Game sessions (one per socket connection)
const gameSessions = new Map();

/**
 * Convert Windows path to WSL path
 * @param {string} windowsPath - Windows-style path (e.g., E:\Project\file.z8)
 * @returns {string} WSL-style path (e.g., /mnt/e/Project/file.z8)
 */
function convertToWSLPath(windowsPath) {
  // Normalize to forward slashes
  let wslPath = windowsPath.replace(/\\/g, '/');

  // Convert drive letter (C: -> /mnt/c)
  wslPath = wslPath.replace(/^([A-Z]):/i, (match, drive) => {
    return `/mnt/${drive.toLowerCase()}`;
  });

  return wslPath;
}

/**
 * Start a new game session
 * @param {string} socketId - Socket ID
 * @param {string} gamePath - Path to game file
 * @param {Function} onOutput - Callback for game output
 * @param {Function} onError - Callback for errors
 * @returns {Object} Session object
 */
export function startGame(socketId, gamePath, onOutput, onError) {
  // Kill existing game if any
  if (gameSessions.has(socketId)) {
    const oldGame = gameSessions.get(socketId);
    oldGame.process.kill();
  }

  // Resolve game path
  const fullPath = path.isAbsolute(gamePath) ? gamePath : path.resolve(gamePath);

  if (!existsSync(fullPath)) {
    onError(`Game file not found: ${gamePath}`);
    return null;
  }

  // Convert Windows path to WSL path if using WSL
  let interpreterPath = fullPath;
  if (config.interpreter === 'wsl') {
    interpreterPath = convertToWSLPath(fullPath);
  }

  // Spawn game interpreter
  const args = [...(config.interpreterArgs || []), interpreterPath];
  const gameProcess = spawn(config.interpreter, args, {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let outputBuffer = '';

  gameProcess.stdout.on('data', (data) => {
    outputBuffer += data.toString();
  });

  gameProcess.stderr.on('data', (data) => {
    console.error('[Game] Error:', data.toString());
  });

  gameProcess.on('close', (code) => {
    console.log('[Game] Ended:', code);
    gameSessions.delete(socketId);
  });

  // Store session
  const session = {
    process: gameProcess,
    path: fullPath,
    lastOutput: '',
    lastStatusLine: null,
    pendingSaveFile: null
  };

  gameSessions.set(socketId, session);

  // Wait for initial output
  setTimeout(() => {
    const output = outputBuffer;
    outputBuffer = '';

    session.lastOutput = output;
    const { htmlOutput, statusLine, hasClearScreen } = processFrotzOutput(output);

    onOutput(htmlOutput, statusLine, hasClearScreen);
  }, 1000);

  return session;
}

/**
 * Send command to game
 * @param {string} socketId - Socket ID
 * @param {string} command - Command to send
 * @param {Function} onOutput - Callback for game output
 * @param {Function} onError - Callback for errors
 * @param {Object} options - Additional options (saveFilename, etc.)
 */
export function sendCommand(socketId, command, onOutput, onError, options = {}) {
  const session = gameSessions.get(socketId);

  if (!session) {
    onError('No game running');
    return;
  }

  let outputBuffer = '';

  const dataHandler = (data) => {
    outputBuffer += data.toString();
  };

  session.process.stdout.on('data', dataHandler);

  // Send command
  session.process.stdin.write(command + '\n');

  // Handle save filename if needed
  if (options.saveFilename) {
    session.pendingSaveFile = options.saveFilename;
    setTimeout(() => {
      session.process.stdin.write(options.saveFilename + '\n');
      console.log('[Save] Sending filename to Frotz:', options.saveFilename);
    }, 200);
  }

  // Wait for response
  setTimeout(() => {
    session.process.stdout.removeListener('data', dataHandler);

    session.lastOutput = outputBuffer;
    const { htmlOutput, statusLine, hasClearScreen } = processFrotzOutput(outputBuffer);

    // Pass pending save file to callback
    onOutput(htmlOutput, statusLine, hasClearScreen, session.pendingSaveFile);

    // Reset pending save file
    if (options.saveFilename) {
      session.pendingSaveFile = null;
    }
  }, 500);
}

/**
 * Get session for socket
 * @param {string} socketId - Socket ID
 * @returns {Object|null} Session object or null
 */
export function getSession(socketId) {
  return gameSessions.get(socketId) || null;
}

/**
 * Kill session
 * @param {string} socketId - Socket ID
 */
export function killSession(socketId) {
  if (gameSessions.has(socketId)) {
    const session = gameSessions.get(socketId);
    session.process.kill();
    gameSessions.delete(socketId);
  }
}
