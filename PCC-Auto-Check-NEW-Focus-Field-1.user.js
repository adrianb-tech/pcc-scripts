// ==UserScript==
// @version 1.0
// @updateURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-Auto-Check-NEW-Focus-Field-1.user.js
// @downloadURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-Auto-Check-NEW-Focus-Field-1.user.js
// @name         PCC - Auto-Check NEW & Focus Field 1
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

    function findNewOption() {
        return Array.from(document.querySelectorAll('input[type="radio"], input[type="checkbox"]')).find(function (el) {
            var label = el.labels && el.labels[0] ? el.labels[0].innerText : '';
            var text = (label || (el.parentElement ? el.parentElement.innerText : '') || el.value || '').trim();
            return /^new\b/i.test(text);   // starts with the word "new"; not "renewal" or "news"
        });
    }

    function run() {
        if (done) return;
        if (userTouched) { done = true; return; }
        if (!isBoroPark()) return;

        var opt = findNewOption();
        if (!opt) return;   // not the NEW form (yet): do nothing, focus nothing

        var answered = opt.type === 'radio' && opt.name &&
            Array.from(document.querySelectorAll('input[type="radio"][name="' + opt.name + '"]')).some(function (r) { return r.checked; });
        if (!answered && !opt.checked) opt.click();

        var first = document.querySelector('input[type="text"]:not([readonly]), textarea:not([readonly])');
        if (first && !userTouched) first.focus();
        done = true;
    }

    var timer = setInterval(function () {
        run();
        if (done) clearInterval(timer);
    }, 300);
    setTimeout(function () { clearInterval(timer); }, 8000);   // never poll past 8s
})();