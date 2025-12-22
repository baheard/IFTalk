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

  if (!lockScreenOverlay || !unlockButton || !unlockProgress) {
    console.warn('[LockScreen] DOM elements not found - lock screen disabled');
    return;
  }
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
  import('./wake-lock.js').then(module => {
    wasKeepAwakeEnabledBeforeLock = module.isKeepAwakeEnabled();
    if (!wasKeepAwakeEnabledBeforeLock) {
      module.enableKeepAwake();
    }
  });

  // Show overlay
  if (lockScreenOverlay) {
    lockScreenOverlay.classList.remove('hidden');
  }

  // Pause non-essential animations for battery savings
  pauseNonEssentialAnimations();

  // Prevent body scroll
  document.body.style.overflow = 'hidden';

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

  updateStatus('Screen locked - say "unlock" or hold button');
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
  import('./wake-lock.js').then(module => {
    if (!wasKeepAwakeEnabledBeforeLock) {
      module.disableKeepAwake();
    }
  });

  // Hide overlay
  if (lockScreenOverlay) {
    lockScreenOverlay.classList.add('hidden');
  }

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
