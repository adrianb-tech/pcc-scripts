// ==UserScript==
// @name         PCC — Dot
// @version      1.2
// @updateURL    https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Dot.user.js
// @downloadURL  https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Dot.user.js
// @match        https://*.pointclickcare.com/*
// @match        https://*.pointclickcare.ca/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

// PCC — Dot 1.2 (2026-10-25, his Prog Notes step): TWO dots —
// psychiatric notes (assessments list) + Progress Notes (View All).
// Summary is REMOVED (his ruling): the summary path goes to ONE
// location, the Progress Notes page, where the ring gathers TWO
// pieces — (1) diagnoses, (2) behaviors — and shows a CHECK MARK
// when both land. Hover the ring for Diagnoses + Behaviors buttons;
// click one and a box comes out with the information gathered.
// Then he goes to Dash.
//
//   FETCHING (no visit — the ring gets it on chart open):
//     - consult dates + count (assessments list fetch, href as-is)
//     - full texts of consults already opened (stored packet)
//   GATHERING (visit — he goes there):
//     - diagnoses + behaviors: the Progress Notes page (the Dot
//       reads the extractors' planted boxes live; on later pages
//       it reads Core's packet — never the note frames directly)
//     - full text of any never-opened consult: open it from the list
//       (tap the psych dot to go there)
//
// The ring is per-page: on Prog Notes it closes half for diagnoses
// and half for behaviors, with a check when both land; on the
// assessments list it is the 1.1 psych arc (list half + full-text
// half); elsewhere it stays neutral. Dot links are the tab bar's
// own hrefs AS-IS (no params appended — the 1.1 param-stripping
// lesson: PCC strips them live). The host is never auto-removed
// on a chart page (URL /client/, chart header, or any dot link
// keeps it); only a clearly non-chart page (login) removes it.
//
// Standing laws honored: top document only; keys dead while typing;
// '0' toggles the dot (session-only); nothing phones out (one
// same-origin fetch of a page he already has access to); the box
// shows the gathered diagnoses + behaviors LISTS (structured packet
// content), never consult narrative text; the position persists as
// x/y only. The test hooks __tmDotPsych + __tmDotProg expose counts,
// URLs, and the gathered dx/beh lists (same-origin console only,
// never transmitted — the same exposure Core's __tmGather already
// gives). Snippety untouched (no fields, no paste, no keys except '0').

(function () {
  'use strict';
  if (window.top !== window.self) return;

  var HOST_ID = 'tmDotHost';
  var POS_KEY = 'tmDotPos';
  var STORE_PREFIX = 'tmGatherV2:';
  var DOT_W = 120, DOT_H = 140; // assembly footprint, for viewport clamping
  var CIRC = 163.36; // 2 * PI * 26, the enso ring's circumference
  var PSYCH_RE = /psychiatr|psych\s*:|psych\s+consult/i;

  function norm(s) { return (s || '').replace(/\s+/g, ' ').trim().toUpperCase(); }
  function ctxt(el) {
    if (!el) return '';
    var c = el.cloneNode(true);
    var junk = c.querySelectorAll('script, style, pre');
    for (var i = 0; i < junk.length; i++) junk[i].remove();
    return (c.textContent || '').replace(/\s+/g, ' ').trim();
  }
  function firstDate(cells) {
    for (var i = 0; i < cells.length; i++) {
      var m = cells[i].match(/\d{1,2}\/\d{1,2}\/\d{4}/);
      if (m) return m[0];
    }
    return '';
  }
  function fmtDate(d) {
    var m = (d || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    return m ? (m[1] + '/' + m[2] + '/' + m[3].slice(2)) : d;
  }

  // Resident key: the chart number in the header alone ('Last, First
  // (CH187985)'), the same element Core's S key reads. URL EIDs rotate
  // per page and per link — never used as a key, so a missing header
  // means no stored merge, not a wrong resident's notes.
  function headerChart() {
    try {
      var els = document.querySelectorAll('span, div, h1, h2, h3, td, a, b, strong');
      for (var i = 0; i < els.length; i++) {
        var tx = (els[i].textContent || '').replace(/\s+/g, ' ').trim();
        if (tx.length > 70 || tx.length < 5) continue;
        if (/^clinical\s/i.test(tx)) continue;
        var em = tx.match(/^[A-Za-z][A-Za-z'’.\-]+(?:\s+[A-Za-z][A-Za-z'’.\-]+)?\s*,\s*[A-Za-z][A-Za-z'’.\- ]+?\s*\(\s*([A-Za-z]{0,5}\d{3,})\s*\)/);
        if (em) return 'chart:' + em[1].toUpperCase();
      }
    } catch (e) {}
    return '';
  }

  // The assessments list URL, discovered live from the tab bar (never
  // hardcoded): pass 1 matches the href itself, pass 2 the tab label.
  // Aimed at the ALL-types view (ESOLstdassessid=-1 is the filter's
  // "All"; status filter empty = All) so his consults come back whole.
  function discoverAssessUrl() {
    var anchors = document.querySelectorAll('a[href]');
    for (var p = 0; p < 2; p++) {
      for (var i = 0; i < anchors.length; i++) {
        var a = anchors[i];
        var href = a.getAttribute('href') || '';
        if (/editmyprofile|myprofile/i.test(href)) continue;
        var label = norm(a.textContent);
        var hit = (p === 0) ? /cp_assessment|assessments/i.test(href)
          : (label && label.length <= 24 && /assmnts|assessments/i.test(label));
        if (!hit) continue;
        try { return new URL(href, location.href).href; } catch (e) { return ''; }
      }
    }
    return '';
  }
  // The Progress Notes URL, discovered live from the tab bar (never
  // hardcoded), href AS-IS: pass 1 matches the href itself, pass 2
  // the tab label. No params appended (the 1.1 lesson — PCC strips
  // them live; the tab's own href is the reliable form, and the
  // View All filter, if needed, is his 1 click on the page).
  function discoverProgNotesUrl() {
    var anchors = document.querySelectorAll('a[href]');
    for (var p = 0; p < 2; p++) {
      for (var i = 0; i < anchors.length; i++) {
        var a = anchors[i];
        var href = a.getAttribute('href') || '';
        if (/editmyprofile|myprofile/i.test(href)) continue;
        var label = norm(a.textContent);
        var hit = (p === 0) ? /progressnotesviewall|progressnotes\.xhtml/i.test(href)
          : (label && label.length <= 24 && /prog\s*notes/i.test(label));
        if (!hit) continue;
        try { return new URL(href, location.href).href; } catch (e) { return ''; }
      }
    }
    return '';
  }

  // Live read: on the Progress Notes page the extractors plant
  // #pnDxBox/#pnBehBox (content in #pnDxOut/#pnBehOut). Read the
  // content element when present, else the whole box. This is the
  // gather itself — it needs no packet and no fetch (h222 proves
  // it with a fetch that always rejects). Never the note frames
  // themselves, only the extractors' planted boxes.
  function readLiveProg() {
    var out = { dx: '', beh: '' };
    try {
      // Whole-box fallback ONLY when the Out element is absent (old
      // extractor shape). When the Out is present-but-empty, that
      // means nothing gathered — falling back to the box would
      // return the label text ("Diagnoses", "Behavior — …") as
      // content and fake a check.
      var dxOut = document.getElementById('pnDxOut');
      if (dxOut) {
        out.dx = (dxOut.textContent || '').replace(/\s+/g, ' ').trim();
      } else {
        var dxBox = document.getElementById('pnDxBox');
        if (dxBox) out.dx = (dxBox.textContent || '').replace(/\s+/g, ' ').trim();
      }
      var behOut = document.getElementById('pnBehOut');
      if (behOut) {
        out.beh = (behOut.textContent || '').replace(/\s+/g, ' ').trim();
      } else {
        var behBox = document.getElementById('pnBehBox');
        if (behBox) out.beh = (behBox.textContent || '').replace(/\s+/g, ' ').trim();
      }
    } catch (e) {}
    return out;
  }
  // Stored diagnoses + behaviors (Core's packet, localStorage): stops
  // carry { status, summary } — this script reads status + summary
  // ONLY, never note text. Returns landed flags + texts ('' when a
  // stop is not landed or there is no chart key / packet).
  function readStoredProg() {
    var out = { dxLanded: false, behLanded: false, dxText: '', behText: '' };
    if (!chart) return out;
    try {
      var raw = localStorage.getItem(STORE_PREFIX + chart);
      if (!raw) return out;
      var stored = JSON.parse(raw);
      var stops = (stored && stored.stops) || {};
      var dx = stops.diagnoses || {}, beh = stops.behaviors || {};
      if (dx.status === 'landed') {
        out.dxLanded = true;
        out.dxText = dx.summary || dx.text || '';
      }
      if (beh.status === 'landed') {
        out.behLanded = true;
        out.behText = beh.summary || beh.text || '';
      }
    } catch (e) {}
    return out;
  }
  // Merge: live wins when present (freshest, and the only source on
  // the Prog Notes page before Core lands it); the packet's landed
  // flag + text fill what the live page does not have (other
  // pages, or boxes not yet planted). Returns true on any change.
  function refreshProg() {
    var live = readLiveProg();
    var p = readStoredProg();
    var ndxText = live.dx || p.dxText;
    var nbehText = live.beh || p.behText;
    var ndxLanded = !!live.dx || p.dxLanded;
    var nbehLanded = !!live.beh || p.behLanded;
    var changed = ndxLanded !== dxLanded || nbehLanded !== behLanded ||
      ndxText !== dxText || nbehText !== behText;
    dxLanded = ndxLanded; behLanded = nbehLanded;
    dxText = ndxText; behText = nbehText;
    progDone = dxLanded && behLanded;
    return changed;
  }

  // Psych consult dates from a fetched assessments list doc: rows with
  // >= 6 cells and no nested table row, a date in any cell, and a psych
  // row (same PSYCH_RE Core's parseAssessments uses). Newest first,
  // capped at 24 (the stored hisnotes list's own cap).
  function parsePsychDates(doc) {
    var dates = [];
    var rows = doc.querySelectorAll('tr');
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      if (!row.cells || row.cells.length < 6 || row.querySelector('tr')) continue;
      var t = Array.prototype.map.call(row.cells, ctxt);
      var dateStr = firstDate(t);
      if (!dateStr) continue;
      if (PSYCH_RE.test(t.join(' | '))) dates.push(dateStr);
    }
    dates.sort(function (a, b) { return new Date(b) - new Date(a); });
    return dates.slice(0, 24);
  }

  // Stored hisnotes list (Core's packet, localStorage): entries carry
  // { date, full } — this script reads date + full flag ONLY, never
  // note text. Returns [] when there is no chart key or no packet.
  function readStoredList(chart) {
    if (!chart) return [];
    try {
      var raw = localStorage.getItem(STORE_PREFIX + chart);
      if (!raw) return [];
      var stored = JSON.parse(raw);
      var list = stored && stored.stops && stored.stops.hisnotes && stored.stops.hisnotes.list;
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }

  var host = null, shadow = null, boxEl = null, dotEl = null, progDotEl = null,
    ringProg = null, ringCheck = null, menuEl = null, dxBtnEl = null, behBtnEl = null,
    gatherBoxEl = null, gatherTextEl = null;
  var chart = '', assessUrl = '', progUrl = '', lastNavUrl = null;
  var fetched = false, fetching = false, fetchFailed = false, listFound = false, progFound = false;
  var dates = [], fetchedDates = [], fullN = 0, done = false, justDragged = false;
  var progDone = false, dxText = '', behText = '', dxLanded = false, behLanded = false;
  var boxOpen = false, boxKind = '';

  // Merge fetched dates with the stored list by date (a full text is
  // never downgraded by a later date-only sighting; a stored date the
  // fetch missed is kept — the stored list's own union rule). Newest
  // first, capped at 24.
  function mergeNotes(fetchedDates) {
    var byDate = {};
    fetchedDates.forEach(function (d) { byDate[d] = { date: d, full: false }; });
    readStoredList(chart).forEach(function (e) {
      if (!e || !e.date) return;
      if (!byDate[e.date]) byDate[e.date] = { date: e.date, full: !!e.full };
      else if (e.full) byDate[e.date].full = true;
    });
    var list = Object.keys(byDate).map(function (k) { return byDate[k]; })
      .sort(function (a, b) { return new Date(b.date) - new Date(a.date); }).slice(0, 24);
    var changed = list.length !== dates.length || list.some(function (e, i) {
      return !dates[i] || dates[i].date !== e.date || dates[i].full !== e.full;
    });
    dates = list;
    fullN = list.filter(function (e) { return e.full; }).length;
    return changed;
  }

  // Current page, from the URL (no tab-bar dependency): Prog Notes
  // (the stream) vs the assessments list vs anything else.
  function curPage() {
    var h = location.href || '';
    if (/progressnotesviewall|progressnotes\.xhtml/i.test(h)) return 'prog';
    if (/cp_assessment|assessments/i.test(h)) return 'assess';
    return 'other';
  }
  function arcFrac() {
    // Per-page ring: Prog Notes closes half for diagnoses and half
    // for behaviors; the assessments list keeps the 1.1 psych arc
    // (list half + full-text half); elsewhere neutral.
    if (curPage() === 'prog') return (dxLanded ? 0.5 : 0) + (behLanded ? 0.5 : 0);
    if (!fetched) return 0;
    var n = dates.length;
    if (n === 0) return 0.5; // list known, nothing to cover
    return 0.5 + 0.5 * (fullN / n);
  }
  function ringDone() {
    if (curPage() === 'prog') return progDone;
    if (curPage() === 'assess') return done;
    return false;
  }
  function renderRing() {
    if (!ringProg) return;
    var frac = arcFrac();
    var dash = (frac * CIRC).toFixed(1);
    ringProg.setAttribute('stroke-dasharray', dash + ' ' + CIRC.toFixed(2));
    if (ringCheck) ringCheck.style.display = ringDone() ? '' : 'none';
  }
  function dotTitle() {
    if (fetchFailed) return 'Psychiatric notes — list fetch failed (reload to retry)';
    if (!listFound) return 'Psychiatric notes — assessments list not found on this page';
    if (!done) return 'Psychiatric notes — gathering…';
    return 'Psychiatric notes — done: ' + dates.length + ' consults, ' + fullN + ' full text';
  }
  function progDotTitle() {
    // Landed first: gathered content wins over the not-found
    // message, even when the Prog Notes tab link itself is missing
    // (the current tab is a non-link, so on the Prog Notes page
    // the link is often absent while the gather succeeded).
    if (progDone) return 'Progress Notes — done: diagnoses + behaviors gathered';
    if (!progFound) return 'Progress Notes — notes page not found on this page';
    var parts = [];
    if (!dxLanded) parts.push('diagnoses');
    if (!behLanded) parts.push('behaviors');
    return 'Progress Notes — gathering: ' + parts.join(' + ') + ' still needed';
  }
  function renderDots() {
    if (dotEl) {
      dotEl.className = 'tmDot' + (done ? ' filled' : '');
      dotEl.title = dotTitle();
    }
    if (progDotEl) {
      progDotEl.className = 'tmDot' + (progDone ? ' filled' : '');
      progDotEl.title = progDotTitle();
    }
  }
  // Hover menu labels: a check suffix when that piece has landed,
  // so hover alone tells him what is gathered without clicking.
  function renderMenu() {
    if (dxBtnEl) dxBtnEl.textContent = 'Diagnoses' + (dxLanded ? ' ✓' : '');
    if (behBtnEl) behBtnEl.textContent = 'Behaviors' + (behLanded ? ' ✓' : '');
  }
  function renderAll() { renderRing(); renderDots(); renderMenu(); }

  function gatherTextFor(kind) {
    // Landed first, same rule as the title: gathered text shows
    // even when the Prog Notes tab link is missing.
    if (kind === 'dx') {
      if (dxLanded) return dxText || 'Diagnoses — gathered, but the list came back empty.';
      if (!progFound) return 'Progress Notes — notes page not found on this page.';
      return 'Diagnoses — not gathered yet. Visit the Progress Notes page and the ring gathers them.';
    }
    if (behLanded) return behText || 'Behaviors — gathered, but the list came back empty.';
    if (!progFound) return 'Progress Notes — notes page not found on this page.';
    return 'Behaviors — not gathered yet. Visit the Progress Notes page and the ring gathers them.';
  }
  function showGather(kind) {
    if (!gatherBoxEl || !gatherTextEl) return;
    boxKind = kind; boxOpen = true;
    gatherTextEl.textContent = gatherTextFor(kind);
    gatherBoxEl.style.display = 'block';
    // Position near the dot, clamped to the viewport. jsdom has no
    // layout (rects are 0) — then it sits below the host, unclamped.
    try {
      var rect = host.getBoundingClientRect();
      var pw = gatherBoxEl.offsetWidth || 0, ph = gatherBoxEl.offsetHeight || 0;
      var vw = window.innerWidth || 1024, vh = window.innerHeight || 768;
      var left = (rect.width > 0) ? rect.left : (parseInt(host.style.left, 10) || 0);
      var top = (rect.height > 0) ? (rect.bottom + 8) : 0;
      if (pw > 0) left = Math.max(8, Math.min(left, vw - pw - 8));
      if (ph > 0 && top + ph > vh - 8) {
        var above = (rect.height > 0 ? rect.top : vh) - ph - 8;
        if (above >= 8) top = above;
      }
      gatherBoxEl.style.left = left + 'px'; gatherBoxEl.style.top = top + 'px';
    } catch (e) {}
  }
  function hideGather() {
    if (!gatherBoxEl) return;
    gatherBoxEl.style.display = 'none';
    boxOpen = false; boxKind = '';
  }

  function loadPos() {
    try {
      var raw = localStorage.getItem(POS_KEY);
      if (!raw) return null;
      var p = JSON.parse(raw);
      if (typeof p.x === 'number' && typeof p.y === 'number') return p;
    } catch (e) {}
    return null;
  }
  function clampPos(x, y) {
    var vw = window.innerWidth || 1024, vh = window.innerHeight || 768;
    return {
      x: Math.max(0, Math.min(x, Math.max(0, vw - DOT_W))),
      y: Math.max(0, Math.min(y, Math.max(0, vh - DOT_H)))
    };
  }

  function plant() {
    var existing = document.getElementById(HOST_ID);
    if (existing) { // re-plant guard: never duplicate, just re-render
      host = existing; shadow = host.shadowRoot;
      if (shadow) {
        boxEl = shadow.getElementById('tmDotBox'); dotEl = shadow.getElementById('tmDot');
        progDotEl = shadow.getElementById('tmDotProg');
        ringProg = shadow.getElementById('tmRingProg'); ringCheck = shadow.getElementById('tmRingCheck');
        menuEl = shadow.getElementById('tmHoverMenu');
        dxBtnEl = shadow.getElementById('tmDxBtn'); behBtnEl = shadow.getElementById('tmBehBtn');
        gatherBoxEl = shadow.getElementById('tmGatherBox');
        gatherTextEl = shadow.getElementById('tmGatherText');
      }
      renderAll();
      if (boxOpen) showGather(boxKind);
      return;
    }
    host = document.createElement('div');
    host.id = HOST_ID;
    var pos = loadPos();
    if (pos) {
      var c = clampPos(pos.x, pos.y);
      host.style.left = c.x + 'px'; host.style.top = c.y + 'px';
    } else {
      host.style.right = '16px'; host.style.bottom = '16px';
    }
    host.style.cssText += 'position:fixed;z-index:2147483647;margin:0;padding:0;';
    var parent = document.body || document.documentElement;
    parent.appendChild(host);
    shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML =
      '<style>' +
      '#tmDotBox{display:flex;flex-direction:column;align-items:center;gap:6px;padding:6px;' +
      'cursor:grab;user-select:none;-webkit-user-select:none;touch-action:none;background:transparent;}' +
      '#tmDotBox.dragging{cursor:grabbing;}' +
      '.tmDot{width:11px;height:11px;border-radius:50%;box-sizing:border-box;cursor:pointer;' +
      'background:#ffffff;border:2px solid #cbd5e1;}' +
      '.tmDot.filled{background:#7c3aed;border:2px solid #7c3aed;}' +
      '#tmHoverMenu{display:none;flex-direction:column;gap:4px;align-items:stretch;}' +
      '.tmMenuBtn{font:600 12px system-ui,sans-serif;color:#ffffff;background:#7c3aed;' +
      'border:none;border-radius:999px;padding:5px 12px;cursor:pointer;white-space:nowrap;}' +
      '#tmGatherBox{display:none;position:fixed;z-index:2147483647;width:340px;max-width:90vw;' +
      'max-height:60vh;overflow:auto;background:#ffffff;border:1px solid #cbd5e1;border-radius:12px;' +
      'box-shadow:0 8px 30px rgba(0,0,0,0.25);padding:14px;font:13px/1.5 system-ui,sans-serif;color:#0f172a;}' +
      '#tmGatherText{white-space:pre-line;margin:0 0 12px 0;}' +
      '.tmPanelBtn{font:600 12px system-ui,sans-serif;color:#7c3aed;background:#f5f3ff;' +
      'border:1px solid #ddd6fe;border-radius:999px;padding:5px 12px;cursor:pointer;margin-right:8px;}' +
      '</style>' +
      '<div id="tmDotBox">' +
      '<svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">' +
      '<circle cx="32" cy="32" r="26" fill="none" stroke="#e9d5ff" stroke-width="5"/>' +
      '<circle id="tmRingProg" cx="32" cy="32" r="26" fill="none" stroke="#7c3aed" stroke-width="5" ' +
      'stroke-linecap="round" stroke-dasharray="0 163.36" transform="rotate(-90 32 32)"/>' +
      '<path id="tmRingCheck" d="M20 33 L29 42 L45 25" fill="none" stroke="#7c3aed" stroke-width="5" ' +
      'stroke-linecap="round" stroke-linejoin="round" style="display:none"/>' +
      '</svg>' +
      '<span id="tmDot" class="tmDot" title="Psychiatric notes"></span>' +
      '<span id="tmDotProg" class="tmDot" title="Progress Notes"></span>' +
      '<div id="tmHoverMenu">' +
      '<button id="tmDxBtn" class="tmMenuBtn" title="Show the gathered diagnoses">Diagnoses</button>' +
      '<button id="tmBehBtn" class="tmMenuBtn" title="Show the gathered behaviors">Behaviors</button>' +
      '</div>' +
      '</div>' +
      '<div id="tmGatherBox"><div id="tmGatherText"></div>' +
      '<button id="tmGatherCopyBtn" class="tmPanelBtn" title="Copy the gathered information">Copy</button>' +
      '<button id="tmGatherCloseBtn" class="tmPanelBtn" title="Close the box">Close</button></div>';
    boxEl = shadow.getElementById('tmDotBox');
    dotEl = shadow.getElementById('tmDot');
    progDotEl = shadow.getElementById('tmDotProg');
    ringProg = shadow.getElementById('tmRingProg');
    ringCheck = shadow.getElementById('tmRingCheck');
    menuEl = shadow.getElementById('tmHoverMenu');
    dxBtnEl = shadow.getElementById('tmDxBtn');
    behBtnEl = shadow.getElementById('tmBehBtn');
    gatherBoxEl = shadow.getElementById('tmGatherBox');
    gatherTextEl = shadow.getElementById('tmGatherText');
    var copyBtn = shadow.getElementById('tmGatherCopyBtn');
    if (copyBtn) copyBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(gatherTextFor(boxKind));
        }
      } catch (e) {}
    });
    var closeBtn = shadow.getElementById('tmGatherCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', function (ev) { ev.stopPropagation(); hideGather(); });
    if (dxBtnEl) dxBtnEl.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (justDragged) { justDragged = false; return; }
      showGather('dx');
    });
    if (behBtnEl) behBtnEl.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (justDragged) { justDragged = false; return; }
      showGather('beh');
    });
    // Hover the ring = the two buttons. The menu's visibility is an
    // inline style (not a class) so it reads the same in jsdom as in
    // the browser. An open gather box stays until Close, even after
    // the mouse leaves.
    boxEl.addEventListener('mouseenter', function () {
      if (menuEl) menuEl.style.display = 'flex';
    });
    boxEl.addEventListener('mouseleave', function () {
      if (menuEl) menuEl.style.display = 'none';
    });
    bindDrag();
    // Tap a dot = go to that page, its tab href as-is, discovered
    // live from this chart's tab bar. A drag never navigates
    // (justDragged), and the press never leaks into PCC's document
    // listeners (so a dot tap never fires Core's click fetch burst).
    if (dotEl) dotEl.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (justDragged) { justDragged = false; return; }
      if (!assessUrl) return;
      lastNavUrl = assessUrl;
      try { window.location.href = assessUrl; } catch (e) {}
    });
    if (progDotEl) progDotEl.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (justDragged) { justDragged = false; return; }
      if (!progUrl) return;
      lastNavUrl = progUrl;
      try { window.location.href = progUrl; } catch (e) {}
    });
    renderAll();
    if (boxOpen) showGather(boxKind);
  }

  function bindDrag() {
    var startX = 0, startY = 0, startL = 0, startT = 0, dragging = false, moved = false;
    boxEl.addEventListener('pointerdown', function (ev) {
      ev.stopPropagation();
      ev.preventDefault();
      var rect = host.getBoundingClientRect();
      startL = (rect.width > 0) ? rect.left : (parseInt(host.style.left, 10) || 0);
      startT = (rect.height > 0) ? rect.top : (parseInt(host.style.top, 10) || 0);
      host.style.left = startL + 'px'; host.style.top = startT + 'px';
      host.style.right = 'auto'; host.style.bottom = 'auto';
      startX = ev.clientX; startY = ev.clientY;
      dragging = true; moved = false;
      boxEl.classList.add('dragging');
      try { if (ev.pointerId !== undefined) boxEl.setPointerCapture(ev.pointerId); } catch (e) {}
    });
    boxEl.addEventListener('pointermove', function (ev) {
      if (!dragging) return;
      ev.stopPropagation();
      var dx = ev.clientX - startX, dy = ev.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
      if (!moved) return;
      var c = clampPos(startL + dx, startT + dy);
      host.style.left = c.x + 'px'; host.style.top = c.y + 'px';
    });
    function endDrag(ev) {
      if (!dragging) return;
      ev.stopPropagation();
      dragging = false;
      justDragged = moved;
      boxEl.classList.remove('dragging');
      if (!moved) return; // a tap, not a drag: no position to save
      try {
        localStorage.setItem(POS_KEY, JSON.stringify({
          x: parseInt(host.style.left, 10) || 0,
          y: parseInt(host.style.top, 10) || 0
        }));
      } catch (e) {}
    }
    boxEl.addEventListener('pointerup', endDrag);
    boxEl.addEventListener('pointercancel', endDrag);
  }

  // '0' toggles the dot, session-only. Dead while typing, and never on a
  // modified press (Ctrl+0 is the browser's zoom reset, not ours).
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== '0' || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    var t = ev.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (!host) return;
    host.style.display = (host.style.display === 'none') ? '' : 'none';
  });

  // One fetch per page: the assessments list, all-types view, parsed
  // for psych consult dates, merged with the stored packet's full
  // texts. A failed fetch names itself in the dot title; retry is the
  // next page load (no refetch storms, no pollers).
  function tryFetch() {
    if (fetching || fetched) return;
    if (!assessUrl) return;
    if (typeof fetch === 'undefined' || typeof DOMParser === 'undefined') {
      fetchFailed = true; renderAll(); return;
    }
    fetching = true;
    var ctl = null;
    try {
      if (typeof AbortController !== 'undefined') {
        ctl = new AbortController();
        setTimeout(function () { try { ctl.abort(); } catch (e) {} }, 12000);
      }
    } catch (e) { ctl = null; }
    fetch(assessUrl, { credentials: 'same-origin', signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.text(); })
      .then(function (html) { return new DOMParser().parseFromString(html, 'text/html'); })
      .then(function (doc) {
        fetching = false; fetched = true;
        fetchedDates = parsePsychDates(doc);
        mergeNotes(fetchedDates);
        done = true;
        renderAll();
      })
      .catch(function () {
        fetching = false; fetchFailed = true;
        renderAll();
      });
  }

  // Click-triggered stored refresh: consults he opened on this page
  // (Core landed their texts) join the merge on his next click — no
  // polling, no observers. Re-renders only when the merge changed.
  document.addEventListener('click', function () {
    var changed = false;
    if (fetched && mergeNotes(fetchedDates)) changed = true;
    if (refreshProg()) changed = true;
    if (changed) renderAll();
    if (boxOpen && gatherTextEl) gatherTextEl.textContent = gatherTextFor(boxKind);
  });

  // Bounded refinement burst: the tab bar and header render late, so
  // re-discover the chart + dot URLs as PCC renders. Stops early once
  // the fetch has started with a known chart; otherwise runs ~2s.
  // Only the initial burst removes the host, and only on a clearly
  // non-chart page (login: no chart header, no dot link, no
  // /client/ URL). A chart page keeps the host even if a link is
  // missing — the assessments page has no assess link (its ASSMNTS
  // tab is not a link) but its /client/ URL keeps it (the 1.1
  // vanishing bug).
  function refineBurst(removeIfNoContext) {
    var contextFound = false, burstLeft = 40;
    (function burst() {
      var c = headerChart();
      if (c) { chart = c; contextFound = true; }
      var u = discoverAssessUrl();
      if (u) { assessUrl = u; listFound = true; contextFound = true; }
      var pu = discoverProgNotesUrl();
      if (pu) { progUrl = pu; progFound = true; contextFound = true; }
      if (/\/client\//i.test(location.href || '')) contextFound = true;
      refreshProg(); // live read needs no chart; packet read guards on it
      if (assessUrl && !fetched && !fetching) tryFetch();
      if (chart && assessUrl && fetching) return; // fetch underway, chart known: done
      if (chart && assessUrl && fetched) return;
      if (--burstLeft <= 0) {
        if (removeIfNoContext && !contextFound && host && host.parentElement) {
          host.parentElement.removeChild(host);
        }
        renderAll();
        return;
      }
      setTimeout(burst, 50);
    })();
  }

  // Guarded re-plant watch, dot-only: a click arms ONE bounded watch
  // (2s, 100ms checks). A genuinely missing host is rebuilt (followed
  // by a refinement burst); a kept host just re-renders. Dot presses
  // never arm it (they stop above).
  var reWatching = false;
  document.addEventListener('click', function () {
    if (reWatching || !document.getElementById(HOST_ID)) return;
    reWatching = true;
    var left = 20;
    (function reBurst() {
      if (!document.getElementById(HOST_ID)) { plant(); refineBurst(false); }
      else renderAll();
      if (--left <= 0) { reWatching = false; return; }
      setTimeout(reBurst, 100);
    })();
  });

  // Test hook (mirrors Core's __tmGather): counts + URLs only, never
  // note text, same-origin console only, never transmitted.
  try {
    window.__tmDotPsych = {
      getState: function () {
        return { done: done, n: dates.length, fullN: fullN, assessUrl: assessUrl,
          lastNavUrl: lastNavUrl, fetchFailed: fetchFailed, listFound: listFound };
      }
    };
  } catch (e) {}
  try {
    window.__tmDotProg = {
      getState: function () {
        return { done: progDone, diagnoses: dxText, behaviors: behText,
          progUrl: progUrl, assessUrl: assessUrl, lastNavUrl: lastNavUrl };
      }
    };
  } catch (e) {}

  // Plant now (document-start: before first paint on chart pages), then
  // refine as PCC renders.
  plant();
  refineBurst(true);
})();
