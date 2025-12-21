/**
 * Keep Awake Module
 *
 * Prevents the device screen from dimming/locking during gameplay.
 * Uses the Screen Wake Lock API (supported in all major browsers since 2024).
 * Falls back gracefully if not supported.
 */

let wakeLock = null;
let enabled = false;

/**
 * Request a screen wake lock
 */
async function requestWakeLock() {
  if (!('wakeLock' in navigator)) {
    console.warn('[KeepAwake] Wake Lock API not supported');
    return false;
  }

  try {
    wakeLock = await navigator.wakeLock.request('screen');
    console.log('[KeepAwake] Screen wake lock acquired');

    // Listen for release (e.g., if system takes it back)
    wakeLock.addEventListener('release', () => {
      console.log('[KeepAwake] Wake lock was released');
      wakeLock = null;
    });

    return true;
  } catch (err) {
    // Can fail if page is hidden, battery saver mode, etc.
    console.warn('[KeepAwake] Wake lock request failed:', err.message);
    return false;
  }
}

/**
 * Release the wake lock
 */
async function releaseWakeLock() {
  if (wakeLock) {
    try {
      await wakeLock.release();
      console.log('[KeepAwake] Wake lock released');
    } catch (e) {
      // Already released
    }
    wakeLock = null;
  }
}

/**
 * Enable keep awake (persists setting)
 */
export async function enableKeepAwake() {
  enabled = true;
  localStorage.setItem('iftalk_keep_awake', 'true');
  await requestWakeLock();
}

/**
 * Disable keep awake (persists setting)
 */
export async function disableKeepAwake() {
  enabled = false;
  localStorage.setItem('iftalk_keep_awake', 'false');
  await releaseWakeLock();
}

/**
 * Toggle keep awake
 * @returns {boolean} New state
 */
export async function toggleKeepAwake() {
  if (enabled) {
    await disableKeepAwake();
  } else {
    await enableKeepAwake();
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
 * Check if Wake Lock API is supported
 * @returns {boolean}
 */
export function isWakeLockSupported() {
  return 'wakeLock' in navigator;
}

/**
 * Initialize keep awake from saved preference
 */
export function initKeepAwake() {
  const saved = localStorage.getItem('iftalk_keep_awake');
  enabled = saved === 'true';

  // Re-acquire wake lock when page becomes visible again
  // (wake locks are automatically released when page is hidden)
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && enabled && !wakeLock) {
      console.log('[KeepAwake] Page visible, re-acquiring wake lock');
      await requestWakeLock();
    }
  });

  return enabled;
}

/**
 * Start keep awake if enabled (call after user interaction)
 * Browser policy requires user gesture before requesting wake lock
 */
export async function activateIfEnabled() {
  if (enabled && !wakeLock) {
    await requestWakeLock();
  }
}
