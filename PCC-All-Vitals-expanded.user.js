// ==UserScript==
// @version 1.3
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

  function findCompact(){
    // Flipped 2026-10-14 (his call): the tile row pulls everything he
    // needs out of Compact view, so this script now opens COMPACT.
    // (It used to open Expanded — that is what had moved his setting
    // from Standard to Expanded.) Same finder shape, new target:
    // the toggle option whose text is 'compact', in the group that
    // also offers Expanded + Standard.
    var lists = [document.querySelectorAll('a,button'), document.querySelectorAll('span,td,div,label')];
    for (var l = 0; l < lists.length; l++){
      var els = lists[l];
      for (var i = 0; i < els.length; i++){
        var el = els[i];
        if ((el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase() !== 'compact') continue;
        var ctx = ctxText(el);                                  // must be the view toggle
        if (/expanded/i.test(ctx) && /standard/i.test(ctx)) return el;
      }
    }
    return null;
  }

  function run(){
    if (done) return;
    var el = findCompact();
    if (!el) return;
    if (isSelected(el)){ done = true; return; }                 // already Compact — leave it
    var last = +(sessionStorage.getItem('pccCompactView') || 0);
    if (Date.now() - last < 6000){ done = true; return; }       // just clicked — don't loop
    sessionStorage.setItem('pccCompactView', Date.now());
    el.click();
    done = true;
  }

  // ---- F = Weight's 'view all' (his ask, 2026-10-15) ----
  // On the Weight & Vitals page, F opens the Weight history.
  // The view-all controls are MUI buttons (data-testid
  // vtl_Vitals_viewAll_N); Weight's row is found by its Vital
  // Sign cell, with the _1 testid as fallback. Same key rules
  // as the facility Keys: real presses only, never while
  // typing, no repeat on hold, 0 toggles it off.
  var fEnabled = true;
  function weightViewAllBtn() {
    var btns = document.querySelectorAll('button[data-testid^="vtl_Vitals_viewAll_"]');
    for (var i = 0; i < btns.length; i++) {
      var row = btns[i].closest ? btns[i].closest('[role="row"], tr') : null;
      if (!row) continue;
      var cells = row.querySelectorAll('[role="cell"], td');
      for (var j = 0; j < cells.length; j++) {
        if ((cells[j].textContent || '').replace(/\s+/g, ' ').trim() === 'Weight') return btns[i];
      }
    }
    return document.querySelector('button[data-testid="vtl_Vitals_viewAll_1"]');
  }
  function plantFBadge() {
    var btn = weightViewAllBtn();
    if (!btn) return;
    if (document.getElementById('tmWtsFBadge')) return;
    var host = btn.parentElement;
    if (!host) return;
    if (!host.style.position) host.style.position = 'relative';
    var badge = document.createElement('span');
    badge.id = 'tmWtsFBadge';
    badge.textContent = 'F';
    badge.title = 'Shortcut: press F for Weight view all';
    badge.setAttribute('style',
      'position:absolute;top:-9px;right:-14px;z-index:50;' +
      'display:flex;align-items:center;justify-content:center;' +
      'width:20px;height:20px;border-radius:999px;' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;' +
      'font-size:11px;font-weight:700;color:#fff;' +
      'background:linear-gradient(135deg,#ef4444,#dc2626);' +
      'box-shadow:0 2px 8px rgba(220,38,38,.35),0 1px 2px rgba(0,0,0,.1);' +
      'pointer-events:none;user-select:none;');
    host.appendChild(badge);
  }
  function fireClick(el) {
    var w = el.ownerDocument.defaultView;
    ['mousedown', 'mouseup', 'click'].forEach(function (type) {
      el.dispatchEvent(new w.MouseEvent(type, { bubbles: true, cancelable: true, view: w }));
    });
  }
  document.addEventListener('keydown', function (e) {
    if (!e.isTrusted) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.repeat) return;
    var tg = e.target, tag = tg && tg.tagName ? tg.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (tg && tg.isContentEditable) return;
    var k = (e.key || '').toUpperCase();
    if (k === '0') { fEnabled = !fEnabled; return; }
    if (!fEnabled || k !== 'F') return;
    var btn = weightViewAllBtn();
    if (!btn) return;
    e.preventDefault();
    fireClick(btn);
  }, true);

  // Scheduling: bounded staggered runs after load + re-run on your clicks.
  // (Permanent interval removed in the reorganization — no-timers rule.)
  [400, 1000, 2000, 3500, 5500, 8000].forEach(function (ms) { setTimeout(function () { run(); plantFBadge(); }, ms); });
  var pccSchedLast = 0;
  document.addEventListener('click', function (e) {
      if (!e.isTrusted) return;
      var now = Date.now();
      if (now - pccSchedLast < 800) return;
      pccSchedLast = now;
      setTimeout(function () { run(); plantFBadge(); }, 350);
  }, true);
})();