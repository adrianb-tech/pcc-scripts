// ==UserScript==
// @name         Every facility — Hide unused tabs
// @version      1.0
// @updateURL    https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Hide-unused-tabs.user.js
// @downloadURL  https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Hide-unused-tabs.user.js
// @match        https://*.pointclickcare.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // Hides the resident-chart tabs Adrian never uses (his list, 2026-10-13):
  // CENSUS, PROBLEMS, ALLERGIES, IMMUN, MDS, THERAPY, CARE PLAN, TASKS.
  // Tabs are matched by their exact label (the same mechanism the split-view
  // script uses to find tabs) — never by position, so a PCC layout change
  // can't hide the wrong tab. Safety: a page only gets treated as having the
  // tab bar when at least 5 known tab labels are present in it. Hiding is
  // display-only; turning this script off brings every tab back.
  // Bounded staggered runs + click re-runs (no permanent timers).

  var HIDE = ['CENSUS', 'PROBLEMS', 'ALLERGIES', 'IMMUN', 'MDS', 'THERAPY', 'CARE PLAN', 'TASKS'];
  var ALL_TABS = ['DASH', 'PROFILE', 'CENSUS', 'MED DIAG', 'PROBLEMS', 'ALLERGIES', 'IMMUN',
    'ORDERS', 'WTS/VITALS', 'RESULTS', 'MDS', 'FORMS', 'THERAPY', 'PROG NOTES', 'CARE PLAN',
    'TASKS', 'MISC'];

  function norm(s) { return (s || '').replace(/\s+/g, ' ').trim().toUpperCase(); }

  function run() {
    var els = document.querySelectorAll('a,button,[role="tab"],td,li,span,div');
    var byName = {};
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.children.length > 2) continue;
      var t = norm(el.textContent);
      if (ALL_TABS.indexOf(t) !== -1 && !byName[t]) byName[t] = el;
    }
    var present = Object.keys(byName).length;
    if (present < 5) return;   // not a page with the tab bar — leave it alone

    HIDE.forEach(function (name) {
      var el = byName[name];
      if (!el) return;
      var target = el;
      for (var up = 0; up < 6 && target; up++) {
        var tag = target.tagName;
        if (tag === 'A' || tag === 'BUTTON' || tag === 'TD' || tag === 'LI' ||
            target.onclick || target.getAttribute('onclick')) break;
        target = target.parentElement;
      }
      // Hide the wrapper only when it is exactly this one tab; otherwise
      // hide the matched element itself.
      var hideEl = (target && norm(target.textContent) === name) ? target : el;
      hideEl.style.display = 'none';
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
