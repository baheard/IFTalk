/**
 * Voice UI Module
 *
 * Handles voice indicator and transcript display.
 */

// Voice UI elements
let voiceListeningIndicatorEl = null;
let voiceTranscriptEl = null;

/**
 * Initialize voice UI elements
 */
export function initVoiceUI() {
  voiceListeningIndicatorEl = document.getElementById('voiceListeningIndicator');
  voiceTranscriptEl = document.getElementById('voiceTranscript');
}

/**
 * Update voice indicator state (for speaking animation)
 * @param {boolean} isSpeaking - Whether user is currently speaking
 */
export function setVoiceSpeaking(isSpeaking) {
  if (voiceListeningIndicatorEl) {
    if (isSpeaking) {
      voiceListeningIndicatorEl.classList.add('speaking');
    } else {
      voiceListeningIndicatorEl.classList.remove('speaking');
    }
  }
}

/**
 * Update voice transcript text
 * @param {string} text - Text to display
 * @param {string} mode - 'listening', 'interim', 'confirmed', or 'nav'
 */
export function updateVoiceTranscript(text, mode = 'listening') {
  if (voiceTranscriptEl) {
    voiceTranscriptEl.textContent = text;
    voiceTranscriptEl.classList.remove('interim', 'confirmed', 'nav-command');

    if (mode === 'interim') {
      voiceTranscriptEl.classList.add('interim');
    } else if (mode === 'confirmed') {
      voiceTranscriptEl.classList.add('confirmed');
    } else if (mode === 'nav') {
      voiceTranscriptEl.classList.add('nav-command');
    }
  }
}

/**
 * Show voice listening indicator
 */
export function showVoiceIndicator() {
  if (voiceListeningIndicatorEl) {
    voiceListeningIndicatorEl.classList.remove('hidden');
  }
}

/**
 * Hide voice listening indicator
 */
export function hideVoiceIndicator() {
  if (voiceListeningIndicatorEl) {
    voiceListeningIndicatorEl.classList.add('hidden');
  }
}
