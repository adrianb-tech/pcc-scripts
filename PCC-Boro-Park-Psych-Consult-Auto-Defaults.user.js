// ==UserScript==
// @version 1.4
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

    // Auto-check New/Follow Up based on form content, and focus the note field.
    // Empty form -> "New"; form with content -> "Follow Up". Only when none
    // of the three are already checked, and only before the user touches anything.
    function applyEvalTypeAndFocus() {
        if (userTouched) return;
        if (isListPage()) return;
        if (!isBoroPark()) return;

        // Find the three Evaluation Type checkboxes by their labels
        var labels = document.querySelectorAll('label');
        var cbNew = null, cbFollow = null, cbOther = null;
        // Also try inputs with adjacent text
        var inputs = document.querySelectorAll('input[type="checkbox"]');
        for (var i = 0; i < inputs.length; i++) {
            var inp = inputs[i];
            var txt = '';
            // Check associated label, parent text, or following sibling text
            if (inp.id) {
                var lbl = document.querySelector('label[for="' + inp.id + '"]');
                if (lbl) txt = lbl.textContent;
            }
            if (!txt && inp.parentElement) txt = inp.parentElement.textContent;
            if (!txt && inp.nextSibling) txt = inp.nextSibling.textContent || '';
            txt = (txt || '').replace(/\s+/g, ' ').trim();
            if (/^1\.\s*New$/i.test(txt)) cbNew = inp;
            else if (/^2\.\s*Follow\s*Up$/i.test(txt)) cbFollow = inp;
            else if (/^3\.\s*Other$/i.test(txt)) cbOther = inp;
        }
        if (!cbNew || !cbFollow) return;

        // If he explicitly picked "Other", leave it alone.
        if (cbOther && cbOther.checked) {
            focusNoteField();
            return;
        }

        // Find the Psychiatry Consult textarea
        var noteField = findNoteField();
        var hasContent = noteField && noteField.value.trim().length > 0;

        // Content -> Follow Up checked, New unchecked. Empty -> New checked.
        // Actively switch even if PCC defaulted to New.
        var wantFollow = hasContent;
        if (wantFollow && !cbFollow.checked) {
            if (cbNew.checked) cbNew.click();
            cbFollow.click();
        } else if (!wantFollow && !cbNew.checked) {
            if (cbFollow.checked) cbFollow.click();
            cbNew.click();
        }

        focusNoteField();
    }

    function findNoteField() {
        // Look for the textarea after "Psychiatry Consult" label
        var els = document.querySelectorAll('td, th, div, span, label, b');
        for (var i = 0; i < els.length; i++) {
            var t = (els[i].textContent || '').replace(/\s+/g, ' ').trim();
            if (/^1\.\s*Psychiatry\s+Consult:?$/i.test(t)) {
                // Find the next textarea in document order
                var all = document.querySelectorAll('textarea');
                for (var j = 0; j < all.length; j++) {
                    if (els[i].compareDocumentPosition(all[j]) & Node.DOCUMENT_POSITION_FOLLOWING) {
                        return all[j];
                    }
                }
            }
        }
        // Fallback: largest visible textarea
        var tas = document.querySelectorAll('textarea');
        var best = null, bestArea = 0;
        for (var k = 0; k < tas.length; k++) {
            var r = tas[k].getBoundingClientRect();
            var area = r.width * r.height;
            if (area > bestArea && r.width > 100 && r.height > 50) { bestArea = area; best = tas[k]; }
        }
        return best;
    }

    function focusNoteField() {
        var f = findNoteField();
        if (f) {
            try { f.focus(); } catch(e){}
        }
    }

    // "Reasons for Assessment" popup (NEW form creator): when the Assessment
    // dropdown is set to Psych Consult, default Type of Assessment to Admission.
    function applyPopupDefaults() {
        if (userTouched) return;
        if (!isBoroPark()) return;
        var bodyText = document.body ? document.body.innerText : '';
        if (!/Reasons for Assessment/i.test(bodyText)) return;
        if (!/Type of Assessment/i.test(bodyText)) return;

        var selects = document.querySelectorAll('select');
        var isPsychConsult = false;
        var typeSel = null;
        for (var i = 0; i < selects.length; i++) {
            var sel = selects[i];
            var selText = sel.innerText || sel.textContent || '';
            // The Assessment dropdown (contains "Psych: Consult" option)
            if (/Psych:\s*Consult/i.test(selText)) {
                var cur = sel.options[sel.selectedIndex];
                if (cur && /Psych:\s*Consult/i.test(cur.text)) isPsychConsult = true;
            }
            // The Type of Assessment dropdown (has Admission option)
            if (/Admission/i.test(selText) && !typeSel) typeSel = sel;
        }
        if (!isPsychConsult || !typeSel) return;

        var opts = typeSel.options;
        for (var j = 0; j < opts.length; j++) {
            if (/^admission/i.test(opts[j].text.trim())) {
                if (typeSel.selectedIndex !== j) {
                    typeSel.selectedIndex = j;
                    typeSel.dispatchEvent(new Event('change', { bubbles: true }));
                }
                break;
            }
        }
    }

    applyDefaultsOnce();
    applyPopupDefaults();
    var evalDone = false;
    var timer = setInterval(function () {
        applyDefaultsOnce();
        if (!evalDone && done) {
            evalDone = true;
            setTimeout(applyEvalTypeAndFocus, 400);
        }
        if (done && evalDone) clearInterval(timer);
    }, 300);
    setTimeout(function () { clearInterval(timer); }, 8000);   // never poll past 8s
})();