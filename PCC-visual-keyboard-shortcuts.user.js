// ==UserScript==
// @name         PCC visual/keyboard shortcuts
// @version      2.7
// @updateURL    https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-visual-keyboard-shortcuts.user.js
// @downloadURL  https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-visual-keyboard-shortcuts.user.js
// @match        https://*.pointclickcare.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function() {
  'use strict';

  // ---- Facility detection (for future facility-specific behavior) ----
  function facilityName() {
    try {
      var t = (document.body ? document.body.innerText : '').substring(0, 2000).toLowerCase();
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
  function isBedfordOrCH() {
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
  function makeFBadge(title, onClick) {
    var btn = document.createElement('button');
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
      // Remove stale buttons first
      var olds = document.querySelectorAll('.' + FBTN_CLASS);
      for (var i = olds.length - 1; i >= 0; i--) olds[i].remove();
      if (!isBedfordOrCH()) return;
      var target = findSaveSignLockExit();
      if (!target || !target.parentNode) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = FBTN_CLASS;
      btn.textContent = 'F';
      btn.title = 'Save & Sign & Lock & Exit (same as F key)';
      btn.setAttribute('style',
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;' +
        'font-size:14px;font-weight:700;color:#fff;' +
        'background:linear-gradient(135deg,#ef4444,#dc2626);' +
        'border:none;border-radius:999px;width:28px;height:28px;' +
        'box-shadow:0 2px 8px rgba(220,38,38,.35);' +
        'margin-left:8px;cursor:pointer;vertical-align:middle;');
      btn.addEventListener('click', function(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var t = findSaveSignLockExit();
        if (t) fireClick(t);
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
        if (low.indexOf('consult') === -1 || low.indexOf('psychiatry') === -1) continue;
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
  function findInProgressEditLink() {
    try {
      var docs = allDocs();
      for (var d = 0; d < docs.length; d++) {
      var rows = docs[d].querySelectorAll('table tr');
      for (var i = 0; i < rows.length; i++) {
        var txt = (rows[i].innerText || '').toLowerCase();
        // Row must be an In Progress Consult-Psychiatry form (any variant: "Consult Form - Psychiatry", "Consult-Psychiatry", etc.)
        if (txt.indexOf('in progress') === -1) continue;
        if (txt.indexOf('consult') === -1 || txt.indexOf('psychiatry') === -1) continue;
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
  function doFAction() {
    // Profile tab: F opens Admission Record (Face Sheet at Boro Park) — all facilities
    var adm = findAdmissionRecord();
    if (adm) { fireClick(adm); return true; }
    // Forms list: F opens the most recent In Progress form for editing, else copies the most recent — all facilities
    var edit = findInProgressEditLink();
    if (edit) { fireClick(edit); return true; }
    var copy = findMostRecentCopyLink();
    if (copy) { fireClick(copy); return true; }
    if (!isBedfordOrCH()) return false;
    // Inside the form: F hits Save & Sign & Lock & Exit (Bedford/Crown Heights only)
    var t = findSaveSignLockExit();
    if (t) { fireClick(t); return true; }
    return false;
  }

  function applyFAdmissionBadge() {
    try {
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
      });
      badge.classList.add(FBTN_CLASS + '-adm');
      if (adm.nextSibling) adm.parentNode.insertBefore(badge, adm.nextSibling);
      else adm.parentNode.appendChild(badge);
    } catch (e) {}
  }
  function applyFEditBadge() {
    try {
      // Prefer In Progress edit; fall back to most recent copy — all facilities
      var target = findInProgressEditLink();
      var label = 'Edit In Progress form (same as F key)';
      var badgeCls = FBTN_CLASS + '-edit';
      if (!target) {
        target = findMostRecentCopyLink();
        label = 'Copy most recent form (same as F key)';
        badgeCls = FBTN_CLASS + '-copy';
      }
      if (!target || !target.parentNode) return;
      if (target.parentNode.querySelector('.' + badgeCls)) return;
      var badge = makeFBadge(label, function() { doFAction(); });
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
  document.addEventListener('keydown', function(e) {
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
