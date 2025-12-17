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
    startVoiceMeter();
    updateStatus('Microphone unmuted');
    updateNavButtons();
  },
  mute: () => {
    state.isMuted = true;
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
  },
  sendCommandDirect: (cmd) => sendCommandDirect(cmd),
  restoreLatest: () => restoreLatest(),
  restoreSlot: (slot) => restoreFromSlot(slot)
};

// Handle game output from GlkOte
function handleGameOutput(text) {
  console.log('[HandleGameOutput] New game output received');
  console.log('[HandleGameOutput] State check - autoplayEnabled:', state.autoplayEnabled, 'narrationEnabled:', state.narrationEnabled, 'isNarrating:', state.isNarrating);

  // Store for potential narration
  // Note: Don't stop narration here - speakTextChunked() handles stopping the old session
  // properly with a 50ms delay to let the old loop exit cleanly
  state.pendingNarrationText = text;

  // STRICT CHECK: Auto-start narration ONLY if autoplay is explicitly enabled
  if (state.autoplayEnabled === true) {
    console.log('[HandleGameOutput] ✓ Autoplay is TRUE, starting narration');
    // Enable narration and start playing
    state.narrationEnabled = true;
    state.isPaused = false;

    // Start narration (chunks will be created on-demand)
    speakTextChunked(null, 0);
  } else {
    console.log('[HandleGameOutput] ✗ Autoplay is FALSE or undefined, NOT starting narration');
  }
}

// Initialize app
async function initApp() {
  // Initialize DOM
  initDOM();

  // Add debug event listener for chunk highlighting
  window.addEventListener('chunkHighlighted', async (e) => {
    const { chunkIndex, chunkText, totalChunks, success } = e.detail;
    console.log(`[CHUNK EVENT] Chunk ${chunkIndex}/${totalChunks - 1} highlighted (success: ${success})`);
    console.log(`[CHUNK EVENT] Text: "${chunkText}"`);

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

    console.log(`[CHUNK EVENT] Found ${startMarkers.length} start markers, ${endMarkers.length} end markers`);

    // Check CSS Highlights API
    if (CSS.highlights) {
      const highlight = CSS.highlights.get('speaking');
      if (highlight) {
        console.log(`[CHUNK EVENT] CSS Highlight active with ${highlight.size} ranges`);
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
  window._sendCommand = () => sendCommand();

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

  // Initialize game selection with output callback and talk mode starter
  initGameSelection(handleGameOutput, window.startTalkMode);

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
        isNarrating: state.isNarrating,
        narrationEnabled: state.narrationEnabled,
        isPaused: state.isPaused,
        chunksLength: state.narrationChunks.length,
        currentChunkIndex: state.currentChunkIndex,
        chunksValid: state.chunksValid
      });

      if (state.isNarrating && state.narrationEnabled) {
        // Pause
        console.log('[Play Button] Pausing narration');
        state.narrationEnabled = false;
        state.isPaused = true;
        stopNarration(true);  // Preserve highlight when pausing
        updateStatus('Narration paused');
        updateNavButtons();
      } else if (state.narrationChunks.length > 0) {
        // Play/Resume
        // If at the end, replay the last chunk
        if (state.currentChunkIndex >= state.narrationChunks.length) {
          console.log('[Play Button] At end, replaying last chunk');
          state.currentChunkIndex = state.narrationChunks.length - 1;
        }
        console.log('[Play Button] Starting/Resuming narration from chunk', state.currentChunkIndex);
        state.narrationEnabled = true;
        state.isPaused = false;
        speakTextChunked(null, state.currentChunkIndex);
      } else {
        console.warn('[Play Button] Cannot play - no chunks available. Attempting to create chunks...');
        // Try to create chunks if we have content
        const { ensureChunksReady } = await import('./ui/game-output.js');
        if (ensureChunksReady()) {
          console.log('[Play Button] Chunks created successfully, starting narration');
          state.narrationEnabled = true;
          state.isPaused = false;
          speakTextChunked(null, 0);
        } else {
          console.error('[Play Button] Failed to create chunks - no content available');
          updateStatus('No text to narrate');
        }
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

  // Talk Mode button (toggles auto-narration + voice input)
  const talkModeBtn = document.getElementById('talkModeBtn');
  if (talkModeBtn) {
    talkModeBtn.addEventListener('click', () => {
      state.talkModeActive = !state.talkModeActive;

      if (state.talkModeActive) {
        // Turn ON talk mode: enable autoplay + unmute mic + enable narration
        state.autoplayEnabled = true;
        state.narrationEnabled = true;
        state.listeningEnabled = true;
        state.isMuted = false; // Unmute mic by default

        // Update mute button UI
        if (dom.muteBtn) {
          dom.muteBtn.classList.remove('active');
          const icon = dom.muteBtn.querySelector('.material-icons');
          if (icon) icon.textContent = 'mic';
        }

        updateStatus('Talk mode enabled');
        console.log('[Talk Mode] ON - autoplay + mic enabled');
      } else {
        // Turn OFF talk mode: disable autoplay (keep narration available for manual play)
        state.autoplayEnabled = false;
        state.listeningEnabled = false;

        updateStatus('Talk mode disabled');
        console.log('[Talk Mode] OFF - autoplay disabled');
      }

      talkModeBtn.classList.toggle('active', state.talkModeActive);
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

// Start talk mode (voice recognition + auto-narration)
window.startTalkMode = function() {
  console.log('[StartTalkMode] Called. talkModeActive:', state.talkModeActive);
  if (state.talkModeActive) return;

  state.talkModeActive = true;
  state.listeningEnabled = true;
  state.narrationEnabled = true;
  // autoplayEnabled stays at default (false) - user can enable if desired

  // Update autoplay button UI to reflect forced-on state
  const autoplayBtn = document.getElementById('autoplayBtn');
  if (autoplayBtn) {
    autoplayBtn.classList.add('active');
    console.log('[StartTalkMode] Autoplay button UI updated to active');
  }

  // Start voice meter if not muted
  if (!state.isMuted) {
    startVoiceMeter();
  }

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
};

// Stop talk mode
function stopTalkMode() {
  if (!state.talkModeActive) return;

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
