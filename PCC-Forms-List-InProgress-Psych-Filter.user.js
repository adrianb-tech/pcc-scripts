// ==UserScript==
// @name         PCC Forms List - In Progress Psych Filter
// @namespace    pcc-forms-list-psych
// @version      2.1
// @description  Forms List: auto-switch to In Progress tab, filter to psychiatry consult form. (Sort/highlight disabled v2.1 — manual.)
// @match        *://*.pointclickcare.com/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-Forms-List-InProgress-Psych-Filter.user.js
// @downloadURL  https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-Forms-List-InProgress-Psych-Filter.user.js
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

  // --- STEP 2: Set Form Type filter to psychiatry consult ---
  var filterDone = false;
  function setPsychFormFilter(){
    if (filterDone) return;
    try {
      // Check if filter is already set
      var inputs = document.querySelectorAll('input, select');
      for (var i = 0; i < inputs.length; i++) {
        var v = inputs[i].value || '';
        if (/Consult Form - Psychiatry/i.test(v)) { filterDone = true; return; }
      }
      // Find "Set Filter" under Form Type
      var els = document.querySelectorAll('a, span, div, button');
      for (var j = 0; j < els.length; j++) {
        if (norm(els[j].textContent) === 'Set Filter' && els[j].children.length === 0) {
          var table = els[j].closest('table');
          if (table && /Form Type/i.test(table.textContent)) {
            fireClick(els[j]);
            // Wait for dropdown, select psychiatry
            setTimeout(function(){
              var boxes = document.querySelectorAll('input[type="checkbox"]');
              var target = null;
              for (var k = 0; k < boxes.length; k++) {
                var lbl = boxes[k].parentElement ? norm(boxes[k].parentElement.textContent) : '';
                if (/Consult Form - Psychiatry/i.test(lbl) && !/retired/i.test(lbl)) {
                  if (/Psychiatry 4/i.test(lbl)) { target = boxes[k]; break; }
                  if (!target) target = boxes[k];
                }
              }
              if (target && !target.checked) fireClick(target);
              // Click Apply/OK
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

  // --- STEP 3: Sort by Score ascending ---
  var sortAttempts = 0;
  function sortScoreAscending(){
    if (sortAttempts >= 3) return;
    sortAttempts++;
    try {
      var tables = document.querySelectorAll('table');
      for (var ti = 0; ti < tables.length; ti++) {
        var headers = tables[ti].querySelectorAll('th');
        for (var hi = 0; hi < headers.length; hi++) {
          if (norm(headers[hi].textContent) === 'Score') {
            fireClick(headers[hi]);
            // Verify after 2s, retry if not sorted
            (function(table, th, idx){
              setTimeout(function(){
                try {
                  var scores = getColumnScores(table, idx, 3);
                  if (scores.length >= 2 && scores[0] > scores[1]) {
                    sortScoreAscending(); // retry
                  }
                } catch(e){}
              }, 2000);
            })(tables[ti], headers[hi], hi);
            return;
          }
        }
      }
    } catch(e){}
  }

  function getColumnScores(table, colIdx, max){
    var scores = [];
    var rows = table.querySelectorAll('tr');
    for (var r = 0; r < rows.length && scores.length < max; r++) {
      var tds = rows[r].querySelectorAll('td');
      if (tds.length <= colIdx) continue;
      var m = norm(tds[colIdx].textContent).match(/^(\d+(?:\.\d+)?)/);
      if (m) scores.push(parseFloat(m[1]));
    }
    return scores;
  }

  // --- STEP 4: Highlight Score 1.0 rows (runs on every table change) ---
  function highlightScoreOnes(){
    try {
      var tables = document.querySelectorAll('table');
      for (var ti = 0; ti < tables.length; ti++) {
        var headers = tables[ti].querySelectorAll('th');
        var scoreIdx = -1;
        for (var hi = 0; hi < headers.length; hi++) {
          if (norm(headers[hi].textContent) === 'Score') { scoreIdx = hi; break; }
        }
        if (scoreIdx === -1) continue;
        var rows = tables[ti].querySelectorAll('tr');
        for (var r = 0; r < rows.length; r++) {
          var tds = rows[r].querySelectorAll('td');
          if (tds.length <= scoreIdx) continue;
          var v = norm(tds[scoreIdx].textContent);
          if (v === '1.0' || v === '1') {
            rows[r].style.backgroundColor = '#fff9c4';
            rows[r].style.outline = '2px solid #f9a825';
            rows[r].style.outlineOffset = '-2px';
          }
        }
      }
    } catch(e){}
  }

  // --- MutationObserver: re-apply highlighting whenever the table changes ---
  // (handles pagination, sorting, filtering — all AJAX)
  var observer = new MutationObserver(function(mutations){
    var shouldHighlight = false;
    for (var i = 0; i < mutations.length; i++) {
      if (mutations[i].addedNodes.length > 0) { shouldHighlight = true; break; }
    }
    if (shouldHighlight) {
      // Debounce: wait for the table to settle
      clearTimeout(observer._t);
      observer._t = setTimeout(highlightScoreOnes, 500);
    }
  });

  // --- Main sequence ---
  function init(){
    // Step 1: tab (immediate)
    ensureInProgressTab();
    // Step 2: filter (after tab loads)
    setTimeout(setPsychFormFilter, 2500);
    // Step 3: sort DISABLED v2.1 — was mis-ordering
    // setTimeout(sortScoreAscending, 6000);
    // Step 4: highlight DISABLED v2.1 — was bordering all rows
    // setTimeout(highlightScoreOnes, 9000);
    // Watch for changes (pagination, etc.)
    // MutationObserver DISABLED v2.1 — was causing infinite loop
    // try {
    //   observer.observe(document.body, { childList: true, subtree: true });
    // } catch(e){}
  }

  if (document.readyState === 'complete') {
    setTimeout(init, 1500);
  } else {
    window.addEventListener('load', function(){ setTimeout(init, 1500); });
  }
})();
