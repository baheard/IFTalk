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

/**
 * Send command directly to game (no AI translation)
 * @param {string} cmd - Command to send
 * @param {boolean} isVoiceCommand - Whether this is a voice command (optional, auto-detected if not provided)
 */
export async function sendCommandDirect(cmd, isVoiceCommand = null) {
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

  // Add to command history (show [ENTER] for empty commands)
  addToCommandHistory(input || '[ENTER]', null, null, isVoiceCommand);

  // For empty commands, display a visual prompt in game output
  // (Non-empty commands are echoed by the game itself)
  if (input === '') {
    addGameText('[ENTER]', true, isVoiceCommand);
  }

  // Track for echo detection
  window.lastCommandWasVoice = isVoiceCommand;

  // Intercept meta-commands before sending to game
  const intercepted = await interceptMetaCommand(input.toLowerCase().trim());
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
        key: key
      });
    }
  }

  // Sort by timestamp, newest first
  saves.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return saves;
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
 * @returns {boolean} - True if command was intercepted
 */
async function interceptMetaCommand(cmd) {
  const originalCmd = cmd; // Keep original for save names (case-sensitive)
  cmd = cmd.toLowerCase().trim();

  // Handle interactive responses (when awaiting input)
  if (awaitingMetaInput) {
    return await handleMetaResponse(originalCmd);
  }

  // Check for meta-commands
  switch (cmd) {
    case 'help':
    case 'commands':
      respondAsGame(`
<div class="normal">
<b>IFTalk Meta Commands</b>

These commands are handled by IFTalk and won't be sent to the game:

  <span style="color: var(--accent-primary)">SAVE</span> - Save game to named slot (max 5)
  <span style="color: var(--accent-primary)">RESTORE</span> - Restore from saved game
  <span style="color: var(--accent-primary)">DELETE SAVE</span> - Delete a saved game

For game commands, type anything else.
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

    default:
      return false; // Not intercepted, send to game normally
  }
}

/**
 * Handle SAVE command
 */
async function handleSaveCommand() {
  const saves = getCustomSaves();

  let message = '<div class="normal"><b>Enter a file name for your save:</b>\n\n';

  if (saves.length > 0) {
    message += 'Existing saves:\n';
    saves.forEach((save, i) => {
      message += `  ${i + 1}. <span style="color: var(--accent-primary)">${save.name}</span> - ${formatTimestamp(save.timestamp)}\n`;
    });
  } else {
    message += '<i>No existing saves</i>\n';
  }

  message += '\nType a name for your save.</div>';

  respondAsGame(message);
  awaitingMetaInput = 'save';
  return true;
}

/**
 * Handle RESTORE command
 */
async function handleRestoreCommand() {
  const saves = getCustomSaves();

  if (saves.length === 0) {
    respondAsGame('<div class="normal">No custom save games currently exist. Use "Save" to save one.</div>');
    return true;
  }

  let message = '<div class="normal"><b>Choose a file to restore:</b>\n\n';
  saves.forEach((save, i) => {
    message += `  ${i + 1}. <span style="color: var(--accent-primary)">${save.name}</span> - ${formatTimestamp(save.timestamp)}\n`;
  });
  message += '\nType the save name or number.</div>';

  respondAsGame(message);
  awaitingMetaInput = 'restore';
  return true;
}

/**
 * Handle DELETE SAVE command
 */
async function handleDeleteCommand() {
  const saves = getCustomSaves();

  if (saves.length === 0) {
    respondAsGame('<div class="normal">No custom save games currently exist. Use "Save" to save one.</div>');
    return true;
  }

  let message = '<div class="normal"><b>Delete which save?</b>\n\n';
  saves.forEach((save, i) => {
    message += `  ${i + 1}. <span style="color: var(--accent-primary)">${save.name}</span> - ${formatTimestamp(save.timestamp)}\n`;
  });
  message += '\nType the save name or number to delete.</div>';

  respondAsGame(message);
  awaitingMetaInput = 'delete';
  return true;
}

/**
 * Handle user response to meta-command prompts
 */
async function handleMetaResponse(input) {
  const mode = awaitingMetaInput;
  awaitingMetaInput = null; // Reset state

  if (!input || input.trim() === '') {
    respondAsGame('<div class="normal"><i>Cancelled.</i></div>');
    return true;
  }

  const saves = getCustomSaves();

  switch (mode) {
    case 'save':
      return await handleSaveResponse(input.trim(), saves);

    case 'restore':
      return await handleRestoreResponse(input.trim(), saves);

    case 'delete':
      return await handleDeleteResponse(input.trim(), saves);

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
    respondAsGame('<div class="normal">Invalid save name. Use only letters, numbers, spaces, dashes, and underscores.</div>');
    return true;
  }

  // Check if this would exceed max saves (and it's a new name)
  const existingSave = saves.find(s => s.name.toLowerCase() === saveName.toLowerCase());
  if (!existingSave && saves.length >= MAX_SAVES) {
    respondAsGame(`<div class="normal">You can't have more than ${MAX_SAVES} saves. Override an existing save or use the "Delete Save" command.</div>`);
    return true;
  }

  // Perform the save using our comprehensive save system
  const { customSave } = await import('./save-manager.js');
  const success = await customSave(saveName);

  if (success) {
    respondAsGame(`<div class="normal">Game saved as "<span style="color: var(--accent-primary)">${saveName}</span>".</div>`);
  } else {
    respondAsGame('<div class="normal">Save failed. Please try again.</div>');
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
    respondAsGame('<div class="normal">Save not found. Please try again.</div>');
    return true;
  }

  // Perform the restore
  const { customLoad } = await import('./save-manager.js');
  const success = await customLoad(save.name);

  if (success) {
    respondAsGame(`<div class="normal">Game restored from "<span style="color: var(--accent-primary)">${save.name}</span>".</div>`);
  } else {
    respondAsGame('<div class="normal">Restore failed. Save file may be corrupted.</div>');
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
    respondAsGame('<div class="normal">Save not found. Please try again.</div>');
    return true;
  }

  // Delete the save
  localStorage.removeItem(save.key);
  respondAsGame(`<div class="normal">Deleted save "<span style="color: var(--accent-primary)">${save.name}</span>".</div>`);

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
