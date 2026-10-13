// ==UserScript==
// @name         Boro Park — Form helpers (open the consult)
// @version      1.0
// @description  BORO PARK ONLY. Two helpers for opening a "Psych: Consult" form, merged into one file: (1) Auto-select — on a blank assessment form, sets Assessment = "Psych: Consult" and Type = Admission (only if untouched), focuses Save; never overrides a form you picked yourself; never touches list pages. (2) Auto-check NEW + focus field 1 — checks the NEW option (unless already answered) and puts the cursor in the first field; cancels entirely if you touch mouse/keyboard first. Both poll briefly and then stop for good.
// @updateURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-Boro-Park-Form-helpers.user.js
// @downloadURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-Boro-Park-Form-helpers.user.js
// @match        https://*.pointclickcare.com/*
// @run-at       document-idle
// @allFrames    true
// @grant        none
// ==/UserScript==

/* ---------- (1) Auto-select Psych: Consult + Admission ---------- */
(function () {
    'use strict';

    var done = false;

    function isListPage() {
        return Array.from(document.querySelectorAll('input[type="button"],input[type="submit"],button')).some(function (b) {
            return /^Apply$/i.test((b.value || b.textContent || '').trim());
        });
    }

    function fire(sel) {
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        if (typeof sel.onchange === 'function') sel.onchange();
    }

    function runAutoFill() {
        if (done) return;
        if (document.readyState === 'loading') return;
        if (!window.location.href.includes('cp_assessment')) return;
        if (isListPage()) return;   // never touch the assessments list filters

        var selects = document.querySelectorAll('select');
        if (!selects.length) return;
        var assessmentSelect = selects[0];
        if (assessmentSelect.options.length <= 1) return;

        var psychIndex = -1;
        for (var i = 0; i < assessmentSelect.options.length; i++) {
            if (/Psych:\s*Consult/i.test(assessmentSelect.options[i].text)) { psychIndex = i; break; }
        }
        if (psychIndex === -1) return;

        var cur = assessmentSelect.selectedIndex;
        if (cur !== psychIndex) {
            if (cur > 0) { done = true; return; }   // you already chose another form: leave it alone
            assessmentSelect.selectedIndex = psychIndex;
            fire(assessmentSelect);
        }
        done = true;

        // Type dropdown: set Admission only if it's still at its default
        if (selects.length > 1) {
            var typeSelect = selects[1];
            if (typeSelect.selectedIndex === 0) {
                for (var j = 0; j < typeSelect.options.length; j++) {
                    if (/Admission/i.test(typeSelect.options[j].text)) {
                        typeSelect.selectedIndex = j;
                        fire(typeSelect);
                        break;
                    }
                }
            }
        }

        var saveBtn = document.querySelector('input[value="Save"], input[type="submit"], button');
        if (saveBtn) saveBtn.focus();
    }

    var interval = setInterval(function () {
        runAutoFill();
        if (done) clearInterval(interval);
    }, 250);
    setTimeout(function () { clearInterval(interval); }, 30000);   // stop polling after 30s
})();

/* ---------- (2) Auto-check NEW + focus field 1 (Boro Park only) ---------- */
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
