// ==UserScript==
// @name         PCC Forms List - In Progress Psych Filter
// @namespace    pcc-forms-list-psych
// @version      1.2
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

  // 1. Click the "In Progress" sub-tab if it's not active
  function ensureInProgressTab(){
    try {
      // Find tabs: Scheduled, In Progress, In Progress List
      var tabs = document.querySelectorAll('a, span, div, td, li');
      var inProgTab = null, scheduledActive = false;
      for (var i = 0; i < tabs.length; i++) {
        var t = norm(tabs[i].textContent);
        // Match the tab element itself (short text, not containing other content)
        if (t === 'In Progress' && tabs[i].children.length === 0) {
          inProgTab = tabs[i];
        }
      }
      if (!inProgTab) return false;
      // Check if it's already active (has active class or is bold/highlighted)
      var cls = (inProgTab.className || '') + ' ' + ((inProgTab.parentElement || {}).className || '');
      if (/active|selected|current/i.test(cls)) return true; // already on it
      // Click it
      inProgTab.click();
      return true;
    } catch(e){ return false; }
  }

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
            // sortScoreAscending disabled v1.2
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
          // Click once for ascending; check current sort direction
          // If it has a sort indicator, click until ascending
          headers[i].click();
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
                  if (norm(headers[k].textContent) === 'Score') { headers[k].click(); break; }
                }
              }
            } catch(e){}
          }, 1000);
          break;
        }
      }
    } catch(e){}
  }

  // Main: run once per page load, with delays for PCC's AJAX
  function init(){
    if (done) return;
    done = true;
    // Step 1: ensure In Progress tab (immediate)
    // ensureInProgressTab(); // DISABLED v1.2 — was not working, keep manual
    // Step 2+3: filter and sort after the list loads
    setTimeout(setPsychFormFilter, 2000);
  }

  // Wait for the page to be ready
  if (document.readyState === 'complete') {
    setTimeout(init, 1000);
  } else {
    window.addEventListener('load', function(){ setTimeout(init, 1000); });
  }
})();
