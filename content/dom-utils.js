// StreamSpeed — dom-utils.js
// Video/DOM helpers shared by the ad engine. Runs in the isolated content world.
(function () {
    'use strict';
    var g = self;

    g.SS_MIN_VIDEO_AREA = 120000;

    // Ported from speedChanger.js `querySelectorAllShadows`.
    // Recurses into open shadow roots and fuses all matches into one flat array.
    // https://stackoverflow.com/a/71692555
    g.ssQuerySelectorAllShadows = function ssQuerySelectorAllShadows(selector, root) {
        var el = root || document.body || document.documentElement;
        if (!el) { return []; }
        // recurse on child shadow roots
        var childShadows = Array.from(el.querySelectorAll('*'))
            .map(function (n) { return n.shadowRoot; })
            .filter(Boolean);
        var childResults = childShadows.map(function (child) {
            return g.ssQuerySelectorAllShadows(selector, child);
        });
        // fuse all results into a singular, flat array
        var result = Array.from(el.querySelectorAll(selector));
        return result.concat(childResults).flat();
    };

    // ssGetActiveVideo: gather videos (shadow + light DOM), pick the largest by
    // rect area with readyState>=1; fall back to first; null if none.
    g.ssGetActiveVideo = function ssGetActiveVideo() {
        var vids = [];
        try {
            vids = g.ssQuerySelectorAllShadows('video', document.documentElement);
        } catch (e) {
            vids = [];
        }
        var tagVids = Array.from(document.getElementsByTagName('video'));
        for (var i = 0; i < tagVids.length; i++) {
            if (vids.indexOf(tagVids[i]) === -1) { vids.push(tagVids[i]); }
        }
        if (!vids.length) { return null; }

        var best = null;
        var bestArea = -1;
        for (var j = 0; j < vids.length; j++) {
            var v = vids[j];
            if (!v || v.readyState < 1) { continue; }
            var r = v.getBoundingClientRect();
            var area = r.width * r.height;
            if (area > bestArea) { bestArea = area; best = v; }
        }
        if (best) { return best; }
        return vids[0] || null;
    };

    // ssIsEngageableFrame: is there a real, sized, playing-or-scrubbed video here?
    g.ssIsEngageableFrame = function ssIsEngageableFrame() {
        var v = g.ssGetActiveVideo();
        if (!v || v.readyState < 1) { return false; }
        var r = v.getBoundingClientRect();
        if (r.width * r.height < g.SS_MIN_VIDEO_AREA) { return false; }
        return !v.paused || v.currentTime > 0;
    };

    // ssIsTopFrame: true only in the top-level frame.
    g.ssIsTopFrame = function ssIsTopFrame() {
        try {
            return window.top === window.self;
        } catch (e) {
            return false;
        }
    };

    // ssSnapshotPlayer / ssRestorePlayer: capture and restore playback state.
    g.ssSnapshotPlayer = function ssSnapshotPlayer(v) {
        return { playbackRate: v.playbackRate, muted: v.muted, volume: v.volume };
    };

    g.ssRestorePlayer = function ssRestorePlayer(v, snap) {
        if (!v || !snap) { return; }
        try { v.playbackRate = snap.playbackRate; } catch (e) {}
        try { v.muted = snap.muted; } catch (e) {}
        try { v.volume = snap.volume; } catch (e) {}
    };

    if (!g.__ssDomUtilsLoaded) {
        g.__ssDomUtilsLoaded = true;
    }
})();
