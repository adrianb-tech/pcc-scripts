// ==UserScript==
// @version      1.14
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

  // The D (ported from Bedford + Crown Heights defaults
  // 1.18, his ask 2026-10-23 — it works there and he wants
  // it at every facility): on the newassess popup — New
  // and Copy/Follow-up both land there — a "D" badge on
  // the Save button, and the D key clicks Save. Same
  // discipline as the original: D is live only until he
  // types or clicks into a field; the moment he edits
  // anything, D goes dead there, so it can never fight
  // him over the date field. Facility gate reads the
  // opener (the chart behind the popup), same names the
  // CNR+Saints Keys script trusts.
  var dPlanted = false;
  function popupFacilityOk(){
    try {
      var texts = [];
      var grab = function (win){ try { if (win && win.document && win.document.body) texts.push(win.document.body.innerText || win.document.body.textContent || ''); } catch (e) {} };
      grab(window.opener); grab(window);
      try { if (window.opener) grab(window.opener.top); } catch (e) {}
      var txt = texts.join(' ').toLowerCase();
      return txt.indexOf('downtown brooklyn') !== -1 || txt.indexOf('saints joachim') !== -1 ||
             txt.indexOf('joachim & anne') !== -1 || txt.indexOf('joachim and anne') !== -1;
    } catch (e) { return false; }
  }
  function popupSaveButton(){
    var ins = document.querySelectorAll('input[type="button"], input[type="submit"]');
    for (var i = 0; i < ins.length; i++) if ((ins[i].value || '') === 'Save') return ins[i];
    return null;
  }
  function plantD(){
    if (dPlanted) return;
    if (!/newassess\.jsp/.test(location.pathname) && !document.querySelector('input[name="ESOLsave"]')) return;
    if (!popupFacilityOk()) return;
    var btn = popupSaveButton();
    if (!btn) return;
    var badge = document.createElement('span');
    badge.textContent = 'D';
    badge.style.cssText = 'display:inline-block;margin-left:6px;padding:1px 7px;' +
      'background:#2f6f4f;color:#fff;border-radius:6px;vertical-align:middle;' +
      'font:600 12px -apple-system,Helvetica,Arial,sans-serif;';
    btn.parentNode.insertBefore(badge, btn.nextSibling);
    dPlanted = true;
    var heIsEditing = false;
    document.addEventListener('input', function () { heIsEditing = true; }, true);
    document.addEventListener('mousedown', function (ev) {
      var tg = ev.target;
      if (tg && (tg.tagName === 'TEXTAREA' || (tg.tagName === 'INPUT' && (tg.type === 'text' || tg.type === 'password')))) heIsEditing = true;
    }, true);
    document.addEventListener('keydown', function (e) {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key !== 'd' && e.key !== 'D') return;
      if (heIsEditing) return;
      var b = popupSaveButton();
      if (!b) return;
      e.preventDefault();
      var a = document.activeElement;
      if (a && a.blur) { try { a.blur(); } catch (err) {} }
      ['mousedown', 'mouseup', 'click'].forEach(function (type) {
        b.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
      });
    });
  }

  // Q9 Date of Consult — this script never touches it while he edits
  // (comment corrected in v1.13). The date IS auto-filled, but by the
  // CNR+Saints Keys script (v1.18+), inside his F press: typed in and
  // committed as step one of the save itself. Filling it during
  // editing — every variant tried on 2026-10-14 — is what fought him
  // on the form page. Checks + consultant name still fill instantly.

  // v1.3 speed-up (his request, piloted like the tab bar): document-start +
  // a fast bounded burst — retry every 60ms until the form is fully set
  // (~3s cap) — so each check lands the moment PCC renders its field,
  // instead of at the old 1.5s/3s/6s/10s waves. The staggered tail remains
  // as a safety net for very late form frames. Not a permanent interval.
  // (v1.12: the date is off — these passes set checks + name only.)
  var burstLeft = 50;
  (function burst(){
    plantD();
    if (runAll()) return;
    if (--burstLeft <= 0) return;
    setTimeout(burst, 60);
  })();
  [1500, 3000, 6000, 10000].forEach(function (ms) {
    setTimeout(function(){ runAll(); plantD(); }, ms);
  });
})();