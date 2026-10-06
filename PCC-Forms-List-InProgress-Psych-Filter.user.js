// ==UserScript==
// @name         PCC Forms List - In Progress Psych Filter
// @namespace    pcc-forms-list-psych
// @version      1.4
// @description  On the facility Forms List: filter Form Type to the psychiatry consult form. Runs once per load. (Tab/sort disabled v1.2 — manual for now.)
// @match        *://*.pointclickcare.com/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-Forms-List-InProgress-Psych-Filter.user.js
// @downloadURL  https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-Forms-List-InProgress-Psych-Filter.user.js
// ==/UserScript==

(function(){
  'use strict';

  // Only run on the facility-level Forms List page (not resident charts)
  function isFormsListPage(){
    try {
      var url = location.href;
      if (/FormsList|In.?Progress.?Forms/i.test(url)) return true;
      var t = document.body ? document.body.innerText : '';
      // Has the tab structure: Scheduled / In Progress / In Progress List
      // and the Form Type filter column
      return /In Progress Forms List/i.test(t) && /Form Type/i.test(t);
    } catch(e){ return false; }
  }

  if (!isFormsListPage()) return;

  var done = false;

  function norm(s){ return (s || '').replace(/\s+/g, ' ').trim(); }

  // (ensureInProgressTab v1.4 defined below, before init)

  // 2. Set the Form Type filter to the psychiatry consult form
  function setPsychFormFilter(){
    try {
      // Find the "Set Filter" under Form Type column
      var els = document.querySelectorAll('a, span, div, button');
      var filterBtn = null;
      for (var i = 0; i < els.length; i++) {
        var t = norm(els[i].textContent);
        if (t === 'Set Filter' && els[i].children.length === 0) {
          // Check if this is under the Form Type column by looking at nearby headers
          var parent = els[i].parentElement;
          var found = false;
          for (var d = 0; d < 3 && parent; d++) {
            if (/Form Type/i.test(parent.textContent) && parent.textContent.length < 200) { found = true; break; }
            parent = parent.parentElement;
          }
          // Simpler: check the table header row
          var table = els[i].closest('table');
          if (table && /Form Type/i.test(table.textContent)) {
            filterBtn = els[i];
            break;
          }
        }
      }
      if (!filterBtn) return false;

      // Click to open the filter dropdown
      filterBtn.click();

      // Wait for dropdown, then find the psychiatry checkbox
      setTimeout(function(){
        try {
          var boxes = document.querySelectorAll('input[type="checkbox"]');
          var target = null;
          for (var i = 0; i < boxes.length; i++) {
            var label = '';
            var lbl = boxes[i].parentElement;
            if (lbl) label = norm(lbl.textContent);
            // Match "Consult Form - Psychiatry" not retired
            // Prefer "Psychiatry 4" (current), fall back to any non-retired psychiatry consult
            if (/Consult Form - Psychiatry/i.test(label) && !/retired/i.test(label)) {
              if (/Psychiatry 4/i.test(label)) { target = boxes[i]; break; }
              if (!target) target = boxes[i];
            }
          }
          if (target && !target.checked) target.click();
          // Look for Apply/OK button in the dropdown and click it
          setTimeout(function(){
            var btns = document.querySelectorAll('button, input[type="button"], input[type="submit"]');
            for (var j = 0; j < btns.length; j++) {
              var bt = norm(btns[j].textContent || btns[j].value);
              if (/^(Apply|OK|Filter)$/i.test(bt) && btns[j].offsetParent !== null) {
                // Only click if it's in a visible dropdown/popup (not the main page Apply)
                var r = btns[j].getBoundingClientRect();
                if (r.width > 0 && r.height > 0) {
                  // Check if there's a filter dropdown open by looking for checkboxes nearby
                  btns[j].click();
                  break;
                }
              }
            }
            // sortScoreAscending re-enabled v1.3 with full mouse events
            setTimeout(sortScoreAscending, 1500);
          }, 500);
        } catch(e){}
      }, 800);
      return true;
    } catch(e){ return false; }
  }

  // 3. Click Score column header to sort ascending (lowest first)
  function sortScoreAscending(){
    try {
      var headers = document.querySelectorAll('th, td');
      for (var i = 0; i < headers.length; i++) {
        var t = norm(headers[i].textContent);
        if (t === 'Score' && headers[i].children.length <= 1) {
          // Use full mouse event sequence — PCC ignores plain .click()
          var th = headers[i];
          function fireClick(el){
            try {
              el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
              el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
              el.click();
            } catch(e){ try { el.click(); } catch(e2){} }
          }
          fireClick(th);
          // Wait and check if we need another click (some grids toggle desc first)
          setTimeout(function(){
            // If the first data row's score is higher than the second, it's descending — click again
            try {
              var rows = document.querySelectorAll('table tr');
              var scores = [];
              for (var r = 0; r < rows.length && scores.length < 3; r++) {
                var cells = rows[r].querySelectorAll('td');
                for (var c = 0; c < cells.length; c++) {
                  var ct = norm(cells[c].textContent);
                  if (/^\d+\.0$/.test(ct)) { scores.push(parseFloat(ct)); break; }
                }
              }
              if (scores.length >= 2 && scores[0] > scores[1]) {
                // Descending — click again for ascending
                for (var k = 0; k < headers.length; k++) {
                  if (norm(headers[k].textContent) === 'Score') { fireClick(headers[k]); break; }
                }
              }
            } catch(e){}
          }, 1000);
          break;
        }
      }
    } catch(e){}
  }

  // Helper: full mouse event click (PCC ignores plain .click())
  function fireClick(el){
    try {
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      el.click();
    } catch(e){ try { el.click(); } catch(e2){} }
  }

  // 1. Click the "In Progress" tab (v1.4: re-enabled with TreeWalker)
  function ensureInProgressTab(){
    try {
      // Already on In Progress? Check the active tab or page title.
      var bodyText = document.body ? document.body.innerText.slice(0, 1000) : '';
      if (/In Progress (Forms )?List/i.test(bodyText)) {
        // Check if "In Progress" tab is the active one (not Scheduled)
        // If the title says "Scheduled List", we're on the wrong tab
        if (/Scheduled List/i.test(bodyText) && !/In Progress List/i.test(bodyText)) {
          // Fall through to click
        } else {
          return true; // already on In Progress
        }
      }
      // Find the "In Progress" tab text node (exact match, not "In Progress List")
      var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
      var tn, tabEl = null;
      while (tn = walker.nextNode()) {
        if ((tn.nodeValue || '').trim() === 'In Progress') {
          var el = tn.parentElement;
          if (el && norm(el.textContent).length < 30) { tabEl = el; break; }
        }
      }
      if (!tabEl) return false;
      // Find clickable ancestor
      var clickable = tabEl;
      for (var d = 0; d < 5 && clickable; d++) {
        var tag = clickable.tagName;
        if (tag === 'A' || tag === 'BUTTON' || clickable.onclick || clickable.getAttribute('onclick') ||
            clickable.getAttribute('role') === 'tab') break;
        clickable = clickable.parentElement;
      }
      if (!clickable) clickable = tabEl;
      fireClick(clickable);
      return true;
    } catch(e){ return false; }
  }

  // Main: SEQUENCED — tab first, wait, filter, wait, sort (v1.4)
  function init(){
    if (done) return;
    done = true;
    // Step 1: click In Progress tab
    ensureInProgressTab();
    // Step 2: after 3s (list loads), set the psych form filter
    setTimeout(function(){
      setPsychFormFilter();
      // Step 3: after 3 more seconds (filter applies), sort Score ascending
      // (sortScoreAscending is called inside setPsychFormFilter's completion,
      // but we also trigger it here as a backup)
      setTimeout(sortScoreAscending, 3000);
    }, 3000);
  }

  // Wait for the page to be ready
  if (document.readyState === 'complete') {
    setTimeout(init, 1000);
  } else {
    window.addEventListener('load', function(){ setTimeout(init, 1000); });
  }
})();
