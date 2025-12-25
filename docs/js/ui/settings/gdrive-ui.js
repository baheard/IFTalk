/**
 * Google Drive UI Module
 *
 * Handles Google Drive sign in/out, sync buttons, and UI state updates.
 */

import { state } from '../../core/state.js';
import { updateStatus } from '../../utils/status.js';

/**
 * Update Google Drive UI based on sign-in state
 */
function updateGDriveUI() {
  const signInArea = document.getElementById('gdriveSignInArea');
  const accountArea = document.getElementById('gdriveAccountArea');
  const emailSpan = document.getElementById('gdriveEmail');
  const statusSpan = document.getElementById('gdriveSyncStatus');

  if (state.gdriveSignedIn) {
    signInArea?.classList.add('hidden');
    accountArea?.classList.remove('hidden');
    if (emailSpan) emailSpan.textContent = state.gdriveEmail || '';
    if (statusSpan) {
      const lastSync = state.gdriveLastSyncTime
        ? new Date(state.gdriveLastSyncTime).toLocaleString()
        : 'Never';
      statusSpan.textContent = `Last synced: ${lastSync}`;
    }
  } else {
    signInArea?.classList.remove('hidden');
    accountArea?.classList.add('hidden');
  }
}

/**
 * Initialize Google Drive UI
 */
export function initGDriveUI() {
  // Sign in button
  const gdriveSignInBtn = document.getElementById('gdriveSignInBtn');
  if (gdriveSignInBtn) {
    gdriveSignInBtn.addEventListener('click', async () => {
      try {
        const { signIn } = await import('../../utils/gdrive/index.js');
        await signIn();
        updateGDriveUI();
        updateStatus('Signed in to Google Drive', 'success');
      } catch (error) {
        console.error('[Settings] Sign-in failed:', error);
        updateStatus('Sign-in failed: ' + error.message, 'error');
      }
    });
  }

  // Sign out button
  const gdriveSignOutBtn = document.getElementById('gdriveSignOutBtn');
  if (gdriveSignOutBtn) {
    gdriveSignOutBtn.addEventListener('click', async () => {
      try {
        const { signOut } = await import('../../utils/gdrive/index.js');
        await signOut();
        updateGDriveUI();
        updateStatus('Signed out of Google Drive');
      } catch (error) {
        console.error('[Settings] Sign-out failed:', error);
        updateStatus('Sign-out failed: ' + error.message, 'error');
      }
    });
  }

  // Sync now button
  const gdriveSyncNowBtn = document.getElementById('gdriveSyncNowBtn');
  if (gdriveSyncNowBtn) {
    const btnIcon = gdriveSyncNowBtn.querySelector('.material-icons');
    const btnText = gdriveSyncNowBtn.childNodes[2]; // Text node after icon

    gdriveSyncNowBtn.addEventListener('click', async () => {
      // Disable button and show syncing state
      gdriveSyncNowBtn.disabled = true;
      btnIcon.textContent = 'autorenew';
      btnIcon.classList.add('spinning');
      btnText.textContent = ' Syncing...';

      try {
        const { syncAllNow } = await import('../../utils/gdrive/index.js');
        updateStatus('Syncing saves to Google Drive...', 'processing');

        // Sync only the current game's saves
        const count = await syncAllNow(state.currentGameName);

        if (count > 0) {
          // Success state
          btnIcon.classList.remove('spinning');
          btnIcon.textContent = 'check';
          btnText.textContent = ` Synced ${count} file(s)`;
          updateGDriveUI();
          updateStatus(`Synced ${count} file(s) to Google Drive`, 'success');

          // Reset to ready state after 2 seconds
          setTimeout(() => {
            btnIcon.textContent = 'sync';
            btnText.textContent = ' Sync Now';
            gdriveSyncNowBtn.disabled = false;
          }, 2000);
        } else {
          // No files synced (user cancelled auth)
          btnIcon.classList.remove('spinning');
          btnIcon.textContent = 'sync';
          btnText.textContent = ' Sync Now';
          gdriveSyncNowBtn.disabled = false;
        }
      } catch (error) {
        // Error state
        console.error('[Settings] Sync failed:', error);
        btnIcon.classList.remove('spinning');
        btnIcon.textContent = 'error';
        btnText.textContent = ' Sync Failed';
        updateStatus('Sync failed: ' + error.message, 'error');

        // Reset to ready state after 3 seconds
        setTimeout(() => {
          btnIcon.textContent = 'sync';
          btnText.textContent = ' Sync Now';
          gdriveSyncNowBtn.disabled = false;
        }, 3000);
      }
    });
  }

  // Auto-Sync toggle
  const autoSyncToggle = document.getElementById('autoSyncToggle');
  if (autoSyncToggle) {
    // Load saved preference
    const enabled = localStorage.getItem('iftalk_autoSyncEnabled') === 'true';
    autoSyncToggle.checked = enabled;
    state.gdriveSyncEnabled = enabled;

    autoSyncToggle.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      state.gdriveSyncEnabled = enabled;
      localStorage.setItem('iftalk_autoSyncEnabled', enabled);
      updateStatus(enabled ? 'Auto-sync enabled' : 'Auto-sync disabled');
    });
  }

  // Listen for sign-in/sign-out events to update UI
  window.addEventListener('gdriveSignInChanged', () => {
    updateGDriveUI();
  });

  // Listen for auto-sync completion to update last sync time
  window.addEventListener('gdriveSyncComplete', () => {
    updateGDriveUI();
  });

  // Initialize UI on load
  updateGDriveUI();
}
