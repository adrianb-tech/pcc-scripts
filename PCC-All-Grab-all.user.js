// ==UserScript==
// @name         Every facility — Grab all (G)
// @version      1.0
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
    ['mousedown', 'mouseup', 'click'].forEach(function (type) {
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
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

  function grabAll() {
    var btns = document.querySelectorAll('.pcc-fill-copy');
    var queued = [];
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (!b.getClientRects().length) continue;                       // not on screen
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

  document.addEventListener('keydown', function (e) {
    if (!e.isTrusted || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key !== 'g' && e.key !== 'G') return;
    if (isTyping()) return;
    grabAll();
  }, true);
})();
