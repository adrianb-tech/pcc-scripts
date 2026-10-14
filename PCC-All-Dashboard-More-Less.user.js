// ==UserScript==
// @name         Every facility — Dashboard header: More / Less
// @version      2.0
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

  function tile(labelText, valueText, opts) {
    opts = opts || {};
    var d = document.createElement('div');
    d.style.cssText = 'background:' + (opts.rose ? '#fdf3f2' : '#fff') + ';border:1px solid ' +
      (opts.rose ? '#f0c8c2' : '#e2e8f0') + ';border-radius:12px;box-shadow:0 1px 3px rgba(15,23,42,.05);' +
      'padding:' + (opts.pad || '12px 16px 14px') + ';' + (opts.grow ? 'flex:1 1 400px;min-width:340px;' : (opts.fixedW ? 'flex:none;width:' + opts.fixedW + 'px;' : 'flex:none;'));
    var lab = document.createElement('div');
    lab.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:14px;';
    var ls = document.createElement('span');
    ls.textContent = labelText;
    ls.style.cssText = 'font-size:10.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:' +
      (opts.rose ? '#a05a52' : '#8494a7') + ';';
    lab.appendChild(ls);
    if (opts.btn) lab.appendChild(opts.btn);
    var v = document.createElement('div');
    v.textContent = valueText;
    v.style.cssText = 'margin-top:9px;font-size:' + (opts.size || 21) + 'px;font-weight:' + (opts.weight || 700) +
      ';line-height:' + (opts.multi ? '1.45' : '1.3') + ';color:' + (opts.color || '#131c2b') + ';' +
      (opts.multi ? 'white-space:pre-line;' : '');
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
    if (opts.nav) {
      d.style.cursor = 'pointer';
      d.title = 'Go to WTS/VITALS';
      d.addEventListener('click', function () { goWtsVitals(); });
    }
    if (opts.click) {
      // The whole tile is the button (his ask, 2026-10-14): click
      // anywhere on it does exactly what its Copy button did; the
      // label flashes 'Copied' as the confirmation.
      d.style.cursor = 'pointer';
      d.title = 'Click to copy';
      d.addEventListener('click', function () {
        queueCopy(opts.click.label, opts.click.value);
        var o = ls.textContent; ls.textContent = 'Copied';
        setTimeout(function () { ls.textContent = o; }, 1000);
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
    ['mousedown', 'mouseup', 'click'].forEach(function (type) {
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    });
  }
  function goWtsVitals() {
    var docs = [];
    (function walk(w) {
      try { docs.push(w.document); } catch (e) { return; }
      for (var i = 0; i < w.frames.length; i++) walk(w.frames[i]);
    })(window.top || window);
    var LABELS = ['DASH', 'PROFILE', 'ORDERS', 'RESULTS', 'FORMS', 'PROG NOTES'];
    for (var d = 0; d < docs.length; d++) {
      var doc = docs[d];
      var bodyTxt = (doc.body && doc.body.textContent) || '';
      var others = 0;
      LABELS.forEach(function (L) { if (bodyTxt.indexOf(L) !== -1) others++; });
      if (others < 4) continue; // not the tab-bar frame
      var els = doc.querySelectorAll('a,button,[role="tab"],li,td,span,div');
      for (var i = 0; i < els.length; i++) {
        var tx = (els[i].textContent || '').replace(/\s+/g, ' ').trim();
        if (tx !== 'WTS/VITALS') continue;
        var target = els[i].querySelector('a') || els[i];
        fireClick(target);
        return;
      }
    }
  }

  function buildCards() {
    var bar = document.getElementById('residentHeaderButtons');
    if (!bar || !bar.parentNode) return;
    var d = cardData();
    if (d) {
      d.weight = weightValue();
      var mb = document.getElementById('copyMedListBtn');
      if (mb) { var mv = mb.getAttribute('data-fill-value'); if (mv) d.meds = mv; }
    }
    var row = document.getElementById(ROW_ID);
    if (!d) { if (row) row.remove(); return; }
    var sig = [d.admission || '', d.ageSex || '', d.room || '', d.allergies || '', d.weight || '', d.meds || ''].join('|');
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
    if (d.ageSex) row.appendChild(tile('Age / Sex', d.ageSex, { pad: '12px 13px 14px', click: { label: 'Age/Sex', value: d.ageSex }, fill: { label: 'Age/Sex', value: d.ageSex } }));
    if (d.room) row.appendChild(tile('Room', d.room, {}));
    if (d.allergies) row.appendChild(tile('Allergies', d.allergies, { rose: true, fixedW: 340, weight: 600, color: '#a33327', fit: true, click: { label: 'Allergies', value: d.allergies }, fill: { label: 'Allergies', value: d.allergies } }));
    if (d.weight) row.appendChild(tile('Weight', d.weight, { nav: true }));
    if (d.meds) row.appendChild(tile('Psych meds', d.meds, { grow: true, multi: true, size: 13, weight: 600, click: { label: 'Psych meds', value: d.meds }, fill: { label: 'Psych meds', value: d.meds } }));
    bar.parentNode.insertBefore(row, bar.nextSibling);
    fitAllergies(row);
  }

  // The Allergies box is always the same size; a long allergy list
  // shrinks its text until it fits the box (his spec, 2026-10-14).
  // Starts from the shared value size (21px, same as every other
  // tile) and steps down only as far as needed.
  function fitAllergies(row) {
    var el = row.querySelector('[data-fit="1"]');
    if (!el) return;
    var size = 21;
    el.style.fontSize = size + 'px';
    var guard = 0;
    while (guard < 14 && size > 10 && (el.scrollHeight > 56 || el.scrollWidth > el.clientWidth)) {
      size -= 1;
      el.style.fontSize = size + 'px';
      guard++;
    }
  }

  // ---------- per-tab tiles (his plan, 2026-10-14) ----------
  // PROFILE: a Relationships tile beside the relationships box.
  // FORMS: a BIMS tile beside the BIMS box. Each reads the value
  // from that box's own Copy button, and the tile itself carries
  // the same contract, so clicking it (or G) copies + queues
  // exactly what the box's Copy does.
  function sideTile(rowId, anchorEl, label, value) {
    if (!anchorEl || !anchorEl.parentNode || !value) return;
    var row = document.getElementById(rowId);
    if (row && row.getAttribute('data-sig') === value) return;
    if (row) row.remove();
    row = document.createElement('div');
    row.id = rowId;
    row.setAttribute('data-sig', value);
    row.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;margin:10px 0;' +
      'font-family:-apple-system,Helvetica,Arial,sans-serif;';
    row.appendChild(tile(label, value, { grow: true, multi: true, size: 13, weight: 600, click: { label: label, value: value }, fill: { label: label, value: value } }));
    anchorEl.parentNode.insertBefore(row, anchorEl);
  }
  function buildRelTile() {
    var btn = document.getElementById('relCopyBtn');
    var box = document.getElementById('relBox');
    if (!btn || !box) return;
    sideTile('tmRelRow', box, 'Relationships', btn.getAttribute('data-fill-value') || '');
  }
  function buildBimsTile() {
    var box = document.getElementById('custom-bims-badge');
    if (!box) return;
    var btn = box.querySelector('.pcc-fill-copy');
    var val = btn ? (btn.getAttribute('data-fill-value') || '') : '';
    if (!val) { var vv = box.querySelector('.bims-value'); if (vv) val = (vv.textContent || '').trim(); }
    sideTile('tmBimsRow', box, 'BIMS', val);
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
      g.textContent = 'G';
      g.title = 'Grab all — queue everything on screen (same as the G key)';
      g.addEventListener('click', triggerG);
      var sBtn = document.getElementById('tmSBtn');
      bar.insertBefore(g, sBtn ? sBtn.nextSibling : more.nextSibling);
    }
    apply();
    buildCards();
    buildRelTile();
    buildBimsTile();
  }

  // Bounded staggered passes (the Connect button is built late by PCC's
  // own deferred script, so re-apply the state a few times). No
  // permanent timers, no observers.
  [300, 900, 1800, 3000, 5000, 8000, 12000, 20000].forEach(function (ms) { setTimeout(run, ms); });
})();
