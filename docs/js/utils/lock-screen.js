/**
 * Lock Screen Module
 *
 * Prevents accidental touches on mobile devices when using IFTalk voice-controlled IF.
 * Features:
 * - Screen dimming (90% black overlay) for battery savings on OLED screens
 * - Unlock via voice command "unlock" OR 1-second hold-to-unlock button
 * - Touch event blocking when locked
 * - Voice recognition and TTS continue in background
 * - Auto-enables "keep awake" mode when locked (prevents screen sleep)
 */

import { state } from '../core/state.js';
import { updateStatus } from './status.js';
import { enableKeepAwake, disableKeepAwake } from './wake-lock.js';

// DOM elements
let lockScreenOverlay = null;
let unlockButton = null;
let unlockProgress = null;
let lockListeningIndicator = null;
let lockMutedIndicator = null;
let lockTranscript = null;

// Hold-to-unlock state
let holdTimer = null;
let holdStartTime = 0;

// Track keep awake state before locking (so we can restore it on unlock)
let wasKeepAwakeEnabledBeforeLock = false;

/**
 * Initialize lock screen module
 */
export function initLockScreen() {
  // Query DOM elements
  lockScreenOverlay = document.getElementById('lockScreenOverlay');
  unlockButton = document.getElementById('unlockButton');
  unlockProgress = document.getElementById('unlockProgress');
  lockListeningIndicator = document.getElementById('lockListeningIndicator');
  lockMutedIndicator = document.getElementById('lockMutedIndicator');
  lockTranscript = document.getElementById('lockTranscript');

  if (!lockScreenOverlay || !unlockButton || !unlockProgress) {
    return;
  }

  // Monitor fullscreen changes to detect if user exits fullscreen
  const fullscreenChangeHandler = () => {
    const isFullscreen = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );

    if (state.isScreenLocked && !isFullscreen) {
      // Screen is locked but fullscreen was exited - show warning
      console.warn('[LockScreen] ⚠️ Fullscreen exited while screen locked');
      showFullscreenWarning();
    }
  };

  // Add listeners for all vendor-prefixed fullscreen change events
  document.addEventListener('fullscreenchange', fullscreenChangeHandler);
  document.addEventListener('webkitfullscreenchange', fullscreenChangeHandler);
  document.addEventListener('mozfullscreenchange', fullscreenChangeHandler);
  document.addEventListener('MSFullscreenChange', fullscreenChangeHandler);
}

/**
 * Lock the screen
 */
export function lockScreen() {
  if (state.isScreenLocked) {
    return;
  }

  state.isScreenLocked = true;

  // Enable keep awake mode (prevent screen sleep during lock)
  // Store previous state so we can restore it on unlock
  import('./wake-lock.js').then(async module => {
    wasKeepAwakeEnabledBeforeLock = module.isKeepAwakeEnabled();
    if (!wasKeepAwakeEnabledBeforeLock) {
      console.log('[LockScreen] 🔒 Enabling wake lock for locked screen');
      await module.enableKeepAwake();
    } else {
      console.log('[LockScreen] 🔒 Wake lock already enabled');
    }
  });

  // Request fullscreen to hide browser controls (mobile)
  requestFullscreen();

  // Show overlay
  if (lockScreenOverlay) {
    lockScreenOverlay.classList.remove('hidden');
  }

  // Pause non-essential animations for battery savings
  pauseNonEssentialAnimations();

  // Prevent body scroll
  document.body.style.overflow = 'hidden';

  // Show current mic status immediately
  updateLockScreenMicStatus();

  // Add touch event listeners to unlock button
  if (unlockButton) {
    unlockButton.addEventListener('touchstart', handleUnlockHoldStart, { passive: false });
    unlockButton.addEventListener('touchend', handleUnlockHoldEnd, { passive: false });
    unlockButton.addEventListener('touchcancel', handleUnlockHoldEnd, { passive: false });

    // Mouse events for desktop testing
    unlockButton.addEventListener('mousedown', handleUnlockHoldStart);
    unlockButton.addEventListener('mouseup', handleUnlockHoldEnd);
    unlockButton.addEventListener('mouseleave', handleUnlockHoldEnd);
  }

  updateStatus('Screen locked (touch disabled) - voice active');
}

/**
 * Unlock the screen
 */
export function unlockScreen() {
  if (!state.isScreenLocked) {
    return;
  }

  state.isScreenLocked = false;

  // Restore keep awake mode to previous state
  import('./wake-lock.js').then(async module => {
    if (!wasKeepAwakeEnabledBeforeLock) {
      console.log('[LockScreen] 🔓 Disabling wake lock (restoring previous state)');
      await module.disableKeepAwake();
    } else {
      console.log('[LockScreen] 🔓 Keeping wake lock enabled (was enabled before lock)');
    }
  });

  // Exit fullscreen
  exitFullscreen();

  // Hide overlay
  if (lockScreenOverlay) {
    lockScreenOverlay.classList.add('hidden');
  }

  // Clear lock screen display elements
  hideLockListeningIndicator();
  hideLockMutedIndicator();
  clearLockTranscript();

  // Resume animations
  resumeAnimations();

  // Restore body scroll
  document.body.style.overflow = '';

  // Remove event listeners
  if (unlockButton) {
    unlockButton.removeEventListener('touchstart', handleUnlockHoldStart);
    unlockButton.removeEventListener('touchend', handleUnlockHoldEnd);
    unlockButton.removeEventListener('touchcancel', handleUnlockHoldEnd);
    unlockButton.removeEventListener('mousedown', handleUnlockHoldStart);
    unlockButton.removeEventListener('mouseup', handleUnlockHoldEnd);
    unlockButton.removeEventListener('mouseleave', handleUnlockHoldEnd);
  }

  // Clear any active hold timer
  clearHoldTimer();

  updateStatus('Screen unlocked');
}

/**
 * Toggle lock screen state
 * @returns {boolean} New lock state
 */
export function toggleLockScreen() {
  if (state.isScreenLocked) {
    unlockScreen();
  } else {
    lockScreen();
  }
  return state.isScreenLocked;
}

/**
 * Check if screen is currently locked
 * @returns {boolean} True if locked
 */
export function isScreenLocked() {
  return state.isScreenLocked;
}

/**
 * Handle unlock button hold start
 * @param {TouchEvent|MouseEvent} e - Event
 */
function handleUnlockHoldStart(e) {
  if (!state.isScreenLocked) return;

  e.preventDefault(); // Prevent default touch/mouse behavior

  holdStartTime = Date.now();

  // Add visual feedback class
  if (unlockButton) {
    unlockButton.classList.add('unlocking');
  }

  // Start progress animation (2-second fill)
  if (unlockProgress) {
    // Reset height first
    unlockProgress.style.transition = 'none';
    unlockProgress.style.height = '0%';

    // Trigger animation after a frame
    requestAnimationFrame(() => {
      unlockProgress.style.transition = 'height 1s linear';
      unlockProgress.style.height = '100%';
    });
  }

  // Set timer for 1 second - unlock when complete
  holdTimer = setTimeout(() => {
    unlockScreen();
  }, 1000);
}

/**
 * Handle unlock button hold end (release before 1 second)
 * @param {TouchEvent|MouseEvent} e - Event
 */
function handleUnlockHoldEnd(e) {
  if (!state.isScreenLocked) return;

  e.preventDefault();

  const holdDuration = Date.now() - holdStartTime;

  // Clear timer and reset UI
  clearHoldTimer();

  // If held for less than 1 second, show feedback
  if (holdDuration < 1000 && holdDuration > 0) {
    updateStatus('Hold for 1 second to unlock');
  }
}

/**
 * Clear hold timer and reset visual state
 */
function clearHoldTimer() {
  // Clear timeout
  if (holdTimer) {
    clearTimeout(holdTimer);
    holdTimer = null;
  }

  // Remove visual feedback
  if (unlockButton) {
    unlockButton.classList.remove('unlocking');
  }

  // Reset progress bar with smooth transition
  if (unlockProgress) {
    unlockProgress.style.transition = 'height 0.2s ease';
    unlockProgress.style.height = '0%';
  }

  holdStartTime = 0;
}

/**
 * Pause non-essential animations for battery savings
 */
function pauseNonEssentialAnimations() {
  // Pause TTS text highlighting animations
  const highlights = document.querySelectorAll('[style*="animation"]');
  highlights.forEach(el => {
    if (el.style.animationPlayState !== 'paused') {
      el.style.animationPlayState = 'paused';
      el.dataset.wasPaused = 'false'; // Track that we paused it
    } else {
      el.dataset.wasPaused = 'true'; // Was already paused
    }
  });
}

/**
 * Resume animations after unlock
 */
function resumeAnimations() {
  // Resume TTS text highlighting animations (only ones we paused)
  const highlights = document.querySelectorAll('[style*="animation"]');
  highlights.forEach(el => {
    if (el.dataset.wasPaused === 'false') {
      el.style.animationPlayState = 'running';
    }
    delete el.dataset.wasPaused;
  });
}

/**
 * Request fullscreen mode to hide browser controls
 */
async function requestFullscreen() {
  try {
    const elem = document.documentElement;
    let fullscreenPromise = null;

    // Try standard fullscreen API
    if (elem.requestFullscreen) {
      fullscreenPromise = elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen) {
      fullscreenPromise = elem.webkitRequestFullscreen();
    } else if (elem.mozRequestFullScreen) {
      fullscreenPromise = elem.mozRequestFullScreen();
    } else if (elem.msRequestFullscreen) {
      fullscreenPromise = elem.msRequestFullscreen();
    }

    if (fullscreenPromise) {
      await fullscreenPromise;
      console.log('[LockScreen] ✅ Fullscreen activated');
      hideFullscreenWarning();
    } else {
      console.warn('[LockScreen] ⚠️ Fullscreen API not supported');
      showFullscreenWarning();
    }
  } catch (err) {
    console.warn('[LockScreen] ❌ Fullscreen request failed:', err.message);
    showFullscreenWarning();
  }
}

/**
 * Show warning that fullscreen is not active
 */
function showFullscreenWarning() {
  // Add visual warning to lock screen
  if (lockScreenOverlay) {
    let warning = lockScreenOverlay.querySelector('.fullscreen-warning');
    if (!warning) {
      warning = document.createElement('div');
      warning.className = 'fullscreen-warning';
      warning.innerHTML = `
        <div class="warning-content">
          ⚠️ Browser controls visible<br>
          <small>Be careful not to tap browser buttons</small>
        </div>
      `;
      lockScreenOverlay.insertBefore(warning, lockScreenOverlay.firstChild);
    }
    warning.classList.remove('hidden');
  }
}

/**
 * Hide fullscreen warning
 */
function hideFullscreenWarning() {
  if (lockScreenOverlay) {
    const warning = lockScreenOverlay.querySelector('.fullscreen-warning');
    if (warning) {
      warning.classList.add('hidden');
    }
  }
}

/**
 * Exit fullscreen mode
 */
function exitFullscreen() {
  try {
    if (document.exitFullscreen) {
      document.exitFullscreen()
        .then(() => {
          // Fullscreen exited
        })
        .catch(err => {
          // Exit fullscreen failed
        });
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  } catch (err) {
    // Exit fullscreen not supported
  }
}

/**
 * Show listening indicator on lock screen
 */
export function showLockListeningIndicator() {
  if (lockListeningIndicator && state.isScreenLocked) {
    lockListeningIndicator.classList.remove('hidden');
  }
}

/**
 * Hide listening indicator on lock screen
 */
export function hideLockListeningIndicator() {
  if (lockListeningIndicator) {
    lockListeningIndicator.classList.add('hidden');
  }
}

/**
 * Update transcript text on lock screen
 * @param {string} text - Transcript text to display
 */
export function updateLockTranscript(text) {
  if (!lockTranscript || !state.isScreenLocked) return;

  if (text && text.trim()) {
    lockTranscript.textContent = text;
    lockTranscript.classList.remove('hidden');
  } else {
    lockTranscript.textContent = '';
    lockTranscript.classList.add('hidden');
  }
}

/**
 * Clear transcript on lock screen
 */
export function clearLockTranscript() {
  updateLockTranscript('');
}

/**
 * Show muted indicator on lock screen
 */
export function showLockMutedIndicator() {
  if (lockMutedIndicator && state.isScreenLocked) {
    lockMutedIndicator.classList.remove('hidden');
    // Hide listening indicator when showing muted
    hideLockListeningIndicator();
  }
}

/**
 * Hide muted indicator on lock screen
 */
export function hideLockMutedIndicator() {
  if (lockMutedIndicator) {
    lockMutedIndicator.classList.add('hidden');
  }
}

/**
 * Update lock screen status to show current mic state
 * Call this when lock screen is shown or when mic state changes
 */
export function updateLockScreenMicStatus() {
  if (!state.isScreenLocked) return;

  if (state.isMuted) {
    showLockMutedIndicator();
  } else {
    hideLockMutedIndicator();
    // Show listening indicator immediately when not muted
    showLockListeningIndicator();
  }
}
