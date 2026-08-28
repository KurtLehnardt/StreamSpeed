// StreamSpeed — settings.js
// Shared settings/storage layer. This file MUST run in three realms:
//   * content scripts (isolated world)
//   * extension pages (options/popup)
//   * the service worker (loaded via importScripts)
// Use `self` as the global so the same source works in window and worker realms.
// Everything is attached to the global object (g.X) so bare cross-file references
// (SS_DEFAULTS, ssGetSettings, ...) resolve, and so re-running is idempotent
// (plain assignment never throws the way a duplicate `const` would).
(function () {
    'use strict';
    var g = self;

    // ---- Constants -------------------------------------------------------
    g.SS_SCHEMA_VERSION = 1;

    g.SS_DEFAULTS = {
        schemaVersion: 1,
        adMode: 'off',
        speedMultiplier: 16,
        autoSkip: true,
        networkAssist: false,
        firstRunDone: false,
        sites: {
            youtube: { enabled: true, beta: false },
            hulu: { enabled: false, beta: true },
            peacock: { enabled: false, beta: true },
            twitch: { enabled: false, beta: true }
        }
    };

    g.SS_AD_NETWORK_HOSTS = [
        "*://*.doubleclick.net/*",
        "*://*.googlesyndication.com/*",
        "*://imasdk.googleapis.com/*",
        "*://*.moatads.com/*",
        "*://*.adsafeprotected.com/*",
        "*://*.fwmrm.net/*",
        "*://*.amazon-adsystem.com/*"
    ];

    // ---- Migration / normalization --------------------------------------
    // Fill any missing fields from SS_DEFAULTS, deep-merge `sites`, clamp/coerce,
    // drop legacy keys, and stamp the current schema version.
    g.ssMigrate = function ssMigrate(stored) {
        var d = g.SS_DEFAULTS;
        var src = (stored && typeof stored === 'object') ? stored : {};

        var out = {
            schemaVersion: g.SS_SCHEMA_VERSION,
            adMode: src.adMode,
            speedMultiplier: src.speedMultiplier,
            autoSkip: (typeof src.autoSkip === 'boolean') ? src.autoSkip : d.autoSkip,
            networkAssist: (typeof src.networkAssist === 'boolean') ? src.networkAssist : d.networkAssist,
            firstRunDone: (typeof src.firstRunDone === 'boolean') ? src.firstRunDone : d.firstRunDone,
            sites: {}
        };

        // adMode: coerce to one of off/speed/breathing else 'off'.
        if (out.adMode !== 'off' && out.adMode !== 'speed' && out.adMode !== 'breathing') {
            out.adMode = 'off';
        }

        // speedMultiplier: clamp to 2..16 int.
        var sm = parseInt(out.speedMultiplier, 10);
        if (isNaN(sm)) { sm = d.speedMultiplier; }
        if (sm < 2) { sm = 2; }
        if (sm > 16) { sm = 16; }
        out.speedMultiplier = sm;

        // sites: deep-merge so each known site gets missing enabled/beta from defaults.
        var storedSites = (src.sites && typeof src.sites === 'object') ? src.sites : {};
        var keys = Object.keys(d.sites);
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            var ds = d.sites[k];
            var ss = (storedSites[k] && typeof storedSites[k] === 'object') ? storedSites[k] : {};
            out.sites[k] = {
                enabled: (typeof ss.enabled === 'boolean') ? ss.enabled : ds.enabled,
                beta: (typeof ss.beta === 'boolean') ? ss.beta : ds.beta
            };
        }

        // Drop any legacy `breathingStyle` key — never carry it forward.
        if ('breathingStyle' in out) { delete out.breathingStyle; }

        return out;
    };

    // ---- Public API ------------------------------------------------------
    // ssGetSettings: read storage.sync (seeded with defaults), then normalize.
    g.ssGetSettings = async function ssGetSettings() {
        var stored;
        try {
            stored = await chrome.storage.sync.get(g.SS_DEFAULTS);
        } catch (e) {
            stored = {};
        }
        return g.ssMigrate(stored);
    };

    // ssSetSettings: shallow patch into storage.sync.
    g.ssSetSettings = async function ssSetSettings(patch) {
        await chrome.storage.sync.set(patch);
    };

    // ssOnSettingsChanged: subscribe to sync-area changes, delivering normalized settings.
    g.ssOnSettingsChanged = function ssOnSettingsChanged(cb) {
        chrome.storage.onChanged.addListener(function (changes, area) {
            if (area === 'sync') {
                g.ssGetSettings().then(cb);
            }
        });
    };

    if (!g.__ssSettingsLoaded) {
        g.__ssSettingsLoaded = true;
    }
})();
