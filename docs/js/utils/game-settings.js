/**
 * Game Settings Module
 *
 * Manages per-game settings with localStorage persistence.
 *
 * Hierarchy:
 * 1. Per-game settings (gameSettings_{name}) - overrides for specific game
 * 2. App defaults (iftalk_app_defaults) - inherited by all games
 * 3. Hardcoded defaults - fallback if nothing else set
 */

import { state } from '../core/state.js';

const APP_DEFAULTS_KEY = 'iftalk_app_defaults';

/**
 * Get localStorage key for current game's settings
 * @returns {string} Storage key (e.g., "gameSettings_LostPig")
 */
function getGameSettingsKey() {
  const gameName = state.currentGameName;
  if (gameName) {
    return `gameSettings_${gameName}`;
  }
  return 'gameSettings_default';
}

// =============================================================================
// APP DEFAULTS (inherited by all games)
// =============================================================================

/**
 * Load app-wide default settings
 * @returns {Object} App defaults object
 */
export function loadAppDefaults() {
  const json = localStorage.getItem(APP_DEFAULTS_KEY);
  if (json) {
    try {
      return JSON.parse(json);
    } catch (error) {
      console.error('[GameSettings] Failed to parse app defaults:', error);
      return {};
    }
  }
  return {};
}

/**
 * Save app-wide default settings
 * @param {Object} defaults - Defaults object to save
 */
export function saveAppDefaults(defaults) {
  localStorage.setItem(APP_DEFAULTS_KEY, JSON.stringify(defaults));
}

/**
 * Get a specific app default value
 * @param {string} settingName - Name of the setting
 * @param {*} hardcodedDefault - Fallback if not in app defaults
 * @returns {*} Setting value
 */
export function getAppDefault(settingName, hardcodedDefault = null) {
  const defaults = loadAppDefaults();
  const value = defaults[settingName];
  return value !== undefined ? value : hardcodedDefault;
}

/**
 * Set a specific app default value
 * @param {string} settingName - Name of the setting
 * @param {*} value - Value to save
 */
export function setAppDefault(settingName, value) {
  const defaults = loadAppDefaults();
  defaults[settingName] = value;
  saveAppDefaults(defaults);
}

/**
 * Clear all app defaults
 */
export function clearAppDefaults() {
  localStorage.removeItem(APP_DEFAULTS_KEY);
}

// =============================================================================
// PER-GAME SETTINGS (overrides for specific game)
// =============================================================================

/**
 * Load all settings for current game
 * @returns {Object} Settings object with all per-game preferences
 */
export function loadGameSettings() {
  const key = getGameSettingsKey();
  const settingsJson = localStorage.getItem(key);

  if (settingsJson) {
    try {
      const settings = JSON.parse(settingsJson);
      return settings;
    } catch (error) {
      console.error(`[GameSettings] Failed to parse settings for ${key}:`, error);
      return {};
    }
  }

  return {};
}

/**
 * Save all settings for current game
 * @param {Object} settings - Settings object to save
 */
export function saveGameSettings(settings) {
  const key = getGameSettingsKey();
  const settingsJson = JSON.stringify(settings);
  localStorage.setItem(key, settingsJson);
}

/**
 * Get a specific setting value for current game
 * Falls back to app defaults, then to hardcoded default
 * @param {string} settingName - Name of the setting (e.g., "narratorVoice")
 * @param {*} hardcodedDefault - Default value if not found anywhere
 * @returns {*} Setting value
 */
export function getGameSetting(settingName, hardcodedDefault = null) {
  // 1. Check per-game override
  const settings = loadGameSettings();
  if (settings[settingName] !== undefined) {
    return settings[settingName];
  }

  // 2. Fall back to app defaults
  const appDefault = getAppDefault(settingName);
  if (appDefault !== null) {
    return appDefault;
  }

  // 3. Fall back to hardcoded default
  return hardcodedDefault;
}

/**
 * Check if current game has an override for a setting
 * @param {string} settingName - Name of the setting
 * @returns {boolean} True if game has its own value
 */
export function hasGameOverride(settingName) {
  const settings = loadGameSettings();
  return settings[settingName] !== undefined;
}

/**
 * Set a specific setting value for current game
 * @param {string} settingName - Name of the setting
 * @param {*} value - Value to save
 */
export function setGameSetting(settingName, value) {
  const settings = loadGameSettings();
  settings[settingName] = value;
  saveGameSettings(settings);
}

/**
 * Get default settings structure
 * @returns {Object} Default settings object
 */
export function getDefaultSettings() {
  return {
    narratorVoice: null,      // Auto-selected based on platform
    appVoice: null,           // Auto-selected based on platform
    speechRate: 1.0,          // 1.0x speed
    autoplay: false,          // Don't auto-play narration
    // Future settings can be added here:
    // highlightColor: null,
    // fontSize: null,
    // etc.
  };
}

/**
 * List all games with saved settings
 * @returns {Array<string>} Array of game names
 */
export function listGamesWithSettings() {
  const games = [];
  const prefix = 'gameSettings_';

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(prefix)) {
      const gameName = key.substring(prefix.length);
      if (gameName !== 'default') {
        games.push(gameName);
      }
    }
  }

  return games;
}

/**
 * Clear settings for current game
 */
export function clearGameSettings() {
  const key = getGameSettingsKey();
  localStorage.removeItem(key);
}

/**
 * Clear settings for all games
 */
export function clearAllGameSettings() {
  const prefix = 'gameSettings_';
  const keysToRemove = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(prefix)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach(key => localStorage.removeItem(key));
}

/**
 * Get all data for a game (settings + save data)
 * @param {string} gameName - Game name (optional, defaults to current game)
 * @returns {Object} Object with settings and saves
 */
export function getGameData(gameName = null) {
  const name = gameName || state.currentGameName || 'default';

  return {
    gameName: name,
    settings: gameName ?
      JSON.parse(localStorage.getItem(`gameSettings_${name}`) || '{}') :
      loadGameSettings(),
    saves: {
      quicksave: localStorage.getItem(`iftalk_quicksave_${name}`),
      glkoteSave: localStorage.getItem(`glkote_quetzal_${name}`)
    }
  };
}

/**
 * Check if a game has any saved data (settings or saves)
 * @param {string} gameName - Game name
 * @returns {Object} Object indicating what data exists
 */
export function hasGameData(gameName) {
  return {
    hasSettings: localStorage.getItem(`gameSettings_${gameName}`) !== null,
    hasQuickSave: localStorage.getItem(`iftalk_quicksave_${gameName}`) !== null,
    hasGlkoteSave: localStorage.getItem(`glkote_quetzal_${gameName}`) !== null
  };
}

/**
 * Clear ALL data for a specific game (settings + saves + autosave)
 * @param {string} gameName - Game name (optional, defaults to current game)
 */
export function clearAllGameData(gameName = null) {
  const name = gameName || state.currentGameName || 'default';

  localStorage.removeItem(`gameSettings_${name}`);
  localStorage.removeItem(`iftalk_quicksave_${name}`);
  localStorage.removeItem(`iftalk_autosave_${name}`);
  localStorage.removeItem(`glkote_quetzal_${name}`);
  localStorage.removeItem(`zvm_autosave_${name}`);
}

/**
 * Clear ALL app data (all games + app defaults)
 * Used by "Delete All Data" on welcome screen
 */
export function clearAllAppData() {
  const keysToRemove = [];

  // Find all IFTalk-related keys
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('iftalk_') ||
        key.startsWith('gameSettings_') ||
        key.startsWith('glkote_quetzal_') ||
        key.startsWith('zvm_autosave_')) {
      keysToRemove.push(key);
    }
  }

  // Remove all found keys
  keysToRemove.forEach(key => localStorage.removeItem(key));

  return keysToRemove.length;
}

/**
 * List all games with any data (settings or saves)
 * @returns {Array<Object>} Array of game objects with data info
 */
export function listAllGames() {
  const games = new Map();

  // Scan all localStorage keys
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);

    // Check for game settings
    if (key.startsWith('gameSettings_')) {
      const gameName = key.substring('gameSettings_'.length);
      if (gameName !== 'default') {
        if (!games.has(gameName)) {
          games.set(gameName, { gameName, hasSettings: false, hasQuickSave: false, hasGlkoteSave: false });
        }
        games.get(gameName).hasSettings = true;
      }
    }

    // Check for quick saves
    if (key.startsWith('iftalk_quicksave_')) {
      const gameName = key.substring('iftalk_quicksave_'.length);
      if (!games.has(gameName)) {
        games.set(gameName, { gameName, hasSettings: false, hasQuickSave: false, hasGlkoteSave: false });
      }
      games.get(gameName).hasQuickSave = true;
    }

    // Check for glkote saves
    if (key.startsWith('glkote_quetzal_')) {
      const gameName = key.substring('glkote_quetzal_'.length);
      if (!games.has(gameName)) {
        games.set(gameName, { gameName, hasSettings: false, hasQuickSave: false, hasGlkoteSave: false });
      }
      games.get(gameName).hasGlkoteSave = true;
    }
  }

  return Array.from(games.values()).sort((a, b) => a.gameName.localeCompare(b.gameName));
}
