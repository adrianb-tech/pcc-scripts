// ==UserScript==
// @version 1.36
// @updateURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-Boro-Park-Consult-defaults.user.js
// @downloadURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-Boro-Park-Consult-defaults.user.js
// @name         Boro Park — Consult form defaults
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
    // Empty form -> "New"; form with content -> "Follow Up".
    // Polls for up to 6s because PCC may load note content via AJAX after page load.
    // Stops if he picks "Other" manually or touches anything.
    var evalPollCount = 0;
    var userChoseEvalType = false;  // set if he clicks New/Follow Up/Other himself
    var evalDone = false;           // set after 3 polls — then NEVER touch again
    function applyEvalTypeAndFocus() {
        // v1.36: evalDone must NOT gate entry - the driver
        // sets evalDone BEFORE its single kick-off call (it
        // is the driver's "already kicked" flag), so the old
        // check made this function return instantly on its
        // only ever call: the Evaluation Type was never set,
        // on any form, ever. Completion is tracked by
        // evalPollCount below, which is what sets evalDone.
        if (userChoseEvalType) return;
        evalPollCount++;
        if (evalPollCount > 3) { evalDone = true; return; }
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
        // Fallback (v1.36, rewritten): pair each option
        // with its checkbox by the form's own contract -
        // the three boxes share name Cust_A_A and carry
        // values 1/2/3 in legend order - or, failing that,
        // by the label in the checkbox's OWN row. The old
        // parent-climb matched the shared options table,
        // whose text holds all three labels, so cbNew,
        // cbFollow and cbOther all landed on the FIRST
        // box: a filled form then checked "New" (the exact
        // opposite of the rule) whenever this path ran.
        if (!cbNew || !cbFollow) {
            var named = document.querySelectorAll('input[type="checkbox"][name="Cust_A_A"]');
            for (var n = 0; n < named.length; n++) {
                if (named[n].value === '1' && !cbNew) cbNew = named[n];
                else if (named[n].value === '2' && !cbFollow) cbFollow = named[n];
                else if (named[n].value === '3' && !cbOther) cbOther = named[n];
            }
        }
        if (!cbNew || !cbFollow) {
            var inputs = document.querySelectorAll('input[type="checkbox"]');
            for (var i = 0; i < inputs.length; i++) {
                var row = inputs[i].closest ? inputs[i].closest('tr') : null;
                var rt = row ? (row.textContent || '').replace(/\s+/g, ' ').trim() : '';
                if (!rt) continue;
                if (!cbNew && /^1\.\s*New\b/i.test(rt)) cbNew = inputs[i];
                else if (!cbFollow && /^2\.\s*Follow\s*Up\b/i.test(rt)) cbFollow = inputs[i];
                else if (!cbOther && /^3\.\s*Other\b/i.test(rt)) cbOther = inputs[i];
            }
        }
        if (!cbNew || !cbFollow) return;
        // If he clicks any of the three himself, stop auto-switching permanently.
        [cbNew, cbFollow, cbOther].forEach(function(cb){
            if (cb && !cb.__tmWatched) {
                cb.__tmWatched = true;
                // Only real user clicks stop the auto-switch; our programmatic
                // .click() calls are untrusted (isTrusted=false) and must not.
                cb.addEventListener('click', function(e){ if (e.isTrusted) userChoseEvalType = true; }, true);
                cb.addEventListener('mousedown', function(e){ if (e.isTrusted) userChoseEvalType = true; }, true);
            }
        });
        // "Other" checked means his explicit choice — stop.
        if (cbOther && cbOther.checked) { userChoseEvalType = true; return; }

        // Find the Psychiatry Consult textarea
        var noteField = findNoteField();
        // If we can't find the note field, do NOTHING — don't assume empty
        // and re-check New. (This was fighting the user.)
        if (!noteField) {
            if (evalPollCount < 3) setTimeout(applyEvalTypeAndFocus, 1000);
            else evalDone = true;
            if (evalPollCount === 1) focusNoteField();
            return;
        }
        var hasContent = noteField.value.trim().length > 0;

        // Simple rule: content -> ONLY Follow Up checked. Empty -> ONLY New checked.
        // Runs every second; his manual checkbox click stops it permanently.
        var wantFollow = hasContent;
        function setCb(cb, want){
            if (!cb || cb.checked === want) return;
            cb.checked = want;
            try { cb.dispatchEvent(new Event('change', { bubbles: true })); } catch(e){}
        }
        // Simple: content -> Follow Up only; empty -> New only.
        // (Reverted 2026-10-05: the off-off-on cycle was costing time.)
        if (wantFollow) {
            setCb(cbNew, false);
            setCb(cbFollow, true);
        } else {
            if (!cbNew.checked && !cbFollow.checked) {
                setCb(cbNew, true);
            }
        }

        // Run 3 times (0s, 1s, 2s) then STOP FOREVER. No fighting.
        if (evalPollCount < 3) {
            setTimeout(applyEvalTypeAndFocus, 1000);
        } else {
            evalDone = true;
        }

        // Focus the note field only on the first pass.
        if (evalPollCount === 1) focusNoteField();
    }

    function findNoteField() {
        // Direct structural paths first (v1.36): on the
        // current form the label is SPLIT - "1." sits in one
        // cell, "Psychiatry Consult:" in the next - so the
        // exact-label match below can never fire, and only
        // the size heuristic was keeping this alive. The
        // note field is the section's question-1 textarea
        // (name Cust_A_1, id linkCust_A_1), and the label
        // span alone is an exact anchor too.
        var direct = document.querySelector('textarea[name="Cust_A_1"], textarea#linkCust_A_1');
        if (direct) return direct;
        var spans = document.querySelectorAll('span, td, th, div, label, b');
        for (var s = 0; s < spans.length; s++) {
            var st = (spans[s].textContent || '').replace(/\s+/g, ' ').trim();
            if (/^Psychiatry\s+Consult:?$/i.test(st)) {
                var tas0 = document.querySelectorAll('textarea');
                for (var j0 = 0; j0 < tas0.length; j0++) {
                    if (spans[s].compareDocumentPosition(tas0[j0]) & Node.DOCUMENT_POSITION_FOLLOWING) return tas0[j0];
                }
            }
        }
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
    // - READMISSION flag present in opener (re-admitted after last psych form) -> Type = Admission
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

        // Check for the actual READMISSION flag element (id tmReadmitBox, mode alert)
        // in the opener — not just the word, which can appear elsewhere.
        var isReadmission = false;
        try {
            var openerDocs = [];
            if (window.opener) { openerDocs.push(window.opener.document); }
            try { if (window.opener && window.opener.top) openerDocs.push(window.opener.top.document); } catch(e){}
            for (var d = 0; d < openerDocs.length && !isReadmission; d++) {
                try {
                    var flagEl = openerDocs[d].getElementById('tmReadmitBox');
                    if (flagEl && flagEl.__mode === 'alert') isReadmission = true;
                } catch(e2){}
            }
        } catch(e){}

        var target = (isPsychConsult || isReadmission) ? 'Admission' : 'Other';
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

    // Fill requests are received by the shared Copy-to-note engine
    // (PCC-All-Copy-to-note) since 2026-10-13 — the receiver moved out of
    // this script so it serves every facility and both form types.

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
            txt = txt.replace(/^([ \t]*HPI[ \t]+)(xx|\d+[MF])\b/gim, '$1' + snap.age + sexL);
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
            txt = txt.replace(/^([ \t]*Psych meds[ \t]*)\n[ \t]*-[ \t]*none[ \t]*$/gim, '$1\n' + snap.meds);
        }
        // 5. "Allergies NKA" -> "Allergies <value>" (also handled by fill request)
        if (snap.allergies && snap.allergies !== 'NKA') {
            txt = txt.replace(/^([ \t]*Allergies[ \t]*:?[ \t]*)(NKA|NKDA|No[ \t]+known[ \t]+(?:drug[ \t]+)?allergies|none)[ \t]*$/gim,
                function(m, prefix){ return prefix + snap.allergies; });
        }
        // 6. "Family/Social Hx xx" -> DISABLED 2026-10-05: was pulling wrong patient's
        // demographics from stale snapshot. Manual fill only until verified.
        if (false && snap.demographics) {
            var d = snap.demographics;
            var parts = [];
            if (d.marital) parts.push(d.marital.toLowerCase());
            if (d.religion) parts.push(d.religion);
            if (d.race) parts.push(d.race.toLowerCase());
            if (d.language) parts.push(d.language);
            if (parts.length) {
                var demoStr = parts.join(', ');
                txt = txt.replace(/^([ \t]*Family\/Social Hx[ \t]+)xx\b/gim, '$1' + demoStr);
            }
        }
        // 7. BIMS — DISABLED 2026-10-05 per Adrian: manual only, never auto-pushed.
        if (false && snap.bims) {
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