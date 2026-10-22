// ==UserScript==
// @name         Every facility — Dashboard header: More / Less
// @version      3.40
// @description  On the resident dashboard header: hides PCC's Care Profile and PointClickCare Connect buttons and adds a third button in the identical rh-header-btn style labeled More. Click More and both buttons come back (it turns to Less); click Less and they hide again. Standalone by his request (2026-10-14) so it can't disturb the other scripts; the tiling redesign of the extended header area will live here too.
// @updateURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Dashboard-More-Less.user.js
// @downloadURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Dashboard-More-Less.user.js
// @match        https://*.pointclickcare.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  var BTN_ID = 'tmMoreLessBtn';
  var STYLE_ID = 'tmTilesStyle';
  var shown = false; // default (Less) state: PCC buttons hidden, gray box as two tiles, button reads More

  // Less-state look for the extended header's gray box: its two
  // existing columns become two tiles in the approved card style,
  // sitting at the LEFT (his spec, 2026-10-14). Injected as one
  // <style> element so More can return the box to PCC's exact
  // original layout just by removing it.
  var TILE_CSS =
    '#residentHeaderExtended .residentHeaderPropsFlexGrid.tmTilesOn{display:flex!important;' +
    'justify-content:flex-start!important;gap:12px!important;}' +
    '#residentHeaderExtended .residentHeaderPropsFlexGrid.tmTilesOn .residentHeaderPropsFlexGridCol{' +
    'flex:0 1 auto!important;max-width:660px;background:#fff;border:1px solid #e2e8f0;' +
    'border-radius:12px;box-shadow:0 1px 3px rgba(15,23,42,.05);padding:16px 18px;}';

  function targets() {
    var out = [];
    var cp = document.querySelector('#residentHeaderButtons [data-testid="care-profile"]');
    if (cp) out.push(cp);
    var cq = document.getElementById('carequality-app');
    if (cq) out.push(cq);
    return out;
  }

  function tilesGrid() {
    var grids = document.querySelectorAll('#residentHeaderExtended .residentHeaderPropsFlexGrid');
    for (var i = 0; i < grids.length; i++) {
      if (grids[i].querySelector('.residentHeaderPropsFlexGridCol')) return grids[i];
    }
    return null;
  }

  function apply() {
    targets().forEach(function (el) { el.style.display = shown ? '' : 'none'; });
    var b = document.getElementById(BTN_ID);
    if (b) b.textContent = shown ? 'Less' : 'More';
    var st = document.getElementById(STYLE_ID);
    var grid = tilesGrid();
    if (!shown) {
      if (!st) {
        st = document.createElement('style');
        st.id = STYLE_ID;
        st.textContent = TILE_CSS;
        document.head.appendChild(st);
      }
      if (grid) grid.classList.add('tmTilesOn');
    } else {
      if (grid) grid.classList.remove('tmTilesOn');
      if (st) st.remove();
    }
  }

  // S and G beside More (his ask, 2026-10-14), same rh-header-btn
  // look. They fire the REAL features, not copies: S dispatches the
  // keystroke the S script listens for (it doesn't check isTrusted),
  // in this frame, whose text carries the resident name + Location;
  // G clicks this frame's G badge when one exists (Grab-all's own
  // requestGrab: local grab + broadcast to the other frames), else
  // writes Grab-all's broadcast signal directly.
  function triggerS() {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true, cancelable: true }));
  }
  function triggerG() {
    queueHiddenTileFills();
    var badge = document.querySelector('.pcc-g-badge');
    if (badge) { badge.click(); return; }
    try { localStorage.setItem('pccGrabSignal', String(Date.now())); } catch (e) {}
  }

  // ---------- info cards row ----------
  // A row of tiles under the button bar with the information he
  // looks at (his design, 2026-10-14): Admission (re-entry),
  // Age/Sex, Room, Allergies — left to right; more cards can join
  // the row later. Values are read from the header card
  // (#copyInfoTable) in this same document, so they always match
  // what the header shows. The Copy buttons are true pcc-fill-copy
  // buttons with the same click behavior as the header card's own
  // (clipboard + the engine's localStorage queue), so G grabs them
  // too. The row shows in both More and Less states.
  var ROW_ID = 'tmCardsRow';

  // ---------- self-sourced tile data ----------
  // The tile row used to read its values from the header card
  // (#copyInfoTable). He retired that card (2026-10-14), so the row
  // now computes every value itself, with the same proven finders
  // the card used. The card remains a fallback while it still
  // exists on a page (update order doesn't matter).
  function fmtAllergies(raw) {
    if (!raw) return '';
    var cleaned = raw.trim();
    if (/^no\s+known\s+(?:drug\s+)?allergies/i.test(cleaned) || /^nkda?/i.test(cleaned)) return 'NKA';
    var list = cleaned.split(/[,;\/\n]+/);
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var item = list[i].replace(/\s+/g, ' ').trim();
      item = item.replace(/(?:Copy|Copied)$/i, '').trim();
      if (!item) continue;
      item = item.replace(/\bpen[ie]cill?in\b/gi, 'PCN');
      out.push(item);
    }
    return out.join(', ');
  }
  function isCrownHeights() {
    try {
      var els = document.querySelectorAll('select, button, a, span, div, td');
      for (var i = 0; i < els.length; i++) {
        var tx = (els[i].textContent || '').trim();
        if (tx.length > 90 || tx.length < 6) continue;
        if (!/crown\s*heights/i.test(tx)) continue;
        var r = null;
        try { r = els[i].getBoundingClientRect(); } catch (e) {}
        if (r && r.top >= -50 && r.top < 300) return true;
      }
    } catch (e) {}
    return false;
  }
  function roomBedNumber(withWing) {
    try {
      var txt = (document.body && document.body.textContent) ? document.body.textContent : '';
      var v = '';
      var m = txt.match(/\bLocation\s*:?\s*([^\n]*?)(?=\s*(?:Status|Code Status|Physician|DOB|Admission|Initial Admission|Discharge|Allergies|Special Instructions)\b|\n|$)/);
      if (m) v = m[1].replace(/\s+/g, ' ').trim();
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
  function selfData() {
    var out = {};
    try {
      var txt = (document.body && document.body.textContent) ? document.body.textContent : '';
      var m = txt.match(/\((\d{1,3})\/(Male|Female)\)/);
      if (m) out.ageSex = m[1] + (m[2] === 'Male' ? 'M' : 'F');
      var room = roomBedNumber(isCrownHeights());
      if (room) out.room = room;
      var al = document.querySelector('.residentAllergies .residentDetailValue');
      if (al) { var f = fmtAllergies((al.textContent || '').trim()); if (f) out.allergies = f; }
      var a1 = txt.match(/Admission\s*\(re-?entry\)\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
      if (a1) out.admission = a1[1] + ' (re-entry)';
      else {
        var a2 = txt.match(/Initial Admission Date[^0-9]*?(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
        if (a2) out.admission = a2[1] + ' (initial)';
      }
    } catch (e) {}
    return out;
  }

  function cardData() {
    var out = selfData();
    var card = document.getElementById('copyInfoTable');
    if (!card) return (out.ageSex || out.room || out.allergies || out.admission) ? out : null;
    var cells = card.children;
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i];
      if (!c.querySelector) continue;
      var lab = c.querySelector('span');
      if (!lab || !lab.firstChild) continue;
      var name = (lab.firstChild.textContent || '').trim().toLowerCase();
      var valSpan = c.querySelectorAll('span')[1];
      var val = valSpan ? (valSpan.textContent || '').trim() : '';
      var btn = c.querySelector('.pcc-fill-copy');
      var qv = btn ? btn.getAttribute('data-fill-value') : null;
      if (name.indexOf('age') === 0) { if (!out.ageSex) out.ageSex = qv || val; }
      else if (name.indexOf('room') === 0) { if (!out.room) out.room = val; }
      else if (name.indexOf('allergies') === 0) { if (!out.allergies) out.allergies = qv || val; }
      else if (name.indexOf('admission') === 0) { if (!out.admission) out.admission = val; }
    }
    return (out.ageSex || out.room || out.allergies || out.admission) ? out : null;
  }

  // Weight tile (his ask, 2026-10-14): from the header vitals
  // table's Weight cell, mirrored exactly as PCC shows it — this
  // resident's cell reads 0 Lbs (no reading recorded), and the
  // tile still shows, because he expects the box to be there.
  function weightValue() {
    var blocks = document.querySelectorAll('.vitalDetails');
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i].querySelector('b');
      var v = blocks[i].querySelector('.vitalValue');
      if (b && v && /^weight$/i.test((b.textContent || '').trim())) {
        var m = (v.textContent || '').match(/([\d.]+)\s*lbs/i);
        if (m) return m[1] + ' lbs';
      }
    }
    return null;
  }

  // PCC flags a vital by putting class 'vitalWithException'
  // on its cell in the header vitals table - that is what
  // turns the value red with the warning triangle (his
  // screenshot, 2026-10-15). Mirror it on the Weight tile.
  function weightFlagged() {
    var blocks = document.querySelectorAll('.vitalDetails');
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i].querySelector('b');
      if (b && /^weight$/i.test((b.textContent || '').trim())) {
        var td = blocks[i].closest ? blocks[i].closest('td') : null;
        return !!(td && td.classList && td.classList.contains('vitalWithException'));
      }
    }
    return false;
  }

  function queueCopy(label, value) {
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(value); } catch (err) {}
    var KEYS = { 'Age/Sex': 'pccFillAgeSex', 'Allergies': 'pccFillAllergies', 'Psych meds': 'pccFillPsychMeds', 'Relationships': 'pccFillRelationships', 'BIMS': 'pccFillBims' };
    var key = KEYS[label] || null;
    if (key) { try { localStorage.setItem(key, JSON.stringify({ value: value, ts: Date.now() })); } catch (err) {} }
  }

  function copyBtn(label, value) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'pcc-fill-copy';
    // Pre-marked so Grab-all never plants its G badge on these tiles
    // (his call, 2026-10-14) — the button stays grabbable by G itself.
    b.setAttribute('data-g-badge', '1');
    b.setAttribute('data-fill-label', label);
    b.setAttribute('data-fill-value', value);
    b.textContent = 'Copy';
    b.style.cssText = 'font:600 11px -apple-system,Helvetica,Arial,sans-serif;color:#3d4b61;' +
      'border:1px solid #dbe2ec;border-radius:999px;padding:2px 9px;background:#f4f6f9;cursor:pointer;flex:none;';
    b.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      queueCopy(label, value);
      var o = b.textContent; b.textContent = 'Copied';
      setTimeout(function () { b.textContent = o; }, 1000);
    });
    return b;
  }

  // Press feedback (his spec, 2026-10-14): while G — button OR key —
  // is held, every grabbable tile lights light blue and says
  // 'Copied'; release restores. A single tile pressed on its own
  // lights the same way (color only). One shared save/restore so the
  // paths can't fight over a tile's colors or label.
  function hlTile(tl, withLabel) {
    if (tl.hasAttribute('data-tm-hl')) return;
    tl.setAttribute('data-tm-hl', '1');
    tl.setAttribute('data-tm-bg', tl.style.background || '');
    tl.setAttribute('data-tm-bd', tl.style.borderColor || '');
    tl.style.background = '#dbeafe';
    tl.style.borderColor = '#93c5fd';
    if (withLabel) {
      var ls = tl.querySelector('span');
      if (ls && !ls.getAttribute('data-tm-orig')) {
        ls.setAttribute('data-tm-orig', ls.textContent);
        ls.textContent = 'Copied';
      }
    }
  }
  function hlAllTiles() {
    var row = document.getElementById('tmCardsRow');
    if (!row) return;
    var tiles = document.querySelectorAll('#tmCardsRow .pcc-fill-copy, #tmCardsRow [data-tm-copy="1"], #tmCardsRow2 .pcc-fill-copy, #tmCardsRow2 [data-tm-copy="1"]');
    for (var i = 0; i < tiles.length; i++) hlTile(tiles[i], true);
  }
  function hlRestoreAll() {
    var lit = document.querySelectorAll('#tmCardsRow [data-tm-hl="1"], #tmCardsRow2 [data-tm-hl="1"]');
    for (var i = 0; i < lit.length; i++) {
      var tl = lit[i];
      tl.removeAttribute('data-tm-hl');
      tl.style.background = tl.getAttribute('data-tm-bg') || '';
      tl.style.borderColor = tl.getAttribute('data-tm-bd') || '';
      tl.removeAttribute('data-tm-bg');
      tl.removeAttribute('data-tm-bd');
      var ls = tl.querySelector('span');
      if (ls && ls.getAttribute('data-tm-orig')) {
        ls.textContent = ls.getAttribute('data-tm-orig');
        ls.removeAttribute('data-tm-orig');
      }
    }
  }
  function flashLabel(ls, tl) {
    if (!ls.getAttribute('data-tm-orig')) ls.setAttribute('data-tm-orig', ls.textContent);
    ls.textContent = 'Copied';
    setTimeout(function () {
      if (tl.hasAttribute('data-tm-hl')) return; // a press restore owns it
      var o = ls.getAttribute('data-tm-orig');
      if (o) { ls.textContent = o; ls.removeAttribute('data-tm-orig'); }
    }, 1000);
  }
  window.addEventListener('mouseup', hlRestoreAll);
  // Summary anchor (his design, 2026-10-19): the Summary
  // tile's chip shows the time window the paragraph is
  // composed over; clicking the chip cycles it and the
  // tile recomposes from the same landed facts.
  var SUM_ANCHORS = ['last', '14d', 'admission', 'total'];
  if (!window.__tmSumAnchor) window.__tmSumAnchor = 'last';
  function sumAnchorLabel() {
    return (window.__tmSummary && window.__tmSummary.anchors && window.__tmSummary.anchors[window.__tmSumAnchor]) || 'Since last visit';
  }
  function cycleSummaryAnchor(tileEl) {
    var i = SUM_ANCHORS.indexOf(window.__tmSumAnchor);
    window.__tmSumAnchor = SUM_ANCHORS[(i + 1) % SUM_ANCHORS.length];
    try {
      var t = (window.__tmSummary && lastStops) ? window.__tmSummary.text(lastStops, window.__tmSumAnchor) : '';
      if (tileEl) {
        tileEl.value = t;
        tileEl.chip = sumAnchorLabel();
        if (tileEl.opts) {
          if (tileEl.opts.click) tileEl.opts.click.value = t;
          if (tileEl.opts.fill) tileEl.opts.fill.value = t;
        }
        tileEl.setAttribute('data-fill-value', t);
      }
    } catch (e) {}
  }
  try { if (window.__tmCore) window.__tmCore.hooks = { queueCopy: queueCopy, hlTile: hlTile, goWtsVitals: goWtsVitals, medsPanel: medsPanel, fireClick: fireClick, flashLabel: flashLabel, cycleSummaryAnchor: cycleSummaryAnchor, action: function (name) { if (name === 'yourwords' && window.__tmYourWordsApi) window.__tmYourWordsApi.open(); } }; } catch (e) {}

  function tile(labelText, valueText, opts) {
    opts = opts || {};
    var d = document.createElement('div');
    d.style.cssText = 'background:' + (opts.warn ? '#ff1a1a' : (opts.rose ? '#fdf3f2' : '#fff')) + ';border:1px solid ' +
      (opts.warn ? '#ff8080' : (opts.rose ? '#f0c8c2' : '#e2e8f0')) + ';border-radius:12px;box-shadow:' +
      (opts.warn ? '0 0 10px rgba(255,26,26,.55),0 1px 3px rgba(15,23,42,.05)' : '0 1px 3px rgba(15,23,42,.05)') + ';' +
      'padding:' + (opts.pad || '12px 16px 14px') + ';min-width:' + (opts.minW || 0) + 'px;' + (opts.wide ? 'flex:1 1 520px;min-width:0;' : (opts.grow ? 'flex:1 1 400px;min-width:0;' : (opts.natW ? 'flex:none;width:auto;' + (opts.maxW ? 'max-width:' + opts.maxW + 'px;' : '') : (opts.fixedW ? 'flex:0 1 ' + opts.fixedW + 'px;width:' + opts.fixedW + 'px;' : 'flex:none;'))));
    var lab = document.createElement('div');
    lab.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:14px;';
    var ls = document.createElement('span');
    ls.textContent = labelText;
    ls.style.cssText = 'white-space:nowrap;font-size:10.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:' +
      (opts.warn ? '#ffe1e1' : (opts.rose ? '#a05a52' : '#8494a7')) + ';';
    lab.appendChild(ls);
    if (opts.btn) lab.appendChild(opts.btn);
    var v = document.createElement('div');
    var fontCss = 'font-size:' + (opts.size || 21) + 'px;font-weight:' + (opts.weight || 700) +
      ';line-height:' + (opts.multi ? '1.45' : '1.3') + ';color:' + (opts.warn ? '#ffffff' : (opts.color || '#131c2b')) + ';';
    if (opts.cols) {
      // Banner layout (his pick, design A in the row): the lines
      // flow into columns of at most 4, so the tile grows sideways,
      // never tall: 1-4 lines = 1 column, 10 lines = 3 columns.
      var lines = String(valueText).split('\n');
      var ncols = Math.max(1, Math.ceil(lines.length / 4));
      var per = Math.ceil(lines.length / ncols);
      v.style.cssText = 'margin-top:9px;display:flex;gap:26px;min-width:0;';
      v.setAttribute('data-medsfit', '1');
      for (var ci = 0; ci < ncols; ci++) {
        var col = document.createElement('div');
        col.style.cssText = 'max-width:300px;flex:1 1 0;min-width:0;';
        var slice = lines.slice(ci * per, (ci + 1) * per);
        for (var li = 0; li < slice.length; li++) {
          var ln = document.createElement('div');
          ln.className = 'tmMedLine';
          // One medication per line, never split (his ask,
          // 2026-10-19): 'Wellbutrin 450mg QHS for
          // depression' stays whole; fitMeds steps the
          // font down until the longest line fits.
          ln.style.cssText = fontCss + 'white-space:nowrap;';
          ln.textContent = slice[li];
          col.appendChild(ln);
        }
        v.appendChild(col);
      }
    } else {
      v.textContent = valueText;
      v.style.cssText = 'margin-top:9px;' + fontCss + (opts.multi ? 'white-space:pre-line;' : '');
    }
    if (opts.fit) v.setAttribute('data-fit', '1');
    if (opts.nowrap) v.style.whiteSpace = 'nowrap';
    d.appendChild(lab); d.appendChild(v);
    if (opts.fill) {
      // Carry the Copy-button contract on the tile itself, so G
      // (Grab-all) keeps queuing this value even with no button:
      // it clicks .pcc-fill-copy elements, which lands on the
      // tile's own click handler. Pre-marked: no G badge planted.
      d.classList.add('pcc-fill-copy');
      d.setAttribute('data-g-badge', '1');
      d.setAttribute('data-fill-label', opts.fill.label);
      d.setAttribute('data-fill-value', opts.fill.value);
    }
    if (opts.maxw) d.style.maxWidth = opts.maxw;
    if (opts.nav) {
      d.style.cursor = 'pointer';
      d.title = 'Go to WTS/VITALS';
      d.addEventListener('mousedown', function () { hlTile(d, false); });
      d.addEventListener('click', function () {
        if (!goWtsVitals()) {
          // No silent failure: say so on the tile itself.
          if (!ls.getAttribute('data-tm-orig')) ls.setAttribute('data-tm-orig', ls.textContent);
          ls.textContent = 'Not found';
          setTimeout(function () {
            var o = ls.getAttribute('data-tm-orig');
            if (o) { ls.textContent = o; ls.removeAttribute('data-tm-orig'); }
          }, 1400);
        }
      });
    }
    if (opts.delegate === 'meds') {
      d.setAttribute('data-tm-copy', '1');
      // The tile's click presses the panel's real Copy button, so the
      // transferred text (methadone rule included) is the button's own.
      d.style.cursor = 'pointer';
      d.title = 'Click to copy';
      d.addEventListener('mousedown', function () { hlTile(d, false); });
      d.addEventListener('click', function () {
        var p = medsPanel();
        if (p && p.btn) { fireClick(p.btn); flashLabel(ls, d); }
      });
    }
    if (opts.click) {
      // The whole tile is the button (his ask, 2026-10-14): click
      // anywhere on it does exactly what its Copy button did; the
      // label flashes 'Copied' as the confirmation.
      d.style.cursor = 'pointer';
      d.title = 'Click to copy';
      d.addEventListener('mousedown', function () { hlTile(d, false); });
      d.addEventListener('click', function () {
        queueCopy(opts.click.label, opts.click.value);
        flashLabel(ls, d);
      });
    }
    return d;
  }

  // Weight tile = a button to the WTS/VITALS tab (his ask,
  // 2026-10-14). The tab lives in another frame's tab bar, so the
  // click searches every frame for the tab labeled WTS/VITALS —
  // preferring a bar that also holds the other chart tabs — and
  // fires a real click sequence (PCC ignores synthetic .click()).
  function fireClick(el) {
    // Events are built with the TARGET document's own constructor:
    // a click event created in another frame's realm can be ignored
    // by the target frame's handlers (the Weight tile's first
    // version failed exactly like this - his report, 2026-10-14).
    var W = (el.ownerDocument && el.ownerDocument.defaultView) || window;
    ['mousedown', 'mouseup', 'click'].forEach(function (type) {
      el.dispatchEvent(new W.MouseEvent(type, { bubbles: true, cancelable: true, view: W }));
    });
    try { el.click(); } catch (e) {}
  }
  // Tab finding + activation PORTED from his old Tab Shortcuts
  // script (2026-10-02, v1.48 - 'the tabs were labeled qwerty and
  // they all worked. use that code'). Its method differs from my
  // failed finder in three ways that matter: (1) it first locates
  // the tab STRIP - the deepest visible container holding at least
  // 8 known tab labels as whole words; (2) inside the strip it
  // takes the deepest VISIBLE element whose normalized text is
  // exactly the label; (3) activation is click + an ENTER
  // keystroke - some PCC tabs only respond to Enter.
  var ALL_TAB_LABELS = ['DASH', 'PROFILE', 'CENSUS', 'MED DIAG', 'PROBLEMS',
    'ALLERGIES', 'IMMUN', 'ORDERS', 'WTS/VITALS', 'RESULTS', 'MDS', 'FORMS',
    'THERAPY', 'PROG NOTES', 'CARE PLAN', 'TASKS', 'MISC', 'ASSMNTS', 'ASSESSMENTS'];
  function tabNorm(s) { return (s || '').replace(/\s+/g, ' ').trim().toUpperCase(); }
  function tabVisible(el) { return !!(el.getClientRects && el.getClientRects().length); }
  function tabDepth(el, doc) {
    var d = 0, p = el;
    while (p && p !== doc.body && d < 60) { d++; p = p.parentNode; }
    return d;
  }
  function findTabStrip(doc) {
    var cands = doc.querySelectorAll('div, table, ul, nav, section, td, tr, tbody, header');
    var best = null, bestDepth = -1;
    for (var i = 0; i < cands.length; i++) {
      var el = cands[i];
      if (!tabVisible(el)) continue;
      var tx = ' ' + tabNorm(el.textContent) + ' ';
      var count = 0;
      for (var j = 0; j < ALL_TAB_LABELS.length; j++) {
        if (tx.indexOf(' ' + ALL_TAB_LABELS[j] + ' ') !== -1) count++;
      }
      if (count >= 8) {
        var d = tabDepth(el, doc);
        if (d > bestDepth) { bestDepth = d; best = el; }
      }
    }
    return best;
  }
  function findTabInDoc(doc, label) {
    var scope = findTabStrip(doc) || doc;
    var els = scope.querySelectorAll('a, button, td, li, span, div, th');
    var best = null, bestDepth = -1;
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (tabNorm(el.textContent) !== label) continue;
      if (!tabVisible(el)) continue;
      var d = tabDepth(el, doc);
      if (d > bestDepth) { bestDepth = d; best = el; }
    }
    return best;
  }
  function activateTab(el) {
    var W = (el.ownerDocument && el.ownerDocument.defaultView) || window;
    try { el.click(); } catch (e) {}
    try {
      var init = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
      el.dispatchEvent(new W.KeyboardEvent('keydown', init));
      el.dispatchEvent(new W.KeyboardEvent('keypress', init));
    } catch (e2) {}
    // Belt and braces: the mouse sequence too.
    try {
      ['mousedown', 'mouseup', 'click'].forEach(function (type) {
        el.dispatchEvent(new W.MouseEvent(type, { bubbles: true, cancelable: true, view: W }));
      });
    } catch (e3) {}
  }
  function goWtsVitals() {
    try { localStorage.setItem('tmGoWts', String(Date.now())); } catch (e) {}
    var found = null;
    (function search(w) {
      if (found) return;
      try {
        found = findTabInDoc(w.document, 'WTS/VITALS');
        if (found) return;
        for (var i = 0; i < w.frames.length && !found; i++) search(w.frames[i]);
      } catch (e) { /* cross-origin frame: skip */ }
    })(window.top || window);
    if (found) { activateTab(found); return true; }
    return false;
  }

  // The med list's visible lines (or '- none'). The Copy button only
  // learns its fill value when clicked, so the tile reads the panel
  // for display and DELEGATES its click to the real button — the
  // transfer text (incl. the methadone rule) stays the button's own.
  // The meds panel does NOT live in the header's document - the
  // dashboard's widgets are child frames (proven by his captures:
  // the header doc has residentHeaderButtons but no medListBox).
  // The first meds tile versions only looked in this document and
  // so never appeared. Search every frame, like BIMS/Relationships.
  function medsPanel() {
    var docs = allDocs();
    for (var i = 0; i < docs.length; i++) {
      var box = docs[i].getElementById('medListBox');
      var btn = docs[i].getElementById('copyMedListBtn');
      if (box || btn) return { doc: docs[i], box: box, btn: btn };
    }
    return null;
  }
  function medsDisplay() {
    var p = medsPanel();
    if (!p) return '';
    if (!p.box) return '- none';
    var divs = p.box.querySelectorAll('div');
    var lines = [];
    for (var i = 1; i < divs.length; i++) {
      var tx = (divs[i].textContent || '').trim();
      if (tx.indexOf('\u26A0 REVIEW') === 0) break;
      if (tx) lines.push(tx);
    }
    return lines.length ? lines.join('\n') : '- none';
  }

  function buildCards() {
    pullFromPacket();
    var bar = document.getElementById('residentHeaderButtons');
    if (!bar || !bar.parentNode) return;
    var d = cardData();
    if (d) {
      d.weight = weightValue();
      d.weightRed = weightFlagged();
      d.meds = medsDisplay() || feedMeds || '';
      var mp = medsPanel();
      d.medsFill = (mp && mp.btn && mp.btn.hasAttribute('data-fill-value')) ? mp.btn.getAttribute('data-fill-value') : (feedMeds || null);
      d.bims = bimsValue();
      d.rel = relValue();
      d.dx = feedDx;
      d.beh = feedBeh;
      d.words = (window.__tmYourWordsApi ? window.__tmYourWordsApi.get() : '');
      d.summary = (window.__tmSummary && lastStops) ? window.__tmSummary.text(lastStops, window.__tmSumAnchor) : '';
      d.stampRel = feedStampRel; d.stampBims = feedStampBims; d.stampMeds = feedStampMeds; d.stampDx = feedStampDx; d.stampBeh = feedStampBeh;
    }
  // His med order (2026-10-19): medications for the
    // same indication sit together, and seizure /
    // Parkinson's medications go last. Groups keep
    // first-appearance order; lines keep theirs within
    // a group. The indication is the stated 'for X'.
    function medsOrderLines(lines) {
    var buckets = [], seen = {};
    lines.forEach(function (ln, i) {
      var m = / for (.+)$/.exec(ln);
      var ind = m ? m[1].replace(/\s+/g, ' ').replace(/[.\s]+$/, '').toLowerCase() : '';
      var last = /seizure|epilep|parkinson/.test(ind || ln);
      var key = (last ? 'L|' : 'M|') + (ind || ('#' + i));
      if (!seen[key]) { seen[key] = []; buckets.push(seen[key]); }
      seen[key].push({ ln: ln, last: last });
    });
    var main = buckets.filter(function (b) { return !b[0].last; });
    var lastB = buckets.filter(function (b) { return b[0].last; });
    var out = [];
    main.concat(lastB).forEach(function (b) { b.forEach(function (it) { out.push(it.ln); }); });
    return out;
    }
    // His order rule (2026-10-19): in the Psych meds box,
    // medications FOR seizure or Parkinson's go LAST -
    // the stated indication decides ('for seizure
    // control', "for parkinson's"); everything else
    // keeps its order, and the moved lines keep theirs.
    // Display and fill value are reordered together, so
    // the note receives the same order he sees.
    var medsLast = function (txt) {
      if (!txt || txt.indexOf('\n') === -1) return txt;
      return medsOrderLines(txt.split('\n')).join('\n');
    };
    if (d.meds) d.meds = medsLast(d.meds);
    if (d.medsFill) d.medsFill = medsLast(d.medsFill);
    var row = document.getElementById(ROW_ID);
    // No data yet: the band stands (it is never removed
    // once planted - Smooth Arrival), tiles simply have
    // not presented. Nothing is torn down, ever.
    if (!d) return;
    // Publish the chart values the note is compared against
    // (engine reads tmTileChart), and read back its verdicts
    // (tmTileWarn): a topic blank in the open note or different
    // from the chart paints its tile warning-red.
    try {
      var chartVals = [d.ageSex || '', d.allergies || '', (d.medsFill !== null && d.medsFill !== undefined) ? d.medsFill : (d.meds || ''), d.rel || ''].join('|');
      // Republish on change AND every ~20s while the row
      // lives (v3.40): the verdict engine only trusts a
      // FRESH chart record, so a tile can never be painted
      // red off a previous resident's leftovers - red
      // requires this resident's own information, present
      // now. The record carries the resident's chart key
      // so verdicts are tied to this resident (see the
      // matching gate where verdicts are read below).
      if (window.__tmChartLast !== chartVals || Date.now() - (window.__tmChartTs || 0) > 20000) {
        window.__tmChartLast = chartVals;
        window.__tmChartTs = Date.now();
        localStorage.setItem('tmTileChart', JSON.stringify({ ageSex: d.ageSex || null, allergies: d.allergies || null, facCH: isCrownHeightsHere(), meds: (d.medsFill !== null && d.medsFill !== undefined) ? d.medsFill : (d.meds || null), rel: d.rel || null, bims: d.bims || null, bimsPrev: (function () { try { var sr = lastStops && lastStops.bims && lastStops.bims.series; if (sr && sr[1]) { var q = new Date(sr[1].date); if (!isNaN(q.getTime())) return sr[1].score + ' on ' + (q.getMonth() + 1) + '/' + q.getDate() + '/' + String(q.getFullYear()).slice(2); } } catch (e) {} return null; })(), readmit: (function () { try { var bx = document.getElementById('tmReadmitBox'); return !!(bx && bx.__mode === 'alert'); } catch (e) { return false; } })(), dx: d.dx || null, key: chartNumMatch() || null, ts: window.__tmChartTs }));
      }
    } catch (e) {}
    var tw = null;
    try { tw = (window.__tmCore && window.__tmCore.warn) ? window.__tmCore.warn() : JSON.parse(localStorage.getItem('tmTileWarn') || 'null'); } catch (e) {}
    if (tw && Date.now() - (tw.ts || 0) > 2 * 60000) tw = null;
    // Red requires PROOF his note is open right now
    // (his rule, 2026-10-19): the form window's engine
    // stamps tmNoteOpen while the note field exists and
    // heartbeats it; without a fresh stamp, no tile
    // paints red - even if verdicts linger from a form
    // that has since closed or never opened.
    if (tw) {
      var noteOpen = false;
      try {
        var no = (window.__tmCore && window.__tmCore.noteOpen) ? window.__tmCore.noteOpen() : JSON.parse(localStorage.getItem('tmNoteOpen') || 'null');
        // 75s, not 30s: the form window is a BACKGROUND
        // window while he reads the chart, and browsers
        // throttle background timers to ~60s - a 30s
        // window expired between heartbeats and the red
        // blinked off and on every minute (his report,
        // 2026-10-19). The window must exceed one
        // throttled tick; after the note closes, red now
        // dies within ~75s worst case (the verdict record
        // itself still expires at 2 min).
        noteOpen = !!(no && no.ts && (Date.now() - no.ts) < 75000);
      } catch (e) {}
      if (!noteOpen) tw = null;
    }
    // Verdicts are only ever painted on the resident
    // they were computed for (v3.40): the engine stamps
    // the chart key it read into its verdicts, and this
    // row ignores any verdict record keyed to another
    // resident.
    if (tw && tw.key) {
      var myKey = chartNumMatch();
      if (myKey && tw.key !== myKey) tw = null;
    }
    // SMOOTH ARRIVAL (2026-10-20, audit A1/A2/A3): the
    // band was planted once at eval (plantBand below);
    // each TILE presents once, when its OWN content has
    // settled (per-tile settle, Ear O3), at that content's
    // size, and the size is frozen at presentation. Every
    // later build updates properties in place on the SAME
    // elements - the data-sig full-rebuild path is gone.
    var specs = [];
    function mkSpec(rowN, key, label, value, opts, chip, stamp) {
      specs.push({ row: rowN, key: key, label: label, value: value || '', opts: opts || {}, chip: chip || '', stamp: stamp || '' });
    }
    // EVERY tile, ALWAYS (his rule, 2026-10-19): the row is
    // the same on every page - a tile with no data yet
    // renders empty (a muted dash) instead of vanishing.
    // Tiles are the shared <tm-tile> component now; the
    // fill contract rides on the host element, where the
    // G key and the fill engine have always looked for it.
    var admM = (d.admission || '').match(/^(.*?)(\s*\((re-entry|initial)\))?$/i);
    var admKind = admM && admM[3] ? admM[3].toLowerCase() : '';
    // CARE PROFILE LINE BAND (his ruling, 2026-10-22): the
    // seven small tiles live INSIDE the Care Profile line
    // (#residentHeaderButtons), at ONE uniform height and
    // fixed-by-kind widths - frames are decided by design,
    // never measured from content, so the line's height is
    // final at plant and no tile can grow, shrink or push
    // the page. The band tiles carry no stamp line (the
    // BIMS date rides inside its value; the relationships
    // stamp stays in the packet) - a stamp line would
    // break the uniform height. Psych meds is NOT a band
    // tile (his ruling): it presents with the row-2 block.
    mkSpec(1, 'admission', admKind ? 'Admission (' + admKind + ')' : 'Admission (re-entry)', admM ? admM[1] : (d.admission || ''), { band: 1, bandW: 166, pad: '6px 12px', size: 15 });
    mkSpec(1, 'agesex', 'Age / Sex', d.ageSex || '', { band: 1, bandW: 88, pad: '6px 12px', size: 15, warn: !!(tw && tw.age), click: { label: 'Age/Sex', value: d.ageSex || '' }, fill: { label: 'Age/Sex', value: d.ageSex || '' } });
    mkSpec(1, 'room', 'Room', d.room || '', { band: 1, bandW: 82, pad: '6px 12px', size: 15 });
    mkSpec(1, 'allergies', 'Allergies', d.allergies || '', { band: 1, bandW: 300, pad: '6px 12px', size: 13, natW: true, maxW: 300, weight: 600, color: '#a33327', fit: true, warn: !!(tw && tw.allergies), click: { label: 'Allergies', value: d.allergies || '' }, fill: { label: 'Allergies', value: d.allergies || '' } });
    mkSpec(1, 'weight', 'Weight', d.weight || '', { band: 1, bandW: 86, pad: '6px 12px', size: 15, nav: true, color: d.weightRed ? '#a33327' : undefined });
    mkSpec(1, 'bims', 'BIMS', d.bims || '', { band: 1, bandW: 176, pad: '6px 12px', size: 14, natW: true, nowrap: true, fit: true, warn: !!(tw && tw.bims), click: { label: 'BIMS', value: d.bims || '' }, fill: { label: 'BIMS', value: d.bims || '' } });
    mkSpec(1, 'rel', 'Relationships', d.rel || '', { band: 1, bandW: 196, pad: '6px 12px', size: 15, natW: true, maxW: 280, fit: true, warn: !!(tw && tw.rel), click: { label: 'Relationships', value: d.rel || '' }, fill: { label: 'Relationships', value: d.rel || '' } });
    var medsChip = String(d.meds === '- none' ? 0 : (d.meds ? d.meds.split('\n').length : 0));
    if (d.medsFill !== null && d.medsFill !== undefined) {
      mkSpec(2, 'meds', 'Psych meds', d.meds || '', { cols: true, wide: true, multi: true, size: 13, weight: 600, maxw: '920px', warn: !!(tw && tw.meds), click: { label: 'Psych meds', value: d.medsFill }, fill: { label: 'Psych meds', value: d.medsFill } }, medsChip, d.stampMeds);
    } else {
      mkSpec(2, 'meds', 'Psych meds', d.meds || '', { cols: true, wide: true, multi: true, size: 13, weight: 600, maxw: '920px', warn: !!(tw && tw.meds), delegate: 'meds' }, medsChip, d.stampMeds);
    }
    // Summary (his change-set + spec): the assembled
    // picture - his notes, the progress notes, labs for
    // his meds, weight/BIMS trends, GDR tracking. First
    // on the second line: the picture ahead of the parts.
    mkSpec(2, 'summary', 'Summary', d.summary || '', { full: true, multi: true, size: 13, weight: 600, anchorCycle: true, click: { label: 'Summary', value: d.summary || '' }, fill: { label: 'Summary', value: d.summary || '' } }, sumAnchorLabel());
    // Your words (converted from the retired Psychiatry
    // tab, his change-set): his own dictated text for this
    // resident, memory-only, edited in the panel its click
    // opens. First on the second line - his words ahead of
    // the chart's.
    mkSpec(2, 'words', 'Your words', d.words || '', { full: true, multi: true, size: 13, weight: 600, action: 'yourwords' });
    // Diagnoses + Behaviors join the row (his change-set,
    // 2026-10-19): full-line tiles under the first row,
    // fed by the packet like the others. Diagnoses carries
    // the proven fill contract (the extractor box's own
    // label); Behaviors is display-only, exactly as its
    // box is - it has never been a fill source.
    mkSpec(2, 'dx', 'Diagnoses', d.dx || '', { full: true, multi: true, warn: !!(tw && tw.dx), size: 13, weight: 600, click: { label: 'Diagnoses', value: d.dx || '' }, fill: { label: 'Diagnoses', value: d.dx || '' } }, null, d.stampDx);
    mkSpec(2, 'beh', 'Behaviors', d.beh || '', { full: true, multi: true, size: 13, weight: 600 }, null, d.stampBeh);
    // Per-tile presentation (Ear O3): a tile presents
    // when its own pipe settles - not in one row-global
    // wave. Until a tile presents it occupies no element;
    // the planted band is the reserved space.
    presentReadyTiles(specs);
    updateTiles(specs);
  }

  function specSig(sp) {
    try { return JSON.stringify([sp.label, sp.value, sp.chip, sp.stamp, sp.opts]); } catch (e) { return ''; }
  }
  function applyTile(el, sp) {
    el.label = sp.label;
    el.value = sp.value || '';
    var o = sp.opts || {};
    // A frozen tile keeps its frozen frame: later opts
    // must carry the frozen size forward, or the tile
    // would resize on its next update (audit A3).
    if (el.getAttribute('data-tm-frozen')) {
      var cur = el.opts || {};
      if (cur.frozenW) o = Object.assign({}, o, { frozenW: cur.frozenW, frozenH: cur.frozenH });
    }
    el.opts = o;
    el.chip = sp.chip || '';
    el.stamp = sp.stamp || '';
    if (o.fill) {
      el.classList.add('pcc-fill-copy');
      el.setAttribute('data-g-badge', '1');
      el.setAttribute('data-fill-label', o.fill.label);
      el.setAttribute('data-fill-value', o.fill.value);
    } else {
      el.classList.remove('pcc-fill-copy');
      el.removeAttribute('data-fill-label');
      el.removeAttribute('data-fill-value');
    }
    if (o.delegate === 'meds') el.setAttribute('data-tm-copy', '1');
    else el.removeAttribute('data-tm-copy');
  }
  function createTile(sp) {
    var el = document.createElement('tm-tile');
    el.style.display = 'contents';
    applyTile(el, sp);
    __tileReg[sp.key] = { el: el, sig: specSig(sp) };
    return el;
  }
  // The registry of presented tiles, keyed by tile kind:
  // created once at presentation, updated in place after.
  var __tileReg = {};
  function settledNow() {
    try { return !!(window.__tmCore && window.__tmCore.settled && window.__tmCore.settled()); } catch (e) { return false; }
  }
  // The band (audit A2): both row containers planted
  // ONCE, synchronously, in their final position, before
  // the gatherer's first pass - the page reserves the
  // space from the start and nothing ever shoves down.
  // DOM order is part of the layout (h145): tmCardsRow
  // (the seven band tiles, inside the Care Profile line)
  // first, tmCardsRow2 (the content block) directly
  // beneath the line.
  function plantBand() {
    try {
      var bar = document.getElementById('residentHeaderButtons');
      if (!bar || !bar.parentNode) return;
      var row = document.getElementById(ROW_ID);
      var row2 = document.getElementById('tmCardsRow2');
      // The band lives INSIDE the Care Profile line
      // (his ruling, 2026-10-22): the buttons bar becomes
      // a flex line, the Care Profile button keeps its
      // place at its left, and the band fills the dead
      // space to its right. The bar's height is set once
      // by the band's uniform tile height and never
      // changes again - nothing below the line is ever
      // pushed by a tile arriving. Placement is
      // NORMALIZED, not assumed: a row that already
      // exists anywhere else (a serialized leftover in a
      // saved page, an older build's plant) is moved into
      // the line and restyled, so the end state is the
      // same no matter what the page started with.
      if (!row) {
        row = document.createElement('div');
        row.id = ROW_ID;
      }
      if (row.parentNode !== bar) bar.appendChild(row);
      row.style.cssText = 'display:flex;gap:8px;flex-wrap:nowrap;margin:0;align-items:center;min-width:0;' +
        'font-family:-apple-system,Helvetica,Arial,sans-serif;';
      bar.style.display = 'flex';
      bar.style.alignItems = 'center';
      bar.style.flexWrap = 'nowrap';
      bar.style.gap = '10px';
      if (!row2) {
        row2 = document.createElement('div');
        row2.id = 'tmCardsRow2';
      }
      if (isDashDoc()) {
        // DASH PLACEMENT (his ruling, 2026-10-22): the
        // content tiles (meds, summary, words, behaviors,
        // diagnoses) live on the Dash, below the View
        // button's bar. The anchor is the green bar PCC
        // puts its Printable View button in - the View
        // toggle takes that button's place, so the row
        // lands under the toggle either way. Until the
        // bar's furniture exists, the row waits directly
        // after the header bar; a later pass moves it
        // (same element, tiles and all) into place.
        row2.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;margin:0 0 4px;align-items:flex-start;' +
          'font-family:-apple-system,Helvetica,Arial,sans-serif;';
        var anchor = dashViewAnchor() || bar;
        if (row2.parentNode !== anchor.parentNode || anchor.nextSibling !== row2) {
          anchor.parentNode.insertBefore(row2, anchor.nextSibling);
        }
      } else {
        // OFF THE DASH (same ruling): the row is removed
        // from the header - it stays in the document but
        // hidden, so the tiles keep presenting into it
        // and their fill contracts stay live for the G
        // bridge (queueHiddenTileFills). Nothing shows.
        row2.style.cssText = 'display:none;';
        if (row2.parentNode !== bar.parentNode || bar.nextSibling !== row2) {
          bar.parentNode.insertBefore(row2, bar.nextSibling);
        }
      }
    } catch (e) {}
  }
  function isDashDoc() {
    try { return /cp_residentdashboard/i.test(location.pathname || ''); } catch (e) { return false; }
  }
  function dashViewAnchor() {
    var pv = document.getElementById('idPrintableViewBtn');
    if (!pv) {
      var cands = document.querySelectorAll('input, button, a');
      for (var i = 0; i < cands.length; i++) {
        var lab = (cands[i].value || cands[i].textContent || '').trim();
        if (lab === 'Printable View') { pv = cands[i]; break; }
      }
    }
    if (!pv || !pv.parentNode) return null;
    var t = pv.closest ? pv.closest('table') : null;
    return t || pv.parentNode;
  }
  // G BRIDGE (his Dash ruling, 2026-10-22): off the
  // Dash, the content tiles are hidden, so the grab
  // sweep cannot click them. On a G press, queue the
  // fill-carrying tiles' contracts straight from the
  // tiles themselves - the same label + value a click
  // would queue - so G and the note fill keep working
  // from every tab. (Words opens its panel and
  // Behaviors carries no fill; neither has a contract
  // to bridge.)
  function queueHiddenTileFills() {
    if (isDashDoc()) return;
    ['meds', 'summary', 'dx'].forEach(function (key) {
      var reg = __tileReg[key];
      var el = reg && reg.el;
      if (!el) return;
      var label = el.getAttribute('data-fill-label');
      var value = el.getAttribute('data-fill-value');
      if (!label || !value || value === 'N/A') return;
      queueCopy(label, value);
    });
  }
  // PER-TILE SETTLE (Ear O3, his ruling 2026-10-20): a
  // tile presents itself ONCE, at the size its SETTLED
  // content needs - it does not pre-appear as a packet-
  // settle placeholder that later has to stretch (the
  // meds + summary clips). Each tile kind has its own
  // settle: the native landing of its pipe, or the packet
  // settle when it holds only a copy / nothing. Two kinds
  // settle later than the packet by design:
  // - Psych meds, when a Dash panel exists: the panel is
  //   its pipe - it settles when THIS load's dashboard
  //   pass writes the panel (the pass stamps the box,
  //   exactly as it stamps the Copy button's fill value).
  //   With no panel in any doc, the packet's meds pipes
  //   rule (dashmeds / header list landed = ready; else
  //   the packet settle).
  // - Summary: its settle is its COMPOSITION's settle:
  //   it presents only when every stop the composer
  //   reads has resolved - the first moment its text
  //   can no longer change (fix rounds 3-4, tileReady).
  // A DEFAULT tile whose pipe never lands still presents
  // eventually: at the first build AFTER the settle build
  // (fallback), holding whatever it holds then - a late
  // honest presentation beats a vanished tile. The two
  // CONTENT-GATED tiles (meds, summary) are exempt from
  // the fallback (Ear O3 residual; adrian's ruling
  // 2026-10-20, "gated tiles present only at their own
  // settle"): the fallback presented them EMPTY at dash
  // size and their real content then clipped inside that
  // frame for the rest of the page view. They present
  // only when their own ready condition fires - and if
  // it never fires on a page view, the tile stays absent
  // (his explicit choice over a wrong-sized tile).
  var __bandSwept = false;
  var __settleObserved = false;
  // Row 1 is the Care Profile line band (uniform height,
  // fixed widths - see buildCards). Row 2 is the content
  // block beneath it: meds first, then the full-line tiles.
  var BAND_H = 72;
  var ROW_KEYS = { 1: ['admission', 'agesex', 'room', 'allergies', 'weight', 'bims', 'rel'],
                   2: ['meds', 'summary', 'words', 'beh', 'dx'] };
  function stopLanded(k) {
    var s = lastStops && lastStops[k];
    return !!(s && s.status === 'landed');
  }
  // The stops the Summary composer actually reads,
  // derived from summary.js (fix round 3): hisnotes,
  // behaviors, header (the admission anchor), bims,
  // diagnoses, labs, orders. Relations / weights /
  // dashmeds are never read there.
  var SUMMARY_INPUTS = ['hisnotes', 'behaviors', 'header', 'bims', 'diagnoses', 'labs', 'orders'];
  // A stop has RESOLVED when it carries any status but
  // the initial 'not-loaded' - 'landed' today, or a
  // terminal failure status if a pipe ever stamps one.
  function stopResolved(k) {
    var s = lastStops && lastStops[k];
    return !!(s && s.status && s.status !== 'not-loaded');
  }
  function medsPanelSettled() {
    var docs = allDocs();
    for (var i = 0; i < docs.length; i++) {
      var box = docs[i].getElementById('medListBox');
      if (box && box.hasAttribute('data-tm-meds-settled')) return true;
    }
    return false;
  }
  function tileReady(sp, fallback) {
    if (sp.key === 'meds') {
      // Gated (his ruling 2026-10-20): the fallback never
      // presents this tile - only its own settle does.
      var p = medsPanel();
      if (p && p.box) return medsPanelSettled();
      if (stopLanded('dashmeds')) return true;
      if (lastStops && lastStops.header && lastStops.header.medsList) return true;
      return settledNow();
    }
    if (sp.key === 'summary') {
      // Gated (his ruling 2026-10-20): no fallback. The
      // gate is the FINALITY of the composition. Round 3
      // (Ear O3-remainder, ear-diagW) replaced the old
      // stop-list gate - which fired on stops that settle
      // nothing (diagnoses alone composes ""; relations
      // is never read) and presented the tile EMPTY at
      // dash size - with a composition gate, but its
      // branch (a), "present when the composed text is
      // non-empty," still fired on an INTERMEDIATE text:
      // Ear's ear-attack-a landed behaviors first, which
      // composes a non-empty trend-only text, so the
      // tile presented and froze at that size (551x143);
      // when hisnotes landed and the med-change lead
      // prepended, the settled composition (447 chars,
      // 812x204) clipped inside the frozen frame for the
      // whole page view. A non-empty composition is not
      // a SETTLED composition (fix round 4, h166). The
      // invariant, Ear's wording: a gated tile presents
      // when its content is FINAL - no earlier trigger of
      // any kind. For Summary that is exactly one
      // condition: the packet has settled AND every
      // composer-input stop has RESOLVED (landed, or a
      // terminal status if a pipe ever stamps one). The
      // composer can then read nothing more, so the text
      // buildCards composed into sp.value is final -
      // the full summary, or genuinely "" (which still
      // presents, once, at its settled empty size).
      if (!settledNow()) return false;
      return SUMMARY_INPUTS.every(function (k) { return stopResolved(k); });
    }
    return settledNow() || fallback;
  }
  function keyOfTileEl(el) {
    var ks = Object.keys(__tileReg);
    for (var i = 0; i < ks.length; i++) if (__tileReg[ks[i]].el === el) return ks[i];
    return '';
  }
  function insertTileInOrder(host, el, sp) {
    var order = ROW_KEYS[sp.row] || [];
    var myIdx = order.indexOf(sp.key);
    var kids = host.querySelectorAll('tm-tile');
    for (var i = 0; i < kids.length; i++) {
      if (order.indexOf(keyOfTileEl(kids[i])) > myIdx) { host.insertBefore(el, kids[i]); return; }
    }
    host.appendChild(el);
  }
  // ---- Sizing (2.9.1, his live verdict 2026-10-21) ----
  // 2.9.0 froze each tile at the size it RENDERED inside
  // the flex row - which is the row's geometry, not the
  // content's: row 1 stretches every card to the tallest
  // sibling (align-items default) and flex-grow inflates
  // the wide/full tiles, so one-line tiles froze as tall
  // empty boxes and meds froze wider than the allergies
  // box ("all the tiles should be small, except
  // allergies"). And because the freeze landed a beat
  // after insertion, the growth was VISIBLE ("i just
  // don't want to watch it grow"). The derivation is now
  // content-first: a tile's frame is measured OFF-FLOW
  // from its own settled spec (below), the real tile is
  // BORN at that frame (absent -> final, one step), and
  // the frame is identical no matter when its neighbours
  // present (order-independence). The rows also carry
  // align-items:flex-start now, so nothing stretches a
  // presented tile.
  // The wrap each kind measures at: Allergies keeps its
  // fixed 300px box (the biggest tile, his ruling); the
  // capped kinds wrap at a readable cap instead of
  // stretching to their longest line; the rest measure
  // at max-content (the content's own width).
  function measureWrapCss(sp) {
    if (sp.key === 'allergies') return 'width:300px;';
    if (sp.key === 'summary') return 'width:max-content;max-width:640px;';
    if (sp.key === 'words' || sp.key === 'dx' || sp.key === 'beh') return 'width:max-content;max-width:720px;';
    if (sp.key === 'meds') return 'width:max-content;max-width:920px;';
    return 'width:max-content;';
  }
  // Measure a tile's settled content off-flow: a scratch
  // tm-tile carrying the tile's own spec, laid out in a
  // hidden host positioned off-screen, where no flex row
  // can stretch or grow it. The lines are fitted first
  // (the 2.9.0 order: fit, then measure), then the card
  // box is read. done([w, h]) or done(null) if the card
  // never renders a size (the tile then stays absent and
  // a later build retries - absent over wrong-sized).
  function measureTile(sp, done) {
    var host = document.createElement('div');
    host.setAttribute('data-tm-measure', '1');
    host.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden;' + measureWrapCss(sp);
    var t = document.createElement('tm-tile');
    t.style.display = 'contents';
    t.label = sp.label; t.value = sp.value || ''; t.opts = sp.opts || {};
    t.chip = sp.chip || ''; t.stamp = sp.stamp || '';
    host.appendChild(t);
    document.body.appendChild(host);
    var finished = false, tries = 0;
    function finish(size) {
      if (finished) return;
      finished = true;
      try { host.remove(); } catch (e) {}
      done(size);
    }
    function read() {
      try { fitAllergies(t); } catch (e) {}
      try { fitMeds(t); } catch (e) {}
      var card = t.querySelector('[data-tm-card]');
      var wpx = card ? (card.offsetWidth || 0) : 0;
      var hpx = card ? (card.offsetHeight || 0) : 0;
      if (wpx > 0 && hpx > 0) { finish([wpx, hpx]); return; }
      if (++tries > 12) { finish(null); return; }
      if (window.requestAnimationFrame) requestAnimationFrame(read);
      else setTimeout(read, 30);
    }
    if (t.updateComplete && t.updateComplete.then) t.updateComplete.then(function () { if (window.requestAnimationFrame) requestAnimationFrame(read); else setTimeout(read, 30); });
    else if (window.requestAnimationFrame) requestAnimationFrame(read);
    else setTimeout(read, 30);
  }
  var __tileMeasuring = {}; // key -> true while its off-flow measure is in flight
  var __lastSpecs = null;    // the freshest spec set (a landing can land mid-measure)
  function presentReadyTiles(specs) {
    plantBand();
    var row = document.getElementById(ROW_ID);
    var row2 = document.getElementById('tmCardsRow2');
    if (!row || !row2) return;
    __lastSpecs = specs;
    if (!__bandSwept) {
      __bandSwept = true;
      // Anything already inside the rows at the first
      // build can only be a leftover (a serialized
      // capture's stale tiles) - live tiles are all in
      // the registry, and none exist yet.
      [row, row2].forEach(function (r) {
        Array.from(r.querySelectorAll('tm-tile')).forEach(function (t) { t.remove(); });
      });
    }
    var settled = settledNow();
    var fallback = settled && __settleObserved;
    if (settled) __settleObserved = true;
    specs.forEach(function (sp) {
      if (__tileReg[sp.key] || __tileMeasuring[sp.key]) return;
      if (!tileReady(sp, fallback)) return;
      if (sp.opts && sp.opts.band) {
        // Band tiles are BORN at their designed frame
        // (fixed width by kind, BAND_H for every tile) -
        // no measuring, no freeze race, no growth: the
        // frame is known before the content exists.
        var bpres = Object.assign({}, sp, { opts: Object.assign({}, sp.opts, { frozenW: sp.opts.bandW, frozenH: BAND_H }) });
        var bel = createTile(bpres);
        bel.setAttribute('data-tm-frozen', '1');
        __tileReg[sp.key].sig = specSig(sp);
        var br1 = document.getElementById(ROW_ID);
        var br2 = document.getElementById('tmCardsRow2');
        if (br1 && br2) insertTileInOrder(br1, bel, sp);
        scheduleFit(sp.key, bel);
        return;
      }
      __tileMeasuring[sp.key] = true;
      measureTile(sp, function (size) {
        delete __tileMeasuring[sp.key];
        if (!size || __tileReg[sp.key]) return;
        // The spec may have moved while the measure was
        // in flight (a landing in the same burst). If so,
        // do not present at the stale size: the tile has
        // never been seen, so re-running the build with
        // the fresher spec keeps the one-step law - the
        // tile still presents exactly once, at its
        // settled content's size.
        var fresh = null;
        (__lastSpecs || []).forEach(function (s2) { if (s2.key === sp.key) fresh = s2; });
        if (fresh && specSig(fresh) !== specSig(sp)) { buildCards(); return; }
        var pres = Object.assign({}, sp, { opts: Object.assign({}, sp.opts, { frozenW: size[0], frozenH: size[1] }) });
        var el = createTile(pres);
        el.setAttribute('data-tm-frozen', '1');
        __tileReg[sp.key].sig = specSig(sp); // registry tracks the BARE spec (updateTiles compares bare sigs)
        var r1 = document.getElementById(ROW_ID);
        var r2 = document.getElementById('tmCardsRow2');
        if (r1 && r2) insertTileInOrder(sp.row === 2 ? r2 : r1, el, sp);
        scheduleFit(sp.key, el);
      });
    });
  }
  // Post-presentation line fitting only: the meds column
  // lines / allergies text shrink to the frame if they
  // overflow it. The frame itself is already final -
  // fitting never resizes the tile, it fits the text
  // INSIDE the frame.
  function scheduleFit(key, el) {
    if (!el) return;
    var fitIt = function () {
      if (key === 'allergies') fitAllergies(el);
      if (key === 'meds') fitMeds(el);
    };
    if (window.requestAnimationFrame) requestAnimationFrame(function () { requestAnimationFrame(fitIt); });
    else setTimeout(fitIt, 60);
  }
  function updateTiles(specs) {
    specs.forEach(function (sp) {
      var reg = __tileReg[sp.key];
      if (!reg) return; // not its settle yet - presentation is gated above
      var s = specSig(sp);
      if (s === reg.sig) return;
      reg.sig = s;
      applyTile(reg.el, sp);
    });
  }

  // ---------- Face Sheet button on the Dash (v3.18) ----------
  // His ask (2026-10-19): the Profile carries PCC's yellow
  // Face Sheet button (the report that opens as a PDF);
  // he wants the same button on the Dash - yellow, same
  // document icon, and F opens it. The label is exactly
  // 'Face Sheet' so the Keys scripts' existing F finder
  // (which searches every frame for that text) clicks it
  // with zero Keys changes. A click copies the REAL
  // report URL out of the Profile page's own button -
  // facility-proof, since the name and report differ by
  // facility but the Profile button always knows.
  var faceUrlCache = '';
  function addFaceSheetButton(bar, row) {
    try {
      if (location.pathname.indexOf('cp_residentdashboard') === -1) return; // the Dash only
      // His order on the header's first line (2026-10-19):
      // picture, name, chart number, Face Sheet, F. So the
      // button goes IN THE FLOW, as the next thing after
      // the name element in the header's row - not floated
      // by coordinates (v3.29 anchored to a hidden copy of
      // the name and landed before the picture). The name
      // element chosen is the VISIBLE one; insertion climbs
      // to the header row's flex container and seats the
      // button right after the child holding the name.
      var nameEl = null;
      var els = document.querySelectorAll('span, div, h1, h2, h3, td, a, b, strong');
      for (var i = 0; i < els.length; i++) {
        var tx = (els[i].textContent || '').replace(/\s+/g, ' ').trim();
        if (tx.length > 70 || tx.length < 5) continue;
        if (/^clinical\s/i.test(tx)) continue;
        if (!/^[A-Za-z][A-Za-z'’.\-]+(?:\s+[A-Za-z][A-Za-z'’.\-]+)?\s*,\s*[A-Za-z][A-Za-z'’.\- ]+?\s*\(\s*[A-Za-z]{0,5}\d{3,}\s*\)/.test(tx)) continue;
        var r = els[i].getBoundingClientRect();
        if (!r || r.width < 50) continue; // visible copies only
        nameEl = els[i];
        break;
      }
      if (!nameEl) return;
      var seat = nameEl, hops = 0;
      while (seat.parentNode && hops < 4) {
        var p = seat.parentNode;
        if (!p || p.nodeType !== 1 || p.tagName === 'BODY' || p.tagName === 'HTML') break;
        var disp = '';
        try { disp = getComputedStyle(p).display; } catch (e3) {}
        if (disp === 'flex' || disp === 'inline-flex') break; // seat is the flex child holding the name
        seat = p; hops++;
      }
      // If the climb found no flex row, seat stays at the
      // deepest element whose parent is a real container:
      // walk back down is unnecessary - insert after the
      // highest climbed element that still has an element
      // parent, else after the name itself.
      while (seat && seat !== nameEl && (!seat.parentNode || seat.parentNode.nodeType !== 1)) seat = seat.firstElementChild || nameEl;
      var host = seat.parentNode;
      if (!host) { seat = nameEl; host = nameEl.parentNode; }
      if (!host) return;
      var btn = document.getElementById('tmFaceBtn');
      if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'tmFaceBtn';
        btn.setAttribute('data-tooltip', 'Face Sheet Report');
        btn.innerHTML = '<svg aria-hidden="true" style="width:18px;height:18px;flex-shrink:0;margin-right:4px;" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.833 1.83301L18.333 7.33301V18.333C18.333 19.3413 17.5083 20.167 16.5 20.167H5.49121C4.48288 20.167 3.66699 19.3413 3.66699 18.333L3.67578 3.66699C3.67578 2.65866 4.49167 1.83301 5.5 1.83301H12.833ZM7.33301 14.667V16.5H14.667V14.667H7.33301ZM7.33301 11V12.833H14.667V11H7.33301ZM11.917 8.25H16.958L11.917 3.20801V8.25Z" fill="currentColor"></path></svg>Face Sheet';
        btn.addEventListener('click', function () { openFaceSheet(); });
      }
      btn.style.cssText = 'position:static;background:linear-gradient(135deg,#fef9c3,#fde68a);border:2px solid #eab308;border-radius:6px;padding:4px 8px;box-shadow:0 2px 8px rgba(234,179,8,.4);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;font-size:15px;font-weight:600;color:#1c2430;cursor:pointer;display:inline-flex;align-items:center;gap:2px;margin-left:14px;vertical-align:middle;flex:none;align-self:center;';
      if (btn.previousElementSibling !== seat || btn.parentNode !== host) {
        host.insertBefore(btn, seat.nextSibling);
      }
    } catch (e) {}
  }
  function openFaceSheet() {
    if (faceUrlCache) { window.open(faceUrlCache, '_blank'); return; }
    var a = document.querySelector('a[href*="cp_careclientprofile"]');
    if (!a) return;
    fetch(a.href, { credentials: 'include' }).then(function (r) { return r.text(); }).then(function (html) {
      var m = /admissionRecord\.xhtml\?[^'"<\s]+/.exec(html.replace(/&amp;/g, '&'));
      if (!m) return;
      faceUrlCache = '/reporting/setup/runtime/' + m[0];
      window.open(faceUrlCache, '_blank');
    }).catch(function () {});
  }


  // The Allergies box is always the same size; a long allergy list
  // shrinks its text until it fits the box (his spec, 2026-10-14).
  // Starts from the shared value size (21px, same as every other
  // tile) and steps down only as far as needed.
  function fitAllergies(row) {
    var els = row.querySelectorAll('[data-fit="1"]');
    for (var k = 0; k < els.length; k++) {
      var el = els[k];
      var size = 21;
      el.style.fontSize = size + 'px';
      var guard = 0;
      while (guard < 14 && size > 10 && (el.scrollHeight > 56 || el.scrollWidth > el.clientWidth)) {
        size -= 1;
        el.style.fontSize = size + 'px';
        guard++;
      }
    }
  }

  // Meds one-line fit: step the tile's font down until
  // every medication line fits its column whole. A line
  // still too wide at the floor is allowed to wrap -
  // better wrapped than cut off.
  function fitMeds(row) {
    var boxes = row.querySelectorAll('[data-medsfit="1"]');
    for (var b = 0; b < boxes.length; b++) {
      var lines = boxes[b].querySelectorAll('.tmMedLine');
      if (!lines.length) continue;
      var size = parseFloat(lines[0].style.fontSize) || 13;
      var guard = 0;
      var over = function () {
        for (var i = 0; i < lines.length; i++) {
          if (lines[i].scrollWidth > lines[i].clientWidth + 2) return true;
        }
        return false;
      };
      while (guard < 5 && size > 10 && over()) {
        size -= 1;
        for (var j = 0; j < lines.length; j++) lines[j].style.fontSize = size + 'px';
        guard++;
      }
      if (over()) {
        for (var k = 0; k < lines.length; k++) {
          if (lines[k].scrollWidth > lines[k].clientWidth + 2) lines[k].style.whiteSpace = 'normal';
        }
      }
    }
  }

  // ---------- per-tab tiles, IN the tile row ----------
  // His correction (2026-10-14 18:21): the BIMS and Relationships
  // tiles belong IN the tile row (next to Weight), not down in the
  // tab content. The boxes live in other frames, so the values are
  // read across frames; the tiles join the row when he is on that
  // tab. Every data tile is copyable (click = copy + queue, G too).
  function allDocs() {
    var docs = [];
    (function walk(w) {
      try { docs.push(w.document); } catch (e) { return; }
      for (var i = 0; i < w.frames.length; i++) walk(w.frames[i]);
    })(window.top || window);
    return docs;
  }
  function crossValue(fn) {
    var docs = allDocs();
    for (var i = 0; i < docs.length; i++) { var v = fn(docs[i]); if (v) return v; }
    return '';
  }
  function bimsValue() {
    var bv = crossValue(function (doc) {
      var box = doc.getElementById('custom-bims-badge');
      if (!box) return '';
      var btn = box.querySelector('.pcc-fill-copy');
      if (btn && btn.getAttribute('data-fill-value')) return btn.getAttribute('data-fill-value');
      var vv = box.querySelector('.bims-value');
      return vv ? (vv.textContent || '').trim() : '';
    });
    // 'N/A' is the badge's word for "none in this view"
    // (the list is filtered) - it is not a score. The
    // gathered last BIMS outranks it (2026-10-19: on the
    // ASSMNTS page filtered to Psych: Consult, the tile
    // showed N/A while the packet held 13 on 9/10/26).
    if (bv && bv !== 'N/A') return bv;
    if (feedBims) return feedBims;
    return scopedFeed('tmBimsFor:');
  }
  // The Gatherer's scoped feeds (tmRelFor:/tmBimsFor:),
  // keyed by a resident token (chart number, or the
  // session EID as fallback). Accept a stored value
  // only when its token provably belongs to THIS page:
  // the token must appear in the page's text or in one
  // of its links. No name-shape guessing (v3.13 - the
  // strict header regex missed real headers).
  function scopedFeed(prefix) {
    try {
      var hrefs = '';
      var as = document.querySelectorAll('a[href]');
      for (var ai = 0; ai < as.length; ai++) hrefs += ' ' + (as[ai].getAttribute('href') || '');
      var bodyT = (document.body && document.body.textContent) || '';
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k || k.indexOf(prefix) !== 0) continue;
        var token = k.slice(prefix.length).replace(/^(chart|eid):/, '');
        if (!token || token.length < 4) continue;
        if (bodyT.indexOf(token) === -1 && hrefs.indexOf(token) === -1) continue;
        var f = JSON.parse(localStorage.getItem(k) || 'null');
        if (f && f.value && Date.now() - (f.ts || 0) < 24 * 3600 * 1000) return String(f.value);
      }
    } catch (e) {}
    return '';
  }
  // The Gatherer's same-document feed (v3.14): values
  // gathered in THIS document, for THIS resident, held
  // in memory - no storage keys to mismatch.
  var feedRel = '', feedBims = '', feedMeds = '', feedDx = '', feedBeh = '';
  var feedStampRel = '', feedStampBims = '', feedStampMeds = '', feedStampDx = '', feedStampBeh = '';
  // The stamp (packet contract rule 2): a value shown away
  // from its home room is a labeled copy - source + the
  // time it was read, on the tile's face. A native read
  // viewed in its own room needs no label. A weak read
  // always says so.
  function stampOf(stop, homeRe) {
    if (!stop || stop.status !== 'landed' || !stop.at) return '';
    if (stop.strength === 'native' && homeRe.test(location.href)) return '';
    var m = /^(\d{1,2}):(\d{2})/.exec(stop.at);
    var t = stop.at;
    if (m) { var h = parseInt(m[1], 10); t = ((h % 12) || 12) + ':' + m[2] + ' ' + (h >= 12 ? 'PM' : 'AM'); }
    return (stop.strength === 'weak' ? 'weak read · ' : '') + (stop.source || 'Packet') + ' · ' + t;
  }
  // Pull, don't just listen (v3.16): the Gatherer runs
  // BEFORE this script, so its first feed event fires
  // before this listener exists and is lost - BIMS only
  // survived because its fetch lands seconds later. The
  // packet node in the page is the shared truth; read
  // it directly at start and on every gather update.
  // One render per burst (v3.40): during a gather, the
  // feeds land stop by stop and every landing used to
  // rebuild the whole row on its own timer - tiles
  // popping in one by one, the row re-laying-out under
  // his eyes ('loading sloppily'). Triggers now feed a
  // single trailing render: a burst collapses into one
  // build once it settles (300ms), and a burst that
  // runs long still renders at least every ~1.2s. The
  // row appears once, together.
  var buildTimer = null, burstAt = 0;
  function scheduleBuild() {
    var now = Date.now();
    if (!burstAt) burstAt = now;
    if (buildTimer) clearTimeout(buildTimer);
    var wait = (now - burstAt > 1200) ? 0 : 300;
    buildTimer = setTimeout(function () {
      buildTimer = null; burstAt = 0;
      buildCards(); renderReadmitChip(); renderHighChip();
    }, wait);
  }

  var lastStops = null;
  function pullFromPacket(fromSettleEvent) {
    try {
      // Settle-then-render (contract rule 4): once the load
      // has settled, packet VALUES are frozen at the settled
      // snapshot - timed pulls may still plant the row if it
      // doesn't exist yet, but values change only when the
      // pull rides a settle signal (the gated tm-gather-update
      // event). Arrivals after the settle converge into the
      // packet silently and show at the next settle.
      if (!fromSettleEvent && window.__tmCore && window.__tmCore.settled && window.__tmCore.settled()) return;
      var n = document.getElementById('tmGatherPacket');
      try { var pk = JSON.parse((n && n.textContent) || '{}'); if (pk && pk.stops) lastStops = pk.stops; } catch (e) {}
      if (!n) return;
      var pkt = JSON.parse(n.textContent || '{}');
      if (!pkt.stops) return;
      var changed = false;
      var rel = pkt.stops.relations;
      if (rel && rel.status === 'landed' && rel.summary && rel.summary !== feedRel) { feedRel = rel.summary; changed = true; }
      var b = pkt.stops.bims;
      if (b && b.status === 'landed' && b.series && b.series[0]) {
        var d = new Date(b.series[0].date);
        if (!isNaN(d.getTime())) {
          var bl = b.series[0].score + ' on ' + (d.getMonth() + 1) + '/' + d.getDate() + '/' + String(d.getFullYear()).slice(2);
          if (bl !== feedBims) { feedBims = bl; changed = true; }
        }
      }
      var hd = pkt.stops.header;
      if (hd && hd.status === 'landed' && hd.medsList) {
        if (hd.medsList !== feedMeds) { feedMeds = hd.medsList; changed = true; }
      }
      // Dash view only (his rule): a curated list from
      // the header scrape or the Gatherer's dashmeds stop
      // - never raw order names.
      var dm = pkt.stops.dashmeds;
      if (!(hd && hd.medsList) && dm && dm.status === 'landed' && dm.lines) {
        if (dm.lines !== feedMeds) { feedMeds = dm.lines; changed = true; }
      }
      var dxs = pkt.stops.diagnoses;
      if (dxs && dxs.status === 'landed' && dxs.summary && dxs.summary !== feedDx) { feedDx = dxs.summary; changed = true; }
      var bhs = pkt.stops.behaviors;
      if (bhs && bhs.status === 'landed' && bhs.summary && bhs.summary !== feedBeh) { feedBeh = bhs.summary; changed = true; }
      feedStampRel = stampOf(rel, /careclientprofile/);
      feedStampBims = stampOf(b, /cp_assessment|assessments/);
      feedStampMeds = stampOf((hd && hd.medsList) ? hd : dm, /cp_residentdashboard|res_medications/);
      feedStampDx = stampOf(dxs, /progressnotes/);
      feedStampBeh = stampOf(bhs, /progressnotes/);
      if (changed) scheduleBuild();
    } catch (e) {}
  }
  document.addEventListener('tm-gather-update', function () { pullFromPacket(true); });
  // Instant, not eventual (v3.25): the Gatherer (script 1)
  // has usually ALREADY published the resident's stored
  // packet into the page before this script (3) runs -
  // so pull immediately, then on two early passes, instead
  // of first looking at 1200ms. That wait was the whole
  // lag for Relationships and the feed-fed Psych meds;
  // BIMS only looked instant because its older storage
  // path happened to hit at the first build.
  pullFromPacket();
  setTimeout(pullFromPacket, 300);
  setTimeout(pullFromPacket, 900);
  setTimeout(pullFromPacket, 3500);
  document.addEventListener('tm-yourwords', function () { scheduleBuild(); });
  document.addEventListener('tm-gather-feed', function (e) {
    var d = (e && e.detail) || {};
    var changed = false;
    if (d.rel && d.rel !== feedRel) { feedRel = d.rel; changed = true; }
    if (d.bims && d.bims !== feedBims) { feedBims = d.bims; changed = true; }
    if (d.meds && d.meds !== feedMeds) { feedMeds = d.meds; changed = true; }
    if (changed) scheduleBuild();
  });
  function relValue() {
    var v = crossValue(function (doc) {
      var btn = doc.getElementById('relCopyBtn');
      return btn ? (btn.getAttribute('data-fill-value') || '') : '';
    });
    if (v) return v;
    if (feedRel) return feedRel;
    return scopedFeed('tmRelFor:');
  }

  // The resident's chart number as a one-element match
  // array, from the header name element only (see the
  // flag script's chartId for why first-paren-anywhere
  // is poison: it found '929' on the assessments list).
  // Crown Heights detection (his allergies rule,
  // 2026-10-22): the same short-element scan the
  // Gatherer uses for the room line - a small element
  // carrying the facility name. Published on the chart
  // record (facCH) so the verdict engine, which runs
  // in the form window, can honor the rule there.
  function isCrownHeightsHere() {
    try {
      var els = document.querySelectorAll('select, button, a, span, div, td');
      for (var i = 0; i < els.length; i++) {
        var tx = (els[i].textContent || '').trim();
        if (tx.length > 90 || tx.length < 6) continue;
        if (/crown\s*heights/i.test(tx)) return true;
      }
    } catch (e) {}
    return false;
  }

  function chartNumMatch() {
    try { var _cd = window.__tmCore && window.__tmCore.chartDigits(); if (_cd) return _cd; } catch (e) {}
    try {
      var els = document.querySelectorAll('span, div, h1, h2, h3, td, a, b, strong');
      for (var i = 0; i < els.length; i++) {
        var tx = (els[i].textContent || '').replace(/\s+/g, ' ').trim();
        if (tx.length > 70 || tx.length < 5) continue;
        if (/^clinical\s/i.test(tx)) continue;
        var em = tx.match(/^[A-Za-z][A-Za-z'’.\-]+(?:\s+[A-Za-z][A-Za-z'’.\-]+)?\s*,\s*[A-Za-z][A-Za-z'’.\- ]+?\s*\(\s*[A-Za-z]{0,5}(\d{3,})\s*\)/);
        if (em) return em[1];
      }
    } catch (e) {}
    return '';
  }

  // READMISSION chip beside the G button (his ask, 2026-10-14: he
  // loves the warning — move it next to G). The flag script keeps
  // its own box (the consult defaults read that box), and publishes
  // a note keyed to resident + re-entry date; when the note matches
  // THIS resident, the same bright-red warning shows here.
  // SMOOTH ARRIVAL (audit A4): the two alert chips live
  // in RESERVED SLOTS in the G button's own cluster. The
  // slots plant in the same pass as the G button, at a
  // fixed width that fits the widest chip, and never
  // appear or disappear for the life of the page - only
  // their CONTENT settles in or clears, so a chip landing
  // moves nothing beside it.
  function plantChipSlots() {
    var g = document.getElementById('tmGBtn');
    if (!g || !g.parentNode) return;
    // Chip slots sit in the bar AFTER the band row (the
    // row itself is buttons-then-tiles only, his
    // 2026-10-22 order). On a page with no band row they
    // keep their legacy place, right after the G button.
    var barEl = document.getElementById('residentHeaderButtons');
    var rowEl = document.getElementById(ROW_ID);
    var afterRow = !!(barEl && rowEl && rowEl.parentNode === barEl);
    function plantSlot(el) {
      if (afterRow) barEl.insertBefore(el, rowEl.nextSibling);
      else g.parentNode.insertBefore(el, g.nextSibling);
    }
    if (!document.getElementById('tmHighSlot')) {
      var hs = document.createElement('span');
      hs.id = 'tmHighSlot';
      // Fixed height, overflow clipped (Ear O2): the slot
      // reserves the chip's full space from the start, so
      // a chip landing - however long its text - can never
      // grow the header bar.
      hs.style.cssText = 'display:inline-block;width:210px;height:38px;overflow:hidden;vertical-align:middle;';
      plantSlot(hs);
    }
    if (!document.getElementById('tmReadmitSlot')) {
      var rs = document.createElement('span');
      rs.id = 'tmReadmitSlot';
      rs.style.cssText = 'display:inline-block;width:210px;height:38px;overflow:hidden;vertical-align:middle;';
      plantSlot(rs);
    }
  }
  function renderReadmitChip() {
    plantChipSlots();
    var g = document.getElementById('tmGBtn');
    var slot = document.getElementById('tmReadmitSlot');
    var old = slot ? slot.firstElementChild : null;
    var note = null;
    try { note = JSON.parse(localStorage.getItem('tmReadmitNote') || 'null'); } catch (e) {}
    var show = false;
    var chipMode = '';
    // The flag script's verdict record (v1.7) outranks
    // the legacy note: an 'ok' or 'new' verdict for THIS
    // resident + re-entry date suppresses the chip even
    // if an old note survives somewhere.
    var verdict = null;
    try { verdict = JSON.parse(localStorage.getItem('tmReadmitVerdict') || 'null'); } catch (e) {}
    if (verdict && verdict.id && g) {
      var idm0 = chartNumMatch();
      var adm0 = selfData().admission || '';
      var cur0 = adm0.replace(/\s*\((re-entry|initial)\)/i, '');
      if (idm0 && idm0 === verdict.id && cur0 === verdict.reentry) {
        show = verdict.verdict === 'readmit' || verdict.verdict === 'new';
        chipMode = verdict.verdict;
        note = null; // decided - do not fall through to the note
      }
    }
    if (note && note.id && g) {
      var idm = chartNumMatch();
      var adm = selfData().admission || '';
      var curDate = adm.replace(/\s*\((re-entry|initial)\)/i, '');
      show = !!idm && idm === note.id && curDate === note.date;
    }
    if (!show) { if (slot) slot.textContent = ''; return; }
    if (old && old.getAttribute('data-mode') === chipMode) return;
    if (slot) slot.textContent = '';
    var chip = document.createElement('span');
    chip.id = 'tmReadmitChip';
    chip.setAttribute('data-mode', chipMode);
    if (chipMode === 'new') {
      // NEW ADMISSION (his ask, 2026-10-19): no previous
      // psych forms/notes - an informational green chip,
      // same place and shape as READMISSION, no alarm.
      chip.textContent = 'NEW ADMISSION';
      chip.style.cssText = 'display:inline-block;margin-left:10px;padding:5px 14px;background:#059669;color:#fff;' +
        'border:3px solid #6ee7b7;border-radius:8px;' +
        'font:800 15px -apple-system,Helvetica,Arial,sans-serif;letter-spacing:1px;vertical-align:middle;';
    } else {
      chip.textContent = 'READMISSION';
      chip.style.cssText = 'display:inline-block;margin-left:10px;padding:5px 14px;background:#ff1a1a;color:#fff;' +
        'border:3px solid #ff8080;box-shadow:0 0 16px rgba(255,0,0,.6);border-radius:8px;' +
        'font:800 15px -apple-system,Helvetica,Arial,sans-serif;letter-spacing:1px;vertical-align:middle;';
    }
    if (slot) slot.appendChild(chip);
    else if (g) g.parentNode.insertBefore(chip, g.nextSibling);
  }

  // HIGH-flag chip beside the G button - same alert as the
  // readmission chip, same place, same bright red (his call,
  // 2026-10-14: 'have it alert just like the readmission' instead
  // of a tile). The Dashboard script publishes tmHighFlags keyed
  // by the ESOLclientid in the Medications frame's src, which
  // this document holds - so the alert only ever shows for the
  // resident on screen.
  function renderHighChip() {
    plantChipSlots();
    var g = document.getElementById('tmGBtn');
    var slot = document.getElementById('tmHighSlot');
    var old = slot ? slot.firstElementChild : null;
    var note = null;
    try { note = JSON.parse(localStorage.getItem('tmHighFlags') || 'null'); } catch (e) {}
    var show = false;
    if (note && note.highs && note.highs.length && g) {
      var ifr = document.querySelectorAll('iframe');
      for (var i = 0; i < ifr.length; i++) {
        var mm = (ifr[i].getAttribute('src') || '').match(/ESOLclientid=(\d+)/);
        if (mm) { show = (mm[1] === note.id); break; }
      }
    }
    if (!show) { if (slot) slot.textContent = ''; return; }
    var txt = note.highs.length === 1 ? 'HIGH: ' + note.highs[0] : note.highs.length + ' HIGH FLAGS';
    if (old) {
      if (old.textContent !== txt) old.textContent = txt;
      old.title = note.highs.join(' \u00B7 ');
      return;
    }
    var chip = document.createElement('span');
    chip.id = 'tmHighChip';
    chip.textContent = txt;
    chip.title = note.highs.join(' \u00B7 ');
    // One line, ellipsized (Ear O2): a long flag text
    // truncates on the face; the full text rides the
    // tooltip above. The chip can never wrap and grow
    // its reserved slot.
    chip.style.cssText = 'display:inline-block;margin-left:10px;padding:5px 14px;background:#ff1a1a;color:#fff;' +
      'border:3px solid #ff8080;box-shadow:0 0 16px rgba(255,0,0,.6);border-radius:8px;' +
      'font:800 15px -apple-system,Helvetica,Arial,sans-serif;letter-spacing:1px;vertical-align:middle;' +
      'box-sizing:border-box;max-width:186px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
    if (slot) slot.appendChild(chip);
    else if (g) {
      var rc = document.getElementById('tmReadmitChip');
      var anchorEl = rc || g;
      anchorEl.parentNode.insertBefore(chip, anchorEl.nextSibling);
    }
  }

  function run() {
    var bar = document.getElementById('residentHeaderButtons');
    if (!bar) return;
    plantBand(); // the row must exist before the buttons plant into it
    // Button order (his ruling, 2026-10-22): More, S, G
    // FIRST on the left, then all the tiles in the row.
    // The buttons plant as the band row's first children
    // (before Admission); on a page with no band row
    // they fall back to the bar itself, as before.
    var btnHost = document.getElementById(ROW_ID) || bar;
    // Buttons always land ahead of the tiles: if a tile
    // somehow presented first, a button is inserted
    // before the first tile, never appended after them.
    // Buttons found outside the row (an older plant) are
    // moved into the same lead position, in order.
    function plantBtn(el) {
      if (btnHost === bar) { bar.appendChild(el); return; }
      var ft = btnHost.querySelector('tm-tile');
      if (ft) btnHost.insertBefore(el, ft); else btnHost.appendChild(el);
    }
    if (btnHost !== bar) {
      [BTN_ID, 'tmSBtn', 'tmGBtn'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el && el.parentNode !== btnHost) plantBtn(el);
      });
    }
    if (!document.getElementById(BTN_ID)) {
      var b = document.createElement('button');
      b.type = 'button';
      b.id = BTN_ID;
      b.className = 'rh-header-btn'; // PCC's own class — visually identical to the two it sits with
      b.textContent = 'More';
      b.addEventListener('click', function () { shown = !shown; apply(); });
      plantBtn(b);
    }
    var more = document.getElementById(BTN_ID);
    if (!document.getElementById('tmSBtn')) {
      var s = document.createElement('button');
      s.type = 'button';
      s.id = 'tmSBtn';
      s.className = 'rh-header-btn';
      s.textContent = 'S';
      s.title = 'Copy name + room (same as the S key)';
      s.addEventListener('click', triggerS);
      plantBtn(s);
    }
    if (!document.getElementById('tmGBtn')) {
      var g = document.createElement('button');
      g.type = 'button';
      g.id = 'tmGBtn';
      g.className = 'rh-header-btn';
      // Very light blue fill; white while pressed, blue again on
      // release (his spec, 2026-10-14) — the :active rule below.
      g.style.background = '#dbeafe';
      g.textContent = 'G';
      // While G is held down, every tile G can grab lights up light
      // blue and says 'Copied'; release restores them (his spec,
      // 2026-10-14). The grab itself still fires on the click. The
      // window mouseup restore lives with the shared helpers.
      g.addEventListener('mousedown', hlAllTiles);
      g.title = 'Grab all — queue everything on screen (same as the G key)';
      g.addEventListener('click', triggerG);
      plantBtn(g);
    }
    plantChipSlots();
    if (!document.getElementById('tmGBtnStyle')) {
      var gst = document.createElement('style');
      gst.id = 'tmGBtnStyle';
      gst.textContent = '#tmGBtn:active{background:#ffffff !important;}';
      (document.head || document.documentElement).appendChild(gst);
    }
    var stray;
    while ((stray = document.getElementById('tmRelRow') || document.getElementById('tmBimsRow'))) stray.remove();
    apply();
    buildCards();
    renderReadmitChip(); renderHighChip();
  }

  var lastPing = 0;
  document.addEventListener('click', function () {
    var now = Date.now();
    if (now - lastPing < 1500) return;
    lastPing = now;
    try { localStorage.setItem('tmRowPing', String(now)); } catch (e) {}
    scheduleBuild();
  }, true);
  window.addEventListener('storage', function (e) {
    if (e.key === 'tmGoWts' && e.newValue) {
      var mine = findTabInDoc(document, 'WTS/VITALS');
      if (mine) activateTab(mine);
      return;
    }
    if (e.key === 'tmGPress') { if (e.newValue) hlAllTiles(); else hlRestoreAll(); return; }
    if (e.key === 'tmTileWarn') { scheduleBuild(); return; }
    if (e.key !== 'tmRowPing' || !e.newValue) return;
    var ts = parseInt(e.newValue, 10);
    if (!ts || Date.now() - ts > 5000) return;
    scheduleBuild();
  });

  // The G KEY gets the same press feedback as the G button (his ask,
  // 2026-10-14): key down lights the grabbable tiles, key up
  // restores. The key is usually pressed in another frame, so the
  // press/release travels by the same storage broadcast as the pings.
  // The grab itself is Grab-all's, untouched.
  function gKeyTyping(e) {
    var t = e.target;
    if (!t) return false;
    var tag = (t.tagName || '').toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable === true;
  }
  document.addEventListener('keydown', function (e) {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if ((e.key || '').toLowerCase() !== 'g' || gKeyTyping(e)) return;
    try { localStorage.setItem('tmGPress', String(Date.now())); } catch (err) {}
    queueHiddenTileFills();
    hlAllTiles();
  });
  document.addEventListener('keyup', function (e) {
    if ((e.key || '').toLowerCase() !== 'g') return;
    try { localStorage.setItem('tmGPress', ''); } catch (err) {}
    hlRestoreAll();
  });

  // SMOOTH ARRIVAL (audit A2/A5): the tile band and the
  // Face Sheet button plant in THIS first eval pass, in
  // their final positions, before the gatherer's ladder
  // can land a packet - the space is reserved from the
  // start and nothing arrives later to shove the page.
  plantBand();
  try { addFaceSheetButton(document.getElementById('residentHeaderButtons'), null); } catch (e) {}

  // Bounded staggered passes (the Connect button is built late by PCC's
  // own deferred script, so re-apply the state a few times). No
  // permanent timers, no observers.
  window.__tmCore.ladder(run, [300, 900, 1800, 3000, 5000, 8000, 12000, 20000]);
})();
