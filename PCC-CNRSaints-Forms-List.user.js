// ==UserScript==
// @name         CNR + Saints — Forms List (one pass)
// @namespace    pcc-forms-list-psych-cnrsaints
// @version      1.0
// @description  CNR/Saints ONLY. Forms List: ONE pass — switch to In Progress tab + filter to exactly "Consult Form - Psychiatry 4 - V 1" — then stop. No sort, no highlight, no retries (adrian orders the list himself). At every other facility this script does nothing; the shared Forms List script stands down here.
// @match        *://*.pointclickcare.com/*
// @grant        none
// @updateURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-CNRSaints-Forms-List.user.js
// @downloadURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-CNRSaints-Forms-List.user.js
// ==/UserScript==

(function(){
  'use strict';

  function norm(s){ return (s || '').replace(/\s+/g, ' ').trim(); }

  function isFormsPage(){
    try {
      var url = location.href;
      if (/Forms/i.test(url)) return true;
      var t = document.body ? document.body.innerText.slice(0, 2000) : '';
      return /Forms (List|Schedules)/i.test(t);
    } catch(e){ return false; }
  }

  if (!isFormsPage()) return;

  // CNR/Saints ONLY (header shows "Downtown Brooklyn Nursing & Rehabilitation
  // Center" for CNR; "Saints Joachim & Anne" for Saints)
  function isCNRSaints(){
    try {
      var t = document.body ? document.body.innerText.slice(0, 4000) : '';
      if (/Downtown Brooklyn/i.test(t)) return true;
      if (/Saints Joachim/i.test(t)) return true;
      if (/Joachim\s*&\s*Anne/i.test(t)) return true;
    } catch(e){}
    return false;
  }
  if (!isCNRSaints()) return;

  var EXACT_FORM = 'Consult Form - Psychiatry 4 - V 1';

  // Full mouse event click — PCC ignores plain .click()
  function fireClick(el){
    try {
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      if (el.click) el.click();
    } catch(e){ try { el.click(); } catch(e2){} }
  }

  // --- STEP 1: Switch to In Progress tab ---
  var tabClicked = false;
  function ensureInProgressTab(){
    if (tabClicked) return;
    try {
      var bodyText = document.body ? document.body.innerText.slice(0, 2000) : '';
      // Already on In Progress? (title says "In Progress List", not "Scheduled List")
      if (/In Progress List/i.test(bodyText) && !/Scheduled List/i.test(bodyText)) return;
      if (/Scheduled List/i.test(bodyText)) {
        // We're on Scheduled — find and click the In Progress tab
        var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        var tn, tabEl = null;
        while (tn = walker.nextNode()) {
          if ((tn.nodeValue || '').trim() === 'In Progress') {
            var el = tn.parentElement;
            if (el && norm(el.textContent).length < 30) { tabEl = el; break; }
          }
        }
        if (tabEl) {
          var clickable = tabEl;
          for (var d = 0; d < 6 && clickable; d++) {
            var tag = clickable.tagName;
            if (tag === 'A' || tag === 'BUTTON' || tag === 'TD' || tag === 'LI' ||
                clickable.onclick || clickable.getAttribute('onclick')) break;
            clickable = clickable.parentElement;
          }
          if (!clickable) clickable = tabEl;
          tabClicked = true;
          fireClick(clickable);
        }
      }
    } catch(e){}
  }

  // --- STEP 2: Set Form Type filter to the exact CNR/Saints form ---
  var filterDone = false;
  function setPsychFormFilter(){
    if (filterDone) return;
    try {
      // Check if filter is already set to the exact form
      var inputs = document.querySelectorAll('input, select');
      for (var i = 0; i < inputs.length; i++) {
        var v = inputs[i].value || '';
        if (norm(v).toLowerCase() === EXACT_FORM.toLowerCase()) { filterDone = true; return; }
      }
      // Find "Set Filter" under Form Type
      var els = document.querySelectorAll('a, span, div, button');
      for (var j = 0; j < els.length; j++) {
        if (norm(els[j].textContent) === 'Set Filter' && els[j].children.length === 0) {
          var table = els[j].closest('table');
          if (table && /Form Type/i.test(table.textContent)) {
            fireClick(els[j]);
            // Wait for dropdown, check the exact form only
            setTimeout(function(){
              var boxes = document.querySelectorAll('input[type="checkbox"]');
              var target = null;
              for (var k = 0; k < boxes.length; k++) {
                var lbl = boxes[k].parentElement ? norm(boxes[k].parentElement.textContent) : '';
                if (lbl.toLowerCase() === EXACT_FORM.toLowerCase()) { target = boxes[k]; break; }
              }
              if (target && !target.checked) fireClick(target);
              // Click Apply/OK — then STOP (one pass, no sort, no highlight, no retries)
              setTimeout(function(){
                var btns = document.querySelectorAll('button, input[type="button"]');
                for (var m = 0; m < btns.length; m++) {
                  var bt = norm(btns[m].textContent || btns[m].value);
                  if (/^(Apply|OK)$/i.test(bt) && btns[m].offsetParent !== null) {
                    fireClick(btns[m]);
                    filterDone = true;
                    break;
                  }
                }
              }, 500);
            }, 800);
            return;
          }
        }
      }
    } catch(e){}
  }

  // --- Main sequence: one pass, then done ---
  function init(){
    ensureInProgressTab();
    setTimeout(setPsychFormFilter, 2500);
  }

  if (document.readyState === 'complete') {
    setTimeout(init, 1500);
  } else {
    window.addEventListener('load', function(){ setTimeout(init, 1500); });
  }
})();
