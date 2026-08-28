// StreamSpeed — adDetector.js
// The bootstrapping brain. Resolves the current site, loads settings, shows the
// first-run banner, then watches the DOM for ad activity and drives ssEngage /
// ssDisengage. DOM detection is the default signal; optional network hints only
// help Beta sites clear their confidence gate. Self-bootstraps at load; idempotent.
(function () {
    'use strict';
    var g = self;

    if (g.__ssAdCoreInit) { return; }
    g.__ssAdCoreInit = true;

    var site = (typeof g.ssResolveSite === 'function') ? g.ssResolveSite(location) : null;
    if (!site) { return; }

    // ---- State -----------------------------------------------------------
    var SETTINGS = null;
    var wasDom = false;          // previous raw domAdActive (for falling edge / sustain)
    var wasGated = false;        // previous confidence-gated state (for rising edge)
    var firstSeenAt = 0;         // when domAdActive first went true (sustain timer)
    var lastHintAt = 0;          // last fresh SS_AD_NETWORK_HINT timestamp
    var lastCandidateChangeAt = 0; // last ad-ish DOM mutation (adaptive poll)
    var lastEvalAt = 0;          // throttle for observer-driven evaluate()
    var fallingTimer = null;     // 600ms debounce before disengaging
    var pollTimer = null;
    var observer = null;

    // ---- Ad-active computation ------------------------------------------
    function anySelectorMatch() {
        var sels = site.adActiveSelectors || [];
        for (var i = 0; i < sels.length; i++) {
            try {
                if (document.querySelector(sels[i])) { return true; }
                var deep = g.ssQuerySelectorAllShadows(sels[i], document.documentElement);
                if (deep && deep.length) { return true; }
            } catch (e) {}
        }
        return false;
    }

    function playerAreaText() {
        var scope = null;
        var v = (typeof g.ssGetActiveVideo === 'function') ? g.ssGetActiveVideo() : null;
        if (v) {
            try {
                scope = v.closest && v.closest('[class*="player" i],[id*="player" i],.html5-video-player');
            } catch (e) { scope = null; }
            if (!scope) { scope = v.parentElement; }
        }
        if (!scope) { scope = document.body || document.documentElement; }
        var t = '';
        try { t += (scope.innerText || scope.textContent || ''); } catch (e) {}
        try {
            var ariaNodes = scope.querySelectorAll('[aria-label]');
            for (var i = 0; i < ariaNodes.length; i++) {
                t += ' ' + (ariaNodes[i].getAttribute('aria-label') || '');
            }
        } catch (e) {}
        return t.toLowerCase();
    }

    function anyTextMatch() {
        var fbs = site.adActiveTextFallback || [];
        if (!fbs.length) { return false; }
        var text = playerAreaText();
        if (!text) { return false; }
        for (var i = 0; i < fbs.length; i++) {
            if (text.indexOf(String(fbs[i]).toLowerCase()) !== -1) { return true; }
        }
        return false;
    }

    function computeAdActive() {
        return anySelectorMatch() || anyTextMatch();
    }

    function siteEnabled() {
        return !!(SETTINGS && SETTINGS.sites && SETTINGS.sites[site.key] && SETTINGS.sites[site.key].enabled);
    }

    // ---- Core evaluation -------------------------------------------------
    function evaluate() {
        lastEvalAt = Date.now();
        if (!SETTINGS) { return; }

        // Per-site enable gate: if off, detect nothing (but stay subscribed so a
        // later enable activates us). Disengage if we were mid-ad.
        if (!siteEnabled()) {
            if (g.__ssAdEngaged && typeof g.ssDisengage === 'function') { g.ssDisengage(); }
            wasDom = false;
            wasGated = false;
            firstSeenAt = 0;
            return;
        }

        var now = Date.now();
        var dom = false;
        try { dom = computeAdActive(); } catch (e) { dom = false; }

        // Track when the DOM signal first appeared, for the Beta sustain gate.
        if (dom && !wasDom) { firstSeenAt = now; }
        if (!dom) { firstSeenAt = 0; }

        var freshHint = lastHintAt && (now - lastHintAt < 1500);

        // Confidence gate.
        var gated = false;
        if (dom) {
            if (site.confidence === 'high') {
                gated = true;
            } else {
                var sustained = firstSeenAt && (now - firstSeenAt >= 700);
                gated = !!(sustained || freshHint);
            }
        }

        // Rising edge of the gated state: fresh ad → clear any prior suppression,
        // and (E4) log a Beta selector miss if we inferred via text/hint only.
        if (gated && !wasGated) {
            if (typeof g.ssResetSuppression === 'function') { g.ssResetSuppression(); }
            if (site.confidence !== 'high') {
                var selMatch = false;
                try { selMatch = anySelectorMatch(); } catch (e) { selMatch = false; }
                var textMatch = false;
                try { textMatch = anyTextMatch(); } catch (e) { textMatch = false; }
                if ((textMatch || freshHint) && !selMatch) {
                    try { console.debug('[StreamSpeed] beta selector miss: site=%s', site.key); } catch (e) {}
                }
            }
        }

        // Engage while gated (re-checked each tick so we retry once the frame
        // becomes engageable). Respect mode, suppression, and frame gate.
        if (gated) {
            if (fallingTimer) { clearTimeout(fallingTimer); fallingTimer = null; }
            var suppressed = (typeof g.ssIsSuppressed === 'function') ? g.ssIsSuppressed() : false;
            if (SETTINGS.adMode !== 'off' &&
                !suppressed &&
                !g.__ssAdEngaged &&
                typeof g.ssIsEngageableFrame === 'function' && g.ssIsEngageableFrame()) {
                if (typeof g.ssEngage === 'function') { g.ssEngage(site, SETTINGS); }
            }
        }

        // Falling edge on the raw DOM signal: debounce 600ms, then disengage.
        if (!dom && wasDom) {
            if (!fallingTimer) {
                fallingTimer = setTimeout(function () {
                    fallingTimer = null;
                    var still = false;
                    try { still = computeAdActive(); } catch (e) { still = false; }
                    if (!still && g.__ssAdEngaged && typeof g.ssDisengage === 'function') {
                        g.ssDisengage();
                    }
                }, 600);
            }
        }

        wasDom = dom;
        wasGated = gated;
    }

    // Throttled evaluate for the (chatty) mutation observer.
    function evalSoon() {
        if (Date.now() - lastEvalAt < 60) { return; }
        evaluate();
    }

    // ---- Detection machinery --------------------------------------------
    function schedulePoll() {
        if (pollTimer) { clearTimeout(pollTimer); }
        var since = Date.now() - lastCandidateChangeAt;
        var interval = (since < 3000) ? 100 : 500; // fast right after an ad-ish change
        pollTimer = setTimeout(function () {
            evaluate();
            schedulePoll();
        }, interval);
    }

    function start() {
        try {
            observer = new MutationObserver(function (mutations) {
                var candidate = false;
                for (var i = 0; i < mutations.length && !candidate; i++) {
                    var m = mutations[i];
                    var t = m.target;
                    if (t && t.nodeType === 1) {
                        var sig = ((typeof t.className === 'string' ? t.className : '') + ' ' + (t.id || '')).toLowerCase();
                        if (sig.indexOf('ad') !== -1) { candidate = true; }
                    }
                    if (!candidate && m.addedNodes) {
                        for (var j = 0; j < m.addedNodes.length; j++) {
                            var n = m.addedNodes[j];
                            if (n && n.nodeType === 1) {
                                var s2 = ((typeof n.className === 'string' ? n.className : '') + ' ' + (n.id || '')).toLowerCase();
                                if (s2.indexOf('ad') !== -1) { candidate = true; break; }
                            }
                        }
                    }
                }
                if (candidate) { lastCandidateChangeAt = Date.now(); }
                evalSoon();
            });
            observer.observe(document, { subtree: true, attributes: true, childList: true, attributeFilter: ['class', 'id', 'aria-hidden', 'data-a-target'] });
        } catch (e) {}

        schedulePoll();
        evaluate();
    }

    // ---- Settings wiring -------------------------------------------------
    if (typeof g.ssGetSettings !== 'function') { return; }

    g.ssGetSettings().then(function (s) {
        SETTINGS = s;
        if (typeof g.ssMaybeShowFirstRun === 'function') { g.ssMaybeShowFirstRun(); }
        start();
    });

    if (typeof g.ssOnSettingsChanged === 'function') {
        g.ssOnSettingsChanged(function (s) {
            SETTINGS = s;
            if (s.adMode === 'off' && g.__ssAdEngaged && typeof g.ssDisengage === 'function') {
                g.ssDisengage();
            }
            // Re-evaluate promptly (e.g. site just got enabled / mode changed).
            evaluate();
        });
    }

    // ---- Network hint (confidence only; helps Beta gate) ----------------
    try {
        if (chrome && chrome.runtime && chrome.runtime.onMessage) {
            chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
                // Defense-in-depth: only trust messages from our own extension.
                if (sender && sender.id !== chrome.runtime.id) { return; }
                if (msg && msg.type === 'SS_AD_NETWORK_HINT') {
                    if (typeof g.ssIsEngageableFrame === 'function' && !g.ssIsEngageableFrame()) { return; }
                    if (msg.site && msg.site !== site.key) { return; }
                    lastHintAt = Date.now();
                    evaluate();
                }
            });
        }
    } catch (e) {}

    // ---- Teardown --------------------------------------------------------
    window.addEventListener('pagehide', function () {
        try { if (observer) { observer.disconnect(); } } catch (e) {}
        try { if (pollTimer) { clearTimeout(pollTimer); } } catch (e) {}
        try { if (fallingTimer) { clearTimeout(fallingTimer); } } catch (e) {}
        try { if (g.__ssAdEngaged && typeof g.ssDisengage === 'function') { g.ssDisengage(); } } catch (e) {}
    });
})();
