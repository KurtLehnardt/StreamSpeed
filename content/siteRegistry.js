// StreamSpeed — siteRegistry.js
// Per-site ad-detection knowledge. `confidence: 'high'` sites engage as soon as
// a selector matches; `'low'` (Beta) sites need a sustained DOM signal or a fresh
// network hint before engaging. Beta selectors are best-guess and unverified.
(function () {
    'use strict';
    var g = self;

    g.SS_SITE_REGISTRY = {
        youtube: {
            confidence: 'high',
            hostMatch: /(^|\.)youtube\.com$/,
            adActiveSelectors: [
                '.ad-showing',
                '.ad-interrupting',
                '.ytp-ad-player-overlay',
                '.ytp-ad-player-overlay-layout'
            ],
            adActiveTextFallback: [],
            skipSelectors: [
                '.ytp-ad-skip-button',
                '.ytp-ad-skip-button-modern',
                '.ytp-skip-ad-button',
                '.ytp-ad-skip-button-container button'
            ],
            networkPatterns: ['/api/stats/ads', '/pagead/', 'googleads.g.doubleclick.net'],
            capabilities: { speed: true, breathing: true, autoSkip: true }
        },

        // BETA — selectors unverified.
        hulu: {
            confidence: 'low',
            hostMatch: /(^|\.)hulu\.com$/,
            adActiveSelectors: ['.ad-container', '[data-testid*="ad" i]', '.AdUnit'],
            adActiveTextFallback: ['ad ·', 'your video will resume'],
            skipSelectors: ['[data-automationid="skip-button"]', 'button[aria-label*="skip" i]'],
            networkPatterns: ['ads.hulu.com', 'imasdk.googleapis.com'],
            capabilities: { speed: true, breathing: true, autoSkip: true }
        },

        // BETA.
        peacock: {
            confidence: 'low',
            hostMatch: /(^|\.)peacocktv\.com$/,
            adActiveSelectors: ['.ad-marker', '[class*="Ad__"]', '[data-testid*="advertisement" i]'],
            adActiveTextFallback: ['advertisement', 'ad ·'],
            skipSelectors: ['button[aria-label*="skip" i]'],
            networkPatterns: ['fwmrm.net', 'imasdk.googleapis.com'],
            capabilities: { speed: true, breathing: true, autoSkip: true }
        },

        // BETA, SSAI (server-side ad insertion) — breathing/mute only, no speed/skip.
        twitch: {
            confidence: 'low',
            hostMatch: /(^|\.)twitch\.tv$/,
            adActiveSelectors: [
                '[data-a-target="video-ad-label"]',
                '[data-test-selector="ad-banner-default-text"]',
                '.video-player__ad-info-container'
            ],
            adActiveTextFallback: ['commercial break'],
            skipSelectors: [],
            networkPatterns: [],
            capabilities: { speed: false, breathing: true, autoSkip: false }
        }
    };

    // ssResolveSite: match location.hostname against each entry; return the entry
    // (with `.key` attached) or null.
    g.ssResolveSite = function ssResolveSite(location) {
        if (!location || !location.hostname) { return null; }
        var host = location.hostname;
        var reg = g.SS_SITE_REGISTRY;
        var keys = Object.keys(reg);
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            var entry = reg[k];
            if (entry.hostMatch && entry.hostMatch.test(host)) {
                entry.key = k;
                return entry;
            }
        }
        return null;
    };

    if (!g.__ssSiteRegistryLoaded) {
        g.__ssSiteRegistryLoaded = true;
    }
})();
