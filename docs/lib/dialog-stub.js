/* Minimal Dialog stub for basic game play without save/load */

var Dialog = function() {

var dialog_el_id = 'dialog';

/* Stub implementations */
function dialog_open(tosave, usage, gameid, callback) {
    // Dispatch event for IFTalk to handle (it will call callback)
    var event = new CustomEvent('iftalk-dialog-open', {
        detail: {
            tosave: tosave,
            usage: usage,
            gameid: gameid,
            callback: callback
        }
    });
    window.dispatchEvent(event);
}

function file_clean_fixed_name(filename, usage) {
    return filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
}

function file_construct_ref(filename, usage, gameid) {
    return { filename: filename, usage: usage, gameid: gameid };
}

function file_construct_temp_ref(usage) {
    return { filename: '_temp_' + Date.now(), usage: usage, gameid: '', temporary: true };
}

function file_write(ref, content, israw) {
    try {
        var key = 'iftalk_' + ref.usage + '_' + ref.filename;
        localStorage.setItem(key, israw ? content : JSON.stringify(content));
        return true;
    } catch (e) {
        console.error('[Dialog] Write error:', e);
        return false;
    }
}

function file_read(ref, israw) {
    try {
        var key = 'iftalk_' + ref.usage + '_' + ref.filename;
        var data = localStorage.getItem(key);
        if (data === null) return null;
        return israw ? data : JSON.parse(data);
    } catch (e) {
        console.error('[Dialog] Read error:', e);
        return null;
    }
}

function file_ref_exists(ref) {
    var key = 'iftalk_' + ref.usage + '_' + ref.filename;
    return localStorage.getItem(key) !== null;
}

function file_remove_ref(ref) {
    var key = 'iftalk_' + ref.usage + '_' + ref.filename;
    localStorage.removeItem(key);
}

/* Autosave with HTML content extension */
function autosave_write(key, snapshot) {
    try {
        // If snapshot exists, extend it with HTML content
        if (snapshot) {
            // Capture window HTML
            var statusBarEl = document.getElementById('status-bar');
            var upperWindowEl = document.getElementById('upper-window');
            var lowerWindowEl = document.getElementById('lower-window');

            snapshot.displayHTML = {
                statusBar: statusBarEl ? statusBarEl.innerHTML : '',
                upperWindow: upperWindowEl ? upperWindowEl.innerHTML : '',
                lowerWindow: lowerWindowEl ? lowerWindowEl.innerHTML : ''
            };

            // Capture narration state if available
            if (window.state) {
                snapshot.narrationState = {
                    currentChunkIndex: window.state.currentChunkIndex || 0,
                    chunksLength: window.state.narrationChunks ? window.state.narrationChunks.length : 0
                };
            }

        }

        localStorage.setItem('iftalk_auto_' + key, JSON.stringify(snapshot));
    } catch (e) {
        console.error('[Dialog] Autosave write error:', e);
    }
}

function autosave_read(key) {
    try {
        var data = localStorage.getItem('iftalk_auto_' + key);
        var snapshot = data ? JSON.parse(data) : null;

        if (snapshot) {
            // If we have HTML to restore, schedule it after do_autorestore completes
            if (snapshot.displayHTML) {
                // Use setTimeout to restore HTML after ifvms.js finishes do_autorestore
                setTimeout(function() {
                    var statusBarEl = document.getElementById('status-bar');
                    var upperWindowEl = document.getElementById('upper-window');
                    var lowerWindowEl = document.getElementById('lower-window');

                    if (statusBarEl) statusBarEl.innerHTML = snapshot.displayHTML.statusBar;
                    if (upperWindowEl) upperWindowEl.innerHTML = snapshot.displayHTML.upperWindow;
                    if (lowerWindowEl) lowerWindowEl.innerHTML = snapshot.displayHTML.lowerWindow;

                    // Restore narration state
                    if (snapshot.narrationState && window.state) {
                        window.state.currentChunkIndex = snapshot.narrationState.currentChunkIndex;
                    }

                    // Suppress next VoxGlk update to prevent overwriting
                    window.ignoreNextVoxGlkUpdate = true;
                }, 0);
            }
        }

        return snapshot;
    } catch (e) {
        console.error('[Dialog] Autosave read error:', e);
        return null;
    }
}

return {
    streaming: false,
    open: dialog_open,
    file_clean_fixed_name: file_clean_fixed_name,
    file_construct_ref: file_construct_ref,
    file_construct_temp_ref: file_construct_temp_ref,
    file_write: file_write,
    file_read: file_read,
    file_ref_exists: file_ref_exists,
    file_remove_ref: file_remove_ref,
    autosave_write: autosave_write,
    autosave_read: autosave_read
};

}();

// Export to window
if (typeof window !== 'undefined') {
    window.Dialog = Dialog;
}
