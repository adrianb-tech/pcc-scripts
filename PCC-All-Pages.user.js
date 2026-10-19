// ==UserScript==
// @name         Every facility — PCC Pages (forms list & furniture)
// @version      1.0.1
// @description  Stage 3 merge: Forms List 2.5 (incl. last-mode memory), Forms highlight, CNR/Saints Forms List, Readmission flag, Hide unused tabs 1.13 (frozen bar), Hide profile sections, Header emphasis, View All checkbox, Split view - nine page scripts in ONE, each module verbatim and gated to its own page as before. Replaces the nine separate page scripts.
// @updateURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Pages.user.js
// @downloadURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Pages.user.js
// @match        https://*.pointclickcare.com/*
// @match        https://*.pointclickcare.ca/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

// ----- module: PCC-All-Forms-List.user.js -----
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

  // CNR/Saints stand-down: at those two facilities the Forms List is handled
  // entirely by "CNR + Saints — Forms List (one pass)" — this script does nothing there.
  function isCNRSaints(){
    try {
      var t = document.body ? document.body.innerText.slice(0, 4000) : '';
      if (/Downtown Brooklyn/i.test(t)) return true;
      if (/Saints Joachim/i.test(t)) return true;
      if (/Joachim\s*&\s*Anne/i.test(t)) return true;
    } catch(e){}
    return false;
  }
  if (isCNRSaints()) return;

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

  // --- STEP 2B: Last-mode memory (evergreen list) ---
  // His rule (2026-10-19): the list must always fall
  // onto whatever mode he LAST viewed - BIMS lands on
  // BIMS, psych consult lands on psych consult. PCC's
  // own memory keeps resurrecting a mode he looked at
  // once, long ago, and this script's classic forcing
  // never applied to the evergreen list at all. So:
  // LEARN the Type filter from his own changes, and on
  // load RESTORE that exact mode - never a hard-coded
  // favorite, never PCC's stale pick. A saved mode that
  // doesn't exist in this facility's dropdown is simply
  // not applied.
  var modeApplied = false, modeOverridden = false;
  function typeSelect() {
    var sels = document.querySelectorAll('select'), best = null, bestScore = -1;
    for (var i = 0; i < sels.length; i++) {
      var s = sels[i], score = 0, opts = s.options || [];
      for (var j = 0; j < opts.length; j++) {
        if (/consult|bims|psychiatry/i.test(opts[j].textContent || '')) score += 2;
      }
      if (opts.length > 3) score += 1;
      var host = s;
      for (var d = 0; d < 4 && host; d++) {
        host = host.parentElement;
        if (host && /^\s*Type\b/i.test(norm(host.textContent).slice(0, 12))) { score += 4; break; }
      }
      if (score > bestScore) { bestScore = score; best = s; }
    }
    return (best && bestScore >= 4) ? best : null;
  }
  function savedMode() {
    try { var m = JSON.parse(localStorage.getItem('tmFormsMode') || 'null'); return (m && m.type) ? m : null; } catch (e) { return null; }
  }
  function learnMode() {
    var s = typeSelect();
    if (!s || !s.options || s.selectedIndex < 0) return;
    var txt = norm(s.options[s.selectedIndex].textContent);
    if (!txt) return;
    try { localStorage.setItem('tmFormsMode', JSON.stringify({ type: txt, ts: Date.now() })); } catch (e) {}
  }
  document.addEventListener('change', function (e) {
    if (!e.isTrusted) return;
    var s = typeSelect();
    if (s && e.target === s) { modeOverridden = true; learnMode(); }
  }, true);
  document.addEventListener('click', function (e) {
    if (!e.isTrusted) return;
    if (/^Apply$/i.test(norm(e.target.textContent || '')) && typeSelect()) { modeOverridden = true; learnMode(); }
  }, true);
  function restoreMode() {
    if (modeApplied || modeOverridden) return;
    var s = typeSelect();
    if (!s) return;                      // classic list or not ready: keep waiting
    var saved = savedMode();
    if (!saved) { modeApplied = true; return; }
    var target = null;
    for (var j = 0; j < s.options.length; j++) {
      if (norm(s.options[j].textContent) === saved.type) { target = s.options[j]; break; }
    }
    if (!target) { modeApplied = true; return; }   // another facility's mode: impose nothing
    if (s.value === target.value) { modeApplied = true; return; }
    s.value = target.value;
    try { s.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
    try { s.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
    var btns = document.querySelectorAll('button, input[type="button"], input[type="submit"]');
    for (var m = 0; m < btns.length; m++) {
      if (/^Apply$/i.test(norm(btns[m].textContent || btns[m].value)) && btns[m].offsetParent !== null) { fireClick(btns[m]); break; }
    }
    modeApplied = true;
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

  // --- STEP 4: Highlight Score 1.0 rows ---
  function highlightScoreOnes(){
    try {
      // Find data rows: must contain "Consult Form - Psychiatry" (right table)
      // and have a cell with exactly "1.0" (the Score)
      var rows = document.querySelectorAll('tr');
      for (var r = 0; r < rows.length; r++) {
        var rowText = rows[r].textContent || '';
        // Must be a psychiatry consult data row
        if (rowText.indexOf('Consult Form - Psychiatry') === -1) continue;
        // Must have table cells (not a header row)
        var tds = rows[r].querySelectorAll('td');
        if (tds.length < 5) continue;
        // Check if any cell is exactly "1.0"
        var hasOne = false;
        for (var c = 0; c < tds.length; c++) {
          if (norm(tds[c].textContent) === '1.0') { hasOne = true; break; }
        }
        if (hasOne) {
          rows[r].style.backgroundColor = '#fff9c4';
          rows[r].style.outline = '2px solid #f9a825';
          rows[r].style.outlineOffset = '-2px';
        }
      }
    } catch(e){}
  }

  // --- Main sequence ---
  function init(){
    // Step 1: tab (immediate)
    ensureInProgressTab();
    // Step 2: filter (after tab loads) - classic pages
    // only; evergreen pages get the last-mode restore.
    setTimeout(function () { if (!typeSelect()) setPsychFormFilter(); }, 2500);
    // Step 2B: restore his last-viewed mode (evergreen)
    [0, 900, 2000, 3500].forEach(function (ms) { setTimeout(restoreMode, ms); });
    // Step 3: sort by Score ascending (single attempt + one retry max)
    setTimeout(function(){
      sortScoreAscending();
      // Step 4: highlight 1.0 rows after sort settles (runs once)
      setTimeout(highlightScoreOnes, 4000);
    }, 6000);
  }

  if (document.readyState === 'complete') {
    setTimeout(init, 1500);
  } else {
    window.addEventListener('load', function(){ setTimeout(init, 1500); });
  }
})();
;
// ----- module: PCC-All-Forms-List-pending-highlight.user.js -----
(function(){
  var BG = '#5fb86a';   // darker green than the row default; change to any color

  function txt(el){ return (el.textContent || '').replace(/\s+/g, ' ').trim(); }
  function isOne(s){ return /^1(\.0+)?$/.test(s); }

  function colIndex(table, name){
    var cells = table.querySelectorAll('th,td');
    for (var i = 0; i < cells.length; i++){
      if (txt(cells[i]) === name){
        var kids = cells[i].parentNode.children;
        for (var k = 0; k < kids.length; k++) if (kids[k] === cells[i]) return k;
      }
    }
    return -1;
  }

  function paint(doc){
    var rows = doc.querySelectorAll('tr');
    var tables = [], idxs = [];
    for (var r = 0; r < rows.length; r++){
      var tr = rows[r];
      if (tr.querySelector('tr')) continue;            // skip layout rows that wrap other rows
      var cells = tr.children;
      if (cells.length < 5) continue;
      var table = tr.closest('table');
      if (!table) continue;
      var ti = tables.indexOf(table);
      if (ti < 0){
        tables.push(table);
        idxs.push({ s: colIndex(table, 'Score'), c: colIndex(table, 'Category'), d: colIndex(table, 'Description') });
        ti = tables.length - 1;
      }
      var ix = idxs[ti];
      if (ix.s < 0 || ix.c < 0 || ix.d < 0) continue;  // not the forms table
      if (!cells[ix.s] || !cells[ix.c] || !cells[ix.d]) continue;

      var desc = txt(cells[ix.d]), cat = txt(cells[ix.c]), score = txt(cells[ix.s]);
      var isPsych = /psych/i.test(desc) || /psych/i.test(cat);
      if (!isPsych) continue;
      if (!(isOne(score) || /pending\s+psychiatry/i.test(cat))) continue;

      tr.style.setProperty('background-color', BG, 'important');
      for (var c = 0; c < cells.length; c++){
        cells[c].style.setProperty('background-color', BG, 'important');
        cells[c].style.fontWeight = '700';
      }
    }
  }

  function runAll(){
    var docs = [document];
    var ifr = document.querySelectorAll('iframe');
    for (var i = 0; i < ifr.length; i++){ try { if (ifr[i].contentDocument) docs.push(ifr[i].contentDocument); } catch(e){} }
    docs.forEach(function(d){ try { paint(d); } catch(e){} });
  }

  // Scheduling: bounded staggered runs after load + re-run on your clicks.
  // (Permanent interval removed in the reorganization — no-timers rule.)
  [400, 1000, 2000, 3500, 5500, 8000].forEach(function (ms) { setTimeout(runAll, ms); });
  var pccSchedLast = 0;
  document.addEventListener('click', function (e) {
      if (!e.isTrusted) return;
      var now = Date.now();
      if (now - pccSchedLast < 800) return;
      pccSchedLast = now;
      setTimeout(runAll, 350);
  }, true);
})();
;
// ----- module: PCC-CNRSaints-Forms-List.user.js -----
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
;
// ----- module: PCC-All-Readmission-flag.user.js -----
(function(){
  // Compares the header's "Admission (re-entry)" date with the latest psych
  // form date on the list. Re-entry on/after it -> big red READMISSION box.
  // No readmission -> shows nothing (quiet mode since 2026-10-02).
  // v1.3: permanent 5s interval replaced with bounded staggered runs (no-timers rule).

  var SHOW_OK = false;

  var BOX_ID = 'tmReadmitBox';

  function txt(el){ return (el.textContent || '').replace(/\s+/g, ' ').trim(); }

  function parseDate(s){
    var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    return m ? new Date(+m[3], +m[1] - 1, +m[2]) : null;
  }

  // Latest Form Date among psychiatry forms.
  // CNR/Saints: "Consult Form - Psychiatry" under "Form Date".
  // Boro Park: "Psych: Consult" assessments under "Assessment Date".
  function lastPsychForm(){
    // v1.10: mine psych ROWS, nothing else. Three poisons
    // killed the earlier versions: script/style text (the
    // Gatherer's packet JSON reads like psych rows), the
    // ancestor climb (a stray 'psych' node climbed into a
    // page-wide container and took the first date there -
    // the resident's DATE OF BIRTH, 9/1/1932, on the Dash),
    // and pages that merely mention the words. Rules now:
    // no script/style/template text; a date counts only
    // within the psych node's own row-sized chunk
    // (< 400 chars, stop at the TR); and the page must
    // prove it is a forms list - a header row naming the
    // date column, the #assessments container, or psych
    // rows actually found.
    var best = null, bestStr = '', psychRows = 0;
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentElement;
        while (p) {
          if (p.tagName === 'SCRIPT' || p.tagName === 'STYLE' || p.tagName === 'TEMPLATE') return NodeFilter.FILTER_REJECT;
          p = p.parentElement;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var node;
    while ((node = walker.nextNode())){
      var t = (node.nodeValue || '').toLowerCase();
      var isPsych = t.indexOf('psychiatry') !== -1 || t.indexOf('psych:') !== -1;
      if (!isPsych) continue;
      if (t.indexOf('psycholog') !== -1) continue;
      var el = node.parentElement, depth = 0, found = null;
      while (el && depth < 6){
        var rt = el.textContent || '';
        if (rt.length > 400) break;
        var m = rt.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (m) { found = m[0]; break; }
        if (el.tagName === 'TR') break;
        el = el.parentElement;
        depth++;
      }
      if (found) {
        psychRows++;
        var d = parseDate(found);
        if (d && (!best || d > best)) { best = d; bestStr = found; }
      }
    }
    var headerRow = false;
    var trs = document.querySelectorAll('tr');
    for (var i = 0; i < trs.length; i++) {
      var ht = (trs[i].textContent || '').toLowerCase();
      // A real column-header row is SHORT. The Dash shell
      // carries a giant facility-menu row whose text
      // (scripts included) happens to contain the words -
      // it must not count (caught in harness on his 0657
      // Dash capture).
      if (ht.length > 300) continue;
      if (ht.indexOf('form date') !== -1 || ht.indexOf('assessment date') !== -1) { headerRow = true; break; }
    }
    var isList = headerRow || psychRows > 0 || !!document.getElementById('assessments');
    return { tableFound: isList, d: best, s: bestStr };
  }

  // Finds the date text next to the "Admission (re-entry)" label
  function reentryDate(){
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null), nodes = [], n;
    while ((n = w.nextNode())) nodes.push(n);
    for (var i = 0; i < nodes.length; i++){
      if (!/Admission\s*\(\s*re-?entry\s*\)/i.test(nodes[i].nodeValue)) continue;
      var same = nodes[i].nodeValue.match(/\d{1,2}\/\d{1,2}\/\d{4}/);
      if (same) return { node: nodes[i], str: same[0] };
      for (var j = i + 1; j < nodes.length; j++){
        var v = nodes[j].nodeValue.trim();
        if (!v) continue;
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v)) return { node: nodes[j], str: v };
        break;
      }
    }
    return null;
  }

  function clear(){
    var o = document.getElementById(BOX_ID);
    if (o && o.parentNode) o.parentNode.removeChild(o);
  }

  function render(anchor, mode, big, small){
    // Remove any duplicate boxes (shouldn't happen, but guards against loops)
    var dups = document.querySelectorAll('#' + BOX_ID);
    for (var di = 1; di < dups.length; di++){
      if (dups[di].parentNode) dups[di].parentNode.removeChild(dups[di]);
    }
    var box = document.getElementById(BOX_ID);
    if (box && box.__mode !== mode){
      // Mode changed — update styles in place instead of recreating
      box.__mode = mode;
      var b = box.firstChild, s = box.lastChild;
      if (mode === 'alert'){
        box.style.cssText = 'display:inline-block;margin-left:16px;padding:5px 16px;background:#ff1a1a;color:#fff;border:3px solid #ff8080;box-shadow:0 0 16px rgba(255,0,0,.6);border-radius:8px;font-family:-apple-system,Helvetica,Arial,sans-serif;font-weight:800;line-height:1.2;vertical-align:middle;';
        b.style.cssText = 'font-size:26px;letter-spacing:1px;';
        s.style.cssText = 'font-size:14px;font-weight:600;margin-left:12px;';
      } else {
        box.style.cssText = 'display:inline-block;margin-left:12px;font:12px sans-serif;color:#777;vertical-align:middle;';
        b.style.cssText = '';
        s.style.cssText = '';
      }
    }
    if (!box){
      box = document.createElement('span');
      box.id = BOX_ID; box.__mode = mode;
      var b2 = document.createElement('span'), s2 = document.createElement('span');
      if (mode === 'alert'){
        box.style.cssText = 'display:inline-block;margin-left:16px;padding:5px 16px;background:#ff1a1a;color:#fff;border:3px solid #ff8080;box-shadow:0 0 16px rgba(255,0,0,.6);border-radius:8px;font-family:-apple-system,Helvetica,Arial,sans-serif;font-weight:800;line-height:1.2;vertical-align:middle;';
        b2.style.cssText = 'font-size:26px;letter-spacing:1px;';
        s2.style.cssText = 'font-size:14px;font-weight:600;margin-left:12px;';
      } else {
        box.style.cssText = 'display:inline-block;margin-left:12px;font:12px sans-serif;color:#777;vertical-align:middle;';
      }
      box.appendChild(b2); box.appendChild(s2);
      try {
        anchor.parentNode.insertBefore(box, anchor.nextSibling);
      } catch(e){ return; }
    }
    // His call (2026-10-14 18:37): the only VISIBLE warning is the
    // chip beside the G button. This box stays in the DOM — hidden —
    // because both consult-defaults scripts detect readmission by
    // reading it (firstChild text / __mode) in the opener.
    box.style.display = 'none';
    if (box.firstChild) box.firstChild.textContent = big;
    if (box.lastChild) box.lastChild.textContent = small;
  }

  function chartId(){
    // The resident's chart number from the header name
    // element ('Last, First (CH...)') - the Gatherer's
    // way. NOT the first parenthesized number anywhere
    // in the body: on the assessments list that was
    // '929', a random form number, so verdicts keyed by
    // it never matched the same resident on other tabs.
    try {
      var els = document.querySelectorAll('span, div, h1, h2, h3, td, a, b, strong');
      for (var i = 0; i < els.length; i++) {
        var tx = (els[i].textContent || '').replace(/\s+/g, ' ').trim();
        if (tx.length > 70 || tx.length < 5) continue;
        if (/^clinical\s/i.test(tx)) continue;
        var em = tx.match(/^[A-Za-z][A-Za-z'’.\-]+(?:\s+[A-Za-z][A-Za-z'’.\-]+)?\s*,\s*[A-Za-z][A-Za-z'’.\- ]+?\s*\(\s*[A-Za-z]{0,5}(\d{3,})\s*\)/);
        if (em) return em[1];
      }
    } catch (e) {}
    return '';
  }

  function publishVerdict(verdict, reStr, lastFormStr){
    // One verdict record, keyed to this resident + this
    // re-entry date, read on every tab (v1.7, his ask):
    // the tag everywhere must be the verdict the Forms
    // page computed from the real last psych form date.
    try {
      localStorage.setItem('tmReadmitVerdict', JSON.stringify({ id: chartId(), reentry: reStr, verdict: verdict, lastForm: lastFormStr || '', ts: Date.now() }));
    } catch (e) {}
  }
  function dropNote(){
    try { localStorage.removeItem('tmReadmitNote'); } catch (e) {}
  }
  function update(){
    var re = reentryDate();
    var lf = lastPsychForm();
    if (!re || !lf.tableFound){ clear(); return; }            // not the Forms list
    var rd = parseDate(re.str);
    if (!rd){ clear(); return; }
    if (!lf.d){
      // No psych forms at all = a NEW admission, never a
      // readmission (his rule, 2026-10-19). v1.6 cleared
      // the box but left a stale tmReadmitNote behind, so
      // the warning kept showing on every other tab.
      dropNote();
      publishVerdict('new', re.str, '');
      if (SHOW_OK) render(re.node, 'ok', '', 'readmission check: no psych form in this list');
      else clear();
      return;
    }
    if (rd >= lf.d) {
      // A readmission alert must be STABLE: the forms
      // grid populates in stages, and a half-loaded list
      // can show a bogus old 'latest' date on an early
      // pass. Publish only when two passes agree.
      var cand = re.str + '|' + lf.s;
      if (update._cand !== cand) { update._cand = cand; return; }
      publishVerdict('readmit', re.str, lf.s);
      render(re.node, 'alert', 'READMISSION', 'on/after last psych form ' + lf.s);
      // Publish the verdict so the tile-row script can show the same
      // warning beside the G button in the header bar (his ask,
      // 2026-10-14). Keyed to this resident + this re-entry date.
      try {
        localStorage.setItem('tmReadmitNote', JSON.stringify({ id: chartId(), date: re.str, ts: Date.now() }));
      } catch (e) {}
    } else {
      publishVerdict('ok', re.str, lf.s);
      try {
        var cur = JSON.parse(localStorage.getItem('tmReadmitNote') || 'null');
        if (cur && cur.date === re.str) localStorage.removeItem('tmReadmitNote');
      } catch (e) {}
      if (SHOW_OK) render(re.node, 'ok', '', 're-entry ' + re.str + ' is before last psych form ' + lf.s + ' - OK');
      else clear();
    }
  }

  // Bounded staggered runs after load — then it stops (no permanent interval).
  [600, 2000, 4000, 7000].forEach(function (ms) { setTimeout(update, ms); });
})();
;
// ----- module: PCC-All-Hide-unused-tabs.user.js -----
(function () {
  'use strict';

  // Hides the resident-chart tabs Adrian never uses (his list, 2026-10-13):
  // CENSUS, PROBLEMS, ALLERGIES, IMMUN, MDS, THERAPY, CARE PLAN, TASKS,
  // MED DIAG, MISC. A "MORE" button at the end of the tab bar brings them
  // back on demand (LESS hides them again).
  //
  // v1.2 fix: v1.1 matched the first element with each name ANYWHERE on the
  // page — "ALLERGIES" hit the header label instead of the tab, and MDS hit
  // a stray element, so those two tabs stayed and the button landed in the
  // wrong place. Now the tab bar is located first (the smallest container
  // holding >=5 known tab labels) and tabs are matched only inside it. The
  // run also un-hides any exact-label element OUTSIDE the bar that a
  // previous version hid by mistake.
  //
  // Bounded staggered runs + click re-runs (no permanent timers).

  var HIDE = ['CENSUS', 'PROBLEMS', 'ALLERGIES', 'IMMUN', 'MDS', 'THERAPY', 'CARE PLAN', 'TASKS',
    'MED DIAG', 'MISC'];
  var ALL_TABS = ['DASH', 'PROFILE', 'CENSUS', 'MED DIAG', 'PROBLEMS', 'ALLERGIES', 'IMMUN',
    'ORDERS', 'WTS/VITALS', 'RESULTS', 'MDS', 'FORMS', 'ASSMNTS', 'THERAPY', 'PROG NOTES', 'CARE PLAN',
    'TASKS', 'MISC'];

  // v1.11 (2026-10-15, his design - Option A + invert, mocked and
  // approved by him first): the tabs are TILES now, styled like his
  // data tiles (Admission / Age/Sex / Room). His four working tabs
  // are big white tiles with a colored dot; the tab he is ON is
  // INVERTED - filled with its color, white text, the dot becomes a
  // white ring. Pressing a tile inverts it instantly, before the
  // page even changes. The second tier (ORDERS, WTS/VITALS,
  // RESULTS, MED DIAG, MISC) stays smaller in its light-red family;
  // the overflow tabs under MORE are plain small white tiles; the
  // MORE/LESS toggle is a tile too.
  var MAINS = {
    'DASH': '#2563eb', 'FORMS': '#d97706',
    'ASSMNTS': '#d97706', 'PROG NOTES': '#059669'
  };
  // His call (2026-10-19): PROFILE leaves the big colored
  // mains and joins the red second tier, like ORDERS.
  var SECOND = { 'PROFILE': 1, 'ORDERS': 1, 'WTS/VITALS': 1, 'RESULTS': 1, 'MED DIAG': 1, 'MISC': 1 };

  function setKids(el, color, size) {
    var kids = el.querySelectorAll('*');
    for (var i = 0; i < kids.length; i++) {
      if (kids[i].classList && kids[i].classList.contains('tmTabDot')) continue;
      kids[i].style.color = color;
      kids[i].style.fontWeight = '700';
      kids[i].style.fontSize = size;
    }
  }
  function dotFor(el, colorHex, inverted) {
    var dot = null;
    for (var i = 0; i < el.children.length; i++) {
      if (el.children[i].classList && el.children[i].classList.contains('tmTabDot')) { dot = el.children[i]; break; }
    }
    if (!dot) {
      dot = document.createElement('span');
      dot.className = 'tmTabDot';
      dot.setAttribute('aria-hidden', 'true');
      if (el.firstChild) el.insertBefore(dot, el.firstChild); else el.appendChild(dot);
    }
    dot.style.cssText = 'display:inline-block;border-radius:50%;margin-right:8px;vertical-align:middle;' +
      (inverted ? 'width:8px;height:8px;background:transparent;border:2.5px solid #ffffff;'
                : 'width:11px;height:11px;background:' + colorHex + ';border:2.5px solid transparent;');
    return dot;
  }
  function paintTab(el, name, isCur) {
    if (!el) return;
    el.style.borderRadius = '12px';
    el.style.cursor = 'pointer';
    el.style.whiteSpace = 'nowrap';
    el.style.boxSizing = 'border-box';
    el.style.lineHeight = '1.15';
    if (MAINS[name]) {
      el.style.padding = '10px 14px';
      el.style.fontSize = '16px';
      el.style.fontWeight = '700';
      if (isCur) {
        el.style.backgroundColor = MAINS[name];
        el.style.color = '#ffffff';
        el.style.border = '1px solid ' + MAINS[name];
        el.style.boxShadow = '0 1px 3px rgba(16,24,40,.25)';
        dotFor(el, MAINS[name], true);
        setKids(el, '#ffffff', '16px');
      } else {
        el.style.backgroundColor = '#ffffff';
        el.style.color = '#131c2b';
        el.style.border = '1px solid #e2e8f0';
        el.style.boxShadow = '0 1px 2px rgba(16,24,40,.05)';
        dotFor(el, MAINS[name], false);
        setKids(el, '#131c2b', '16px');
      }
    } else if (SECOND[name]) {
      el.style.padding = '8px 10px';
      el.style.fontSize = '12.5px';
      el.style.fontWeight = '700';
      if (isCur) {
        el.style.backgroundColor = '#b91c1c';
        el.style.color = '#ffffff';
        el.style.border = '1px solid #b91c1c';
        setKids(el, '#ffffff', '12.5px');
      } else {
        el.style.backgroundColor = '#fff5f5';
        el.style.color = '#7f1d1d';
        el.style.border = '1px solid #fecaca';
        setKids(el, '#7f1d1d', '12.5px');
      }
      el.style.boxShadow = '0 1px 2px rgba(16,24,40,.05)';
    } else {
      el.style.padding = '8px 10px';
      el.style.fontSize = '12.5px';
      el.style.fontWeight = '700';
      if (isCur) {
        el.style.backgroundColor = '#475569';
        el.style.color = '#ffffff';
        el.style.border = '1px solid #475569';
        setKids(el, '#ffffff', '12.5px');
      } else {
        el.style.backgroundColor = '#ffffff';
        el.style.color = '#5b6b7d';
        el.style.border = '1px solid #e2e8f0';
        setKids(el, '#5b6b7d', '12.5px');
      }
      el.style.boxShadow = '0 1px 2px rgba(16,24,40,.05)';
    }
  }
  var MORE_TILE_CSS = 'cursor:pointer;padding:10px 14px;border:1.5px dashed #b6c2cf;border-radius:12px;' +
    'background:#ffffff;color:#5b6b7d;font:700 13.5px -apple-system,Helvetica,Arial,sans-serif;white-space:nowrap;';
  // When MORE is open, these overflow tabs come FIRST (his order,
  // 2026-10-13) — the rest follow in PCC's original relative order.
  var EXPAND_FIRST = ['MED DIAG', 'MISC'];

  var tabsHidden = true;   // his default: hidden
  var origOrder = [];      // PCC's own tab order, captured on first sight

  function norm(s) { return (s || '').replace(/\s+/g, ' ').trim().toUpperCase(); }

  function candidates() {
    var els = document.querySelectorAll('a,button,[role="tab"],td,li,span,div');
    var out = [];
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.children.length > 2) continue;
      var t = norm(el.textContent);
      if (ALL_TABS.indexOf(t) !== -1) out.push({ name: t, el: el });
    }
    return out;
  }

  // The tab bar = the smallest container holding at least 5 distinct tab
  // labels (most labels wins; ties go to the smaller subtree).
  function findBar(cands) {
    var recs = [];
    var byNode = new Map();
    cands.forEach(function (c, idx) {
      var node = c.el.parentElement;
      for (var up = 0; up < 8 && node; up++) {
        var rec = byNode.get(node);
        if (!rec) { rec = { node: node, members: [], names: {} }; byNode.set(node, rec); recs.push(rec); }
        if (rec.members.indexOf(idx) === -1) { rec.members.push(idx); rec.names[c.name] = 1; }
        node = node.parentElement;
      }
    });
    var best = null;
    recs.forEach(function (rec) {
      var nNames = Object.keys(rec.names).length;
      if (nNames < 5) return;
      var size = rec.node.querySelectorAll('*').length;
      if (!best || nNames > best.nNames || (nNames === best.nNames && size < best.size)) {
        best = { node: rec.node, nNames: nNames, size: size };
      }
    });
    return best ? best.node : null;
  }

  function tabElement(el, name) {
    var target = el;
    for (var up = 0; up < 6 && target; up++) {
      var tag = target.tagName;
      if (tag === 'A' || tag === 'BUTTON' || tag === 'TD' || tag === 'LI' ||
          target.onclick || target.getAttribute('onclick')) break;
      target = target.parentElement;
    }
    return (target && norm(target.textContent) === name) ? target : el;
  }

  function run() {
    var cands = candidates();
    if (!cands.length) return false;
    var bar = findBar(cands);
    if (!bar) return false;

    var tabs = {};    // name -> element to show/hide
    var order = [];   // names in document order
    cands.forEach(function (c) {
      if (!bar.contains(c.el) || tabs[c.name]) return;
      tabs[c.name] = tabElement(c.el, c.name);
      order.push(c.name);
    });
    if (order.length < 5) return false;

    // Repair: un-hide any exact-label element outside the bar that an
    // earlier version hid by mistake (e.g. the header "Allergies" label).
    var styled = document.querySelectorAll('[style*="display: none"],[style*="display:none"]');
    for (var i = 0; i < styled.length; i++) {
      var s = styled[i];
      if (bar.contains(s)) continue;
      if (ALL_TABS.indexOf(norm(s.textContent)) !== -1 && s.children.length <= 2) s.style.display = '';
    }

    // Current-tab memory (v1.7, his report): MORE -> click a hidden tab ->
    // the page loads but the bar re-collapses without that tab, so he can't
    // see where he is. Remember his tab clicks for the session; if he is ON
    // a normally-hidden tab, keep THAT tab visible in the collapsed bar and
    // mark it as current. Bonus signal: PCC's own selected-tab class.
    var cur = '';
    try { cur = sessionStorage.getItem('pccCurTab') || ''; } catch (e) {}
    order.forEach(function (name) {
      var el = tabs[name];
      var a = el.querySelector('a');
      var cls = String(el.className || '') + ' ' + (a ? String(a.className || '') : '');
      if (/(selected|active|current)/i.test(cls) || el.getAttribute('aria-selected') === 'true') cur = name;
      if (!el.dataset.pccTrack) {
        el.dataset.pccTrack = '1';
        el.addEventListener('click', function () {
          try { paintTab(el, name, true); } catch (e3) {}
          try {
            if (HIDE.indexOf(name) !== -1) sessionStorage.setItem('pccCurTab', name);
            else sessionStorage.removeItem('pccCurTab');
          } catch (e2) {}
        });
      }
    });

    HIDE.forEach(function (name) {
      if (!tabs[name]) return;
      var keep = tabsHidden && name === cur;   // the tab he is ON stays visible
      tabs[name].style.display = (tabsHidden && !keep) ? 'none' : '';
    });

    order.forEach(function (name) { paintTab(tabs[name], name, name === cur); });

    // Layout (v1.8, his request): MORE appends the hidden tabs TO THE
    // RIGHT — the tabs from the collapsed bar never move or reshuffle.
    // LESS restores PCC's original order. Moves are idempotent and run on
    // every pass, so late PCC re-renders settle into the same layout.
    if (!origOrder.length) origOrder = order.slice();
    function placeRight(el) {
      var p = el.parentElement;
      if (!p) return;
      var b = document.getElementById('pccMoreTabsBtn');
      var hold = null;
      if (b) {
        if (b.parentElement && b.parentElement.parentElement === p) hold = b.parentElement;
        else if (b.parentElement === p) hold = b;
      }
      if (hold) p.insertBefore(el, hold); else p.appendChild(el);
    }
    if (tabsHidden) {
      origOrder.forEach(function (name) { if (tabs[name]) placeRight(tabs[name]); });
    } else {
      var expandList = EXPAND_FIRST.concat(origOrder.filter(function (name) {
        return HIDE.indexOf(name) !== -1 && EXPAND_FIRST.indexOf(name) === -1;
      }));
      expandList.forEach(function (name) { if (tabs[name]) placeRight(tabs[name]); });
    }

    // MORE / LESS button at the end of the bar.
    var btn = document.getElementById('pccMoreTabsBtn');
    if (btn) { btn.textContent = tabsHidden ? 'MORE ▸' : 'LESS ▾'; btn.style.cssText = MORE_TILE_CSS; return true; }
    var last = tabs[order[order.length - 1]];
    var parent = last && last.parentElement;
    if (!parent) return true;
    var holder;
    if (last.tagName === 'TD') holder = document.createElement('td');
    else if (last.tagName === 'LI') holder = document.createElement('li');
    else holder = document.createElement('span');
    btn = document.createElement('button');
    btn.id = 'pccMoreTabsBtn';
    btn.type = 'button';
    btn.textContent = tabsHidden ? 'MORE ▸' : 'LESS ▾';
    btn.style.cssText = MORE_TILE_CSS;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      tabsHidden = !tabsHidden;
      run();
    });
    holder.appendChild(btn);
    parent.appendChild(holder);
    return true;
  }

  // document-start burst (v1.4 pilot, his anti-flicker request): retry every
  // 50ms until the tab bar exists and has been processed (max ~2s), so the
  // hiding + colors land before the first paint in practice. Then the usual
  // staggered passes cover PCC's late re-renders. Bounded — not a poller.
  var burstLeft = 40;
  (function burst() {
    if (run()) return;
    if (--burstLeft <= 0) return;
    setTimeout(burst, 50);
  })();
  // FROZEN BAR (v1.13, his report 2026-10-19): the late
  // passes (2.5s/4.5s/7s) and the re-run 300ms after
  // every click are GONE. PCC re-renders the bar with
  // all tabs restored, so each re-run re-hid them a beat
  // after he clicked - the tabs slid left in steps while
  // he was aiming at the next one, and clicks landed on
  // a moving target or a gap ('sometimes I hit it and it
  // doesn't register'). His priority: a click must
  // register the first time, every time. So this script
  // now styles the bar ONCE, during the document-start
  // burst (plus a single 2.5s pass for PCC's slowest
  // first render), and never touches it again for the
  // life of the page. (The 2.5s pass was dropped too:
  // the document-start burst already retries every
  // 50ms for up to ~2s, so the bar is styled the moment
  // PCC renders it - a later pass only re-opens the
  // moving window.) Trade-off, accepted: if PCC
  // re-renders the bar mid-session, hidden tabs stay
  // visible until the next chart opens.
})();
;
// ----- module: PCC-All-Hide-profile-sections.user.js -----
(function () {
  'use strict';

  // Hides three Profile-page sections Adrian never uses (his request,
  // 2026-10-13): Medical Professionals, User Defined Fields, External
  // Facilities. Each section is found by its exact heading; the section
  // card is the smallest container that holds the heading and a table
  // without also holding another section's heading — so the contacts and
  // Admission Record sections are never touched. Display-only; disabling
  // the script brings the sections back.
  // Bounded staggered runs + click re-runs (no permanent timers).

  var TARGETS = ['Medical Professionals', 'User Defined Fields', 'External Facilities'];
  var GUARDS = ['Admission Record', 'Contacts', 'Emergency Contacts', 'Resident Profile',
    'Medical Professionals', 'User Defined Fields', 'External Facilities'];

  function norm(s) { return (s || '').replace(/\s+/g, ' ').trim().toLowerCase(); }

  function headingEls(text) {
    var want = norm(text);
    var els = document.querySelectorAll('div, span, h1, h2, h3, h4, td, th, b, strong');
    var out = [];
    for (var i = 0; i < els.length; i++) {
      if (els[i].children.length > 2) continue;
      if (norm(els[i].textContent) === want) out.push(els[i]);
    }
    return out;
  }

  function containsHeading(container, text) {
    var want = norm(text);
    var els = container.querySelectorAll('div, span, h1, h2, h3, h4, td, th, b, strong');
    for (var i = 0; i < els.length; i++) {
      if (els[i].children.length > 2) continue;
      if (norm(els[i].textContent) === want) return true;
    }
    return false;
  }

  function sectionCard(headingEl, ownText) {
    var node = headingEl;
    for (var up = 0; up < 8 && node; up++) {
      node = node.parentElement;
      if (!node) break;
      var tbl = node.querySelector('table');
      if (!tbl) continue;
      if (tbl.querySelectorAll('tr').length > 12) continue;
      if (node.querySelectorAll('*').length > 1500) continue;
      var clean = true;
      for (var g = 0; g < GUARDS.length; g++) {
        if (GUARDS[g] === ownText) continue;
        if (containsHeading(node, GUARDS[g])) { clean = false; break; }
      }
      if (clean) return node;
    }
    return null;
  }

  // v1.1 (2026-10-19, the invisible-notes incident): the
  // heading hunt ran on EVERY page. On the Progress
  // Notes view-all page a stray 'External Facilities'
  // text let the card climb land on the notes table's
  // own wrapper (no guarded headings exist there) and
  // display:none hid EVERY note. Two hard gates now:
  // (1) this script only ever runs on a page that
  // carries Profile furniture (an 'Admission Record' or
  // 'Resident Profile' heading); (2) a card whose table
  // has more than 12 rows is a page list, never a
  // profile section, and is never hidden.
  function isProfilePage() {
    return containsHeading(document.body, 'Admission Record') ||
      containsHeading(document.body, 'Resident Profile');
  }

  function run() {
    if (!isProfilePage()) return;
    TARGETS.forEach(function (text) {
      headingEls(text).forEach(function (h) {
        var card = sectionCard(h, text);
        if (card) card.style.display = 'none';
      });
    });
  }

  [400, 1000, 2000, 3500, 5500, 8000].forEach(function (ms) { setTimeout(run, ms); });
  var lastRun = 0;
  document.addEventListener('click', function (e) {
    if (!e.isTrusted) return;
    var now = Date.now();
    if (now - lastRun < 1000) return;
    lastRun = now;
    setTimeout(run, 300);
  }, true);
})();
;
// ----- module: PCC-All-Header-emphasis.user.js -----
(function(){
  var EMPH = 'font-weight:900;font-size:1.7em;color:#1d4ed8;';   // extra bold, much bigger, blue

  var LABELS = 'DOB|Physician|Location|Status|Code Status|Allergies|Admission|Initial Admission Date|Discharge Date';

  function makeSpan(text){
    var s = document.createElement('span');
    s.textContent = text; s.style.cssText = EMPH; s.__emph = 1;
    return s;
  }

  function boldWholeNode(tn){
    var p = tn.parentNode; if (!p) return;
    var txt = tn.nodeValue;
    var lead = txt.match(/^\s*/)[0], trail = txt.match(/\s*$/)[0];
    var core = txt.slice(lead.length, txt.length - trail.length);
    if (!core) return;
    var frag = document.createDocumentFragment();
    if (lead) frag.appendChild(document.createTextNode(lead));
    frag.appendChild(makeSpan(core));
    if (trail) frag.appendChild(document.createTextNode(trail));
    p.replaceChild(frag, tn);
  }

  function isLabel(v){
    return new RegExp('^\\s*(?:' + LABELS + ')\\b', 'i').test(v) || /:\s*$/.test(v);
  }

  function allTextNodes(){
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null), out = [], n;
    while ((n = w.nextNode())) out.push(n);
    return out;
  }

  // Bold the VALUE that follows a label, whether it's in the same node or a following one.
  // valueRe validates the value so we only touch the real header field.
  function boldLabelValue(labelSrc, valueRe){
    var nodes = allTextNodes();
    var labRe = new RegExp(labelSrc + '\\s*:?\\s*', 'i');
    for (var i = 0; i < nodes.length; i++){
      var tn = nodes[i], p = tn.parentNode;
      if (!p || p.__emph) continue;
      var tag = p.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA') continue;
      var txt = tn.nodeValue;
      var m = txt.match(labRe);
      if (!m) continue;
      var cut = m.index + m[0].length;
      var rest = txt.slice(cut);

      if (rest.trim()) {                          // value in the SAME node
        var stop = rest.search(new RegExp('\\b(?:' + LABELS + ')\\b\\s*:', 'i'));
        var value = stop >= 0 ? rest.slice(0, stop) : rest;
        var suffix = stop >= 0 ? rest.slice(stop) : '';
        var t = value.match(/\s*$/)[0];
        if (t) { value = value.slice(0, value.length - t.length); suffix = t + suffix; }
        if (!value.trim() || (valueRe && !valueRe.test(value))) continue;
        var frag = document.createDocumentFragment();
        frag.appendChild(document.createTextNode(txt.slice(0, cut)));
        frag.appendChild(makeSpan(value));
        if (suffix) frag.appendChild(document.createTextNode(suffix));
        p.replaceChild(frag, tn);
      } else {                                    // value is in a FOLLOWING node
        for (var j = i + 1; j < nodes.length; j++){
          var vt = nodes[j], vp = vt.parentNode;
          if (!vp || vp.__emph) continue;
          var v = vt.nodeValue;
          if (!v.trim()) continue;
          if (isLabel(v)) break;                  // hit the next label — stop
          if (!valueRe || valueRe.test(v)) boldWholeNode(vt);
          break;
        }
      }
    }
  }

  // Wrap every regex match inside root (the age/sex parenthetical)
  function wrapPattern(source){
    allTextNodes().forEach(function(tn){
      var p = tn.parentNode;
      if (!p || p.__emph) return;
      var tag = p.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA') return;
      var txt = tn.nodeValue, r = new RegExp(source, 'gi');
      if (!r.test(txt)) return;
      r.lastIndex = 0;
      var frag = document.createDocumentFragment(), last = 0, m;
      while ((m = r.exec(txt))){
        if (m.index > last) frag.appendChild(document.createTextNode(txt.slice(last, m.index)));
        frag.appendChild(makeSpan(m[0]));
        last = m.index + m[0].length;
        if (m.index === r.lastIndex) r.lastIndex++;
      }
      if (last < txt.length) frag.appendChild(document.createTextNode(txt.slice(last)));
      p.replaceChild(frag, tn);
    });
  }

  function run(){
    // All three highlights removed at his request (2026-10-13): age/sex,
    // room (Location), and the re-admission date are no longer emphasized.
    // The machinery stays so any single one can be switched back on by
    // restoring its line here:
    //   wrapPattern('\\(\\s*\\d{1,3}\\s*\\/\\s*(?:male|female|m|f)\\s*\\)');   // (94/Female)
    //   boldLabelValue('Location', /\d{1,4}-[A-Za-z]/);                        // room
    //   boldLabelValue('Admission\\s*\\(re-?entry\\)', /\d{1,2}\/\d{1,2}\/\d{2,4}/);  // re-admission date
  }

  // Scheduling: bounded staggered runs after load + re-run on your clicks.
  // (Permanent interval removed in the reorganization — no-timers rule.)
  [400, 1000, 2000, 3500, 5500, 8000].forEach(function (ms) { setTimeout(run, ms); });
  var pccSchedLast = 0;
  document.addEventListener('click', function (e) {
      if (!e.isTrusted) return;
      var now = Date.now();
      if (now - pccSchedLast < 800) return;
      pccSchedLast = now;
      setTimeout(run, 350);
  }, true);
})();
;
// ----- module: PCC-All-View-All-checkbox.user.js -----
(function () {
    'use strict';

    var lastKey = null;
    var MANUAL_TTL = 15000;

    function findByLabel(root, sel, re) {
        return Array.from(root.querySelectorAll(sel)).find(function (el) {
            return re.test((el.value || el.textContent || '').trim());
        });
    }

    function getBar() {
        var apply = findByLabel(document, 'input[type="button"],input[type="submit"],button', /^Apply$/i);
        if (!apply) return null;
        var el = apply.parentElement;
        while (el && el.querySelectorAll('select').length < 2) el = el.parentElement;
        return el;
    }

    function getViewAll() {
        return Array.from(document.querySelectorAll('input[type="checkbox"]')).find(function (cb) {
            var host = cb.closest('td,th,label') || cb.parentElement;
            return host && /View\s*All/i.test(host.textContent);
        });
    }

    function filtersAreAll(bar) {
        return Array.from(bar.querySelectorAll('select')).every(function (s) {
            var o = s.options[s.selectedIndex];
            return o && /^All$/i.test(o.text.trim());
        });
    }

    // A real click by you on View All: remember it so automation steps aside
    document.addEventListener('click', function (e) {
        if (!e.isTrusted) return;
        var cb = getViewAll();
        if (!cb) return;
        var host = cb.closest('td,th,label') || cb.parentElement;
        if (!host || !host.contains(e.target)) return;
        var bar = getBar();
        try {
            sessionStorage.setItem('va_manual', JSON.stringify({
                key: bar && filtersAreAll(bar) ? 'all' : 'filtered',
                t: Date.now()
            }));
        } catch (err) {}
    }, true);

    function manualOverride(key) {
        try {
            var m = JSON.parse(sessionStorage.getItem('va_manual') || 'null');
            return !!m && m.key === key && (Date.now() - m.t) < MANUAL_TTL;
        } catch (err) { return false; }
    }

    function tick() {
        var bar = getBar();
        if (!bar) return;
        var cb = getViewAll();
        if (!cb) return;

        var allAll = filtersAreAll(bar);
        var key = allAll ? 'all' : 'filtered';
        if (key === lastKey) return;                        // once per filter state
        if (manualOverride(key)) { lastKey = key; return; } // you toggled it: hands off
        if (cb.checked === allAll) { lastKey = key; return; }

        var last = +(sessionStorage.getItem('va_cooldown') || 0);
        if (Date.now() - last < 3000) return;               // reload-loop guard
        sessionStorage.setItem('va_cooldown', Date.now());
        lastKey = key;
        cb.click();                                         // click only; never set .checked
    }

    // Scheduling (v1.1): NO permanent interval. A few staggered runs after
    // load, then re-checks only when YOU change a filter or press Apply
    // (PCC also reloads the frame on Apply, which re-runs the load pass).
    [400, 1200, 2500, 4500].forEach(function (ms) { setTimeout(tick, ms); });
    document.addEventListener('change', function (e) {
        if (e.target && e.target.tagName === 'SELECT') setTimeout(tick, 150);
    }, true);
    document.addEventListener('click', function (e) {
        if (!e.isTrusted) return;
        var v = (e.target && (e.target.value || e.target.textContent) || '').trim();
        if (/^Apply$/i.test(v)) setTimeout(tick, 900);
    }, true);
})();
;
// ----- module: PCC-All-Split-view.user.js -----
(function () {
    'use strict';

    // One id per panel (top window). Every frame of the same panel shares it;
    // the other tiled copy has a different one.
    var topWin = window.top;
    var PANEL_ID;
    try {
        PANEL_ID = topWin.__pccPanelId || (topWin.__pccPanelId = Math.random().toString(36).slice(2) + Date.now().toString(36));
    } catch (e) { PANEL_ID = Math.random().toString(36).slice(2); }

    var OFF = false;   // '0' kill switch

    function allDocs() {
        var docs = [];
        var seen = [];
        (function walk(w) {
            try {
                if (seen.indexOf(w) !== -1) return;
                seen.push(w);
                if (w.document) docs.push(w.document);
                for (var i = 0; i < w.frames.length; i++) walk(w.frames[i]);
            } catch (e) { /* cross-origin frame: skip */ }
        })(topWin);
        return docs;
    }

    // Full mouse event click — PCC ignores plain .click()
    function fireClick(el) {
        try {
            el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
            el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
            if (el.click) el.click();
        } catch (e) { try { el.click(); } catch (e2) {} }
    }

    function norm(s) { return (s || '').replace(/\s+/g, ' ').trim().toUpperCase(); }

    // Find a chart tab by exact label in any frame of this panel; returns the
    // clickable element (climbs to a link/button/cell like PCC tabs need).
    function findTab(labels) {
        var docs = allDocs();
        for (var d = 0; d < docs.length; d++) {
            var els = docs[d].querySelectorAll('a,button,[role="tab"],td,li,span,div');
            for (var i = 0; i < els.length; i++) {
                var el = els[i];
                if (el.children.length > 2) continue;
                var t = norm(el.textContent);
                if (labels.indexOf(t) === -1) continue;
                var clickable = el;
                for (var up = 0; up < 6 && clickable; up++) {
                    var tag = clickable.tagName;
                    if (tag === 'A' || tag === 'BUTTON' || tag === 'TD' || tag === 'LI' ||
                        clickable.onclick || clickable.getAttribute('onclick')) break;
                    clickable = clickable.parentElement;
                }
                return clickable || el;
            }
        }
        return null;
    }

    // Best-effort resident name ("LAST, FIRST") from the header (top document).
    function residentName() {
        try {
            var t = (topWin.document.body ? topWin.document.body.innerText : '').slice(0, 4000);
            var m = t.match(/\b([A-Z]{2,}(?:['\u2019\-][A-Z]+)?,\s*[A-Z]{2,}(?:\s+[A-Z])?)\b/);
            return m ? m[1].replace(/\s+/g, ' ') : '';
        } catch (e) { return ''; }
    }

    function toast(msg) {
        try {
            var doc = topWin.document;
            var old = doc.getElementById('pcc-split-toast');
            if (old) old.remove();
            var el = doc.createElement('div');
            el.id = 'pcc-split-toast';
            el.textContent = msg;
            el.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:2147483647;background:#1f2937;color:#fff;font:600 13px -apple-system,sans-serif;padding:8px 14px;border-radius:999px;box-shadow:0 4px 16px rgba(0,0,0,.25);opacity:0;transition:opacity .18s;pointer-events:none;';
            doc.body.appendChild(el);
            requestAnimationFrame(function () { el.style.opacity = '1'; });
            setTimeout(function () { el.style.opacity = '0'; setTimeout(function () { el.remove(); }, 250); }, 1600);
        } catch (e) {}
    }

    var channel = null;
    try { channel = new BroadcastChannel('pcc-split-view-v1'); } catch (e) {}

    // Receiver: only the TOP frame of each panel handles signals (one actor),
    // and only if this panel shows the same resident (or names are unreadable).
    if (channel && window === topWin) {
        channel.onmessage = function (ev) {
            var msg = ev.data || {};
            if (msg.type !== 'goto-notes' || msg.from === PANEL_ID || OFF) return;
            var mine = residentName();
            if (msg.name && mine && msg.name !== mine) return;   // different resident: hands off
            var tab = findTab(['PROG NOTES']);
            if (tab) { fireClick(tab); toast('Split view: this side = Progress Notes'); }
        };
    }

    function isTyping(target) {
        if (!target) return false;
        var tag = (target.tagName || '').toUpperCase();
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable === true;
    }

    document.addEventListener('keydown', function (e) {
        if (!e.isTrusted || e.repeat) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (isTyping(e.target)) return;

        if (e.key === '0') { OFF = !OFF; toast(OFF ? 'Split view OFF' : 'Split view ON'); return; }
        if (OFF) return;
        if (!e.key || e.key.toLowerCase() !== 't') return;

        // This panel = the writing side: jump to the forms tab.
        var formsTab = findTab(['FORMS', 'ASSMNTS']);
        if (!formsTab) return;   // not on a resident chart: do nothing, signal nothing
        fireClick(formsTab);
        toast('Split view: this side = Forms');
        // Tell the other copy to show Progress Notes.
        if (channel) {
            try { channel.postMessage({ type: 'goto-notes', from: PANEL_ID, name: residentName() }); } catch (e2) {}
        }
        e.preventDefault();
    }, true);
})();
;
