/**
 * Pronunciation UI Module
 *
 * Handles pronunciation dictionary UI (add/remove entries).
 */

import { dom } from '../../core/dom.js';
import { updateStatus } from '../../utils/status.js';
import { getPronunciationMap, addPronunciation, removePronunciation } from '../../utils/pronunciation.js';

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
 * Initialize pronunciation UI
 */
export function initPronunciationUI() {
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
}
