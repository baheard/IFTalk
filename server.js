import express from 'express';
import { createServer } from 'https';
import { Server } from 'socket.io';
import { spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Convert from 'ansi-to-html';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure saves directory exists
const savesDir = path.join(__dirname, 'saves');
if (!existsSync(savesDir)) {
  mkdirSync(savesDir);
  console.log('[Server] Created saves directory');
}

// Load configuration
const config = JSON.parse(readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));

// Initialize ANSI to HTML converter
const convert = new Convert({
  fg: '#e0e0e0',
  bg: 'transparent',
  newline: true,
  escapeXML: false,
  stream: false
});

// Initialize Express and Socket.IO
const app = express();

// HTTPS options - load SSL certificates
const httpsOptions = {
  key: readFileSync(path.join(__dirname, 'localhost+3-key.pem')),
  cert: readFileSync(path.join(__dirname, 'localhost+3.pem'))
};

const httpServer = createServer(httpsOptions, app);
const io = new Server(httpServer);

// Serve static files
app.use(express.static('public'));

// API endpoint to get config (for client-side voice settings)
app.get('/api/config', (req, res) => {
  res.json({
    voice: config.voice
  });
});

// Game sessions (one per socket connection)
const gameSessions = new Map();

// Process Frotz output - extract status line and clean up text
function processFrotzOutput(output) {
  // ALWAYS log raw output with character codes to debug clear screen detection
  const chars = output.split('').map(c => {
    const code = c.charCodeAt(0);
    if (code < 32) return `\\x${code.toString(16).padStart(2, '0')}`;
    return c;
  }).join('');

  // Log first 800 chars to see full initial output
  const logLength = Math.min(800, output.length);
  console.log('[Frotz RAW] (' + output.length + ' chars total):');
  console.log(chars.substring(0, logLength));
  if (output.length > logLength) {
    console.log('... (truncated)');
  }

  // Detect clear screen codes (ANSI or form feed)
  const hasAnsiClear = output.includes('\x1b[2J') || output.includes('\x1b[H\x1b[2J') || output.includes('\x1b[H\x1b[J');
  const hasFormFeed = output.includes('\f') || output.includes('\x0C');
  const hasClearScreen = hasAnsiClear || hasFormFeed;

  if (hasClearScreen) {
    console.log('[Frotz] Clear screen detected:', hasAnsiClear ? 'ANSI' : 'Form Feed');
  }

  let processedOutput = output
    .replace(/\r\n/g, '\n')            // Normalize Windows line endings
    .replace(/\r/g, '\n')              // Normalize Mac line endings
    .replace(/\f/g, '')                // Remove form feed characters (used for clear screen)
    .replace(/\x0C/g, '');             // Remove form feed (hex notation)

  // Split into lines and process each
  let lines = processedOutput.split('\n');
  let cleanedLines = [];  // Now stores {text, isCentered} objects
  let statusLine = null;

  for (let line of lines) {
    // Check for status line - two patterns:
    // 1. Old pattern: ")   Outside the Real Estate Office                      day one"
    // 2. New pattern: "   Outside the Real Estate Office                      day one" (20+ spaces between location and time)
    if (line.match(/^\)\s+\S/)) {
      // Old pattern with leading )
      const statusContent = line.replace(/^\)\s*/, '').trim();
      if (statusContent.length > 5) {
        statusLine = statusContent;
      }
      continue;
    } else if (line.match(/^\s{1,5}\S.{10,}\s{20,}\S/)) {
      // New pattern: few leading spaces, text, 20+ spaces, more text
      statusLine = line.trim();
      console.log('[Status] Detected status line:', statusLine);
      continue;
    }

    // Detect centered text BEFORE trimming (lines with 10+ leading spaces)
    const leadingSpaces = line.match(/^(\s*)/)[1].length;
    const isCentered = leadingSpaces >= 10;

    // Trim the line (remove centering whitespace)
    let trimmed = line.trim();

    // Strip leading ) artifact that sometimes gets attached to text
    if (trimmed.startsWith(') ')) {
      trimmed = trimmed.slice(2);
    }

    // Skip dfrotz formatting artifacts (but NOT standalone ) which marks status line)
    if (trimmed === '.' || trimmed === '. )' || trimmed === '. ' || trimmed === '') {
      // Add blank line for paragraph break (but avoid duplicates)
      if (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1].text !== '') {
        cleanedLines.push({text: '', isCentered: false});
      }
      continue;
    }

    // Check if this is a status line marker )
    if (trimmed === ')') {
      // This marks the beginning of a status line - the actual status content follows
      // Don't filter it out, let it be processed as a potential status line
      statusLine = null;  // Will be set by next non-empty line
      continue;
    }

    // Skip input prompts (single or multiple >)
    if (trimmed.match(/^[>\s]+$/)) {
      continue;
    }

    // Strip trailing prompts from end of line
    trimmed = trimmed.replace(/\s*>+\s*$/, '');

    if (trimmed) {
      // For centered text, preserve the leading spaces for wide-screen display
      const leadingWhitespace = isCentered ? line.match(/^(\s*)/)[1] : '';
      cleanedLines.push({text: trimmed, isCentered, leadingWhitespace});
    }
  }

  // Join lines: paragraph breaks become double newlines, content breaks become soft-break spans
  let result = '';
  for (let i = 0; i < cleanedLines.length; i++) {
    const lineObj = cleanedLines[i];
    const line = lineObj.text;
    const isCentered = lineObj.isCentered;
    const leadingWhitespace = lineObj.leadingWhitespace || '';

    // Wrap centered text (include leading whitespace for wide-screen native formatting)
    const wrappedLine = isCentered ? `<span class="centered">${leadingWhitespace}${line}</span>` : line;

    if (i === 0) {
      result = wrappedLine;
    } else if (line === '') {
      // Empty line = paragraph break
      result += '\n\n';
    } else if (cleanedLines[i - 1].text === '') {
      // After paragraph break, start new paragraph
      result += wrappedLine;
    } else {
      // Soft break: line break at 70ch+, just a space at narrower widths
      result += ' <span class="soft-break"></span>' + wrappedLine;
    }
  }

  // Convert ANSI codes to HTML
  let htmlOutput = convert.toHtml(result);

  return { htmlOutput, statusLine, hasClearScreen };
}

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('[Server] Client connected:', socket.id);

  // Start game
  socket.on('start-game', async (gamePath) => {
    try {
      console.log('[Game] Starting:', gamePath);

      // Kill existing game if any
      if (gameSessions.has(socket.id)) {
        const oldGame = gameSessions.get(socket.id);
        oldGame.process.kill();
      }

      // Resolve game path
      const fullPath = path.isAbsolute(gamePath) ? gamePath : path.join(__dirname, gamePath);

      if (!existsSync(fullPath)) {
        socket.emit('error', `Game file not found: ${gamePath}`);
        return;
      }

      // Spawn game interpreter
      const args = [...(config.interpreterArgs || []), fullPath];
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
        socket.emit('game-ended', code);
        gameSessions.delete(socket.id);
      });

      // Store session with context tracking
      gameSessions.set(socket.id, {
        process: gameProcess,
        path: fullPath,
        lastOutput: '',  // Track last output for AI translation context
        lastStatusLine: null  // Track status line for scene change detection
      });

      // Wait for initial output
      setTimeout(() => {
        const output = outputBuffer;
        outputBuffer = '';

        // Store for context
        const session = gameSessions.get(socket.id);
        if (session) {
          session.lastOutput = output;
        }

        // Process Frotz output
        const { htmlOutput, statusLine, hasClearScreen } = processFrotzOutput(output);

        // Check for clear screen ANSI code
        if (hasClearScreen) {
          socket.emit('clear-screen');
          console.log('[Game] Clear screen from ANSI code');
        }

        // Check for scene change (status line changed)
        if (session && statusLine && session.lastStatusLine && session.lastStatusLine !== statusLine) {
          socket.emit('clear-screen');
          console.log('[Game] Scene change detected:', session.lastStatusLine, '->', statusLine);
        }
        if (session && statusLine) {
          session.lastStatusLine = statusLine;
        }

        socket.emit('game-output', htmlOutput);
        if (statusLine) {
          socket.emit('status-line', statusLine);
        }
      }, 1000);

    } catch (error) {
      console.error('[Game] Start error:', error);
      socket.emit('error', error.message);
    }
  });

  // Send command to game
  socket.on('send-command', async (command) => {
    const session = gameSessions.get(socket.id);

    if (!session) {
      socket.emit('error', 'No game running');
      return;
    }

    try {
      const lowerCmd = command.toLowerCase().trim();
      const isSaveCommand = lowerCmd === 'save';
      const isRestoreCommand = lowerCmd === 'restore';

      let outputBuffer = '';

      const dataHandler = (data) => {
        outputBuffer += data.toString();
      };

      session.process.stdout.on('data', dataHandler);

      // Send command
      session.process.stdin.write(command + '\n');

      // For SAVE: generate filename and send it after Frotz prompts
      if (isSaveCommand) {
        const gameBasename = path.basename(session.path, path.extname(session.path));
        const timestamp = Date.now();
        // Use socket.id for session isolation to prevent cross-user save access
        const sessionPrefix = socket.id.substring(0, 8);
        const saveFilename = path.join(savesDir, `${sessionPrefix}_${gameBasename}_${timestamp}.sav`);
        session.pendingSaveFile = saveFilename;

        // Wait a bit for Frotz to prompt, then send filename
        setTimeout(() => {
          session.process.stdin.write(saveFilename + '\n');
          console.log('[Save] Sending filename to Frotz:', saveFilename);
        }, 200);
      }

      // Wait for response
      setTimeout(() => {
        session.process.stdout.removeListener('data', dataHandler);

        // Store for context
        session.lastOutput = outputBuffer;

        // Process Frotz output
        const { htmlOutput, statusLine, hasClearScreen } = processFrotzOutput(outputBuffer);

        // Check for clear screen ANSI code
        if (hasClearScreen) {
          socket.emit('clear-screen');
          console.log('[Game] Clear screen from ANSI code');
        }

        // Check for scene change (status line changed)
        if (session && statusLine && session.lastStatusLine && session.lastStatusLine !== statusLine) {
          socket.emit('clear-screen');
          console.log('[Game] Scene change detected:', session.lastStatusLine, '->', statusLine);
        }
        if (session && statusLine) {
          session.lastStatusLine = statusLine;
        }

        socket.emit('game-output', htmlOutput);
        if (statusLine) {
          socket.emit('status-line', statusLine);
        }

        // For SAVE: check if file was created and send to client
        if (isSaveCommand && session.pendingSaveFile) {
          setTimeout(() => {
            const saveFile = session.pendingSaveFile;
            if (existsSync(saveFile)) {
              const saveData = readFileSync(saveFile);
              const gameBasename = path.basename(session.path, path.extname(session.path));
              socket.emit('save-data', {
                game: gameBasename,
                data: saveData.toString('base64'),
                timestamp: Date.now()
              });
              console.log('[Save] Sent save data to client:', saveFile, '(' + saveData.length + ' bytes)');
              // Clean up server-side file
              try { unlinkSync(saveFile); } catch (e) {}
            } else {
              console.log('[Save] File not found:', saveFile);
            }
            session.pendingSaveFile = null;
          }, 300);
        }
      }, 500);

    } catch (error) {
      console.error('[Game] Command error:', error);
      socket.emit('error', error.message);
    }
  });

  // Restore game from client save data
  socket.on('restore-data', async ({ data }) => {
    const session = gameSessions.get(socket.id);

    if (!session) {
      socket.emit('error', 'No game running');
      return;
    }

    let tempFile = null;
    try {
      // Write save data to temp file
      tempFile = path.join(savesDir, `restore_${socket.id}_${Date.now()}.sav`);
      writeFileSync(tempFile, Buffer.from(data, 'base64'));
      console.log('[Restore] Wrote temp file:', tempFile);

      let outputBuffer = '';

      const dataHandler = (data) => {
        outputBuffer += data.toString();
      };

      session.process.stdout.on('data', dataHandler);

      // Send RESTORE command, then filename
      session.process.stdin.write('restore\n');

      setTimeout(() => {
        session.process.stdin.write(tempFile + '\n');
        console.log('[Restore] Sent filename to Frotz:', tempFile);
      }, 200);

      // Wait for response
      setTimeout(() => {
        session.process.stdout.removeListener('data', dataHandler);
        session.lastOutput = outputBuffer;

        const { htmlOutput, statusLine, hasClearScreen } = processFrotzOutput(outputBuffer);

        // Clear screen on restore (new game state)
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
      }, 700);

    } catch (error) {
      console.error('[Restore] Error:', error);
      socket.emit('error', error.message);
      // Ensure temp file cleanup on error
      if (tempFile && existsSync(tempFile)) {
        try { unlinkSync(tempFile); } catch (e) {}
      }
    }
  });


  // Generate TTS audio (with optional voice override for special text)
  socket.on('speak-text', async (data) => {
    try {
      const startTime = Date.now();

      // Support both string and object format
      const text = typeof data === 'string' ? data : data.text;
      const isInstruction = typeof data === 'object' && data.isInstruction;

      console.log(`[TTS] Received text (${text.length} chars)`);

      // Split into lines for processing
      const lines = text.split('\n');
      const processedLines = [];

      for (let line of lines) {
        const trimmed = line.trim();

        // Skip empty lines
        if (!trimmed) continue;

        // Skip score lines
        if (trimmed.match(/Score:\s*\d+/)) continue;

        // Skip prompts
        if (trimmed.match(/^>+\s*$/)) continue;

        // Skip single artifacts (dots, parentheses)
        if (trimmed.match(/^[.\)]+$/)) {
          console.log(`[Parse] Skipping artifact: "${trimmed}"`);
          continue;
        }

        // Normalize spaced-out text (e.g., "A N C H O R H E A D" -> "Anchorhead")
        // Convert to title case so TTS pronounces it as a word, not letters
        let normalized = trimmed.replace(/\b([A-Z])\s+(?=[A-Z]\s|[A-Z]$)/g, '$1');

        // If we collapsed spaced letters, convert to title case for better TTS pronunciation
        if (normalized !== trimmed && normalized.match(/^[A-Z]+$/)) {
          normalized = normalized.charAt(0) + normalized.slice(1).toLowerCase();
        }

        // Remove periods from initials (H.P. -> H P)
        normalized = normalized.replace(/\b([A-Z])\.\s*/g, '$1 ');

        // Remove brackets from instructions but keep the text
        normalized = normalized.replace(/^\[/, '').replace(/\]$/, '');

        // Remove single quotes around single letters (e.g., 'R' -> R)
        normalized = normalized.replace(/'([A-Z])'/g, '$1');

        // Skip very short lines (but keep longer ones)
        if (normalized.length < 5) continue;

        // Keep everything else
        processedLines.push(normalized);
      }

      const cleaned = processedLines.join('. ').trim();  // Join with periods for better sentence flow

      console.log(`[TTS] After processing: ${processedLines.length} lines kept`);
      console.log(`[TTS] Cleaned text (${cleaned.length} chars): "${cleaned}"`);

      if (cleaned.length < 10) {
        console.log('[TTS] SKIPPED - text too short (<10 chars)');
        socket.emit('audio-ready', null);
        return;
      }

      // Truncate if needed
      const maxLength = 500;
      let speakText = cleaned.length > maxLength ? cleaned.substring(0, maxLength) + '...' : cleaned;

      // Fix pronunciation issues with a dictionary
      const pronunciationMap = {
        'Anchorhead': 'Anchor-head',
        'ANCHORHEAD': 'ANCHOR-HEAD',
        // Add more as needed
      };

      for (const [word, pronunciation] of Object.entries(pronunciationMap)) {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        speakText = speakText.replace(regex, pronunciation);
      }

      console.log(`[TTS] >>> SPEAKING: "${speakText}"`);

      // Browser TTS only - return the text (client will speak it)
      console.log('[TTS] Using browser TTS, returning text');
      socket.emit('audio-ready', speakText);

    } catch (error) {
      console.error('[TTS] Error:', error);
      socket.emit('audio-ready', null);
    }
  });

  // Disconnect handler
  socket.on('disconnect', () => {
    console.log('[Server] Client disconnected:', socket.id);

    // Clean up game process
    if (gameSessions.has(socket.id)) {
      const session = gameSessions.get(socket.id);
      session.process.kill();
      gameSessions.delete(socket.id);
    }
  });
});

// Get network IP address
async function getLocalIP() {
  const os = await import('os');
  const nets = os.networkInterfaces();

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip internal and non-IPv4
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

// Start server
const PORT = config.port || 3000;

httpServer.listen(PORT, async () => {
  const localIP = await getLocalIP();

  console.log('\n🎮 IF Talk - Voice-Powered Interactive Fiction\n');
  console.log(`✅ Server running with HTTPS!`);
  console.log(`\n📱 Access from:`);
  console.log(`   This computer:  https://localhost:${PORT}`);
  console.log(`   Your phone:     https://${localIP}:${PORT}`);
  console.log(`   (Make sure phone is on same WiFi)\n`);
  console.log(`🔊 Voice: ${config.voice.enabled ? 'Enabled' : 'Disabled'}`);
  console.log(`🎮 Frotz: ${config.interpreter} ${config.interpreterArgs.join(' ')}`);
  console.log(`\nPress Ctrl+C to stop\n`);
});
