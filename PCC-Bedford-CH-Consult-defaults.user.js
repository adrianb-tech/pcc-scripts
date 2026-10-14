// ==UserScript==
// @name         Every facility — Bedford + Crown Heights — Consult defaults
// @namespace    mica.pcc
// @version      1.16
// @description  Bedford + Crown Heights: readies the Consult-Psychiatry 1.0 form to adrian's standard state, and autofills the New-form popup. Every target is aimed by its real field name from the form's own markup (captured 2026-10-14). Runs ONCE, ~1s after the form loads — PCC's show/hide rules only register real clicks made after its own setup finishes.
// @match        https://*.pointclickcare.com/care/chart/mds/mdssection.jsp*
// @match        https://*.pointclickcare.com/care/chart/assess/newassess.jsp*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
(function() {
  'use strict';

  // ============ THE FORM — adrian's standard state (his words, 2026-10-14) ============
  // Markup facts (from his captured form page, 2026-10-14):
  //   - PCC pre-sets a FRESH form to: Reason = a (Psychiatric Evaluation),
  //     3D GDR = No, 3F new recommendations = YES. Everything else empty.
  //   - Every input's onclick runs PCC's trigger chain (checkTrigger +
  //     applyShowHideRules) — only a real .click() registers a change
  //     with PCC; setting .checked directly is what desynced 3F from F1.
  //   - The "question reviewed" acks are <a class="qcheck"> links
  //     (questionReviewed), NOT images — the old img.qcheck selector
  //     never matched anything on this form.
  // EVERY open (fresh or copied):
  //   - 1A Reason = a (Psychiatric Evaluation) CHECKED (his rule,
  //     2026-10-14 14:42 — NEW and follow-up alike; this restores the
  //     original script, which always set it)
  //   - 3D GDR = No, 3F new recommendations = No
  //   - every qcheck ack link gets clicked
  //   - F1 text and E. Plan text: never touched (the plan lives in the note)
  // FRESH form only (no textarea holds anything yet — PCC pre-fills none):
  //   - every Cust_* checkbox cleared (Reason, B4a, MSE, ROS, D1 — all)
  //   - then the standard set: 3C a+b (Chart Reviewed, Labs and Workup
  //     Noted) and 3C1 e (Nursing) checked
  // COPIED / follow-up form: checkboxes stay EXACTLY as copied
  //   (D1 included — "in a follow up, D1 should remain what it was previously").
  // G. Psychotherapy: never touched.
  // Clicks are state-guarded: a click TOGGLES a checkbox, so the script
  // only clicks a control that isn't already in the wanted state.

  function control(kind, name, value) {
    return document.querySelector(
      'input[type="' + kind + '"][name="' + name + '"][value="' + value + '"]');
  }
  function setChecked(el, want) {
    if (el && !!el.checked !== !!want) el.click();
  }
  function formLooksBlank() {
    var areas = document.querySelectorAll('textarea');
    for (var i = 0; i < areas.length; i++) {
      if (areas[i].disabled || areas[i].readOnly) continue;
      if ((areas[i].value || '').trim().length > 10) return false;
    }
    return true;
  }

  function applyForm() {
    setChecked(control('checkbox', 'Cust_1_A', 'a'), true); // Reason: Psychiatric Evaluation (always)
    // 3C / 3C1 are NOT set — his rule, stated plainly 2026-10-14
    // 15:09: "chart reviewed, labs and workup noted, and nursing
    // ... should not be checked." (They were my inference from his
    // note prose in v1.6/v1.13 — never his ask. The note text says
    // those things; the form boxes stay empty.) On a fresh form the
    // clear below leaves them empty; on a copy they stay as copied.
    setChecked(control('radio', 'Cust_3_D', 'b'), true); // GDR: No
    setChecked(control('radio', 'Cust_3_F', 'b'), true); // New recommendations: No
    var acks = document.querySelectorAll('a.qcheck');
    for (var i = 0; i < acks.length; i++) { try { acks[i].click(); } catch (e) {} }

    if (!formLooksBlank()) return; // worked / copied form: checks stay as they are
    var boxes = document.querySelectorAll('input[type="checkbox"][name^="Cust_"]');
    for (var j = 0; j < boxes.length; j++) setChecked(boxes[j], false);
    setChecked(control('checkbox', 'Cust_1_A', 'a'), true);  // Reason: Psychiatric Evaluation
  }

  // ============ REASONS-FOR-FORM POPUP (newassess.jsp) ============
  // Markup facts (his captured popups, 2026-10-14): one page, two modes,
  // told apart by the hidden ESOLsave field — "N" = NEW (has the Form
  // select, name "std_assessment", 47 forms with numeric ids), "C" =
  // COPY (no Form select; Type select "assessment_type" pre-set to
  // Follow Up). Both modes: Save input runs save(document.formSave).
  // Labels sit in their own row, the select in the NEXT row — the Form
  // select is aimed by name, with a first-select-after-the-label fallback.
  function selectAfterLabel(labelText) {
    var all = document.querySelectorAll('td, div, span, strong, label');
    var labelEl = null;
    for (var i = 0; i < all.length; i++) {
      if ((all[i].textContent || '').trim() === labelText) { labelEl = all[i]; break; }
    }
    if (!labelEl) return null;
    var sels = document.querySelectorAll('select');
    for (var j = 0; j < sels.length; j++) {
      if (labelEl.compareDocumentPosition(sels[j]) & Node.DOCUMENT_POSITION_FOLLOWING) return sels[j];
    }
    return null;
  }
  function setSelectOption(sel, optionText) {
    if (!sel) return false;
    for (var j = 0; j < sel.options.length; j++) {
      if ((sel.options[j].text || '').trim() === optionText) {
        if (sel.selectedIndex !== j) {
          sel.selectedIndex = j;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return true;
      }
    }
    return false;
  }
  function popupFacilityOk() {
    try {
      var od = window.opener && window.opener.document;
      var txt = (od && od.body ? od.body.innerText : '').toLowerCase();
      return txt.indexOf('crown heights') !== -1 || txt.indexOf('bedford') !== -1;
    } catch (e) { return false; }
  }
  function popupMode() {
    var h = document.querySelector('input[name="ESOLsave"]');
    return h ? h.value : '';
  }
  function saveButton() {
    var ins = document.querySelectorAll('input[type="button"], input[type="submit"]');
    for (var i = 0; i < ins.length; i++) if ((ins[i].value || '') === 'Save') return ins[i];
    return null;
  }
  function fireClick(el) {
    ['mousedown', 'mouseup', 'click'].forEach(function(type) {
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    });
  }

  // The D (his asks, 2026-10-14): a "D" badge on the popup's Save
  // button, and the D key clicks Save — on BOTH popup modes. Dia won't
  // hand the popup keyboard focus on open, so the working rhythm is
  // Tab (focus lands) then D. Arming: PCC parks focus in the date
  // field, which would make D read as "typing" — until he types or
  // clicks into a field himself, auto-parked text-field focus is
  // handed back to the page body on each arming tick. D fires from
  // body/select/checkbox/button focus; dead only inside a text field
  // he is genuinely editing; no repeats, no modifiers.
  var dPlanted = false;
  function plantD() {
    if (dPlanted || !popupFacilityOk()) return;
    var btn = saveButton();
    if (!btn) return;
    var badge = document.createElement('span');
    badge.textContent = 'D';
    badge.style.cssText = 'display:inline-block;margin-left:6px;padding:1px 7px;' +
      'background:#2f6f4f;color:#fff;border-radius:6px;vertical-align:middle;' +
      'font:600 12px -apple-system,Helvetica,Arial,sans-serif;';
    btn.parentNode.insertBefore(badge, btn.nextSibling);
    dPlanted = true;
    var heTookFocus = false;
    document.addEventListener('input', function() { heTookFocus = true; }, true);
    document.addEventListener('mousedown', function() { heTookFocus = true; }, true);
    var armTicks = 0;
    (function arm() {
      if (!heTookFocus) {
        var a = document.activeElement;
        if (a && a.tagName === 'INPUT' && a.type === 'text') { try { a.blur(); } catch (err) {} }
      }
      if (++armTicks < 12) setTimeout(arm, 200);
    })();
    document.addEventListener('keydown', function(e) {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key !== 'd' && e.key !== 'D') return;
      var a = document.activeElement;
      if (a && a.tagName === 'TEXTAREA') return;
      if (a && a.tagName === 'INPUT' && (a.type === 'text' || a.type === 'password')) return;
      var b = saveButton();
      if (!b) return;
      fireClick(b);
    });
  }

  // COPY mode + READMISSION (his rule, 2026-10-14 15:07): when the
  // resident was readmitted, the copied form starts a new episode —
  // Type must be Initial, not the Follow Up PCC pre-sets. Detected
  // from the chart behind the popup (the READMISSION banner, or
  // PCC's own "Admission (re-entry)" header line). Set ONCE at open.
  var copyTypeDone = false;
  function openerHasReadmission() {
    // ONLY the Readmission flag's own ALERT box counts (v1.16 fix).
    // The v1.14 text search false-fired: PCC's header prints
    // "Admission (re-entry)" for ANY routine re-entry, but the
    // flag's rule — re-entry on/after the last psych form — is the
    // actual readmission test (his report, 2026-10-14 15:33: a plain
    // re-entry got flipped to Initial). The alert box is
    // #tmReadmitBox with big text READMISSION.
    try {
      var od = window.opener && window.opener.document;
      if (!od) return false;
      var box = od.getElementById('tmReadmitBox');
      return !!(box && box.firstChild && /READMISSION/.test(box.firstChild.textContent || ''));
    } catch (e) { return false; }
  }
  function runCopyType() {
    if (copyTypeDone || !popupFacilityOk()) return;
    var typeSel = document.querySelector('select[name="assessment_type"]');
    if (!typeSel) return;
    copyTypeDone = true; // one decision per popup, whatever the state
    if (openerHasReadmission()) setSelectOption(typeSel, 'Initial');
  }

  // NEW mode: plant the D, and autofill Form = Consult-Psychiatry 1.0,
  // Type = Initial. (Live-confirmed 2026-10-14: the popup opens with
  // both already set.)
  function runNewPopup() {
    if (!popupFacilityOk()) return;
    plantD();
    var formSel = document.querySelector('select[name="std_assessment"]') || selectAfterLabel('Form:');
    if (formSel && setSelectOption(formSel, 'Consult-Psychiatry 1.0')) {
      setTimeout(function() {
        var typeSel = document.querySelector('select[name="assessment_type"]') || selectAfterLabel('Type of Form:');
        setSelectOption(typeSel, 'Initial');
      }, 350);
    }
  }

  // ============ RUN — once, patiently ============
  if (/newassess\.jsp/.test(location.pathname)) {
    // Take keyboard focus the moment the popup opens (his F -> D -> F
    // flow): the popup asks its own window to come forward on the
    // first ticks; if Dia ignores programmatic focus, this is a no-op
    // and nothing changes. Stops the moment he touches anything.
    var tries = 0, interacted = false;
    ['keydown', 'mousedown'].forEach(function(ev) {
      document.addEventListener(ev, function() { interacted = true; }, { once: true, capture: true });
    });
    (function waitPopup() {
      if (!interacted && tries < 8) { try { window.focus(); } catch (e) {} }
      if (popupMode() === 'C') { plantD(); runCopyType(); }
      else runNewPopup();
      if (++tries < 20) setTimeout(waitPopup, 250);
    })();
    return;
  }
  var waited = 0;
  (function waitForm() {
    if (control('radio', 'Cust_3_D', 'b') || document.querySelector('a.qcheck')) {
      setTimeout(applyForm, 1000); // let PCC finish its own setup first
      return;
    }
    if (++waited < 32) setTimeout(waitForm, 250);
  })();
})();
