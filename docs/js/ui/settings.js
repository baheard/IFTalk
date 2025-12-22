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
  getGameSetting, setGameSetting, loadGameSettings,
  getAppDefault, setAppDefault, clearAllGameData, clearAllAppData,
  clearVoiceSettingsFromAllGames
} from '../utils/game-settings.js';
import { isLocalhost, syncFromRemote } from '../utils/storage-sync.js';

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
  const onWelcome = isOnWelcomeScreen();
  const gameName = state.currentGameName;
  const displayName = getGameDisplayName(gameName);

  // Game section header (always "Game" with storage icon)
  const gameHeader = document.getElementById('gameSettingsHeader');
  if (gameHeader) {
    gameHeader.innerHTML = '<span class="material-icons">storage</span> Game';
  }

  // Audio settings header
  const voiceHeader = document.getElementById('voiceSettingsHeader');
  if (voiceHeader) {
    voiceHeader.innerHTML = onWelcome
      ? '<span class="material-icons">volume_up</span> Default Audio'
      : '<span class="material-icons">volume_up</span> Audio';
  }

  // Audio settings description
  const voiceDesc = document.getElementById('voiceSettingsDescription');
  if (voiceDesc) {
    voiceDesc.textContent = onWelcome
      ? 'Set default audio settings for all games'
      : `Audio settings for ${displayName}`;
  }

  // Clear data button text
  const clearBtnText = document.getElementById('clearDataBtnText');
  if (clearBtnText) {
    clearBtnText.textContent = onWelcome
      ? 'Delete All App Data'
      : 'Delete Game Data';
  }

  // Hide "Currently playing" section on welcome screen
  const currentGameDisplay = document.getElementById('currentGameDisplay');
  if (currentGameDisplay) {
    currentGameDisplay.classList.toggle('hidden', onWelcome);
  }

  // Hide entire Game section on welcome screen
  const gameSettingsSection = document.getElementById('gameSettingsSection');
  if (gameSettingsSection) {
    gameSettingsSection.classList.toggle('hidden', onWelcome);
  }

  // Show About section on welcome screen only
  const aboutSection = document.getElementById('aboutSection');
  if (aboutSection) {
    aboutSection.classList.toggle('hidden', !onWelcome);
  }

  // Show standalone delete button on welcome screen only
  const welcomeDangerZone = document.getElementById('welcomeDangerZone');
  if (welcomeDangerZone) {
    welcomeDangerZone.classList.toggle('hidden', !onWelcome);
  }

  // Show "Apply to all games" button on welcome screen only
  const applyVoiceToAllContainer = document.getElementById('applyVoiceToAllContainer');
  if (applyVoiceToAllContainer) {
    applyVoiceToAllContainer.style.display = onWelcome ? 'block' : 'none';
  }

  // Show "Voice Commands" section in-game only (hide on welcome screen)
  const voiceCommandsSection = document.getElementById('voiceCommandsSection');
  if (voiceCommandsSection) {
    voiceCommandsSection.classList.toggle('hidden', onWelcome);
  }

  // Show "Pronunciation" section in-game only (hide on welcome screen)
  const pronunciationSection = document.getElementById('pronunciationSection');
  if (pronunciationSection) {
    pronunciationSection.classList.toggle('hidden', onWelcome);
  }
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
    clearAllDataBtn.addEventListener('click', () => {
      const onWelcome = isOnWelcomeScreen();
      const gameName = state.currentGameName;

      // Different confirmation based on context
      let confirmed;
      if (onWelcome) {
        // Welcome screen: clear ALL app data
        confirmed = confirm(
          '⚠️ WARNING: This will permanently delete ALL data for ALL games.\n\n' +
          'This includes:\n' +
          '• All saves and autosaves\n' +
          '• All game progress\n' +
          '• All settings (voices, speed)\n' +
          '• App defaults\n\n' +
          'This action cannot be undone!\n\n' +
          'Are you sure you want to continue?'
        );
      } else {
        // In-game: clear only this game's data
        const displayName = getGameDisplayName(gameName);
        confirmed = confirm(
          `⚠️ Delete all data for "${displayName}"?\n\n` +
          'This includes:\n' +
          '• Saves and autosave\n' +
          '• Game progress\n' +
          '• Voice/speed settings for this game\n\n' +
          'App defaults and other games will NOT be affected.\n\n' +
          'Are you sure?'
        );
      }

      if (confirmed) {
        try {
          if (onWelcome) {
            // Clear everything
            const count = clearAllAppData();
            updateStatus(`✓ Cleared all app data`);
            alert('Successfully deleted all app data.\n\nAll saves, progress, and settings have been cleared.');
          } else {
            // Clear only current game
            clearAllGameData(gameName);
            updateStatus(`✓ Cleared data for ${gameName}`);
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
    deleteAllAppDataBtn.addEventListener('click', () => {
      const confirmed = confirm(
        '⚠️ WARNING: This will permanently delete ALL data for ALL games.\n\n' +
        'This includes:\n' +
        '• All saves and autosaves\n' +
        '• All game progress\n' +
        '• All settings (voices, speed)\n' +
        '• App defaults\n\n' +
        'This action cannot be undone!\n\n' +
        'Are you sure you want to continue?'
      );

      if (confirmed) {
        try {
          clearAllAppData();
          updateStatus('✓ Cleared all app data');
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
    // Load saved speech rate (uses hierarchy: game -> app defaults -> 1.0)
    const savedRate = getGameSetting('speechRate', 1.0);
    speechRateSlider.value = savedRate;
    speechRateValue.textContent = savedRate.toFixed(1) + 'x';
    if (state.browserVoiceConfig) {
      state.browserVoiceConfig.rate = savedRate;
    }

    speechRateSlider.addEventListener('input', (e) => {
      const rate = parseFloat(e.target.value);
      speechRateValue.textContent = rate.toFixed(1) + 'x';

      // Update voice config
      if (state.browserVoiceConfig) {
        state.browserVoiceConfig.rate = rate;
      }

      // Save to appropriate location based on context
      if (isOnWelcomeScreen()) {
        setAppDefault('speechRate', rate);
        updateStatus(`Default speed: ${rate.toFixed(1)}x`);
      } else {
        setGameSetting('speechRate', rate);
      }
    });
  }

  // "Apply to all games" button (only shown on home screen)
  const applyVoiceToAllContainer = document.getElementById('applyVoiceToAllContainer');
  const applyVoiceToAllBtn = document.getElementById('applyVoiceToAllBtn');

  if (applyVoiceToAllContainer && applyVoiceToAllBtn) {
    // Show button only on welcome screen
    if (isOnWelcomeScreen()) {
      applyVoiceToAllContainer.style.display = 'block';
    }

    applyVoiceToAllBtn.addEventListener('click', () => {
      const confirmed = confirm(
        'Apply voice settings to all games?\n\n' +
        'This will remove any per-game voice overrides, so all games use the current default settings.\n\n' +
        'Individual games can still have custom settings applied later.'
      );

      if (confirmed) {
        const count = clearVoiceSettingsFromAllGames();
        updateStatus(`Voice settings cleared from ${count} game(s)`);
        alert(`Done! Cleared voice overrides from ${count} game(s).\n\nAll games will now use the default voice settings.`);
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
 * On iOS: Default to Karen (en-AU)
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
 * - On iOS: Only show preferred voices (Karen, Daniel, Tessa)
 * - Deduplicate voices (iOS returns duplicates)
 * - Preferred voices at top, rest alphabetically
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

  // On iOS, restrict to only preferred voices
  if (isIOS) {
    filtered = filtered.filter(voice => getIOSPreferredIndex(voice) !== -1);
  }

  // Sort: preferred voices first (in order), then local voices, then alphabetically
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

    // Get saved voice (undefined means use default)
    const savedAppVoice = state.browserVoiceConfig?.appVoice;
    const selectedAppVoice = savedAppVoice || defaultVoice?.name;

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

  // Load per-game voice settings
  const savedNarratorVoice = getGameSetting('narratorVoice');
  if (savedNarratorVoice) {
    if (!state.browserVoiceConfig) state.browserVoiceConfig = {};
    state.browserVoiceConfig.voice = savedNarratorVoice;
  }

  const savedAppVoice = getGameSetting('appVoice');
  if (savedAppVoice) {
    if (!state.browserVoiceConfig) state.browserVoiceConfig = {};
    state.browserVoiceConfig.appVoice = savedAppVoice;
  }

  // Load per-game speech rate
  const savedSpeechRate = getGameSetting('speechRate');
  if (savedSpeechRate) {
    if (!state.browserVoiceConfig) state.browserVoiceConfig = {};
    state.browserVoiceConfig.rate = savedSpeechRate;
  }

  // Load global volume (not per-game)
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
 */
export function reloadSettingsForGame() {

  // Load per-game settings
  const savedNarratorVoice = getGameSetting('narratorVoice');
  const savedAppVoice = getGameSetting('appVoice');
  const savedSpeechRate = getGameSetting('speechRate', 1.0);

  if (!state.browserVoiceConfig) state.browserVoiceConfig = {};

  // Update config with saved settings (or clear if none saved)
  state.browserVoiceConfig.voice = savedNarratorVoice || null;
  state.browserVoiceConfig.appVoice = savedAppVoice || null;
  state.browserVoiceConfig.rate = savedSpeechRate;

  // Update UI elements
  const speechRateSlider = document.getElementById('speechRate');
  const speechRateValue = document.getElementById('speechRateValue');
  if (speechRateSlider && speechRateValue) {
    speechRateSlider.value = savedSpeechRate;
    speechRateValue.textContent = savedSpeechRate.toFixed(1) + 'x';
  }

  // Refresh voice dropdowns to show correct selection
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

      // Save to appropriate location based on context
      if (isOnWelcomeScreen()) {
        setAppDefault('narratorVoice', e.target.value);
        updateStatus(`Default narrator: ${e.target.value}`);
      } else {
        setGameSetting('narratorVoice', e.target.value);
        updateStatus(`Narrator voice: ${e.target.value} (${getGameDisplayName(state.currentGameName)})`);
      }
    });
  }

  // App voice selection
  if (dom.appVoiceSelect) {
    dom.appVoiceSelect.addEventListener('change', (e) => {
      if (!state.browserVoiceConfig) state.browserVoiceConfig = {};
      state.browserVoiceConfig.appVoice = e.target.value;

      // Save to appropriate location based on context
      if (isOnWelcomeScreen()) {
        setAppDefault('appVoice', e.target.value);
        updateStatus(`Default app voice: ${e.target.value}`);
      } else {
        setGameSetting('appVoice', e.target.value);
        updateStatus(`App voice: ${e.target.value} (${getGameDisplayName(state.currentGameName)})`);
      }
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
