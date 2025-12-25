/**
 * Settings Panel Module
 *
 * Manages settings panel visibility, context updates, and various settings controls.
 */

import { state } from '../../core/state.js';
import { dom } from '../../core/dom.js';
import { updateStatus } from '../../utils/status.js';
import { isLocalhost, syncFromRemote } from '../../utils/storage-sync.js';

/**
 * Check if we're on the welcome screen (no game loaded)
 * @returns {boolean} True if on welcome screen
 */
export function isOnWelcomeScreen() {
  return !state.currentGameName;
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
 * Reload settings for current game (called when game changes)
 * NOTE: Settings are now global, so this mainly handles UI updates
 */
export async function reloadSettingsForGame() {
  // Settings are global now, no need to reload per-game settings

  // Refresh voice dropdowns to show current selection
  const { populateVoiceDropdown } = await import('./voice-selection.js');
  populateVoiceDropdown();

  // Inject sync button if on localhost and game is loaded
  injectSyncButton();
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
        const { getHint } = await import('../../features/hints.js');
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

  // Home button (return to game selection)
  const selectGameBtn = document.getElementById('selectGameBtn');
  if (selectGameBtn) {
    selectGameBtn.addEventListener('click', async () => {
      // Import and call unload function
      const { unloadGame } = await import('../../game/game-loader.js');
      unloadGame();
      // Close settings panel
      if (dom.settingsPanel) {
        dom.settingsPanel.classList.remove('open');
      }
    });
  }
}
