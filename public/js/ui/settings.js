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
 * Populate voice dropdown
 */
export function populateVoiceDropdown() {
  const voices = speechSynthesis.getVoices();

  if (voices.length === 0) {
    setTimeout(populateVoiceDropdown, 100);
    return;
  }

  // Populate narrator voice dropdown
  if (dom.voiceSelect) {
    dom.voiceSelect.innerHTML = '';
    voices.forEach((voice) => {
      const option = document.createElement('option');
      option.value = voice.name;
      option.textContent = `${voice.name} (${voice.lang})`;

      if (voice.name === state.browserVoiceConfig?.voice) {
        option.selected = true;
      }

      dom.voiceSelect.appendChild(option);
    });
  }

  // Populate app voice dropdown
  if (dom.appVoiceSelect) {
    dom.appVoiceSelect.innerHTML = '';
    voices.forEach((voice) => {
      const option = document.createElement('option');
      option.value = voice.name;
      option.textContent = `${voice.name} (${voice.lang})`;

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
