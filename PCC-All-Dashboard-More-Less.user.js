// ==UserScript==
// @name         Every facility — Dashboard header: More / Less
// @version      3.14
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
    var tiles = row.querySelectorAll('.pcc-fill-copy, [data-tm-copy="1"]');
    for (var i = 0; i < tiles.length; i++) hlTile(tiles[i], true);
  }
  function hlRestoreAll() {
    var lit = document.querySelectorAll('#tmCardsRow [data-tm-hl="1"]');
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

  function tile(labelText, valueText, opts) {
    opts = opts || {};
    var d = document.createElement('div');
    d.style.cssText = 'background:' + (opts.warn ? '#ff1a1a' : (opts.rose ? '#fdf3f2' : '#fff')) + ';border:1px solid ' +
      (opts.warn ? '#ff8080' : (opts.rose ? '#f0c8c2' : '#e2e8f0')) + ';border-radius:12px;box-shadow:' +
      (opts.warn ? '0 0 10px rgba(255,26,26,.55),0 1px 3px rgba(15,23,42,.05)' : '0 1px 3px rgba(15,23,42,.05)') + ';' +
      'padding:' + (opts.pad || '12px 16px 14px') + ';' + (opts.wide ? 'flex:1 1 520px;min-width:440px;' : (opts.grow ? 'flex:1 1 400px;min-width:340px;' : (opts.fixedW ? 'flex:none;width:' + opts.fixedW + 'px;' : 'flex:none;')));
    var lab = document.createElement('div');
    lab.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:14px;';
    var ls = document.createElement('span');
    ls.textContent = labelText;
    ls.style.cssText = 'font-size:10.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:' +
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
      v.style.cssText = 'margin-top:9px;display:flex;gap:26px;';
      for (var ci = 0; ci < ncols; ci++) {
        var col = document.createElement('div');
        col.style.cssText = fontCss + 'white-space:pre-line;max-width:300px;flex:1 1 0;min-width:170px;';
        col.textContent = lines.slice(ci * per, (ci + 1) * per).join('\n');
        v.appendChild(col);
      }
    } else {
      v.textContent = valueText;
      v.style.cssText = 'margin-top:9px;' + fontCss + (opts.multi ? 'white-space:pre-line;' : '');
    }
    if (opts.fit) v.setAttribute('data-fit', '1');
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
    var bar = document.getElementById('residentHeaderButtons');
    if (!bar || !bar.parentNode) return;
    var d = cardData();
    if (d) {
      d.weight = weightValue();
      d.weightRed = weightFlagged();
      d.meds = medsDisplay();
      var mp = medsPanel();
      d.medsFill = (mp && mp.btn && mp.btn.hasAttribute('data-fill-value')) ? mp.btn.getAttribute('data-fill-value') : null;
      d.bims = bimsValue();
      d.rel = relValue();
    }
    var row = document.getElementById(ROW_ID);
    if (!d) { if (row) row.remove(); return; }
    // Publish the chart values the note is compared against
    // (engine reads tmTileChart), and read back its verdicts
    // (tmTileWarn): a topic blank in the open note or different
    // from the chart paints its tile warning-red.
    try {
      var chartVals = [d.ageSex || '', d.allergies || '', (d.medsFill !== null && d.medsFill !== undefined) ? d.medsFill : (d.meds || ''), d.rel || ''].join('|');
      if (window.__tmChartLast !== chartVals) {
        window.__tmChartLast = chartVals;
        localStorage.setItem('tmTileChart', JSON.stringify({ ageSex: d.ageSex || null, allergies: d.allergies || null, meds: (d.medsFill !== null && d.medsFill !== undefined) ? d.medsFill : (d.meds || null), rel: d.rel || null, ts: Date.now() }));
      }
    } catch (e) {}
    var tw = null;
    try { tw = JSON.parse(localStorage.getItem('tmTileWarn') || 'null'); } catch (e) {}
    if (tw && Date.now() - (tw.ts || 0) > 2 * 60000) tw = null;
    var sig = [d.admission || '', d.ageSex || '', d.room || '', d.allergies || '', d.weight || '', d.weightRed ? 'R' : '', d.meds || '', d.medsFill === null ? '~' : d.medsFill, d.bims || '', d.rel || '', tw ? (tw.age ? '1' : '0') + (tw.allergies ? '1' : '0') + (tw.meds ? '1' : '0') + (tw.rel ? '1' : '0') : '----'].join('|');
    if (row && row.getAttribute('data-sig') === sig) return;
    if (row) row.remove();
    row = document.createElement('div');
    row.id = ROW_ID;
    row.setAttribute('data-sig', sig);
    row.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;margin:12px 0 4px;' +
      'font-family:-apple-system,Helvetica,Arial,sans-serif;';
    if (d.admission) {
      var m = d.admission.match(/^(.*?)(\s*\((re-entry|initial)\))?$/i);
      var kind = m && m[3] ? m[3].toLowerCase() : '';
      row.appendChild(tile(kind ? 'Admission (' + kind + ')' : 'Admission', m ? m[1] : d.admission, {}));
    }
    if (d.ageSex) row.appendChild(tile('Age / Sex', d.ageSex, { pad: '12px 13px 14px', warn: !!(tw && tw.age), click: { label: 'Age/Sex', value: d.ageSex }, fill: { label: 'Age/Sex', value: d.ageSex } }));
    if (d.room) row.appendChild(tile('Room', d.room, {}));
    if (d.allergies) row.appendChild(tile('Allergies', d.allergies, { fixedW: 340, weight: 600, color: '#a33327', fit: true, warn: !!(tw && tw.allergies), click: { label: 'Allergies', value: d.allergies }, fill: { label: 'Allergies', value: d.allergies } }));
    function medCountChip(txt) {
      var c = document.createElement('span');
      c.textContent = txt;
      c.style.cssText = 'font-size:16px;font-weight:800;color:' + ((tw && tw.meds) ? '#ffffff' : '#2563eb') + ';';
      return c;
    }
    if (d.weight) row.appendChild(tile('Weight', d.weight, { nav: true, color: d.weightRed ? '#a33327' : undefined }));
    if (d.meds) {
      // Design A in the row, right after Weight (his pick): a wide
      // banner tile whose lines flow into columns. First-class tile
      // now (copy + G like the others) reading the value the
      // Dashboard stamps at render; the delegate proxy remains only
      // as a fallback for older Dashboard installs.
      if (d.medsFill !== null && d.medsFill !== undefined) {
        row.appendChild(tile('Psych meds', d.meds, { cols: true, multi: true, size: 13, weight: 600, maxw: '920px', warn: !!(tw && tw.meds), btn: medCountChip(String(d.meds === '- none' ? 0 : d.meds.split('\n').length)), click: { label: 'Psych meds', value: d.medsFill }, fill: { label: 'Psych meds', value: d.medsFill } }));
      } else {
        row.appendChild(tile('Psych meds', d.meds, { cols: true, multi: true, size: 13, weight: 600, maxw: '920px', warn: !!(tw && tw.meds), btn: medCountChip(String(d.meds === '- none' ? 0 : d.meds.split('\n').length)), delegate: 'meds' }));
      }
    }
    if (d.bims) row.appendChild(tile('BIMS', d.bims, { fixedW: 340, fit: true, click: { label: 'BIMS', value: d.bims }, fill: { label: 'BIMS', value: d.bims } }));
    if (d.rel) row.appendChild(tile('Relationships', d.rel, { fixedW: 340, fit: true, warn: !!(tw && tw.rel), click: { label: 'Relationships', value: d.rel }, fill: { label: 'Relationships', value: d.rel } }));
    bar.parentNode.insertBefore(row, bar.nextSibling);
    fitAllergies(row);
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
    if (bv) return bv;
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
  var feedRel = '', feedBims = '';
  document.addEventListener('tm-gather-feed', function (e) {
    var d = (e && e.detail) || {};
    var changed = false;
    if (d.rel && d.rel !== feedRel) { feedRel = d.rel; changed = true; }
    if (d.bims && d.bims !== feedBims) { feedBims = d.bims; changed = true; }
    if (changed) setTimeout(function () { buildCards(); }, 350);
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

  // READMISSION chip beside the G button (his ask, 2026-10-14: he
  // loves the warning — move it next to G). The flag script keeps
  // its own box (the consult defaults read that box), and publishes
  // a note keyed to resident + re-entry date; when the note matches
  // THIS resident, the same bright-red warning shows here.
  function renderReadmitChip() {
    var g = document.getElementById('tmGBtn');
    var old = document.getElementById('tmReadmitChip');
    var note = null;
    try { note = JSON.parse(localStorage.getItem('tmReadmitNote') || 'null'); } catch (e) {}
    var show = false;
    if (note && note.id && g) {
      var idm = (document.body.textContent || '').match(/\(\s*([A-Za-z]{0,5}\d{3,})\s*\)/);
      var adm = selfData().admission || '';
      var curDate = adm.replace(/\s*\((re-entry|initial)\)/i, '');
      show = !!idm && idm[1] === note.id && curDate === note.date;
    }
    if (!show) { if (old) old.remove(); return; }
    if (old) return;
    var chip = document.createElement('span');
    chip.id = 'tmReadmitChip';
    chip.textContent = 'READMISSION';
    chip.style.cssText = 'display:inline-block;margin-left:10px;padding:5px 14px;background:#ff1a1a;color:#fff;' +
      'border:3px solid #ff8080;box-shadow:0 0 16px rgba(255,0,0,.6);border-radius:8px;' +
      'font:800 15px -apple-system,Helvetica,Arial,sans-serif;letter-spacing:1px;vertical-align:middle;';
    g.parentNode.insertBefore(chip, g.nextSibling);
  }

  // HIGH-flag chip beside the G button - same alert as the
  // readmission chip, same place, same bright red (his call,
  // 2026-10-14: 'have it alert just like the readmission' instead
  // of a tile). The Dashboard script publishes tmHighFlags keyed
  // by the ESOLclientid in the Medications frame's src, which
  // this document holds - so the alert only ever shows for the
  // resident on screen.
  function renderHighChip() {
    var g = document.getElementById('tmGBtn');
    var old = document.getElementById('tmHighChip');
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
    if (!show) { if (old) old.remove(); return; }
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
    chip.style.cssText = 'display:inline-block;margin-left:10px;padding:5px 14px;background:#ff1a1a;color:#fff;' +
      'border:3px solid #ff8080;box-shadow:0 0 16px rgba(255,0,0,.6);border-radius:8px;' +
      'font:800 15px -apple-system,Helvetica,Arial,sans-serif;letter-spacing:1px;vertical-align:middle;';
    var rc = document.getElementById('tmReadmitChip');
    var anchorEl = rc || g;
    anchorEl.parentNode.insertBefore(chip, anchorEl.nextSibling);
  }

  function run() {
    var bar = document.getElementById('residentHeaderButtons');
    if (!bar) return;
    if (!document.getElementById(BTN_ID)) {
      var b = document.createElement('button');
      b.type = 'button';
      b.id = BTN_ID;
      b.className = 'rh-header-btn'; // PCC's own class — visually identical to the two it sits with
      b.textContent = 'More';
      b.addEventListener('click', function () { shown = !shown; apply(); });
      bar.appendChild(b);
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
      bar.insertBefore(s, more.nextSibling);
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
      var sBtn = document.getElementById('tmSBtn');
      bar.insertBefore(g, sBtn ? sBtn.nextSibling : more.nextSibling);
    }
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
    setTimeout(function () { buildCards(); renderReadmitChip(); renderHighChip(); }, 700);
  }, true);
  window.addEventListener('storage', function (e) {
    if (e.key === 'tmGoWts' && e.newValue) {
      var mine = findTabInDoc(document, 'WTS/VITALS');
      if (mine) activateTab(mine);
      return;
    }
    if (e.key === 'tmGPress') { if (e.newValue) hlAllTiles(); else hlRestoreAll(); return; }
    if (e.key === 'tmTileWarn') { setTimeout(function () { buildCards(); renderReadmitChip(); renderHighChip(); }, 350); return; }
    if (e.key !== 'tmRowPing' || !e.newValue) return;
    var ts = parseInt(e.newValue, 10);
    if (!ts || Date.now() - ts > 5000) return;
    setTimeout(function () { buildCards(); renderReadmitChip(); renderHighChip(); }, 700);
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
    hlAllTiles();
  });
  document.addEventListener('keyup', function (e) {
    if ((e.key || '').toLowerCase() !== 'g') return;
    try { localStorage.setItem('tmGPress', ''); } catch (err) {}
    hlRestoreAll();
  });

  // Bounded staggered passes (the Connect button is built late by PCC's
  // own deferred script, so re-apply the state a few times). No
  // permanent timers, no observers.
  [300, 900, 1800, 3000, 5000, 8000, 12000, 20000].forEach(function (ms) { setTimeout(run, ms); });
})();
