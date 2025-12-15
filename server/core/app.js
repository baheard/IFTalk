/**
 * Server Application Core
 *
 * Express and Socket.IO server setup with event handlers.
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { startGame, sendCommand, getSession, killSession } from '../game/frotz-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure saves directory exists
const savesDir = path.join(__dirname, '../../saves');
if (!existsSync(savesDir)) {
  mkdirSync(savesDir);
}

/**
 * Create and configure Express app
 * @returns {Object} {app, httpServer, io}
 */
export function createApp() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer);

  // Serve static files
  app.use(express.static('public'));

  // API endpoint to get config
  app.get('/api/config', (req, res) => {
    res.json({
      voice: config.voice
    });
  });

  // Socket.IO connection handler
  io.on('connection', (socket) => {

    // Start game
    socket.on('start-game', async (gamePath) => {
      try {

        startGame(
          socket.id,
          gamePath,
          (htmlOutput, statusLine, hasClearScreen) => {
            if (hasClearScreen) {
              socket.emit('clear-screen');
            }

            // Check for scene change
            const session = getSession(socket.id);
            if (session && statusLine && session.lastStatusLine && session.lastStatusLine !== statusLine) {
              socket.emit('clear-screen');
            }
            if (session && statusLine) {
              session.lastStatusLine = statusLine;
            }

            socket.emit('game-output', htmlOutput);
            if (statusLine) {
              socket.emit('status-line', statusLine);
            }
          },
          (error) => {
            socket.emit('error', error);
          }
        );

      } catch (error) {
        socket.emit('error', error.message);
      }
    });

    // Send command to game
    socket.on('send-command', async (command) => {
      const session = getSession(socket.id);

      if (!session) {
        socket.emit('error', 'No game running');
        return;
      }

      try {
        const lowerCmd = command.toLowerCase().trim();
        const isSaveCommand = lowerCmd === 'save';

        let saveFilename = null;
        if (isSaveCommand) {
          const gameBasename = path.basename(session.path, path.extname(session.path));
          const timestamp = Date.now();
          const sessionPrefix = socket.id.substring(0, 8);
          saveFilename = path.join(savesDir, `${sessionPrefix}_${gameBasename}_${timestamp}.sav`);
        }

        sendCommand(
          socket.id,
          command,
          (htmlOutput, statusLine, hasClearScreen, pendingSaveFile) => {
            if (hasClearScreen) {
              socket.emit('clear-screen');
            }

            // Check for scene change
            if (statusLine && session.lastStatusLine && session.lastStatusLine !== statusLine) {
              socket.emit('clear-screen');
            }
            if (statusLine) {
              session.lastStatusLine = statusLine;
            }

            socket.emit('game-output', htmlOutput);
            if (statusLine) {
              socket.emit('status-line', statusLine);
            }

            // Handle save data
            if (isSaveCommand && pendingSaveFile) {
              setTimeout(() => {
                if (existsSync(pendingSaveFile)) {
                  const saveData = readFileSync(pendingSaveFile);
                  const gameBasename = path.basename(session.path, path.extname(session.path));
                  socket.emit('save-data', {
                    game: gameBasename,
                    data: saveData.toString('base64'),
                    timestamp: Date.now()
                  });
                  try { unlinkSync(pendingSaveFile); } catch (e) {}
                }
              }, 300);
            }
          },
          (error) => {
            socket.emit('error', error);
          },
          { saveFilename }
        );

      } catch (error) {
        socket.emit('error', error.message);
      }
    });

    // Restore game from client save data
    socket.on('restore-data', async ({ data }) => {
      const session = getSession(socket.id);

      if (!session) {
        socket.emit('error', 'No game running');
        return;
      }

      let tempFile = null;
      try {
        // Write save data to temp file
        tempFile = path.join(savesDir, `restore_${socket.id}_${Date.now()}.sav`);
        writeFileSync(tempFile, Buffer.from(data, 'base64'));

        // Send RESTORE command with filename
        sendCommand(
          socket.id,
          'restore',
          (htmlOutput, statusLine) => {
            // Clear screen on restore
            socket.emit('clear-screen');

            socket.emit('game-output', htmlOutput);
            if (statusLine) {
              socket.emit('status-line', statusLine);
              session.lastStatusLine = statusLine;
            }

            // Clean up temp file
            setTimeout(() => {
              try { unlinkSync(tempFile); } catch (e) {}
            }, 1000);
          },
          (error) => {
            socket.emit('error', error);
            if (tempFile && existsSync(tempFile)) {
              try { unlinkSync(tempFile); } catch (e) {}
            }
          },
          { saveFilename: tempFile }
        );

      } catch (error) {
        socket.emit('error', error.message);
        if (tempFile && existsSync(tempFile)) {
          try { unlinkSync(tempFile); } catch (e) {}
        }
      }
    });

    // Generate TTS (browser only - just return processed text)
    socket.on('speak-text', async (text) => {
      // Browser TTS - return text for client-side speech synthesis
      socket.emit('audio-ready', text);
    });

    // Disconnect handler
    socket.on('disconnect', () => {
      killSession(socket.id);
    });
  });

  return { app, httpServer, io };
}

/**
 * Get network IP address
 * @returns {Promise<string>} Local IP address
 */
export async function getLocalIP() {
  const os = await import('os');
  const nets = os.networkInterfaces();

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}
