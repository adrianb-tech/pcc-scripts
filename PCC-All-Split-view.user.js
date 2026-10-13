// ==UserScript==
// @name         Every facility — Split view setup (T key)
// @version      1.0
// @description  Split view: open a second tiled copy of the chart (your usual Option+right-click), then press T in the copy you want to WRITE in — that copy jumps to FORMS (Boro Park: ASSMNTS) and the other copy jumps to PROG NOTES on its own. The two copies signal each other directly (BroadcastChannel) — no timers, no polling, nothing moves until you press T. Safety: the other copy only obeys if it shows the SAME resident (or no name could be read). '0' = kill switch. Keys never fire while typing.
// @updateURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Split-view.user.js
// @downloadURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Split-view.user.js
// @match        https://*.pointclickcare.com/*
// @run-at       document-idle
// @allFrames    true
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // One id per panel (top window). Every frame of the same panel shares it;
    // the other tiled copy has a different one.
    var topWin = window.top;
    var PANEL_ID;
    try {
        PANEL_ID = topWin.__pccPanelId || (topWin.__pccPanelId = Math.random().toString(36).slice(2) + Date.now().toString(36));
    } catch (e) { PANEL_ID = Math.random().toString(36).slice(2); }

    var OFF = false;   // '0' kill switch

    function allDocs() {
        var docs = [];
        var seen = [];
        (function walk(w) {
            try {
                if (seen.indexOf(w) !== -1) return;
                seen.push(w);
                if (w.document) docs.push(w.document);
                for (var i = 0; i < w.frames.length; i++) walk(w.frames[i]);
            } catch (e) { /* cross-origin frame: skip */ }
        })(topWin);
        return docs;
    }

    // Full mouse event click — PCC ignores plain .click()
    function fireClick(el) {
        try {
            el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
            el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
            if (el.click) el.click();
        } catch (e) { try { el.click(); } catch (e2) {} }
    }

    function norm(s) { return (s || '').replace(/\s+/g, ' ').trim().toUpperCase(); }

    // Find a chart tab by exact label in any frame of this panel; returns the
    // clickable element (climbs to a link/button/cell like PCC tabs need).
    function findTab(labels) {
        var docs = allDocs();
        for (var d = 0; d < docs.length; d++) {
            var els = docs[d].querySelectorAll('a,button,[role="tab"],td,li,span,div');
            for (var i = 0; i < els.length; i++) {
                var el = els[i];
                if (el.children.length > 2) continue;
                var t = norm(el.textContent);
                if (labels.indexOf(t) === -1) continue;
                var clickable = el;
                for (var up = 0; up < 6 && clickable; up++) {
                    var tag = clickable.tagName;
                    if (tag === 'A' || tag === 'BUTTON' || tag === 'TD' || tag === 'LI' ||
                        clickable.onclick || clickable.getAttribute('onclick')) break;
                    clickable = clickable.parentElement;
                }
                return clickable || el;
            }
        }
        return null;
    }

    // Best-effort resident name ("LAST, FIRST") from the header (top document).
    function residentName() {
        try {
            var t = (topWin.document.body ? topWin.document.body.innerText : '').slice(0, 4000);
            var m = t.match(/\b([A-Z]{2,}(?:['\u2019\-][A-Z]+)?,\s*[A-Z]{2,}(?:\s+[A-Z])?)\b/);
            return m ? m[1].replace(/\s+/g, ' ') : '';
        } catch (e) { return ''; }
    }

    function toast(msg) {
        try {
            var doc = topWin.document;
            var old = doc.getElementById('pcc-split-toast');
            if (old) old.remove();
            var el = doc.createElement('div');
            el.id = 'pcc-split-toast';
            el.textContent = msg;
            el.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:2147483647;background:#1f2937;color:#fff;font:600 13px -apple-system,sans-serif;padding:8px 14px;border-radius:999px;box-shadow:0 4px 16px rgba(0,0,0,.25);opacity:0;transition:opacity .18s;pointer-events:none;';
            doc.body.appendChild(el);
            requestAnimationFrame(function () { el.style.opacity = '1'; });
            setTimeout(function () { el.style.opacity = '0'; setTimeout(function () { el.remove(); }, 250); }, 1600);
        } catch (e) {}
    }

    var channel = null;
    try { channel = new BroadcastChannel('pcc-split-view-v1'); } catch (e) {}

    // Receiver: only the TOP frame of each panel handles signals (one actor),
    // and only if this panel shows the same resident (or names are unreadable).
    if (channel && window === topWin) {
        channel.onmessage = function (ev) {
            var msg = ev.data || {};
            if (msg.type !== 'goto-notes' || msg.from === PANEL_ID || OFF) return;
            var mine = residentName();
            if (msg.name && mine && msg.name !== mine) return;   // different resident: hands off
            var tab = findTab(['PROG NOTES']);
            if (tab) { fireClick(tab); toast('Split view: this side = Progress Notes'); }
        };
    }

    function isTyping(target) {
        if (!target) return false;
        var tag = (target.tagName || '').toUpperCase();
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable === true;
    }

    document.addEventListener('keydown', function (e) {
        if (!e.isTrusted || e.repeat) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (isTyping(e.target)) return;

        if (e.key === '0') { OFF = !OFF; toast(OFF ? 'Split view OFF' : 'Split view ON'); return; }
        if (OFF) return;
        if (!e.key || e.key.toLowerCase() !== 't') return;

        // This panel = the writing side: jump to the forms tab.
        var formsTab = findTab(['FORMS', 'ASSMNTS']);
        if (!formsTab) return;   // not on a resident chart: do nothing, signal nothing
        fireClick(formsTab);
        toast('Split view: this side = Forms');
        // Tell the other copy to show Progress Notes.
        if (channel) {
            try { channel.postMessage({ type: 'goto-notes', from: PANEL_ID, name: residentName() }); } catch (e2) {}
        }
        e.preventDefault();
    }, true);
})();
