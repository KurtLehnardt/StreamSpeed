// StreamSpeed options page — the primary settings surface.
// content/settings.js is loaded before this file and exposes:
//   SS_DEFAULTS, SS_AD_NETWORK_HOSTS, ssGetSettings(), ssSetSettings(patch),
//   ssOnSettingsChanged(cb).

const SS_SITE_KEYS = ['youtube', 'hulu', 'peacock', 'twitch'];

// Per-site capability map (kept in sync with the engine's contract).
const SS_CAPS = {
    youtube: { speed: true, breathing: true, autoSkip: true },
    hulu: { speed: true, breathing: true, autoSkip: true },
    peacock: { speed: true, breathing: true, autoSkip: true },
    twitch: { speed: false, breathing: true, autoSkip: false }
};

// Cached copy of the last-known settings so nested patches (e.g. per-site)
// never clobber sibling fields regardless of merge semantics.
let ssCurrent = null;

function clampMult(n) {
    let v = parseInt(n, 10);
    if (isNaN(v)) v = 2;
    if (v < 2) v = 2;
    if (v > 16) v = 16;
    return v;
}

function updateMultLabel(v) {
    const el = document.getElementById('ssMultVal');
    if (el) el.textContent = String(clampMult(v));
}

// Render all controls from a settings object.
function render(s) {
    if (!s) return;
    ssCurrent = s;

    // Ad mode radios.
    const modeRadios = document.querySelectorAll('input[name="adMode"]');
    modeRadios.forEach((r) => { r.checked = (r.value === s.adMode); });

    // Speed multiplier.
    const mult = document.getElementById('ssMult');
    if (mult) {
        const v = clampMult(s.speedMultiplier);
        mult.value = String(v);
        updateMultLabel(v);
    }

    // Auto-skip.
    const autoSkip = document.getElementById('ssAutoSkip');
    if (autoSkip) autoSkip.checked = !!s.autoSkip;

    // Network-assisted detection.
    const network = document.getElementById('ssNetwork');
    if (network) network.checked = !!s.networkAssist;

    // Per-site enable checkboxes.
    const sites = s.sites || {};
    SS_SITE_KEYS.forEach((key) => {
        const cb = document.getElementById('ssSite_' + key);
        if (cb) cb.checked = !!(sites[key] && sites[key].enabled);
    });

    // Twitch capability reflection: its sub-caps stay disabled and unchecked
    // because speed/auto-skip cannot apply to SSAI live streams.
    const tSpeed = document.getElementById('ssTwitchSpeed');
    const tSkip = document.getElementById('ssTwitchSkip');
    if (tSpeed) { tSpeed.checked = SS_CAPS.twitch.speed; tSpeed.disabled = true; }
    if (tSkip) { tSkip.checked = SS_CAPS.twitch.autoSkip; tSkip.disabled = true; }
}

// Persist a per-site enabled flag without clobbering other sites/fields.
async function setSiteEnabled(key, enabled) {
    const base = (ssCurrent && ssCurrent.sites) ? ssCurrent.sites : {};
    const prevSite = base[key] || {};
    const nextSites = Object.assign({}, base);
    nextSites[key] = Object.assign({}, prevSite, { enabled: enabled });
    await ssSetSettings({ sites: nextSites });
}

// --- Network permission reconciliation ---
async function hasNetworkPermission() {
    try {
        return await chrome.permissions.contains({
            permissions: ['webRequest'],
            origins: SS_AD_NETWORK_HOSTS
        });
    } catch (e) {
        return false;
    }
}

// Keep the checkbox + stored setting aligned with the actual granted permission.
async function reconcileNetwork() {
    const network = document.getElementById('ssNetwork');
    if (!network) return;
    const granted = await hasNetworkPermission();
    network.checked = granted;
    try {
        if (ssCurrent && !!ssCurrent.networkAssist !== granted) {
            await ssSetSettings({ networkAssist: granted });
        }
    } catch (e) {
        console.warn('StreamSpeed: failed to reconcile networkAssist:', e);
    }
}

function bind() {
    // Ad mode.
    document.querySelectorAll('input[name="adMode"]').forEach((r) => {
        r.addEventListener('change', async () => {
            if (!r.checked) return;
            try {
                await ssSetSettings({ adMode: r.value });
            } catch (e) {
                console.warn('StreamSpeed: failed to set adMode:', e);
            }
        });
    });

    // Speed multiplier.
    const mult = document.getElementById('ssMult');
    if (mult) {
        mult.addEventListener('input', () => updateMultLabel(mult.value));
        mult.addEventListener('change', async () => {
            const v = clampMult(mult.value);
            mult.value = String(v);
            updateMultLabel(v);
            try {
                await ssSetSettings({ speedMultiplier: v });
            } catch (e) {
                console.warn('StreamSpeed: failed to set speedMultiplier:', e);
            }
        });
    }

    // Auto-skip.
    const autoSkip = document.getElementById('ssAutoSkip');
    if (autoSkip) {
        autoSkip.addEventListener('change', async () => {
            try {
                await ssSetSettings({ autoSkip: autoSkip.checked });
            } catch (e) {
                console.warn('StreamSpeed: failed to set autoSkip:', e);
            }
        });
    }

    // Network-assisted detection: opt-in permission flow.
    const network = document.getElementById('ssNetwork');
    if (network) {
        network.addEventListener('change', async () => {
            if (network.checked) {
                let granted = false;
                try {
                    granted = await chrome.permissions.request({
                        permissions: ['webRequest'],
                        origins: SS_AD_NETWORK_HOSTS
                    });
                } catch (e) {
                    console.warn('StreamSpeed: permission request failed:', e);
                    granted = false;
                }
                if (!granted) {
                    network.checked = false;
                    return;
                }
                try {
                    await ssSetSettings({ networkAssist: true });
                } catch (e) {
                    console.warn('StreamSpeed: failed to set networkAssist:', e);
                }
            } else {
                try {
                    await chrome.permissions.remove({
                        permissions: ['webRequest'],
                        origins: SS_AD_NETWORK_HOSTS
                    });
                } catch (e) {
                    console.warn('StreamSpeed: permission remove failed:', e);
                }
                try {
                    await ssSetSettings({ networkAssist: false });
                } catch (e) {
                    console.warn('StreamSpeed: failed to clear networkAssist:', e);
                }
            }
        });
    }

    // Per-site enable checkboxes.
    SS_SITE_KEYS.forEach((key) => {
        const cb = document.getElementById('ssSite_' + key);
        if (!cb) return;
        cb.addEventListener('change', async () => {
            try {
                await setSiteEnabled(key, cb.checked);
            } catch (e) {
                console.warn('StreamSpeed: failed to set site ' + key + ':', e);
            }
        });
    });

    // Reconcile if the user grants/revokes the permission through Chrome's UI.
    try {
        if (chrome.permissions.onAdded) {
            chrome.permissions.onAdded.addListener(() => { reconcileNetwork(); });
        }
        if (chrome.permissions.onRemoved) {
            chrome.permissions.onRemoved.addListener(() => { reconcileNetwork(); });
        }
    } catch (e) {
        console.warn('StreamSpeed: failed to attach permission listeners:', e);
    }

    // Live-reflect external settings changes (popup, other tabs).
    try {
        ssOnSettingsChanged((s) => { render(s); });
    } catch (e) {
        console.warn('StreamSpeed: failed to subscribe to settings changes:', e);
    }
}

async function init() {
    try {
        const s = await ssGetSettings();
        render(s);
    } catch (e) {
        console.warn('StreamSpeed: failed to load settings:', e);
    }
    bind();
    // Sync the network checkbox with the actual granted permission on open.
    await reconcileNetwork();
}

init();
