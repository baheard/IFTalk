/**
 * Save Manager Module
 *
 * Manages quick save/load for browser-based ZVM games.
 * Players can also use in-game SAVE/RESTORE commands.
 */

import { state } from '../core/state.js';
import { updateStatus } from '../utils/status.js';
import { showMessageInput } from '../input/keyboard/index.js';
import { scrollToBottom } from '../utils/scroll.js';
import { addGameText } from '../ui/game-output.js';
import { getItem, setJSON, getJSON, removeItem } from '../utils/storage/storage-api.js';

/**
 * Get current game signature from ZVM
 */
function getGameSignature() {
    if (!window.zvmInstance) return null;
    return window.zvmInstance.get_signature?.() || state.currentGameName || 'unknown';
}

/**
 * Clean HTML for saving - remove system messages, app commands, and low confidence voice commands
 * Keep only: game text and game commands (high confidence)
 * @param {string} html - Raw HTML from lowerWindow
 * @returns {string} Cleaned HTML
 */
function cleanHTMLForSave(html) {
    if (!html || !html.trim()) return '';

    // Create a temporary div to parse and filter HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Remove all elements we don't want to save:
    // 1. System messages (.system-message or .game-text.system-message)
    temp.querySelectorAll('.system-message').forEach(el => el.remove());

    // 2. App commands (.app-command)
    temp.querySelectorAll('.app-command').forEach(el => el.remove());

    // 3. Low confidence voice commands (.low-confidence)
    temp.querySelectorAll('.low-confidence').forEach(el => el.remove());

    // What remains:
    // - .game-text (game responses)
    // - .user-command (game commands, but not app-command or low-confidence)

    return temp.innerHTML;
}

/**
 * Get current display state (HTML from status bar, upper window, lower window)
 * @returns {Object} Object with statusBarHTML, upperWindowHTML, lowerWindowHTML
 */
function getCurrentDisplayState() {
    const statusBarEl = document.getElementById('statusBar');
    const upperWindowEl = document.getElementById('upperWindow');
    const lowerWindowEl = document.getElementById('lowerWindow');

    // Get lowerWindow content excluding command line
    let lowerWindowHTML = '';
    if (lowerWindowEl) {
        const commandLine = document.getElementById('commandLine');
        if (commandLine) {
            // Clone lowerWindow, remove commandLine, get HTML
            const clone = lowerWindowEl.cloneNode(true);
            const commandLineClone = clone.querySelector('#commandLine');
            if (commandLineClone) {
                commandLineClone.remove();
            }
            lowerWindowHTML = clone.innerHTML;
        } else {
            lowerWindowHTML = lowerWindowEl.innerHTML;
        }
    }

    // Clean HTML to remove system messages, app commands, and low confidence voice commands
    lowerWindowHTML = cleanHTMLForSave(lowerWindowHTML);

    return {
        statusBarHTML: statusBarEl?.innerHTML || '',
        upperWindowHTML: upperWindowEl?.innerHTML || '',
        lowerWindowHTML: lowerWindowHTML
    };
}

/**
 * Core save logic used by all save functions
 * @param {string} storageKey - localStorage key for this save
 * @param {string|null} displayName - Name shown in UI (null for autosave)
 * @param {Object} additionalData - Extra data to include in save (e.g., saveName, verification)
 * @returns {boolean} Success/failure
 */
async function performSave(storageKey, displayName = null, additionalData = {}) {
    try {
        const gameSignature = getGameSignature();
        if (!state.currentGameName) {
            if (displayName) updateStatus('Error: No game loaded', 'error');
            return false;
        }

        // Get Quetzal save data from ZVM
        const pc = window.zvmInstance.pc;
        const quetzalData = window.zvmInstance.save_file(pc);

        // Convert to base64 for localStorage
        const base64Data = btoa(String.fromCharCode(...new Uint8Array(quetzalData)));

        // Get current display state (status bar, upper window, lower window)
        const displayHTML = getCurrentDisplayState();

        // Get VoxGlk state
        const { getGeneration, getInputWindowId } = await import('./voxglk.js');
        const savedGeneration = getGeneration();
        const savedInputWindowId = getInputWindowId();

        // Build save data object
        const saveData = {
            timestamp: new Date().toISOString(),
            gameName: state.currentGameName,
            gameSignature: gameSignature,
            quetzalData: base64Data,
            displayHTML: {
                statusBar: displayHTML.statusBarHTML,
                upperWindow: displayHTML.upperWindowHTML,
                lowerWindow: displayHTML.lowerWindowHTML
            },
            voxglkState: {
                generation: savedGeneration,
                inputWindowId: savedInputWindowId
            },
            // Note: narrationState removed - start fresh on each load
            ...additionalData // Merge any additional data (saveName, verification, etc.)
        };

        // Save to localStorage using storage API
        setJSON(storageKey, saveData);

        // Auto-sync to Google Drive (if enabled)
        if (state.gdriveSyncEnabled && state.gdriveSignedIn) {
            try {
                const { scheduleDriveSync, getDeviceInfo } = await import('../utils/gdrive/index.js');
                const enrichedData = { ...saveData, device: getDeviceInfo() };
                scheduleDriveSync(storageKey, enrichedData);
            } catch (error) {
                // Drive sync failed silently
            }
        }

        // Show system message in game area (if displayName provided)
        if (displayName) {
            addGameText(`<div class="system-message">Game saved - ${displayName}</div>`, false);
            updateStatus(`Saved: ${displayName}`, 'success');
        }

        return true;

    } catch (error) {
        if (displayName) {
            updateStatus(`Save failed: ${error.message}`, 'error');
        }
        return false;
    }
}

/**
 * Core restore logic used by all load functions
 * @param {string} storageKey - localStorage key for this save
 * @param {string|null} displayName - Name shown in UI (null for autosave)
 * @param {Object} options - Configuration options
 * @param {boolean} options.showSystemMessage - Show "Game restored" in game area
 * @param {boolean} options.restoreNarrationState - Restore currentChunkIndex
 * @param {string} options.successStatus - Status message on success
 * @param {string} options.errorNotFound - Error message if save not found
 * @returns {boolean} Success/failure
 */
async function performRestore(storageKey, displayName = null, options = {}) {
    try {
        // Read from localStorage using storage API
        const saveData = getJSON(storageKey);

        if (!saveData) {
            if (options.errorNotFound) {
                updateStatus(options.errorNotFound, 'error');
            }
            return false;
        }

        // Decode base64 to binary
        const binaryString = atob(saveData.quetzalData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Restore using ZVM
        const result = window.zvmInstance.restore_file(bytes.buffer);

        if (result === 2) { // ZVM returns 2 on successful restore
            // DON'T restore VoxGlk generation - keep it at 1 (current intro state)
            // After page reload, glkapi.js is at gen:1, so VoxGlk must stay at gen:1
            // The saved generation is just VM memory state, not the UI turn counter
            // voxglk.js will send bootstrap with gen:1 which will be accepted

            // Restore display HTML
            if (saveData.displayHTML) {
                const statusBarEl = document.getElementById('statusBar');
                const upperWindowEl = document.getElementById('upperWindow');
                const lowerWindowEl = document.getElementById('lowerWindow');

                if (statusBarEl && saveData.displayHTML.statusBar) {
                    statusBarEl.innerHTML = saveData.displayHTML.statusBar;
                    statusBarEl.style.display = '';
                }
                if (upperWindowEl) {
                    upperWindowEl.innerHTML = saveData.displayHTML.upperWindow || '';
                    if (saveData.displayHTML.upperWindow && saveData.displayHTML.upperWindow.trim()) {
                        upperWindowEl.style.display = '';
                    } else {
                        upperWindowEl.style.display = 'none';
                    }
                }
                if (lowerWindowEl && saveData.displayHTML.lowerWindow) {
                    const commandLine = document.getElementById('commandLine');
                    lowerWindowEl.innerHTML = saveData.displayHTML.lowerWindow;
                    if (commandLine) {
                        lowerWindowEl.appendChild(commandLine);
                    }
                    // Show command input immediately and scroll to bottom
                    showMessageInput();
                    scrollToBottom();
                }
            }

            // Restore narration position from old saves (backwards compatibility)
            // New saves don't include narrationState, so this will only apply to old saves
            if (options.restoreNarrationState && saveData.narrationState) {
                state.currentChunkIndex = saveData.narrationState.currentChunkIndex || 0;
            }

            // DON'T send bootstrap here - let voxglk.js handle it
            // voxglk.js will check if generation === 1 and send bootstrap
            // Since we didn't call restore_state(), generation is still 1

            // Set flag to position at end of chunks when created (overrides restored position)
            // This ensures we start at the end so user can use back/rewind buttons
            state.skipNarrationAfterLoad = true;

            // Show system message in game area (if requested)
            if (options.showSystemMessage && displayName) {
                addGameText(`<div class="system-message">Game restored - ${displayName}</div>`, false);
            }

            // Update status (if provided)
            if (options.successStatus) {
                updateStatus(options.successStatus, 'success');
            }

            return true;
        } else {
            if (displayName) {
                updateStatus(`Restore failed: Invalid save data`, 'error');
            }
            return false;
        }

    } catch (error) {
        if (displayName) {
            updateStatus(`Restore failed: ${error.message}`, 'error');
        }
        return false;
    }
}

/**
 * Quick save to dedicated quick slot
 * Uses same comprehensive approach as autosave
 */
export async function quickSave() {
    const gameSignature = getGameSignature();
    if (!gameSignature) {
        updateStatus('Error: No game loaded', 'error');
        return false;
    }

    const key = `iftalk_quicksave_${gameSignature}`;
    return await performSave(key, 'quicksave');
}

/**
 * Custom save to named slot (for SAVE meta-command)
 * @param {string} saveName - Name for the save slot
 */
export async function customSave(saveName) {
    if (!state.currentGameName || !saveName) {
        return false;
    }

    const key = `iftalk_customsave_${state.currentGameName}_${saveName}`;
    return await performSave(key, saveName, { saveName: saveName });
}

/**
 * Custom load from named slot (for RESTORE meta-command)
 * @param {string} saveName - Name of the save slot
 */
export async function customLoad(saveName) {
    if (!state.currentGameName || !saveName) {
        return false;
    }

    const key = `iftalk_customsave_${state.currentGameName}_${saveName}`;
    return await performRestore(key, saveName, {
        showSystemMessage: true,
        restoreNarrationState: true
    });
}

/**
 * Auto save (happens automatically every turn)
 */
export async function autoSave() {
    if (!state.currentGameName) {
        return false;
    }

    // Verification data to confirm successful restore
    const verification = {
        pc: window.zvmInstance?.pc || 0,
        stackDepth: window.zvmInstance?.stack?.length || 0,
        callStackDepth: window.zvmInstance?.callstack?.length || 0
    };

    const key = `iftalk_autosave_${state.currentGameName}`;
    return await performSave(key, null, { verification });
}

/**
 * Auto load (happens automatically on game start)
 */
export async function autoLoad() {
    if (!state.currentGameName) {
        return false;
    }

    const key = `iftalk_autosave_${state.currentGameName}`;
    return await performRestore(key, null, {
        successStatus: 'Restored from last session'
    });
}

/**
 * Quick load from dedicated quick slot
 * Uses same bootstrap technique as autoLoad
 */
export async function quickLoad() {
    const gameSignature = getGameSignature();
    if (!gameSignature) {
        updateStatus('Error: No game loaded', 'error');
        return false;
    }

    const key = `iftalk_quicksave_${gameSignature}`;
    return await performRestore(key, 'quicksave', {
        showSystemMessage: true,
        restoreNarrationState: true,
        successStatus: 'Quick loaded',
        errorNotFound: 'No quick save found - Use Quick Save button first'
    });
}

/**
 * Export current quick save to a file on disk
 */
export function exportSaveToFile() {
    try {
        const gameSignature = getGameSignature();
        if (!gameSignature) {
            updateStatus('Error: No game loaded', 'error');
            return;
        }

        // Get the quick save from localStorage
        const key = `iftalk_quicksave_${gameSignature}`;
        const saveData = getJSON(key);

        if (!saveData) {
            updateStatus('No quick save found - Use Quick Save button first', 'error');
            return;
        }

        // Create a blob with the save data
        const blob = new Blob([JSON.stringify(saveData, null, 2)], { type: 'application/json' });

        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const gameName = state.currentGameName || 'game';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        a.download = `${gameName}_${timestamp}.sav`;

        // Trigger download
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        updateStatus('Save exported to file!', 'success');

    } catch (error) {
        updateStatus('Export failed: ' + error.message, 'error');
    }
}

/**
 * Import a save file from disk
 */
export function importSaveFromFile() {
    // Create file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.sav,.json';

    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            // Read file
            const text = await file.text();
            const saveData = JSON.parse(text);

            // Validate save data
            if (!saveData.quetzalData || !saveData.gameSignature) {
                updateStatus('Invalid save file format', 'error');
                return;
            }

            // Store in localStorage as quick save
            const key = `iftalk_quicksave_${saveData.gameSignature}`;
            setJSON(key, saveData);

            updateStatus('Save imported! Use Quick Load button to load', 'success');

        } catch (error) {
            updateStatus('Import failed: ' + error.message, 'error');
        }
    };

    // Trigger file picker
    input.click();
}

// Autosave backup interval (2 minutes)
const BACKUP_INTERVAL_MS = 2 * 60 * 1000;
const MAX_BACKUPS_PER_GAME = 5;
let backupIntervalId = null;

/**
 * Create a timestamped backup of the current autosave
 * @returns {Promise<boolean>} Success/failure
 */
async function createAutosaveBackup() {
    if (!state.currentGameName) {
        return false;
    }

    // Use the new createBackup function with autosave type
    return await createBackup('autosave', false);
}

/**
 * Create a backup of any save type (autosave or quicksave)
 * @param {string} saveType - Type of save ('autosave' or 'quicksave')
 * @param {boolean} exemptFromLimit - If true, this backup won't count toward the max limit
 * @returns {Promise<boolean>} Success/failure
 */
export async function createBackup(saveType, exemptFromLimit = false) {
    if (!state.currentGameName) {
        return false;
    }

    const gameId = state.currentGameName.replace(/\.[^.]+$/, '').toLowerCase();

    // Get current save
    const saveKey = `iftalk_${saveType}_${gameId}`;
    const saveData = getJSON(saveKey);

    if (!saveData) {
        console.log(`[Backup] No ${saveType} found to backup`);
        return false;
    }

    // Create timestamped backup
    const timestamp = Date.now();
    const backupKey = exemptFromLimit
        ? `iftalk_backup_${saveType}_${gameId}_${timestamp}_exempt`
        : `iftalk_backup_${saveType}_${gameId}_${timestamp}`;

    setJSON(backupKey, saveData);
    console.log(`[Backup] Created ${saveType} backup: ${backupKey}`);

    // Clean up old backups (unless this is exempt)
    if (!exemptFromLimit) {
        cleanupOldBackups(gameId, saveType);
    }

    return true;
}

/**
 * Clean up old backups, keeping only the most recent backups per save type
 * @param {string} gameId - Game ID to clean up backups for
 * @param {string} saveType - Save type ('autosave', 'quicksave', 'customsave')
 */
function cleanupOldBackups(gameId, saveType = 'autosave') {
    const prefix = `iftalk_backup_${saveType}_${gameId}_`;

    // Find all backup keys for this game and save type (exclude exempt backups)
    const backupKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix) && !key.endsWith('_exempt')) {
            // Extract timestamp from key
            const parts = key.substring(prefix.length).split('_');
            const timestamp = parseInt(parts[0]);
            backupKeys.push({ key, timestamp });
        }
    }

    // Sort by timestamp (newest first)
    backupKeys.sort((a, b) => b.timestamp - a.timestamp);

    // Different max backups for different save types
    // Autosaves: 5 backups (more frequent, so keep more history)
    // Other types: 2 backups (manual saves, less frequent)
    const maxBackups = saveType === 'autosave' ? 5 : 2;

    if (backupKeys.length > maxBackups) {
        const toRemove = backupKeys.slice(maxBackups);
        toRemove.forEach(({ key }) => {
            removeItem(key);
            console.log(`[Backup] Removed old backup: ${key}`);
        });
    }

    console.log(`[Backup] Keeping ${Math.min(backupKeys.length, maxBackups)} ${saveType} backups for ${gameId}`);
}

/**
 * Start automatic backup timer
 */
export function startAutosaveBackupTimer() {
    // Stop existing timer if any
    stopAutosaveBackupTimer();

    // Create first backup immediately
    createAutosaveBackup();

    // Set up interval for future backups
    backupIntervalId = setInterval(() => {
        createAutosaveBackup();
    }, BACKUP_INTERVAL_MS);

    console.log(`[Backup] Started autosave backup timer (${BACKUP_INTERVAL_MS / 1000}s intervals, max ${MAX_BACKUPS_PER_GAME} backups)`);
}

/**
 * Stop automatic backup timer
 */
export function stopAutosaveBackupTimer() {
    if (backupIntervalId) {
        clearInterval(backupIntervalId);
        backupIntervalId = null;
        console.log('[Backup] Stopped autosave backup timer');
    }
}

/**
 * Initialize save handlers and keyboard shortcuts
 */
export function initSaveHandlers() {

    // Quick Save button (in both toolbar and settings)
    const quickSaveBtn = document.getElementById('quickSaveBtn');
    if (quickSaveBtn) {
        quickSaveBtn.addEventListener('click', () => {
            quickSave();
            // Close settings panel if open
            const settingsPanel = document.getElementById('settingsPanel');
            if (settingsPanel) {
                settingsPanel.classList.remove('open');
            }
        });
    }

    // Quick Restore button (in settings)
    const quickRestoreBtn = document.getElementById('quickRestoreBtn');
    if (quickRestoreBtn) {
        quickRestoreBtn.addEventListener('click', () => {
            // Manual restore requires page reload to reset glkapi.js state
            const gameSignature = getGameSignature();
            if (!gameSignature) {
                updateStatus('Error: No game loaded', 'error');
                return;
            }
            const key = `iftalk_quicksave_${gameSignature}`;
            if (!getItem(key)) {
                updateStatus('No quick save found - Use Quick Save button first', 'error');
                return;
            }
            // Set flag for autorestore to pick up after reload
            sessionStorage.setItem('iftalk_pending_restore', JSON.stringify({
                type: 'quicksave',
                key: gameSignature,
                gameName: gameSignature
            }));
            window.location.reload();
        });
    }

    // Quick Load button (in toolbar)
    const quickLoadBtn = document.getElementById('quickLoadBtn');
    if (quickLoadBtn) {
        quickLoadBtn.addEventListener('click', () => {
            // Manual restore requires page reload to reset glkapi.js state
            const gameSignature = getGameSignature();
            if (!gameSignature) {
                updateStatus('Error: No game loaded', 'error');
                return;
            }
            const key = `iftalk_quicksave_${gameSignature}`;
            if (!getItem(key)) {
                updateStatus('No quick save found - Use Quick Save button first', 'error');
                return;
            }
            // Set flag for autorestore to pick up after reload
            sessionStorage.setItem('iftalk_pending_restore', JSON.stringify({
                type: 'quicksave',
                key: gameSignature,
                gameName: gameSignature
            }));
            window.location.reload();
        });
    }

    // Export Save button (in settings)
    const exportSaveBtn = document.getElementById('exportSaveBtn');
    if (exportSaveBtn) {
        exportSaveBtn.addEventListener('click', exportSaveToFile);
    }

    // Import Save button (in settings)
    const importSaveBtn = document.getElementById('importSaveBtn');
    if (importSaveBtn) {
        importSaveBtn.addEventListener('click', importSaveFromFile);
    }
}
