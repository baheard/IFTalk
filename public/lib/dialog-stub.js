/* Minimal Dialog stub for basic game play without save/load */

var Dialog = function() {

var dialog_el_id = 'dialog';

/* Stub implementations */
function dialog_open(tosave, usage, gameid, callback) {
    console.warn('[Dialog] File operations not supported in this build');
    if (callback) callback(null);
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

/* Autosave stubs */
function autosave_write(key, val) {
    try {
        localStorage.setItem('iftalk_auto_' + key, JSON.stringify(val));
    } catch (e) {
        console.error('[Dialog] Autosave write error:', e);
    }
}

function autosave_read(key) {
    try {
        var data = localStorage.getItem('iftalk_auto_' + key);
        return data ? JSON.parse(data) : null;
    } catch (e) {
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
