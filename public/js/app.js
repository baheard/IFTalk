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
import { initSaveHandlers, quickSave, quickLoad } from './game/save-manager.js';
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
  status: () => {
    // Read status bar content
    const statusText = dom.statusBar?.textContent?.trim();
    if (statusText) {
      speakAppMessage(statusText);
      updateStatus('Reading status');
    } else {
      speakAppMessage('No status presently shown');
      updateStatus('No status to read');
    }
  },
  quickSave: () => {
    quickSave();
  },
  quickLoad: () => {
    quickLoad();
  },
  unmute: () => {
    state.isMuted = false;
    state.listeningEnabled = true;
    const icon = dom.muteBtn?.querySelector('.material-icons');
    if (icon) icon.textContent = 'mic';
    if (dom.muteBtn) dom.muteBtn.classList.remove('muted');
    startVoiceMeter();
    updateStatus('Microphone unmuted - Listening...');
    updateNavButtons();

    // Start voice recognition
    if (state.recognition && !state.isRecognitionActive) {
      try {
        state.recognition.start();
      } catch (err) {
        console.error('[Voice] Failed to start recognition:', err);
      }
    }
  },
  mute: () => {
    state.isMuted = true;
    state.listeningEnabled = false;
    const icon = dom.muteBtn?.querySelector('.material-icons');
    if (icon) icon.textContent = 'mic_off';
    if (dom.muteBtn) {
      dom.muteBtn.classList.add('muted');
      dom.muteBtn.classList.remove('listening');
      dom.muteBtn.style.setProperty('--mic-intensity', '0');
    }
    stopVoiceMeter();
    updateStatus('Microphone muted');
    updateNavButtons();

    // Stop voice recognition
    if (state.recognition && state.isRecognitionActive) {
      try {
        state.recognition.stop();
      } catch (err) {
        console.error('[Voice] Failed to stop recognition:', err);
      }
    }
  },
  sendCommandDirect: (cmd) => sendCommandDirect(cmd)
};

// Handle game output from GlkOte
function handleGameOutput(text) {

  // Store for potential narration
  // Note: Don't stop narration here - speakTextChunked() handles stopping the old session
  // properly with a 50ms delay to let the old loop exit cleanly
  state.pendingNarrationText = text;

  console.log('[HandleGameOutput] Received new game output, currentChunkIndex:', state.currentChunkIndex, 'restoredChunkIndex:', state.restoredChunkIndex);

  // STRICT CHECK: Auto-start narration ONLY if autoplay is explicitly enabled
  if (state.autoplayEnabled === true) {
    // Check if we have a restored chunk index from autoload
    const startIndex = state.restoredChunkIndex !== null ? state.restoredChunkIndex : 0;
    console.log('[HandleGameOutput] Autoplay enabled, starting narration from chunk', startIndex, '(restored:', state.restoredChunkIndex !== null, ')');

    // Clear the restored index so it's only used once
    state.restoredChunkIndex = null;

    // Enable narration and start playing
    state.narrationEnabled = true;
    state.isPaused = false;

    // Start narration (chunks will be created on-demand)
    speakTextChunked(null, startIndex);
  } else {
    console.log('[HandleGameOutput] Autoplay not enabled, NOT starting narration');
  }
}

// Initialize app
async function initApp() {
  // Fix mobile viewport height for browser chrome
  function setMobileViewportHeight() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  }

  setMobileViewportHeight();
  window.addEventListener('resize', setMobileViewportHeight);
  window.addEventListener('orientationchange', setMobileViewportHeight);

  // Initialize DOM
  initDOM();

  // Add debug event listener for chunk highlighting
  window.addEventListener('chunkHighlighted', async (e) => {
    const { chunkIndex, chunkText, totalChunks, success } = e.detail;

    // Query DOM for markers to verify they exist
    const statusEl = window.currentStatusBarElement || document.getElementById('statusBar');
    const mainEl = state.currentGameTextElement;
    const upperEl = document.getElementById('upperWindow');

    const startMarkers = [];
    const endMarkers = [];

    if (statusEl) {
      startMarkers.push(...statusEl.querySelectorAll(`.chunk-marker-start[data-chunk="${chunkIndex}"]`));
      endMarkers.push(...statusEl.querySelectorAll(`.chunk-marker-end[data-chunk="${chunkIndex}"]`));
    }
    if (upperEl) {
      startMarkers.push(...upperEl.querySelectorAll(`.chunk-marker-start[data-chunk="${chunkIndex}"]`));
      endMarkers.push(...upperEl.querySelectorAll(`.chunk-marker-end[data-chunk="${chunkIndex}"]`));
    }
    if (mainEl) {
      startMarkers.push(...mainEl.querySelectorAll(`.chunk-marker-start[data-chunk="${chunkIndex}"]`));
      endMarkers.push(...mainEl.querySelectorAll(`.chunk-marker-end[data-chunk="${chunkIndex}"]`));
    }


    // Check CSS Highlights API
    if (CSS.highlights) {
      const highlight = CSS.highlights.get('speaking');
      if (highlight) {
      } else {
        console.warn(`[CHUNK EVENT] No CSS highlight found!`);
      }
    }
  });

  // Load voice configuration
  await loadBrowserVoiceConfig();

  // Initialize voice recognition with command processor
  const processVoice = (transcript) => processVoiceKeywords(transcript, voiceCommandHandlers);
  state.recognition = initVoiceRecognition(processVoice);

  // Make sendCommand available globally for recognition module
  window._sendCommand = () => {
    const cmd = dom.userInput ? dom.userInput.value.trim() : '';
    if (cmd) {
      sendCommandDirect(cmd, true); // true = isVoiceCommand
      if (dom.userInput) dom.userInput.value = '';
    }
  };

  // Initialize UI components
  initSettings();
  initVoiceSelection();
  initHistoryButtons();
  initSaveHandlers();

  // Initialize mute button state to match default (muted)
  if (dom.muteBtn) {
    const icon = dom.muteBtn.querySelector('.material-icons');
    if (icon) icon.textContent = 'mic_off';
    dom.muteBtn.classList.add('muted');
  }

  // Initialize game selection with output callback
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
    pausePlayBtn.addEventListener('click', async () => {
      console.log('[Play Button] Clicked. State:', {
        autoplayEnabled: state.autoplayEnabled,
        isNarrating: state.isNarrating,
        narrationEnabled: state.narrationEnabled,
        chunksLength: state.narrationChunks.length,
        currentChunkIndex: state.currentChunkIndex
      });

      if (state.autoplayEnabled) {
        // Currently in AUTOPLAY mode - switch to MANUAL mode
        state.autoplayEnabled = false;
        state.narrationEnabled = false;
        state.isPaused = true;
        stopNarration(true);  // Preserve highlight when pausing
        updateStatus('Autoplay off');
        updateNavButtons();
      } else {
        // Currently in MANUAL mode - switch to AUTOPLAY mode
        state.autoplayEnabled = true;
        state.narrationEnabled = true;
        state.isPaused = false;

        // Start playing from current position
        if (state.narrationChunks.length > 0) {
          // If at the end, restart from beginning
          if (state.currentChunkIndex >= state.narrationChunks.length) {
            state.currentChunkIndex = 0;
          }
          console.log('[Play Button] Starting narration from current chunk:', state.currentChunkIndex);
          speakTextChunked(null, state.currentChunkIndex);
        } else {
          // Try to create chunks if we have content
          const { ensureChunksReady } = await import('./ui/game-output.js');
          if (ensureChunksReady()) {
            // Check if we have a restored chunk index
            const startIndex = state.restoredChunkIndex !== null ? state.restoredChunkIndex : 0;
            console.log('[Play Button] Creating chunks and starting from index:', startIndex, '(restored:', state.restoredChunkIndex !== null, ')');
            state.restoredChunkIndex = null; // Clear after use
            speakTextChunked(null, startIndex);
          } else {
            console.error('[Play/Pause] Failed to create chunks - no content available');
            updateStatus('No text to narrate');
          }
        }

        updateStatus('Autoplay on');
        updateNavButtons();
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

  // Talk Mode button - REMOVED
  // Talk mode functionality integrated into play button
  // const talkModeBtn = document.getElementById('talkModeBtn');
  // if (talkModeBtn) { ... }

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


  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl key - push to talk
    if (e.key === 'Control' && !state.isPushToTalkActive) {
      state.isPushToTalkActive = true;
      state.wasMutedBeforePTT = state.isMuted;
      if (state.isMuted) {
        voiceCommandHandlers.unmute();
      }
    }

    // Arrow keys - navigation
    if (e.key === 'ArrowLeft') {
      skipToChunk(-1, () => speakTextChunked(null, state.currentChunkIndex));
    } else if (e.key === 'ArrowRight') {
      skipToChunk(1, () => speakTextChunked(null, state.currentChunkIndex));
    }

    // Escape - exit autoplay mode
    if (e.key === 'Escape' && state.autoplayEnabled) {
      state.autoplayEnabled = false;
      state.narrationEnabled = false;
      state.isPaused = true;
      stopNarration(true);
      updateStatus('Autoplay off');
      updateNavButtons();
    }
  });

  document.addEventListener('keyup', (e) => {
    // Ctrl key released - end push to talk
    if (e.key === 'Control' && state.isPushToTalkActive) {
      state.isPushToTalkActive = false;
      if (state.wasMutedBeforePTT) {
        voiceCommandHandlers.mute();
      }
    }
  });

  // Stop narration immediately when navigating away from page
  window.addEventListener('beforeunload', () => {
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
  });

  // Also handle page hide (for iOS and some mobile browsers)
  window.addEventListener('pagehide', () => {
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
  });

  // Smart scroll on window resize to keep content visible
  window.addEventListener('resize', () => {
    if (state.currentGameTextElement) {
      // Use the same smart scroll logic as addGameText
      const walker = document.createTreeWalker(
        state.currentGameTextElement,
        NodeFilter.SHOW_ELEMENT,
        {
          acceptNode: (node) => {
            if (node.classList?.contains('blank-line-spacer')) {
              return NodeFilter.FILTER_SKIP;
            }
            const text = node.textContent?.trim();
            if (text && text.length > 0) {
              return NodeFilter.FILTER_ACCEPT;
            }
            return NodeFilter.FILTER_SKIP;
          }
        }
      );

      const firstTextElement = walker.nextNode();
      const scrollTarget = firstTextElement || state.currentGameTextElement;
      scrollTarget.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
  });

}

// Initialize when DOM is ready
async function startApp() {
  try {
    await initApp();
  } catch (error) {
    console.error('[App] Initialization error:', error);
    console.error('[App] Stack:', error.stack);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}
