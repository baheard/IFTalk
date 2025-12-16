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
  console.log('[Browser TTS] Attempting to speak:', text?.substring(0, 50) + '...');

  if (!('speechSynthesis' in window)) {
    console.error('[Browser TTS] Not supported - speechSynthesis API not available');
    state.isNarrating = false;
    return;
  }

  // Fix pronunciation issues before speaking
  const fixedText = fixPronunciation(text);
  console.log('[Browser TTS] Text after pronunciation fixes:', fixedText?.substring(0, 50) + '...');

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(fixedText);

    // Find configured voice
    const voices = speechSynthesis.getVoices();
    console.log('[Browser TTS] Available voices:', voices.length);
    console.log('[Browser TTS] Looking for voice:', state.browserVoiceConfig?.voice);

    const selectedVoice = voices.find(v => v.name === state.browserVoiceConfig?.voice);

    if (selectedVoice) {
      utterance.voice = selectedVoice;
      console.log('[Browser TTS] Using selected voice:', selectedVoice.name);
    } else {
      console.warn('[Browser TTS] Voice not found, using default. Config:', state.browserVoiceConfig);
    }

    utterance.rate = state.browserVoiceConfig?.rate || 1.1;
    utterance.pitch = state.browserVoiceConfig?.pitch || 1.0;
    utterance.volume = 1.0;

    console.log('[Browser TTS] Voice settings - rate:', utterance.rate, 'pitch:', utterance.pitch, 'volume:', utterance.volume);

    utterance.onend = () => {
      console.log('[Browser TTS] Speech ended successfully');
      // Don't set isNarrating = false here - let speakTextChunked manage it
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

    utterance.onerror = (err) => {
      // Silently ignore 'interrupted' errors (happens when we stop narration)
      if (err.error === 'interrupted') {
        console.log('[Browser TTS] Speech interrupted (normal during stop)');
      } else {
        console.error('[Browser TTS] Error occurred:', err.error, 'Full error:', err);
        updateStatus('TTS error: ' + err.error);
      }
      // Don't set isNarrating = false here - let speakTextChunked or stopNarration manage it
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

    utterance.onstart = () => {
      console.log('[Browser TTS] Speech started');
    };

    // Stop any current speech
    speechSynthesis.cancel();

    // Pause recognition while TTS is speaking to avoid picking up our own audio
    state.ttsIsSpeaking = true;
    if (state.recognition && state.listeningEnabled) {
      try {
        state.recognition.stop();
      } catch (err) {
        // Ignore if not started
      }
    }

    // Speak
    recordSpokenChunk(text);  // Record for echo detection BEFORE speaking
    console.log('[Browser TTS] Calling speechSynthesis.speak()');
    speechSynthesis.speak(utterance);
    console.log('[Browser TTS] speechSynthesis.speak() called, waiting for events...');
  });
}

/**
 * Speak text in chunks (with resume and navigation support)
 * @param {string|null} text - Unused (chunks come from state.narrationChunks)
 * @param {number} startFromIndex - Chunk index to start from
 */
export async function speakTextChunked(text, startFromIndex = 0) {
  console.log('[TTS Chunked] Starting narration from chunk', startFromIndex);

  // Import ensureChunksReady dynamically to avoid circular dependency
  const { ensureChunksReady } = await import('../ui/game-output.js');

  // Check if narration is enabled at the very start
  if (!state.narrationEnabled) {
    console.log('[TTS Chunked] Narration not enabled, aborting');
    return;
  }

  // Wait for app voice to finish before starting narration
  if (state.appVoicePromise) {
    console.log('[TTS Chunked] Waiting for app voice to finish');
    await state.appVoicePromise;
  }

  // Stop any currently playing narration to prevent double voices
  if (state.isNarrating) {
    console.log('[TTS Chunked] Stopping previous narration');
    await stopNarration();
    // Give the old loop time to fully exit
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  // Increment session ID to invalidate any old loops
  state.narrationSessionId++;
  const currentSessionId = state.narrationSessionId;
  console.log('[TTS Chunked] New session ID:', currentSessionId);

  // LAZY CHUNKING: Create chunks on-demand if needed
  if (!ensureChunksReady()) {
    console.warn('[TTS Chunked] Failed to prepare chunks for narration');
    return;
  }

  console.log('[TTS Chunked] Chunks ready, total:', state.narrationChunks.length);


  state.currentChunkIndex = startFromIndex;
  state.isPaused = false;
  state.isNarrating = true;

  const totalChunks = state.narrationChunks.length;

  // Update nav buttons now that chunks are ready
  const { updateNavButtons } = await import('../ui/nav-buttons.js');
  updateNavButtons();

  // Start from current index
  for (let i = state.currentChunkIndex; i < totalChunks; i++) {
    // Check if this session is still valid (not superseded by newer narration)
    if (currentSessionId !== state.narrationSessionId) {
      removeHighlight();
      updateNavButtons();
      break;
    }

    // Update position
    state.currentChunkIndex = i;

    // Check narration state
    if (!state.narrationEnabled || state.isPaused) {
      removeHighlight();
      updateNavButtons();
      break;
    }

    // Highlight current sentence
    updateTextHighlight(i);

    // Update nav buttons for current position
    updateNavButtons();

    const chunkText = state.narrationChunks[i];

    // DEBUG: Pause before speaking to allow visual verification
    await new Promise(resolve => setTimeout(resolve, 800));

    // Use browser TTS directly (no server round-trip needed)
    // Mark when this chunk started playing
    state.currentChunkStartTime = Date.now();
    await playWithBrowserTTS(chunkText);

    // Check if we should still continue
    if (!state.narrationEnabled || state.isPaused) {
      removeHighlight();
      break;
    }
  }

  // Finished all chunks

  if (state.currentChunkIndex >= totalChunks - 1 && state.narrationEnabled && !state.isPaused) {

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
    updateNavButtons();
  } else {
    removeHighlight();
    updateNavButtons();
  }
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
    const appVoice = voices.find(v => v.name === state.browserVoiceConfig?.appVoice);

    if (appVoice) {
      utterance.voice = appVoice;
    }

    utterance.rate = 1.3;  // Faster for quick confirmations
    utterance.pitch = 1.0;
    utterance.volume = 0.8;  // Slightly quieter than narration

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
