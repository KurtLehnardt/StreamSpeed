// StreamSpeed — adModes.js
// The "engage / disengage" mechanics for an active ad. Given a resolved site and
// the current settings, this either speeds the ad up, or mutes + shows a breathing
// overlay, plus optional auto-skip. Always mounts an escape chip and an Esc key
// handler so the user can bail to normal playback. All work is gated behind
// ssIsEngageableFrame(). Module state lives in this IIFE closure; the whole file
// is guarded so re-injection does not wipe an in-flight engagement.
(function () {
    'use strict';
    var g = self;

    if (g.__ssAdModesLoaded) { return; }
    g.__ssAdModesLoaded = true;

    // ---- Module state ----------------------------------------------------
    var __ssSnap = null;        // snapshot of the video before we touched it
    var __ssSnapEl = null;      // the exact <video> we snapshotted (restore target)
    var __ssMode = null;        // effective mode actually applied
    var __ssReason = null;      // last diagnostic reason code
    var __ssIntervals = [];     // all setInterval ids we own
    var __ssOverlay = null;     // #ss-breathe-overlay element
    var __ssChip = null;        // .ss-escape-chip element
    var __ssSuppressed = false; // set by the escape chip; cleared on next rising edge

    // ---- Small helpers ---------------------------------------------------
    function trackInterval(iv) { __ssIntervals.push(iv); return iv; }

    function clearTracked(iv) {
        try { clearInterval(iv); } catch (e) {}
        var idx = __ssIntervals.indexOf(iv);
        if (idx !== -1) { __ssIntervals.splice(idx, 1); }
    }

    function logReason() {
        if (__ssReason) {
            if (typeof g.ssLog === 'function') { g.ssLog('reason=' + __ssReason); }
        }
    }

    // Where overlay/chip should mount. Prefer the fullscreen element; never a raw
    // <video> (nothing renders inside it) — fall back to its parent or <html>.
    g.ssAttachTo = function ssAttachTo() {
        var host = document.fullscreenElement || document.documentElement;
        if (host && host.tagName === 'VIDEO') {
            host = host.parentElement || document.documentElement;
        }
        return host;
    };

    // Mount the breathing overlay. Returns true on success. When a raw <video> is
    // fullscreen we cannot overlay anything on top of it, so we bail (mute stays).
    function mountOverlay() {
        try {
            if (__ssOverlay && __ssOverlay.parentNode) { return true; }
            var fsEl = document.fullscreenElement;
            if (fsEl && fsEl.tagName === 'VIDEO') {
                __ssReason = 'overlay-suppressed-raw-fullscreen';
                logReason();
                return false;
            }
            var host = g.ssAttachTo();
            if (!host) { return false; }

            var overlay = document.createElement('div');
            overlay.id = 'ss-breathe-overlay';

            var circle = document.createElement('div');
            circle.id = 'ss-breathe-circle';

            var label = document.createElement('div');
            label.id = 'ss-breathe-label';
            label.textContent = 'Breathe in';

            overlay.appendChild(circle);
            overlay.appendChild(label);
            host.appendChild(overlay);
            __ssOverlay = overlay;

            // Alternate the label text on the 4s breath cycle.
            trackInterval(setInterval(function () {
                if (!__ssOverlay) { return; }
                label.textContent = (label.textContent === 'Breathe in') ? 'Breathe out' : 'Breathe in';
            }, 2000));

            return true;
        } catch (e) {
            return false;
        }
    }

    function mountChip() {
        try {
            if (__ssChip && __ssChip.parentNode) { return __ssChip; }
            var host = g.ssAttachTo();
            if (!host) { return null; }
            var chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'ss-escape-chip';
            chip.textContent = '⏹ Stop / normal playback';
            chip.addEventListener('click', function (ev) {
                try { ev.preventDefault(); ev.stopPropagation(); } catch (e) {}
                escapeNow();
            });
            host.appendChild(chip);
            __ssChip = chip;
            return chip;
        } catch (e) {
            return null;
        }
    }

    // User bailed: suppress until the next fresh ad, then restore normal playback.
    function escapeNow() {
        __ssSuppressed = true;
        g.ssDisengage();
    }

    // Re-parent overlay/chip on fullscreen transitions.
    function reparent() {
        var fsEl = document.fullscreenElement;
        if (fsEl && fsEl.tagName === 'VIDEO') {
            // Raw video fullscreen: cannot overlay. Hide overlay; mute stays.
            if (__ssOverlay) { try { __ssOverlay.style.display = 'none'; } catch (e) {} }
            __ssReason = 'overlay-suppressed-raw-fullscreen';
            logReason();
            return;
        }
        var host = g.ssAttachTo();
        if (__ssOverlay) {
            try { __ssOverlay.style.display = 'flex'; host.appendChild(__ssOverlay); } catch (e) {}
        }
        if (__ssChip) {
            try { host.appendChild(__ssChip); } catch (e) {}
        }
    }

    function onKeydown(ev) {
        if (ev && (ev.key === 'Escape' || ev.keyCode === 27)) {
            escapeNow();
        }
    }

    var SKIP_THROTTLE_MS = 300;        // min gap between skip scans
    var SKIP_CLICK_COOLDOWN_MS = 1000; // min gap between any two skip clicks
    var SKIP_TEXT_MAX_LEN = 30;        // text fallback only trusts short labels
    var SKIP_TEXT_RE = /^skip(\s+ads?)?\s*[▶►›»>]?\s*$/i; // rejects countdowns, intro/recap
    var lastAnyClickAt = 0;            // scan-wide click cooldown (also covers clicks bubbling to inner nodes)
    var lastSkipScanAt = 0;

    function log() {
        if (typeof g.ssLog === 'function') { g.ssLog.apply(null, arguments); }
    }

    // Substring/prefix/suffix attribute operators (*=, ^=, $=) match loosely, so
    // those selectors need a label check; exact class/id/data-* selectors are trusted.
    function isWildcardSelector(sel) {
        return /\[[^\]]*[*^$]=/.test(sel);
    }

    // Query a list of selectors as one combined query; if it throws (one bad
    // selector poisons the lot), fall back to one query per selector.
    function queryGroup(list, root) {
        if (!list.length) { return []; }
        try { return g.ssQuerySelectorAllShadows(list.join(','), root); }
        catch (e) {
            var out = [];
            for (var i = 0; i < list.length; i++) {
                try { out = out.concat(g.ssQuerySelectorAllShadows(list[i], root)); } catch (e2) {}
            }
            return out;
        }
    }

    // Public: true when a skip scan would actually run (outside the throttle and
    // the post-click cooldown). Lets the detector avoid any DOM work on idle ticks.
    g.ssSkipReady = function ssSkipReady() {
        var now = Date.now();
        return !(now - lastSkipScanAt < SKIP_THROTTLE_MS || now - lastAnyClickAt < SKIP_CLICK_COOLDOWN_MS);
    };

    // Narrow the search to the player instead of the whole document: the closest
    // known player container above the main video. If that container holds no
    // skip candidate, climb up to 2 more ancestors (never the whole document).
    function getPlayerRoot(site) {
        var v = null;
        try { v = g.ssGetActiveVideo(); } catch (e) {}
        if (!v) { return null; }
        var knownSels = ['#movie_player', '.html5-video-player', '[data-a-target="video-player"]', '.video-player', '[id*="player" i]', '[class*="player" i]'];
        var root = null;
        for (var q = 0; q < knownSels.length && !root; q++) {
            try { root = v.closest(knownSels[q]); } catch (e) {}
        }
        if (!root) {
            var el = v.parentElement;
            for (var i = 0; i < 3 && el && el.parentElement && el.parentElement !== document.body; i++) {
                el = el.parentElement;
            }
            root = el || v.parentElement;
        }
        if (!root) { return null; }
        var probe = ((site && site.skipSelectors) || []).concat(['button', '[role="button"]']).join(',');
        for (var up = 0; up < 2; up++) {
            var has = false;
            try { has = !!root.querySelector(probe); } catch (e) { has = true; }
            if (has) { break; }
            var parent = root.parentElement;
            if (!parent || parent === document.body || parent === document.documentElement) { break; }
            root = parent;
        }
        return root;
    }

    function isExcluded(el) {
        try {
            if (el.matches && el.matches('a[href]')) { return true; }
            if (el.closest && el.closest('#masthead, nav, header, a[href]')) { return true; }
        } catch (e) {}
        return false;
    }

    function textLooksLikeSkip(el) {
        var label = (el.getAttribute && el.getAttribute('aria-label')) || '';
        label = label.trim();
        if (label.length > 0 && label.length <= SKIP_TEXT_MAX_LEN && SKIP_TEXT_RE.test(label)) { return true; }
        var txt = (el.textContent || '').trim();
        return txt.length > 0 && txt.length <= SKIP_TEXT_MAX_LEN && SKIP_TEXT_RE.test(txt);
    }

    // Auto-skip: scan skipSelectors (+ a conservative text fallback) inside the
    // player for a visible, enabled control and click it. Returns the matched
    // selector string or 'text' on click, false when scanned and nothing found,
    // null when throttled or cooling down (no scan happened).
    function scanAndSkip(site) {
        var now = Date.now();
        if (now - lastSkipScanAt < SKIP_THROTTLE_MS) { return null; }
        if (now - lastAnyClickAt < SKIP_CLICK_COOLDOWN_MS) { return null; }
        lastSkipScanAt = now;

        var root = getPlayerRoot(site);
        if (!root) { return false; }

        var sels = site.skipSelectors || [];
        var trusted = [], wild = [];
        for (var si = 0; si < sels.length; si++) {
            (isWildcardSelector(sels[si]) ? wild : trusted).push(sels[si]);
        }
        var groups = [{ list: trusted, needText: false }, { list: wild, needText: true }];
        for (var gi = 0; gi < groups.length; gi++) {
            var nodes = queryGroup(groups[gi].list, root);
            for (var j = 0; j < nodes.length; j++) {
                if (groups[gi].needText && !textLooksLikeSkip(nodes[j])) { continue; }
                if (clickIfActionable(nodes[j])) {
                    var matched = groups[gi].list.join(',');
                    for (var i = 0; i < groups[gi].list.length; i++) {
                        try { if (nodes[j].matches(groups[gi].list[i])) { matched = groups[gi].list[i]; break; } } catch (e) {}
                    }
                    return matched;
                }
            }
        }
        // Text fallback: button-like OR skip-classed elements labelled "Skip".
        var candidates;
        try { candidates = g.ssQuerySelectorAllShadows('button,[role="button"],[class*="skip" i]', root); }
        catch (e) { candidates = []; }
        for (var k = 0; k < candidates.length; k++) {
            var el = candidates[k];
            if (!el || isExcluded(el) || !textLooksLikeSkip(el)) { continue; }
            // Prefer the innermost control: skip wrappers that contain a button.
            try { if (el.querySelector('button,[role="button"]')) { continue; } } catch (e) {}
            if (clickIfActionable(el)) { return 'text'; }
        }
        return false;
    }

    // Public: attempt one skip scan. Driven by the detector loop so it also works
    // while the skip button lingers after a fast-forwarded ad and regardless of mode.
    // Returns a string (matched selector, or 'text') after a click, false when a
    // scan ran and found nothing, null when throttled or in click cooldown.
    g.ssTrySkip = function ssTrySkip(site) {
        try { return scanAndSkip(site); } catch (e) { return false; }
    };

    // Some YouTube controls ignore a bare .click(); dispatch the pointer/mouse
    // press sequence first, then exactly one activation via el.click().
    function robustClick(el) {
        try {
            var opts = { bubbles: true, cancelable: true, view: window };
            ['pointerdown', 'mousedown', 'pointerup', 'mouseup'].forEach(function (type) {
                var Ctor = (type.indexOf('pointer') === 0 && typeof PointerEvent === 'function') ? PointerEvent : MouseEvent;
                try { el.dispatchEvent(new Ctor(type, opts)); } catch (e) {}
            });
        } catch (e) {}
        try { el.click(); return true; } catch (e) {}
        return false;
    }

    function isInViewport(el) {
        var r = el.getBoundingClientRect();
        var vw = window.innerWidth || document.documentElement.clientWidth;
        var vh = window.innerHeight || document.documentElement.clientHeight;
        return r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < vw && r.top < vh;
    }

    // Reject only when something clearly unrelated covers the element's center.
    // null / shadow-hosted results are inconclusive and do not reject.
    function hitTestOk(el) {
        try {
            var r = el.getBoundingClientRect();
            var top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            if (!top) { return true; }
            if (top === el || el.contains(top)) { return true; }
            if (top.shadowRoot || (el.getRootNode && el.getRootNode() !== document)) { return true; }
            return false;
        } catch (e) { return true; }
    }

    function clickIfActionable(el) {
        if (!el) { return false; }
        if (el.disabled) { return false; }
        // Visibility WITHOUT offsetParent: it is null for position:fixed elements
        // (like YouTube's skip button) even when fully visible, which wrongly
        // rejected them. Use client rects + computed style instead.
        var rects = el.getClientRects();
        if (!rects || rects.length === 0) { return false; }
        try {
            var cs = getComputedStyle(el);
            if (cs && (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0')) { return false; }
        } catch (e) {}
        if (!isInViewport(el) || !hitTestOk(el)) { return false; }
        if (robustClick(el)) { lastAnyClickAt = Date.now(); return true; }
        return false;
    }

    // Mute + breathing overlay (used directly and as the speed fallback).
    function applyBreathing(v) {
        __ssMode = 'breathing';
        try { v.muted = true; } catch (e) {}
        var mounted = mountOverlay();
        if (!mounted) {
            __ssReason = __ssReason || 'breathing-mount-failed';
            logReason();
        }
    }

    // ---- Public: engage --------------------------------------------------
    g.ssEngage = function ssEngage(site, settings) {
        // Guard all engage/mount behind an engageable frame.
        if (typeof g.ssIsEngageableFrame !== 'function' || !g.ssIsEngageableFrame()) { return; }
        if (g.__ssAdEngaged) { return; }
        g.__ssAdEngaged = true;

        var v = g.ssGetActiveVideo();
        if (!v) {
            // Nothing to engage; release the flag so a later tick can retry.
            g.__ssAdEngaged = false;
            return;
        }

        __ssSnap = g.ssSnapshotPlayer(v);
        __ssSnapEl = v;          // remember the element so we restore onto IT, not
                                 // whatever video happens to be largest at disengage.
        __ssReason = null;

        // Mute the ad the instant we engage, in EVERY mode (speed included). The
        // pre-ad snapshot {muted,volume} is restored on disengage, so the content's
        // audio comes back exactly as it was once the ad ends.
        try { v.muted = true; } catch (e) {}

        var caps = site.capabilities || {};
        var mode = settings.adMode;

        if (mode === 'speed') {
            if (caps.speed) {
                __ssMode = 'speed';
                var target = Math.min(16, Math.max(2, settings.speedMultiplier));
                try { v.playbackRate = target; } catch (e) {}
                var failCount = 0;
                var startedAt = Date.now();
                var speedIv = trackInterval(setInterval(function () {
                    // Stop fighting the rate once we've disengaged (the falling-edge
                    // disengage is debounced, so this can fire on content video).
                    if (!g.__ssAdEngaged) { return; }
                    var vv = g.ssGetActiveVideo() || v;
                    // E1 self-check begins after 400ms of settle time. Read what the
                    // player left from the PREVIOUS tick BEFORE we re-assert — reading
                    // right after writing always returns target, so the check must
                    // come first.
                    if (Date.now() - startedAt >= 400) {
                        var actual = vv.playbackRate;
                        if (Math.abs(actual - target) > target * 0.25) {
                            failCount++;
                            if (failCount >= 2) {
                                __ssReason = 'speed-not-honored';
                                logReason();
                                clearTracked(speedIv);
                                applyBreathing(vv); // fall back to mute + overlay
                                return;
                            }
                        } else {
                            failCount = 0;
                        }
                    }
                    // Re-assert the rate every tick (players love to reset it).
                    try { vv.playbackRate = target; } catch (e) {}
                }, 250));
            } else {
                // e.g. Twitch SSAI: speed can't apply. Mute only, no overlay.
                __ssMode = 'mute-only';
                __ssReason = 'speed-unsupported-ssai';
                logReason();
                try { v.muted = true; } catch (e) {}
            }
        } else if (mode === 'breathing') {
            if (caps.breathing) {
                applyBreathing(v);
            } else {
                // No breathing capability: keep it muted at least.
                __ssMode = 'mute-only';
                try { v.muted = true; } catch (e) {}
            }
        }

        // Auto-skip is NOT started here anymore — it is driven by the detector loop
        // (adDetector.js) so it also fires while the skip button lingers after a
        // fast-forwarded ad, and even when no speed/breathing mode is engaged.

        // Always give the user an escape hatch.
        mountChip();
        document.addEventListener('fullscreenchange', reparent);
        document.addEventListener('keydown', onKeydown, true);
    };

    // ---- Public: disengage ----------------------------------------------
    g.ssDisengage = function ssDisengage() {
        // Clear every interval we own.
        for (var i = 0; i < __ssIntervals.length; i++) {
            try { clearInterval(__ssIntervals[i]); } catch (e) {}
        }
        __ssIntervals = [];

        // Remove listeners.
        try { document.removeEventListener('fullscreenchange', reparent); } catch (e) {}
        try { document.removeEventListener('keydown', onKeydown, true); } catch (e) {}

        // Remove UI.
        if (__ssOverlay && __ssOverlay.parentNode) {
            try { __ssOverlay.parentNode.removeChild(__ssOverlay); } catch (e) {}
        }
        if (__ssChip && __ssChip.parentNode) {
            try { __ssChip.parentNode.removeChild(__ssChip); } catch (e) {}
        }
        __ssOverlay = null;
        __ssChip = null;

        // Restore playback state onto the element we actually snapshotted, so long
        // as it is still in the DOM; otherwise fall back to the current largest video.
        if (__ssSnap) {
            var v = (__ssSnapEl && __ssSnapEl.isConnected) ? __ssSnapEl : g.ssGetActiveVideo();
            if (v) { try { g.ssRestorePlayer(v, __ssSnap); } catch (e) {} }
        }

        __ssSnap = null;
        __ssSnapEl = null;
        __ssMode = null;
        __ssReason = null;
        g.__ssAdEngaged = false;
        // NOTE: __ssSuppressed is intentionally NOT reset here — the detector
        // clears it on the next rising edge via ssResetSuppression().
    };

    // ---- Suppression accessors (used by the detector) -------------------
    g.ssResetSuppression = function ssResetSuppression() { __ssSuppressed = false; };
    g.ssIsSuppressed = function ssIsSuppressed() { return __ssSuppressed; };

    // Namespaced handle + bare globals.
    g.__ssAdModes = {
        ssEngage: g.ssEngage,
        ssDisengage: g.ssDisengage,
        ssResetSuppression: g.ssResetSuppression,
        ssIsSuppressed: g.ssIsSuppressed
    };
})();
