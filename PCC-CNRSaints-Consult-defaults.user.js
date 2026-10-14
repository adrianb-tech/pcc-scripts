// ==UserScript==
// @version      1.7
// @updateURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-CNRSaints-Consult-defaults.user.js
// @downloadURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-CNRSaints-Consult-defaults.user.js
// @name         CNR + Saints — Consult form defaults
// @match        https://*.pointclickcare.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function(){
  function todayStr(){ var d = new Date(); return ('0' + (d.getMonth() + 1)).slice(-2) + '/' + ('0' + d.getDate()).slice(-2) + '/' + d.getFullYear(); }

  function radioByValue(doc, name, val){
    var g = doc.querySelectorAll('input[type=radio][name="' + name + '"]');
    if (!g.length) return;
    for (var i = 0; i < g.length; i++) if (g[i].checked) return;                 // already answered — leave it
    for (var j = 0; j < g.length; j++) if (g[j].value === val && !g[j].checked){ g[j].click(); return; }
  }
  function checkByValue(doc, name, val){
    var g = doc.querySelectorAll('input[type=checkbox][name="' + name + '"]');
    if (!g.length) return;
    for (var i = 0; i < g.length; i++) if (g[i].checked) return;                 // any box in group checked — leave it
    for (var j = 0; j < g.length; j++) if (g[j].value === val && !g[j].checked){ g[j].click(); return; }
  }
  function setField(doc, name, val){
    var el = doc.querySelector('[name="' + name + '"]');
    if (!el || (el.value || '').trim()) return;                                  // missing, or already has content
    el.value = val;
    ['input', 'change', 'blur', 'keyup'].forEach(function(ev){ try { el.dispatchEvent(new Event(ev, { bubbles: true })); } catch(e){} });
  }

  function runIn(doc){
    if (!doc) return false;
    if (doc.__consultDone) return true;
    if (!doc.querySelector('input[name="Cust_2_I_1"]')) return false;            // only the psych consult form
    radioByValue(doc, 'Cust_2_I_1', 'a');                       // Q1 Was resident examined -> Yes
    checkByValue(doc, 'Cust_2_II_3', 'f');                      // Q3 Medication side effects -> None of the above
    radioByValue(doc, 'Cust_2_II_6', 'b');                      // Q6 New diagnosis -> No
    radioByValue(doc, 'Cust_2_II_7', 'b');                      // Q7 Initiation/increase -> No
    setField(doc, 'Cust_2_II_8', 'Adrian Balestra, PMHNP-BC');  // Q8 Name of Consultant
    // Done only when EVERY target exists — the form renders in pieces, and
    // marking done early would strand a late-rendering field forever (the
    // old 1.5s-first-run version had that race).
    var complete = ['Cust_2_I_1', 'Cust_2_II_3', 'Cust_2_II_6', 'Cust_2_II_7', 'Cust_2_II_8']
      .every(function (n) { return !!doc.querySelector('[name="' + n + '"]'); });
    if (complete) doc.__consultDone = true;
    return complete;
  }

  function runAll(){
    var done = runIn(document);
    var ifr = document.querySelectorAll('iframe');
    for (var i = 0; i < ifr.length; i++){ try { if (runIn(ifr[i].contentDocument)) done = true; } catch(e){} }
    return done;
  }

  // Q9 Date of Consult (v1.6): filled THROUGH PCC's own calendar widget
  // — the script opens the calendar and taps today's cell, so PCC
  // registers the date exactly as it does for a hand-pick. Why: signing
  // a form throws PCC's server error '...because "date" is null'
  // whenever PCC has no registered date for the form — proven three ways
  // on 2026-10-14: (1) bisect — script off + date hand-picked via the
  // calendar -> signing lands clean; (2) v1.5 — script on but leaving the
  // field EMPTY -> signing throws it again; (3) the weeks-old value-set
  // versions displayed a date yet signing still threw it. So the date
  // must go in through the widget's own path. If the tap cannot be
  // verified, a warning chip stays on the form so he never signs an
  // unset date unknowingly.
  var MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  function fireTap(el){
    ['mousedown','mouseup','click'].forEach(function(ev){
      try { el.dispatchEvent(new MouseEvent(ev, { bubbles: true, cancelable: true })); } catch(e){}
    });
  }
  function dateIsToday(doc){
    var el = doc.querySelector('[name="displaydateCust_2_II_9_dummy"]');
    return !!el && (el.value || '').replace(/\s+/g, '') === todayStr();
  }
  function findCalTrigger(doc, input){
    try {
      var scope = input.closest('td') || input.parentNode;
      if (!scope) return null;
      var els = scope.querySelectorAll('img, button, a, input[type="button"]');
      for (var i = 0; i < els.length; i++) {
        if (els[i] === input) continue;
        var hay = ((els[i].getAttribute && (els[i].getAttribute('src') || '')) + ' ' + (els[i].alt || '') + ' ' + (els[i].title || '') + ' ' + (els[i].className || '') + ' ' + (els[i].getAttribute && els[i].getAttribute('onclick') || '')).toLowerCase();
        if (hay.indexOf('cal') !== -1) return els[i];
      }
      // fallback: first clickable sibling right after the input
      var n = input.nextElementSibling;
      if (n && /^(IMG|BUTTON|A|INPUT)$/.test(n.tagName)) return n;
    } catch (e) {}
    return null;
  }
  // The calendar may open as an in-page popup or as a separate window
  // (window.open). Hook window.open once per form window so the popup —
  // if any — is reachable. v1.6 only tapped inside the form's own page
  // and the calendar sat open waiting for him (his report, 2026-10-14:
  // "it opened the date for me to choose. i want it to actually put
  // todays date in.").
  function hookPopup(doc){
    try {
      var w = doc.defaultView;
      if (!w || w.__pccCalHooked) return;
      w.__pccCalHooked = true;
      var orig = w.open;
      if (typeof orig !== 'function') return;
      w.open = function(){
        var p = null;
        try { p = orig.apply(this, arguments); } catch(e){}
        try { if (p) w.__pccCalPopup = p; } catch(e){}
        return p;
      };
    } catch (e) {}
  }
  function tapTodayCell(doc){
    try {
      var now = new Date();
      var dayNum = String(now.getDate());
      var mo = now.getMonth() + 1, yr = now.getFullYear();
      var monthName = MONTHS[now.getMonth()];
      var yearStr = String(yr);
      var all = doc.querySelectorAll('td, a, span, div');
      // Strategy 1: an element whose own handler/link names today's date.
      var pats = [mo + '/' + dayNum + '/' + yr, yr + '-' + mo + '-' + dayNum, yr + '/' + mo + '/' + dayNum,
                  '(' + yr + ', ' + (mo - 1) + ', ' + dayNum + ')', '(' + yr + ',' + (mo - 1) + ',' + dayNum + ')',
                  '(' + yr + ', ' + mo + ', ' + dayNum + ')', '(' + yr + ',' + mo + ',' + dayNum + ')'];
      var i, el, hay;
      for (i = 0; i < all.length; i++) {
        el = all[i];
        hay = ((el.getAttribute && el.getAttribute('onclick')) || '') + ' ' + ((el.getAttribute && el.getAttribute('href')) || '') + ' ' + ((el.getAttribute && el.getAttribute('title')) || '');
        if (!hay.trim()) continue;
        for (var p = 0; p < pats.length; p++) if (hay.indexOf(pats[p]) !== -1) { fireTap(el); return true; }
      }
      // Strategy 2: a cell the calendar itself marks as today.
      for (i = 0; i < all.length; i++) {
        el = all[i];
        var cls = ((el.className || '') + ' ' + ((el.getAttribute && el.getAttribute('title')) || '')).toLowerCase();
        if (cls.indexOf('today') !== -1 && el.getClientRects && el.getClientRects().length) { fireTap(el); return true; }
      }
      // Strategy 3: the bare day number inside a calendar showing this
      // month + year — clickable links first, then cells.
      var rank = { A: 0, TD: 1, SPAN: 2, DIV: 3 };
      var cands = [];
      for (i = 0; i < all.length; i++) {
        el = all[i];
        if ((el.textContent || '').replace(/\s+/g, ' ').trim() !== dayNum) continue;
        if (!el.getClientRects || !el.getClientRects().length) continue;
        var anc = el, inCal = false;
        for (var up = 0; up < 6 && anc; up++) {
          var at = (anc.textContent || '').toLowerCase();
          if (at.indexOf(monthName) !== -1 && at.indexOf(yearStr) !== -1 && at.length < 4000) { inCal = true; break; }
          anc = anc.parentNode;
        }
        if (!inCal) continue;
        var cl2 = (el.className || '') + ' ' + ((el.getAttribute && el.getAttribute('title')) || '');
        if (/other|prev|next|disabled|inactive/i.test(cl2)) continue;
        cands.push(el);
      }
      cands.sort(function (a, b) { return (rank[a.tagName] || 9) - (rank[b.tagName] || 9); });
      if (cands.length) { fireTap(cands[0]); return true; }
    } catch (e) {}
    return false;
  }
  function tryTapCalendars(doc){
    if (tapTodayCell(doc)) return true;
    try {
      var w = doc.defaultView;
      var pop = w && w.__pccCalPopup;
      if (pop && !pop.closed && pop.document) return tapTodayCell(pop.document);
    } catch (e) {}
    return false;
  }
  function dateWarn(doc, show){
    try {
      var chip = doc.getElementById('pcc-date-warn');
      if (!show) { if (chip && chip.parentNode) chip.parentNode.removeChild(chip); return; }
      if (chip) return;
      chip = doc.createElement('div');
      chip.id = 'pcc-date-warn';
      chip.textContent = 'Date of Consult is NOT set - open the calendar icon and pick today before signing.';
      chip.setAttribute('style', 'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#fff;border:1.5px solid #b45309;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.25);padding:9px 14px;font:600 13px -apple-system,Helvetica,Arial,sans-serif;color:#92400e;');
      (doc.body || doc.documentElement).appendChild(chip);
    } catch (e) {}
  }
  function runDateIn(doc, latePass){
    if (!doc || doc.__consultDateDone) return;
    if (!doc.querySelector('input[name="Cust_2_I_1"]')) return;
    if (dateIsToday(doc)) { doc.__consultDateDone = true; dateWarn(doc, false); return; }
    var input = doc.querySelector('[name="displaydateCust_2_II_9_dummy"]');
    if (!input) return;
    if (!doc.__consultDateTried) {
      doc.__consultDateTried = true;
      hookPopup(doc);
      var trig = findCalTrigger(doc, input);
      if (trig) {
        fireTap(trig);
        [350, 900, 1600, 2600, 4000].forEach(function (ms) {
          setTimeout(function(){
            try {
              if (dateIsToday(doc)) { doc.__consultDateDone = true; dateWarn(doc, false); return; }
              tryTapCalendars(doc);
            } catch(e){}
          }, ms);
        });
        setTimeout(function(){ try { if (dateIsToday(doc)) { doc.__consultDateDone = true; dateWarn(doc, false); } } catch(e){} }, 4800);
      }
    }
    if (latePass && !doc.__consultDateDone && !dateIsToday(doc)) dateWarn(doc, true);
  }
  function runDateAll(latePass){
    runDateIn(document, latePass);
    var ifr = document.querySelectorAll('iframe');
    for (var i = 0; i < ifr.length; i++){ try { runDateIn(ifr[i].contentDocument, latePass); } catch(e){} }
  }

  // v1.3 speed-up (his request, piloted like the tab bar): document-start +
  // a fast bounded burst — retry every 60ms until the form is fully set
  // (~3s cap) — so each check lands the moment PCC renders its field,
  // instead of at the old 1.5s/3s/6s/10s waves. The staggered tail remains
  // as a safety net for very late form frames. Not a permanent interval.
  // (v1.6: the date goes through PCC's calendar widget — see runDateIn.)
  var burstLeft = 50;
  (function burst(){
    if (runAll()) return;
    if (--burstLeft <= 0) return;
    setTimeout(burst, 60);
  })();
  [1500, 3000, 6000, 10000].forEach(function (ms) {
    setTimeout(function(){ runAll(); runDateAll(ms >= 3000); }, ms);
  });
})();