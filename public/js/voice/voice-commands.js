/**
 * Voice Commands Module
 *
 * Processes voice keywords for navigation and game control.
 * Handles both navigation commands (back, skip, pause) and game commands.
 */

import { state } from '../core/state.js';
import { dom } from '../core/dom.js';
import { updateStatus } from '../utils/status.js';
import { speakAppMessage } from '../narration/tts-player.js';

/**
 * Process voice keywords (navigation and game commands)
 * @param {string} transcript - Voice recognition transcript
 * @param {Object} handlers - Object with handler functions for different commands
 * @returns {string|false} Processed command text or false if navigation command
 */
export function processVoiceKeywords(transcript, handlers) {
  let lower = transcript.toLowerCase().trim();

  // Detect spelled-out words within the transcript
  const words = transcript.split(/\s+/);
  let modified = false;

  for (let i = 0; i < words.length; i++) {
    let letterSequence = [];
    let startIndex = i;

    while (i < words.length && words[i].length === 1 && /^[a-zA-Z]$/.test(words[i])) {
      letterSequence.push(words[i]);
      i++;
    }

    // If we found 3+ consecutive single letters, combine them
    if (letterSequence.length >= 3) {
      const combinedWord = letterSequence.join('').toUpperCase();
      console.log(`[Voice] Detected spelling: "${letterSequence.join(' ')}" -> "${combinedWord}"`);

      words.splice(startIndex, letterSequence.length, combinedWord);
      modified = true;
      speakAppMessage(`Spelled: ${combinedWord}`);

      i = startIndex - 1;
    } else if (letterSequence.length > 0) {
      i--;
    }
  }

  // If we modified the transcript, rebuild it
  if (modified) {
    transcript = words.join(' ');
    lower = transcript.toLowerCase();
    console.log(`[Voice] Modified transcript: "${transcript}"`);
  }

  // Helper to mark command as processed
  const markCommandProcessed = () => {
    state.pendingCommandProcessed = true;
    state.pausedForSound = false;
  };

  // When muted, only respond to "unmute"
  if (state.isMuted) {
    console.log('[Voice] Muted mode - checking for unmute');
    if (lower === 'unmute' || lower === 'on mute' || lower === 'un mute') {
      console.log('[Voice Command] UNMUTE (while muted)');
      markCommandProcessed();
      handlers.unmute();
      return false;
    }
    console.log('[Voice] Ignored while muted:', transcript);
    return false;
  }

  // NAVIGATION COMMANDS (never sent to game)

  if (lower === 'restart') {
    console.log('[Voice Command] RESTART');
    markCommandProcessed();
    handlers.restart();
    return false;
  }

  if (lower === 'back') {
    console.log('[Voice Command] BACK');
    markCommandProcessed();
    handlers.back();
    return false;
  }

  if (lower === 'stop' || lower === 'pause') {
    console.log('[Voice Command] STOP/PAUSE');
    markCommandProcessed();
    handlers.pause();
    return false;
  }

  if (lower === 'play') {
    console.log('[Voice Command] PLAY');
    markCommandProcessed();
    handlers.play();
    return false;
  }

  if (lower === 'skip') {
    console.log('[Voice Command] SKIP');
    markCommandProcessed();
    handlers.skip();
    return false;
  }

  if (lower === 'skip all' || lower === 'skip to end' || lower === 'skip to the end' || lower === 'end') {
    console.log('[Voice Command] SKIP TO END');
    markCommandProcessed();
    handlers.skipToEnd();
    return false;
  }

  if (lower === 'unmute' || lower === 'on mute' || lower === 'un mute') {
    console.log('[Voice Command] UNMUTE');
    markCommandProcessed();
    handlers.unmute();
    return false;
  }

  if (lower === 'mute') {
    console.log('[Voice Command] MUTE');
    markCommandProcessed();
    handlers.mute();
    return false;
  }

  // SAVE/RESTORE Commands
  if (lower === 'load game' || lower === 'restore game' || lower === 'load' || lower === 'restore') {
    console.log('[Voice Command] RESTORE LATEST');
    markCommandProcessed();
    if (handlers.restoreLatest) handlers.restoreLatest();
    return false;
  }

  const loadSlotMatch = lower.match(/^(?:load|restore)\s+slot\s+(\d+)$/);
  if (loadSlotMatch) {
    const slot = parseInt(loadSlotMatch[1]);
    console.log('[Voice Command] RESTORE SLOT', slot);
    markCommandProcessed();
    if (handlers.restoreSlot) handlers.restoreSlot(slot);
    return false;
  }

  // During narration, ignore non-navigation commands
  if (state.isNarrating && !state.pausedForSound) {
    console.log('[Voice] Ignored during narration:', transcript);
    updateStatus('🔊 Narrating... Use navigation commands');
    return false;
  }

  // GAME COMMANDS

  // "Next" or "Enter" - Send empty command
  if (lower === 'next' || lower === 'enter' || lower === 'more' || lower === 'continue') {
    console.log(`[Voice Command] ${lower.toUpperCase()} - pressing Enter`);
    handlers.sendCommandDirect('');
    return false;
  }

  // "Print [text]" - Literal text bypass
  const printMatch = transcript.match(/^print\s+(.+)$/i);
  if (printMatch) {
    const literalText = printMatch[1];
    console.log('[Voice Command] PRINT - literal:', literalText);
    handlers.sendCommandDirect(literalText);
    return false;
  }

  // Regular command - return for AI translation
  console.log('[Voice] Will translate:', transcript);
  speakAppMessage(transcript);  // Read back what we heard
  return transcript;
}
