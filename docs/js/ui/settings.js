/**
 * Settings Panel Module
 *
 * Manages settings UI, voice selection, and pronunciation dictionary.
 * Supports per-game settings for voices, speech rate, etc.
 */

import { state } from '../core/state.js';
import { dom } from '../core/dom.js';
import { updateStatus } from '../utils/status.js';
import { getPronunciationMap, savePronunciationMap, addPronunciation, removePronunciation } from '../utils/pronunciation.js';
import {
  clearAllGameData, clearAllAppData
} from '../utils/game-settings.js';
import { isLocalhost, syncFromRemote } from '../utils/storage-sync.js';
import { confirmDialog } from './confirm-dialog.js';

/**
 * Check if we're on the welcome screen (no game loaded)
 * @returns {boolean} True if on welcome screen
 */
export function isOnWelcomeScreen() {
  return !state.currentGameName;
}

/**
 * Update settings panel labels based on context (welcome vs in-game)
 * Called when settings panel opens and when game loads/unloads
 */
export function updateSettingsContext() {
  const isWelcome = isOnWelcomeScreen();

  // Quick Actions - show current game name when in-game
  const currentGameDisplay = document.getElementById('currentGameDisplay');
  if (currentGameDisplay) {
    currentGameDisplay.style.display = isWelcome ? 'none' : 'flex';
    if (!isWelcome) {
      const gameNameSpan = document.getElementById('currentGameName');
      if (gameNameSpan) {
        gameNameSpan.textContent = getGameDisplayName(state.currentGameName);
      }
    }
  }

  // Show/hide game-specific items (exclude currentGameDisplay, it's handled separately)
  const gameItems = document.querySelectorAll('.game-section-item:not(#currentGameDisplay)');
  gameItems.forEach(item => {
    item.style.display = isWelcome ? 'none' : 'block';
  });

  // Show/hide welcome-specific items
  const welcomeItems = document.querySelectorAll('.welcome-section-item');
  welcomeItems.forEach(item => {
    item.style.display = isWelcome ? 'block' : 'none';
  });

  // No need to reload settings - they're global now!
}

/**
 * Initialize settings panel
 */
export function initSettings() {
  // Settings button (in-game)
  if (dom.settingsBtn) {
    dom.settingsBtn.addEventListener('click', () => {
      if (dom.settingsPanel) {
        // Update labels based on context before showing
        updateSettingsContext();
        dom.settingsPanel.classList.toggle('open');
      }
    });
  }

  // Settings button (welcome screen)
  const welcomeSettingsBtn = document.getElementById('welcomeSettingsBtn');
  if (welcomeSettingsBtn) {
    welcomeSettingsBtn.addEventListener('click', () => {
      if (dom.settingsPanel) {
        updateSettingsContext();
        dom.settingsPanel.classList.add('open');
      }
    });
  }

  // Close settings button
  if (dom.closeSettingsBtn) {
    dom.closeSettingsBtn.addEventListener('click', () => {
      if (dom.settingsPanel) {
        dom.settingsPanel.classList.remove('open');
      }
    });
  }

  // Load pronunciation dictionary UI
  loadPronunciationUI();

  // Add pronunciation button
  if (dom.addPronunciationBtn) {
    dom.addPronunciationBtn.addEventListener('click', () => {
      const wordInput = document.getElementById('newWord');
      const pronunciationInput = document.getElementById('newPronunciation');

      if (wordInput && pronunciationInput) {
        const word = wordInput.value.trim();
        const pronunciation = pronunciationInput.value.trim();

        if (word && pronunciation) {
          addPronunciation(word, pronunciation);
          wordInput.value = '';
          pronunciationInput.value = '';
          loadPronunciationUI();
          updateStatus(`Added pronunciation: ${word} → ${pronunciation}`);
        }
      }
    });
  }

  // Get Hint Section
  const hintSection = document.getElementById('hintSection');
  if (hintSection) {
    // Load hint type preference from global localStorage
    const hintTypeSelect = document.getElementById('hintTypeSelect');
    if (hintTypeSelect) {
      const savedHintType = localStorage.getItem('iftalk_hintType') || 'general';
      hintTypeSelect.value = savedHintType;

      // Save preference when changed
      hintTypeSelect.addEventListener('change', (e) => {
        localStorage.setItem('iftalk_hintType', e.target.value);
      });
    }

    // Get Hint button
    const getHintBtn = document.getElementById('getHintBtn');
    if (getHintBtn) {
      getHintBtn.addEventListener('click', async () => {
        const { getHint } = await import('../features/hints.js');
        const hintType = hintTypeSelect?.value || 'general';
        getHint(hintType);
      });
    }
  }

  // Collapsible sections
  const collapsibleSections = document.querySelectorAll('.settings-section.collapsible');
  collapsibleSections.forEach(section => {
    const header = section.querySelector('.section-header');
    if (header) {
      header.addEventListener('click', () => {
        section.classList.toggle('collapsed');
      });
    }
  });

  // Note: Quick Save/Restore button handlers are in save-manager.js
  // to avoid duplicate handlers

  // Clear Data button - behavior depends on context
  const clearAllDataBtn = document.getElementById('clearAllDataBtn');
  if (clearAllDataBtn) {
    clearAllDataBtn.addEventListener('click', async () => {
      const onWelcome = isOnWelcomeScreen();
      const gameName = state.currentGameName;

      // Different confirmation based on context
      let confirmed;
      if (onWelcome) {
        // Welcome screen: clear ALL app data
        confirmed = await confirmDialog(
          'This will permanently delete ALL data for ALL games.\n\n' +
          'This includes:\n' +
          '• All saves and autosaves\n' +
          '• All game progress\n' +
          '• All settings (voices, speed)\n' +
          '• App defaults\n\n' +
          'This action cannot be undone!',
          { title: 'Delete All Data?' }
        );
      } else {
        // In-game: clear only this game's data
        const displayName = getGameDisplayName(gameName);
        confirmed = await confirmDialog(
          'This includes:\n' +
          '• Saves and autosave\n' +
          '• Game progress\n' +
          '• Voice/speed settings for this game\n\n' +
          'App defaults and other games will NOT be affected.',
          { title: `Delete "${displayName}"?` }
        );
      }

      if (confirmed) {
        try {
          if (onWelcome) {
            // Clear everything (localStorage + Google Drive)
            const count = clearAllAppData();

            // Also delete from Drive if signed in
            if (state.gdriveSignedIn) {
              try {
                const { deleteAllDataFromDrive } = await import('../utils/gdrive-sync.js');
                await deleteAllDataFromDrive();
                updateStatus(`✓ Cleared all app data (local + Drive)`);
              } catch (driveError) {
                console.error('[Settings] Failed to delete from Drive:', driveError);
                updateStatus(`✓ Cleared local data (Drive deletion failed)`);
              }
            } else {
              updateStatus(`✓ Cleared all app data`);
            }

            alert('Successfully deleted all app data.\n\nAll saves, progress, and settings have been cleared.');
          } else {
            // Clear only current game (localStorage + Google Drive)
            clearAllGameData(gameName);

            // Also delete from Drive if signed in
            if (state.gdriveSignedIn) {
              try {
                const { deleteGameDataFromDrive } = await import('../utils/gdrive-sync.js');
                const deleteCount = await deleteGameDataFromDrive(gameName);
                updateStatus(`✓ Cleared data for ${gameName} (${deleteCount} files from Drive)`);
              } catch (driveError) {
                console.error('[Settings] Failed to delete from Drive:', driveError);
                updateStatus(`✓ Cleared local data for ${gameName} (Drive deletion failed)`);
              }
            } else {
              updateStatus(`✓ Cleared data for ${gameName}`);
            }

            alert(`Successfully deleted data for "${gameName}".\n\nThis game will use app defaults on next load.`);
          }

          // Close settings panel
          if (dom.settingsPanel) {
            dom.settingsPanel.classList.remove('open');
          }

        } catch (error) {
          console.error('[Settings] Failed to clear data:', error);
          updateStatus('Error clearing data');
          alert('Failed to clear data: ' + error.message);
        }
      } else {
        updateStatus('Clear data cancelled');
      }
    });
  }

  // Standalone "Delete All App Data" button (welcome screen only)
  const deleteAllAppDataBtn = document.getElementById('deleteAllAppDataBtn');
  if (deleteAllAppDataBtn) {
    deleteAllAppDataBtn.addEventListener('click', async () => {
      const confirmed = await confirmDialog(
        'This will permanently delete ALL data for ALL games.\n\n' +
        'This includes:\n' +
        '• All saves and autosaves\n' +
        '• All game progress\n' +
        '• All settings (voices, speed)\n' +
        '• App defaults\n\n' +
        'This action cannot be undone!',
        { title: 'Delete All Data?' }
      );

      if (confirmed) {
        try {
          clearAllAppData();

          // Also delete from Drive if signed in
          if (state.gdriveSignedIn) {
            try {
              const { deleteAllDataFromDrive } = await import('../utils/gdrive-sync.js');
              await deleteAllDataFromDrive();
              updateStatus('✓ Cleared all app data (local + Drive)');
            } catch (driveError) {
              console.error('[Settings] Failed to delete from Drive:', driveError);
              updateStatus('✓ Cleared local data (Drive deletion failed)');
            }
          } else {
            updateStatus('✓ Cleared all app data');
          }

          alert('Successfully deleted all app data.\n\nAll saves, progress, and settings have been cleared.');

          // Close settings panel
          if (dom.settingsPanel) {
            dom.settingsPanel.classList.remove('open');
          }
        } catch (error) {
          console.error('[Settings] Failed to clear data:', error);
          updateStatus('Error clearing data');
          alert('Failed to clear data: ' + error.message);
        }
      } else {
        updateStatus('Clear data cancelled');
      }
    });
  }

  // Master volume slider (global, not per-game)
  const volumeSlider = document.getElementById('masterVolume');
  const volumeValue = document.getElementById('masterVolumeValue');
  if (volumeSlider && volumeValue) {
    // Load saved volume (global setting)
    const savedVolume = localStorage.getItem('iftalk_masterVolume');
    const volume = savedVolume ? parseInt(savedVolume) : 100;
    volumeSlider.value = volume;
    volumeValue.textContent = volume + '%';
    if (state.browserVoiceConfig) {
      state.browserVoiceConfig.volume = volume / 100;
    }

    volumeSlider.addEventListener('input', (e) => {
      const vol = parseInt(e.target.value);
      volumeValue.textContent = vol + '%';

      // Update voice config
      if (state.browserVoiceConfig) {
        state.browserVoiceConfig.volume = vol / 100;
      }

      // Save globally (not per-game)
      localStorage.setItem('iftalk_masterVolume', vol.toString());
      updateStatus(`Volume: ${vol}%`);
    });
  }

  // Speech rate slider
  const speechRateSlider = document.getElementById('speechRate');
  const speechRateValue = document.getElementById('speechRateValue');
  if (speechRateSlider && speechRateValue) {
    // Load saved speech rate from global localStorage
    const savedRate = localStorage.getItem('iftalk_speechRate');
    const rate = savedRate ? parseFloat(savedRate) : 1.0;
    speechRateSlider.value = rate;
    speechRateValue.textContent = rate.toFixed(1) + 'x';
    if (state.browserVoiceConfig) {
      state.browserVoiceConfig.rate = rate;
    }

    speechRateSlider.addEventListener('input', (e) => {
      const rate = parseFloat(e.target.value);
      speechRateValue.textContent = rate.toFixed(1) + 'x';

      // Update voice config
      if (state.browserVoiceConfig) {
        state.browserVoiceConfig.rate = rate;
      }

      // Save to global localStorage
      localStorage.setItem('iftalk_speechRate', rate.toString());
      updateStatus(`✓ Speech speed: ${rate.toFixed(1)}x`);
    });
  }

  // === NEW TOGGLE HANDLERS ===

  // Voice Controls toggle
  const voiceControlsToggle = document.getElementById('voiceControlsToggle');
  if (voiceControlsToggle) {
    const voiceControlsEnabled = localStorage.getItem('iftalk_voiceControlsEnabled') !== 'false';
    voiceControlsToggle.checked = voiceControlsEnabled;
    updateVoiceControlsVisibility(voiceControlsEnabled);

    voiceControlsToggle.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      localStorage.setItem('iftalk_voiceControlsEnabled', enabled);
      updateVoiceControlsVisibility(enabled);
      updateStatus(enabled ? '✓ Voice controls shown' : '✗ Voice controls hidden');
    });
  }

  // Sound Effects toggle
  const soundEffectsToggle = document.getElementById('soundEffectsToggle');
  if (soundEffectsToggle) {
    const soundEffectsEnabled = localStorage.getItem('iftalk_soundEffectsEnabled') !== 'false';
    soundEffectsToggle.checked = soundEffectsEnabled;

    soundEffectsToggle.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      localStorage.setItem('iftalk_soundEffectsEnabled', enabled);
      updateStatus(enabled ? '✓ Sound effects enabled' : '✗ Sound effects disabled');
    });
  }

  // Auto-save toggle
  const autosaveToggle = document.getElementById('autosaveToggle');
  if (autosaveToggle) {
    const autosaveEnabled = localStorage.getItem('iftalk_autosaveEnabled') !== 'false';
    autosaveToggle.checked = autosaveEnabled;

    autosaveToggle.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      localStorage.setItem('iftalk_autosaveEnabled', enabled);
      updateStatus(enabled ? '✓ Auto-save enabled' : '✗ Auto-save disabled');
    });
  }

  // Keep Screen Awake toggle (already uses global state)
  const keepAwakeToggle = document.getElementById('keepAwakeToggle');
  if (keepAwakeToggle) {
    const keepAwake = localStorage.getItem('iftalk_keepScreenAwake') === 'true';
    keepAwakeToggle.checked = keepAwake;

    keepAwakeToggle.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      localStorage.setItem('iftalk_keepScreenAwake', enabled);
      // Update screen wake lock if available
      if (window.screenLock) {
        if (enabled) {
          window.screenLock.enable();
        } else {
          window.screenLock.disable();
        }
      }
      updateStatus(enabled ? '✓ Screen will stay awake' : '✗ Screen lock disabled');
    });
  }

  // Lock Screen Now button
  const lockScreenBtn = document.getElementById('lockScreenBtn');
  if (lockScreenBtn) {
    lockScreenBtn.addEventListener('click', () => {
      if (window.screenLock) {
        window.screenLock.lock();
        updateStatus('✓ Screen locked');
      }
    });
  }

  // Google Drive sync handlers
  const gdriveSignInBtn = document.getElementById('gdriveSignInBtn');
  if (gdriveSignInBtn) {
    gdriveSignInBtn.addEventListener('click', async () => {
      try {
        const { signIn } = await import('../utils/gdrive-sync.js');
        await signIn();
        updateGDriveUI();
        updateStatus('Signed in to Google Drive', 'success');
      } catch (error) {
        console.error('[Settings] Sign-in failed:', error);
        updateStatus('Sign-in failed: ' + error.message, 'error');
      }
    });
  }

  const gdriveSignOutBtn = document.getElementById('gdriveSignOutBtn');
  if (gdriveSignOutBtn) {
    gdriveSignOutBtn.addEventListener('click', async () => {
      try {
        const { signOut } = await import('../utils/gdrive-sync.js');
        await signOut();
        updateGDriveUI();
        updateStatus('Signed out of Google Drive');
      } catch (error) {
        console.error('[Settings] Sign-out failed:', error);
        updateStatus('Sign-out failed: ' + error.message, 'error');
      }
    });
  }

  const gdriveSyncNowBtn = document.getElementById('gdriveSyncNowBtn');
  if (gdriveSyncNowBtn) {
    const btnIcon = gdriveSyncNowBtn.querySelector('.material-icons');
    const btnText = gdriveSyncNowBtn.childNodes[2]; // Text node after icon

    gdriveSyncNowBtn.addEventListener('click', async () => {
      // Disable button and show syncing state
      gdriveSyncNowBtn.disabled = true;
      btnIcon.textContent = 'autorenew';
      btnIcon.classList.add('spinning');
      btnText.textContent = ' Syncing...';

      try {
        const { syncAllNow } = await import('../utils/gdrive-sync.js');
        updateStatus('Syncing saves to Google Drive...', 'processing');

        // Sync only the current game's saves
        const count = await syncAllNow(state.currentGameName);

        if (count > 0) {
          // Success state
          btnIcon.classList.remove('spinning');
          btnIcon.textContent = 'check';
          btnText.textContent = ` Synced ${count} file(s)`;
          updateGDriveUI();
          updateStatus(`Synced ${count} file(s) to Google Drive`, 'success');

          // Reset to ready state after 2 seconds
          setTimeout(() => {
            btnIcon.textContent = 'sync';
            btnText.textContent = ' Sync Now';
            gdriveSyncNowBtn.disabled = false;
          }, 2000);
        } else {
          // No files synced (user cancelled auth)
          btnIcon.classList.remove('spinning');
          btnIcon.textContent = 'sync';
          btnText.textContent = ' Sync Now';
          gdriveSyncNowBtn.disabled = false;
        }
      } catch (error) {
        // Error state
        console.error('[Settings] Sync failed:', error);
        btnIcon.classList.remove('spinning');
        btnIcon.textContent = 'error';
        btnText.textContent = ' Sync Failed';
        updateStatus('Sync failed: ' + error.message, 'error');

        // Reset to ready state after 3 seconds
        setTimeout(() => {
          btnIcon.textContent = 'sync';
          btnText.textContent = ' Sync Now';
          gdriveSyncNowBtn.disabled = false;
        }, 3000);
      }
    });
  }

  // Listen for sign-in/sign-out events to update UI
  window.addEventListener('gdriveSignInChanged', () => {
    updateGDriveUI();
  });

  // Listen for auto-sync completion to update last sync time
  window.addEventListener('gdriveSyncComplete', () => {
    updateGDriveUI();
  });

  // Initialize Google Drive UI on load
  updateGDriveUI();
  // Auto-Sync toggle (Phase 3)
  const autoSyncToggle = document.getElementById('autoSyncToggle');
  if (autoSyncToggle) {
    // Load saved preference
    const enabled = localStorage.getItem('iftalk_autoSyncEnabled') === 'true';
    autoSyncToggle.checked = enabled;
    state.gdriveSyncEnabled = enabled;

    autoSyncToggle.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      state.gdriveSyncEnabled = enabled;
      localStorage.setItem('iftalk_autoSyncEnabled', enabled);
      updateStatus(enabled ? 'Auto-sync enabled' : 'Auto-sync disabled');
    });
  }

  // Home button (return to game selection)
  const selectGameBtn = document.getElementById('selectGameBtn');
  if (selectGameBtn) {
    selectGameBtn.addEventListener('click', async () => {
      // Import and call unload function
      const { unloadGame } = await import('../game/game-loader.js');
      unloadGame();
      // Close settings panel
      if (dom.settingsPanel) {
        dom.settingsPanel.classList.remove('open');
      }
    });
  }
}

/**
 * Get display name for a game (looks up proper title from game card, with fallback)
 * @param {string} gameName - Game filename (with or without extension)
 * @returns {string} Formatted display name
 */
export function getGameDisplayName(gameName) {
  if (!gameName) return '';

  // Try to find the proper display name from game card
  const gameCard = document.querySelector(`.game-card[data-game="${gameName}"]`) ||
                   document.querySelector(`.game-card[data-game$="/${gameName}"]`);

  if (gameCard) {
    const titleEl = gameCard.querySelector('.game-title');
    if (titleEl) {
      // Get text without the meta span (year, length)
      const metaSpan = titleEl.querySelector('.game-meta');
      return metaSpan
        ? titleEl.textContent.replace(metaSpan.textContent, '').trim()
        : titleEl.textContent.trim();
    }
  }

  // Fallback: format filename nicely
  return gameName
    .replace(/\.[^.]+$/, '') // Remove extension
    .replace(/([A-Z])/g, ' $1') // Add space before capitals
    .trim()
    .split(/[\s_-]+/) // Split on spaces, underscores, hyphens
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Update current game name display in settings
 * @param {string} gameName - Name of the current game (filename with or without extension)
 */
export function updateCurrentGameDisplay(gameName) {
  const currentGameNameEl = document.getElementById('currentGameName');
  if (currentGameNameEl) {
    currentGameNameEl.textContent = getGameDisplayName(gameName);
  }
}

/**
 * Load pronunciation dictionary into UI
 */
function loadPronunciationUI() {
  const list = dom.pronunciationList || document.getElementById('pronunciationList');
  if (!list) return;

  const map = getPronunciationMap();
  list.innerHTML = '';

  for (const [word, pronunciation] of Object.entries(map)) {
    const item = document.createElement('div');
    item.className = 'pronunciation-item';

    const text = document.createElement('span');
    text.textContent = `${word} → ${pronunciation}`;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete';
    deleteBtn.textContent = '×';
    deleteBtn.title = 'Delete';
    deleteBtn.addEventListener('click', () => {
      removePronunciation(word);
      loadPronunciationUI();
      updateStatus(`Removed pronunciation: ${word}`);
    });

    item.appendChild(text);
    item.appendChild(deleteBtn);
    list.appendChild(item);
  }
}

// Detect iOS device
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// Detect Windows
const isWindows = /Win/.test(navigator.platform);

// iOS preferred voices (starred, shown at top, in order)
// Order: Karen (default), Daniel, Tessa
const IOS_PREFERRED_VOICES = [
  { name: 'Karen', lang: 'en-AU' },
  { name: 'Daniel', lang: 'en-GB' },
  { name: 'Tessa', lang: 'en-ZA' }
];

// Preferred voices in order of preference (researched quality voices)
// Chrome uses Google voices, other browsers use system voices
const VOICE_PREFERENCES = [
  // iOS/macOS preferred voices
  'Karen',
  'Daniel',
  'Tessa',
  // Chrome/Google voices (best quality)
  'Google UK English Male',
  'Google UK English Female',
  'Google US English',
  // Microsoft voices (Windows)
  'Microsoft Hazel - English (United Kingdom)',
  'Microsoft George - English (United Kingdom)',
  'Microsoft Susan - English (United Kingdom)',
  'Microsoft Ryan - English (United Kingdom)',
  'Microsoft Sonia - English (United Kingdom)',
  'Microsoft Zira - English (United States)',
  'Microsoft Mark - English (United States)',
  'Microsoft David - English (United States)',
  // macOS voices
  'Samantha',
  'Alex',
  // Fallbacks
  'English United Kingdom',
  'English United States'
];

/**
 * Get the best available voice from preferences
 * On iOS: Default to Karen (en-AU) for narrator
 * @param {Array} voices - Available voices
 * @returns {SpeechSynthesisVoice|null} Best matching voice or null
 */
export function getDefaultVoice(voices) {
  const englishVoices = voices.filter(v => v.lang.startsWith('en'));

  // On iOS, default to Karen first
  if (isIOS) {
    for (const pref of IOS_PREFERRED_VOICES) {
      const match = englishVoices.find(v =>
        v.name === pref.name ||
        v.name.includes(pref.name)
      );
      if (match) return match;
    }
  }

  // Try each preferred voice in order
  for (const preferred of VOICE_PREFERENCES) {
    const match = englishVoices.find(v =>
      v.name === preferred ||
      v.name.includes(preferred)
    );
    if (match) return match;
  }

  // Fallback: first English voice
  return englishVoices[0] || null;
}

/**
 * Get the best available app voice from preferences
 * On iOS: Default to Daniel (en-GB) for app voice
 * On Windows: Default to Zira (en-US) for app voice
 * @param {Array} voices - Available voices
 * @returns {SpeechSynthesisVoice|null} Best matching voice or null
 */
export function getDefaultAppVoice(voices) {
  const englishVoices = voices.filter(v => v.lang.startsWith('en'));

  // On iOS, prefer Daniel for app voice (different from narrator)
  if (isIOS) {
    // Try Daniel first, then Karen, then Tessa
    const appPreferredOrder = [
      { name: 'Daniel', lang: 'en-GB' },
      { name: 'Karen', lang: 'en-AU' },
      { name: 'Tessa', lang: 'en-ZA' }
    ];

    for (const pref of appPreferredOrder) {
      const match = englishVoices.find(v =>
        v.name === pref.name ||
        v.name.includes(pref.name)
      );
      if (match) return match;
    }
  }

  // On Windows, prefer Zira for app voice
  if (isWindows) {
    const zira = englishVoices.find(v =>
      v.name.includes('Zira') ||
      v.name === 'Microsoft Zira - English (United States)'
    );
    if (zira) return zira;
  }

  // Try each preferred voice in order
  for (const preferred of VOICE_PREFERENCES) {
    const match = englishVoices.find(v =>
      v.name === preferred ||
      v.name.includes(preferred)
    );
    if (match) return match;
  }

  // Fallback: first English voice
  return englishVoices[0] || null;
}

/**
 * Check if a voice is in the iOS preferred list
 * @param {SpeechSynthesisVoice} voice - Voice to check
 * @returns {number} Index in preferred list, or -1 if not preferred
 */
function getIOSPreferredIndex(voice) {
  return IOS_PREFERRED_VOICES.findIndex(pref =>
    voice.name === pref.name ||
    voice.name.includes(pref.name)
  );
}

/**
 * Filter and sort voices
 * - Deduplicate voices (iOS returns duplicates)
 * - Preferred (starred) voices at top, then all other English voices alphabetically
 */
function filterAndSortVoices(voices) {
  // Filter to English voices only
  let filtered = voices.filter(voice => voice.lang.startsWith('en'));

  // Deduplicate by voice name (iOS often returns duplicates)
  const seen = new Set();
  filtered = filtered.filter(voice => {
    if (seen.has(voice.name)) return false;
    seen.add(voice.name);
    return true;
  });

  // Sort: preferred voices first (in order), then all other voices alphabetically
  filtered.sort((a, b) => {
    const aPreferred = getIOSPreferredIndex(a);
    const bPreferred = getIOSPreferredIndex(b);

    // Both preferred: sort by preferred order
    if (aPreferred !== -1 && bPreferred !== -1) {
      return aPreferred - bPreferred;
    }
    // Only a is preferred
    if (aPreferred !== -1) return -1;
    // Only b is preferred
    if (bPreferred !== -1) return 1;

    // Neither preferred: local voices first, then alphabetically
    if (a.localService !== b.localService) {
      return a.localService ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return filtered;
}

/**
 * Get display name for a voice (with star if preferred)
 * @param {SpeechSynthesisVoice} voice - Voice object
 * @returns {string} Display name with optional star
 */
function getVoiceDisplayName(voice) {
  const isPreferred = getIOSPreferredIndex(voice) !== -1;
  const star = isPreferred ? '★ ' : '';
  return `${star}${voice.name} (${voice.lang})`;
}

/**
 * Populate voice dropdown
 */
export function populateVoiceDropdown() {
  const voices = speechSynthesis.getVoices();

  if (voices.length === 0) {
    setTimeout(populateVoiceDropdown, 100);
    return;
  }

  // Filter to English voices only (deduped, sorted, iOS-restricted if on iOS)
  const filteredVoices = filterAndSortVoices(voices);

  // Get default voice for fallback
  const defaultVoice = getDefaultVoice(voices);

  // Populate narrator voice dropdown
  if (dom.voiceSelect) {
    dom.voiceSelect.innerHTML = '';

    // Get saved voice (undefined means use default)
    const savedVoice = state.browserVoiceConfig?.voice;
    const selectedVoice = savedVoice || defaultVoice?.name;

    filteredVoices.forEach((voice) => {
      const option = document.createElement('option');
      option.value = voice.name;
      option.textContent = getVoiceDisplayName(voice);

      if (voice.name === selectedVoice) {
        option.selected = true;
      }

      dom.voiceSelect.appendChild(option);
    });
  }

  // Populate app voice dropdown
  if (dom.appVoiceSelect) {
    dom.appVoiceSelect.innerHTML = '';

    // Get saved voice (undefined means use default app voice)
    const savedAppVoice = state.browserVoiceConfig?.appVoice;
    const defaultAppVoice = getDefaultAppVoice(voices);
    const selectedAppVoice = savedAppVoice || defaultAppVoice?.name;

    filteredVoices.forEach((voice) => {
      const option = document.createElement('option');
      option.value = voice.name;
      option.textContent = getVoiceDisplayName(voice);

      if (voice.name === selectedAppVoice) {
        option.selected = true;
      }

      dom.appVoiceSelect.appendChild(option);
    });
  }
}

/**
 * Load browser voice config from server
 */
export async function loadBrowserVoiceConfig() {
  try {
    const response = await fetch('/api/config');
    const config = await response.json();

    if (config.voice?.tts?.browser) {
      state.browserVoiceConfig = config.voice.tts.browser;
    }
  } catch (error) {
  }

  // Load global voice settings from localStorage
  const savedNarratorVoice = localStorage.getItem('iftalk_narratorVoice');
  if (savedNarratorVoice) {
    if (!state.browserVoiceConfig) state.browserVoiceConfig = {};
    state.browserVoiceConfig.voice = savedNarratorVoice;
  }

  const savedAppVoice = localStorage.getItem('iftalk_appVoice');
  if (savedAppVoice) {
    if (!state.browserVoiceConfig) state.browserVoiceConfig = {};
    state.browserVoiceConfig.appVoice = savedAppVoice;
  }

  // Load global speech rate
  const savedSpeechRate = localStorage.getItem('iftalk_speechRate');
  if (savedSpeechRate) {
    if (!state.browserVoiceConfig) state.browserVoiceConfig = {};
    state.browserVoiceConfig.rate = parseFloat(savedSpeechRate);
  }

  // Load global volume
  const savedVolume = localStorage.getItem('iftalk_masterVolume');
  const volume = savedVolume ? parseInt(savedVolume) / 100 : 1.0;
  if (!state.browserVoiceConfig) state.browserVoiceConfig = {};
  state.browserVoiceConfig.volume = volume;

  // Populate dropdown after loading config
  if ('speechSynthesis' in window) {
    speechSynthesis.onvoiceschanged = populateVoiceDropdown;
    populateVoiceDropdown();
  }
}

/**
 * Reload settings for current game (called when game changes)
 * NOTE: Settings are now global, so this mainly handles UI updates
 */
export function reloadSettingsForGame() {
  // Settings are global now, no need to reload per-game settings

  // Refresh voice dropdowns to show current selection
  populateVoiceDropdown();

  // Inject sync button if on localhost and game is loaded
  injectSyncButton();
}

/**
 * Inject sync from GitHub button (localhost only, when game is loaded)
 */
function injectSyncButton() {
  const container = document.getElementById('devToolsContainer');
  if (!container) return;

  // Remove existing sync button if any (avoid duplicates)
  const existing = container.querySelector('.sync-btn-wrapper');
  if (existing) existing.remove();

  // Only show on localhost when a game is loaded
  if (!isLocalhost() || !state.currentGameName) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'game-actions sync-btn-wrapper';
  wrapper.style.marginBottom = '10px';

  const syncBtn = document.createElement('button');
  syncBtn.className = 'btn btn-secondary btn-full-width';
  syncBtn.innerHTML = '<span class="material-icons">sync</span> Sync from GitHub';

  syncBtn.addEventListener('click', async () => {
    syncBtn.disabled = true;
    syncBtn.textContent = 'Syncing...';
    updateStatus('Syncing from GitHub Pages...');

    try {
      const result = await syncFromRemote();
      updateStatus(`Synced ${result.synced} items from GitHub`);
      alert(`Sync complete!\n\n${result.synced} items updated from GitHub Pages.\n${result.total} total items found.`);
    } catch (error) {
      console.error('[Sync] Failed:', error);
      updateStatus('Sync failed: ' + error.message);
      alert('Sync failed: ' + error.message);
    } finally {
      syncBtn.disabled = false;
      syncBtn.innerHTML = '<span class="material-icons">sync</span> Sync from GitHub';
    }
  });

  wrapper.appendChild(syncBtn);
  container.appendChild(wrapper);
}

/**
 * Initialize voice selection handlers
 */
export function initVoiceSelection() {
  // Narrator voice selection
  if (dom.voiceSelect) {
    dom.voiceSelect.addEventListener('change', (e) => {
      if (!state.browserVoiceConfig) state.browserVoiceConfig = {};
      state.browserVoiceConfig.voice = e.target.value;

      // Save to global localStorage
      localStorage.setItem('iftalk_narratorVoice', e.target.value);
      updateStatus(`✓ Narrator voice: ${e.target.value}`);
    });
  }

  // App voice selection
  if (dom.appVoiceSelect) {
    dom.appVoiceSelect.addEventListener('change', (e) => {
      if (!state.browserVoiceConfig) state.browserVoiceConfig = {};
      state.browserVoiceConfig.appVoice = e.target.value;

      // Save to global localStorage
      localStorage.setItem('iftalk_appVoice', e.target.value);
      updateStatus(`✓ App voice: ${e.target.value}`);
    });
  }

  // Test narrator voice button
  const testVoiceBtn = document.getElementById('testVoiceBtn');
  if (testVoiceBtn) {
    testVoiceBtn.addEventListener('click', () => {
      if (!dom.voiceSelect || !('speechSynthesis' in window)) {
        updateStatus('Voice not available');
        return;
      }

      const testText = 'Hello! This is how I sound. You are standing in a dark room with a mysterious door.';
      const utterance = new SpeechSynthesisUtterance(testText);
      const voices = speechSynthesis.getVoices();
      const voice = voices.find(v => v.name === dom.voiceSelect.value);

      if (voice) utterance.voice = voice;
      utterance.rate = state.browserVoiceConfig?.rate || 1.0;
      utterance.pitch = state.browserVoiceConfig?.pitch || 1.0;

      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);

      updateStatus('Testing voice: ' + dom.voiceSelect.value);
    });
  }

  // Test app voice button
  if (dom.testAppVoiceBtn) {
    dom.testAppVoiceBtn.addEventListener('click', () => {
      if (!dom.appVoiceSelect || !('speechSynthesis' in window)) {
        updateStatus('App voice not available');
        return;
      }

      const testText = 'Hello! This is the app voice. I will use this voice to ask you questions.';
      const utterance = new SpeechSynthesisUtterance(testText);
      const voices = speechSynthesis.getVoices();
      const voice = voices.find(v => v.name === dom.appVoiceSelect.value);

      if (voice) utterance.voice = voice;
      utterance.rate = state.browserVoiceConfig?.rate || 1.0;
      utterance.pitch = state.browserVoiceConfig?.pitch || 1.0;

      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);

      updateStatus('Testing app voice: ' + dom.appVoiceSelect.value);
    });
  }
}

/**
 * Update voice controls visibility
 * @param {boolean} enabled - Whether voice controls should be shown
 */
function updateVoiceControlsVisibility(enabled) {
  const controls = document.getElementById('controls');
  const body = document.body;

  if (controls) {
    if (enabled) {
      controls.classList.remove('hidden');
      body.classList.remove('voice-controls-hidden');
    } else {
      controls.classList.add('hidden');
      body.classList.add('voice-controls-hidden');
    }
  }
}

/**
 * Update Google Drive UI based on sign-in state
 */
function updateGDriveUI() {
  const signInArea = document.getElementById('gdriveSignInArea');
  const accountArea = document.getElementById('gdriveAccountArea');
  const emailSpan = document.getElementById('gdriveEmail');
  const statusSpan = document.getElementById('gdriveSyncStatus');

  if (state.gdriveSignedIn) {
    signInArea?.classList.add('hidden');
    accountArea?.classList.remove('hidden');
    if (emailSpan) emailSpan.textContent = state.gdriveEmail || '';
    if (statusSpan) {
      const lastSync = state.gdriveLastSyncTime
        ? new Date(state.gdriveLastSyncTime).toLocaleString()
        : 'Never';
      statusSpan.textContent = `Last synced: ${lastSync}`;
    }
  } else {
    signInArea?.classList.remove('hidden');
    accountArea?.classList.add('hidden');
  }
}

