// ==UserScript==
// @version 1.1
// @updateURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-S-Copy-name-and-room.user.js
// @downloadURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-S-Copy-name-and-room.user.js
// @name         PCC S - Copy name and room
// @namespace    pcc-s-name-room
// @description  Press S on a chart to copy "Last, First<TAB>room" for visit sheets. E/W wing prefix at Crown Heights only.
// @match        https://*.pointclickcare.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  function toast(msg) {
    try {
      var t = document.createElement('div');
      t.textContent = msg;
      t.setAttribute('style', 'position:fixed;bottom:18px;left:50%;transform:translateX(-50%);' +
        'z-index:999999;padding:6px 14px;font:700 13px system-ui,sans-serif;color:#fff;' +
        'background:#222;border-radius:6px;opacity:.95;pointer-events:none;');
      document.body.appendChild(t);
      setTimeout(function () { t.remove(); }, 1400);
    } catch (e) {}
  }

  // Yellow "S" confirmation badge + what was copied. Fades out on its own.
  function flashCopied(name, room) {
    try {
      var d = document.createElement('div');
      d.setAttribute('style', 'position:fixed;right:16px;bottom:16px;z-index:999999;' +
        'display:flex;align-items:center;gap:12px;padding:12px 20px;background:#222;' +
        'border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.45);' +
        'font:700 20px system-ui,sans-serif;color:#fff;pointer-events:none;transition:opacity .4s;');
      var s = document.createElement('span');
      s.textContent = 'S';
      s.setAttribute('style', 'display:inline-block;padding:4px 14px;font-size:22px;font-weight:900;' +
        'color:#000;background:#ffea00;border:2px solid #7a6400;border-radius:5px;');
      var t = document.createElement('span');
      t.textContent = name + '  ' + room;
      d.appendChild(s); d.appendChild(t);
      (document.body || document.documentElement).appendChild(d);
      setTimeout(function () {
        try { d.style.opacity = '0'; } catch (e) {}
        setTimeout(function () { try { d.parentNode.removeChild(d); } catch (e2) {} }, 450);
      }, 1700);
    } catch (e) {}
  }

  function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text); return; }
    } catch (e) {}
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (e2) {}
  }

  // True when the header facility picker shows Crown Heights (scoped to the
  // top of the page so a mention deep in the chart can't false-positive).
  function isCrownHeights(doc) {
    try {
      var els = doc.querySelectorAll('select, button, a, span, div, td');
      for (var i = 0; i < els.length; i++) {
        var t = (els[i].textContent || '').trim();
        if (t.length > 90 || t.length < 6) continue;
        if (!/crown\s*heights/i.test(t)) continue;
        var r = null;
        try { r = els[i].getBoundingClientRect(); } catch (e) {}
        if (r && r.top >= -50 && r.top < 300) return true;
      }
    } catch (e) {}
    return false;
  }

  function residentLastFirst(doc) {
    try {
      var txt = doc.body ? (doc.body.textContent || '') : '';
      var m = txt.match(/([A-Za-z][A-Za-z'’.\-]*(?:\s+[A-Za-z][A-Za-z'’.\-]*)*\s*,\s*[A-Za-z][A-Za-z'’.\- ]*?)\s*\(\s*[A-Za-z]{0,5}\d{3,}\s*\)/);
      if (m) return m[1].replace(/\s+/g, ' ').trim();
    } catch (e) {}
    return '';
  }

  // "6 West 612-B" -> "612B" (or "W612B" at Crown Heights).
  // "2 East 237-B" -> "237B" (no wing prefix except Crown Heights).
  function roomBedNumber(doc, withWing) {
    try {
      var txt = (doc.body && doc.body.textContent) ? doc.body.textContent : '';
      // Try the Location label first, then fall back to searching near "Location"
      var v = '';
      var m = txt.match(/\bLocation\s*:?\s*([^\n]*?)(?=\s*(?:Status|Code Status|Physician|DOB|Admission|Initial Admission|Discharge|Allergies|Special Instructions)\b|\n|$)/);
      if (m) v = m[1].replace(/\s+/g, ' ').trim();
      // Fallback: find "Location" then grab the next 30 chars
      if (!v) {
        var li = txt.search(/\bLocation\b/i);
        if (li !== -1) v = txt.substr(li, 40).replace(/\s+/g, ' ').trim();
      }
      var rm = v.match(/\b(\d{2,4})\s*-?\s*([A-Za-z])?\b/);
      if (!rm) return '';
      var pre = '';
      if (withWing) {
        var tok = v.slice(0, rm.index).match(/([A-Za-z]+)\s*$/);
        if (tok && /^(east|west)$/i.test(tok[1])) pre = tok[1].charAt(0).toUpperCase();
        else if (tok && tok[1].length === 1 && /[ew]/i.test(tok[1])) pre = tok[1].toUpperCase();
      }
      return pre + rm[1] + (rm[2] ? rm[2].toUpperCase() : '');
    } catch (e) { return ''; }
  }

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.repeat) return;
    var tg = e.target, tag = tg && tg.tagName ? tg.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (tg && tg.isContentEditable) return;
    if ((e.key || '').toUpperCase() !== 'S') return;
    var doc = document;
    var name = residentLastFirst(doc);
    if (!name) { toast('No resident name found'); return; }
    var room = roomBedNumber(doc, isCrownHeights(doc));
    if (!room) { toast('No room found for ' + name); return; }
    copyText(name + '\t' + room);
    flashCopied(name, room);
    e.preventDefault();
  }, true);
})();
