/**
 * Keep Awake Module
 *
 * Prevents the device from sleeping during gameplay by playing silent audio.
 * Works like podcast/music apps - maintains an audio session to prevent idle timeout.
 * More reliable than Wake Lock API, especially on iOS.
 */

let audioContext = null;
let silentSource = null;
let enabled = false;

/**
 * Create and start silent audio loop
 */
function startSilentAudio() {
  if (audioContext) return; // Already running

  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // Create a silent oscillator (inaudible frequency)
    silentSource = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    // Set volume to near-zero (completely silent)
    gainNode.gain.value = 0.001;

    // Use very low frequency (below human hearing)
    silentSource.frequency.value = 1;

    silentSource.connect(gainNode);
    gainNode.connect(audioContext.destination);

    silentSource.start();
    console.log('[KeepAwake] Silent audio started');

  } catch (err) {
    console.warn('[KeepAwake] Failed to start silent audio:', err.message);
  }
}

/**
 * Stop silent audio
 */
function stopSilentAudio() {
  if (silentSource) {
    try {
      silentSource.stop();
      silentSource.disconnect();
    } catch (e) {
      // Already stopped
    }
    silentSource = null;
  }

  if (audioContext) {
    try {
      audioContext.close();
    } catch (e) {
      // Already closed
    }
    audioContext = null;
  }

  console.log('[KeepAwake] Silent audio stopped');
}

/**
 * Enable keep awake (persists setting)
 */
export function enableKeepAwake() {
  enabled = true;
  localStorage.setItem('iftalk_keep_awake', 'true');
  startSilentAudio();
}

/**
 * Disable keep awake (persists setting)
 */
export function disableKeepAwake() {
  enabled = false;
  localStorage.setItem('iftalk_keep_awake', 'false');
  stopSilentAudio();
}

/**
 * Toggle keep awake
 * @returns {boolean} New state
 */
export function toggleKeepAwake() {
  if (enabled) {
    disableKeepAwake();
  } else {
    enableKeepAwake();
  }
  return enabled;
}

/**
 * Check if keep awake is currently enabled
 * @returns {boolean}
 */
export function isKeepAwakeEnabled() {
  return enabled;
}

/**
 * Initialize keep awake from saved preference
 * Note: Audio can only start after user interaction (browser policy)
 */
export function initKeepAwake() {
  const saved = localStorage.getItem('iftalk_keep_awake');
  enabled = saved === 'true';

  // Handle visibility change - resume audio when page becomes visible
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && enabled) {
      // Resume audio context if it was suspended
      if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
      }
    }
  });

  return enabled;
}

/**
 * Start keep awake if enabled (call after user interaction)
 * Browser policy requires user gesture before playing audio
 */
export function activateIfEnabled() {
  if (enabled && !audioContext) {
    startSilentAudio();
  }
}
