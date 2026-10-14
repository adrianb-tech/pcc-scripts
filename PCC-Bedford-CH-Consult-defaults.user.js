// ==UserScript==
// @name         Every facility — Bedford + Crown Heights — Consult defaults
// @namespace    mica.pcc
// @version      1.7
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
    setChecked(control('radio', 'Cust_3_D', 'b'), true); // GDR: No
    setChecked(control('radio', 'Cust_3_F', 'b'), true); // New recommendations: No
    var acks = document.querySelectorAll('a.qcheck');
    for (var i = 0; i < acks.length; i++) { try { acks[i].click(); } catch (e) {} }

    if (!formLooksBlank()) return; // worked / copied form: checks stay as they are
    var boxes = document.querySelectorAll('input[type="checkbox"][name^="Cust_"]');
    for (var j = 0; j < boxes.length; j++) setChecked(boxes[j], false);
    setChecked(control('checkbox', 'Cust_3_C', 'a'), true);  // Chart Reviewed
    setChecked(control('checkbox', 'Cust_3_C', 'b'), true);  // Labs and Workup Noted
    setChecked(control('checkbox', 'Cust_3_C1', 'e'), true);  // Care coordinated: Nursing
  }

  // ============ NEW-FORM POPUP (his ask, 2026-10-14) ============
  // Clicking New opens PCC's "Reasons for Form" popup preselected to
  // the wrong form. Set Form = 'Consult-Psychiatry 1.0' and Type of
  // Form = 'Initial'. One-shot at open; facility-gated through the
  // opener (the popup itself carries no facility name).
  function setSelectByLabel(labelText, optionText) {
    var labels = document.querySelectorAll('td, div, span, label');
    for (var i = 0; i < labels.length; i++) {
      if ((labels[i].textContent || '').trim() !== labelText) continue;
      var row = labels[i].closest('tr') || labels[i].parentElement;
      var sel = row ? row.querySelector('select') : null;
      if (!sel) continue;
      for (var j = 0; j < sel.options.length; j++) {
        if ((sel.options[j].text || '').trim() === optionText) {
          if (sel.selectedIndex !== j) {
            sel.selectedIndex = j;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
          }
          return true;
        }
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
  function runPopup() {
    if (!popupFacilityOk()) return;
    if (setSelectByLabel('Form:', 'Consult-Psychiatry 1.0')) {
      setTimeout(function() { setSelectByLabel('Type of Form:', 'Initial'); }, 350);
    }
  }

  // ============ RUN — once, patiently ============
  if (/newassess\.jsp/.test(location.pathname)) {
    var tries = 0;
    (function waitPopup() {
      runPopup();
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
