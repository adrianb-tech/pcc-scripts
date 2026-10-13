// ==UserScript==
// @version 1.1
// @updateURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Vitals-expanded.user.js
// @downloadURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Vitals-expanded.user.js
// @name         Every facility — Vitals: open expanded
// @match        https://*.pointclickcare.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function(){
  var done = false;   // one shot per page load — manual switches are respected

  function ctxText(el){
    var t = '', p = el.parentElement, up = 0;
    while (p && up < 4){ t += ' ' + (p.textContent || ''); p = p.parentElement; up++; }
    return t;
  }

  function isSelected(el){
    var c = (el.getAttribute('class') || '');
    if (/select|active|current|pressed/i.test(c)) return true;
    if (el.getAttribute('aria-pressed') === 'true') return true;
    if (el.getAttribute('aria-selected') === 'true') return true;
    if (el.disabled) return true;
    // in PCC the active option is usually plain text; inactive ones are links
    if (el.tagName !== 'A' && el.tagName !== 'BUTTON' && !el.onclick && el.getAttribute('onclick') == null) return true;
    return false;
  }

  function findExpanded(){
    // prefer clickable elements, then fall back to plain elements
    var lists = [document.querySelectorAll('a,button'), document.querySelectorAll('span,td,div,label')];
    for (var l = 0; l < lists.length; l++){
      var els = lists[l];
      for (var i = 0; i < els.length; i++){
        var el = els[i];
        if ((el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase() !== 'expanded') continue;
        var ctx = ctxText(el);                                  // must be the vitals toggle
        if (/compact/i.test(ctx) && /standard/i.test(ctx)) return el;
      }
    }
    return null;
  }

  function run(){
    if (done) return;
    var el = findExpanded();
    if (!el) return;
    if (isSelected(el)){ done = true; return; }                 // already Expanded — leave it
    var last = +(sessionStorage.getItem('pccExpanded') || 0);
    if (Date.now() - last < 6000){ done = true; return; }       // just clicked — don't loop
    sessionStorage.setItem('pccExpanded', Date.now());
    el.click();
    done = true;
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