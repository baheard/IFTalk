/**
 * Google Drive Device Module
 *
 * Handles device ID generation and device information.
 */

import { APP_CONFIG } from '../../config.js';

/**
 * Get unique device ID (creates one if doesn't exist)
 * @returns {string} Unique device ID
 */
export function getDeviceId() {
  let deviceId = localStorage.getItem(APP_CONFIG.deviceIdKey);

  if (!deviceId) {
    // Generate unique ID: timestamp + random + browser fingerprint
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      Intl.DateTimeFormat().resolvedOptions().timeZone
    ].join('|');

    deviceId = `${timestamp}-${random}-${btoa(fingerprint).substring(0, 16)}`;
    localStorage.setItem(APP_CONFIG.deviceIdKey, deviceId);
  }

  return deviceId;
}

/**
 * Get human-readable device info
 * @returns {object} Device information
 */
export function getDeviceInfo() {
  const ua = navigator.userAgent;
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);

  let deviceType = 'Desktop';
  if (isIOS) deviceType = 'iOS';
  else if (isAndroid) deviceType = 'Android';
  else if (isMobile) deviceType = 'Mobile';

  return {
    id: getDeviceId(),
    type: deviceType,
    browser: getBrowserName(ua),
    timestamp: new Date().toISOString()
  };
}

/**
 * Get browser name from user agent
 * @param {string} ua - User agent string
 * @returns {string} Browser name
 */
function getBrowserName(ua) {
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('Firefox')) return 'Firefox';
  return 'Unknown';
}
