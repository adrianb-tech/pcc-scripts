// ==UserScript==
// @name         Every facility — Readmission flag
// @version 1.13
// @updateURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Readmission-flag.user.js
// @downloadURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Readmission-flag.user.js
// @match        https://*.pointclickcare.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

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

  var flagPublished = false;
  var publishedAlert = false;
  function publishVerdict(verdict, reStr, lastFormStr){
    // Change-gated (v1.13): the same verdict is written
    // once; a DIFFERENT stable verdict always writes -
    // that is what lets a wrong early read correct
    // itself while the burst keeps verifying (below).
    var key = verdict + '|' + reStr + '|' + (lastFormStr || '');
    if (publishVerdict._key === key) return false;
    publishVerdict._key = key;
    flagPublished = true;
    if (verdict === 'readmit') publishedAlert = true;
    // One verdict record, keyed to this resident + this
    // re-entry date, read on every tab (v1.7, his ask):
    // the tag everywhere must be the verdict the Forms
    // page computed from the real last psych form date.
    try {
      localStorage.setItem('tmReadmitVerdict', JSON.stringify({ id: chartId(), reentry: reStr, verdict: verdict, lastForm: lastFormStr || '', ts: Date.now() }));
    } catch (e) {}
    return true;
  }
  function dropNote(){
    try { localStorage.removeItem('tmReadmitNote'); } catch (e) {}
  }
  // STABILITY (v1.12, his live report 2026-10-23): EVERY
  // verdict branch must be stable before it publishes.
  // The alert branch always had a two-pass guard; 'new'
  // and 'ok' did not - and the forms grid populates in
  // stages, so an early pass could find the re-entry
  // line but no psych rows yet and publish 'new' (Core
  // then painted the NEW ADMISSION chip - the green he
  // saw), or catch a bogus half-loaded 'latest' and
  // publish 'ok'. Now a verdict publishes only when the
  // same branch + dates survive two consecutive passes
  // spanning a minimum window. SELF-CORRECTION (v1.13,
  // his second live report the same day: the chip said
  // NEW over a Forms list FULL of his psych forms): the
  // burst no longer stops at the first 'new'/'ok'
  // publish - it keeps verifying for its whole window,
  // and when the grid's real rows land and the stable
  // read changes, the corrected verdict republishes.
  // 'new' is the dangerous branch (it is a claim that
  // NO psych forms exist), so its window is 3s; a
  // readmission ALERT still stops the burst - it is
  // date-proven and terminal.
  function stable(key, spanMs){
    var now = Date.now();
    if (update._cand !== key) { update._cand = key; update._candSince = now; return false; }
    return !!(update._candSince && now - update._candSince >= (spanMs || 1000));
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
      if (!stable('new|' + re.str, 3000)) return;
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
      if (!stable('readmit|' + re.str + '|' + lf.s)) return;
      var wrote = publishVerdict('readmit', re.str, lf.s);
      render(re.node, 'alert', 'READMISSION', 'on/after last psych form ' + lf.s);
      // Publish the verdict so the tile-row script can show the same
      // warning beside the G button in the header bar (his ask,
      // 2026-10-14). Keyed to this resident + this re-entry date.
      if (wrote) try {
        localStorage.setItem('tmReadmitNote', JSON.stringify({ id: chartId(), date: re.str, ts: Date.now() }));
      } catch (e) {}
    } else {
      if (!stable('ok|' + re.str + '|' + lf.s)) return;
      publishVerdict('ok', re.str, lf.s);
      try {
        var cur = JSON.parse(localStorage.getItem('tmReadmitNote') || 'null');
        if (cur && cur.date === re.str) localStorage.removeItem('tmReadmitNote');
      } catch (e) {}
      if (SHOW_OK) render(re.node, 'ok', '', 're-entry ' + re.str + ' is before last psych form ' + lf.s + ' - OK');
      else clear();
    }
  }

  // Scheduling (Smooth Arrival, audit C3): the verdict
  // publishes as early as the list allows - the ladder
  // is gone. A bounded burst (250ms steps, ~7s, the old
  // ladder's window) runs update() until a verdict is
  // published; update()'s own two-agreeing-passes guard
  // still applies, so the earliest publish is the second
  // burst tick (~500ms) instead of the old 2s+4s pair.
  // On a page with no forms list at all the burst stops
  // after a few tries - the verdict is computed on the
  // Forms page itself, and Core's reserved chip slot
  // (its own frame, planted with the G button) is what
  // the verdict lands in on every other tab.
  var flagTries = 0, flagNoList = 0;
  function flagBurst(){
    update();
    flagTries++;
    // v1.13: only a published ALERT ends the burst
    // early. 'new'/'ok' keep being re-verified for the
    // whole window so a staged grid can correct them.
    if (publishedAlert || flagTries >= 28) return;
    var lf2 = lastPsychForm();
    if (!lf2.tableFound && !reentryDate()) { flagNoList++; if (flagNoList >= 4) return; }
    else flagNoList = 0;
    setTimeout(flagBurst, 250);
  }
  flagBurst();
})();
