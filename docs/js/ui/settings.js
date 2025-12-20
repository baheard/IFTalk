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
import { getGameSetting, setGameSetting, loadGameSettings } from '../utils/game-settings.js';

/**
 * Initialize settings panel
 */
export function initSettings() {
  // Settings button
  if (dom.settingsBtn) {
    dom.settingsBtn.addEventListener('click', () => {
      if (dom.settingsPanel) {
        dom.settingsPanel.classList.toggle('open');
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

  // Clear All Data button
  const clearAllDataBtn = document.getElementById('clearAllDataBtn');
  if (clearAllDataBtn) {
    clearAllDataBtn.addEventListener('click', () => {
      // Show confirmation dialog
      const confirmed = confirm(
        '⚠️ WARNING: This will permanently delete ALL data for ALL games.\n\n' +
        'This includes:\n' +
        '• Quick saves and autosaves\n' +
        '• In-game saves\n' +
        '• All game progress\n' +
        '• Per-game settings (voices, speed)\n\n' +
        'This action cannot be undone!\n\n' +
        'Are you sure you want to continue?'
      );

      if (confirmed) {
        try {
          // Get all localStorage keys
          const keysToRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            // Remove IFTalk saves, autosaves, and Glkote/ZVM saves
            if (key.startsWith('iftalk_quicksave_') ||
                key.startsWith('iftalk_autosave_') ||
                key.startsWith('glkote_quetzal_') ||
                key.startsWith('zvm_autosave_') ||
                key.startsWith('gameSettings_')) {
              keysToRemove.push(key);
            }
          }

          // Remove all save data keys
          keysToRemove.forEach(key => localStorage.removeItem(key));

          // Remove last game tracking so we don't auto-load on refresh
          localStorage.removeItem('iftalk_last_game');
          localStorage.removeItem('iftalk_custom_games');

          // Show success message
          const count = keysToRemove.length + 2; // +2 for last_game and custom_games
          updateStatus(`✓ Cleared all game data`);

          // Close settings panel
          if (dom.settingsPanel) {
            dom.settingsPanel.classList.remove('open');
          }

          // Show alert confirming deletion
          alert(`Successfully deleted all game data.\n\nAll saves, progress, and settings have been cleared.`);

        } catch (error) {
          console.error('[Settings] Failed to clear data:', error);
          updateStatus('Error clearing data');
          alert('Failed to clear save data: ' + error.message);
        }
      } else {
        updateStatus('Clear data cancelled');
      }
    });
  }

  // Speech rate slider
  const speechRateSlider = document.getElementById('speechRate');
  const speechRateValue = document.getElementById('speechRateValue');
  if (speechRateSlider && speechRateValue) {
    // Load saved speech rate for current game
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

      // Save per-game
      setGameSetting('speechRate', rate);
    });
  }
}

/**
 * Update current game name display in settings
 * @param {string} gameName - Name of the current game
 */
export function updateCurrentGameDisplay(gameName) {
  const currentGameNameEl = document.getElementById('currentGameName');
  if (currentGameNameEl) {
    // Format game name nicely: remove extension, PascalCase
    const formattedName = gameName
      .replace(/\.[^.]+$/, '') // Remove extension
      .replace(/([A-Z])/g, ' $1') // Add space before capitals
      .trim()
      .split(/[\s_-]+/) // Split on spaces, underscores, hyphens
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    currentGameNameEl.textContent = formattedName;
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
      setGameSetting('narratorVoice', e.target.value);
      const gameName = state.currentGameName || 'default';
      updateStatus(`Narrator voice: ${e.target.value} (${gameName})`);
    });
  }

  // App voice selection
  if (dom.appVoiceSelect) {
    dom.appVoiceSelect.addEventListener('change', (e) => {
      if (!state.browserVoiceConfig) state.browserVoiceConfig = {};
      state.browserVoiceConfig.appVoice = e.target.value;
      setGameSetting('appVoice', e.target.value);
      const gameName = state.currentGameName || 'default';
      updateStatus(`App voice: ${e.target.value} (${gameName})`);
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
      utterance.rate = state.browserVoiceConfig?.rate || 1.1;
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
      utterance.rate = state.browserVoiceConfig?.rate || 1.1;
      utterance.pitch = state.browserVoiceConfig?.pitch || 1.0;

      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);

      updateStatus('Testing app voice: ' + dom.appVoiceSelect.value);
    });
  }
}
