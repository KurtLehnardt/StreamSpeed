// StreamSpeed — firstRun.js
// One-time informational banner shown on the first eligible page load. Explains
// what the ad engine does, that nothing runs until the user picks a mode, and
// how to open Options. Top frame only; idempotent per realm.
(function () {
    'use strict';
    var g = self;

    var BANNER_TEXT =
        'StreamSpeed can now auto-detect ads and (your choice) speed through them, ' +
        'or mute + show a breathing exercise, and optionally auto-skip. ' +
        'Ad detection runs on-page (DOM) only by default — network-assisted detection ' +
        'is optional and off until you turn it on. Only YouTube is on by default; ' +
        'Hulu/Peacock/Twitch are Beta and off until you enable them. ' +
        'Nothing runs until you pick a mode in Options (default is Off).';

    g.ssMaybeShowFirstRun = async function ssMaybeShowFirstRun() {
        try {
            // Top frame only.
            if (typeof g.ssIsTopFrame === 'function' && !g.ssIsTopFrame()) { return; }
            if (g.__ssFirstRunShown) { return; }

            var s = await g.ssGetSettings();
            if (!s || s.firstRunDone) { return; }

            // Re-check after the await to avoid a double banner from concurrent callers.
            if (g.__ssFirstRunShown) { return; }
            g.__ssFirstRunShown = true;

            if (document.body) {
                mount();
            } else {
                document.addEventListener('DOMContentLoaded', mount, { once: true });
            }
        } catch (e) {
            /* no-op: never let the banner break the page */
        }

        function mount() {
            if (document.getElementById('ss-firstrun-banner')) { return; }

            var banner = document.createElement('div');
            banner.id = 'ss-firstrun-banner';
            banner.className = 'ss-firstrun-banner';

            var msg = document.createElement('div');
            msg.className = 'ss-firstrun-msg';
            msg.textContent = BANNER_TEXT;
            banner.appendChild(msg);

            var actions = document.createElement('div');
            actions.className = 'ss-firstrun-actions';

            var gotBtn = document.createElement('button');
            gotBtn.type = 'button';
            gotBtn.className = 'ss-firstrun-secondary';
            gotBtn.textContent = 'Got it';
            gotBtn.addEventListener('click', dismiss);

            var openBtn = document.createElement('button');
            openBtn.type = 'button';
            openBtn.className = 'ss-firstrun-primary';
            openBtn.textContent = 'Open Options';
            openBtn.addEventListener('click', function () {
                try {
                    chrome.runtime.sendMessage({ type: 'SS_OPEN_OPTIONS' });
                } catch (e) {}
                dismiss();
            });

            actions.appendChild(gotBtn);
            actions.appendChild(openBtn);
            banner.appendChild(actions);

            (document.body || document.documentElement).appendChild(banner);

            function dismiss() {
                try {
                    if (typeof g.ssSetSettings === 'function') {
                        g.ssSetSettings({ firstRunDone: true });
                    }
                } catch (e) {}
                if (banner && banner.parentNode) {
                    banner.parentNode.removeChild(banner);
                }
            }
        }
    };

    if (!g.__ssFirstRunLoaded) {
        g.__ssFirstRunLoaded = true;
    }
})();
