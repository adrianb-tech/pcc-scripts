// ==UserScript==
// @version 1.6
// @updateURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Vitals-expanded.user.js
// @downloadURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Vitals-expanded.user.js
// @name         Every facility — Header view: open compact
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
    // from Standard to Expanded.)
    // 2026-10-25 (Vitals 1.6): the toggle is PCC's resident-header
    // view toggle (capture shape, fixture h221): buttons with ids
    // rh-header-view-toggle-toggle-button-<mode> + matching
    // data-testids, mutually exclusive, one always selected.
    // Precise finder first; the text+context shape is the fallback
    // if PCC ever changes the ids.
    var precise = document.getElementById('rh-header-view-toggle-toggle-button-compact') ||
      document.querySelector('[data-testid="rh-header-view-toggle-toggle-button-compact"]');
    if (precise) return precise;
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
    // 2026-10-25: no session throttle. The old 6s throttle skipped a
    // needed click when he moved between pages quickly (<6s apart) —
    // a "sometimes" cause of Standard showing. The done flag +
    // isSelected already prevent loops (click only when Compact is
    // not selected; done after one click).
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
    // Fixed overlay on <body> (v1.5): the vitals table is a
    // React app that re-renders its rows; badges planted
    // inside the row got clipped (v1.3) or wiped (v1.4). The
    // overlay tracks the Weight button's position instead.
    var btn = weightViewAllBtn();
    var badge = document.getElementById('tmWtsFBadge');
    if (!btn) { if (badge) badge.style.display = 'none'; return; }
    if (!badge) {
      badge = document.createElement('span');
      badge.id = 'tmWtsFBadge';
      badge.textContent = 'F';
      badge.title = 'Shortcut: press F for Weight view all';
      badge.setAttribute('style',
        'position:fixed;z-index:999999;' +
        'display:flex;align-items:center;justify-content:center;' +
        'width:20px;height:20px;border-radius:999px;' +
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;' +
        'font-size:11px;font-weight:700;color:#fff;' +
        'background:linear-gradient(135deg,#ef4444,#dc2626);' +
        'box-shadow:0 2px 8px rgba(220,38,38,.35),0 1px 2px rgba(0,0,0,.1);' +
        'pointer-events:none;user-select:none;');
      (document.body || document.documentElement).appendChild(badge);
    }
    var r = btn.getClientRects()[0];
    if (!r) { badge.style.display = 'none'; return; }
    badge.style.display = 'flex';
    badge.style.left = (r.right + 4) + 'px';
    badge.style.top = (r.top + Math.max(0, (r.height - 20) / 2)) + 'px';
  }
  var wtsScrollLast = 0;
  function wtsOnScroll() { var n = Date.now(); if (n - wtsScrollLast < 250) return; wtsScrollLast = n; plantFBadge(); }
  window.addEventListener('scroll', wtsOnScroll, true);
  window.addEventListener('resize', wtsOnScroll);
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

  // Scheduling (Smooth Arrival, audit B4): the view
  // change happens in the FIRST pass that finds the
  // toggle - the staggered ladder is gone. A bounded
  // burst (250ms steps, ~10s) retries only while the
  // header is still rendering, and stops as soon
  // as run() is done; the F overlay plants in that same
  // pass and afterwards only repositions (scroll/resize/
  // click), never re-plants.
  var vtsTries = 0;
  function vtsBurst() {
    run();
    plantFBadge();
    vtsTries++;
    if (done || vtsTries >= 40) return;
    setTimeout(vtsBurst, 250);
  }
  vtsBurst();
  // 2026-10-25: a manual touch on the header toggle ends the
  // script's authority that load. The burst runs up to ~10s for
  // slow renders, but once he clicks any toggle button himself,
  // done is set and the burst never clicks again — his pick
  // stands, even if it happens mid-burst. Only real presses
  // count (isTrusted); the script's own load-time click does
  // not trip this, and run() sets done itself anyway.
  document.addEventListener('click', function (e) {
    if (!e.isTrusted) return;
    var t = e.target;
    if (t && t.closest && t.closest('#rh-header-view-toggle, [data-testid^="rh-header-view-toggle-toggle-button-"]')) done = true;
  }, true);
  var pccSchedLast = 0;
  document.addEventListener('click', function (e) {
      if (!e.isTrusted) return;
      var now = Date.now();
      if (now - pccSchedLast < 800) return;
      pccSchedLast = now;
      // 2026-10-25: click repositions the F badge ONLY. The old
      // run() retry here re-asserted Compact after any click when
      // the load-time burst had missed — overriding a manual
      // Standard/Expanded pick. Manual switches stand now.
      setTimeout(function () { plantFBadge(); }, 350);
  }, true);
})();