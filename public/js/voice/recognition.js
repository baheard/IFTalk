/**
 * Voice Recognition Module
 *
 * Speech recognition using Web Speech API.
 * Handles continuous listening, transcript display, and result processing.
 */

import { state } from '../core/state.js';
import { dom } from '../core/dom.js';
import { updateStatus } from '../utils/status.js';
import { isEchoOfSpokenText } from './echo-detection.js';

/**
 * Update the last heard text in voice panel
 * @param {string} text - Text that was heard
 * @param {boolean} isNavCommand - Whether this was a navigation command
 */
export function updateLastHeard(text, isNavCommand = false) {
  if (dom.lastHeard) {
    dom.lastHeard.textContent = text;
    dom.lastHeard.className = 'last-heard' + (isNavCommand ? ' nav-command' : '');

    // Clear after 5 seconds
    if (state.lastHeardClearTimeout) clearTimeout(state.lastHeardClearTimeout);
    state.lastHeardClearTimeout = setTimeout(() => {
      dom.lastHeard.textContent = '';
    }, 5000);
  }

  // Add to history array
  state.voiceHistoryItems.unshift({ text, isNavCommand });
  if (state.voiceHistoryItems.length > 20) state.voiceHistoryItems.pop();
}

/**
 * Show confirmed transcript then reset to Listening after 5 seconds
 * @param {string} text - Confirmed transcript text
 * @param {boolean} isNavCommand - Whether this was a navigation command
 */
export function showConfirmedTranscript(text, isNavCommand = false) {
  if (!dom.voiceTranscript) return;

  // Clear any pending reset
  if (state.transcriptResetTimeout) {
    clearTimeout(state.transcriptResetTimeout);
  }

  dom.voiceTranscript.textContent = text;
  dom.voiceTranscript.classList.remove('interim');
  dom.voiceTranscript.classList.add('confirmed');
  if (isNavCommand) {
    dom.voiceTranscript.classList.add('nav-command');
  } else {
    dom.voiceTranscript.classList.remove('nav-command');
  }

  // Also update lastHeard for history
  updateLastHeard(text, isNavCommand);

  // Reset transcript after 5 seconds
  state.transcriptResetTimeout = setTimeout(() => {
    dom.voiceTranscript.textContent = state.isMuted ? 'Muted' : 'Listening...';
    dom.voiceTranscript.classList.remove('confirmed', 'nav-command');
  }, 5000);
}

/**
 * Initialize voice recognition
 * @param {Function} processVoiceKeywords - Function to process voice commands
 * @returns {SpeechRecognition|null} Recognition instance
 */
export function initVoiceRecognition(processVoiceKeywords) {
  let recognition = null;

  if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
  } else if ('SpeechRecognition' in window) {
    recognition = new SpeechRecognition();
  } else {
    console.warn('[Voice] Speech recognition not available');
    return null;
  }

  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    state.isListening = true;
    state.isRecognitionActive = true;
    state.hasProcessedResult = false;

    if (!state.isNarrating) {
      updateStatus('🎤 Listening... Speak now!');
    }
  };

  recognition.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';

    // Collect both interim and final results
    for (let i = 0; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        finalTranscript += result[0].transcript;
      } else {
        interimTranscript += result[0].transcript;
      }
    }

    // Show live transcript (but not when muted)
    if (interimTranscript && !state.isMuted && dom.voiceTranscript) {
      // Cancel any pending confirmed transition
      if (state.confirmedTranscriptTimeout) {
        clearTimeout(state.confirmedTranscriptTimeout);
        state.confirmedTranscriptTimeout = null;
      }

      // During narration, filter echo from interim transcripts
      try {
        if (state.isNarrating && isEchoOfSpokenText(interimTranscript)) {
          return;
        }
      } catch (e) {
        console.error('[Voice] Echo detection error (interim):', e);
      }

      dom.voiceTranscript.textContent = interimTranscript;
      dom.voiceTranscript.classList.remove('confirmed');
      dom.voiceTranscript.classList.add('interim');
      console.log('[Voice] Interim:', interimTranscript);
    }

    // Process final result
    if (finalTranscript && !state.hasProcessedResult) {
      console.log('[Voice] Final:', finalTranscript);

      // Check for echo
      try {
        if (isEchoOfSpokenText(finalTranscript)) {
          console.log('[Voice] Discarding echo:', finalTranscript);
          if (dom.voiceTranscript) {
            dom.voiceTranscript.textContent = state.isMuted ? 'Muted' : 'Listening...';
            dom.voiceTranscript.classList.remove('interim', 'confirmed');
          }
          return;
        }
      } catch (e) {
        console.error('[Voice] Echo detection error (final):', e);
      }

      // Process voice keywords
      const processed = processVoiceKeywords(finalTranscript);
      const isNavCommand = (processed === false);

      // Show as confirmed
      showConfirmedTranscript(finalTranscript, isNavCommand);

      if (processed !== false && dom.userInput) {
        dom.userInput.value = processed;
        state.hasManualTyping = false;
        updateStatus('Recognized: ' + finalTranscript);
      } else {
        // Command was handled, clear input
        if (dom.userInput) dom.userInput.value = '';
        state.hasManualTyping = false;
        console.log('[Voice] Command handled, input cleared');
      }
    }
  };

  recognition.onerror = (event) => {
    // Silently ignore common expected errors
    if (event.error === 'network' || event.error === 'aborted') {
      return;
    } else if (event.error === 'no-speech') {
      console.log('[Voice] No speech detected');
    } else {
      console.error('[Voice] Error:', event.error);
      updateStatus('Voice error: ' + event.error);
    }

    state.isListening = false;
    state.isRecognitionActive = false;
  };

  recognition.onend = () => {
    state.isListening = false;
    state.isRecognitionActive = false;

    // Only auto-send if appropriate
    const hasInput = dom.userInput && dom.userInput.value && dom.userInput.value.trim();
    const canSendDuringNarration = state.pausedForSound;

    if (hasInput && (!state.isNarrating || canSendDuringNarration) && !state.hasProcessedResult && !state.hasManualTyping) {
      console.log('[Voice] OnEnd: Auto-sending:', dom.userInput.value);
      state.hasProcessedResult = true;
      // Call sendCommand from handlers
      if (window._sendCommand) window._sendCommand();
    }

    // Always restart listening if continuous mode enabled
    if (state.listeningEnabled && !state.ttsIsSpeaking) {
      console.log('[Voice] Restarting in 300ms...');
      setTimeout(() => {
        if (state.listeningEnabled && !state.ttsIsSpeaking && !state.isRecognitionActive) {
          try {
            // Clear transcript display if not showing confirmed text
            if (dom.voiceTranscript && !dom.voiceTranscript.classList.contains('confirmed')) {
              dom.voiceTranscript.textContent = state.isMuted ? 'Muted' : 'Listening...';
              dom.voiceTranscript.classList.remove('interim');
            }

            recognition.start();
          } catch (err) {
            // Ignore if already running
            if (err.message && !err.message.includes('already')) {
              console.error('[Voice] Restart error:', err);
            }
          }
        }
      }, 300);
    }
  };

  return recognition;
}
