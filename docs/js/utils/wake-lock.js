/**
 * Keep Awake Module
 *
 * Prevents the device screen from dimming/locking during gameplay.
 * Uses the Screen Wake Lock API (supported in all major browsers since 2024).
 * Falls back gracefully if not supported.
 */

let wakeLock = null;
let enabled = false;
let retryTimer = null;
let periodicCheckTimer = null;

/**
 * Request a screen wake lock
 */
async function requestWakeLock() {
  if (!('wakeLock' in navigator)) {
    console.warn('[KeepAwake] Wake Lock API not supported');
    return false;
  }

  // Don't request if page is hidden (will fail)
  if (document.visibilityState !== 'visible') {
    console.log('[KeepAwake] ⏸️ Page hidden - deferring wake lock request');
    return false;
  }

  try {
    wakeLock = await navigator.wakeLock.request('screen');
    console.log('[KeepAwake] ✅ Wake lock acquired');

    // Listen for release (e.g., if system takes it back)
    wakeLock.addEventListener('release', () => {
      console.log('[KeepAwake] 🔓 Wake lock released by system');
      wakeLock = null;

      // Auto-retry if we're supposed to be enabled
      if (enabled) {
        scheduleRetry();
      }
    });

    return true;
  } catch (err) {
    // Can fail if page is hidden, battery saver mode, etc.
    console.warn('[KeepAwake] ❌ Wake lock request failed:', err.message);
    wakeLock = null;

    // Auto-retry if we're supposed to be enabled
    if (enabled) {
      scheduleRetry();
    }

    return false;
  }
}

/**
 * Schedule a retry to acquire wake lock
 */
function scheduleRetry() {
  // Clear any existing retry timer
  if (retryTimer) {
    clearTimeout(retryTimer);
  }

  // Retry after 2 seconds
  retryTimer = setTimeout(() => {
    if (enabled && !wakeLock) {
      console.log('[KeepAwake] 🔄 Retrying wake lock request...');
      requestWakeLock();
    }
  }, 2000);
}

/**
 * Release the wake lock
 */
async function releaseWakeLock() {
  // Clear retry timer
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }

  // Clear periodic check timer
  if (periodicCheckTimer) {
    clearInterval(periodicCheckTimer);
    periodicCheckTimer = null;
  }

  if (wakeLock) {
    try {
      await wakeLock.release();
      console.log('[KeepAwake] 🔓 Wake lock released');
    } catch (e) {
      // Already released
      console.log('[KeepAwake] Wake lock already released');
    }
    wakeLock = null;
  }
}

/**
 * Start periodic check to ensure wake lock is still active
 */
function startPeriodicCheck() {
  // Clear any existing timer
  if (periodicCheckTimer) {
    clearInterval(periodicCheckTimer);
  }

  // Check every 10 seconds
  periodicCheckTimer = setInterval(() => {
    if (enabled && !wakeLock && document.visibilityState === 'visible') {
      console.log('[KeepAwake] 🔄 Periodic check: wake lock lost, re-acquiring...');
      requestWakeLock();
    }
  }, 10000);
}

/**
 * Enable keep awake (persists setting)
 */
export async function enableKeepAwake() {
  console.log('[KeepAwake] 🟢 Enabling keep awake');
  enabled = true;
  localStorage.setItem('iftalk_keep_awake', 'true');
  await requestWakeLock();
  startPeriodicCheck();
}

/**
 * Disable keep awake (persists setting)
 */
export async function disableKeepAwake() {
  console.log('[KeepAwake] 🔴 Disabling keep awake');
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

  console.log(`[KeepAwake] 🚀 Initialized - enabled: ${enabled}`);

  // Re-acquire wake lock when page becomes visible again
  // (wake locks are automatically released when page is hidden)
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
      if (enabled && !wakeLock) {
        console.log('[KeepAwake] 👁️ Page visible - re-acquiring wake lock');
        await requestWakeLock();
      }
    } else {
      console.log('[KeepAwake] 👁️ Page hidden - wake lock will be auto-released by browser');
    }
  });

  // If enabled, start periodic check
  if (enabled) {
    startPeriodicCheck();
  }

  return enabled;
}

/**
 * Start keep awake if enabled (call after user interaction)
 * Browser policy requires user gesture before requesting wake lock
 */
export async function activateIfEnabled() {
  if (enabled && !wakeLock) {
    console.log('[KeepAwake] 🎮 User interaction - activating wake lock');
    await requestWakeLock();
    startPeriodicCheck();
  }
}
