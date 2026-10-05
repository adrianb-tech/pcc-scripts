// ==UserScript==
// @version 1.0
// @updateURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-Conditional-View-All-Checkbox.user.js
// @downloadURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-Conditional-View-All-Checkbox.user.js
// @name         PCC - Conditional View All Checkbox
// @match        https://*.pointclickcare.com/*
// @run-at       document-idle
// @allFrames    true
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    var lastKey = null;
    var MANUAL_TTL = 15000;

    function findByLabel(root, sel, re) {
        return Array.from(root.querySelectorAll(sel)).find(function (el) {
            return re.test((el.value || el.textContent || '').trim());
        });
    }

    function getBar() {
        var apply = findByLabel(document, 'input[type="button"],input[type="submit"],button', /^Apply$/i);
        if (!apply) return null;
        var el = apply.parentElement;
        while (el && el.querySelectorAll('select').length < 2) el = el.parentElement;
        return el;
    }

    function getViewAll() {
        return Array.from(document.querySelectorAll('input[type="checkbox"]')).find(function (cb) {
            var host = cb.closest('td,th,label') || cb.parentElement;
            return host && /View\s*All/i.test(host.textContent);
        });
    }

    function filtersAreAll(bar) {
        return Array.from(bar.querySelectorAll('select')).every(function (s) {
            var o = s.options[s.selectedIndex];
            return o && /^All$/i.test(o.text.trim());
        });
    }

    // A real click by you on View All: remember it so automation steps aside
    document.addEventListener('click', function (e) {
        if (!e.isTrusted) return;
        var cb = getViewAll();
        if (!cb) return;
        var host = cb.closest('td,th,label') || cb.parentElement;
        if (!host || !host.contains(e.target)) return;
        var bar = getBar();
        try {
            sessionStorage.setItem('va_manual', JSON.stringify({
                key: bar && filtersAreAll(bar) ? 'all' : 'filtered',
                t: Date.now()
            }));
        } catch (err) {}
    }, true);

    function manualOverride(key) {
        try {
            var m = JSON.parse(sessionStorage.getItem('va_manual') || 'null');
            return !!m && m.key === key && (Date.now() - m.t) < MANUAL_TTL;
        } catch (err) { return false; }
    }

    function tick() {
        var bar = getBar();
        if (!bar) return;
        var cb = getViewAll();
        if (!cb) return;

        var allAll = filtersAreAll(bar);
        var key = allAll ? 'all' : 'filtered';
        if (key === lastKey) return;                        // once per filter state
        if (manualOverride(key)) { lastKey = key; return; } // you toggled it: hands off
        if (cb.checked === allAll) { lastKey = key; return; }

        var last = +(sessionStorage.getItem('va_cooldown') || 0);
        if (Date.now() - last < 3000) return;               // reload-loop guard
        sessionStorage.setItem('va_cooldown', Date.now());
        lastKey = key;
        cb.click();                                         // click only; never set .checked
    }

    setInterval(tick, 500);
})();