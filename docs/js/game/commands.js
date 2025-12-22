/**
 * Game Commands Module
 *
 * Handles sending commands to the game using browser-based ZVM.
 */

import { state } from '../core/state.js';
import { dom } from '../core/dom.js';
import { updateStatus } from '../utils/status.js';
import { addToCommandHistory } from '../ui/history.js';
import { addGameText, clearGameOutput } from '../ui/game-output.js';
import { sendCommandToGame } from './game-loader.js';
import { enterSystemEntryMode, exitSystemEntryMode, isSystemEntryMode } from '../input/keyboard.js';
import { getInputType, sendInput, isInputEnabled } from './voxglk.js';
import { isAppCommand } from '../core/app-commands.js';

import { LOW_CONFIDENCE_THRESHOLD } from '../utils/audio-feedback.js';

// Import voice command handlers so typed commands can use them too
let voiceCommandHandlers = null;
async function getVoiceCommandHandlers() {
  if (!voiceCommandHandlers) {
    const appModule = await import('../app.js');
    voiceCommandHandlers = appModule.voiceCommandHandlers;
  }
  return voiceCommandHandlers;
}

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

  // Check for "print [text]" command - special display formatting
  const printMatch = input.match(/^print\s+(.+)$/i);
  if (printMatch) {
    // Display as: >[print] actual command
    // where [print] is in system color
    const actualCommand = printMatch[1];
    const formattedDisplay = `<span style="color: var(--color-app-system)">[print]</span> ${actualCommand}`;

    // Create custom command display
    const div = document.createElement('div');
    div.className = 'user-command';
    if (isVoiceCommand) div.classList.add('voice-command');
    div.innerHTML = `<span class="command-label">&gt;</span><span class="command-text">${formattedDisplay}</span>`;

    if (dom.lowerWindow) {
      const commandLine = document.getElementById('commandLine');
      if (commandLine && commandLine.parentElement === dom.lowerWindow) {
        dom.lowerWindow.insertBefore(div, commandLine);
      } else {
        dom.lowerWindow.appendChild(div);
      }
    }
  } else {
    // Normal command display
    // Always display the command with proper styling (voice/typed, confidence)
    // The game will also echo it, but we'll filter that out of narration
    // Use app-command styling for app/meta-commands or when in system entry mode
    const isAppCmd = isSystemEntryMode() || isAppCommand(input);
    addGameText(input || '[ENTER]', true, isVoiceCommand, isAppCmd, confidence);
  }

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
let awaitingMetaInput = null; // 'save', 'restore', 'delete', 'game-save', 'game-restore', or null
let gameDialogCallback = null; // Callback for in-game save/restore dialogs
let gameDialogRef = null; // File reference for in-game dialogs
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
        type: 'customsave'  // Match the type used in handleRestoreResponse
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
    // Input already displayed by sendCommandDirect with proper styling
    return await handleMetaResponse(originalCmd);
  }

  // Handle "print [text]" command - send literal text to game
  const printMatch = originalCmd.match(/^print\s+(.+)$/i);
  if (printMatch) {
    const actualCommand = printMatch[1];
    sendCommandToGame(actualCommand);
    return true; // Intercepted - don't send the "print" prefix to game
  }

  // Check for meta-commands
  // Note: Commands are already displayed by sendCommandDirect(), so we don't display them again here
  switch (cmd) {
    case 'help':
    case 'commands':
      respondAsGame(`
<div class="system-message">
<b>IFTalk App Commands</b><br>
<br>
These commands work whether typed or spoken:<br>
<br>
<b>Navigation:</b> PAUSE, PLAY, SKIP, BACK, RESTART<br>
<b>Save/Load:</b> SAVE, RESTORE, DELETE SAVE, QUICK SAVE, QUICK LOAD<br>
<b>Audio:</b> MUTE, UNMUTE, STATUS<br>
<b>Game:</b> QUIT - Auto-save and return to game selection<br>
<b>Special:</b> PRINT [text] - Send literal text to game<br>
<br>
For game commands, type anything else.<br>
See Settings panel for more help.
</div>
      `);
      return true;

    case 'save':
      return await handleSaveCommand();

    case 'restore':
    case 'load':
      return await handleRestoreCommand();

    case 'delete save':
    case 'delete':
      return await handleDeleteCommand();

    // Navigation commands - work whether typed or spoken
    case 'restart':
    case 'reset':
    case 'repeat':
      const handlers = await getVoiceCommandHandlers();
      handlers.restart();
      return true;

    case 'back':
      (await getVoiceCommandHandlers()).back();
      return true;

    case 'pause':
    case 'stop':
      (await getVoiceCommandHandlers()).pause();
      return true;

    case 'play':
    case 'resume':
      (await getVoiceCommandHandlers()).play();
      return true;

    case 'skip':
      (await getVoiceCommandHandlers()).skip();
      return true;

    case 'skip all':
    case 'skip to end':
    case 'skip to the end':
    case 'end':
      (await getVoiceCommandHandlers()).skipToEnd();
      return true;

    case 'mute':
      (await getVoiceCommandHandlers()).mute();
      return true;

    case 'unmute':
    case 'on mute':
    case 'un mute':
      (await getVoiceCommandHandlers()).unmute();
      return true;

    case 'status':
      (await getVoiceCommandHandlers()).status();
      return true;

    case 'quick save':
    case 'quicksave':
      (await getVoiceCommandHandlers()).quickSave();
      return true;

    case 'quick load':
    case 'quickload':
    case 'quick restore':
    case 'quickrestore':
      (await getVoiceCommandHandlers()).quickLoad();
      return true;

    case 'load game':
    case 'restore game':
      const h = await getVoiceCommandHandlers();
      if (h.restoreLatest) h.restoreLatest();
      return true;

    case 'quit':
    case 'exit':
      return await handleQuitCommand();

    default:
      // Check for "load slot X" or "restore slot X" pattern
      const slotMatch = cmd.match(/^(?:load|restore)\s+slot\s+(\d+)$/);
      if (slotMatch) {
        const slot = parseInt(slotMatch[1]);
        const h = await getVoiceCommandHandlers();
        if (h.restoreSlot) h.restoreSlot(slot);
        return true;
      }

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
 * Get unified list of all saves (custom + quicksave) for display
 * Sorted by timestamp, newest first
 * Note: Autosave is excluded - it's automatic and managed by the system
 */
function getUnifiedSavesList() {
  const saves = getCustomSaves();
  const quicksave = getQuicksave();

  if (quicksave) {
    saves.push(quicksave);
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
    // User cancelled - exit system entry mode
    exitSystemEntryMode();

    // If this was a game dialog (save/restore from in-game), clear system messages and return null
    if ((mode === 'game-save' || mode === 'game-restore') && gameDialogCallback) {
      // Clear all system messages before showing game's response
      const systemMessages = document.querySelectorAll('.system-message');
      systemMessages.forEach(msg => msg.remove());

      setTimeout(() => {
        gameDialogCallback(null);
        gameDialogCallback = null;
        gameDialogRef = null;
      }, 0);
    } else {
      // For typed commands, show cancellation message
      respondAsGame('<div class="system-message"><i>Cancelled.</i></div>');
    }

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

    case 'game-save':
      return await handleGameSaveResponse(input.trim(), customSaves);

    case 'game-restore':
      return await handleGameRestoreResponse(input.trim(), allSaves);

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

  // Manual restore requires page reload to reset glkapi.js state
  // Set pending restore flag and reload
  if (save.type === 'quicksave') {
    sessionStorage.setItem('iftalk_pending_restore', JSON.stringify({
      type: 'quicksave',
      key: save.gameSignature || window.state.currentGameName,
      gameName: window.state.currentGameName
    }));
  } else if (save.type === 'customsave') {
    sessionStorage.setItem('iftalk_pending_restore', JSON.stringify({
      type: 'customsave',
      key: save.name,  // Just the save name
      gameName: window.state.currentGameName
    }));
  } else {
    // Autosave - shouldn't normally be selected via RESTORE command, but handle it
    sessionStorage.setItem('iftalk_pending_restore', JSON.stringify({
      type: 'autosave',
      key: window.state.currentGameName,
      gameName: window.state.currentGameName
    }));
  }

  // Reload page to trigger autorestore
  window.location.reload();

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
 * Handle QUIT command - auto-save and return to game selection
 */
async function handleQuitCommand() {
  // Auto-save current progress
  const { autoSave } = await import('./save-manager.js');
  await autoSave();

  // Show confirmation message
  respondAsGame('<div class="system-message">Game saved. Returning to game selection...</div>');

  // Return to game selection after brief delay
  setTimeout(() => {
    // Clear last game so it doesn't auto-resume
    localStorage.removeItem('iftalk_last_game');

    // Reload to return to welcome screen
    window.location.reload();
  }, 1000);

  return true;
}

/**
 * Handle game-initiated save dialog (when game asks to save)
 */
async function handleGameSaveResponse(input, saves) {
  // Check if name is valid (no special characters that could break localStorage)
  if (!/^[a-zA-Z0-9_ -]+$/.test(input)) {
    respondAsGame('<div class="system-message">Invalid save name. Use only letters, numbers, spaces, dashes, and underscores.</div>');

    // Re-prompt by re-entering system entry mode
    // IMPORTANT: Restore awaitingMetaInput flag so ESC/Enter cancellation works
    awaitingMetaInput = 'game-save';
    setTimeout(() => {
      enterSystemEntryMode('Enter save name (send nothing to cancel)');
    }, 100);
    return true;
  }

  // Check for reserved names
  const reservedNames = ['quicksave', 'autosave'];
  if (reservedNames.includes(input.toLowerCase())) {
    respondAsGame('<div class="system-message">That name is reserved. Please choose a different name.</div>');

    // Re-prompt
    // IMPORTANT: Restore awaitingMetaInput flag so ESC/Enter cancellation works
    awaitingMetaInput = 'game-save';
    setTimeout(() => {
      enterSystemEntryMode('Enter save name (send nothing to cancel)');
    }, 100);
    return true;
  }

  // Check if this would exceed max saves (and it's a new name)
  const existingSave = saves.find(s => s.name.toLowerCase() === input.toLowerCase());
  if (!existingSave && saves.length >= MAX_SAVES) {
    respondAsGame(`<div class="system-message">Maximum ${MAX_SAVES} saves reached. Please overwrite an existing save or delete one first.</div>`);

    // Re-prompt
    // IMPORTANT: Restore awaitingMetaInput flag so ESC/Enter cancellation works
    awaitingMetaInput = 'game-save';
    setTimeout(() => {
      enterSystemEntryMode('Enter save name (send nothing to cancel)');
    }, 100);
    return true;
  }

  // Set flag so Dialog.file_write() knows to use custom save format
  window._customSaveFilename = input;

  // Return file reference to callback - VM will save through Dialog.file_write()
  if (gameDialogCallback && gameDialogRef) {
    respondAsGame(`<div class="system-message">Saving game as "${input}"...</div>`);

    setTimeout(() => {
      gameDialogCallback(gameDialogRef);
      gameDialogCallback = null;
      gameDialogRef = null;
    }, 0);
  }

  return true;
}

/**
 * Handle game-initiated restore dialog (when game asks to restore)
 */
async function handleGameRestoreResponse(input, saves) {
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

    // Re-prompt by re-entering system entry mode
    // IMPORTANT: Restore awaitingMetaInput flag so ESC/Enter cancellation works
    awaitingMetaInput = 'game-restore';
    setTimeout(() => {
      enterSystemEntryMode('Enter save name to restore (send nothing to cancel)');
    }, 100);
    return true;
  }

  // Only allow restoring custom saves (not quicksave or autosave) for in-game restore
  if (save.type !== 'customsave') {
    respondAsGame('<div class="system-message">Can only restore custom saves from in-game. Use Quick Load button for quicksave.</div>');

    // Re-prompt
    // IMPORTANT: Restore awaitingMetaInput flag so ESC/Enter cancellation works
    awaitingMetaInput = 'game-restore';
    setTimeout(() => {
      enterSystemEntryMode('Enter save name to restore (send nothing to cancel)');
    }, 100);
    return true;
  }

  // Use page reload approach (same as Quick Load and typed RESTORE command)
  // This avoids the crash from calling restore_file() and then returning to dialog callback
  sessionStorage.setItem('iftalk_pending_restore', JSON.stringify({
    type: 'customsave',
    key: save.name,
    gameName: state.currentGameName
  }));

  respondAsGame(`<div class="system-message">Restoring from "${save.name}"...</div>`);

  // Reload page - autorestore will handle the restore during startup
  // Dialog callback will never be called (page is reloading anyway)
  setTimeout(() => {
    window.location.reload();
  }, 500);

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
  if (awaitingMetaInput) {
    const mode = awaitingMetaInput;
    awaitingMetaInput = null;
    exitSystemEntryMode();

    // If this was a game dialog (save/restore from in-game), clear system messages and return null
    if ((mode === 'game-save' || mode === 'game-restore') && gameDialogCallback) {
      // Clear all system messages before showing game's response
      const systemMessages = document.querySelectorAll('.system-message');
      systemMessages.forEach(msg => msg.remove());

      setTimeout(() => {
        gameDialogCallback(null);
        gameDialogCallback = null;
        gameDialogRef = null;
      }, 0);
    } else {
      // For typed commands, show cancellation message
      respondAsGame('<div class="system-message"><i>Cancelled.</i></div>');
    }
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
 * Handles in-game save/restore prompts (like "press r to restore" in Anchorhead)
 */
export function initDialogInterceptor() {
  window.addEventListener('iftalk-dialog-open', (e) => {
    const { tosave, usage, gameid, callback } = e.detail;

    // Check if this is a save/restore request
    if (usage === 'save') {
      if (!tosave) {
        // RESTORE request from game
        const allSaves = getUnifiedSavesList();

        if (allSaves.length === 0) {
          respondAsGame('<div class="system-message">No saved games found. Use SAVE command first.</div>');

          // Return null to indicate no save available
          if (callback) {
            setTimeout(() => {
              callback(null);
            }, 0);
          }
          return;
        }

        // Show restore prompt
        let message = '<div class="system-message"><b>Restore - Choose a file to restore. (# or name)</b><br>';
        message += formatSavesList(allSaves);
        message += '</div>';

        respondAsGame(message);

        // Store callback and file reference
        gameDialogCallback = callback;
        gameDialogRef = Dialog.file_construct_ref('temp', usage, gameid);
        awaitingMetaInput = 'game-restore';

        // Enter system entry mode with prompt
        enterSystemEntryMode('Enter save name to restore (send nothing to cancel)');

      } else {
        // SAVE request from game
        const allSaves = getUnifiedSavesList();

        let message = '<div class="system-message"><b>Save - Enter a file name for your save.</b>';

        if (allSaves.length > 0) {
          message += '<br>Existing saves:<br>';
          message += formatSavesList(allSaves);
        }

        message += '</div>';

        respondAsGame(message);

        // Store callback and file reference
        gameDialogCallback = callback;
        gameDialogRef = Dialog.file_construct_ref('temp', usage, gameid);
        awaitingMetaInput = 'game-save';

        // Enter system entry mode with prompt
        enterSystemEntryMode('Enter save name (send nothing to cancel)');
      }
    } else {
      // Unsupported dialog type - return null
      if (callback) {
        setTimeout(() => {
          callback(null);
        }, 0);
      }
    }
  });
}
