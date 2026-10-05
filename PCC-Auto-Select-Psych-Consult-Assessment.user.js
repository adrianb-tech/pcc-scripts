// ==UserScript==
// @version 1.0
// @updateURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-Auto-Select-Psych-Consult-Assessment.user.js
// @downloadURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-Auto-Select-Psych-Consult-Assessment.user.js
// @name         PCC - Auto-Select Psych Consult Assessment
// @match        https://*.pointclickcare.com/*
// @run-at       document-start
// @allFrames    true
// @grant        none
// ==/UserScript==

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