/**
 * Save Manager Module
 *
 * Manages quick save/load for browser-based ZVM games.
 * Players can also use in-game SAVE/RESTORE commands.
 */

import { state } from '../core/state.js';
import { updateStatus } from '../utils/status.js';
import { showMessageInput } from '../input/keyboard.js';

/**
 * Scroll to bottom immediately
 * @param {HTMLElement} element - Element to scroll
 */
function scrollToBottom(element) {
    if (!element) return;
    element.scrollTop = element.scrollHeight;
}

/**
 * Scroll to bottom (no waiting)
 * @param {HTMLElement} element - Element to scroll
 */
function scrollAfterFade(element) {
    scrollToBottom(element);
}

/**
 * Get current game signature from ZVM
 */
function getGameSignature() {
    if (!window.zvmInstance) return null;
    return window.zvmInstance.get_signature?.() || state.currentGameName || 'unknown';
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

        updateStatus('Quick saved', 'success');
        return true;

    } catch (error) {
        console.error('[SaveManager] Quick save error:', error);
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
            console.error('[SaveManager] No game loaded');
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

        return true;

    } catch (error) {
        console.error('[SaveManager] Custom save error:', error);
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
            console.error('[SaveManager] No game loaded');
            return false;
        }

        // Read from localStorage
        const key = `iftalk_customsave_${state.currentGameName}_${saveName}`;
        const saved = localStorage.getItem(key);

        if (!saved) {
            console.error('[SaveManager] Custom save not found:', saveName);
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
            // Restore VoxGlk state (generation, inputWindowId)
            if (saveData.voxglkState && window._voxglkInstance) {
                window._voxglkInstance.restore_state(
                    saveData.voxglkState.generation,
                    saveData.voxglkState.inputWindowId
                );
            }

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
                    scrollToBottom(document.getElementById('gameOutput'));
                }
            }

            // Restore narration state if available
            if (saveData.narrationState) {
                state.currentChunkIndex = saveData.narrationState.currentChunkIndex;
            }

            // Send bootstrap input to wake VM
            const { getAcceptCallback, setSkipNextUpdateAfterBootstrap } = await import('./voxglk.js');
            const acceptCallback = getAcceptCallback();

            if (acceptCallback) {
                setSkipNextUpdateAfterBootstrap(true);

                setTimeout(() => {
                    acceptCallback({
                        type: 'char',
                        gen: 1,
                        window: 1,
                        value: 10
                    });
                }, 100);
            }

            return true;
        } else {
            console.error('[SaveManager] Custom load failed: Invalid save data');
            return false;
        }

    } catch (error) {
        console.error('[SaveManager] Custom load error:', error);
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
            console.warn('[SaveManager] Save file game name mismatch');
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

            // Restore VoxGlk state (generation, inputWindowId)
            if (saveData.voxglkState && window._voxglkInstance) {
                window._voxglkInstance.restore_state(
                    saveData.voxglkState.generation,
                    saveData.voxglkState.inputWindowId
                );
            }

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

                    // Show command input immediately, wait for fade, then scroll and focus
                    showMessageInput();
                    scrollAfterFade(document.getElementById('gameOutput'));
                    const messageInput = document.getElementById('messageInput');
                    if (messageInput) {
                        messageInput.focus();
                    }
                }
            }

            return true;
        } else {
            return false;
        }

    } catch (error) {
        console.error('[SaveManager] Auto load error:', error);
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
            // Restore VoxGlk state (generation, inputWindowId)
            if (saveData.voxglkState && window._voxglkInstance) {
                window._voxglkInstance.restore_state(
                    saveData.voxglkState.generation,
                    saveData.voxglkState.inputWindowId
                );
            }

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
                    scrollToBottom(document.getElementById('gameOutput'));
                }
            }

            // Restore narration state if available
            if (saveData.narrationState) {
                state.currentChunkIndex = saveData.narrationState.currentChunkIndex;
            }

            // Import voxglk to send bootstrap input and get acceptCallback
            const { getAcceptCallback, setSkipNextUpdateAfterBootstrap } = await import('./voxglk.js');
            const acceptCallback = getAcceptCallback();

            if (acceptCallback) {
                // Set flag to suppress next update (the response to bootstrap input)
                setSkipNextUpdateAfterBootstrap(true);

                // Send bootstrap char input to wake VM (same as autoload)
                setTimeout(() => {
                    acceptCallback({
                        type: 'char',
                        gen: 1,  // Always use intro's generation
                        window: 1,
                        value: 10  // Enter key
                    });
                }, 100);
            }

            updateStatus('Quick loaded', 'success');
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

            updateStatus('Save imported! Use Quick Load button to load', 'success');

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
