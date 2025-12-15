/**
 * TTS Generation Module
 *
 * Generates audio using browser TTS or ElevenLabs API.
 */

import { config } from '../core/config.js';

/**
 * Generate speech audio
 * @param {string} text - Text to speak
 * @param {boolean} isInstruction - Whether this is instruction text
 * @returns {Promise<string|null>} Base64 audio data or text for browser TTS
 */
export async function generateSpeech(text, isInstruction = false) {
  try {
    const startTime = Date.now();


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

      // Skip single artifacts
      if (trimmed.match(/^[.\)]+$/)) {
        continue;
      }

      // Normalize spaced-out text
      let normalized = trimmed.replace(/\b([A-Z])\s+(?=[A-Z]\s|[A-Z]$)/g, '$1');

      // Convert to title case if collapsed spaced letters
      if (normalized !== trimmed && normalized.match(/^[A-Z]+$/)) {
        normalized = normalized.charAt(0) + normalized.slice(1).toLowerCase();
      }

      // Remove periods from initials
      normalized = normalized.replace(/\b([A-Z])\.\s*/g, '$1 ');

      // Remove brackets from instructions
      normalized = normalized.replace(/^\[/, '').replace(/\]$/, '');

      // Remove single quotes around single letters
      normalized = normalized.replace(/'([A-Z])'/g, '$1');

      // Skip very short lines
      if (normalized.length < 5) continue;

      processedLines.push(normalized);
    }

    const cleaned = processedLines.join('. ').trim();


    if (cleaned.length < 10) {
      return null;
    }

    // Truncate if needed
    const maxLength = 500;
    let speakText = cleaned.length > maxLength ? cleaned.substring(0, maxLength) + '...' : cleaned;

    // Fix pronunciation issues
    const pronunciationMap = {
      'Anchorhead': 'Anchor-head',
      'ANCHORHEAD': 'ANCHOR-HEAD',
    };

    for (const [word, pronunciation] of Object.entries(pronunciationMap)) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      speakText = speakText.replace(regex, pronunciation);
    }


    // If using browser TTS, return text
    if (config.voice.tts.method === 'browser') {
      return speakText;
    }

    // ElevenLabs TTS - Use different voice for instructions
    const hasInstructions = cleaned.match(/\[.*\]/);
    const useInstructionVoice = hasInstructions || isInstruction;

    const voiceId = useInstructionVoice
      ? (config.voice.tts.elevenlabs.instruction_voice_id || config.voice.tts.elevenlabs.voice_id)
      : config.voice.tts.elevenlabs.voice_id;


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

    return base64Audio;

  } catch (error) {
    return null;
  }
}
