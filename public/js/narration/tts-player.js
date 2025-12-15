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
 * @returns {Promise<void>} Resolves when speech finishes
 */
export async function playWithBrowserTTS(text) {
  if (!('speechSynthesis' in window)) {
    console.error('[Browser TTS] Not supported');
    state.isNarrating = false;
    return;
  }

  // Fix pronunciation issues before speaking
  const fixedText = fixPronunciation(text);

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(fixedText);

    // Find configured voice
    const voices = speechSynthesis.getVoices();
    const selectedVoice = voices.find(v => v.name === state.browserVoiceConfig?.voice);

    if (selectedVoice) {
      utterance.voice = selectedVoice;
      console.log('[Browser TTS] Using voice:', selectedVoice.name);
    } else {
      console.warn('[Browser TTS] Voice not found, using default');
    }

    utterance.rate = state.browserVoiceConfig?.rate || 1.1;
    utterance.pitch = state.browserVoiceConfig?.pitch || 1.0;
    utterance.volume = 1.0;

    utterance.onend = () => {
      state.isNarrating = false;
      state.ttsIsSpeaking = false;
      updateStatus('Ready');
      // Resume recognition if listening was enabled
      if (state.listeningEnabled && state.recognition && !state.isMuted && !state.isRecognitionActive) {
        try {
          state.recognition.start();
        } catch (err) {
          // Ignore if already started
        }
      }
      resolve();
    };

    utterance.onerror = (err) => {
      // Silently ignore 'interrupted' errors (happens when we stop narration)
      if (err.error === 'interrupted') {
        console.log('[Browser TTS] Interrupted (expected)');
      } else {
        console.error('[Browser TTS] Error:', err);
        updateStatus('TTS error');
      }
      state.isNarrating = false;
      state.ttsIsSpeaking = false;
      // Resume recognition if listening was enabled
      if (state.listeningEnabled && state.recognition && !state.isMuted && !state.isRecognitionActive) {
        try {
          state.recognition.start();
        } catch (err) {
          // Ignore if already started
        }
      }
      resolve();
    };

    // Stop any current speech
    speechSynthesis.cancel();

    // Pause recognition while TTS is speaking to avoid picking up our own audio
    state.ttsIsSpeaking = true;
    if (state.recognition && state.listeningEnabled) {
      try {
        state.recognition.stop();
        console.log('[Voice] Paused recognition during TTS');
      } catch (err) {
        // Ignore if not started
      }
    }

    // Speak
    recordSpokenChunk(text);  // Record for echo detection BEFORE speaking
    speechSynthesis.speak(utterance);
    console.log('[Browser TTS] Speaking:', text.substring(0, 50) + '...');
  });
}

/**
 * Speak text in chunks (with resume and navigation support)
 * @param {string|null} text - Unused (chunks come from state.narrationChunks)
 * @param {number} startFromIndex - Chunk index to start from
 */
export async function speakTextChunked(text, startFromIndex = 0) {
  // Check if narration is enabled at the very start
  if (!state.narrationEnabled) {
    console.log('[TTS] Narration disabled, not starting');
    return;
  }

  // Wait for app voice to finish before starting narration
  if (state.appVoicePromise) {
    console.log('[TTS] Waiting for app voice to finish...');
    await state.appVoicePromise;
    console.log('[TTS] App voice finished, starting narration');
  }

  // Stop any currently playing narration to prevent double voices
  if (state.currentAudio) {
    console.log('[TTS] Stopping previous narration');
    stopNarration();
  }

  // CRITICAL: Capture the session ID
  const mySessionId = state.narrationSessionId;
  console.log('[TTS] Starting narration session', mySessionId);

  state.currentChunkIndex = startFromIndex;
  state.isPaused = false;

  const totalChunks = state.narrationChunks.length;

  // Start from current index
  for (let i = state.currentChunkIndex; i < totalChunks; i++) {
    console.log(`[TTS Loop] Iteration start: i=${i}, sessionID=${mySessionId}/${state.narrationSessionId}`);

    // CRITICAL: Check if this session is still valid
    if (mySessionId !== state.narrationSessionId) {
      console.log(`[TTS] Session ${mySessionId} invalidated - stopping loop`);
      return;
    }

    // Update position
    state.currentChunkIndex = i;

    // Check narration state
    if (!state.narrationEnabled || state.isPaused) {
      console.log('[TTS] Loop stopped at chunk', i);
      removeHighlight();
      break;
    }

    // Highlight current sentence
    updateTextHighlight(i);

    const chunkText = state.narrationChunks[i];
    console.log(`[TTS] Playing chunk ${i + 1}/${totalChunks}: "${chunkText.substring(0, 50)}..."`);

    // Use browser TTS directly (no server round-trip needed)
    // Mark when this chunk started playing
    state.currentChunkStartTime = Date.now();
    await playWithBrowserTTS(chunkText);

    // Check session ID after playing
    if (mySessionId !== state.narrationSessionId) {
      console.log(`[TTS] Session ${mySessionId} invalidated after playing - stopping`);
      return;
    }

    // Check if we should still continue
    if (!state.narrationEnabled || state.isPaused) {
      console.log('[TTS] Cancelled - narration stopped during playback');
      removeHighlight();
      break;
    }
  }

  // Finished all chunks
  if (mySessionId !== state.narrationSessionId) {
    return;
  }

  if (state.currentChunkIndex >= totalChunks - 1 && state.narrationEnabled && !state.isPaused) {
    console.log('[TTS] Narration complete');

    state.currentChunkIndex = totalChunks;
    state.narrationEnabled = false;
    state.isPaused = true;
    state.isNarrating = false;

    removeHighlight();

    // Scroll to bottom
    if (dom.gameOutput) {
      dom.gameOutput.scrollTop = dom.gameOutput.scrollHeight;
    }

    updateStatus('Ready');
  }
}

/**
 * Stop narration
 * @param {boolean} preserveHighlight - If true, don't remove highlighting
 */
export function stopNarration(preserveHighlight = false) {
  // CRITICAL: Increment session ID to invalidate all old async loops
  state.narrationSessionId++;
  console.log('[TTS] Stopping narration - new session ID:', state.narrationSessionId);

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

  // Only update status if not showing something else
  const statusText = dom.status?.textContent || '';
  if (statusText.includes('Speaking')) {
    updateStatus('Ready');
  }

  // Remove highlighting unless preserving it
  if (!preserveHighlight) {
    removeHighlight();
  }
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
    const appVoice = voices.find(v => v.name === state.browserVoiceConfig?.appVoice);

    if (appVoice) {
      utterance.voice = appVoice;
    }

    utterance.rate = 1.3;  // Faster for quick confirmations
    utterance.pitch = 1.0;
    utterance.volume = 0.8;  // Slightly quieter than narration

    utterance.onend = () => {
      console.log('[App Voice] Finished speaking');
      state.appVoicePromise = null;
      resolve();
    };

    utterance.onerror = () => {
      state.appVoicePromise = null;
      resolve();
    };

    speechSynthesis.speak(utterance);
    console.log('[App Voice] Speaking:', text.substring(0, 50));
  });

  return state.appVoicePromise;
}
