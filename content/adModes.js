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
            try { console.debug('[StreamSpeed] reason=%s', __ssReason); } catch (e) {}
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

    // Auto-skip: scan skipSelectors (+ a conservative text fallback) for a visible,
    // enabled control and click it.
    function scanAndSkip(site) {
        var sels = site.skipSelectors || [];
        for (var i = 0; i < sels.length; i++) {
            var nodes;
            try { nodes = g.ssQuerySelectorAllShadows(sels[i], document.documentElement); }
            catch (e) { nodes = []; }
            for (var j = 0; j < nodes.length; j++) {
                if (clickIfActionable(nodes[j])) { return; }
            }
        }
        // Text fallback: only button-like elements whose text/aria mentions skip.
        var candidates;
        try { candidates = g.ssQuerySelectorAllShadows('button,[role="button"]', document.documentElement); }
        catch (e) { candidates = []; }
        for (var k = 0; k < candidates.length; k++) {
            var el = candidates[k];
            if (!el) { continue; }
            var txt = ((el.textContent || '') + ' ' + (el.getAttribute && el.getAttribute('aria-label') || '')).toLowerCase();
            if (txt.indexOf('skip') !== -1) {
                if (clickIfActionable(el)) { return; }
            }
        }
    }

    function clickIfActionable(el) {
        if (!el) { return false; }
        if (el.offsetParent === null) { return false; } // not visible
        if (el.disabled) { return false; }
        try { el.click(); return true; } catch (e) { return false; }
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
        __ssReason = null;
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
                    var vv = g.ssGetActiveVideo() || v;
                    // Re-assert the rate every tick (players love to reset it).
                    try { vv.playbackRate = target; } catch (e) {}
                    // E1 self-check begins after 400ms of settle time.
                    if (Date.now() - startedAt >= 400) {
                        var actual = vv.playbackRate;
                        if (Math.abs(actual - target) > target * 0.25) {
                            failCount++;
                            if (failCount >= 2) {
                                __ssReason = 'speed-not-honored';
                                logReason();
                                clearTracked(speedIv);
                                applyBreathing(vv); // fall back to mute + overlay
                            }
                        }
                    }
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

        // Auto-skip runs independently of the chosen mode.
        if (settings.autoSkip && caps.autoSkip) {
            trackInterval(setInterval(function () {
                try { scanAndSkip(site); } catch (e) {}
            }, 400));
        }

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

        // Restore playback state.
        if (__ssSnap) {
            var v = g.ssGetActiveVideo();
            if (v) { try { g.ssRestorePlayer(v, __ssSnap); } catch (e) {} }
        }

        __ssSnap = null;
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
