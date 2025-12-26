/**
 * Storage API - Centralized localStorage access layer
 * Provides consistent interface for all localStorage operations
 * Eliminates duplication and improves error handling
 */

import { state } from '../../core/state.js';

/**
 * Get item from localStorage
 * @param {string} key - Storage key
 * @param {*} defaultValue - Default value if key doesn't exist
 * @returns {string|null} Stored value or default
 */
export function getItem(key, defaultValue = null) {
    try {
        const value = localStorage.getItem(key);
        return value !== null ? value : defaultValue;
    } catch (error) {
        return defaultValue;
    }
}

/**
 * Set item in localStorage
 * @param {string} key - Storage key
 * @param {string} value - Value to store
 * @returns {boolean} Success status
 */
export function setItem(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Remove item from localStorage
 * @param {string} key - Storage key
 * @returns {boolean} Success status
 */
export function removeItem(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Check if item exists in localStorage
 * @param {string} key - Storage key
 * @returns {boolean} True if key exists
 */
export function hasItem(key) {
    try {
        return localStorage.getItem(key) !== null;
    } catch (error) {
        return false;
    }
}

/**
 * Get JSON object from localStorage
 * @param {string} key - Storage key
 * @param {*} defaultValue - Default value if key doesn't exist or parsing fails
 * @returns {*} Parsed JSON object or default
 */
export function getJSON(key, defaultValue = null) {
    try {
        const value = localStorage.getItem(key);
        if (value === null) {
            return defaultValue;
        }
        return JSON.parse(value);
    } catch (error) {
        return defaultValue;
    }
}

/**
 * Set JSON object in localStorage
 * @param {string} key - Storage key
 * @param {*} value - Value to store (will be JSON.stringify'd)
 * @returns {boolean} Success status
 */
export function setJSON(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Get all localStorage keys matching a prefix
 * @param {string} prefix - Key prefix to match
 * @returns {string[]} Array of matching keys
 */
export function getItemsByPrefix(prefix) {
    try {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(prefix)) {
                keys.push(key);
            }
        }
        return keys;
    } catch (error) {
        return [];
    }
}

/**
 * Remove all localStorage items matching a prefix
 * @param {string} prefix - Key prefix to match
 * @returns {number} Number of items removed
 */
export function removeItemsByPrefix(prefix) {
    try {
        const keys = getItemsByPrefix(prefix);
        keys.forEach(key => localStorage.removeItem(key));
        return keys.length;
    } catch (error) {
        return 0;
    }
}

/**
 * Get all localStorage keys
 * @returns {string[]} Array of all keys
 */
export function getAllKeys() {
    try {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
                keys.push(key);
            }
        }
        return keys;
    } catch (error) {
        return [];
    }
}

/**
 * Generate game-specific storage key
 * @param {string} type - Type of data (autosave, quicksave, customsave, etc.)
 * @param {string} gameName - Game name (defaults to current game)
 * @returns {string} Full storage key
 */
export function getGameKey(type, gameName = null) {
    const game = gameName || state.currentGameName;
    if (!game) {
        return `iftalk_${type}`;
    }
    return `iftalk_${type}_${game}`;
}

/**
 * Get all keys for a specific game
 * @param {string} gameName - Game name (defaults to current game)
 * @returns {string[]} Array of keys for this game
 */
export function getGameKeys(gameName = null) {
    const game = gameName || state.currentGameName;
    if (!game) {
        return [];
    }
    return getItemsByPrefix(`iftalk_`).filter(key => key.includes(`_${game}`));
}

/**
 * Clear all data for a specific game
 * @param {string} gameName - Game name (defaults to current game)
 * @returns {number} Number of items removed
 */
export function clearGameData(gameName = null) {
    const game = gameName || state.currentGameName;
    if (!game) {
        return 0;
    }

    const keys = getGameKeys(game);
    keys.forEach(key => localStorage.removeItem(key));
    return keys.length;
}

/**
 * Get storage usage info (for debugging)
 * @returns {object} Storage statistics
 */
export function getStorageInfo() {
    try {
        const keys = getAllKeys();
        const iftalkKeys = keys.filter(k => k.startsWith('iftalk_'));

        let totalSize = 0;
        iftalkKeys.forEach(key => {
            const value = localStorage.getItem(key);
            if (value) {
                totalSize += key.length + value.length;
            }
        });

        return {
            totalKeys: keys.length,
            iftalkKeys: iftalkKeys.length,
            estimatedSizeKB: (totalSize / 1024).toFixed(2),
            keys: iftalkKeys
        };
    } catch (error) {
        return { totalKeys: 0, iftalkKeys: 0, estimatedSizeKB: 0, keys: [] };
    }
}
