// ==UserScript==
// @name         Every facility — Hide unused tabs
// @version      1.1
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
  // A "MORE" button at the end of the tab bar brings them back on demand
  // (click again — "LESS" — to hide them again). Tabs are matched by exact
  // label (the split-view tab-finder mechanism), never by position, so a
  // PCC layout change can't hide the wrong tab. Safety: a page counts as
  // having the tab bar only when at least 5 known tab labels are present.
  // Display-only; disabling the script restores everything.
  // Bounded staggered runs + click re-runs (no permanent timers).

  var HIDE = ['CENSUS', 'PROBLEMS', 'ALLERGIES', 'IMMUN', 'MDS', 'THERAPY', 'CARE PLAN', 'TASKS'];
  var ALL_TABS = ['DASH', 'PROFILE', 'CENSUS', 'MED DIAG', 'PROBLEMS', 'ALLERGIES', 'IMMUN',
    'ORDERS', 'WTS/VITALS', 'RESULTS', 'MDS', 'FORMS', 'THERAPY', 'PROG NOTES', 'CARE PLAN',
    'TASKS', 'MISC'];

  var tabsHidden = true;   // his default: hidden

  function norm(s) { return (s || '').replace(/\s+/g, ' ').trim().toUpperCase(); }

  // Returns { name -> element to show/hide } for the tabs on this page,
  // or null when this page doesn't carry the tab bar.
  function collectTabs() {
    var els = document.querySelectorAll('a,button,[role="tab"],td,li,span,div');
    var byName = {};
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.children.length > 2) continue;
      var t = norm(el.textContent);
      if (ALL_TABS.indexOf(t) !== -1 && !byName[t]) byName[t] = el;
    }
    if (Object.keys(byName).length < 5) return null;
    var out = {};
    Object.keys(byName).forEach(function (name) {
      var el = byName[name];
      var target = el;
      for (var up = 0; up < 6 && target; up++) {
        var tag = target.tagName;
        if (tag === 'A' || tag === 'BUTTON' || tag === 'TD' || tag === 'LI' ||
            target.onclick || target.getAttribute('onclick')) break;
        target = target.parentElement;
      }
      out[name] = (target && norm(target.textContent) === name) ? target : el;
    });
    return out;
  }

  function ensureButton(tabs) {
    var names = Object.keys(tabs);
    if (!names.length) return;
    var anchor = tabs[names[0]];
    var parent = anchor.parentElement;
    if (!parent) return;
    var btn = document.getElementById('pccMoreTabsBtn');
    if (btn) { btn.textContent = tabsHidden ? 'MORE ▸' : 'LESS ▾'; return; }
    var holder;
    if (anchor.tagName === 'TD') holder = document.createElement('td');
    else if (anchor.tagName === 'LI') holder = document.createElement('li');
    else holder = document.createElement('span');
    btn = document.createElement('button');
    btn.id = 'pccMoreTabsBtn';
    btn.type = 'button';
    btn.textContent = tabsHidden ? 'MORE ▸' : 'LESS ▾';
    btn.style.cssText = 'cursor:pointer;padding:4px 14px;border:1px solid #9aa582;border-radius:6px;' +
      'background:#eef1e4;color:#3f4a2a;font:bold 13px -apple-system,Helvetica,Arial,sans-serif;white-space:nowrap;';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      tabsHidden = !tabsHidden;
      run();
    });
    holder.appendChild(btn);
    parent.appendChild(holder);
  }

  function run() {
    var tabs = collectTabs();
    if (!tabs) return;
    HIDE.forEach(function (name) {
      var el = tabs[name];
      if (el) el.style.display = tabsHidden ? 'none' : '';
    });
    ensureButton(tabs);
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
