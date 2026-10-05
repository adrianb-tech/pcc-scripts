// ==UserScript==
// @version 1.0
// @updateURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-Boro-Park-Psych-Consult-Auto-Defaults.user.js
// @downloadURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-Boro-Park-Psych-Consult-Auto-Defaults.user.js
// @name         PCC - Boro Park Psych Consult Auto-Defaults
// @match        https://*.pointclickcare.com/*
// @run-at       document-idle
// @allFrames    true
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    function isBoroPark() {
        try {
            var topDoc = window.top ? window.top.document : document;
            var openerDoc = window.opener ? window.opener.document : null;
            var text = (topDoc.body ? topDoc.body.innerText : '') +
                       ' ' + (openerDoc && openerDoc.body ? openerDoc.body.innerText : '') +
                       ' ' + (document.body ? document.body.innerText : '');
            return /boro\s*park/i.test(text);
        } catch (e) {
            return true;
        }
    }

    var done = false;
    var userTouched = false;
    ['mousedown', 'keydown'].forEach(function (ev) {
        document.addEventListener(ev, function (e) { if (e.isTrusted) userTouched = true; }, true);
    });

    function isListPage() {
        return Array.from(document.querySelectorAll('input[type="button"],input[type="submit"],button')).some(function (b) {
            return /^Apply$/i.test((b.value || b.textContent || '').trim());
        });
    }

    function fire(sel) { sel.dispatchEvent(new Event('change', { bubbles: true })); }

    function applyDefaultsOnce() {
        if (done) return;
        if (userTouched) { done = true; return; }
        if (document.readyState === 'loading') return;
        if (isListPage()) { done = true; return; }   // never touch the list's Status/Type filters
        if (!isBoroPark()) return;

        var selects = document.querySelectorAll('select');
        if (selects.length < 2) return;

        var isCopy = /copy/i.test(window.location.href) || /copy/i.test(document.referrer);

        selects.forEach(function (sel) {
            var optionsText = sel.innerText || sel.textContent;

            // 1. Psych: Consult, only if the dropdown is still at its default
            if (/Psych:\s*Consult/i.test(optionsText) && !(sel.selectedIndex > 0)) {
                for (var i = 0; i < sel.options.length; i++) {
                    if (/Psych:\s*Consult/i.test(sel.options[i].text)) {
                        if (sel.selectedIndex !== i) { sel.selectedIndex = i; fire(sel); }
                        break;
                    }
                }
            }

            // 2. Admission for NEW, Other for COPY
            if (/Admission/i.test(optionsText) && /Other/i.test(optionsText)) {
                var target = isCopy ? 'Other' : 'Admission';
                for (var j = 0; j < sel.options.length; j++) {
                    if (new RegExp('^' + target, 'i').test(sel.options[j].text.trim())) {
                        if (sel.selectedIndex !== j) { sel.selectedIndex = j; fire(sel); }
                        break;
                    }
                }
            }
        });
        done = true;
    }

    applyDefaultsOnce();
    var timer = setInterval(function () {
        applyDefaultsOnce();
        if (done) clearInterval(timer);
    }, 300);
    setTimeout(function () { clearInterval(timer); }, 8000);   // never poll past 8s
})();