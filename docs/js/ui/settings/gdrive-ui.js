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

  // Sync to Drive button
  const gdriveSyncToBtn = document.getElementById('gdriveSyncToBtn');
  if (gdriveSyncToBtn) {
    gdriveSyncToBtn.addEventListener('click', async () => {
      gdriveSyncToBtn.disabled = true;
      updateStatus('Uploading saves to Google Drive...', 'processing');

      try {
        const { syncAllNow } = await import('../../utils/gdrive/index.js');
        const count = await syncAllNow(state.currentGameName);

        if (count > 0) {
          updateGDriveUI();
          updateStatus(`✓ Uploaded ${count} save(s) to Google Drive`, 'success');
        } else {
          updateStatus('No saves to upload');
        }
      } catch (error) {
        console.error('[Settings] Upload failed:', error);
        updateStatus('Upload failed: ' + error.message, 'error');
      } finally {
        gdriveSyncToBtn.disabled = false;
      }
    });
  }

  // Sync from Drive button
  const gdriveSyncFromBtn = document.getElementById('gdriveSyncFromBtn');
  if (gdriveSyncFromBtn) {
    gdriveSyncFromBtn.addEventListener('click', async () => {
      gdriveSyncFromBtn.disabled = true;
      updateStatus('Downloading saves from Google Drive...', 'processing');

      try {
        const { syncAllNow } = await import('../../utils/gdrive/index.js');
        const count = await syncAllNow(state.currentGameName);

        if (count > 0) {
          updateGDriveUI();
          updateStatus(`✓ Downloaded ${count} save(s) from Google Drive`, 'success');
        } else {
          updateStatus('No saves to download');
        }
      } catch (error) {
        console.error('[Settings] Download failed:', error);
        updateStatus('Download failed: ' + error.message, 'error');
      } finally {
        gdriveSyncFromBtn.disabled = false;
      }
    });
  }

  // Auto-export toggle (renamed from auto-sync)
  const autoexportToggle = document.getElementById('autoexportToggle');
  if (autoexportToggle) {
    // Load saved preference
    const enabled = localStorage.getItem('iftalk_autoSyncEnabled') === 'true';
    autoexportToggle.checked = enabled;
    state.gdriveSyncEnabled = enabled;

    autoexportToggle.addEventListener('change', async (e) => {
      const enabled = e.target.checked;

      // If enabling, ensure user is signed in first
      if (enabled && !state.gdriveSignedIn) {
        // Trigger sign-in
        try {
          const { signIn } = await import('../../utils/gdrive/index.js');
          await signIn();
          updateGDriveUI();
        } catch (error) {
          // Sign-in failed, disable toggle
          autoexportToggle.checked = false;
          updateStatus('Sign-in required for auto-export');
          return;
        }
      }

      state.gdriveSyncEnabled = enabled;
      localStorage.setItem('iftalk_autoSyncEnabled', enabled);
      updateStatus(enabled ? '✓ Auto-export enabled' : '✗ Auto-export disabled');
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
