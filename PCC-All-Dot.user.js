// ==UserScript==
// @name         PCC — Dot
// @version      1.1
// @updateURL    https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Dot.user.js
// @downloadURL  https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Dot.user.js
// @match        https://*.pointclickcare.com/*
// @match        https://*.pointclickcare.ca/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

// PCC — Dot 1.1 (2026-10-24, his psych-notes trial): ONE dot, for his
// psychiatric notes only — the 6-dot trail of stage 1 is replaced, not
// extended, for this trial. The dot links to ALL his psychiatric
// notes: tapping it goes to the assessments list, all-types view,
// where his consults live (the list carries no per-consult links, so
// the list IS the gathering link). The ring analyzes his notes on
// chart open and shows its progress, then offers Summary:
//
//   FETCHING (no visit — the ring gets it on chart open):
//     - consult dates + count (assessments list fetch, all-types)
//     - full texts of consults already opened (stored packet)
//   GATHERING (visit — he goes there):
//     - full text of any never-opened consult: open it from the list
//       (tap the dot to go there)
//
// The ring's arc is honest coverage, not a fake percentage: the list
// landing closes half the ring; the stored full texts close the other
// half in proportion (fullN / N). The check mark means the ANALYSIS
// is done (list + stored merge complete) — even when some texts are
// still missing, because those need his visits. The Summary panel
// names that bound plainly instead of hiding it.
//
// Standing laws honored: top document only; keys dead while typing;
// '0' toggles the dot (session-only); nothing phones out (one
// same-origin fetch of a page he already has access to); no note
// text is displayed or stored by this script — only dates, counts,
// and coverage (the panel lists dates, never note content); the
// position persists as x/y only. The test hook __tmDotPsych exposes
// counts + URLs only (same-origin console, never transmitted).
// Snippety untouched (no fields, no paste, no keys except '0').

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
  function allTypesUrl(u) {
    if (!u) return u;
    function setParam(url, name, val) {
      var re = new RegExp('([?&])' + name + '=[^&]*');
      if (re.test(url)) return url.replace(re, '$1' + name + '=' + val);
      return url + (url.indexOf('?') === -1 ? '?' : '&') + name + '=' + val;
    }
    return setParam(setParam(u, 'ESOLstdassessid', '-1'), 'ESOLstatusFilter', '');
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

  var host = null, shadow = null, boxEl = null, dotEl = null, ringProg = null,
    ringCheck = null, slotEl = null, panelEl = null, panelTextEl = null;
  var chart = '', assessUrl = '', lastNavUrl = null;
  var fetched = false, fetching = false, fetchFailed = false, listFound = false;
  var dates = [], fetchedDates = [], fullN = 0, done = false, panelOpen = false, justDragged = false;

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

  function arcFrac() {
    if (!fetched) return 0;
    var n = dates.length;
    if (n === 0) return 0.5; // list known, nothing to cover
    return 0.5 + 0.5 * (fullN / n);
  }
  function renderRing() {
    if (!ringProg) return;
    var frac = arcFrac();
    var dash = (frac * CIRC).toFixed(1);
    ringProg.setAttribute('stroke-dasharray', dash + ' ' + CIRC.toFixed(2));
    if (ringCheck) ringCheck.style.display = done ? '' : 'none';
  }
  function dotTitle() {
    if (fetchFailed) return 'Psychiatric notes — list fetch failed (reload to retry)';
    if (!listFound) return 'Psychiatric notes — assessments list not found on this page';
    if (!done) return 'Psychiatric notes — gathering…';
    return 'Psychiatric notes — done: ' + dates.length + ' consults, ' + fullN + ' full text';
  }
  function renderDot() {
    if (!dotEl) return;
    dotEl.className = 'tmDot' + (done ? ' filled' : '');
    dotEl.title = dotTitle();
  }
  function renderSummaryBtn() {
    if (!slotEl) return;
    slotEl.innerHTML = done
      ? '<button id="tmSummaryBtn" title="Summary of all psychiatric notes">Summary</button>'
      : '';
    var btn = slotEl.querySelector('#tmSummaryBtn');
    if (btn) btn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (panelOpen) hidePanel(); else showPanel();
    });
  }
  function renderAll() { renderRing(); renderDot(); renderSummaryBtn(); }

  function buildSummaryText() {
    var n = dates.length;
    if (!fetched) return 'Psychiatric notes — still gathering…';
    if (n === 0) return 'Psychiatric notes: no consults found on the assessments list.';
    var lines = [];
    lines.push('Psychiatric notes: ' + n + ' consults');
    lines.push('Range: ' + fmtDate(dates[n - 1].date) + ' – ' + fmtDate(dates[0].date));
    lines.push('Latest: ' + fmtDate(dates[0].date));
    lines.push('Full text: ' + fullN + ' of ' + n);
    if (!chart) lines.push('Stored texts not read — no chart header on this page.');
    else if (fullN < n) lines.push('The other ' + (n - fullN) +
      ' were never opened — their text is not available until you open each one. Tap the dot to go to the list.');
    lines.push('');
    lines.push('Consults (newest first):');
    dates.forEach(function (e) {
      lines.push(fmtDate(e.date) + ' — ' + (e.full ? 'full text' : 'date only'));
    });
    return lines.join('\n');
  }
  function showPanel() {
    if (!panelEl || !done) return;
    panelTextEl.textContent = buildSummaryText();
    panelEl.style.display = 'block';
    panelOpen = true;
    // Position near the dot, clamped to the viewport. jsdom has no
    // layout (rects are 0) — then it sits below the host, unclamped.
    try {
      var rect = host.getBoundingClientRect();
      var pw = panelEl.offsetWidth || 0, ph = panelEl.offsetHeight || 0;
      var vw = window.innerWidth || 1024, vh = window.innerHeight || 768;
      var left = (rect.width > 0) ? rect.left : (parseInt(host.style.left, 10) || 0);
      var top = (rect.height > 0) ? (rect.bottom + 8) : 0;
      if (pw > 0) left = Math.max(8, Math.min(left, vw - pw - 8));
      if (ph > 0 && top + ph > vh - 8) {
        var above = (rect.height > 0 ? rect.top : vh) - ph - 8;
        if (above >= 8) top = above;
      }
      panelEl.style.left = left + 'px'; panelEl.style.top = top + 'px';
    } catch (e) {}
  }
  function hidePanel() {
    if (!panelEl) return;
    panelEl.style.display = 'none';
    panelOpen = false;
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
        ringProg = shadow.getElementById('tmRingProg'); ringCheck = shadow.getElementById('tmRingCheck');
        slotEl = shadow.getElementById('tmSummarySlot'); panelEl = shadow.getElementById('tmSummaryPanel');
        panelTextEl = shadow.getElementById('tmSummaryText');
      }
      renderAll();
      if (panelOpen) showPanel();
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
      '#tmSummarySlot{min-height:30px;display:flex;align-items:center;justify-content:center;}' +
      '#tmSummaryBtn{font:600 13px system-ui,sans-serif;color:#ffffff;background:#7c3aed;' +
      'border:none;border-radius:999px;padding:6px 14px;cursor:pointer;}' +
      '#tmSummaryPanel{display:none;position:fixed;z-index:2147483647;width:340px;max-width:90vw;' +
      'max-height:60vh;overflow:auto;background:#ffffff;border:1px solid #cbd5e1;border-radius:12px;' +
      'box-shadow:0 8px 30px rgba(0,0,0,0.25);padding:14px;font:13px/1.5 system-ui,sans-serif;color:#0f172a;}' +
      '#tmSummaryText{white-space:pre-line;margin:0 0 12px 0;}' +
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
      '<div id="tmSummarySlot"></div>' +
      '</div>' +
      '<div id="tmSummaryPanel"><div id="tmSummaryText"></div>' +
      '<button id="tmCopyBtn" class="tmPanelBtn" title="Copy the summary">Copy</button>' +
      '<button id="tmCloseBtn" class="tmPanelBtn" title="Close the summary">Close</button></div>';
    boxEl = shadow.getElementById('tmDotBox');
    dotEl = shadow.getElementById('tmDot');
    ringProg = shadow.getElementById('tmRingProg');
    ringCheck = shadow.getElementById('tmRingCheck');
    slotEl = shadow.getElementById('tmSummarySlot');
    panelEl = shadow.getElementById('tmSummaryPanel');
    panelTextEl = shadow.getElementById('tmSummaryText');
    var copyBtn = shadow.getElementById('tmCopyBtn');
    if (copyBtn) copyBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(buildSummaryText());
        }
      } catch (e) {}
    });
    var closeBtn = shadow.getElementById('tmCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', function (ev) { ev.stopPropagation(); hidePanel(); });
    bindDrag();
    // Tap the dot = go to all psychiatric notes (the assessments list,
    // all-types view), discovered live from this chart's tab bar. A
    // drag never navigates (justDragged), and the press never leaks
    // into PCC's document listeners.
    boxEl.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (justDragged) { justDragged = false; return; }
      if (!assessUrl) return;
      lastNavUrl = assessUrl;
      try { window.location.href = assessUrl; } catch (e) {}
    });
    renderAll();
    if (panelOpen) showPanel();
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
        if (panelOpen) panelTextEl.textContent = buildSummaryText();
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
    if (!fetched) return;
    if (mergeNotes(fetchedDates)) renderAll();
    if (panelOpen) panelTextEl.textContent = buildSummaryText();
  });

  // Bounded refinement burst: the tab bar and header render late, so
  // re-discover the chart + list URL as PCC renders. Stops early once
  // the fetch has started with a known chart; otherwise runs ~2s.
  // Only the initial burst removes the host on non-chart pages
  // (login: no chart header, no assessments link).
  function refineBurst(removeIfNoContext) {
    var contextFound = false, burstLeft = 40;
    (function burst() {
      var c = headerChart();
      if (c) { chart = c; contextFound = true; }
      var u = discoverAssessUrl();
      if (u) { assessUrl = allTypesUrl(u); listFound = true; contextFound = true; }
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

  // Plant now (document-start: before first paint on chart pages), then
  // refine as PCC renders.
  plant();
  refineBurst(true);
})();
