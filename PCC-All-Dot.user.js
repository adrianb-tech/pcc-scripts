// ==UserScript==
// @name         PCC — Dot
// @version      1.0
// @updateURL    https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Dot.user.js
// @downloadURL  https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Dot.user.js
// @match        https://*.pointclickcare.com/*
// @match        https://*.pointclickcare.ca/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

// PCC — Dot, stage 1 (2026-10-24, his build order): the dot assembly on
// every chart page — a violet enso ring (neutral in stage 1: its fill and
// check mark wait for the gathering discussion) with one dot underneath
// per source page. Drag it anywhere; the position persists in
// localStorage (x/y only, no chart data). The dots are his trail: a dot
// fills ONLY when he actually goes to that page — background fetches
// never fill one (his ruling, 2026-10-24). The trail lives in
// sessionStorage, keyed by chart number, so a new resident starts a
// fresh trail. The ring's extraction wiring and the tap menu arrive in
// stage 2, after the gathering discussion — stage 1 tap does nothing
// (but never leaks a click into PCC).
//
// Placement law: the host is a fixed-position overlay appended to <body>
// (or <html> at document-start), OUTSIDE the header/tab containers PCC
// swaps replace — so a tab swap should leave it standing. The guarded
// click-triggered re-plant below is belt-and-braces only: it fires
// solely when the host is actually gone, and stops at the first check
// that finds it present. It never moves PCC targets, so it does not
// reopen the frozen-bar window (his 2026-10-19 ruling).
//
// Standing laws honored: top document only (no dot per portlet frame);
// keys dead while typing; '0' toggles the dot (session-only); nothing
// phones out; no resident names stored — the trail key is the chart
// number alone, the same key Core uses; Snippety untouched (no fields,
// no clipboard, no keys except the guarded '0').

(function () {
  'use strict';
  if (window.top !== window.self) return;

  var DOT_PAGES = [
    { tab: 'DASH', label: 'Dash' },
    { tab: 'PROG NOTES', label: 'Prog Notes' },
    { tab: 'MDS', label: 'MDS' },
    { tab: 'RESULTS', label: 'Results' },
    { tab: 'WTS/VITALS', label: 'WTS/VITALS' },
    { tab: 'MED HISTORY', label: 'Med history' } // source undiscovered: never fills in stage 1
  ];
  var ALL_TABS = ['DASH', 'PROFILE', 'CENSUS', 'MED DIAG', 'PROBLEMS', 'ALLERGIES', 'IMMUN',
    'ORDERS', 'WTS/VITALS', 'RESULTS', 'MDS', 'FORMS', 'ASSMNTS', 'THERAPY', 'PROG NOTES', 'CARE PLAN',
    'TASKS', 'MISC'];
  var HOST_ID = 'tmDotHost';
  var POS_KEY = 'tmDotPos';
  var DOT_W = 120, DOT_H = 130; // assembly footprint, for viewport clamping

  function norm(s) { return (s || '').replace(/\s+/g, ' ').trim().toUpperCase(); }
  function isDotPage(tab) { return DOT_PAGES.some(function (p) { return p.tab === tab; }); }

  // Current tab: PCC's own selected class wins when present; the URL
  // names DASH/PROFILE/PROG NOTES from the first paint; Hide-tabs'
  // session memory ('pccCurTab', read-only here) is the fallback.
  // Returns { name, solid } — solid = selected class or URL, memory
  // alone is not solid (it may name the tab he came FROM).
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
  function findBar(cands) {
    var recs = [], byNode = new Map();
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
  function selectedTab() {
    var cands = candidates();
    if (!cands.length) return '';
    var bar = findBar(cands);
    if (!bar) return '';
    for (var i = 0; i < cands.length; i++) {
      if (!bar.contains(cands[i].el)) continue;
      var n = cands[i].el;
      for (var up = 0; up < 3 && n; up++) {
        var cls = String(n.className || '');
        if (/(selected|active|current)/i.test(cls) || n.getAttribute('aria-selected') === 'true') return cands[i].name;
        n = n.parentElement;
      }
    }
    return '';
  }
  function urlTab() {
    var u = location.href;
    if (/cp_residentdashboard/i.test(u)) return 'DASH';
    if (/cp_careclientprofile/i.test(u)) return 'PROFILE';
    if (/progressnotes/i.test(u)) return 'PROG NOTES';
    return '';
  }
  function detectCurrent() {
    var sel = selectedTab();
    if (sel) return { name: sel, solid: true };
    var u = urlTab();
    if (u) return { name: u, solid: true };
    try {
      var m = sessionStorage.getItem('pccCurTab') || '';
      if (m) return { name: m, solid: false };
    } catch (e) {}
    return { name: '', solid: false };
  }

  // Resident key: the chart number in the header alone ('Last, First
  // (CH187985)'), the same element Core's S key reads. URL EIDs rotate
  // per page and per link (his captures prove it) — never used as a
  // key, so a missing header means no trail, not a wrong trail.
  function headerChart() {
    try {
      var els = document.querySelectorAll('span, div, h1, h2, h3, td, a, b, strong');
      for (var i = 0; i < els.length; i++) {
        var tx = (els[i].textContent || '').replace(/\s+/g, ' ').trim();
        if (tx.length > 70 || tx.length < 5) continue;
        if (/^clinical\s/i.test(tx)) continue;
        var em = tx.match(/^[A-Za-z][A-Za-z'’.\-]+(?:\s+[A-Za-z][A-Za-z'’.\-]+)?\s*,\s*[A-Za-z][A-Za-z'’.\- ]+?\s*\(\s*([A-Za-z]{0,5}\d{3,})\s*\)/);
        if (em) return 'chart:' + em[1].toUpperCase();
      }
    } catch (e) {}
    return '';
  }

  var trailChart = '';
  var trail = [];
  function loadTrail(chart) {
    trailChart = chart; trail = [];
    if (!chart) return;
    try {
      var raw = sessionStorage.getItem('tmDotTrail:' + chart);
      if (raw) { var arr = JSON.parse(raw); if (Array.isArray(arr)) trail = arr; }
    } catch (e) { trail = []; }
  }
  function markVisited(tab) {
    if (!trailChart || !isDotPage(tab) || trail.indexOf(tab) !== -1) return;
    trail.push(tab);
    try { sessionStorage.setItem('tmDotTrail:' + trailChart, JSON.stringify(trail)); } catch (e) {}
  }

  function loadPos() {
    try {
      var raw = localStorage.getItem(POS_KEY);
      if (!raw) return null;
      var p = JSON.parse(raw);
      if (typeof p.x === 'number' && typeof p.y === 'number') return p;
    } catch (e) {}
    return null;
  }
  function clampPos(x, y) {
    var vw = window.innerWidth || 1024, vh = window.innerHeight || 768;
    return {
      x: Math.max(0, Math.min(x, Math.max(0, vw - DOT_W))),
      y: Math.max(0, Math.min(y, Math.max(0, vh - DOT_H)))
    };
  }

  var host = null, shadow = null, boxEl = null, dotsEl = null;

  function dotTitle(p, state) {
    if (state === 'current') return p.label + ' — here now';
    if (state === 'visited') return p.label + ' — visited';
    return p.label + ' — not yet visited';
  }
  function renderDots(currentTab) {
    if (!dotsEl) return;
    var html = '';
    DOT_PAGES.forEach(function (p) {
      var state = (p.tab === currentTab) ? 'current'
        : (trail.indexOf(p.tab) !== -1) ? 'visited' : 'empty';
      html += '<span class="tmDot ' + state + '" title="' + dotTitle(p, state) + '"></span>';
    });
    dotsEl.innerHTML = html;
  }

  function plant() {
    var existing = document.getElementById(HOST_ID);
    if (existing) { // re-plant guard: never duplicate, just re-render
      host = existing; shadow = host.shadowRoot;
      if (shadow) { boxEl = shadow.getElementById('tmDotBox'); dotsEl = shadow.getElementById('tmDots'); }
      var cur0 = detectCurrent().name;
      renderDots((cur0 && isDotPage(cur0)) ? cur0 : '');
      return;
    }
    host = document.createElement('div');
    host.id = HOST_ID;
    var pos = loadPos();
    if (pos) {
      var c = clampPos(pos.x, pos.y);
      host.style.left = c.x + 'px'; host.style.top = c.y + 'px';
    } else {
      host.style.right = '16px'; host.style.bottom = '16px';
    }
    host.style.cssText += 'position:fixed;z-index:2147483647;margin:0;padding:0;';
    var parent = document.body || document.documentElement;
    parent.appendChild(host);
    shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML =
      '<style>' +
      '#tmDotBox{display:flex;flex-direction:column;align-items:center;gap:6px;padding:6px;' +
      'cursor:grab;user-select:none;-webkit-user-select:none;touch-action:none;background:transparent;}' +
      '#tmDotBox.dragging{cursor:grabbing;}' +
      '.tmDot{width:11px;height:11px;border-radius:50%;box-sizing:border-box;}' +
      '.tmDot.empty{background:#ffffff;border:2px solid #cbd5e1;}' +
      '.tmDot.visited{background:#7c3aed;border:2px solid #7c3aed;}' +
      '.tmDot.current{background:#7c3aed;border:2px solid #7c3aed;' +
      'box-shadow:0 0 0 2px #ffffff,0 0 0 4px #7c3aed;}' +
      '#tmDots{display:flex;gap:7px;}' +
      '</style>' +
      '<div id="tmDotBox">' +
      '<svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">' +
      '<circle cx="32" cy="32" r="26" fill="none" stroke="#7c3aed" stroke-width="5" ' +
      'stroke-linecap="round" stroke-dasharray="128 163" transform="rotate(-45 32 32)"/>' +
      '</svg>' +
      '<div id="tmDots"></div>' +
      '</div>';
    boxEl = shadow.getElementById('tmDotBox');
    dotsEl = shadow.getElementById('tmDots');
    bindDrag();
    renderDots(detectCurrent().name);
  }

  function bindDrag() {
    var startX = 0, startY = 0, startL = 0, startT = 0, dragging = false, moved = false;
    boxEl.addEventListener('pointerdown', function (ev) {
      // Never leak a dot press into PCC: its document click listeners
      // (gather, panel-close, verdict publish) must not fire from a drag.
      ev.stopPropagation();
      ev.preventDefault();
      var rect = host.getBoundingClientRect();
      startL = (rect.width > 0) ? rect.left : (parseInt(host.style.left, 10) || 0);
      startT = (rect.height > 0) ? rect.top : (parseInt(host.style.top, 10) || 0);
      host.style.left = startL + 'px'; host.style.top = startT + 'px';
      host.style.right = 'auto'; host.style.bottom = 'auto';
      startX = ev.clientX; startY = ev.clientY;
      dragging = true; moved = false;
      boxEl.classList.add('dragging');
      try { if (ev.pointerId !== undefined) boxEl.setPointerCapture(ev.pointerId); } catch (e) {}
    });
    boxEl.addEventListener('pointermove', function (ev) {
      if (!dragging) return;
      ev.stopPropagation();
      var dx = ev.clientX - startX, dy = ev.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
      if (!moved) return;
      var c = clampPos(startL + dx, startT + dy);
      host.style.left = c.x + 'px'; host.style.top = c.y + 'px';
    });
    function endDrag(ev) {
      if (!dragging) return;
      ev.stopPropagation();
      dragging = false;
      boxEl.classList.remove('dragging');
      if (!moved) return; // a tap, not a drag: no position to save
      try {
        localStorage.setItem(POS_KEY, JSON.stringify({
          x: parseInt(host.style.left, 10) || 0,
          y: parseInt(host.style.top, 10) || 0
        }));
      } catch (e) {}
    }
    boxEl.addEventListener('pointerup', endDrag);
    boxEl.addEventListener('pointercancel', endDrag);
    // Stage 1 tap does nothing (the menu arrives with stage 2) — but it
    // still stops here, so tapping the dot never closes a PCC panel.
    boxEl.addEventListener('click', function (ev) { ev.stopPropagation(); });
  }

  // '0' toggles the dot, session-only. Dead while typing, and never on a
  // modified press (Ctrl+0 is the browser's zoom reset, not ours).
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== '0' || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    var t = ev.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (!host) return;
    host.style.display = (host.style.display === 'none') ? '' : 'none';
  });

  // Bounded refinement burst: re-detects the current tab + trail as PCC
  // renders (the selected class lands late). Stops early on a solid
  // current tab + known resident; otherwise runs the full ~2s. Only the
  // initial burst removes the host on non-chart pages (login: no tab,
  // no header, no chart URL) — a re-planted host stays put.
  function refineBurst(removeIfNoContext) {
    var contextFound = false, burstLeft = 40;
    (function burst() {
      var cur = detectCurrent();
      var chart = headerChart();
      if (cur.name || chart) contextFound = true;
      if (chart && chart !== trailChart) loadTrail(chart);
      if (trailChart && cur.name) markVisited(cur.name);
      var dotTab = (cur.name && isDotPage(cur.name)) ? cur.name : '';
      renderDots(dotTab);
      if (trailChart && cur.solid) return; // solid current + known resident: done
      if (--burstLeft <= 0) {
        if (removeIfNoContext && !contextFound && host && host.parentElement) {
          host.parentElement.removeChild(host);
        }
        return;
      }
      setTimeout(burst, 50);
    })();
  }

  // Guarded re-plant watch, dot-only: a click arms ONE bounded watch
  // (2s, 100ms checks). Every check re-detects the current tab and
  // trail — so a swap that KEEPS the host still moves the outline and
  // fills the new tab's dot — and a genuinely missing host is rebuilt
  // (followed by a refinement burst). It keeps watching through a slow
  // swap instead of stopping at the first present check. Dot clicks
  // never arm it (they stop above); a missing host at click time
  // means a non-chart page, and no watch is armed.
  var reWatching = false;
  document.addEventListener('click', function () {
    if (reWatching || !document.getElementById(HOST_ID)) return;
    reWatching = true;
    var left = 20;
    (function reBurst() {
      if (!document.getElementById(HOST_ID)) { plant(); refineBurst(false); }
      else {
        var cur2 = detectCurrent();
        var chart2 = headerChart();
        if (chart2 && chart2 !== trailChart) loadTrail(chart2);
        if (trailChart && cur2.name) markVisited(cur2.name);
        renderDots((cur2.name && isDotPage(cur2.name)) ? cur2.name : '');
      }
      if (--left <= 0) { reWatching = false; return; }
      setTimeout(reBurst, 100);
    })();
  });

  // Plant now (document-start: before first paint on chart pages), then
  // refine as PCC renders.
  plant();
  refineBurst(true);
})();
