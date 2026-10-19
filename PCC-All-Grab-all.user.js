// ==UserScript==
// @name         Every facility — Grab all (G)
// @version      1.2
// @updateURL    https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Grab-all.user.js
// @downloadURL  https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Grab-all.user.js
// @match        https://*.pointclickcare.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // Grab all (built 2026-10-13, reviving the Oct 5 G key at Adrian's direction).
  // Press G on any chart page: every Copy button ON THAT PAGE queues its value
  // for the Copy-to-note engine — exactly what is on the screen, nothing more.
  // A header page queues Age/Sex + Allergies; the Dashboard adds Psych meds;
  // Progress Notes adds Diagnoses; the Profile adds Relationships; the Forms
  // list adds the BIMS score showing there. Rules: dead while typing, no
  // repeat on hold, Allergies are skipped when they read NKA, empty ("N/A")
  // values are skipped, and a small badge names what got queued.

  var ORDER = ['Age/Sex', 'Allergies', 'Psych meds', 'Diagnoses', 'BIMS', 'Relationships'];

  function isTyping() {
    var a = document.activeElement;
    if (!a) return false;
    var t = (a.tagName || '').toLowerCase();
    return t === 'input' || t === 'textarea' || t === 'select' || !!a.isContentEditable;
  }

  function fireClick(el) {
    // Core's tiles carry .pcc-fill-copy on the tm-tile HOST,
    // but the tile's click handler lives on its inner card
    // ([data-tm-card]) - a click dispatched on the host never
    // descends to it, so G reached the tiles (v1.0.2) yet
    // still queued nothing (his report, 2026-10-19; fixture
    // h133 on TREE-1154). Aim at the card when there is one.
    var t = el;
    if (el && el.querySelector) { var card = el.querySelector('[data-tm-card]'); if (card) t = card; }
    ['mousedown', 'mouseup', 'click'].forEach(function (type) {
      t.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    });
  }

  function showBadge(labels) {
    var old = document.getElementById('pccGrabBadge');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var b = document.createElement('div');
    b.id = 'pccGrabBadge';
    b.textContent = 'Queued: ' + labels.join(' · ');
    b.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147483647;pointer-events:none;' +
      'background:#1e3a5f;color:#fff;font:600 15px -apple-system,Helvetica,Arial,sans-serif;' +
      'padding:10px 16px;border-radius:10px;box-shadow:0 4px 18px rgba(0,0,0,.35);opacity:1;transition:opacity .4s;';
    document.body.appendChild(b);
    setTimeout(function () { b.style.opacity = '0'; }, 2000);
    setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 2450);
  }

  // A Copy target counts as shown when it has a box of
  // its own OR any visible descendant does. Core's tiles
  // are display:contents hosts (no box of their own), and
  // the old own-rects-only check skipped every tile on
  // the page - G queued nothing but the classic buttons
  // (his report, 2026-10-19: G sends diagnoses only).
  function isShown(el) {
    if (el.getClientRects().length) return true;
    var kids = el.querySelectorAll ? el.querySelectorAll('*') : [];
    for (var i = 0; i < kids.length; i++) if (kids[i].getClientRects().length) return true;
    return false;
  }

  function grabAll() {    var btns = document.querySelectorAll('.pcc-fill-copy');
    var queued = [];
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (!isShown(b)) continue;                       // not on screen
      var label = b.getAttribute('data-fill-label') || '';
      var value = b.getAttribute('data-fill-value');
      if (value === 'N/A') continue;                                  // nothing real to queue
      if (label === 'Allergies' && value && /^NKA\b/i.test(value)) continue;  // NKA stays unqueued
      fireClick(b);
      if (label && queued.indexOf(label) === -1) queued.push(label);
    }
    if (!queued.length) return;
    queued.sort(function (x, y) { return ORDER.indexOf(x) - ORDER.indexOf(y); });
    showBadge(queued);
  }

  // A small keyboard-key "G" badge sits next to every Copy button (his
  // request, 2026-10-13) — a reminder that G grabs it, and clicking the
  // badge is the same as pressing G.
  function addBadges() {
    var btns = document.querySelectorAll('.pcc-fill-copy');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (b.getAttribute('data-g-badge')) continue;
      if (!isShown(b)) continue;                 // not on screen yet
      if (b.getAttribute('data-fill-value') === 'N/A') continue;
      b.setAttribute('data-g-badge', '1');
      var g = document.createElement('span');
      g.className = 'pcc-g-badge';
      g.textContent = 'G';
      g.title = 'Press G to grab everything on this page';
      g.style.cssText = 'display:inline-block;vertical-align:middle;margin-left:6px;padding:1px 7px;' +
        'background:#fff;border:2px solid #1d4ed8;border-radius:6px;color:#1d4ed8;' +
        'font:bold 13px -apple-system,Helvetica,Arial,sans-serif;cursor:pointer;user-select:none;';
      g.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        requestGrab();
      });
      if (b.parentNode) b.parentNode.insertBefore(g, b.nextSibling);
    }
  }

  // PCC pages are several frames in one tab (header frame, content frame),
  // and a keypress reaches only the focused one. So a grab is broadcast:
  // the frame that got the key writes a signal, and every VISIBLE frame in
  // the tab clicks its own Copy buttons. (His live report, 2026-10-13: on
  // the Dashboard only the header frame heard G, so meds never queued.)
  var lastSignal = 0;
  function requestGrab() {
    var ts = Date.now();
    lastSignal = ts;
    grabAll();
    try { localStorage.setItem('pccGrabSignal', String(ts)); } catch (e) {}
  }
  window.addEventListener('storage', function (e) {
    if (e.key !== 'pccGrabSignal' || !e.newValue) return;
    var ts = parseInt(e.newValue, 10);
    if (!ts || ts <= lastSignal || Date.now() - ts > 5000) return;
    if (document.visibilityState === 'hidden') return;   // background tabs stay out
    lastSignal = ts;
    grabAll();
  });

  document.addEventListener('keydown', function (e) {
    if (!e.isTrusted || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key !== 'g' && e.key !== 'G') return;
    if (isTyping()) return;
    requestGrab();
  }, true);

  // Badges render on bounded staggered runs + after his clicks (no timers).
  [400, 1200, 2500, 4500, 7000, 10000].forEach(function (ms) { setTimeout(addBadges, ms); });
  var lastBadgeRun = 0;
  document.addEventListener('click', function (e) {
    if (!e.isTrusted) return;
    var now = Date.now();
    if (now - lastBadgeRun < 1000) return;
    lastBadgeRun = now;
    setTimeout(addBadges, 350);
  }, true);
})();
