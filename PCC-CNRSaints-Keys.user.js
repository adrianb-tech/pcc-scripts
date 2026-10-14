// ==UserScript==
// @name         CNR + Saints — Navigation keys (A + F + 1 + 2)
// @version      1.25
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

  // A <tr> that CONTAINS other rows is a layout wrapper, not a form
  // row — PCC nests the list table inside one. Judging a wrapper by
  // its text borrows every row's identity at once (CH list, 2026-10-14:
  // the wrapper "was" the psych row, so F landed on the Skilled Care
  // Summary's copy link). Only leaf rows may be judged.
  function leafRow(row) { return !row.querySelector('tr'); }

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
  // All visible buttons in the winning save-exit tier (the CNR/Saints form
  // repeats its toolbar top and bottom — his rule, 2026-10-14: F badges on
  // BOTH Save & Exit buttons so he can click F from the top or the bottom).
  function findAllSaveExitChain() {
    var tiers = [
      /^save\s*&\s*sign\s*&\s*lock\s*&\s*exit$/i,
      /^save\s*&\s*sign\s*&\s*exit$/i,
      /^save\s*&\s*exit$/i
    ];
    try {
      var els = document.querySelectorAll('input[type="button"], input[type="submit"], button');
      for (var ti = 0; ti < tiers.length; ti++) {
        var out = [];
        for (var i = 0; i < els.length; i++) {
          var label = ((els[i].value || '') + ' ' + (els[i].textContent || '')).replace(/\s+/g, ' ').trim();
          if (tiers[ti].test(label) && visible(els[i])) out.push(els[i]);
        }
        if (out.length) return out;
      }
    } catch (e) {}
    return [];
  }
  function applyFButton() {
    try {
      // ALL FORM-PAGE F BADGES OFF (his bisect step 2, 2026-10-14):
      // top-only (v1.23) didn't cure the form's misread, so no F badge
      // is planted next to the Save & Exit buttons at all. The F KEY is
      // unchanged — it resolves its target at press time; the badges
      // were only signs. Restore planting only on his verdict.
      return;
      if (!shouldRun()) return;
      var targets = findAllSaveExitChain();
      for (var ti = 0; ti < targets.length; ti++) {
        // BOTTOM F BADGE OFF (his bisect, 2026-10-14): he suspects the
        // bottom badge is what makes the form misread — the form page
        // gets ONE F badge, on the TOP Save & Exit only. Leave the
        // bottom one off until his verdict says otherwise.
        if (ti > 0) continue;
        var target = targets[ti];
        if (!target || !target.parentNode) continue;
        var nxt = target.nextSibling;
        if (nxt && nxt.classList && nxt.classList.contains(FBTN_CLASS)) continue;
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
      }
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
  // Per-document page tests (v1.10). The window-wide tests scan every frame
  // from window.top; badge vetoes must be judged on the page that OWNS the
  // target, or a sibling frame's content vetoes this page's badge.
  function docText(doc) { try { return (doc.body ? doc.body.innerText : '').toLowerCase(); } catch (e) { return ''; } }
  function isResidentListDoc(doc) { var t = docText(doc); return t.indexOf('search current residents') !== -1 || (t.indexOf('all residents') !== -1 && t.indexOf('waiting list') !== -1); }
  function isProgressNotesDoc(doc) { var t = docText(doc); if (t.indexOf('view all') !== -1 && (t.indexOf('progress note') !== -1 || t.indexOf('effective date') !== -1)) return true; return t.indexOf('add progress note') !== -1 || t.indexOf('progress notes - view all') !== -1; }
  function isFormsListDoc(doc) { var t = docText(doc); return (t.indexOf('forms list') !== -1 || t.indexOf('in progress list') !== -1) && t.indexOf('form type') !== -1 && t.indexOf('created by') !== -1; }
  function isFormsGridDoc(doc) { var t = docText(doc); return (t.indexOf('assessment date') !== -1 || t.indexOf('form date') !== -1) && t.indexOf('created by') !== -1; }
  function isSectionListDoc(doc) {
    var t = docText(doc);
    if (t.indexOf('signed by') !== -1 && t.indexOf('signed date') !== -1) return true;
    if (t.indexOf('signed by') !== -1) {
      var els = doc.querySelectorAll('input[type="button"], input[type="submit"], button');
      for (var i = 0; i < els.length; i++) {
        var v = (((els[i].value || '') + ' ' + (els[i].textContent || '')).replace(/\s+/g, ' ').trim().toLowerCase());
        if (v === 'sign all') return true;
      }
    }
    return false;
  }
  function findAdmissionRecordInDoc(doc) {
    var c = findByExactText(doc, 'ADMISSION RECORD');
    if (c.length) return c[0];
    var f2 = findByExactText(doc, 'FACE SHEET');
    return f2[0] || null;
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
        if (!leafRow(rows[i])) continue;
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
          if (!leafRow(rows[i])) continue;
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
        if (!leafRow(rows[i])) continue;
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
              if (th.indexOf('external facilities') !== -1) continue;
            }
          } catch (e2) {}
          return links[j];
        }
      }
      }
    } catch (e) {}
    return null;
  }
  // CNR/Saints section list: the "sign" link exists ONLY on the row awaiting
  // his signature (yellow row: edit + sign). Prefer the psych row's sign link.
  function findSectionSignLinkInDoc(doc) {
    var fallback = null;
    try {
      var links = doc.querySelectorAll('a');
      for (var j = 0; j < links.length; j++) {
        var lt = (links[j].textContent || '').trim().toLowerCase();
        if (lt !== 'sign' || !visible(links[j])) continue;
        try {
          var tbl = links[j].closest('table');
          if (tbl && (tbl.innerText || '').toLowerCase().indexOf('effective date') !== -1) continue;
        } catch (e2) {}
        var row = links[j].closest('tr');
        var rt = row ? (row.innerText || '').toLowerCase() : '';
        if (rt.indexOf('psych') !== -1) return links[j];
        if (!fallback) fallback = links[j];
      }
    } catch (e) {}
    return fallback;
  }
  function findSectionSignLink() {
    try {
      var docs = allDocs();
      for (var d = 0; d < docs.length; d++) {
        var hit = findSectionSignLinkInDoc(docs[d]);
        if (hit) return hit;
      }
    } catch (e) {}
    return null;
  }
  // CNR/Saints section list, both-green state (his rule, 2026-10-14): the
  // psych section row is signed (signer + date on the row) and at least one
  // other section row is signed too -> the form is done; no F anything here.
  function sectionListAllSignedInDoc(doc) {
    try {
      // v1.13: judge ONLY the section table's own rows, and only by the
      // Signed Date COLUMN. The old version scanned every <tr> on the
      // page; PCC wraps content in outer layout tables whose row text
      // contains everything at once (a date, the view link, the word
      // Psychiatry), fabricating a signed psych row plus a second signed
      // row — the page read as all-signed and every F badge was stripped.
      // Caught by the v1.12 F-check chip on his live page:
      // allSigned:YES with the psych section unsigned.
      var tables = doc.querySelectorAll('table');
      for (var ti = 0; ti < tables.length; ti++) {
        var tbl = tables[ti];
        var trs = tbl.querySelectorAll('tr');
        var rows = [];
        for (var ri = 0; ri < trs.length; ri++) {
          if (trs[ri].closest('table') === tbl) rows.push(trs[ri]);
        }
        var hdrIdx = -1, dateCol = -1;
        for (var h = 0; h < rows.length; h++) {
          var cells = rows[h].cells || [];
          var hasBy = false, dc = -1;
          for (var c = 0; c < cells.length; c++) {
            var ct = (cells[c].textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
            if (ct.indexOf('signed by') !== -1) hasBy = true;
            if (ct.indexOf('signed date') !== -1) dc = c;
          }
          if (hasBy && dc !== -1) { hdrIdx = h; dateCol = dc; break; }
        }
        if (hdrIdx === -1) continue;
        var signedRows = 0, psychSigned = false;
        for (var r = hdrIdx + 1; r < rows.length; r++) {
          var rc = rows[r].cells || [];
          if (dateCol >= rc.length) continue;
          var dv = (rc[dateCol].textContent || '').trim();
          if (!/\d{1,2}\/\d{1,2}\/\d{4}/.test(dv)) continue;
          signedRows++;
          if (/psych/i.test(rows[r].textContent || '')) psychSigned = true;
        }
        if (psychSigned && signedRows >= 2) return true;
      }
    } catch (e) {}
    return false;
  }
  function sectionListAllSigned() {
    try {
      var docs = allDocs();
      for (var d = 0; d < docs.length; d++) if (sectionListAllSignedInDoc(docs[d])) return true;
    } catch (e) {}
    return false;
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
          if (!leafRow(rows[i])) continue;
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

  // Commit-before-save (his evidence, 2026-10-14): clicking Save & Exit
  // with the mouse registers the note correctly; the scripted F did
  // not. A real click first blurs the field in focus — that blur is
  // what makes PCC commit the field (the date widget parses on blur,
  // fields commit on blur). A synthetic click never moves focus, so
  // the commit never ran and the section saved as incomplete. Scripted
  // F now does exactly what his mouse does: blur, a beat for the
  // handlers, then click.
  function commitBlur(){
    try {
      var docs = allDocs(), targets = [];
      for (var i = 0; i < docs.length; i++) {
        var ae = docs[i].activeElement;
        if (!ae) continue;
        var tag = ae.tagName || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || ae.isContentEditable) targets.push(ae);
      }
      for (var j = 0; j < targets.length; j++) { try { targets[j].blur(); } catch (e) {} }
    } catch (e) {}
  }
  // Date of Consult — ORDER (his directions, 2026-10-14): the date
  // goes in FIRST, instantly; the F buttons are installed a moment
  // later (the init order at the bottom of this file). The earlier
  // orders — F first, then the date, by clock (v1.19/v1.20) or
  // chained to the F badge (v1.21) — did not work on his screen.
  // The fill is typed character
  // by character (the input class PCC's widget is built for) WITHOUT
  // taking focus — focus is never stolen on a form he is editing —
  // and only into an EMPTY field; a date he set himself always wins.
  // Backstops at F-press: if the field is still empty, the same typed
  // fill runs there with focus (his keypress, his moment), and either
  // way the field gets a real focus/blur cycle so the widget parses
  // what it holds before the save click lands.
  function todayStrK(){ var d = new Date(); return ('0' + (d.getMonth() + 1)).slice(-2) + '/' + ('0' + d.getDate()).slice(-2) + '/' + d.getFullYear(); }
  function keyEvK(doc, type, ch){
    var w = doc.defaultView || window;
    var e = new w.KeyboardEvent(type, { key: ch, bubbles: true, cancelable: true });
    try {
      var code = ch.charCodeAt(0);
      Object.defineProperty(e, 'keyCode', { get: function(){ return code; } });
      Object.defineProperty(e, 'which', { get: function(){ return code; } });
    } catch (err) {}
    return e;
  }
  function typeDateInto(doc, input, v){
    input.value = '';
    try { input.dispatchEvent(new Event('input', { bubbles: true })); } catch (e1) {}
    for (var i = 0; i < v.length; i++) {
      var ch = v.charAt(i);
      try { input.dispatchEvent(keyEvK(doc, 'keydown', ch)); } catch (e2) {}
      input.value = v.slice(0, i + 1);   // the character lands
      try { input.dispatchEvent(keyEvK(doc, 'keypress', ch)); } catch (e3) {}
      try { input.dispatchEvent(new Event('input', { bubbles: true })); } catch (e4) {}
      try { input.dispatchEvent(keyEvK(doc, 'keyup', ch)); } catch (e5) {}
    }
    try { input.dispatchEvent(new Event('change', { bubbles: true })); } catch (e6) {}
    // The widget's real (hidden) field, if the form carries one: same value.
    var els = doc.querySelectorAll('input');
    for (var j = 0; j < els.length; j++) {
      var nm = ((els[j].getAttribute && els[j].getAttribute('name')) || '') + ' ' + (els[j].id || '');
      if (els[j] !== input && nm.indexOf('Cust_2_II_9') !== -1 && nm.indexOf('_dummy') === -1) {
        try { els[j].value = v; els[j].dispatchEvent(new Event('change', { bubbles: true })); } catch (e7) {}
      }
    }
  }
  function findDateInput(){
    var docs = allDocs();
    for (var d = 0; d < docs.length; d++) {
      var input = docs[d].querySelector('[name="displaydateCust_2_II_9_dummy"]');
      if (input && visible(input)) return { doc: docs[d], input: input };
    }
    return null;
  }
  // The staggered fill: a moment after the F badges, no focus taken.
  function fillConsultDateSoft(){
    try {
      var hit = findDateInput();
      if (!hit) return;
      if ((hit.input.value || '').trim()) return;   // any content is his — leave it
      typeDateInto(hit.doc, hit.input, todayStrK());
      try { hit.input.dispatchEvent(new Event('focusout', { bubbles: true })); } catch (e) {}
      try { hit.input.dispatchEvent(new Event('blur', { bubbles: true })); } catch (e) {}
    } catch (e) {}
  }
  // The F-press backstop: same typed fill, with focus, if still empty.
  function fillConsultDateNow(){
    try {
      var hit = findDateInput();
      if (!hit) return false;
      if ((hit.input.value || '').trim()) return false;   // already filled (or his own date) — leave it
      try { hit.input.focus(); } catch (e0) {}
      typeDateInto(hit.doc, hit.input, todayStrK());
      return true;
    } catch (e) {}
    return false;
  }
  // Give the date field a real focus cycle so the widget parses what
  // it holds; commitBlur (called right after) supplies the blur.
  function touchDateField(){
    try {
      var hit = findDateInput();
      if (!hit) return false;
      hit.input.focus();
      return true;
    } catch (e) {}
    return false;
  }
  function fireSaveClick(btn){
    try {
      var nowS = Date.now();
      if (window.__pccSaveAt && nowS - window.__pccSaveAt < 1000) return true;
      window.__pccSaveAt = nowS;
    } catch (e) {}
    var filledDate = fillConsultDateNow();
    var touchedDate = filledDate ? true : touchDateField();
    commitBlur();
    setTimeout(function(){ fireClick(btn); }, (filledDate || touchedDate) ? 300 : 120);
    return true;
  }
  function doFAction() {
    if (!shouldRun()) return false;
    // One press, ONE action (his discovery + rule, 2026-10-14): F was
    // firing twice on the section list — sign AND a second target in the
    // same press — and the two navigations raced his signing onto PCC's
    // error page. The script runs once per frame, so the first F action
    // stamps the top window and every other hearer stands down briefly.
    try {
      var tw = window.top || window;
      var nowF = Date.now();
      if (tw.__pccFAt && nowF - tw.__pccFAt < 1200) return true;
      tw.__pccFAt = nowF;
    } catch (e) {}
    // Profile tab: F opens Admission Record (Face Sheet at Boro Park) — all facilities
    var adm = findAdmissionRecord();
    if (adm) { fireClick(adm); return true; }
    // CNR/Saints section list (v1.7, his three-state rule, 2026-10-14):
    // a sign link is waiting -> F clicks SIGN; both psych lines signed/green
    // -> F deliberately does nothing on this page; otherwise -> VIEW (as before)
    if (isSectionListPage()) {
      var sgn = findSectionSignLink();
      if (sgn) { fireClick(sgn); return true; }
      if (sectionListAllSigned()) return true;
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
    var svChain = findSaveSignLockExit() || findSaveSignExit() || findSaveExit();
    if (svChain) return fireSaveClick(svChain);
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

  // Remove F view badges from ONE document (v1.11 — the window-wide
  // version let a veto in one frame strip a good badge in another).
  function removeViewBadgesInDoc(doc) {
    try {
      var stale = doc.querySelectorAll('.' + FBTN_CLASS + '-view');
      for (var s = 0; s < stale.length; s++) { try { stale[s].remove(); } catch (e2) {} }
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
      var target = findViewLink();
      if (!target || !target.parentNode) return;
      var tdoc = target.ownerDocument || document;
      // v1.11: section lists are owned end-to-end by
      // applyFSectionListBadge, which judges the page inside its own
      // document. This generic pass never places or vetoes anything there.
      if (isSectionListDoc(tdoc)) return;
      // v1.11: vetoes are judged on the TARGET'S OWN document and strip
      // badges ONLY in that document. v1.10 judged per-document but still
      // called the window-wide remover, so a veto verdict in any sibling
      // frame erased the section list's view badge too — his "F is still
      // not on that one page" report, 2026-10-14.
      if (isResidentListDoc(tdoc) || isProgressNotesDoc(tdoc) || isFormsListDoc(tdoc) || isFormsGridDoc(tdoc)) {
        removeViewBadgesInDoc(tdoc);
        return;
      }
      if (isBoroPark() && isSignedSectionPage()) {
        removeViewBadgesInDoc(tdoc);
        return;
      }
      // Profile page: the ONLY F there is the Admission Record (his rule,
      // 2026-10-13) — judged on this page itself, not any other frame.
      if (findAdmissionRecordInDoc(tdoc)) {
        removeViewBadgesInDoc(tdoc);
        return;
      }
      var badgeCls = FBTN_CLASS + '-view';
      if (target.parentNode.querySelector('.' + badgeCls)) return;
      var badge = makeFBadge('View section (same as F key)', function() { doFAction(); }, target.ownerDocument);
      badge.classList.add(badgeCls);
      if (target.nextSibling) target.parentNode.insertBefore(badge, target.nextSibling);
      else target.parentNode.appendChild(badge);
    } catch (e) {}
  }
  // CNR/Saints section list — ONE pass owns this page type end to end
  // (v1.11). The state is judged entirely inside the section list's own
  // document, and every placement/removal is scoped to that document:
  //   sign link waiting  -> badge on SIGN, no view badge
  //   both lines signed  -> no F badge of any kind
  //   otherwise          -> badge on VIEW
  // Before v1.11 three separate passes shared the page, and the generic
  // view pass could still veto/strip this page's badge from another
  // frame's verdict via the window-wide removers.
  function findViewLinkInDoc(doc) {
    try {
      var links = doc.querySelectorAll('a');
      for (var j = 0; j < links.length; j++) {
        var lt = (links[j].textContent || '').trim().toLowerCase();
        if (lt === 'view' && visible(links[j])) {
          try {
            var tbl = links[j].closest('table');
            if (tbl) {
              var th = (tbl.innerText || '').toLowerCase();
              if (th.indexOf('effective date') !== -1) continue;
              if (th.indexOf('external facilities') !== -1) continue;
            }
          } catch (e2) {}
          return links[j];
        }
      }
    } catch (e) {}
    return null;
  }
  function applyFSectionListBadge() {
    try {
      if (!shouldRun()) return;
      var docs = allDocs();
      for (var d = 0; d < docs.length; d++) {
        var doc = docs[d];
        try {
          if (!isSectionListDoc(doc)) continue;
          var stray = doc.querySelectorAll('.' + FBTN_CLASS + '-edit, .' + FBTN_CLASS + '-sectedit, .' + FBTN_CLASS + '-copy');
          for (var ss = 0; ss < stray.length; ss++) { try { stray[ss].remove(); } catch (e5) {} }
          var signTarget = findSectionSignLinkInDoc(doc);
          if (signTarget && signTarget.parentNode) {
            removeViewBadgesInDoc(doc);
            var signCls = FBTN_CLASS + '-sign';
            if (!signTarget.parentNode.querySelector('.' + signCls)) {
              var sb = makeFBadge('Sign section (same as F key)', function() { doFAction(); }, doc);
              sb.classList.add(signCls);
              if (signTarget.nextSibling) signTarget.parentNode.insertBefore(sb, signTarget.nextSibling);
              else signTarget.parentNode.appendChild(sb);
            }
            continue;
          }
          var staleSign = doc.querySelectorAll('.' + FBTN_CLASS + '-sign');
          for (var s2 = 0; s2 < staleSign.length; s2++) { try { staleSign[s2].remove(); } catch (e7) {} }
          if (sectionListAllSignedInDoc(doc)) {
            var all = doc.querySelectorAll('.' + FBTN_CLASS);
            for (var s = 0; s < all.length; s++) { try { all[s].remove(); } catch (e2) {} }
            continue;
          }
          var viewTarget = findViewLinkInDoc(doc);
          if (!viewTarget || !viewTarget.parentNode) continue;
          var viewCls = FBTN_CLASS + '-view';
          if (viewTarget.parentNode.querySelector('.' + viewCls)) continue;
          var vb = makeFBadge('View section (same as F key)', function() { doFAction(); }, doc);
          vb.classList.add(viewCls);
          if (viewTarget.nextSibling) viewTarget.parentNode.insertBefore(vb, viewTarget.nextSibling);
          else viewTarget.parentNode.appendChild(vb);
        } catch (e3) {}
      }
    } catch (e) {}
  }
  // Kept names: the startup schedule and click re-runs call these two.
  // "Make sure there aren't two F buttons on the page" (his words,
  // 2026-10-14). All F badges/buttons share one class, so this sweep can
  // enforce it per document: on a section list the section badge is the
  // only F allowed; anywhere else, a second badge with the same title in
  // the same parent is a double-plant and goes. (Form pages keep their
  // top + bottom save-exit F buttons — different parents, by design.)
  function sweepFDoc(doc) {
    try {
      var bs = doc.querySelectorAll('.' + FBTN_CLASS);
      if (bs.length <= 1) return;
      var i, keep = null;
      for (i = 0; i < bs.length; i++) {
        if (/^(Sign|View) section/.test(bs[i].title || '')) { keep = bs[i]; break; }
      }
      if (keep) {
        for (i = 0; i < bs.length; i++) if (bs[i] !== keep) { try { bs[i].remove(); } catch (e) {} }
        return;
      }
      // A duplicate is a second badge next to the SAME anchor element
      // (the double-plant race). v1.15 keyed on the parent's tag+class —
      // PCC gives the top and bottom toolbars IDENTICAL markup, so the
      // sweep ate the bottom Save & Exit F and the badge flickered /
      // stayed gone (his report, 2026-10-14). Key on the anchor node
      // itself: top and bottom buttons are different elements, so both
      // keep their F.
      var seenFP = [];
      for (i = 0; i < bs.length; i++) {
        var anchor = bs[i].previousElementSibling || bs[i].parentNode;
        var dup = false;
        for (var s2 = 0; s2 < seenFP.length; s2++) {
          if (seenFP[s2].anchor === anchor && seenFP[s2].title === (bs[i].title || '')) { dup = true; break; }
        }
        if (dup) { try { bs[i].remove(); } catch (e2) {} }
        else seenFP.push({ anchor: anchor, title: bs[i].title || '' });
      }
    } catch (e) {}
  }
  function sweepFAll() {
    try {
      var docs = allDocs();
      for (var d = 0; d < docs.length; d++) sweepFDoc(docs[d]);
    } catch (e) {}
  }

  function applyFSectionSignBadge() { applyFSectionListBadge(); }
  function applyFSectionListCleanup() { applyFSectionListBadge(); }
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
  // ORDER INVERTED (v1.22, his direction: "place the date instantly.
  // wait a moment, then install the F buttons"). The date goes in
  // FIRST — instantly, with two early retries for a late form frame —
  // and the F buttons are installed a moment later, so the badge
  // installation can no longer disturb the date fill.
  fillConsultDateSoft();
  setTimeout(fillConsultDateSoft, 800);
  setTimeout(fillConsultDateSoft, 1600);
  setTimeout(applyFButton, 2000);
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
  applyFSectionSignBadge();
  setTimeout(applyFSectionSignBadge, 1500);
  setTimeout(applyFSectionSignBadge, 4000);
  setTimeout(sweepFAll, 2000);
  setTimeout(sweepFAll, 4500);
  setTimeout(sweepFAll, 9000);
  setTimeout(sweepFAll, 13000);
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
  // (v1.22: the date now fills FIRST, in the init order above — the
  // F buttons are the ones that wait.)
  // Runs last: on a both-green section list, no F badge survives (v1.7)
  applyFSectionListCleanup();
  setTimeout(applyFSectionListCleanup, 1500);
  setTimeout(applyFSectionListCleanup, 4000);
  setTimeout(applyFSectionListCleanup, 6000);
  // Badge reliability (v1.9, his CNR report: F key works but no badge on the
  // view link): the fixed 0/1.5s/4s passes can all land before PCC finishes
  // rendering the section table in its frame, and nothing re-ran them. The
  // F key was unaffected (it resolves its target at press time). Fix: later
  // passes + a throttled click re-run for the section-list badge trio.
  setTimeout(applyFViewBadge, 8000);
  setTimeout(applyFSectionSignBadge, 8000);
  setTimeout(applyFSectionListCleanup, 9000);
  (function attachSectionBadgeClicks() {
    try {
      var docs = allDocs();
      for (var d = 0; d < docs.length; d++) {
        (function(doc) {
          if (doc.__fSectionClickAttached) return;
          doc.__fSectionClickAttached = true;
          var last = 0;
          doc.addEventListener('click', function(e) {
            if (!e.isTrusted) return;
            var now = Date.now();
            if (now - last < 800) return;
            last = now;
            setTimeout(function() {
              applyFViewBadge();
              applyFSectionSignBadge();
              applyFSectionListCleanup();
            }, 300);
          }, true);
        })(docs[d]);
      }
    } catch (e) {}
  })();
  setTimeout(function() {
    try {
      var docs = allDocs();
      for (var d = 0; d < docs.length; d++) {
        (function(doc) {
          if (doc.__fSectionClickAttached) return;
          doc.__fSectionClickAttached = true;
          var last = 0;
          doc.addEventListener('click', function(e) {
            if (!e.isTrusted) return;
            var now = Date.now();
            if (now - last < 800) return;
            last = now;
            setTimeout(function() {
              applyFViewBadge();
              applyFSectionSignBadge();
              applyFSectionListCleanup();
            }, 300);
          }, true);
        })(docs[d]);
      }
    } catch (e) {}
  }, 2500);
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
