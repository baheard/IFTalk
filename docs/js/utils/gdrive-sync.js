/**
 * Google Drive Sync Module
 * Handles OAuth authentication, device tracking, and Drive API operations
 */

import { APP_CONFIG } from '../config.js';
import { state } from '../core/state.js';
import { updateStatus } from './status.js';

// Google API configuration
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email';

// Google API client instances
let tokenClient = null;
let accessToken = null;
let appFolderId = null;

// Auto-sync queue-based system (Phase 3)
const pendingSyncQueue = new Set(); // Set of saveKeys that need syncing
let syncTimer = null; // Single global timer for all saves

// Session flag: user declined auth for auto-sync (don't prompt again this session)
let autoSyncAuthDeclined = false;

/**
 * Check if current token is valid
 */
export function hasValidToken() {
  if (!accessToken) return false;

  const tokenData = JSON.parse(localStorage.getItem('gdrive_token') || '{}');
  if (!tokenData.expiresAt) return false;

  return Date.now() < tokenData.expiresAt;
}

/**
 * Ensure user is authenticated, prompting if needed
 * @param {boolean} isAutoSync - If true, respects session-level cancellation
 * @returns {Promise<boolean>} true if authenticated, false if cancelled
 */
export async function ensureAuthenticated(isAutoSync = false) {
  if (hasValidToken()) {
    return true; // Already authenticated
  }

  // If this is auto-sync and user previously declined this session, skip silently
  if (isAutoSync && autoSyncAuthDeclined) {
    return false;
  }

  // Token expired or missing - ask user to sign in
  const { confirmDialog } = await import('../ui/confirm-dialog.js');
  const confirmed = await confirmDialog(
    'Sign in to Google Drive to sync your saves?',
    { title: 'Authentication Required' }
  );

  if (!confirmed) {
    // If auto-sync, remember the cancellation for this session
    if (isAutoSync) {
      autoSyncAuthDeclined = true;
    }
    return false;
  }

  // Sign in
  await signIn();

  // Wait for auth to complete (check every 100ms, timeout after 30s)
  return new Promise((resolve) => {
    let attempts = 0;
    const maxAttempts = 300; // 30 seconds

    const checkAuth = () => {
      if (hasValidToken()) {
        resolve(true);
      } else if (attempts >= maxAttempts) {
        resolve(false);
      } else {
        attempts++;
        setTimeout(checkAuth, 100);
      }
    };

    setTimeout(checkAuth, 500); // Initial delay for popup to complete
  });
}

/**
 * Initialize Google Drive sync
 * Sets up OAuth client and checks for existing authentication
 */
export async function initGDriveSync() {
  try {
    // Wait for Google Identity Services to load
    await waitForGoogleApi();

    // Initialize token client
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: APP_CONFIG.googleClientId,
      scope: SCOPES,
      callback: handleAuthCallback,
    });

    // Check for stored token
    const storedToken = localStorage.getItem('gdrive_token');
    if (storedToken) {
      const tokenData = JSON.parse(storedToken);

      // Check if token is still valid
      if (tokenData.expiresAt && Date.now() < tokenData.expiresAt) {
        accessToken = tokenData.accessToken;
        state.gdriveSignedIn = true;
        state.gdriveEmail = tokenData.email || null;

        // Notify UI to update
        window.dispatchEvent(new CustomEvent('gdriveSignInChanged'));
      } else {
        // Token expired, clear it
        localStorage.removeItem('gdrive_token');
        accessToken = null;
        state.gdriveSignedIn = false;
        state.gdriveEmail = null;
      }
    }

    // Restore last sync time from localStorage
    const lastSyncTime = localStorage.getItem('iftalk_lastSyncTime');
    if (lastSyncTime) {
      state.gdriveLastSyncTime = lastSyncTime;
    }
  } catch (error) {
    throw error;
  }
}

/**
 * Wait for Google API to load
 */
function waitForGoogleApi() {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds

    const checkApi = () => {
      if (typeof google !== 'undefined' && google.accounts) {
        resolve();
      } else if (attempts >= maxAttempts) {
        reject(new Error('Google API failed to load'));
      } else {
        attempts++;
        setTimeout(checkApi, 100);
      }
    };

    checkApi();
  });
}

/**
 * Handle OAuth callback
 */
function handleAuthCallback(response) {
  if (response.error) {
    updateStatus('Sign-in failed: ' + response.error, 'error');
    return;
  }

  // Store access token immediately
  accessToken = response.access_token;
  const expiresAt = Date.now() + (response.expires_in * 1000);

  // Save token to localStorage FIRST (before fetching email)
  const tokenData = {
    accessToken: response.access_token,
    expiresAt: expiresAt,
    email: null, // Will be updated if email fetch succeeds
  };
  localStorage.setItem('gdrive_token', JSON.stringify(tokenData));

  // Update state
  state.gdriveSignedIn = true;
  state.gdriveError = null;

  // Trigger UI update event immediately
  window.dispatchEvent(new CustomEvent('gdriveSignInChanged'));

  // Try to get user info (but don't fail if this doesn't work)
  fetchUserInfo().then(userInfo => {
    // Update with email
    tokenData.email = userInfo.email;
    localStorage.setItem('gdrive_token', JSON.stringify(tokenData));
    state.gdriveEmail = userInfo.email;

    // Trigger UI update again with email
    window.dispatchEvent(new CustomEvent('gdriveSignInChanged'));
  }).catch(error => {
    // Failed to fetch user info, token saved anyway
  });
}

/**
 * Fetch user info from Google
 */
async function fetchUserInfo() {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user info');
  }

  return await response.json();
}

/**
 * Sign in to Google Drive
 */
export async function signIn() {
  if (!tokenClient) {
    throw new Error('Google Drive sync not initialized');
  }

  // Request access token
  tokenClient.requestAccessToken({ prompt: 'consent' });
}

/**
 * Sign out from Google Drive
 */
export async function signOut() {
  if (accessToken) {
    // Revoke token
    google.accounts.oauth2.revoke(accessToken, () => {});
  }

  // Clear stored data
  localStorage.removeItem('gdrive_token');
  accessToken = null;
  appFolderId = null;

  state.gdriveSignedIn = false;
  state.gdriveEmail = null;
  state.gdriveLastSyncTime = null;
  state.gdriveError = null;

  // Trigger UI update event
  window.dispatchEvent(new CustomEvent('gdriveSignInChanged'));
}

/**
 * Check if signed in
 */
export function isSignedIn() {
  return state.gdriveSignedIn && accessToken !== null;
}

/**
 * Generate or retrieve unique device ID
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
 */
function getBrowserName(ua) {
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('Firefox')) return 'Firefox';
  return 'Unknown';
}

/**
 * Ensure app folder exists in Google Drive
 */
async function ensureAppFolder() {
  if (appFolderId) {
    return appFolderId;
  }

  // Search for existing folder
  const query = `name='${APP_CONFIG.driveFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to search for app folder');
  }

  const data = await response.json();

  if (data.files && data.files.length > 0) {
    appFolderId = data.files[0].id;
    return appFolderId;
  }

  // Create folder
  const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: APP_CONFIG.driveFolderName,
      mimeType: 'application/vnd.google-apps.folder'
    })
  });

  if (!createResponse.ok) {
    throw new Error('Failed to create app folder');
  }

  const folderData = await createResponse.json();
  appFolderId = folderData.id;

  return appFolderId;
}

/**
 * Upload file to Google Drive
 */
async function uploadFile(filename, data) {
  if (!isSignedIn()) {
    throw new Error('Not signed in to Google Drive');
  }

  const folderId = await ensureAppFolder();

  // Check if file already exists
  const query = `name='${filename}' and '${folderId}' in parents and trashed=false`;
  const searchResponse = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!searchResponse.ok) {
    throw new Error('Failed to search for existing file');
  }

  const searchData = await searchResponse.json();
  const fileExists = searchData.files && searchData.files.length > 0;
  const existingFileId = fileExists ? searchData.files[0].id : null;

  // Prepare file content
  const boundary = '-------314159265358979323846';
  const delimiter = "\r\n--" + boundary + "\r\n";
  const close_delim = "\r\n--" + boundary + "--";

  const metadata = {
    name: filename,
    mimeType: 'application/json',
    parents: fileExists ? undefined : [folderId]
  };

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(data) +
    close_delim;

  const url = fileExists
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

  const method = fileExists ? 'PATCH' : 'POST';

  const response = await fetch(url, {
    method: method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary="${boundary}"`
    },
    body: multipartRequestBody
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to upload file: ${errorText}`);
  }

  const result = await response.json();

  return result;
}

/**
 * Download file from Google Drive
 */
async function downloadFile(filename) {
  if (!isSignedIn()) {
    throw new Error('Not signed in to Google Drive');
  }

  const folderId = await ensureAppFolder();

  // Search for file
  const query = `name='${filename}' and '${folderId}' in parents and trashed=false`;
  const searchResponse = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!searchResponse.ok) {
    throw new Error('Failed to search for file');
  }

  const searchData = await searchResponse.json();

  if (!searchData.files || searchData.files.length === 0) {
    return null; // File doesn't exist
  }

  const fileId = searchData.files[0].id;

  // Download file content
  const downloadResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!downloadResponse.ok) {
    throw new Error('Failed to download file');
  }

  const data = await downloadResponse.json();

  return data;
}

/**
 * List all files in app folder
 * Returns file metadata including id, name, and modifiedTime
 */
async function listFiles() {
  if (!isSignedIn()) {
    throw new Error('Not signed in to Google Drive');
  }

  const folderId = await ensureAppFolder();

  const query = `'${folderId}' in parents and trashed=false`;
  const fields = 'files(id,name,modifiedTime)'; // Request specific fields including modifiedTime
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=${fields}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );

  if (!response.ok) {
    throw new Error('Failed to list files');
  }

  const data = await response.json();

  return data.files || [];
}

/**
 * Convert localStorage key to Drive filename
 */
function localStorageKeyToFilename(key) {
  // Remove prefix and add .json extension
  // voxi_autosave_lostpig -> lostpig_autosave.json
  const prefix = APP_CONFIG.storagePrefix + '_';
  if (key.startsWith(prefix)) {
    const rest = key.substring(prefix.length);
    const parts = rest.split('_');
    if (parts.length >= 2) {
      const type = parts[0]; // autosave, quicksave, customsave
      const gameName = parts.slice(1).join('_');
      return `${gameName}_${type}.json`;
    }
  }
  return key + '.json';
}

/**
 * Convert Drive filename to localStorage key
 */
function filenameToLocalStorageKey(filename) {
  // lostpig_autosave.json -> voxi_autosave_lostpig
  const name = filename.replace('.json', '');
  const parts = name.split('_');
  if (parts.length >= 2) {
    const gameName = parts.slice(0, -1).join('_');
    const type = parts[parts.length - 1];
    return `${APP_CONFIG.storagePrefix}_${type}_${gameName}`;
  }
  return name;
}

/**
 * Sync saves to Google Drive (bidirectional manual sync)
 * @param {string} gameName - Optional game name to sync only that game's saves
 */
export async function syncAllNow(gameName = null) {
  // Ensure authenticated (will prompt if needed)
  const authenticated = await ensureAuthenticated(false); // Manual sync, always prompt
  if (!authenticated) {
    updateStatus('Sync cancelled - not signed in');
    return 0;
  }

  state.gdriveSyncPending = true;

  try {
    const deviceInfo = getDeviceInfo(); // Get once, reuse
    let uploadCount = 0;
    let downloadCount = 0;

    // Step 1: Get all Drive files and build a map for quick lookup
    const driveFiles = await listFiles();
    const driveFileMap = new Map();

    for (const file of driveFiles) {
      const localKey = filenameToLocalStorageKey(file.name);
      driveFileMap.set(localKey, file);
    }

    // Step 2: Scan localStorage for saves to sync
    const filesToDownload = [];
    const filesToUpload = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);

      // Filter: only process save files
      if (!key || !(
        key.startsWith(`${APP_CONFIG.storagePrefix}_autosave_`) ||
        key.startsWith(`${APP_CONFIG.storagePrefix}_quicksave_`) ||
        key.startsWith(`${APP_CONFIG.storagePrefix}_customsave_`)
      )) {
        continue;
      }

      // Filter: game-specific sync if requested
      if (gameName) {
        // More precise matching: key must end with _{gameName}
        const parts = key.split('_');
        const saveGameName = parts.slice(2).join('_'); // After "iftalk_type_"
        if (saveGameName !== gameName) {
          continue;
        }
      }

      const localData = JSON.parse(localStorage.getItem(key));
      const localTime = new Date(localData.timestamp).getTime();
      const driveFile = driveFileMap.get(key);

      if (!driveFile) {
        // No Drive version - upload local
        filesToUpload.push(key);
      } else {
        // Both exist - compare timestamps using Drive API metadata
        const driveModifiedTime = new Date(driveFile.modifiedTime).getTime();

        if (driveModifiedTime > localTime) {
          // Drive is newer - download (with confirmation)
          filesToDownload.push({
            key: key,
            driveFileId: driveFile.id,
            driveFileName: driveFile.name
          });
        } else if (localTime > driveModifiedTime) {
          // Local is newer - upload
          filesToUpload.push(key);
        }
        // If equal timestamps, skip (already in sync)
      }
    }

    // Step 3: Check for Drive files not in localStorage (download without confirmation)
    for (const file of driveFiles) {
      const localKey = filenameToLocalStorageKey(file.name);

      // Filter by game name if specified
      if (gameName) {
        const parts = localKey.split('_');
        const saveGameName = parts.slice(2).join('_');
        if (saveGameName !== gameName) {
          continue;
        }
      }

      if (!localStorage.getItem(localKey)) {
        // Drive file exists but not local - download it
        try {
          const driveData = await downloadFile(file.id);
          localStorage.setItem(localKey, JSON.stringify(driveData));
          downloadCount++;
        } catch (error) {
          // Failed to download, skip
        }
      }
    }

    // Step 4: If any local files would be overwritten, ask for confirmation
    if (filesToDownload.length > 0) {
      // Download one file to get device info for the prompt
      const firstFile = filesToDownload[0];
      const sampleData = await downloadFile(firstFile.driveFileId);
      const device = sampleData.device || { type: 'Unknown', browser: 'Unknown' };
      const deviceInfoStr = `${device.type} (${device.browser})`;

      const { confirmDialog } = await import('../ui/confirm-dialog.js');
      const confirmed = await confirmDialog(
        `${filesToDownload.length} save(s) on Google Drive are newer than your local saves.\n\n` +
        `From: ${deviceInfoStr}\n\n` +
        `Download and overwrite local saves?`,
        { title: 'Download Newer Saves?' }
      );

      if (!confirmed) {
        // User cancelled download, proceed with upload only
      } else {
        // User confirmed - download and overwrite with backups
        for (const item of filesToDownload) {
          try {
            // Download Drive version
            const driveData = await downloadFile(item.driveFileId);

            // Create conflict backup before overwriting (use localStorage key directly)
            const localData = JSON.parse(localStorage.getItem(item.key));
            createConflictBackup(item.key, localData);

            // Overwrite with Drive version
            localStorage.setItem(item.key, JSON.stringify(driveData));
            downloadCount++;
          } catch (error) {
            // Failed to download, skip
          }
        }
      }
    }

    // Step 5: Upload local saves that are newer or don't exist on Drive
    for (const key of filesToUpload) {
      try {
        const saveData = JSON.parse(localStorage.getItem(key));

        // Add device info
        const enrichedData = {
          ...saveData,
          device: deviceInfo
        };

        const filename = localStorageKeyToFilename(key);
        await uploadFile(filename, enrichedData);
        uploadCount++;
      } catch (error) {
        // Failed to upload, skip
      }
    }

    const syncTime = new Date().toISOString();
    state.gdriveLastSyncTime = syncTime;
    localStorage.setItem('iftalk_lastSyncTime', syncTime);
    state.gdriveSyncPending = false;
    state.gdriveError = null;

    return uploadCount + downloadCount;
  } catch (error) {
    state.gdriveSyncPending = false;
    state.gdriveError = error.message;
    throw error;
  }
}

/**
 * Schedule Drive sync with queue-based debounce (Phase 3: Auto-Export)
 * Collects all pending saves and uploads them together after 5 seconds
 */
export function scheduleDriveSync(saveKey, saveData) {
  // Only sync if auto-sync is enabled
  if (!state.gdriveSyncEnabled) {
    return;
  }

  // Don't queue if auth was declined this session
  if (autoSyncAuthDeclined) {
    return;
  }

  // Add save to pending queue
  pendingSyncQueue.add(saveKey);

  // Clear existing timer (reset 5-second countdown)
  if (syncTimer) {
    clearTimeout(syncTimer);
  }

  // Schedule batch upload (5 seconds after last save)
  syncTimer = setTimeout(async () => {
    try {
      // Check auth before auto-syncing (may prompt if token expired)
      const authenticated = await ensureAuthenticated(true); // Auto-sync mode
      if (!authenticated) {
        updateStatus('Auto-sync requires Google Drive sign-in');
        pendingSyncQueue.clear(); // Clear queue on auth failure
        return;
      }

      // Get all saves from queue
      const saveKeys = Array.from(pendingSyncQueue);

      let uploadCount = 0;

      // Upload all pending saves
      for (const key of saveKeys) {
        try {
          // Read latest data from localStorage (may have changed since queued)
          const currentData = localStorage.getItem(key);
          if (!currentData) {
            continue;
          }

          const parsedData = JSON.parse(currentData);

          // Add device info
          const enrichedData = {
            ...parsedData,
            device: getDeviceInfo()
          };

          const filename = localStorageKeyToFilename(key);
          await uploadFile(filename, enrichedData);
          uploadCount++;
        } catch (error) {
          // Continue with remaining saves
        }
      }

      // Update sync time
      const syncTime = new Date().toISOString();
      state.gdriveLastSyncTime = syncTime;
      localStorage.setItem('iftalk_lastSyncTime', syncTime);

      // Trigger UI update to show new sync time
      window.dispatchEvent(new CustomEvent('gdriveSyncComplete'));

    } catch (error) {
      state.gdriveError = error.message;
    } finally {
      // Clear queue and timer
      pendingSyncQueue.clear();
      syncTimer = null;
    }
  }, 5000);
}

/**
 * Create conflict backup when local save is about to be overwritten
 * Stores backup in localStorage with timestamped key
 * Keeps max 2 backups per save type per game, deletes oldest when creating 3rd
 * @param {string} localStorageKey - The localStorage key (e.g., "iftalk_autosave_lostpig")
 * @param {object} localData - The save data to backup
 */
function createConflictBackup(localStorageKey, localData) {
  // Create backup key with timestamp: iftalk_backup_autosave_lostpig_1703435022000
  const timestamp = Date.now();
  const backupKey = `${localStorageKey.replace('iftalk_', 'iftalk_backup_')}_${timestamp}`;

  // Store backup
  localStorage.setItem(backupKey, JSON.stringify(localData));

  // Find all backups for this save (same prefix without timestamp)
  const backupPrefix = backupKey.substring(0, backupKey.lastIndexOf('_'));
  const allBackups = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(backupPrefix + '_')) {
      // Extract timestamp from key
      const parts = key.split('_');
      const ts = parseInt(parts[parts.length - 1]);
      allBackups.push({ key: key, timestamp: ts });
    }
  }

  // Sort by timestamp (oldest first)
  allBackups.sort((a, b) => a.timestamp - b.timestamp);

  // Keep only the 2 most recent backups (delete oldest if we have more than 2)
  while (allBackups.length > 2) {
    const oldest = allBackups.shift();
    localStorage.removeItem(oldest.key);
  }
}

/**
 * Delete file from Drive
 */
async function deleteFile(fileId) {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to delete file');
  }
}

/**
 * Delete all save files for a specific game from Google Drive
 * @param {string} gameName - The game name (e.g., 'lostpig')
 */
export async function deleteGameDataFromDrive(gameName) {
  // Ensure authenticated (will prompt if needed)
  const authenticated = await ensureAuthenticated(false);
  if (!authenticated) {
    return 0;
  }

  try{
    const files = await listFiles();
    let deleteCount = 0;

    // Find all files for this game
    const gameFiles = files.filter(file => {
      const name = file.name.toLowerCase();
      return name.startsWith(gameName.toLowerCase() + '_');
    });

    // Delete each file
    for (const file of gameFiles) {
      try {
        await deleteFile(file.id);
        deleteCount++;
      } catch (error) {
        // Failed to delete, skip
      }
    }

    return deleteCount;
  } catch (error) {
    throw error;
  }
}

/**
 * Delete ALL data from Google Drive (entire IFTalk folder)
 */
export async function deleteAllDataFromDrive() {
  // Ensure authenticated (will prompt if needed)
  const authenticated = await ensureAuthenticated(false);
  if (!authenticated) {
    return;
  }

  try {
    // Get app folder ID
    const folderId = await ensureAppFolder();

    // Delete the entire folder
    await deleteFile(folderId);

    // Clear cached folder IDs
    appFolderId = null;
  } catch (error) {
    throw error;
  }
}
