/**
 * IFTalk - Voice-Powered Interactive Fiction
 * Main Application Entry Point
 *
 * This file wires together all modules and initializes the app.
 * Uses browser-based ZVM + GlkOte instead of server-side Frotz.
 */

// Core modules
import { state } from './core/state.js';
import { dom, initDOM } from './core/dom.js';
import { updateStatus } from './utils/status.js';

// Voice modules
import { initVoiceRecognition, showConfirmedTranscript } from './voice/recognition.js';
import { processVoiceKeywords } from './voice/voice-commands.js';
import { startVoiceMeter, stopVoiceMeter } from './voice/voice-meter.js';

// Narration modules
import { speakTextChunked, stopNarration, speakAppMessage } from './narration/tts-player.js';
import { skipToChunk, skipToStart, skipToEnd } from './narration/navigation.js';

// UI modules
import { updateNavButtons } from './ui/nav-buttons.js';
import { addGameText } from './ui/game-output.js';
import { initSettings, loadBrowserVoiceConfig, initVoiceSelection } from './ui/settings.js';
import { initHistoryButtons } from './ui/history.js';

// Game modules
import { sendCommand, sendCommandDirect } from './game/commands.js';
import { initSaveHandlers, restoreLatest, restoreFromSlot } from './game/saves.js';
import { initGameSelection } from './game/game-loader.js';

// Voice command handlers
const voiceCommandHandlers = {
  restart: () => skipToStart(() => speakTextChunked(null, state.currentChunkIndex)),
  back: () => skipToChunk(-1, () => speakTextChunked(null, state.currentChunkIndex)),
  pause: () => {
    if (state.isNarrating) {
      state.narrationEnabled = false;
      state.isPaused = true;
      stopNarration();
      updateStatus('Narration paused');
      updateNavButtons();
    }
  },
  play: () => {
    if (!state.narrationEnabled && (state.isPaused || state.narrationChunks.length > 0)) {
      state.narrationEnabled = true;
      state.isPaused = false;
      state.pendingNarrationText = null;
      speakTextChunked(null, state.currentChunkIndex);
    }
  },
  skip: () => skipToChunk(1, () => speakTextChunked(null, state.currentChunkIndex)),
  skipToEnd: () => skipToEnd(),
  unmute: () => {
    state.isMuted = false;
    const icon = dom.muteBtn?.querySelector('.material-icons');
    if (icon) icon.textContent = 'mic';
    if (dom.muteBtn) dom.muteBtn.classList.remove('muted');
    if (dom.voicePanel) dom.voicePanel.classList.remove('muted');
    if (dom.voiceFeedback) dom.voiceFeedback.classList.remove('hidden');
    if (dom.voiceTranscript) dom.voiceTranscript.textContent = 'Listening...';
    startVoiceMeter();
    updateStatus('Microphone unmuted');
    updateNavButtons();
  },
  mute: () => {
    state.isMuted = true;
    const icon = dom.muteBtn?.querySelector('.material-icons');
    if (icon) icon.textContent = 'mic_off';
    if (dom.muteBtn) dom.muteBtn.classList.add('muted');
    if (dom.voicePanel) dom.voicePanel.classList.add('muted');
    if (dom.voiceFeedback) dom.voiceFeedback.classList.add('hidden');
    if (dom.voiceTranscript) dom.voiceTranscript.textContent = 'Muted';
    stopVoiceMeter();
    updateStatus('Microphone muted');
    updateNavButtons();
  },
  sendCommandDirect: (cmd) => sendCommandDirect(cmd),
  restoreLatest: () => restoreLatest(),
  restoreSlot: (slot) => restoreFromSlot(slot)
};

// Handle game output from GlkOte
function handleGameOutput(text) {
  console.log('[App] Game output received:', text.substring(0, 100) + '...');

  // Store for potential narration
  state.pendingNarrationText = text;

  // Auto-narrate if autoplay is enabled and talk mode is active
  if (state.autoplayEnabled && state.talkModeActive && !state.isNarrating) {
    speakTextChunked(text);
  }
}

// Initialize app
async function initApp() {
  console.log('[App] Initializing IFTalk...');

  // Initialize DOM
  console.log('[App] 1. Initializing DOM...');
  initDOM();

  // Load voice configuration
  console.log('[App] 2. Loading voice config...');
  await loadBrowserVoiceConfig();
  console.log('[App] 3. Voice config loaded');

  // Initialize voice recognition with command processor
  console.log('[App] 4. Initializing voice recognition...');
  const processVoice = (transcript) => processVoiceKeywords(transcript, voiceCommandHandlers);
  state.recognition = initVoiceRecognition(processVoice);

  // Make sendCommand available globally for recognition module
  console.log('[App] 5. Setting up global command handler...');
  window._sendCommand = () => sendCommand();

  // Initialize UI components
  console.log('[App] 6. Initializing UI components...');
  initSettings();
  initVoiceSelection();
  initHistoryButtons();
  initSaveHandlers();

  // Initialize game selection with output callback
  console.log('[App] 7. Initializing game selection...');
  initGameSelection(handleGameOutput);

  // Navigation button handlers
  const skipToStartBtn = document.getElementById('skipToStartBtn');
  if (skipToStartBtn) {
    skipToStartBtn.addEventListener('click', () =>
      skipToStart(() => speakTextChunked(null, state.currentChunkIndex))
    );
  }

  const prevChunkBtn = document.getElementById('prevChunkBtn');
  if (prevChunkBtn) {
    prevChunkBtn.addEventListener('click', () =>
      skipToChunk(-1, () => speakTextChunked(null, state.currentChunkIndex))
    );
  }

  const pausePlayBtn = document.getElementById('pausePlayBtn');
  if (pausePlayBtn) {
    pausePlayBtn.addEventListener('click', () => {
      if (state.isNarrating && state.narrationEnabled) {
        // Pause
        state.narrationEnabled = false;
        state.isPaused = true;
        stopNarration();
        updateStatus('Narration paused');
        updateNavButtons();
      } else if (state.narrationChunks.length > 0) {
        // Play/Resume
        state.narrationEnabled = true;
        state.isPaused = false;
        speakTextChunked(null, state.currentChunkIndex);
      }
    });
  }

  const nextChunkBtn = document.getElementById('nextChunkBtn');
  if (nextChunkBtn) {
    nextChunkBtn.addEventListener('click', () =>
      skipToChunk(1, () => speakTextChunked(null, state.currentChunkIndex))
    );
  }

  const skipToEndBtn = document.getElementById('skipToEndBtn');
  if (skipToEndBtn) {
    skipToEndBtn.addEventListener('click', () => skipToEnd());
  }

  // Autoplay button
  const autoplayBtn = document.getElementById('autoplayBtn');
  if (autoplayBtn) {
    autoplayBtn.addEventListener('click', () => {
      state.autoplayEnabled = !state.autoplayEnabled;
      autoplayBtn.classList.toggle('active', state.autoplayEnabled);
      updateStatus(state.autoplayEnabled ? 'Autoplay enabled' : 'Autoplay disabled');
    });
  }

  // Mute button
  if (dom.muteBtn) {
    dom.muteBtn.addEventListener('click', () => {
      if (state.isMuted) {
        voiceCommandHandlers.unmute();
      } else {
        voiceCommandHandlers.mute();
      }
    });
  }

  // Send button
  if (dom.sendBtn) {
    dom.sendBtn.addEventListener('click', () => sendCommand());
  }

  // Enter key
  if (dom.userInput) {
    dom.userInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendCommand();
      } else {
        // Any other key = manual typing
        state.hasManualTyping = true;
      }
    });
  }

  // Click on game output focuses input (but not when selecting text)
  const gameOutput = document.querySelector('.game-output');
  if (gameOutput) {
    gameOutput.addEventListener('click', (e) => {
      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) {
        return;
      }

      const gameText = e.target.closest('.game-text');
      if (gameText && dom.userInput) {
        dom.userInput.focus();
      }
    });
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Alt key - push to talk
    if (e.key === 'Alt' && !state.isPushToTalkActive) {
      state.isPushToTalkActive = true;
      state.wasMutedBeforePTT = state.isMuted;
      if (state.isMuted) {
        voiceCommandHandlers.unmute();
      }
    }

    // M key - toggle mute
    if (e.key === 'm' || e.key === 'M') {
      if (state.isMuted) {
        voiceCommandHandlers.unmute();
      } else {
        voiceCommandHandlers.mute();
      }
    }

    // Arrow keys - navigation
    if (e.key === 'ArrowLeft') {
      skipToChunk(-1, () => speakTextChunked(null, state.currentChunkIndex));
    } else if (e.key === 'ArrowRight') {
      skipToChunk(1, () => speakTextChunked(null, state.currentChunkIndex));
    }

    // Escape - stop talk mode
    if (e.key === 'Escape') {
      stopTalkMode();
    }
  });

  document.addEventListener('keyup', (e) => {
    // Alt key released - end push to talk
    if (e.key === 'Alt' && state.isPushToTalkActive) {
      state.isPushToTalkActive = false;
      if (state.wasMutedBeforePTT) {
        voiceCommandHandlers.mute();
      }
    }
  });

  console.log('[App] Initialization complete');
}

// Start talk mode (voice recognition + auto-narration)
window.startTalkMode = function() {
  if (state.talkModeActive) return;

  console.log('[Talk Mode] Starting...');
  state.talkModeActive = true;
  state.listeningEnabled = true;
  state.narrationEnabled = true;
  state.autoplayEnabled = true;

  // Show voice panel
  if (dom.voicePanel) dom.voicePanel.classList.remove('hidden');

  // Start voice meter
  startVoiceMeter();

  // Start recognition
  if (state.recognition && !state.isRecognitionActive) {
    try {
      state.recognition.start();
    } catch (err) {
      console.error('[Talk Mode] Failed to start recognition:', err);
    }
  }

  // Auto-play initial text
  if (state.narrationChunks.length > 0 && state.autoplayEnabled) {
    speakTextChunked(null, 0);
  }

  updateStatus('Talk mode active');
  console.log('[Talk Mode] Started');
};

// Stop talk mode
function stopTalkMode() {
  if (!state.talkModeActive) return;

  console.log('[Talk Mode] Stopping...');
  state.talkModeActive = false;
  state.listeningEnabled = false;

  // Stop recognition
  if (state.recognition) {
    try {
      state.recognition.stop();
    } catch (err) {
      // Ignore
    }
  }

  // Stop voice meter
  stopVoiceMeter();

  // Stop narration
  stopNarration();

  updateStatus('Talk mode stopped');
  console.log('[Talk Mode] Stopped');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
