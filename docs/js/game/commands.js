/**
 * Game Commands Module
 *
 * Handles sending commands to the game using browser-based ZVM.
 */

import { state } from '../core/state.js';
import { dom } from '../core/dom.js';
import { updateStatus } from '../utils/status.js';
import { addToCommandHistory } from '../ui/history.js';
import { addGameText } from '../ui/game-output.js';
import { sendCommandToGame } from './game-loader.js';
import { enterSystemEntryMode, exitSystemEntryMode } from '../input/keyboard.js';
import { getInputType, sendInput, isInputEnabled } from './voxglk.js';

import { LOW_CONFIDENCE_THRESHOLD } from '../utils/audio-feedback.js';

/**
 * Send command directly to game (no AI translation)
 * @param {string} cmd - Command to send
 * @param {boolean} isVoiceCommand - Whether this is a voice command (optional, auto-detected if not provided)
 * @param {number} confidence - Voice recognition confidence (0.0-1.0), null for keyboard input
 */
export async function sendCommandDirect(cmd, isVoiceCommand = null, confidence = null) {
  const input = cmd !== undefined ? cmd : '';

  // Detect if this is a voice command (not manually typed)
  // Use provided value if given, otherwise auto-detect
  if (isVoiceCommand === null) {
    isVoiceCommand = !state.hasManualTyping;
  }

  // Mark that a command is being processed
  state.pendingCommandProcessed = true;
  state.pausedForSound = false;

  state.hasManualTyping = false;

  updateStatus('Sending...', 'processing');

  // Determine if this is a low confidence command
  const isLowConfidence = confidence !== null && confidence < LOW_CONFIDENCE_THRESHOLD;

  // Add to command history (show [ENTER] for empty commands)
  // History params: original, translated, confidence, isVoiceCommand
  addToCommandHistory(input || '[ENTER]', null, confidence, isVoiceCommand);

  // Always display the command with proper styling (voice/typed, confidence)
  // The game will also echo it, but we'll filter that out of narration
  addGameText(input || '[ENTER]', true, isVoiceCommand, false, confidence);

  // Track for echo detection (so we can skip the game's glk-input echo)
  window.lastCommandWasVoice = isVoiceCommand;
  window.lastCommandConfidence = confidence;

  // Intercept meta-commands before sending to game
  const intercepted = await interceptMetaCommand(input.toLowerCase().trim(), input);
  if (intercepted) {
    // Command was handled by interceptor, don't send to game
    setTimeout(() => {
      updateStatus('Ready');
    }, 100);
    return;
  }

  // Send to ZVM
  sendCommandToGame(input);

  // Reset status after a brief delay
  setTimeout(() => {
    updateStatus('Ready');
  }, 100);
}

// State tracking for interactive meta-commands
let awaitingMetaInput = null; // 'save', 'restore', 'delete', or null
const MAX_SAVES = 5;

/**
 * Get list of custom save games
 */
function getCustomSaves() {
  const saves = [];
  const prefix = `iftalk_customsave_${state.currentGameName}_`;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      const saveName = key.substring(prefix.length);
      const saveData = JSON.parse(localStorage.getItem(key));
      saves.push({
        name: saveName,
        timestamp: saveData.timestamp,
        key: key,
        type: 'custom'
      });
    }
  }

  // Sort by timestamp, newest first
  saves.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return saves;
}

/**
 * Get quicksave info if it exists
 */
function getQuicksave() {
  // Try game signature first (newer saves), then game name (older saves)
  const gameSignature = window.zvmInstance?.get_signature?.() || state.currentGameName;
  let key = `iftalk_quicksave_${gameSignature}`;
  let saved = localStorage.getItem(key);

  // Fallback to game name if signature key doesn't exist
  if (!saved && gameSignature !== state.currentGameName) {
    key = `iftalk_quicksave_${state.currentGameName}`;
    saved = localStorage.getItem(key);
  }

  if (!saved) return null;

  const saveData = JSON.parse(saved);
  return {
    name: 'quicksave',
    timestamp: saveData.timestamp,
    key: key,
    type: 'quicksave'
  };
}

/**
 * Get autosave info if it exists
 */
function getAutosave() {
  const key = `iftalk_autosave_${state.currentGameName}`;
  const saved = localStorage.getItem(key);

  if (!saved) return null;

  const saveData = JSON.parse(saved);
  return {
    name: 'autosave',
    timestamp: saveData.timestamp,
    key: key,
    type: 'autosave'
  };
}


/**
 * Format timestamp for display
 */
function formatTimestamp(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Intercept meta-commands and respond without sending to game
 * @param {string} cmd - Normalized command (lowercase, trimmed)
 * @param {string} displayCmd - Original command for display (optional)
 * @returns {boolean} - True if command was intercepted
 */
async function interceptMetaCommand(cmd, displayCmd = null) {
  const originalCmd = displayCmd || cmd; // Keep original for save names (case-sensitive)
  cmd = cmd.toLowerCase().trim();

  // Handle interactive responses (when awaiting input)
  if (awaitingMetaInput) {
    // Display the response in the transcript
    if (originalCmd && originalCmd.trim()) {
      addGameText(originalCmd.trim(), true);
    }
    return await handleMetaResponse(originalCmd);
  }

  // Check for meta-commands
  switch (cmd) {
    case 'help':
    case 'commands':
      // Display command in transcript
      addGameText(originalCmd, true);
      respondAsGame(`
<div class="system-message">
<b>IFTalk Meta Commands</b><br>
<br>
These commands are handled by IFTalk and won't be sent to the game:<br>
<br>
&nbsp;&nbsp;SAVE - Save game to named slot (max 5)<br>
&nbsp;&nbsp;RESTORE - Restore from saved game<br>
&nbsp;&nbsp;DELETE SAVE - Delete a saved game<br>
<br>
For game commands, type anything else.<br>
See Settings panel for more help.
</div>
      `);
      return true;

    case 'save':
      // Display command in transcript
      addGameText(originalCmd, true);
      return await handleSaveCommand();

    case 'restore':
    case 'load':
      // Display command in transcript
      addGameText(originalCmd, true);
      return await handleRestoreCommand();

    case 'delete save':
    case 'delete':
      // Display command in transcript
      addGameText(originalCmd, true);
      return await handleDeleteCommand();

    default:
      return false; // Not intercepted, send to game normally
  }
}

/**
 * Format save entry for display with number
 * @param {object} save - Save object
 * @param {number} index - 1-based index for numbering
 */
function formatSaveEntry(save, index) {
  return `&nbsp;&nbsp;${index}. ${save.name}<br>`;
}

/**
 * Get unified list of all saves (custom + quicksave + autosave) for display
 * Sorted by timestamp, newest first
 */
function getUnifiedSavesList() {
  const saves = getCustomSaves();
  const quicksave = getQuicksave();
  const autosave = getAutosave();

  if (quicksave) {
    saves.push(quicksave);
  }
  if (autosave) {
    saves.push(autosave);
  }

  // Sort by timestamp, newest first
  saves.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return saves;
}

/**
 * Format the unified saves list with numbers
 */
function formatSavesList(saves) {
  let html = '';
  saves.forEach((save, index) => {
    html += formatSaveEntry(save, index + 1);
  });
  return html;
}

/**
 * Handle SAVE command
 */
async function handleSaveCommand() {
  const allSaves = getUnifiedSavesList();

  let message = '<div class="system-message"><b>Enter a file name for your save.</b>';

  if (allSaves.length > 0) {
    message += '<br>Existing saves:<br>';
    message += formatSavesList(allSaves);
  }

  message += '</div>';

  respondAsGame(message);
  awaitingMetaInput = 'save';

  // Enter system entry mode with prompt
  enterSystemEntryMode('Enter save name (send nothing to cancel)');

  return true;
}

/**
 * Handle RESTORE command (typed by user)
 */
async function handleRestoreCommand() {
  const allSaves = getUnifiedSavesList();

  if (allSaves.length === 0) {
    respondAsGame('<div class="system-message">No saved games found. Use SAVE to create one.</div>');
    return true;
  }

  let message = '<div class="system-message"><b>Choose a file to restore. (# or name)</b><br>';
  message += formatSavesList(allSaves);
  message += '</div>';

  respondAsGame(message);
  awaitingMetaInput = 'restore';

  // Enter system entry mode with prompt
  enterSystemEntryMode('Enter save name to restore (send nothing to cancel)');

  return true;
}

/**
 * Handle DELETE command
 */
async function handleDeleteCommand() {
  const allSaves = getUnifiedSavesList();

  if (allSaves.length === 0) {
    respondAsGame('<div class="system-message">No save games currently exist. Use "Save" to save one.</div>');
    return true;
  }

  let message = '<div class="system-message"><b>Delete which save?</b><br>';
  message += formatSavesList(allSaves);
  message += '<br><i>Note: To delete the autosave and start fresh, use "Restart Game" in Settings.</i>';
  message += '</div>';

  respondAsGame(message);
  awaitingMetaInput = 'delete';

  // Enter system entry mode with prompt
  enterSystemEntryMode('Enter save name to delete (send nothing to cancel)');

  return true;
}

/**
 * Handle user response to meta-command prompts
 */
async function handleMetaResponse(input) {
  const mode = awaitingMetaInput;
  awaitingMetaInput = null; // Reset state

  if (!input || input.trim() === '') {
    // User cancelled - just exit system entry mode
    exitSystemEntryMode();
    respondAsGame('<div class="system-message"><i>Cancelled.</i></div>');
    return true;
  }

  // For non-cancel paths, exit system entry mode now
  exitSystemEntryMode();

  // For save, only count custom saves toward the limit
  const customSaves = getCustomSaves();
  // For restore/delete, use the unified list (same order as displayed)
  const allSaves = getUnifiedSavesList();

  switch (mode) {
    case 'save':
      return await handleSaveResponse(input.trim(), customSaves);

    case 'restore':
      return await handleRestoreResponse(input.trim(), allSaves);

    case 'delete':
      return await handleDeleteResponse(input.trim(), allSaves);

    default:
      return false;
  }
}

/**
 * Handle save name input
 */
async function handleSaveResponse(saveName, saves) {
  // Check if name is valid (no special characters that could break localStorage)
  if (!/^[a-zA-Z0-9_ -]+$/.test(saveName)) {
    respondAsGame('<div class="system-message">Invalid save name. Use only letters, numbers, spaces, dashes, and underscores.</div>');
    return true;
  }

  // Check for reserved names
  const reservedNames = ['quicksave', 'autosave'];
  if (reservedNames.includes(saveName.toLowerCase())) {
    respondAsGame('<div class="system-message">That name is reserved. Please choose a different name.</div>');
    return true;
  }

  // Check if this would exceed max saves (and it's a new name)
  const existingSave = saves.find(s => s.name.toLowerCase() === saveName.toLowerCase());
  if (!existingSave && saves.length >= MAX_SAVES) {
    respondAsGame(`<div class="system-message">You can't have more than ${MAX_SAVES} saves. Override an existing save or use the "Delete Save" command.</div>`);
    return true;
  }

  // Perform the save using our comprehensive save system
  const { customSave } = await import('./save-manager.js');
  const success = await customSave(saveName);

  if (success) {
    respondAsGame(`<div class="system-message">Game saved as "${saveName}".</div>`);
  } else {
    respondAsGame('<div class="system-message">Save failed. Please try again.</div>');
  }

  return true;
}

/**
 * Handle restore selection
 */
async function handleRestoreResponse(input, saves) {
  // Check if input is a number
  const num = parseInt(input);
  let save = null;

  if (!isNaN(num) && num >= 1 && num <= saves.length) {
    save = saves[num - 1];
  } else {
    // Try to find by name (case-insensitive)
    save = saves.find(s => s.name.toLowerCase() === input.toLowerCase());
  }

  if (!save) {
    respondAsGame('<div class="system-message">Save not found. Please try again.</div>');
    return true;
  }

  // Use appropriate load function based on save type
  let success = false;
  const saveManager = await import('./save-manager.js');

  if (save.type === 'quicksave') {
    success = await saveManager.quickLoad();
  } else if (save.type === 'autosave') {
    success = await saveManager.autoLoad();
  } else {
    success = await saveManager.customLoad(save.name);
  }

  if (success) {
    respondAsGame(`<div class="system-message">Game restored from "${save.name}".</div>`);
  } else {
    respondAsGame('<div class="system-message">Restore failed. Save file may be corrupted.</div>');
  }

  return true;
}

/**
 * Handle delete selection
 */
async function handleDeleteResponse(input, saves) {
  // Check if input is a number
  const num = parseInt(input);
  let save = null;

  if (!isNaN(num) && num >= 1 && num <= saves.length) {
    save = saves[num - 1];
  } else {
    // Try to find by name (case-insensitive)
    save = saves.find(s => s.name.toLowerCase() === input.toLowerCase());
  }

  if (!save) {
    respondAsGame('<div class="system-message">Save not found. Please try again.</div>');
    return true;
  }

  // Handle autosave specially - can't delete directly
  if (save.type === 'autosave') {
    respondAsGame('<div class="system-message">The autosave cannot be deleted directly. Use "Restart Game" in Settings to start fresh.</div>');
    return true;
  }

  // Delete the save
  localStorage.removeItem(save.key);
  respondAsGame(`<div class="system-message">Deleted save "${save.name}".</div>`);

  return true;
}

/**
 * Respond as if the game sent output
 * @param {string} html - HTML content to display
 */
function respondAsGame(html) {
  // Add game text with isCommand=false (this is game output, not user command)
  addGameText(html, false);

  // Trigger TTS narration if enabled
  // Extract plain text from HTML for TTS
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  const plainText = tempDiv.textContent.trim();

  if (state.autoplayEnabled && window.handleGameOutput) {
    window.handleGameOutput(plainText);
  }
}

/**
 * Send command (legacy function - no longer used with inline keyboard input)
 */
export async function sendCommand() {
  // This function is kept for compatibility but is no longer used
  // Commands are now sent directly from keyboard.js via sendCommandDirect
  console.warn('[Commands] sendCommand() called but is deprecated - use sendCommandDirect() instead');
}

/**
 * Cancel system entry mode (called when Escape is pressed)
 */
export function cancelMetaInput() {
  console.log('[Commands] cancelMetaInput called, awaitingMetaInput:', awaitingMetaInput);
  if (awaitingMetaInput) {
    awaitingMetaInput = null;
    exitSystemEntryMode();
    respondAsGame('<div class="system-message"><i>Cancelled.</i></div>');
  }
}

/**
 * Wait for game to enable input, then send Enter to continue
 * Polls every 50ms for up to 1 second
 */
function waitForInputAndContinue(attempts = 0) {
  const maxAttempts = 20; // 20 * 50ms = 1 second max wait

  if (attempts >= maxAttempts) {
    console.log('[Commands] Gave up waiting for input after', maxAttempts, 'attempts');
    return;
  }

  const inputReady = isInputEnabled();
  const currentType = getInputType();
  console.log('[Commands] Waiting for input, attempt:', attempts, 'enabled:', inputReady, 'type:', currentType);

  if (inputReady && currentType === 'char') {
    console.log('[Commands] Input ready, sending return char');
    sendInput('return', 'char');
  } else if (!inputReady) {
    // Keep waiting
    setTimeout(() => waitForInputAndContinue(attempts + 1), 50);
  }
  // If inputReady but type is 'line', don't send anything - user can type
}

/**
 * Initialize dialog event listener
 * Always returns null for game's native save/restore dialogs.
 * Users should use typed SAVE and RESTORE commands instead.
 */
export function initDialogInterceptor() {
  window.addEventListener('iftalk-dialog-open', (e) => {
    const { callback } = e.detail;

    // Defer the callback to allow the event loop to complete
    // This matches glkote.js's defer_func() pattern for dialog failures
    if (callback) {
      setTimeout(() => {
        callback(null);
      }, 0);
    }
  });
}
