// ==UserScript==
// @version 1.9
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

        // Find the three Evaluation Type checkboxes: locate the "1. New" / "2. Follow Up"
        // / "3. Other" text nodes, then take the nearest checkbox before each.
        var cbNew = null, cbFollow = null, cbOther = null;
        function checkboxBefore(node) {
            // Walk backwards in document order looking for a checkbox
            var els = document.querySelectorAll('input[type="checkbox"]');
            var best = null;
            for (var k = 0; k < els.length; k++) {
                if (els[k].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) {
                    // els[k] is before node; keep the closest one
                    best = els[k];
                } else {
                    break;
                }
            }
            return best;
        }
        // Also try: checkbox whose parent row/cell text contains the label
        var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        var tn;
        while (tn = walker.nextNode()) {
            var t = (tn.nodeValue || '').replace(/\s+/g, ' ').trim();
            if (/^1\.\s*New$/i.test(t) && !cbNew) {
                cbNew = checkboxBefore(tn);
            } else if (/^2\.\s*Follow\s*Up$/i.test(t) && !cbFollow) {
                cbFollow = checkboxBefore(tn);
            } else if (/^3\.\s*Other$/i.test(t) && !cbOther) {
                cbOther = checkboxBefore(tn);
            }
        }
        // Fallback: check parent containers of each checkbox for label text
        if (!cbNew || !cbFollow) {
            var inputs = document.querySelectorAll('input[type="checkbox"]');
            for (var i = 0; i < inputs.length; i++) {
                var p = inputs[i].parentElement;
                for (var depth = 0; depth < 4 && p; depth++) {
                    var pt = (p.textContent || '').replace(/\s+/g, ' ').trim();
                    if (!cbNew && /\b1\.\s*New\b/i.test(pt) && !/\b2\.\s*Follow/i.test(pt)) cbNew = inputs[i];
                    else if (!cbFollow && /\b2\.\s*Follow\s*Up\b/i.test(pt)) cbFollow = inputs[i];
                    else if (!cbOther && /\b3\.\s*Other\b/i.test(pt)) cbOther = inputs[i];
                    p = p.parentElement;
                }
            }
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

    // "Reasons for Assessment" popup:
    // - New Psych Consult (Assessment dropdown = "Psych: Consult") -> Type = Admission
    // - Follow-up / anything else -> Type = Other
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
            // The Type of Assessment dropdown (has Admission/Other options)
            if (/Admission/i.test(selText) && /Other/i.test(selText) && !typeSel) typeSel = sel;
        }
        if (!typeSel) return;

        var target = isPsychConsult ? 'Admission' : 'Other';
        var opts = typeSel.options;
        var re = new RegExp('^' + target, 'i');
        for (var j = 0; j < opts.length; j++) {
            if (re.test(opts[j].text.trim())) {
                if (typeSel.selectedIndex !== j) {
                    typeSel.selectedIndex = j;
                    typeSel.dispatchEvent(new Event('change', { bubbles: true }));
                }
                break;
            }
        }
    }

    // Fill-request listener: when the chart panel's Allergies Copy button is
    // clicked, it drops {value, ts} in localStorage. Replace "Allergies NKA"
    // (or NKDA / No known allergies / none) in the note with the real value.
    var lastFillTs = 0;
    try { lastFillTs = parseInt(localStorage.getItem('pccFillAllergiesSeen') || '0', 10); } catch(e){}
    function checkFillRequest(){
        var raw = null;
        try { raw = localStorage.getItem('pccFillAllergies'); } catch(e){}
        if (!raw) return;
        var req = null;
        try { req = JSON.parse(raw); } catch(e){}
        if (!req || !req.value || !req.ts || req.ts <= lastFillTs) return;
        // Only honor fresh requests (within 60s) to avoid stale fills
        if (Date.now() - req.ts > 60000) { lastFillTs = req.ts; return; }
        lastFillTs = req.ts;
        try { localStorage.setItem('pccFillAllergiesSeen', String(req.ts)); } catch(e){}

        var noteField = findNoteField();
        if (!noteField) return;
        var txt = noteField.value;
        // Match "Allergies NKA" / "Allergies: NKDA" / "Allergies none" etc. (line-based)
        var re = /^(\s*Allergies\s*:?\s*)(NKA|NKDA|No\s+known\s+(?:drug\s+)?allergies|none)\s*$/gim;
        if (!re.test(txt)) return;
        var updated = txt.replace(re, function(m, prefix){ return prefix + req.value; });
        if (updated !== txt) {
            noteField.value = updated;
            noteField.dispatchEvent(new Event('input', { bubbles: true }));
            noteField.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }
    setInterval(checkFillRequest, 500);

    applyDefaultsOnce();
    applyPopupDefaults();
    var evalDone = false;
    var timer = setInterval(function () {
        applyDefaultsOnce();
        applyPopupDefaults();
        // Run eval-type logic independently — the form page has no dropdowns,
        // so it must not wait on applyDefaultsOnce()'s done flag.
        if (!evalDone && !userTouched && !isListPage() && isBoroPark() && document.readyState !== 'loading') {
            evalDone = true;
            setTimeout(applyEvalTypeAndFocus, 400);
        }
        if (done && evalDone) clearInterval(timer);
    }, 300);
    setTimeout(function () { clearInterval(timer); }, 8000);   // never poll past 8s

    // G key: fill the Psych Consult note from the chart snapshot (Panel A).
    // Context-aware replacements — no template changes needed.
    function snapshotResidentId(){
        try {
            var txt = document.body ? (document.body.textContent || '') : '';
            var re = /[A-Za-z][A-Za-z'’.\-]*\s*,\s*[A-Za-z][A-Za-z'’.\- ]*?\(\s*([A-Za-z]{0,5}\d{3,})\s*\)/g;
            var m, ids = {}, order = [];
            while ((m = re.exec(txt))) { var id = m[1].toLowerCase(); if (!ids[id]) { ids[id] = 1; order.push(m[1]); } }
            return order.length === 1 ? order[0] : null;
        } catch(e){ return null; }
    }

    function fillNoteFromSnapshot(){
        var id = snapshotResidentId();
        if (!id) return;
        var snap = null;
        try {
            var s = localStorage.getItem('pccSnap_' + id.toLowerCase());
            snap = s ? JSON.parse(s) : null;
        } catch(e){}
        // Fallback: try case as-is
        if (!snap) {
            try {
                var s2 = localStorage.getItem('pccSnap_' + id);
                snap = s2 ? JSON.parse(s2) : null;
            } catch(e){}
        }
        if (!snap) return;

        var noteField = findNoteField();
        if (!noteField) return;
        var txt = noteField.value;
        var orig = txt;

        // 1. "HPI xx" -> "HPI 89M" (age + sex letter)
        if (snap.age && snap.sex) {
            var sexL = /^f/i.test(snap.sex) ? 'F' : 'M';
            txt = txt.replace(/^([ \t]*HPI[ \t]+)xx\b/gim, '$1' + snap.age + sexL);
        }
        // 2. Diagnoses after "Medical Hx" line
        if (snap.dx) {
            txt = txt.replace(/^([ \t]*Medical Hx[ \t]*)$/gim, function(m, p1){
                // Don't duplicate if diagnoses already there
                return p1 + '\n' + snap.dx;
            });
        }
        // 3. "Primary contact xx" -> "Primary contact <name>"
        if (snap.primaryContact) {
            txt = txt.replace(/^([ \t]*Primary contact[ \t]+)xx\b/gim, '$1' + snap.primaryContact);
        }
        // 4. "Psych meds\n- none" -> "Psych meds\n- <meds>"
        if (snap.meds) {
            txt = txt.replace(/^([ \t]*Psych meds[ \t]*\n[ \t]*-[ \t]*)none[ \t]*$/gim, '$1' + snap.meds);
        }
        // 5. "Allergies NKA" -> "Allergies <value>" (also handled by fill request)
        if (snap.allergies && snap.allergies !== 'NKA') {
            txt = txt.replace(/^([ \t]*Allergies[ \t]*:?\s*)(NKA|NKDA|No\s+known\s+(?:drug\s+)?allergies|none)\s*$/gim,
                function(m, prefix){ return prefix + snap.allergies; });
        }
        // 6. BIMS "15 on xx" -> "15 on 9/10/26"
        if (snap.bims) {
            // snap.bims might be "15" or "15 on 9/10/26" — extract date if present
            var bimsDate = snap.bims;
            var dm = snap.bims.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
            if (dm) bimsDate = dm[1];
            else bimsDate = snap.bims;  // use as-is if no date
            txt = txt.replace(/\b(\d{1,2}[ \t]+on[ \t]+)xx\b/gim, '$1' + bimsDate);
        }

        if (txt !== orig) {
            noteField.value = txt;
            noteField.dispatchEvent(new Event('input', { bubbles: true }));
            noteField.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    document.addEventListener('keydown', function(e){
        if (!e.isTrusted) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        var t = e.target;
        var tag = (t && t.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || (t && t.isContentEditable)) return;
        if (e.key !== 'g' && e.key !== 'G') return;
        if (isListPage()) return;
        if (!isBoroPark()) return;
        // Only in the Psych Consult form (has the Evaluation Type checkboxes)
        if (!/A\.\s*Evaluation Type/i.test(document.body ? document.body.innerText : '')) return;
        e.preventDefault();
        fillNoteFromSnapshot();
    }, true);
})();