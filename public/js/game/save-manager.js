/**
 * Save Manager Module
 *
 * Manages quick save/load for browser-based ZVM games.
 * Players can also use in-game SAVE/RESTORE commands.
 */

import { state } from '../core/state.js';
import { updateStatus } from '../utils/status.js';

/**
 * Get current game signature from ZVM
 */
function getGameSignature() {
    if (!window.zvmInstance) return null;
    return window.zvmInstance.get_signature?.() || state.currentGameName || 'unknown';
}

/**
 * Quick save to dedicated quick slot
 */
export async function quickSave() {
    try {
        const gameSignature = getGameSignature();
        if (!gameSignature) {
            updateStatus('Error: No game loaded', 'error');
            return false;
        }

        // Get Quetzal save data from ZVM
        const pc = window.zvmInstance.pc;
        const quetzalData = window.zvmInstance.save_file(pc);

        // Convert to base64 for localStorage
        const base64Data = btoa(String.fromCharCode(...new Uint8Array(quetzalData)));

        // Save with metadata
        const saveData = {
            timestamp: new Date().toISOString(),
            gameName: state.currentGameName || 'unknown',
            gameSignature: gameSignature,
            quetzalData: base64Data
        };

        const key = `iftalk_quicksave_${gameSignature}`;
        localStorage.setItem(key, JSON.stringify(saveData));

        updateStatus('Quick saved', 'success');
        console.log('[SaveManager] Quick saved to', key);

        return true;

    } catch (error) {
        console.error('[SaveManager] Quick save error:', error);
        updateStatus('Quick save failed: ' + error.message, 'error');
        return false;
    }
}

/**
 * Auto save (happens automatically every turn)
 */
export async function autoSave() {
    try {
        const gameSignature = getGameSignature();
        if (!gameSignature) {
            return false;
        }

        // Get Quetzal save data from ZVM
        const pc = window.zvmInstance.pc;
        const quetzalData = window.zvmInstance.save_file(pc);

        // Convert to base64 for localStorage
        const base64Data = btoa(String.fromCharCode(...new Uint8Array(quetzalData)));

        // Save with metadata
        const saveData = {
            timestamp: new Date().toISOString(),
            gameName: state.currentGameName || 'unknown',
            gameSignature: gameSignature,
            quetzalData: base64Data
        };

        const key = `iftalk_autosave_${gameSignature}`;
        localStorage.setItem(key, JSON.stringify(saveData));

        console.log('[SaveManager] Auto saved to', key);
        return true;

    } catch (error) {
        console.error('[SaveManager] Auto save error:', error);
        return false;
    }
}

/**
 * Auto load (happens automatically on game start)
 */
export async function autoLoad() {
    try {
        const gameSignature = getGameSignature();
        if (!gameSignature) {
            return false;
        }

        // Read from localStorage
        const key = `iftalk_autosave_${gameSignature}`;
        const saved = localStorage.getItem(key);

        if (!saved) {
            console.log('[SaveManager] No autosave found');
            return false;
        }

        const saveData = JSON.parse(saved);

        // Decode base64 to binary
        const binaryString = atob(saveData.quetzalData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Cancel any pending input requests before restoring
        // This prevents "window already has keyboard request" error
        console.log('[SaveManager] Attempting to cancel pending input requests');
        try {
            // Iterate through all Glk windows and cancel any active input
            if (window.Glk && window.Glk.windows) {
                for (let win of window.Glk.windows.values()) {
                    if (win && win.type !== 'graphics') {
                        if (win.char_request) {
                            console.log('[SaveManager] Canceling char input on window', win.id);
                            window.Glk.glk_cancel_char_event(win);
                        }
                        if (win.line_request) {
                            console.log('[SaveManager] Canceling line input on window', win.id);
                            window.Glk.glk_cancel_line_event(win, null);
                        }
                    }
                }
            }
        } catch (e) {
            console.error('[SaveManager] Input cancellation error:', e);
        }

        // Restore using ZVM
        const result = window.zvmInstance.restore_file(bytes.buffer);

        if (result === 2) { // ZVM returns 2 on successful restore
            console.log('[SaveManager] Auto loaded from', key);
            updateStatus('Restored from last session', 'success');

            // Don't call run() - restore already handles continuing the game
            // Calling run() triggers another update which would autosave over what we just loaded

            return true;
        } else {
            console.log('[SaveManager] Auto load failed: Invalid save data');
            return false;
        }

    } catch (error) {
        console.error('[SaveManager] Auto load error:', error);
        return false;
    }
}

/**
 * Quick load from dedicated quick slot
 */
export async function quickLoad() {
    try {
        const gameSignature = getGameSignature();
        if (!gameSignature) {
            updateStatus('Error: No game loaded', 'error');
            return false;
        }

        // Read from localStorage
        const key = `iftalk_quicksave_${gameSignature}`;
        const saved = localStorage.getItem(key);

        if (!saved) {
            updateStatus('No quick save found', 'error');
            return false;
        }

        const saveData = JSON.parse(saved);

        // Decode base64 to binary
        const binaryString = atob(saveData.quetzalData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Restore using ZVM
        const result = window.zvmInstance.restore_file(bytes.buffer);

        if (result === 2) { // ZVM returns 2 on successful restore
            updateStatus('Quick loaded', 'success');
            console.log('[SaveManager] Quick loaded from', key);

            // Trigger UI refresh
            window.zvmInstance.run();

            return true;
        } else {
            updateStatus('Quick load failed: Invalid save data', 'error');
            return false;
        }

    } catch (error) {
        console.error('[SaveManager] Quick load error:', error);
        updateStatus('Quick load failed: ' + error.message, 'error');
        return false;
    }
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
        const saved = localStorage.getItem(key);

        if (!saved) {
            updateStatus('No quick save found - Press F5 to save first', 'error');
            return;
        }

        const saveData = JSON.parse(saved);

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
        console.log('[SaveManager] Save exported to file');

    } catch (error) {
        console.error('[SaveManager] Export error:', error);
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
            localStorage.setItem(key, JSON.stringify(saveData));

            updateStatus('Save imported! Press F9 to load', 'success');
            console.log('[SaveManager] Save imported from file');

        } catch (error) {
            console.error('[SaveManager] Import error:', error);
            updateStatus('Import failed: ' + error.message, 'error');
        }
    };

    // Trigger file picker
    input.click();
}

/**
 * Initialize save handlers and keyboard shortcuts
 */
export function initSaveHandlers() {
    console.log('[SaveManager] Quick save/load initialized');

    // F5 - Quick Save
    document.addEventListener('keydown', (e) => {
        if (e.key === 'F5') {
            e.preventDefault();
            quickSave();
        }
    });

    // F9 - Quick Load
    document.addEventListener('keydown', (e) => {
        if (e.key === 'F9') {
            e.preventDefault();
            quickLoad();
        }
    });

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
            quickLoad();
            // Close settings panel if open
            const settingsPanel = document.getElementById('settingsPanel');
            if (settingsPanel) {
                settingsPanel.classList.remove('open');
            }
        });
    }

    // Quick Load button (in toolbar)
    const quickLoadBtn = document.getElementById('quickLoadBtn');
    if (quickLoadBtn) {
        quickLoadBtn.addEventListener('click', quickLoad);
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
