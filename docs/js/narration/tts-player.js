/**
 * TTS Player Module
 *
 * Text-to-speech playback using browser's built-in voices.
 * Handles audio playback, voice configuration, and pronunciation fixes.
 */

import { state } from '../core/state.js';
import { dom } from '../core/dom.js';
import { updateStatus } from '../utils/status.js';
import { fixPronunciation } from '../utils/pronunciation.js';
import { recordSpokenChunk } from '../voice/echo-detection.js';
import { updateTextHighlight, removeHighlight } from './highlighting.js';
import { getDefaultVoice } from '../ui/settings.js';
import { scrollToBottom } from '../utils/scroll.js';

// Keep-alive audio context for mobile background playback
let keepAliveAudio = null;
let keepAliveContext = null;

/**
 * Start silent audio to keep browser active during phone sleep
 * Uses Web Audio API to generate inaudible tone
 */
export function startKeepAlive() {
  if (keepAliveContext) return; // Already running

  try {
    keepAliveContext = new (window.AudioContext || window.webkitAudioContext)();

    // Create a very quiet oscillator (inaudible but keeps audio context alive)
    const oscillator = keepAliveContext.createOscillator();
    const gainNode = keepAliveContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(keepAliveContext.destination);

    // Set volume to nearly zero (inaudible)
    gainNode.gain.value = 0.001;
    oscillator.frequency.value = 1; // Very low frequency

    oscillator.start();

    // Set up Media Session API for lock screen controls
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'IFTalk Narration',
        artist: 'Interactive Fiction',
        album: state.currentGameName || 'Game'
      });

      navigator.mediaSession.setActionHandler('play', () => {
        // Resume narration if paused
        if (state.narrationEnabled && !state.isNarrating) {
          import('./navigation.js').then(nav => nav.resumeNarration());
        }
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        stopNarration();
      });

      navigator.mediaSession.setActionHandler('stop', () => {
        stopNarration();
        stopKeepAlive();
      });
    }

    console.log('[KeepAlive] Started background audio context');
  } catch (err) {
    console.warn('[KeepAlive] Failed to start:', err);
  }
}

/**
 * Stop the keep-alive audio
 */
export function stopKeepAlive() {
  if (keepAliveContext) {
    try {
      keepAliveContext.close();
    } catch (err) {
      // Ignore
    }
    keepAliveContext = null;
    console.log('[KeepAlive] Stopped background audio context');
  }
}

/**
 * Play audio (supports both base64 audio from ElevenLabs and browser TTS)
 * @param {string} audioDataOrText - Base64 audio data or text for browser TTS
 * @returns {Promise<void>} Resolves when audio finishes
 */
export async function playAudio(audioDataOrText) {
  if (!audioDataOrText || !state.narrationEnabled) {
    return;
  }

  // Stop any currently playing audio/speech
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
  }
  if (state.currentAudio) {
    state.currentAudio.pause();
    state.currentAudio.currentTime = 0;
    state.currentAudio = null;
  }

  state.isNarrating = true;
  updateStatus('🔊 Speaking... (say "Skip" to stop)', 'speaking');

  // Check if using browser TTS (plain text) or audio file (base64)
  if (typeof audioDataOrText === 'string' && audioDataOrText.length < 1000) {
    // Probably text for browser TTS
    return playWithBrowserTTS(audioDataOrText);
  }

  // ElevenLabs audio (base64)
  const audio = new Audio('data:audio/mpeg;base64,' + audioDataOrText);
  state.currentAudio = audio;

  return new Promise((resolve) => {
    audio.onended = () => {
      state.currentAudio = null;
      state.isNarrating = false;
      updateStatus('Ready');
      resolve();
    };

    audio.onerror = () => {
      console.error('[Audio] Playback error');
      state.currentAudio = null;
      state.isNarrating = false;
      updateStatus('Audio error');
      resolve();
    };

    audio.play().catch(err => {
      console.error('[Audio] Failed:', err);
      state.currentAudio = null;
      state.isNarrating = false;
      updateStatus('Audio playback failed');
      resolve();
    });
  });
}

/**
 * Play using browser's built-in TTS
 * @param {string} text - Text to speak
 * @param {string} voiceType - Voice type: 'narrator' or 'app'
 * @returns {Promise<void>} Resolves when speech finishes
 */
export async function playWithBrowserTTS(text, voiceType = 'narrator') {
  if (!('speechSynthesis' in window)) {
    console.error('[Browser TTS] Not supported - speechSynthesis API not available');
    state.isNarrating = false;
    return;
  }

  // Fix pronunciation issues before speaking
  const fixedText = fixPronunciation(text);

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(fixedText);

    // Find configured voice based on voice type (fall back to default if not set)
    const voices = speechSynthesis.getVoices();
    const voiceName = voiceType === 'app'
      ? state.browserVoiceConfig?.appVoice
      : state.browserVoiceConfig?.voice;

    // Use configured voice, or fall back to our preferred default
    let selectedVoice = voiceName ? voices.find(v => v.name === voiceName) : null;
    if (!selectedVoice) {
      selectedVoice = getDefaultVoice(voices);
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.rate = state.browserVoiceConfig?.rate || 1.0;
    utterance.pitch = state.browserVoiceConfig?.pitch || 1.0;
    utterance.volume = state.browserVoiceConfig?.volume ?? 1.0;

    utterance.onend = () => {
      // Don't set isNarrating = false here - let speakTextChunked manage it
      state.ttsIsSpeaking = false;
      // Recognition stays active (no need to restart - we don't stop it anymore)
      resolve();
    };

    utterance.onerror = (err) => {
      // Only log non-interrupted errors
      if (err.error !== 'interrupted') {
        console.error('[Browser TTS] Error:', err.error);
        updateStatus('TTS error: ' + err.error);
      }
      // Don't set isNarrating = false here - let speakTextChunked or stopNarration manage it
      state.ttsIsSpeaking = false;
      // Recognition stays active (no need to restart - we don't stop it anymore)
      resolve();
    };

    // Stop any current speech
    speechSynthesis.cancel();

    // Mark that TTS is speaking (but keep recognition active - echo detection will filter it)
    state.ttsIsSpeaking = true;

    // Record for echo detection BEFORE speaking (so recognition can filter it out)
    recordSpokenChunk(text);

    // Speak (recognition stays active, echo detection filters out our own voice)
    speechSynthesis.speak(utterance);
  });
}

/**
 * Speak text in chunks (with resume and navigation support)
 * @param {string|null} text - Unused (chunks come from state.narrationChunks)
 * @param {number} startFromIndex - Chunk index to start from
 */
export async function speakTextChunked(text, startFromIndex = 0) {
  // Import ensureChunksReady dynamically to avoid circular dependency
  const { ensureChunksReady } = await import('../ui/game-output.js');

  // Check if narration is enabled at the very start
  if (!state.narrationEnabled) {
    return;
  }

  // Wait for app voice to finish before starting narration
  if (state.appVoicePromise) {
    await state.appVoicePromise;
  }

  // Stop any currently playing narration to prevent double voices
  if (state.isNarrating) {
    await stopNarration();
    // Give the old loop time to fully exit
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  // Increment session ID to invalidate any old loops
  state.narrationSessionId++;
  const currentSessionId = state.narrationSessionId;

  // LAZY CHUNKING: Create chunks on-demand if needed
  if (!ensureChunksReady()) {
    console.warn('[TTS] Failed to prepare chunks for narration');
    return;
  }

  console.log('[TTS] speakTextChunked - startFromIndex:', startFromIndex, 'total chunks:', state.narrationChunks.length);

  state.currentChunkIndex = startFromIndex;
  state.isPaused = false;
  state.isNarrating = true;

  // Start keep-alive for mobile background playback
  startKeepAlive();

  console.log('[TTS] Starting narration from chunk index:', state.currentChunkIndex);

  const totalChunks = state.narrationChunks.length;

  // Update nav buttons now that chunks are ready
  const { updateNavButtons } = await import('../ui/nav-buttons.js');
  updateNavButtons();

  // Start from current index
  for (let i = state.currentChunkIndex; i < totalChunks; i++) {
    // Check if this session is still valid (not superseded by newer narration)
    if (currentSessionId !== state.narrationSessionId) {
      // Don't remove highlight - the new session will manage it
      updateNavButtons();
      break;
    }

    // Update position
    state.currentChunkIndex = i;

    // Check narration state
    if (!state.narrationEnabled || state.isPaused) {
      // NOTE: Currently there is no "stop" command (only pause).
      // If stop is reimplemented, add: if (!state.isPaused) { removeHighlight(); }
      updateNavButtons();
      break;
    }

    // Highlight current sentence
    // For chunk 0, add RAF delay to ensure DOM is fully rendered
    if (i === 0) {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
    updateTextHighlight(i);

    // Update nav buttons for current position
    updateNavButtons();

    const chunk = state.narrationChunks[i];
    const chunkText = typeof chunk === 'string' ? chunk : chunk.text;
    const voiceType = typeof chunk === 'object' ? chunk.voice : 'narrator';

    // Use browser TTS directly (no server round-trip needed)
    // Mark when this chunk started playing
    state.currentChunkStartTime = Date.now();
    await playWithBrowserTTS(chunkText, voiceType);

    // Check if we should still continue
    if (!state.narrationEnabled || state.isPaused) {
      // NOTE: Currently there is no "stop" command (only pause).
      // If stop is reimplemented, add: if (!state.isPaused) { removeHighlight(); }
      break;
    }
  }

  // Finished all chunks
  // Only clean up if this is still the current session (not superseded)
  if (currentSessionId === state.narrationSessionId) {
    if (state.currentChunkIndex >= totalChunks - 1 && state.narrationEnabled && !state.isPaused) {
      // Completed all chunks naturally
      state.currentChunkIndex = totalChunks;
      state.narrationEnabled = false;
      state.isPaused = true;
      state.isNarrating = false;

      removeHighlight();

      // Scroll to bottom
      scrollToBottom();

      updateStatus('Ready');
      updateNavButtons();
    } else {
      // Interrupted (paused) - preserve highlight
      // NOTE: Currently there is no "stop" command (only pause).
      // If stop is reimplemented, add: if (!state.isPaused) { removeHighlight(); }
      updateNavButtons();
    }
  }
  // If session was superseded, don't remove highlight - new session will manage it
}

/**
 * Stop narration
 * @param {boolean} preserveHighlight - If true, don't remove highlighting
 */
export async function stopNarration(preserveHighlight = false) {

  // Cancel browser TTS
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
  }

  if (state.currentAudio) {
    state.currentAudio.pause();
    state.currentAudio.currentTime = 0;
    state.currentAudio = null;
  }

  state.isNarrating = false;
  state.isPaused = true;

  // Clear echo detection buffer to prevent blocking commands after pause
  state.recentlySpokenChunks = [];

  // Stop keep-alive audio (saves battery when not narrating)
  stopKeepAlive();

  // Only update status if not showing something else
  const statusText = dom.status?.textContent || '';
  if (statusText.includes('Speaking')) {
    updateStatus('Ready');
  }

  // Remove highlighting unless preserving it
  if (!preserveHighlight) {
    removeHighlight();
  }

  // Update nav buttons to reflect stopped state
  const { updateNavButtons } = await import('../ui/nav-buttons.js');
  updateNavButtons();
}

/**
 * Speak feedback using app voice (for confirmations)
 * @param {string} text - Text to speak
 * @returns {Promise<void>} Promise that resolves when speech is done
 */
export function speakAppMessage(text) {
  if (!('speechSynthesis' in window) || !text) return Promise.resolve();

  state.appVoicePromise = new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = speechSynthesis.getVoices();
    const appVoiceName = state.browserVoiceConfig?.appVoice;

    // Use configured app voice, or fall back to our preferred default
    let appVoice = appVoiceName ? voices.find(v => v.name === appVoiceName) : null;
    if (!appVoice) {
      appVoice = getDefaultVoice(voices);
    }

    if (appVoice) {
      utterance.voice = appVoice;
    }

    utterance.rate = 1.3;  // Faster for quick confirmations
    utterance.pitch = 1.0;
    utterance.volume = (state.browserVoiceConfig?.volume ?? 1.0) * 0.8;  // Slightly quieter than narration

    utterance.onend = () => {
      state.appVoicePromise = null;
      resolve();
    };

    utterance.onerror = () => {
      state.appVoicePromise = null;
      resolve();
    };

    speechSynthesis.speak(utterance);
  });

  return state.appVoicePromise;
}
