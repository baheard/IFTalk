import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import OpenAI from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';
import Convert from 'ansi-to-html';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
const httpServer = createServer(app);
const io = new Server(httpServer);

// Serve static files
app.use(express.static('public'));

// API endpoint to get config (for client-side voice settings)
app.get('/api/config', (req, res) => {
  res.json({
    voice: config.voice,
    provider: config.provider
  });
});

// Initialize AI provider
const providerConfig = config.providers[config.provider];
const apiKey = providerConfig.apiKeyEnv
  ? process.env[providerConfig.apiKeyEnv] || 'dummy-key'
  : 'not-needed';

const ai = new OpenAI({
  baseURL: config.baseURL || providerConfig.baseURL,
  apiKey: apiKey,
  defaultHeaders: config.provider === 'claude' ? {
    'anthropic-version': '2023-06-01'
  } : {}
});

const model = config.model || providerConfig.model;

// Game sessions (one per socket connection)
const gameSessions = new Map();

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('[Server] Client connected:', socket.id);

  // Note: Game now runs client-side with Parchment Z-machine interpreter
  // Server only handles AI translation and TTS

  // Translate natural language to IF command
  socket.on('translate-command', async (userInput) => {
    try {
      // Note: Game runs client-side with Parchment, so no room context available
      // AI translates based on user input and general IF command knowledge only

      const messages = [
        {
          role: 'system',
          content: `You are a command translator for interactive fiction games. Convert natural language to valid IF commands.

Rules:
- Return a JSON object with: {"command": "THE_COMMAND", "confidence": 0-100, "reasoning": "brief explanation"}
- Common directions: N, S, E, W, NE, NW, SE, SW, U (up), D (down), IN, OUT
- Common actions: LOOK, EXAMINE [object], TAKE [object], DROP [object], INVENTORY (or I), OPEN [object], CLOSE [object]
- IMPORTANT: "press enter", "next", "continue" -> empty string "" (just pressing Enter)
- IMPORTANT: If user says "look at [object]" or "examine [object]", preserve the object in the command (e.g., "EXAMINE ALLEY" or "LOOK AT ALLEY", NOT just "LOOK")
- Only use "LOOK" alone when user doesn't specify an object (e.g., "look around")

Confidence levels:
- 90-100: Clear, unambiguous command OR standard action
- 70-89: Reasonable interpretation
- 50-69: Uncertain, guessing at meaning
- Below 50: Unclear input, probably wrong

Examples:
Input: "look around" -> {"command": "LOOK", "confidence": 100, "reasoning": "Standard look command"}
Input: "look at alley" -> {"command": "EXAMINE ALLEY", "confidence": 100, "reasoning": "User specified object to examine"}
Input: "look at the door" -> {"command": "EXAMINE DOOR", "confidence": 100, "reasoning": "User specified object to examine"}
Input: "examine sword" -> {"command": "EXAMINE SWORD", "confidence": 100, "reasoning": "Direct examine command"}
Input: "press enter" -> {"command": "", "confidence": 100, "reasoning": "User wants to press Enter"}
Input: "next" -> {"command": "", "confidence": 100, "reasoning": "Continue/next means press Enter"}
Input: "go north" -> {"command": "N", "confidence": 100, "reasoning": "Clear direction"}
Input: "check inventory" -> {"command": "INVENTORY", "confidence": 100, "reasoning": "Standard inventory command"}`
        },
        {
          role: 'user',
          content: `User input: "${userInput}"\n\nTranslate to IF command (return JSON):`
        }
      ];

      const response = await ai.chat.completions.create({
        model: model,
        messages: messages,
        temperature: 0.1,  // Lower for more deterministic translations
        max_tokens: 100
      });

      const responseText = response.choices[0].message.content.trim();
      console.log('[AI] Raw response:', responseText);

      // Parse JSON response
      let result;
      try {
        // Try to extract JSON from response (in case AI wraps it in markdown)
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        const jsonText = jsonMatch ? jsonMatch[0] : responseText;
        result = JSON.parse(jsonText);
      } catch (parseError) {
        // Fallback if JSON parsing fails
        console.warn('[AI] Failed to parse JSON, using fallback:', parseError);
        result = {
          command: responseText,
          confidence: 50,
          reasoning: 'AI did not return valid JSON'
        };
      }

      console.log(`[AI] Translation: "${userInput}" -> "${result.command}" (${result.confidence}% confident: ${result.reasoning})`);

      // Send result with confidence info
      socket.emit('command-translated', result);

    } catch (error) {
      console.error('[AI] Translation error:', error);
      // Fallback to passing through user input
      socket.emit('command-translated', {
        command: userInput,
        confidence: 100,
        reasoning: 'AI translation failed, using raw input'
      });
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

      // If using browser TTS, just return the text (client will speak it)
      if (config.voice.tts.method === 'browser') {
        console.log('[TTS] Using browser TTS, returning text');
        socket.emit('audio-ready', speakText);  // Send text instead of audio
        return;
      }

      // ElevenLabs TTS - Use different voice for instructions in brackets
      const hasInstructions = cleaned.match(/\[.*\]/);
      const useInstructionVoice = hasInstructions || isInstruction;

      const voiceId = useInstructionVoice
        ? (config.voice.tts.elevenlabs.instruction_voice_id || config.voice.tts.elevenlabs.voice_id)
        : config.voice.tts.elevenlabs.voice_id;

      console.log(`[TTS] Generating audio for ${speakText.length} chars (${useInstructionVoice ? 'INSTRUCTION voice' : 'normal voice'})`);

      const modelId = config.voice.tts.elevenlabs.model_id;
      const apiKey = process.env.ELEVENLABS_API_KEY || config.voice.tts.elevenlabs.api_key;

      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey
        },
        body: JSON.stringify({
          text: speakText,
          model_id: modelId,
          voice_settings: {
            stability: config.voice.tts.elevenlabs.stability || 0.5,
            similarity_boost: config.voice.tts.elevenlabs.similarity_boost || 0.75
          }
        })
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs error: ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const base64Audio = buffer.toString('base64');

      const totalTime = Date.now() - startTime;
      console.log(`[TTS] Generated in ${totalTime}ms, audio size: ${buffer.length} bytes`);

      socket.emit('audio-ready', base64Audio);

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
  console.log(`✅ Server running!`);
  console.log(`\n📱 Access from:`);
  console.log(`   This computer:  http://localhost:${PORT}`);
  console.log(`   Your phone:     http://${localIP}:${PORT}`);
  console.log(`   (Make sure phone is on same WiFi)\n`);
  console.log(`🤖 AI Provider: ${config.provider} (${model})`);
  console.log(`🔊 Voice: ${config.voice.enabled ? 'Enabled' : 'Disabled'}`);
  console.log(`\nPress Ctrl+C to stop\n`);
});
