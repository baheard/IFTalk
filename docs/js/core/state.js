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
  pushToTalkMode: false,  // When true, mic only activates while button is held (for car Bluetooth)

  // Narration state
  currentAudio: null,
  narrationEnabled: false,
  _autoplayEnabled: false,  // When true, new content auto-plays and nav buttons auto-start
  isNarrating: false,
  pendingNarrationText: null,
  narrationChunks: [],
  chunksValid: false,
  currentChunkIndex: 0,
  isPaused: false,
  narrationSessionId: 0,
  currentChunkStartTime: 0,
  lastStatusBarText: null,  // Track previous status bar text to avoid re-reading
  restoredChunkIndex: null,  // Chunk index restored from autosave (used once after autoload)
  skipNarrationAfterLoad: false,  // When true, position at end of chunks after load (don't read transcript)

  // TTS state
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
  browserVoiceConfig: null,

  // Lock screen state
  isScreenLocked: false,

  // Google Drive sync state
  gdriveSignedIn: false,
  gdriveEmail: null,
  gdriveSyncEnabled: false,
  gdriveSyncPending: false,
  gdriveLastSyncTime: null,
  gdriveError: null,

  // Device tracking
  deviceId: null,
  deviceInfo: null,
  deviceChangeDetected: false,
  lastDeviceId: null
};

// Add getter/setter for autoplayEnabled with logging and persistence
Object.defineProperty(_state, 'autoplayEnabled', {
  get() {
    return this._autoplayEnabled;
  },
  set(value) {
    if (this._autoplayEnabled !== value) {
      console.log(`[State] autoplayEnabled changed: ${this._autoplayEnabled} → ${value}`);

      // Save to global settings (skip during initial load to prevent double-save)
      if (!this._loadingAutoplay) {
        try {
          localStorage.setItem('iftalk_autoplayEnabled', value.toString());
        } catch (err) {
          console.warn('[State] Failed to save autoplayEnabled (private browsing?):', err);
        }
      }
    }
    this._autoplayEnabled = value;
  },
  enumerable: true,
  configurable: true
});

export const state = _state;

// Expose state to window for debugging
if (typeof window !== 'undefined') {
  window.state = state;
}

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
