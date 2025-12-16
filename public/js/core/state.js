/**
 * Centralized Application State
 *
 * Single source of truth for all application state.
 * Export as object so properties can be mutated from other modules.
 */

// Create state object with property tracking for debugging
const _state = {
  // Socket connection
  socket: null,

  // Game state
  currentGamePath: null,
  currentGameName: null,
  currentGameTextElement: null,
  currentStatusLineElement: null,

  // Voice recognition state
  recognition: null,
  isListening: false,
  listeningEnabled: false,
  isRecognitionActive: false,
  isMuted: true,  // Start with microphone muted by default
  hasProcessedResult: false,
  hasManualTyping: false,

  // Narration state
  currentAudio: null,
  narrationEnabled: false,
  _autoplayEnabled: false,
  isNarrating: false,
  pendingNarrationText: null,
  narrationChunks: [],
  chunksValid: false,
  currentChunkIndex: 0,
  isPaused: false,
  narrationSessionId: 0,
  currentChunkStartTime: 0,

  // Talk mode state
  talkModeActive: false,
  ttsIsSpeaking: false,
  appVoicePromise: null,

  // Audio analysis
  audioContext: null,
  analyser: null,
  microphone: null,
  voiceMeterInterval: null,
  soundDetected: false,
  pausedForSound: false,
  soundPauseTimeout: null,

  // Push-to-talk
  wasMutedBeforePTT: false,
  isPushToTalkActive: false,

  // Navigation
  isNavigating: false,
  isUserScrubbing: false,

  // History & transcripts
  voiceHistoryItems: [],
  commandHistoryItems: [],
  recentlySpokenChunks: [],
  confirmedTranscriptTimeout: null,
  lastHeardClearTimeout: null,
  transcriptResetTimeout: null,
  pendingCommandProcessed: false,

  // Voice config
  browserVoiceConfig: null
};

// Add getter/setter for autoplayEnabled with logging
Object.defineProperty(_state, 'autoplayEnabled', {
  get() {
    return this._autoplayEnabled;
  },
  set(value) {
    if (this._autoplayEnabled !== value) {
      console.log('[State] autoplayEnabled changed:', this._autoplayEnabled, '->', value);
      console.trace('[State] Stack trace:');
    }
    this._autoplayEnabled = value;
  },
  enumerable: true,
  configurable: true
});

export const state = _state;

export const constants = {
  SOUND_THRESHOLD: 60,
  SILENCE_DELAY: 800,
  ECHO_CHUNK_RETENTION_MS: 5000,
  ECHO_SIMILARITY_THRESHOLD: 0.5,
  VOICE_CONFIDENCE_THRESHOLD: 0.5
};

/**
 * Reset narration state for new content
 */
export function resetNarrationState() {
  state.narrationChunks = [];
  state.chunksValid = false;
  state.currentChunkIndex = 0;
  state.isNarrating = false;
  state.isPaused = false;
  state.currentChunkStartTime = 0;
}

/**
 * Reset voice history
 */
export function resetVoiceHistory() {
  state.voiceHistoryItems = [];
}

/**
 * Reset command history
 */
export function resetCommandHistory() {
  state.commandHistoryItems = [];
}
