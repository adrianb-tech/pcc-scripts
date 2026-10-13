// ==UserScript==
// @name         Every facility — Hide unused tabs
// @version      1.2
// @updateURL    https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Hide-unused-tabs.user.js
// @downloadURL  https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Hide-unused-tabs.user.js
// @match        https://*.pointclickcare.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // Hides the resident-chart tabs Adrian never uses (his list, 2026-10-13):
  // CENSUS, PROBLEMS, ALLERGIES, IMMUN, MDS, THERAPY, CARE PLAN, TASKS,
  // MED DIAG, MISC. A "MORE" button at the end of the tab bar brings them
  // back on demand (LESS hides them again).
  //
  // v1.2 fix: v1.1 matched the first element with each name ANYWHERE on the
  // page — "ALLERGIES" hit the header label instead of the tab, and MDS hit
  // a stray element, so those two tabs stayed and the button landed in the
  // wrong place. Now the tab bar is located first (the smallest container
  // holding >=5 known tab labels) and tabs are matched only inside it. The
  // run also un-hides any exact-label element OUTSIDE the bar that a
  // previous version hid by mistake.
  //
  // Bounded staggered runs + click re-runs (no permanent timers).

  var HIDE = ['CENSUS', 'PROBLEMS', 'ALLERGIES', 'IMMUN', 'MDS', 'THERAPY', 'CARE PLAN', 'TASKS',
    'MED DIAG', 'MISC'];
  var ALL_TABS = ['DASH', 'PROFILE', 'CENSUS', 'MED DIAG', 'PROBLEMS', 'ALLERGIES', 'IMMUN',
    'ORDERS', 'WTS/VITALS', 'RESULTS', 'MDS', 'FORMS', 'THERAPY', 'PROG NOTES', 'CARE PLAN',
    'TASKS', 'MISC'];

  var tabsHidden = true;   // his default: hidden

  function norm(s) { return (s || '').replace(/\s+/g, ' ').trim().toUpperCase(); }

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

  // The tab bar = the smallest container holding at least 5 distinct tab
  // labels (most labels wins; ties go to the smaller subtree).
  function findBar(cands) {
    var recs = [];
    var byNode = new Map();
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

  function tabElement(el, name) {
    var target = el;
    for (var up = 0; up < 6 && target; up++) {
      var tag = target.tagName;
      if (tag === 'A' || tag === 'BUTTON' || tag === 'TD' || tag === 'LI' ||
          target.onclick || target.getAttribute('onclick')) break;
      target = target.parentElement;
    }
    return (target && norm(target.textContent) === name) ? target : el;
  }

  function run() {
    var cands = candidates();
    if (!cands.length) return;
    var bar = findBar(cands);
    if (!bar) return;

    var tabs = {};    // name -> element to show/hide
    var order = [];   // names in document order
    cands.forEach(function (c) {
      if (!bar.contains(c.el) || tabs[c.name]) return;
      tabs[c.name] = tabElement(c.el, c.name);
      order.push(c.name);
    });
    if (order.length < 5) return;

    // Repair: un-hide any exact-label element outside the bar that an
    // earlier version hid by mistake (e.g. the header "Allergies" label).
    var styled = document.querySelectorAll('[style*="display: none"],[style*="display:none"]');
    for (var i = 0; i < styled.length; i++) {
      var s = styled[i];
      if (bar.contains(s)) continue;
      if (ALL_TABS.indexOf(norm(s.textContent)) !== -1 && s.children.length <= 2) s.style.display = '';
    }

    HIDE.forEach(function (name) {
      if (tabs[name]) tabs[name].style.display = tabsHidden ? 'none' : '';
    });

    // MORE / LESS button at the end of the bar.
    var btn = document.getElementById('pccMoreTabsBtn');
    if (btn) { btn.textContent = tabsHidden ? 'MORE ▸' : 'LESS ▾'; return; }
    var last = tabs[order[order.length - 1]];
    var parent = last && last.parentElement;
    if (!parent) return;
    var holder;
    if (last.tagName === 'TD') holder = document.createElement('td');
    else if (last.tagName === 'LI') holder = document.createElement('li');
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
