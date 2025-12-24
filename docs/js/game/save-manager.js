/**
 * Save Manager Module
 *
 * Manages quick save/load for browser-based ZVM games.
 * Players can also use in-game SAVE/RESTORE commands.
 */

import { state } from '../core/state.js';
import { updateStatus } from '../utils/status.js';
import { showMessageInput } from '../input/keyboard.js';
import { scrollToBottom } from '../utils/scroll.js';
import { addGameText } from '../ui/game-output.js';

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
 * Quick save to dedicated quick slot
 * Uses same comprehensive approach as autosave
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

        // Save the current display HTML so we can restore it
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

        // Get VoxGlk state
        const { getGeneration, getInputWindowId } = await import('./voxglk.js');
        const savedGeneration = getGeneration();
        const savedInputWindowId = getInputWindowId();

        // Save with metadata (same structure as autosave)
        const saveData = {
            timestamp: new Date().toISOString(),
            gameName: state.currentGameName || 'unknown',
            gameSignature: gameSignature,
            quetzalData: base64Data,
            displayHTML: {
                statusBar: statusBarEl?.innerHTML || '',
                upperWindow: upperWindowEl?.innerHTML || '',
                lowerWindow: lowerWindowHTML
            },
            voxglkState: {
                generation: savedGeneration,
                inputWindowId: savedInputWindowId
            },
            narrationState: {
                currentChunkIndex: state.currentChunkIndex,
                chunksLength: state.narrationChunks.length
            }
        };

        const key = `iftalk_quicksave_${gameSignature}`;
        localStorage.setItem(key, JSON.stringify(saveData));
// Phase 3: Auto-sync to Google Drive (if enabled)        if (state.gdriveSyncEnabled && state.gdriveSignedIn) {            try {                const { scheduleDriveSync, getDeviceInfo } = await import('../utils/gdrive-sync.js');                const enrichedData = { ...saveData, device: getDeviceInfo() };                scheduleDriveSync(key, enrichedData);            } catch (error) {                // Drive sync failed silently            }        }

        // Show system message in game area
        addGameText('<div class="system-message">Game saved - quicksave</div>', false);

        updateStatus('Quick saved', 'success');
        return true;

    } catch (error) {
        updateStatus('Quick save failed: ' + error.message, 'error');
        return false;
    }
}

/**
 * Custom save to named slot (for SAVE meta-command)
 * @param {string} saveName - Name for the save slot
 */
export async function customSave(saveName) {
    try {
        if (!state.currentGameName) {
            return false;
        }

        // Get Quetzal save data from ZVM
        const pc = window.zvmInstance.pc;
        const quetzalData = window.zvmInstance.save_file(pc);

        // Convert to base64 for localStorage
        const base64Data = btoa(String.fromCharCode(...new Uint8Array(quetzalData)));

        // Save the current display HTML so we can restore it
        const statusBarEl = document.getElementById('statusBar');
        const upperWindowEl = document.getElementById('upperWindow');
        const lowerWindowEl = document.getElementById('lowerWindow');

        // Get lowerWindow content excluding command line
        let lowerWindowHTML = '';
        if (lowerWindowEl) {
            const commandLine = document.getElementById('commandLine');
            if (commandLine) {
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

        // Get VoxGlk state
        const { getGeneration, getInputWindowId } = await import('./voxglk.js');
        const savedGeneration = getGeneration();
        const savedInputWindowId = getInputWindowId();

        // Save with metadata (same structure as quicksave)
        const saveData = {
            timestamp: new Date().toISOString(),
            gameName: state.currentGameName,
            saveName: saveName,
            quetzalData: base64Data,
            displayHTML: {
                statusBar: statusBarEl?.innerHTML || '',
                upperWindow: upperWindowEl?.innerHTML || '',
                lowerWindow: lowerWindowHTML
            },
            voxglkState: {
                generation: savedGeneration,
                inputWindowId: savedInputWindowId
            },
            narrationState: {
                currentChunkIndex: state.currentChunkIndex,
                chunksLength: state.narrationChunks.length
            }
        };

        const key = `iftalk_customsave_${state.currentGameName}_${saveName}`;
        localStorage.setItem(key, JSON.stringify(saveData));
// Phase 3: Auto-sync to Google Drive (if enabled)        if (state.gdriveSyncEnabled && state.gdriveSignedIn) {            try {                const { scheduleDriveSync, getDeviceInfo } = await import('../utils/gdrive-sync.js');                const enrichedData = { ...saveData, device: getDeviceInfo() };                scheduleDriveSync(key, enrichedData);            } catch (error) {                // Drive sync failed silently            }        }

        // Show system message in game area
        addGameText(`<div class="system-message">Game saved - ${saveName}</div>`, false);

        return true;

    } catch (error) {
        return false;
    }
}

/**
 * Custom load from named slot (for RESTORE meta-command)
 * @param {string} saveName - Name of the save slot
 */
export async function customLoad(saveName) {
    try {
        if (!state.currentGameName) {
            return false;
        }

        // Read from localStorage
        const key = `iftalk_customsave_${state.currentGameName}_${saveName}`;
        const saved = localStorage.getItem(key);

        if (!saved) {
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

            // Restore narration state if available
            if (saveData.narrationState) {
                state.currentChunkIndex = saveData.narrationState.currentChunkIndex;
            }

            // DON'T send bootstrap here - let voxglk.js handle it
            // voxglk.js will check if generation === 1 and send bootstrap
            // Since we didn't call restore_state(), generation is still 1

            // Set flag to skip narration - position at end of chunks, not beginning
            state.skipNarrationAfterLoad = true;

            // Show system message in game area
            addGameText(`<div class="system-message">Game restored - ${saveName}</div>`, false);

            return true;
        } else {
            return false;
        }

    } catch (error) {
        return false;
    }
}

/**
 * Auto save (happens automatically every turn)
 */
export async function autoSave() {
    try {
        const gameSignature = getGameSignature();
        if (!state.currentGameName) {
            return false;
        }

        // Get Quetzal save data from ZVM
        const pc = window.zvmInstance.pc;
        const quetzalData = window.zvmInstance.save_file(pc);

        // Convert to base64 for localStorage
        const base64Data = btoa(String.fromCharCode(...new Uint8Array(quetzalData)));

        // Save the current display HTML so we can restore it
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

        // Get VoxGlk state
        const { getGeneration, getInputWindowId } = await import('./voxglk.js');
        const savedGeneration = getGeneration();
        const savedInputWindowId = getInputWindowId();

        // Save with metadata, verification data, and display HTML
        const saveData = {
            timestamp: new Date().toISOString(),
            gameName: state.currentGameName,
            gameSignature: gameSignature,
            quetzalData: base64Data,
            // Verification data to confirm successful restore
            verification: {
                pc: pc,
                stackDepth: window.zvmInstance.stack?.length || 0,
                callStackDepth: window.zvmInstance.callstack?.length || 0
            },
            voxglkState: {
                generation: savedGeneration,
                inputWindowId: savedInputWindowId
            },
            displayHTML: {
                statusBar: statusBarEl?.innerHTML || '',
                upperWindow: upperWindowEl?.innerHTML || '',
                lowerWindow: lowerWindowHTML
            }
        };

        const key = `iftalk_autosave_${state.currentGameName}`;
        localStorage.setItem(key, JSON.stringify(saveData));

        // Phase 3: Auto-sync to Google Drive (if enabled)
        if (state.gdriveSyncEnabled && state.gdriveSignedIn) {
            try {
                const { scheduleDriveSync, getDeviceInfo } = await import('../utils/gdrive-sync.js');
                const enrichedData = { ...saveData, device: getDeviceInfo() };
                scheduleDriveSync(key, enrichedData);
            } catch (error) {
                // Drive sync failed silently
            }
        }

        return true;

    } catch (error) {
        return false;
    }
}

/**
 * Auto load (happens automatically on game start)
 */
export async function autoLoad() {
    try {
        if (!state.currentGameName) {
            return false;
        }

        // Read from localStorage using game name
        const key = `iftalk_autosave_${state.currentGameName}`;
        const saved = localStorage.getItem(key);

        if (!saved) {
            return false;
        }

        const saveData = JSON.parse(saved);

        // Verify game name matches (basic check)
        if (saveData.gameName !== state.currentGameName) {
            return false;
        }

        // Decode base64 to binary
        const binaryString = atob(saveData.quetzalData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Note: We don't need to cancel input requests anymore
        // The auto-keypress approach handles the transition naturally
        // Just restore the VM state and let the keypress clear the intro

        // Restore using ZVM
        const result = window.zvmInstance.restore_file(bytes.buffer);

        if (result === 2) { // ZVM returns 2 on successful restore
            updateStatus('Restored from last session', 'success');

            // DON'T restore VoxGlk generation - keep it at 1 (current intro state)
            // After page reload, glkapi.js is at gen:1, so VoxGlk must stay at gen:1
            // The saved generation is just VM memory state, not the UI turn counter
            // voxglk.js will send bootstrap with gen:1 which will be accepted

            // Restore display HTML so user sees saved content immediately
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
                    // Preserve command line element before restoring
                    const commandLine = document.getElementById('commandLine');

                    // Restore game content
                    lowerWindowEl.innerHTML = saveData.displayHTML.lowerWindow;

                    // Re-append command line
                    if (commandLine) {
                        lowerWindowEl.appendChild(commandLine);
                    }

                    // Show command input immediately and scroll to bottom
                    showMessageInput();
                    scrollToBottom();
                    // Don't auto-focus - let user click or type to focus
                }
            }

            // Set flag to skip narration - position at end of chunks, not beginning
            // User can use back/restart to hear content if desired
            state.skipNarrationAfterLoad = true;

            return true;
        } else {
            return false;
        }

    } catch (error) {
        return false;
    }
}

/**
 * Quick load from dedicated quick slot
 * Uses same bootstrap technique as autoLoad
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
            updateStatus('No quick save found - Use Quick Save button first', 'error');
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
            // DON'T restore VoxGlk generation - keep it at 1 (current intro state)
            // After page reload, glkapi.js is at gen:1, so VoxGlk must stay at gen:1
            // The saved generation is just VM memory state, not the UI turn counter
            // voxglk.js will send bootstrap with gen:1 which will be accepted

            // Restore display HTML so user sees saved content immediately
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
                    // Preserve command line element before restoring
                    const commandLine = document.getElementById('commandLine');

                    // Restore game content
                    lowerWindowEl.innerHTML = saveData.displayHTML.lowerWindow;

                    // Re-append command line
                    if (commandLine) {
                        lowerWindowEl.appendChild(commandLine);
                    }

                    // Show command input immediately and scroll to bottom
                    showMessageInput();
                    scrollToBottom();
                }
            }

            // Restore narration state if available
            if (saveData.narrationState) {
                state.currentChunkIndex = saveData.narrationState.currentChunkIndex;
            }

            // DON'T send bootstrap here - let voxglk.js handle it
            // voxglk.js will check if generation === 1 and send bootstrap
            // Since we didn't call restore_state(), generation is still 1

            // Set flag to skip narration - position at end of chunks, not beginning
            state.skipNarrationAfterLoad = true;

            // Show system message in game area
            addGameText('<div class="system-message">Game restored - quicksave</div>', false);

            updateStatus('Quick loaded', 'success');
            return true;
        } else {
            updateStatus('Quick load failed: Invalid save data', 'error');
            return false;
        }

    } catch (error) {
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
            updateStatus('No quick save found - Use Quick Save button first', 'error');
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
            localStorage.setItem(key, JSON.stringify(saveData));

            updateStatus('Save imported! Use Quick Load button to load', 'success');

        } catch (error) {
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
            if (!localStorage.getItem(key)) {
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
            if (!localStorage.getItem(key)) {
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
