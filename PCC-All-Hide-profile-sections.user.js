// ==UserScript==
// @name         Every facility — Hide profile sections
// @version      1.0
// @updateURL    https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Hide-profile-sections.user.js
// @downloadURL  https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Hide-profile-sections.user.js
// @match        https://*.pointclickcare.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // Hides three Profile-page sections Adrian never uses (his request,
  // 2026-10-13): Medical Professionals, User Defined Fields, External
  // Facilities. Each section is found by its exact heading; the section
  // card is the smallest container that holds the heading and a table
  // without also holding another section's heading — so the contacts and
  // Admission Record sections are never touched. Display-only; disabling
  // the script brings the sections back.
  // Bounded staggered runs + click re-runs (no permanent timers).

  var TARGETS = ['Medical Professionals', 'User Defined Fields', 'External Facilities'];
  var GUARDS = ['Admission Record', 'Contacts', 'Emergency Contacts', 'Resident Profile',
    'Medical Professionals', 'User Defined Fields', 'External Facilities'];

  function norm(s) { return (s || '').replace(/\s+/g, ' ').trim().toLowerCase(); }

  function headingEls(text) {
    var want = norm(text);
    var els = document.querySelectorAll('div, span, h1, h2, h3, h4, td, th, b, strong');
    var out = [];
    for (var i = 0; i < els.length; i++) {
      if (els[i].children.length > 2) continue;
      if (norm(els[i].textContent) === want) out.push(els[i]);
    }
    return out;
  }

  function containsHeading(container, text) {
    var want = norm(text);
    var els = container.querySelectorAll('div, span, h1, h2, h3, h4, td, th, b, strong');
    for (var i = 0; i < els.length; i++) {
      if (els[i].children.length > 2) continue;
      if (norm(els[i].textContent) === want) return true;
    }
    return false;
  }

  function sectionCard(headingEl, ownText) {
    var node = headingEl;
    for (var up = 0; up < 8 && node; up++) {
      node = node.parentElement;
      if (!node) break;
      if (!node.querySelector('table')) continue;
      if (node.querySelectorAll('*').length > 1500) continue;
      var clean = true;
      for (var g = 0; g < GUARDS.length; g++) {
        if (GUARDS[g] === ownText) continue;
        if (containsHeading(node, GUARDS[g])) { clean = false; break; }
      }
      if (clean) return node;
    }
    return null;
  }

  function run() {
    TARGETS.forEach(function (text) {
      headingEls(text).forEach(function (h) {
        var card = sectionCard(h, text);
        if (card) card.style.display = 'none';
      });
    });
  }

  [400, 1000, 2000, 3500, 5500, 8000].forEach(function (ms) { setTimeout(run, ms); });
  var lastRun = 0;
  document.addEventListener('click', function (e) {
    if (!e.isTrusted) return;
    var now = Date.now();
    if (now - lastRun < 1000) return;
    lastRun = now;
    setTimeout(run, 300);
  }, true);
})();
