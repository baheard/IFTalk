/**
 * Cross-Origin Storage Sync
 *
 * Syncs localStorage from GitHub Pages to localhost via iframe + postMessage.
 * Only works on localhost - the sync button is hidden on production.
 */

const REMOTE_ORIGIN = 'https://baheard.github.io';
const BRIDGE_URL = `${REMOTE_ORIGIN}/IFTalk/bridge.html`;

/**
 * Check if running in dev mode (not on GitHub Pages production)
 * This includes localhost, Tailscale IPs, LAN IPs, etc.
 */
export function isLocalhost() {
  // If NOT on GitHub Pages, we're in dev mode
  return location.hostname !== 'baheard.github.io';
}

/**
 * Sync saves from GitHub Pages to localhost
 * @returns {Promise<{synced: number, total: number}>}
 */
export async function syncFromRemote() {
  if (!isLocalhost()) {
    return { synced: 0, total: 0, error: 'Not on localhost' };
  }

  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = BRIDGE_URL;

    // Timeout after 10 seconds
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Sync timeout - could not reach GitHub Pages'));
    }, 10000);

    function cleanup() {
      clearTimeout(timeout);
      window.removeEventListener('message', handler);
      if (iframe.parentNode) {
        iframe.remove();
      }
    }

    function handler(e) {
      if (e.origin !== REMOTE_ORIGIN) return;
      if (e.data.type !== 'saves') return;

      const result = mergeSaves(e.data.data);
      cleanup();
      resolve(result);
    }

    iframe.onload = () => {
      iframe.contentWindow.postMessage({ type: 'getSaves' }, REMOTE_ORIGIN);
    };

    iframe.onerror = () => {
      cleanup();
      reject(new Error('Failed to load bridge'));
    };

    window.addEventListener('message', handler);
    document.body.appendChild(iframe);
  });
}

/**
 * Merge remote saves into local storage
 * Newer timestamp wins for matching keys
 * @param {Object} remoteSaves - Key-value pairs from remote
 * @returns {{synced: number, total: number}}
 */
function mergeSaves(remoteSaves) {
  let synced = 0;
  const total = Object.keys(remoteSaves).length;

  for (const [key, value] of Object.entries(remoteSaves)) {
    const local = localStorage.getItem(key);

    if (!local) {
      // No local version - use remote
      localStorage.setItem(key, value);
      synced++;
    } else {
      // Compare timestamps if both exist
      try {
        const localData = JSON.parse(local);
        const remoteData = JSON.parse(value);

        // Use timestamp comparison if available
        if (remoteData.timestamp && localData.timestamp) {
          if (remoteData.timestamp > localData.timestamp) {
            localStorage.setItem(key, value);
            synced++;
          }
        }
      } catch {
        // Not JSON or no timestamp - keep local
      }
    }
  }

  return { synced, total };
}
