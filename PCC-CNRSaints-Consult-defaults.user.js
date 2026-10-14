// ==UserScript==
// @version      1.9
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

  // Q9 Date of Consult (v1.9): INSTANT value fill only — the way it
  // worked every time before PCC changed. The v1.6-v1.8 calendar
  // automation is REMOVED: it opened PCC's calendar unattended on a
  // form he was editing, and the widget interaction left the section
  // flagged "errors" when he saved (his report, 2026-10-14). Standing
  // rule from this: on a form he is editing, the script sets values
  // and nothing else — no widget is opened, tapped, or focused.
  function setDateValue(doc, input){
    try {
      var v = todayStr();
      input.value = v;
      ['input', 'change'].forEach(function (ev) {
        try { input.dispatchEvent(new Event(ev, { bubbles: true })); } catch (e) {}
      });
      // The widget's real field, if the form carries one: same value.
      var els = doc.querySelectorAll('input');
      for (var i = 0; i < els.length; i++) {
        var nm = ((els[i].getAttribute && els[i].getAttribute('name')) || '') + ' ' + (els[i].id || '');
        if (els[i] !== input && nm.indexOf('Cust_2_II_9') !== -1 && nm.indexOf('_dummy') === -1) {
          try {
            els[i].value = v;
            els[i].dispatchEvent(new Event('input', { bubbles: true }));
            els[i].dispatchEvent(new Event('change', { bubbles: true }));
          } catch (e) {}
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