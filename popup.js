// StreamSpeed popup — additive quick controls layered on top of the legacy
// slider injection. content/settings.js is loaded before this file and exposes:
//   SS_DEFAULTS, SS_AD_NETWORK_HOSTS, ssGetSettings(), ssSetSettings(patch),
//   ssOnSettingsChanged(cb).

// --- Legacy behavior: inject the classic speed/volume slider on popup open ---
// update chrome.tabs to chrome.scripting
// https://developer.chrome.com/docs/extensions/reference/scripting/#method-executeScript
// use v3 or higher in manifest
async function injectScript() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || tab.id == null) return;
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['./speedChanger.js', './swal.js']
        });
        // NOTE: intentionally NOT calling window.close() so the quick controls
        // below stay usable while the slider is open on the page.
    } catch (e) {
        // chrome://, extension pages, or no active tab — slider just won't inject.
        console.warn('StreamSpeed: slider injection skipped:', e);
    }
}

// --- Helpers to talk to the active tab ---
async function getActiveTabId() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab && tab.id != null ? tab.id : null;
    } catch (e) {
        return null;
    }
}

// --- Wire the quick controls to shared settings ---
async function initControls() {
    const modeEl = document.getElementById('ssMode');
    const autoSkipEl = document.getElementById('ssAutoSkip');
    const optionsEl = document.getElementById('ssOptions');
    const escapeEl = document.getElementById('ssEscape');

    // Populate from current settings.
    try {
        const s = await ssGetSettings();
        if (modeEl) modeEl.value = s.adMode;
        if (autoSkipEl) autoSkipEl.checked = !!s.autoSkip;
    } catch (e) {
        console.warn('StreamSpeed: failed to load settings:', e);
    }

    // Persist changes.
    if (modeEl) {
        modeEl.addEventListener('change', async () => {
            try {
                await ssSetSettings({ adMode: modeEl.value });
            } catch (e) {
                console.warn('StreamSpeed: failed to set adMode:', e);
            }
        });
    }
    if (autoSkipEl) {
        autoSkipEl.addEventListener('change', async () => {
            try {
                await ssSetSettings({ autoSkip: autoSkipEl.checked });
            } catch (e) {
                console.warn('StreamSpeed: failed to set autoSkip:', e);
            }
        });
    }

    // Open the full options page.
    if (optionsEl) {
        optionsEl.addEventListener('click', () => {
            try {
                chrome.runtime.openOptionsPage();
            } catch (e) {
                console.warn('StreamSpeed: failed to open options:', e);
            }
        });
    }

    // Disengage ad mode immediately on the active tab.
    if (escapeEl) {
        escapeEl.addEventListener('click', async () => {
            const tabId = await getActiveTabId();
            if (tabId == null) return;
            try {
                await chrome.scripting.executeScript({
                    // all_frames: the engaged video may live in a subframe (Hulu/
                    // Peacock). Each frame's ssDisengage is a no-op if undefined.
                    target: { tabId, allFrames: true },
                    func: () => { if (window.ssDisengage) window.ssDisengage(); }
                });
            } catch (e) {
                // chrome:// or restricted page — nothing to disengage.
                console.warn('StreamSpeed: disengage failed:', e);
            }
        });
    }

    // Live-reflect changes made elsewhere (options page, other popups).
    try {
        ssOnSettingsChanged((s) => {
            if (modeEl && s.adMode != null) modeEl.value = s.adMode;
            if (autoSkipEl && s.autoSkip != null) autoSkipEl.checked = !!s.autoSkip;
        });
    } catch (e) {
        console.warn('StreamSpeed: failed to subscribe to settings changes:', e);
    }
}

// Kick off both concerns on load.
injectScript();
initControls();
