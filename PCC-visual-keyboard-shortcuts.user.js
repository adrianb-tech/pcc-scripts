// ==UserScript==
// @name         PCC visual/keyboard shortcuts
// @version      1.9
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
  function findAdmissionRecord() {
    try {
      var docs = [document];
      // Also search same-origin iframes (PCC nests content in frames)
      try {
        var frames = document.querySelectorAll('iframe');
        for (var fi = 0; fi < frames.length; fi++) {
          try {
            if (frames[fi].contentDocument) docs.push(frames[fi].contentDocument);
          } catch (e2) {}
        }
      } catch (e3) {}
      for (var d = 0; d < docs.length; d++) {
        var doc = docs[d];
        var links = doc.querySelectorAll('a');
        for (var i = 0; i < links.length; i++) {
          var t = (links[i].textContent || '').replace(/\s+/g, ' ').trim().toUpperCase();
          if ((t.indexOf('ADMISSION RECORD') !== -1 || t.indexOf('FACE SHEET') !== -1) && visible(links[i])) {
            return links[i];
          }
        }
        var els = doc.querySelectorAll('span, div, td, li');
        for (var j = 0; j < els.length; j++) {
          var t2 = (els[j].textContent || '').replace(/\s+/g, ' ').trim().toUpperCase();
          if ((t2 === 'ADMISSION RECORD' || t2 === 'FACE SHEET') && visible(els[j])) {
            var a = els[j].closest ? els[j].closest('a') : null;
            return a || els[j];
          }
        }
      }
    } catch (e) {}
    return null;
  }
  function findInProgressEditLink() {
    try {
      var rows = document.querySelectorAll('table tr');
      for (var i = 0; i < rows.length; i++) {
        var txt = (rows[i].innerText || '').toLowerCase();
        // Row must be an In Progress Consult-Psychiatry form
        if (txt.indexOf('in progress') === -1) continue;
        if (txt.indexOf('consult-psychiatry') === -1 && txt.indexOf('consult - psychiatry') === -1) continue;
        var links = rows[i].querySelectorAll('a');
        for (var j = 0; j < links.length; j++) {
          var lt = (links[j].textContent || '').trim().toLowerCase();
          if (lt === 'edit' && visible(links[j])) return links[j];
        }
      }
    } catch (e) {}
    return null;
  }
  function doFAction() {
    // Profile tab: F opens Admission Record (Face Sheet at Boro Park) — all facilities
    var adm = findAdmissionRecord();
    if (adm) { fireClick(adm); return true; }
    if (!isBedfordOrCH()) return false;
    // Forms list: F opens the In Progress form for editing
    var edit = findInProgressEditLink();
    if (edit) { fireClick(edit); return true; }
    // Inside the form: F hits Save & Sign & Lock & Exit
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
      if (!isBedfordOrCH()) return;
      var edit = findInProgressEditLink();
      if (!edit || !edit.parentNode) return;
      if (edit.parentNode.querySelector('.' + FBTN_CLASS + '-edit')) return;
      var badge = makeFBadge('Edit In Progress form (same as F key)', function() {
        var el = findInProgressEditLink();
        if (el) fireClick(el);
      });
      badge.classList.add(FBTN_CLASS + '-edit');
      if (edit.nextSibling) edit.parentNode.insertBefore(badge, edit.nextSibling);
      else edit.parentNode.appendChild(badge);
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
  }, true);
})();
