/**
 * Settings Panel Module
 *
 * Manages settings UI, voice selection, and pronunciation dictionary.
 */

import { state } from '../core/state.js';
import { dom } from '../core/dom.js';
import { updateStatus } from '../utils/status.js';
import { getPronunciationMap, savePronunciationMap, addPronunciation, removePronunciation } from '../utils/pronunciation.js';

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
        '⚠️ WARNING: This will permanently delete ALL saved games for ALL interactive fiction games.\n\n' +
        'This includes:\n' +
        '• Quick saves\n' +
        '• In-game saves\n' +
        '• All game progress\n\n' +
        'This action cannot be undone!\n\n' +
        'Are you sure you want to continue?'
      );

      if (confirmed) {
        try {
          // Get all localStorage keys
          const keysToRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            // Remove IFTalk saves and Glkote/ZVM saves
            if (key.startsWith('iftalk_quicksave_') ||
                key.startsWith('glkote_quetzal_') ||
                key.startsWith('zvm_autosave_')) {
              keysToRemove.push(key);
            }
          }

          // Remove all save data keys
          keysToRemove.forEach(key => localStorage.removeItem(key));

          // Show success message
          const count = keysToRemove.length;
          updateStatus(`✓ Cleared ${count} save file${count !== 1 ? 's' : ''}`);

          // Close settings panel
          if (dom.settingsPanel) {
            dom.settingsPanel.classList.remove('open');
          }

          // Show alert confirming deletion
          alert(`Successfully deleted ${count} save file${count !== 1 ? 's' : ''}.\n\nAll game progress has been cleared.`);

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
    // Load saved speech rate
    const savedRate = localStorage.getItem('speechRate');
    if (savedRate) {
      speechRateSlider.value = savedRate;
      speechRateValue.textContent = parseFloat(savedRate).toFixed(1) + 'x';
      if (state.browserVoiceConfig) {
        state.browserVoiceConfig.rate = parseFloat(savedRate);
      }
    }

    speechRateSlider.addEventListener('input', (e) => {
      const rate = parseFloat(e.target.value);
      speechRateValue.textContent = rate.toFixed(1) + 'x';

      // Update voice config
      if (state.browserVoiceConfig) {
        state.browserVoiceConfig.rate = rate;
      }

      // Save to localStorage
      localStorage.setItem('speechRate', rate);
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
    // Format game name nicely (capitalize, remove extension)
    const formattedName = gameName
      .replace(/\.[^.]+$/, '') // Remove extension
      .replace(/([A-Z])/g, ' $1') // Add space before capitals
      .trim();
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

/**
 * Filter and sort voices
 * - Show only English voices
 * - Sort by quality (local/high-quality first) then alphabetically
 */
function filterAndSortVoices(voices) {
  // Filter to English voices only
  const filtered = voices.filter(voice => voice.lang.startsWith('en'));

  // Sort: local voices first, then by name
  filtered.sort((a, b) => {
    // Local voices (high quality) come first
    if (a.localService !== b.localService) {
      return a.localService ? -1 : 1;
    }
    // Then sort alphabetically
    return a.name.localeCompare(b.name);
  });

  console.log('[Settings] Available English voices:');
  filtered.forEach((voice, index) => {
    const quality = voice.localService ? 'HIGH-QUALITY' : 'network';
    console.log(`  ${index + 1}. ${voice.name} (${voice.lang}) [${quality}]`);
  });

  return filtered;
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

  // Filter to English voices only
  const filteredVoices = filterAndSortVoices(voices);

  console.log(`[Settings] Found ${voices.length} total voices, showing ${filteredVoices.length} English voices`);

  // Populate narrator voice dropdown
  if (dom.voiceSelect) {
    dom.voiceSelect.innerHTML = '';

    filteredVoices.forEach((voice) => {
      const option = document.createElement('option');
      option.value = voice.name;
      // Show quality indicator
      const quality = voice.localService ? '⭐ ' : '';
      option.textContent = `${quality}${voice.name} (${voice.lang})`;

      if (voice.name === state.browserVoiceConfig?.voice) {
        option.selected = true;
      }

      dom.voiceSelect.appendChild(option);
    });
  }

  // Populate app voice dropdown
  if (dom.appVoiceSelect) {
    dom.appVoiceSelect.innerHTML = '';

    filteredVoices.forEach((voice) => {
      const option = document.createElement('option');
      option.value = voice.name;
      // Show quality indicator
      const quality = voice.localService ? '⭐ ' : '';
      option.textContent = `${quality}${voice.name} (${voice.lang})`;

      if (voice.name === state.browserVoiceConfig?.appVoice) {
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

  // Load narrator voice from localStorage
  const savedNarratorVoice = localStorage.getItem('narratorVoice');
  if (savedNarratorVoice) {
    if (!state.browserVoiceConfig) state.browserVoiceConfig = {};
    state.browserVoiceConfig.voice = savedNarratorVoice;
  }

  // Load app voice from localStorage
  const savedAppVoice = localStorage.getItem('appVoice');
  if (savedAppVoice) {
    if (!state.browserVoiceConfig) state.browserVoiceConfig = {};
    state.browserVoiceConfig.appVoice = savedAppVoice;
  }

  // Populate dropdown after loading config
  if ('speechSynthesis' in window) {
    speechSynthesis.onvoiceschanged = populateVoiceDropdown;
    populateVoiceDropdown();
  }
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
      localStorage.setItem('narratorVoice', e.target.value);
      updateStatus(`Voice changed to: ${e.target.value}`);
    });
  }

  // App voice selection
  if (dom.appVoiceSelect) {
    dom.appVoiceSelect.addEventListener('change', (e) => {
      if (!state.browserVoiceConfig) state.browserVoiceConfig = {};
      state.browserVoiceConfig.appVoice = e.target.value;
      localStorage.setItem('appVoice', e.target.value);
      updateStatus(`App voice changed to: ${e.target.value}`);
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
