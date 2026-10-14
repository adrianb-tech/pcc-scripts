// ==UserScript==
// @version      1.10
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

  // Q9 Date of Consult (v1.10): the date is TYPED into the field —
  // character by character, with real key events, ending in a blur —
  // so PCC's date widget processes it exactly as if he typed it
  // himself. Why: a plain value write (v1.9) displays fine but PCC
  // still judged the section INCOMPLETE on save (his report, 2026-10-14:
  // the pink "errors" row, fixed by hand each time) — the widget never
  // parsed the answer. Hand entry is the proven-good input (his typed
  // and calendar-picked dates validate and sign clean). This is still
  // instant: one burst in the form's opening moments, nothing opens,
  // and once the field holds today every later pass is a no-op.
  function keyEv(doc, type, ch){
    var w = doc.defaultView || window;
    var e = new w.KeyboardEvent(type, { key: ch, bubbles: true, cancelable: true });
    try {
      var code = ch.charCodeAt(0);
      Object.defineProperty(e, 'keyCode', { get: function(){ return code; } });
      Object.defineProperty(e, 'which', { get: function(){ return code; } });
    } catch (err) {}
    return e;
  }
  function setDateValue(doc, input){
    try {
      var v = todayStr();
      try { input.focus(); } catch (e0) {}
      input.value = '';
      try { input.dispatchEvent(new Event('input', { bubbles: true })); } catch (e1) {}
      for (var i = 0; i < v.length; i++) {
        var ch = v.charAt(i);
        try { input.dispatchEvent(keyEv(doc, 'keydown', ch)); } catch (e2) {}
        input.value = v.slice(0, i + 1);   // the character lands
        try { input.dispatchEvent(keyEv(doc, 'keypress', ch)); } catch (e3) {}
        try { input.dispatchEvent(new Event('input', { bubbles: true })); } catch (e4) {}
        try { input.dispatchEvent(keyEv(doc, 'keyup', ch)); } catch (e5) {}
      }
      try { input.dispatchEvent(new Event('change', { bubbles: true })); } catch (e6) {}
      try { input.blur(); } catch (e7) {}   // tab-out commit, like a typist leaving the field
      // The widget's real field, if the form carries one: same value.
      var els = doc.querySelectorAll('input');
      for (var j = 0; j < els.length; j++) {
        var nm = ((els[j].getAttribute && els[j].getAttribute('name')) || '') + ' ' + (els[j].id || '');
        if (els[j] !== input && nm.indexOf('Cust_2_II_9') !== -1 && nm.indexOf('_dummy') === -1) {
          try {
            els[j].value = v;
            els[j].dispatchEvent(new Event('input', { bubbles: true }));
            els[j].dispatchEvent(new Event('change', { bubbles: true }));
          } catch (e8) {}
        }
      }
    } catch (e) {}
  }
  function runDateIn(doc){
    if (!doc) return;
    if (!doc.querySelector('input[name="Cust_2_I_1"]')) return;
    var input = doc.querySelector('[name="displaydateCust_2_II_9_dummy"]');
    if (!input) return;
    if ((input.value || '').replace(/\s+/g, '') !== todayStr()) setDateValue(doc, input);
  }
  function runDateFillAll(){
    runDateIn(document);
    var ifr = document.querySelectorAll('iframe');
    for (var i = 0; i < ifr.length; i++){ try { runDateIn(ifr[i].contentDocument); } catch(e){} }
  }
  function runDateAll(){ runDateFillAll(); }

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
  [60, 300, 800].forEach(function (ms) { setTimeout(runDateFillAll, ms); });
  [1500, 3000, 6000, 10000].forEach(function (ms) {
    setTimeout(function(){ runAll(); runDateAll(ms >= 3000); }, ms);
  });
})();