/**
 * Centralized Application State
 *
 * Single source of truth for all application state.
 * Export as object so properties can be mutated from other modules.
 */

export const state = {
  // Socket connection
  socket: null,

  // Game state
  currentGamePath: null,
  currentGameName: null,
  currentGameTextElement: null,

  // Voice recognition state
  recognition: null,
  isListening: false,
  listeningEnabled: false,
  isRecognitionActive: false,
  isMuted: false,
  hasProcessedResult: false,
  hasManualTyping: false,

  // Narration state
  currentAudio: null,
  narrationEnabled: false,
  autoplayEnabled: true,
  isNarrating: false,
  pendingNarrationText: null,
  narrationChunks: [],
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
  state.currentChunkIndex = 0;
  state.narrationSessionId++;
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
