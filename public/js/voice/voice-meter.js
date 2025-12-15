/**
 * Voice Meter Module
 *
 * Audio visualization and sound detection for voice input.
 * Monitors microphone levels and auto-pauses narration when user speaks.
 */

import { state, constants } from '../core/state.js';
import { dom } from '../core/dom.js';

/**
 * Start voice meter (audio visualization and sound detection)
 */
export async function startVoiceMeter() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    state.analyser = state.audioContext.createAnalyser();
    state.microphone = state.audioContext.createMediaStreamSource(stream);

    state.analyser.fftSize = 256;
    state.microphone.connect(state.analyser);

    const bufferLength = state.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // Update meter and detect sound for pause/resume
    state.voiceMeterInterval = setInterval(() => {
      state.analyser.getByteFrequencyData(dataArray);

      // Calculate average volume
      const average = dataArray.reduce((a, b) => a + b) / bufferLength;
      const percentage = Math.min(100, (average / 128) * 100);

      // Update mute button indicator (bright green if > 20%, normal green otherwise)
      // But NOT when muted - keep muted state
      if (!state.isMuted && dom.muteBtn) {
        if (percentage > 20) {
          dom.muteBtn.classList.add('active');
          if (dom.voiceTranscript) {
            dom.voiceTranscript.textContent = 'Speaking... (say "Pause" to stop)';
          }
        } else {
          dom.muteBtn.classList.remove('active');
          if (dom.voiceTranscript) {
            dom.voiceTranscript.textContent = 'Listening...';
          }
        }
      }

      // Sound detection for auto-pause narration
      if (percentage > constants.SOUND_THRESHOLD) {
        // Sound detected above threshold
        if (!state.soundDetected) {
          state.soundDetected = true;
          console.log('[Sound] Detected above threshold:', percentage.toFixed(1) + '%');

          // Pause narration if it's playing
          if (state.isNarrating && !state.pausedForSound && !state.isMuted) {
            state.pausedForSound = true;
            state.pendingCommandProcessed = false;
            if ('speechSynthesis' in window) {
              speechSynthesis.pause();
            }
            console.log('[Sound] Paused narration for voice input');
          }
        }

        // Clear any pending resume timeout
        if (state.soundPauseTimeout) {
          clearTimeout(state.soundPauseTimeout);
          state.soundPauseTimeout = null;
        }
      } else {
        // Sound below threshold (silence)
        if (state.soundDetected) {
          state.soundDetected = false;

          // Start timeout to resume narration after silence
          if (state.pausedForSound && !state.soundPauseTimeout) {
            state.soundPauseTimeout = setTimeout(() => {
              state.soundPauseTimeout = null;

              // Always resume after silence, unless explicitly paused
              state.pausedForSound = false;
              state.pendingCommandProcessed = false;
              if (state.narrationEnabled && !state.isPaused) {
                if ('speechSynthesis' in window) {
                  speechSynthesis.resume();
                }
                console.log('[Sound] Resumed narration after silence');
              } else if (state.isPaused) {
                console.log('[Sound] Not resuming - explicitly paused');
              }
            }, constants.SILENCE_DELAY);
          }
        }
      }
    }, 50);

    console.log('[Voice Meter] Started');
  } catch (error) {
    console.error('[Voice Meter] Error:', error);
  }
}

/**
 * Stop voice meter
 */
export function stopVoiceMeter() {
  if (state.voiceMeterInterval) {
    clearInterval(state.voiceMeterInterval);
    state.voiceMeterInterval = null;
  }

  if (state.soundPauseTimeout) {
    clearTimeout(state.soundPauseTimeout);
    state.soundPauseTimeout = null;
  }

  // Reset sound detection state
  state.soundDetected = false;
  state.pausedForSound = false;

  // Cleanup audio context
  if (state.microphone) {
    state.microphone.disconnect();
    state.microphone = null;
  }

  if (state.analyser) {
    state.analyser.disconnect();
    state.analyser = null;
  }

  if (state.audioContext && state.audioContext.state !== 'closed') {
    state.audioContext.close();
    state.audioContext = null;
  }

  console.log('[Voice Meter] Stopped');
}
