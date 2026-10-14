// ==UserScript==
// @name         Every facility — Bedford + Crown Heights — Consult defaults
// @namespace    mica.pcc
// @version      1.6
// @description  Bedford + Crown Heights: readies the Consult-Psychiatry 1.0 form to adrian's standard state, and autofills the New-form popup. Runs ONCE, after the form has fully loaded — the patient timing the original script used (the fast burst fired before PCC registered the clicks, which is what desynced 3F from F1 on copied forms).
// @match        https://*.pointclickcare.com/care/chart/mds/mdssection.jsp*
// @match        https://*.pointclickcare.com/care/chart/assess/newassess.jsp*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
(function() {
  'use strict';

  // ============ THE FORM — adrian's standard state (his words, 2026-10-14) ============
  // EVERY open (fresh or copied):
  //   - 3D GDR = No, 3F new recommendations = No (radios)
  //   - every "question reviewed" ack gets clicked
  //   - F1 text and E. Plan text: never touched (the plan lives in the note)
  // FRESH form only (nothing written yet):
  //   - every checkbox cleared (Reason, B4a, MSE, ROS, D1 — all of them)
  //   - then the standard set is checked:
  //       3C Assessment: a. Chart Reviewed + b. Labs and Workup Noted
  //       3C1 Care Coordinated With: e. Nursing
  // COPIED / follow-up form: checkboxes stay EXACTLY as copied
  //   (D1 included — "in a follow up, D1 should remain what it was previously").
  // G. Psychotherapy: never touched.
  // Runs once, ~1s after the form's controls exist. Anything he changes
  // by hand afterwards is never re-asserted.

  function byId(id) { return document.getElementById(id); }

  // Click only when the control isn't already in the wanted state —
  // a click TOGGLES a checkbox, so an unguarded click can turn OFF
  // what should be ON.
  function setChecked(el, want) {
    if (el && !!el.checked !== !!want) el.click();
  }

  function radioByValue(name, value) {
    var els = document.querySelectorAll('input[type="radio"][name="' + name + '"]');
    for (var i = 0; i < els.length; i++) if (els[i].value === value) return els[i];
    return null;
  }

  // The short option label printed right after a checkbox
  // ("a. Chart Reviewed", "e. Nursing", ...).
  function optionLabel(input) {
    var node = input.nextSibling, txt = '';
    while (node && txt.length < 60) {
      txt += (node.textContent || '') + ' ';
      node = node.nextSibling;
    }
    return txt.replace(/\s+/g, ' ').trim();
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
    // --- every open ---
    setChecked(radioByValue('Cust_3_D', 'b'), true); // GDR: No
    setChecked(radioByValue('Cust_3_F', 'b'), true); // New recommendations: No
    var acks = document.querySelectorAll('img.qcheck');
    for (var i = 0; i < acks.length; i++) { try { acks[i].click(); } catch (e) {} }

    // --- fresh form only: clean slate, then the standard set ---
    if (!formLooksBlank()) return;
    var boxes = document.querySelectorAll('input[type="checkbox"]');
    for (var j = 0; j < boxes.length; j++) setChecked(boxes[j], false);
    for (var k = 0; k < boxes.length; k++) {
      var label = optionLabel(boxes[k]);
      if (/chart reviewed/i.test(label) ||
          /labs and workup/i.test(label) ||
          /nursing/i.test(label)) {
        setChecked(boxes[k], true);
      }
    }
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
    if (byId('Cust_3_D') || document.querySelector('img.qcheck')) {
      setTimeout(applyForm, 1000); // let PCC finish its own setup first
      return;
    }
    if (++waited < 32) setTimeout(waitForm, 250);
  })();
})();
