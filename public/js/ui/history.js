/**
 * History Module
 *
 * Manages voice and command history displays.
 */

import { state } from '../core/state.js';

/**
 * Add to command history
 * @param {string} original - Original command text
 * @param {string|null} translated - AI translated command (optional)
 * @param {number|null} confidence - AI confidence level (optional)
 */
export function addToCommandHistory(original, translated = null, confidence = null) {
  state.commandHistoryItems.unshift({ original, translated, confidence });
  if (state.commandHistoryItems.length > 20) {
    state.commandHistoryItems.pop();
  }
}

/**
 * Show voice history popup
 */
export function showVoiceHistory() {
  if (state.voiceHistoryItems.length === 0) {
    alert('No voice history yet');
    return;
  }

  const historyText = state.voiceHistoryItems
    .map((item, i) => `${i + 1}. ${item.text} ${item.isNavCommand ? '(nav)' : ''}`)
    .join('\n');

  alert('Voice History:\n\n' + historyText);
}

/**
 * Show command history popup
 */
export function showCommandHistory() {
  if (state.commandHistoryItems.length === 0) {
    alert('No command history yet');
    return;
  }

  const historyText = state.commandHistoryItems
    .map((item, i) => {
      let line = `${i + 1}. ${item.original}`;
      if (item.translated) {
        line += ` → ${item.translated} (${item.confidence}%)`;
      }
      return line;
    })
    .join('\n');

  alert('Command History:\n\n' + historyText);
}

/**
 * Initialize history button handlers
 */
export function initHistoryButtons() {
  const voiceHistoryBtn = document.getElementById('voiceHistoryBtn');
  if (voiceHistoryBtn) {
    voiceHistoryBtn.addEventListener('click', showVoiceHistory);
  }

  const commandHistoryBtn = document.getElementById('commandHistoryBtn');
  if (commandHistoryBtn) {
    commandHistoryBtn.addEventListener('click', showCommandHistory);
  }
}
