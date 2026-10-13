// ==UserScript==
// @name         CNR + Saints — Navigation keys (A + F + 1 + 2)
// @version 1.5
// @updateURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-CNRSaints-Keys.user.js
// @downloadURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-CNRSaints-Keys.user.js
// @match        https://*.pointclickcare.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function() {
  'use strict';

  // Facility guard: only run at Boro Park
  // Returns true if at Boro Park, false if at another known facility, null if unknown (still loading)
  // Facility guard: only run at CNR (Downtown Brooklyn) or Saints (Saints Joachim & Anne)
  function checkCNRSaintsFacility() {
    try {
      var docs = allDocs();
      var foundCNRSaints = false;
      var foundOther = false;
      for (var d = 0; d < docs.length; d++) {
        try {
          var ft = (docs[d].body ? docs[d].body.innerText : '').toLowerCase();
          if (ft.indexOf('downtown brooklyn') !== -1) foundCNRSaints = true;
          if (ft.indexOf('saints joachim') !== -1 || ft.indexOf('joachim & anne') !== -1 || ft.indexOf('joachim and anne') !== -1) foundCNRSaints = true;
          if (ft.indexOf('boro park') !== -1 || ft.indexOf('bpcnr') !== -1) foundOther = true;
          if (ft.indexOf('bedford') !== -1 || ft.indexOf('crown heights') !== -1) foundOther = true;
        } catch (e2) {}
      }
      if (foundCNRSaints) return true;
      if (foundOther) return false;
    } catch (e) {}
    return null; // unknown
  }
  function shouldRun() { return checkCNRSaintsFacility() !== false; }

  // ---- Facility detection (for future facility-specific behavior) ----
  function facilityName() {
    try {
      var t = (document.body ? document.body.innerText : '').toLowerCase();
      if (/boro\s*park/.test(t)) return 'boro-park';
      if (/crown\s*heights/.test(t)) return 'crown-heights';
      if (/bedford/.test(t)) return 'bedford';
      if (/saint/.test(t)) return 'saints';
      if (/cnr/.test(t)) return 'cnr';
    } catch (e) {}
    return 'unknown';
  }

  // ---- Helpers ----
  function visible(el) {
    try {
      if (!el || !el.getClientRects || !el.getClientRects().length) return false;
      var s = window.getComputedStyle(el);
      return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
    } catch (e) { return false; }
  }

  function isEditable(el) {
    try {
      if (!el) return false;
      var tag = (el.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
      if (el.isContentEditable) return true;
    } catch (e) {}
    return false;
  }

  function findResidentSearchBox() {
    try {
      var inputs = document.querySelectorAll('input[type="text"], input[type="search"], input:not([type])');
      var cands = [];
      for (var i = 0; i < inputs.length; i++) {
        var inp = inputs[i];
        if (!visible(inp) || inp.disabled || inp.readOnly) continue;
        var hay = ((inp.id || '') + ' ' + (inp.name || '') + ' ' +
                   (inp.placeholder || '') + ' ' + (inp.getAttribute('aria-label') || '') + ' ' +
                   (inp.title || '')).toLowerCase();
        var score = /resident/.test(hay) ? 3 : (/search/.test(hay) ? 2 : 0);
        if (score > 0) {
          var r = inp.getClientRects()[0];
          cands.push({ el: inp, score: score, top: r ? r.top : 9999 });
        }
      }
      cands.sort(function(a, b) { return (b.score - a.score) || (a.top - b.top); });
      return cands.length ? cands[0].el : null;
    } catch (e) { return null; }
  }

  function focusResidentSearch() {
    var box = findResidentSearchBox();
    if (box) {
      try {
        box.focus();
        box.select();
        return true;
      } catch (e) {}
    }
    return false;
  }

  // ---- Modern pill badge for W ----
  var BADGE_ID = 'pcc-a-badge';
  function placeABadge() {
    try {
      var box = findResidentSearchBox();
      var badge = document.getElementById(BADGE_ID);
      if (!box || !visible(box)) { if (badge) badge.style.display = 'none'; return; }
      if (!badge) {
        badge = document.createElement('div');
        badge.id = BADGE_ID;
        badge.textContent = 'A';
        badge.title = 'Shortcut: press A to jump here';
        (document.body || document.documentElement).appendChild(badge);
      }
      badge.setAttribute('style',
        'position:fixed;z-index:999999;' +
        'display:flex;align-items:center;justify-content:center;' +
        'width:28px;height:28px;' +
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;' +
        'font-size:14px;font-weight:700;color:#fff;' +
        'background:linear-gradient(135deg,#ef4444,#dc2626);' +
        'border:none;border-radius:999px;' +
        'box-shadow:0 2px 8px rgba(220,38,38,.35),0 1px 2px rgba(0,0,0,.1);' +
        'pointer-events:none;user-select:none;');
      var r = box.getClientRects()[0];
      if (r) {
        badge.style.display = 'flex';
        // Centered horizontally on the search bar, a little below vertical center
        badge.style.left = Math.max(0, r.left + (r.width / 2) - 14) + 'px';
        badge.style.top = Math.max(0, r.top + (r.height / 2) - 14 + 6) + 'px';
      }
    } catch (e) {}
  }

  // ---- F button on Save & Sign & Lock & Exit (Bedford / Crown Heights only) ----
  var FBTN_CLASS = 'pcc-f-btn';
  function isBedfordOrCH() { return false; } // CNR/Saints script
  function isBedfordOrCH_ORIG_DISABLED() {
    var f = facilityName();
    return f === 'bedford' || f === 'crown-heights';
  }
  function findSaveSignLockExit() {
    try {
      var els = document.querySelectorAll('input[type="button"], input[type="submit"], button');
      for (var i = 0; i < els.length; i++) {
        var label = ((els[i].value || '') + ' ' + (els[i].textContent || '')).replace(/\s+/g, ' ').trim();
        if (/^save\s*&\s*sign\s*&\s*lock\s*&\s*exit$/i.test(label) && visible(els[i])) return els[i];
      }
    } catch (e) {}
    return null;
  }

  // Resident Profile link (blue name at top of Progress Notes - View All page)
  function findResidentProfileLink() {
    try {
      var docs = allDocs();
      for (var d = 0; d < docs.length; d++) {
        var links = docs[d].querySelectorAll('a');
        for (var i = 0; i < links.length; i++) {
          var t = (links[i].textContent || '').toLowerCase().trim();
          if (t.indexOf('resident profile') !== -1 && visible(links[i])) return links[i];
        }
      }
    } catch (e) {}
    return null;
  }
  // PCC ignores synthetic .click() — use mousedown/mouseup/click sequence
  function fireClick(el) {
    try {
      var opts = { bubbles: true, cancelable: true, view: window };
      el.dispatchEvent(new MouseEvent('mousedown', opts));
      el.dispatchEvent(new MouseEvent('mouseup', opts));
      el.dispatchEvent(new MouseEvent('click', opts));
    } catch (e) {
      try { el.click(); } catch (e2) {}
    }
  }
  function makeFBadge(title, onClick, targetDoc) {
    // Create badge in the target's document (may be an iframe) — not the top document
    var doc = targetDoc || document;
    var btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = FBTN_CLASS;
    btn.textContent = 'F';
    btn.title = title;
    btn.setAttribute('style',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;' +
      'font-size:11px;font-weight:700;color:#fff;' +
      'background:linear-gradient(135deg,#ef4444,#dc2626);' +
      'border:none;border-radius:999px;width:20px;height:20px;' +
      'box-shadow:0 2px 8px rgba(220,38,38,.35);' +
      'margin-left:6px;cursor:pointer;vertical-align:middle;');
    btn.addEventListener('click', function(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      onClick();
    });
    return btn;
  }
  function applyFButton() {
    try {
      if (!shouldRun()) return;
      // CNR/Saints: ONE F badge on the form's save-exit button, priority:
      // Save & Sign & Lock & Exit -> Save & Sign & Exit -> Save & Exit
      var target = findSaveSignLockExit() || findSaveSignExit() || findSaveExit();
      if (!target || !target.parentNode) return;
      if (target.parentNode.querySelector('.' + FBTN_CLASS)) return;
      var doc = target.ownerDocument || document;
      var btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = FBTN_CLASS;
      btn.textContent = 'F';
      btn.title = 'Save & exit (same as F key)';
      btn.setAttribute('style',
        'font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",system-ui,sans-serif;' +
        'font-size:14px;font-weight:700;color:#fff;' +
        'background:linear-gradient(135deg,#ef4444,#dc2626);' +
        'border:none;border-radius:999px;width:28px;height:28px;' +
        'box-shadow:0 2px 8px rgba(220,38,38,.35);' +
        'margin-left:8px;cursor:pointer;vertical-align:middle;');
      btn.addEventListener('click', function(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        doFAction();
      });
      if (target.nextSibling) target.parentNode.insertBefore(btn, target.nextSibling);
      else target.parentNode.appendChild(btn);
    } catch (e) {}
  }
  function elText(el) {
    try {
      var t = (el.textContent || '').replace(/\s+/g, ' ').trim().toUpperCase();
      if (t) return t;
      if (el.value) return (el.value || '').replace(/\s+/g, ' ').trim().toUpperCase();
      var a = el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('alt'));
      return a ? (a || '').replace(/\s+/g, ' ').trim().toUpperCase() : '';
    } catch (e) { return ''; }
  }
  function elDepth(el, doc) {
    var d = 0, p = el;
    try {
      while (p && p !== doc.body && d < 60) { d++; p = p.parentNode; }
    } catch (e) {}
    return d;
  }
  function findByExactText(doc, text) {
    var out = [];
    try {
      var els = doc.querySelectorAll('a, button, input[type="button"], input[type="submit"], span, td, div, li');
      for (var i = 0; i < els.length; i++) {
        if (elText(els[i]) === text && visible(els[i])) out.push(els[i]);
      }
      out.sort(function(a, b) { return elDepth(b, doc) - elDepth(a, doc); });
    } catch (e) {}
    return out;
  }
  function findInFrames(win, fn) {
    var found = null;
    (function search(w) {
      if (found) return;
      try {
        found = fn(w.document) || null;
        for (var i = 0; i < w.frames.length && !found; i++) search(w.frames[i]);
      } catch (e) {}
    })(win);
    return found;
  }
  function findApply(doc) {
    try {
      var els = doc.querySelectorAll('input[type="button"], input[type="submit"], button');
      for (var i = 0; i < els.length; i++) {
        var t = ((els[i].value || '') + ' ' + (els[i].textContent || '')).replace(/\s+/g, ' ').trim().toUpperCase();
        if (t === 'APPLY' && visible(els[i])) return els[i];
      }
    } catch (e) {}
    return null;
  }
  function findFilterBar(doc) {
    try {
      var apply = findApply(doc);
      if (!apply) return null;
      var bar = apply.parentElement;
      while (bar && bar.querySelectorAll('select').length < 2 && bar.parentElement) bar = bar.parentElement;
      return (bar && bar.querySelectorAll('select').length >= 2) ? bar : null;
    } catch (e) { return null; }
  }
  function findTypeSelect(doc) {
    try {
      var bar = findFilterBar(doc);
      if (bar) {
        var sels = bar.querySelectorAll('select');
        for (var i = 0; i < sels.length; i++) {
          var node = sels[i].previousSibling, label = '';
          while (node && !label) {
            label = (node.textContent || '').replace(/\s+/g, ' ').trim().toUpperCase();
            node = node.previousSibling;
          }
          if (/^TYPE:?$/i.test(label)) return sels[i];
        }
        if (sels.length >= 2) return sels[sels.length - 1];
      }
      var all = doc.querySelectorAll('select');
      for (var j = 0; j < all.length; j++) {
        if (/consult form/i.test(all[j].textContent || '')) return all[j];
      }
    } catch (e) {}
    return null;
  }
  function pickTypeOption(sel, kind) {
    try {
      var opts = sel.options, i, t;
      if (kind === 'psych') {
        for (i = 0; i < opts.length; i++) { t = opts[i].text || ''; if (!/retired/i.test(t) && /^psych\s*:\s*consult/i.test(t)) return opts[i]; }
        for (i = 0; i < opts.length; i++) { t = opts[i].text || ''; if (!/retired/i.test(t) && /consult form/i.test(t) && /psych/i.test(t)) return opts[i]; }
        for (i = 0; i < opts.length; i++) { t = opts[i].text || ''; if (!/retired/i.test(t) && /psych/i.test(t)) return opts[i]; }
        return null;
      }
      if (kind === 'bims') {
        for (i = 0; i < opts.length; i++) { t = opts[i].text || ''; if (!/retired/i.test(t) && /bims/i.test(t)) return opts[i]; }
        for (i = 0; i < opts.length; i++) { t = opts[i].text || ''; if (!/retired/i.test(t) && /social service assessment/i.test(t)) return opts[i]; }
        return null;
      }
    } catch (e) {}
    return null;
  }
  function setTypeFilter(doc, kind) {
    try {
      var sel = findTypeSelect(doc);
      if (!sel) return false;
      var picked = pickTypeOption(sel, kind);
      if (!picked) return false;
      for (var j = 0; j < sel.options.length; j++) sel.options[j].selected = (sel.options[j] === picked);
      try { sel.dispatchEvent(new Event('change', { bubbles: true })); } catch (e2) {}
      var apply = findApply(doc);
      if (apply) { fireClick(apply); return true; }
    } catch (e) {}
    return false;
  }
  function applyNumberBadges() {
    try {
      if (!shouldRun()) return;
      var acted = findInFrames(window.top || window, function(doc) {
        var sel = findTypeSelect(doc);
        if (!sel || !sel.parentNode) return null;
        // Don't double-add
        if (sel.parentNode.querySelector('.pcc-num-badge-1')) return true;
        var mk = function(txt, title, kind) {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'pcc-num-badge-1';
          b.textContent = txt;
          b.title = title;
          b.setAttribute('style',
            'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;' +
            'font-size:11px;font-weight:700;color:#fff;' +
            'background:linear-gradient(135deg,#f59e0b,#d97706);' +
            'border:none;border-radius:999px;width:20px;height:20px;' +
            'box-shadow:0 2px 8px rgba(217,119,6,.35);' +
            'margin-left:4px;cursor:pointer;vertical-align:middle;');
          b.addEventListener('click', function(ev) {
            ev.preventDefault();
            ev.stopPropagation();
            findInFrames(window.top || window, function(d2) {
              return setTypeFilter(d2, kind) ? true : null;
            });
          });
          return b;
        };
        var b1 = mk('1', 'Filter to psych forms (same as 1 key)', 'psych');
        b1.classList.add('pcc-num-badge-1');
        var b2 = mk('2', 'Filter to BIMS forms (same as 2 key)', 'bims');
        b2.classList.add('pcc-num-badge-1');
        // Both share the marker class so we don't double-add; distinguish via data attr
        b1.setAttribute('data-kind', 'psych');
        b2.setAttribute('data-kind', 'bims');
        if (sel.nextSibling) {
          sel.parentNode.insertBefore(b2, sel.nextSibling);
          sel.parentNode.insertBefore(b1, b2);
        } else {
          sel.parentNode.appendChild(b1);
          sel.parentNode.appendChild(b2);
        }
        return true;
      });
      return !!acted;
    } catch (e) { return false; }
  }
  function handleNumberKey(k) {
    // Forms page only: 1 = psych filter, 2 = BIMS filter
    var acted = findInFrames(window.top || window, function(doc) {
      if (!findTypeSelect(doc)) return null;
      return setTypeFilter(doc, k === '1' ? 'psych' : 'bims') ? true : null;
    });
    return !!acted;
  }
  function findAdmissionRecord() {
    return findInFrames(window.top || window, function(doc) {
      var c = findByExactText(doc, 'ADMISSION RECORD');
      if (c.length) return c[0];
      var f = findByExactText(doc, 'FACE SHEET');
      return f[0] || null;
    });
  }
  function allDocs() {
    var docs = [];
    try {
      var top = window.top || window;
      (function collect(win) {
        try {
          if (win.document) docs.push(win.document);
          var frames = win.frames;
          for (var i = 0; i < frames.length; i++) {
            try { collect(frames[i]); } catch (e2) {}
          }
        } catch (e3) {}
      })(top);
    } catch (e4) {
      docs = [document];
    }
    // Dedupe
    var seen = [], out = [];
    for (var d = 0; d < docs.length; d++) {
      if (seen.indexOf(docs[d]) === -1) { seen.push(docs[d]); out.push(docs[d]); }
    }
    return out.length ? out : [document];
  }
  function findMostRecentCopyLink() {
    try {
      var docs = allDocs();
      var best = null, bestDate = null;
      for (var d = 0; d < docs.length; d++) {
      var rows = docs[d].querySelectorAll('table tr');
      for (var i = 0; i < rows.length; i++) {
        var txt = (rows[i].innerText || '');
        var low = txt.toLowerCase();
        if (low.indexOf('psych') === -1) continue;
        if (low.indexOf('consult') === -1 && low.indexOf('psychiatry') === -1) continue;
        // Parse Form Date (M/D/YYYY) from the row
        var m = txt.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (!m) continue;
        var dt = new Date(parseInt(m[3], 10), parseInt(m[1], 10) - 1, parseInt(m[2], 10));
        if (isNaN(dt.getTime())) continue;
        if (bestDate && dt <= bestDate) continue;
        // Find the copy link in this row
        var links = rows[i].querySelectorAll('a');
        for (var j = 0; j < links.length; j++) {
          var lt = (links[j].textContent || '').trim().toLowerCase();
          if (lt === 'copy' && visible(links[j])) {
            best = links[j];
            bestDate = dt;
            break;
          }
        }
      }
      }
      return best;
    } catch (e) {}
    return null;
  }
  // CNR/Saints: F goes on the MOST RECENT edit button of a psych consult row.
  // The In Progress form is usually created by someone else (e.g. ksirikumnnerd),
  // so there is NO creator restriction here. In Progress rows beat completed ones;
  // within a group, latest Form Date wins. No copy fallback (rows have no copy link).
  function findMostRecentEditLink() {
    try {
      var docs = allDocs();
      var best = null, bestKey = null;
      for (var d = 0; d < docs.length; d++) {
        var rows = docs[d].querySelectorAll('table tr');
        for (var i = 0; i < rows.length; i++) {
          var txt = (rows[i].innerText || '');
          var low = txt.toLowerCase();
          if (low.indexOf('psych') === -1) continue;
          if (low.indexOf('consult') === -1 && low.indexOf('psychiatry') === -1) continue;
          var editLink = null;
          var links = rows[i].querySelectorAll('a');
          for (var j = 0; j < links.length; j++) {
            var lt = (links[j].textContent || '').trim().toLowerCase();
            if (lt === 'edit' && visible(links[j])) { editLink = links[j]; break; }
          }
          if (!editLink) continue;
          var m = txt.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
          var dt = m ? new Date(parseInt(m[3], 10), parseInt(m[1], 10) - 1, parseInt(m[2], 10)) : new Date(0);
          if (isNaN(dt.getTime())) dt = new Date(0);
          var key = (low.indexOf('in progress') !== -1 ? 1e13 : 0) + dt.getTime();
          if (bestKey === null || key > bestKey) { best = editLink; bestKey = key; }
        }
      }
      return best;
    } catch (e) {}
    return null;
  }
  // CNR/Saints section list page: "Sign All" toolbar + section table with Signed By.
  // At CNR/Saints (only facility like this) F goes on VIEW here, not edit.
  function isSectionListPage() {
    try {
      var docs = allDocs();
      for (var d = 0; d < docs.length; d++) {
        try {
          var t = (docs[d].body ? docs[d].body.innerText : '').toLowerCase();
          // Section table headers are real text: "Signed By" + "Signed Date"
          if (t.indexOf('signed by') !== -1 && t.indexOf('signed date') !== -1) return true;
          // Fallback: a "Sign All" control (its label is an input value, not page text)
          if (t.indexOf('signed by') !== -1) {
            var els = docs[d].querySelectorAll('input[type="button"], input[type="submit"], button');
            for (var i = 0; i < els.length; i++) {
              var v = (((els[i].value || '') + ' ' + (els[i].textContent || '')).replace(/\s+/g, ' ').trim().toLowerCase());
              if (v === 'sign all') return true;
            }
          }
        } catch (e2) {}
      }
    } catch (e) {}
    return false;
  }
  // A forms grid (in-chart FORMS tab): "Form Date"/"Assessment Date" + "Created By"
  function isFormsGridPage() {
    try {
      var docs = allDocs();
      for (var d = 0; d < docs.length; d++) {
        try {
          var t = (docs[d].body ? docs[d].body.innerText : '').toLowerCase();
          if ((t.indexOf('assessment date') !== -1 || t.indexOf('form date') !== -1) && t.indexOf('created by') !== -1) return true;
        } catch (e2) {}
      }
    } catch (e) {}
    return false;
  }
  function findInProgressEditLink() {
    try {
      var docs = allDocs();
      for (var d = 0; d < docs.length; d++) {
      var rows = docs[d].querySelectorAll('table tr');
      for (var i = 0; i < rows.length; i++) {
        var txt = (rows[i].innerText || '').toLowerCase();
        // Row must be an In Progress psych consult form (any variant: "Psych: Consult",
        // "Consult Form - Psychiatry", "Consult-Psychiatry", etc.)
        if (txt.indexOf('in progress') === -1) continue;
        if (txt.indexOf('psych') === -1) continue;
        if (txt.indexOf('consult') === -1 && txt.indexOf('psychiatry') === -1) continue;
        // Only Adrian's own In Progress rows (created by abalestra) — skip other users'
        if (txt.indexOf('abalestra') === -1) continue;
        var links = rows[i].querySelectorAll('a');
        for (var j = 0; j < links.length; j++) {
          var lt = (links[j].textContent || '').trim().toLowerCase();
          if (lt === 'edit' && visible(links[j])) return links[j];
        }
      }
      }
    } catch (e) {}
    return null;
  }
  function findViewLink() {
    try {
      var docs = allDocs();
      for (var d = 0; d < docs.length; d++) {
      var links = docs[d].querySelectorAll('a');
      for (var j = 0; j < links.length; j++) {
        var lt = (links[j].textContent || '').trim().toLowerCase();
        if (lt === 'view' && visible(links[j])) {
          // Skip if inside a Progress Notes table (has Effective Date column)
          try {
            var tbl = links[j].closest('table');
            if (tbl) {
              var th = (tbl.innerText || '').toLowerCase();
              if (th.indexOf('effective date') !== -1) continue;
            }
          } catch (e2) {}
          return links[j];
        }
      }
      }
    } catch (e) {}
    return null;
  }
  // Progress Notes: VIEW ALL button (may be div/span styled as button, not a real <button>)
  function findViewAllButton() {
    try {
      var docs = allDocs();
      for (var d = 0; d < docs.length; d++) {
        // First try standard clickable elements (lenient match)
        var els = docs[d].querySelectorAll('a, button, input[type="button"], input[type="submit"]');
        for (var i = 0; i < els.length; i++) {
          var label = ((els[i].value || '') + ' ' + (els[i].textContent || '')).replace(/\s+/g, ' ').trim().toLowerCase();
          if (label.indexOf('view all') !== -1 && visible(els[i])) return els[i];
        }
        // Fallback: any element with "view all" text that looks clickable
        var all = docs[d].querySelectorAll('div, span');
        for (var k = 0; k < all.length; k++) {
          var t = (all[k].textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
          if (t === 'view all' && visible(all[k])) {
            // Must not be a container with lots of other text
            if ((all[k].innerHTML || '').length < 200) return all[k];
          }
        }
      }
    } catch (e) {}
    return null;
  }
  // Section list page (e.g. Boro Park Psych: Consult sections): F on the section edit link
  function findSectionEditLink() {
    try {
      var docs = allDocs();
      for (var d = 0; d < docs.length; d++) {
        var txt = (docs[d].body ? docs[d].body.innerText : '').toLowerCase();
        // Must be a section list page (has Section/Description headers, not the assessments/forms table)
        if (txt.indexOf('in progress') !== -1 && (txt.indexOf('assessment date') !== -1 || txt.indexOf('form date') !== -1)) continue;
        var links = docs[d].querySelectorAll('a');
        for (var j = 0; j < links.length; j++) {
          var lt = (links[j].textContent || '').trim().toLowerCase();
          if (lt === 'edit' && visible(links[j])) {
            // Check it's on a section row (near "Psych: Consult" or section headers)
            var row = links[j].closest('tr');
            if (row) {
              var rt = (row.innerText || '').toLowerCase();
              if (rt.indexOf('psych') !== -1) return links[j];
            }
          }
        }
      }
    } catch (e) {}
    return null;
  }
  function findNextSection() {
    try {
      var docs = allDocs();
      for (var d = 0; d < docs.length; d++) {
      var els = docs[d].querySelectorAll('input[type="button"], input[type="submit"], button');
      for (var i = 0; i < els.length; i++) {
        var label = ((els[i].value || '') + ' ' + (els[i].textContent || '')).replace(/\s+/g, ' ').trim().toLowerCase();
        if (label === 'next section' && visible(els[i])) return els[i];
      }
      }
    } catch (e) {}
    return null;
  }
  // Section status page (signed section): the Lock button at top (Back/Sign All/Lock/Print)
  function findLockButton() {
    try {
      var docs = allDocs();
      for (var d = 0; d < docs.length; d++) {
      var els = docs[d].querySelectorAll('input[type="button"], input[type="submit"], button');
      for (var i = 0; i < els.length; i++) {
        var label = ((els[i].value || '') + ' ' + (els[i].textContent || '')).replace(/\s+/g, ' ').trim().toLowerCase();
        if (label === 'lock' && visible(els[i])) return els[i];
      }
      }
    } catch (e) {}
    return null;
  }
  // Resident census/search list — no F badges here at all
  function isResidentListPage() {
    try {
      var docs = allDocs();
      for (var d = 0; d < docs.length; d++) {
        try {
          var t = (docs[d].body ? docs[d].body.innerText : '').toLowerCase();
          if (t.indexOf('search current residents') !== -1) return true;
          if (t.indexOf('all residents') !== -1 && t.indexOf('waiting list') !== -1) return true;
        } catch (e2) {}
      }
    } catch (e) {}
    return false;
  }
  // Progress Notes tab / View All — no F badges here (checks all iframes, PCC loads content in frames)
  // CNR/Saints facility-wide Forms List (Clinical > Forms): heading + Form Type grid
  function isFormsListPage() {
    try {
      var docs = allDocs();
      for (var d = 0; d < docs.length; d++) {
        try {
          var t = (docs[d].body ? docs[d].body.innerText : '').toLowerCase();
          if ((t.indexOf('forms list') !== -1 || t.indexOf('in progress list') !== -1) &&
              t.indexOf('form type') !== -1 && t.indexOf('created by') !== -1) return true;
        } catch (e2) {}
      }
    } catch (e) {}
    return false;
  }
  function isProgressNotesPage() {
    try {
      var docs = allDocs();
      for (var d = 0; d < docs.length; d++) {
        try {
          var t = (docs[d].body ? docs[d].body.innerText : '').toLowerCase();
          // VIEW ALL button is the key indicator — be lenient
          if (t.indexOf('view all') !== -1) {
            // Confirm it's the progress notes context (not just any "view all")
            if (t.indexOf('progress note') !== -1 || t.indexOf('effective date') !== -1) return true;
          }
          if (t.indexOf('add progress note') !== -1) return true;
          if (t.indexOf('progress notes - view all') !== -1) return true;
        } catch (e2) {}
      }
    } catch (e) {}
    return false;
  }
  // Detect signed section status page: a Psych section row with a signer in Signed By
  function isSignedSectionPage() {
    try {
      var docs = allDocs();
      for (var d = 0; d < docs.length; d++) {
        var rows = docs[d].querySelectorAll('table tr');
        for (var i = 0; i < rows.length; i++) {
          var txt = (rows[i].innerText || '').toLowerCase();
          // Must be a psych section row (not header)
          if (txt.indexOf('psych') === -1) continue;
          if (txt.indexOf('section') !== -1 && txt.indexOf('description') !== -1) continue; // header row
          // Signed = row contains a signer name
          if (txt.indexOf('balestra') !== -1 || txt.indexOf('adrian') !== -1) return true;
        }
      }
    } catch (e) {}
    return false;
  }
  function findSaveExit() {
    try {
      var docs = allDocs();
      for (var d = 0; d < docs.length; d++) {
      var els = docs[d].querySelectorAll('input[type="button"], input[type="submit"], button');
      for (var i = 0; i < els.length; i++) {
        var label = ((els[i].value || '') + ' ' + (els[i].textContent || '')).replace(/\s+/g, ' ').trim().toLowerCase();
        if (label === 'save & exit' && visible(els[i])) return els[i];
      }
      }
    } catch (e) {}
    return null;
  }
  // Boro Park form edit page: "Save & Sign & Exit" (no Lock)
  function findSaveSignExit() {
    try {
      var docs = allDocs();
      for (var d = 0; d < docs.length; d++) {
      var els = docs[d].querySelectorAll('input[type="button"], input[type="submit"], button');
      for (var i = 0; i < els.length; i++) {
        var label = ((els[i].value || '') + ' ' + (els[i].textContent || '')).replace(/\s+/g, ' ').trim().toLowerCase();
        if (label === 'save & sign & exit' && visible(els[i])) return els[i];
      }
      }
    } catch (e) {}
    return null;
  }
  function isBoroPark() { return false; } // CNR/Saints script
  function doFAction() {
    if (!shouldRun()) return false;
    // Profile tab: F opens Admission Record (Face Sheet at Boro Park) — all facilities
    var adm = findAdmissionRecord();
    if (adm) { fireClick(adm); return true; }
    // CNR/Saints section list: F clicks VIEW (signed Reason for Consultation) — only facility with this rule
    if (isSectionListPage()) {
      var svw = findViewLink();
      if (svw) { fireClick(svw); return true; }
    }
    // CNR/Saints FORMS tab / lists: F opens the most recent editable psych consult
    var edit = findMostRecentEditLink();
    if (edit) { fireClick(edit); return true; }
    // Signed section status page (Boro Park): F clicks Lock, not view — check before view
    if (isBoroPark() && isSignedSectionPage()) {
      var lk = findLockButton();
      if (lk) { fireClick(lk); return true; }
    }
    // Progress Notes: F clicks VIEW ALL (on tab) or Resident Profile link (on View All page)
    if (isProgressNotesPage()) {
      var va = findViewAllButton();
      if (va) { fireClick(va); return true; }
      // On the View All page (no VIEW ALL button), F goes to Resident Profile
      var rp = findResidentProfileLink();
      if (rp) { fireClick(rp); return true; }
    }
    // Form sections page: F clicks the view link — all facilities (not on resident list or progress notes)
    var vw = null;
    if (!isResidentListPage() && !isProgressNotesPage() && !isFormsListPage() && !isFormsGridPage()) vw = findViewLink();
    if (vw) { fireClick(vw); return true; }
    // Section list page (Boro Park): F clicks the section edit link
    var se2 = findSectionEditLink();
    if (se2) { fireClick(se2); return true; }
    // Form section detail: F clicks Next Section — all facilities
    var ns = findNextSection();
    if (ns) { fireClick(ns); return true; }
    // Form edit page (CNR/Saints): F clicks, in priority order:
    // Save & Sign & Lock & Exit -> Save & Sign & Exit -> Save & Exit
    var t = findSaveSignLockExit();
    if (t) { fireClick(t); return true; }
    var sse = findSaveSignExit();
    if (sse) { fireClick(sse); return true; }
    var se = findSaveExit();
    if (se) { fireClick(se); return true; }
    return false;
  }

  function applyFAdmissionBadge() {
    try {
      if (!shouldRun()) return;
      var adm = findAdmissionRecord();
      if (!adm || !adm.parentNode) return;
      // Highlight the Admission Record link itself to make it stand out
      try {
        adm.style.setProperty('background', 'linear-gradient(135deg,#fef9c3,#fde68a)', 'important');
        adm.style.setProperty('border', '2px solid #eab308', 'important');
        adm.style.setProperty('border-radius', '6px', 'important');
        adm.style.setProperty('padding', '4px 8px', 'important');
        adm.style.setProperty('box-shadow', '0 2px 8px rgba(234,179,8,.4)', 'important');
      } catch (e2) {}
      // Don't double-add the F badge
      if (adm.parentNode.querySelector('.' + FBTN_CLASS + '-adm')) return;
      var badge = makeFBadge('Open Admission Record (same as F key)', function() {
        var a = findAdmissionRecord();
        if (a) fireClick(a);
      }, adm.ownerDocument);
      badge.classList.add(FBTN_CLASS + '-adm');
      if (adm.nextSibling) adm.parentNode.insertBefore(badge, adm.nextSibling);
      else adm.parentNode.appendChild(badge);
    } catch (e) {}
  }
  function applyFEditBadge() {
    try {
      if (!shouldRun()) return;
      // CNR/Saints: F badge ONLY on the most recent edit button (not on section list — view rules there)
      if (isSectionListPage()) return;
      var target = findMostRecentEditLink();
      var label = 'Edit most recent form (same as F key)';
      var badgeCls = FBTN_CLASS + '-edit';
      if (!target || !target.parentNode) return;
      if (target.parentNode.querySelector('.' + badgeCls)) return;
      var badge = makeFBadge(label, function() { doFAction(); }, target.ownerDocument);
      badge.classList.add(badgeCls);
      if (target.nextSibling) target.parentNode.insertBefore(badge, target.nextSibling);
      else target.parentNode.appendChild(badge);
    } catch (e) {}
  }

  // Remove stale F view badges from all docs (including iframes)
  function removeStaleViewBadges() {
    try {
      var docs = allDocs();
      for (var d = 0; d < docs.length; d++) {
        try {
          var stale = docs[d].querySelectorAll('.' + FBTN_CLASS + '-view');
          for (var s = 0; s < stale.length; s++) { try { stale[s].remove(); } catch (e2) {} }
        } catch (e3) {}
      }
    } catch (e) {}
  }
  // Progress Notes: F badge on VIEW ALL button
  function applyFViewAllBadge() {
    try {
      if (!shouldRun()) return;
      if (!isProgressNotesPage()) return;
      var target = findViewAllButton();
      if (!target || !target.parentNode) return;
      var badgeCls = FBTN_CLASS + '-viewall';
      if (target.parentNode.querySelector('.' + badgeCls)) return;
      var badge = makeFBadge('View All (same as F key)', function() { doFAction(); }, target.ownerDocument);
      badge.classList.add(badgeCls);
      if (target.nextSibling) target.parentNode.insertBefore(badge, target.nextSibling);
      else target.parentNode.appendChild(badge);
    } catch (e) {}
  }
  function applyFResidentProfileBadge() {
    try {
      if (!shouldRun()) return;
      // Only on Progress Notes - View All page (has the resident profile breadcrumb)
      var target = findResidentProfileLink();
      if (!target || !target.parentNode) return;
      var badgeCls = FBTN_CLASS + '-resprofile';
      if (target.parentNode.querySelector('.' + badgeCls)) return;
      var badge = makeFBadge('Resident Profile (same as F key)', function() { doFAction(); }, target.ownerDocument);
      badge.classList.add(badgeCls);
      if (target.nextSibling) target.parentNode.insertBefore(badge, target.nextSibling);
      else target.parentNode.appendChild(badge);
    } catch (e) {}
  }
  function applyFViewBadge() {
    try {
      if (!shouldRun()) return;
      // Section list (CNR/Saints): view is the ONLY F — sweep stray edit badges
      if (isSectionListPage()) {
        try {
          var docs2 = allDocs();
          for (var dd = 0; dd < docs2.length; dd++) {
            var stray = docs2[dd].querySelectorAll('.' + FBTN_CLASS + '-edit, .' + FBTN_CLASS + '-sectedit, .' + FBTN_CLASS + '-copy');
            for (var ss = 0; ss < stray.length; ss++) { try { stray[ss].remove(); } catch (e5) {} }
          }
        } catch (e6) {}
      }
      // Resident list and Progress Notes: no F on view — remove any stale badges
      // (Progress Notes gets F on VIEW ALL instead, via applyFViewAllBadge)
      if (isResidentListPage() || isProgressNotesPage() || isFormsListPage()) {
        removeStaleViewBadges();
        return;
      }
      // Signed section page (Boro Park): F goes on Lock, not view — remove stale view badge
      if (isBoroPark() && isSignedSectionPage()) {
        removeStaleViewBadges();
        return;
      }
      // Assessments/Forms list: F goes on copy/edit, not view — skip here (also clean stale)
      if (isFormsGridPage()) {
        removeStaleViewBadges();
        return;
      }
      var target = findViewLink();
      if (!target || !target.parentNode) return;
      var badgeCls = FBTN_CLASS + '-view';
      if (target.parentNode.querySelector('.' + badgeCls)) return;
      var badge = makeFBadge('View section (same as F key)', function() { doFAction(); }, target.ownerDocument);
      badge.classList.add(badgeCls);
      if (target.nextSibling) target.parentNode.insertBefore(badge, target.nextSibling);
      else target.parentNode.appendChild(badge);
    } catch (e) {}
  }
  function applyFLockBadge() {
    try {
      if (!shouldRun()) return;
      // Only on signed section page at Boro Park
      if (!isBoroPark() || !isSignedSectionPage()) return;
      var target = findLockButton();
      if (!target || !target.parentNode) return;
      var badgeCls = FBTN_CLASS + '-lock';
      if (target.parentNode.querySelector('.' + badgeCls)) return;
      var badge = makeFBadge('Lock section (same as F key)', function() { doFAction(); }, target.ownerDocument);
      badge.classList.add(badgeCls);
      if (target.nextSibling) target.parentNode.insertBefore(badge, target.nextSibling);
      else target.parentNode.appendChild(badge);
    } catch (e) {}
  }
  function applyFSectionEditBadge() {
    try {
      if (!shouldRun()) return;
      if (isSectionListPage()) return; // CNR/Saints: view only on section list
      var target = findSectionEditLink();
      if (!target || !target.parentNode) return;
      var badgeCls = FBTN_CLASS + '-sectedit';
      if (target.parentNode.querySelector('.' + badgeCls)) return;
      var badge = makeFBadge('Edit section (same as F key)', function() { doFAction(); }, target.ownerDocument);
      badge.classList.add(badgeCls);
      if (target.nextSibling) target.parentNode.insertBefore(badge, target.nextSibling);
      else target.parentNode.appendChild(badge);
    } catch (e) {}
  }

  function applyFNextSectionBadge() {
    try {
      if (!shouldRun()) return;
      var target = findNextSection();
      if (!target || !target.parentNode) return;
      var badgeCls = FBTN_CLASS + '-nextsection';
      if (target.parentNode.querySelector('.' + badgeCls)) return;
      var badge = makeFBadge('Next Section (same as F key)', function() { doFAction(); }, target.ownerDocument);
      badge.classList.add(badgeCls);
      if (target.nextSibling) target.parentNode.insertBefore(badge, target.nextSibling);
      else target.parentNode.appendChild(badge);
    } catch (e) {}
  }

  function applyFSaveExitBadge() {
    try {
      // CNR/Saints: handled by applyFButton (single F, priority order) — skip
      return;
      // Boro Park: F goes on Save & Sign & Exit; elsewhere: Save & Exit
      var target = isBoroPark() ? findSaveSignExit() : findSaveExit();
      // At Boro Park, remove any stale F badge on Save & Exit
      if (isBoroPark()) {
        var stale = document.querySelectorAll('.' + FBTN_CLASS + '-saveexit');
        for (var s = 0; s < stale.length; s++) { try { stale[s].remove(); } catch (e2) {} }
      }
      if (!target || !target.parentNode) return;
      var badgeCls = FBTN_CLASS + '-saveexit';
      if (target.parentNode.querySelector('.' + badgeCls)) return;
      var label = isBoroPark() ? 'Save & Sign & Exit (same as F key)' : 'Save & Exit (same as F key)';
      var badge = makeFBadge(label, function() { doFAction(); }, target.ownerDocument);
      badge.classList.add(badgeCls);
      if (target.nextSibling) target.parentNode.insertBefore(badge, target.nextSibling);
      else target.parentNode.appendChild(badge);
    } catch (e) {}
  }

  // Place badge on load + retries (PCC renders search box late)
  placeABadge();
  setTimeout(placeABadge, 1500);
  setTimeout(placeABadge, 4000);
  // F button: place on load + retries (PCC re-renders the toolbar)
  applyFButton();
  setTimeout(applyFButton, 1500);
  setTimeout(applyFButton, 4000);
  applyFAdmissionBadge();
  setTimeout(applyFAdmissionBadge, 1500);
  setTimeout(applyFAdmissionBadge, 4000);
  applyFEditBadge();
  setTimeout(applyFEditBadge, 1500);
  setTimeout(applyFEditBadge, 4000);
  applyFViewBadge();
  setTimeout(applyFViewBadge, 1500);
  setTimeout(applyFViewBadge, 4000);
  applyFViewAllBadge();
  setTimeout(applyFViewAllBadge, 1500);
  setTimeout(applyFViewAllBadge, 4000);
  applyFResidentProfileBadge();
  setTimeout(applyFResidentProfileBadge, 1500);
  setTimeout(applyFResidentProfileBadge, 4000);
  // Re-apply VIEW ALL badge when Progress Notes tab is clicked (content loads dynamically)
  // Attach to all frames — the tab may be inside an iframe
  function attachTabClickListener() {
    try {
      var docs = allDocs();
      for (var d = 0; d < docs.length; d++) {
        (function(doc) {
          if (doc.__tabClickAttached) return;
          doc.__tabClickAttached = true;
          doc.addEventListener('click', function(e) {
            try {
              var el = e.target;
              for (var i = 0; i < 3 && el; i++) {
                var txt = (el.textContent || '').toLowerCase().trim();
                if (txt === 'progress notes' || txt.indexOf('progress notes') === 0) {
                  setTimeout(applyFViewAllBadge, 1000);
                  setTimeout(applyFViewAllBadge, 2500);
                  break;
                }
                el = el.parentNode;
              }
            } catch (err) {}
          });
        })(docs[d]);
      }
    } catch (e) {}
  }
  attachTabClickListener();
  setTimeout(attachTabClickListener, 2000); // re-attach in case iframes load late
  applyFLockBadge();
  setTimeout(applyFLockBadge, 1500);
  setTimeout(applyFLockBadge, 4000);
  applyFSectionEditBadge();
  setTimeout(applyFSectionEditBadge, 1500);
  setTimeout(applyFSectionEditBadge, 4000);
  applyFNextSectionBadge();
  setTimeout(applyFNextSectionBadge, 1500);
  setTimeout(applyFNextSectionBadge, 4000);
  applyFSaveExitBadge();
  setTimeout(applyFSaveExitBadge, 1500);
  setTimeout(applyFSaveExitBadge, 4000);
  applyNumberBadges();
  setTimeout(applyNumberBadges, 1500);
  setTimeout(applyNumberBadges, 4000);
  // Reposition on scroll/resize (cheap, no DOM scan beyond the badge itself)
  try {
    window.addEventListener('scroll', placeABadge, true);
    window.addEventListener('resize', placeABadge);
  } catch (e) {}

  // ---- Keyboard shortcuts ----
  var enabled = true;
  if (shouldRun()) document.addEventListener('keydown', function(e) {
    // Ignore synthetic events (Snippety, etc.) — only real keypresses
    if (!e.isTrusted) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.repeat) return;
    if (isEditable(e.target)) return;  // never hijack typing
    var k = (e.key || '').toUpperCase();
    if (k.length !== 1) return;
    if (k === '0') {
      enabled = !enabled;
      return;
    }
    if (!enabled) return;
    if (k === 'A') {
      if (focusResidentSearch()) e.preventDefault();
      return;
    }
    if (k === 'F') {
      if (doFAction()) e.preventDefault();
      return;
    }
    if (k === '1' || k === '2') {
      if (handleNumberKey(k)) e.preventDefault();
      return;
    }
  }, true);
})();
