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
import { updateVoiceTranscript } from '../input/keyboard.js';

// Audio context for bell sound
let bellContext = null;

/**
 * Play a short bell/chime sound to indicate command was sent
 */
function playBellSound() {
  try {
    if (!bellContext) {
      bellContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    const oscillator = bellContext.createOscillator();
    const gainNode = bellContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(bellContext.destination);

    // Bell-like sound: high frequency, quick decay
    oscillator.frequency.value = 880; // A5 note
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, bellContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, bellContext.currentTime + 0.15);

    oscillator.start(bellContext.currentTime);
    oscillator.stop(bellContext.currentTime + 0.15);
  } catch (err) {
    // Ignore audio errors
  }
}

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
 * Show confirmed transcript then reset to Listening after 3 seconds
 * @param {string} text - Confirmed transcript text
 * @param {boolean} isNavCommand - Whether this was a navigation command
 */
export function showConfirmedTranscript(text, isNavCommand = false) {
  // Clear any pending reset
  if (state.transcriptResetTimeout) {
    clearTimeout(state.transcriptResetTimeout);
  }

  // Update both DOM transcript and keyboard indicator
  const mode = isNavCommand ? 'nav' : 'confirmed';
  updateVoiceTranscript(text, mode);

  // Also update old DOM element if it exists
  if (dom.voiceTranscript) {
    dom.voiceTranscript.textContent = text;
    dom.voiceTranscript.classList.remove('interim');
    dom.voiceTranscript.classList.add('confirmed');
    if (isNavCommand) {
      dom.voiceTranscript.classList.add('nav-command');
    } else {
      dom.voiceTranscript.classList.remove('nav-command');
    }
  }

  // Also update lastHeard for history
  updateLastHeard(text, isNavCommand);

  // Reset transcript after 3 seconds
  state.transcriptResetTimeout = setTimeout(() => {
    updateVoiceTranscript(state.isMuted ? 'Muted' : 'Listening...', 'listening');
    if (dom.voiceTranscript) {
      dom.voiceTranscript.textContent = state.isMuted ? 'Muted' : 'Listening...';
      dom.voiceTranscript.classList.remove('confirmed', 'nav-command');
    }
  }, 3000);
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
    if (interimTranscript && !state.isMuted) {
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

      // Update voice indicator with interim text
      updateVoiceTranscript(interimTranscript, 'interim');

      // Also update old DOM element if it exists
      if (dom.voiceTranscript) {
        dom.voiceTranscript.textContent = interimTranscript;
        dom.voiceTranscript.classList.remove('confirmed');
        dom.voiceTranscript.classList.add('interim');
      }
    }

    // Process final result
    if (finalTranscript && !state.hasProcessedResult) {
      // Check for echo
      try {
        if (isEchoOfSpokenText(finalTranscript)) {
          updateVoiceTranscript(state.isMuted ? 'Muted' : 'Listening...', 'listening');
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

      if (processed !== false) {
        // Voice command processed - populate input and show indicator
        if (dom.userInput) {
          dom.userInput.value = processed;
        }
        if (dom.voiceIndicator) {
          dom.voiceIndicator.classList.add('active');
        }

        state.hasManualTyping = false;

        // Auto-submit after brief delay to show user what was recognized
        setTimeout(() => {
          // Play bell sound to indicate command sent
          playBellSound();

          // Import and call sendCommandDirect
          import('../game/commands.js').then(({ sendCommandDirect }) => {
            sendCommandDirect(processed, true); // true = is voice command

            // Clear input and hide indicator after sending
            if (dom.userInput) {
              dom.userInput.value = '';
            }
            if (dom.voiceIndicator) {
              dom.voiceIndicator.classList.remove('active');
            }
          });
        }, 400); // 400ms delay to show the recognized command
      } else {
        // Navigation command was handled
        state.hasManualTyping = false;
      }
    }
  };

  recognition.onerror = (event) => {
    // Silently ignore common expected errors
    if (event.error === 'network' || event.error === 'aborted') {
      return;
    } else if (event.error === 'no-speech') {
      // Ignore no-speech errors
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

    // Voice commands are now sent immediately in onresult handler
    // No need to check for input field or auto-send here

    // Always restart listening if continuous mode enabled
    if (state.listeningEnabled && !state.ttsIsSpeaking) {
      setTimeout(() => {
        if (state.listeningEnabled && !state.ttsIsSpeaking && !state.isRecognitionActive) {
          try {
            // Clear transcript display if not showing confirmed text
            if (dom.voiceTranscript && !dom.voiceTranscript.classList.contains('confirmed')) {
              updateVoiceTranscript(state.isMuted ? 'Muted' : 'Listening...', 'listening');
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
      }, 200); // Reduced from 300ms
    }
  };

  return recognition;
}
