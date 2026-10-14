// ==UserScript==
// @name         Every facility — Dashboard header: More / Less
// @version      1.3
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

  function cardData() {
    var card = document.getElementById('copyInfoTable');
    if (!card) return null;
    var out = {};
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
      if (name.indexOf('age') === 0) out.ageSex = qv || val;
      else if (name.indexOf('room') === 0) out.room = val;
      else if (name.indexOf('allergies') === 0) { out.allergies = qv || val; }
      else if (name.indexOf('admission') === 0) out.admission = val;
    }
    return (out.ageSex || out.room || out.allergies || out.admission) ? out : null;
  }

  function copyBtn(label, value) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'pcc-fill-copy';
    b.setAttribute('data-fill-label', label);
    b.setAttribute('data-fill-value', value);
    b.textContent = 'Copy';
    b.style.cssText = 'font:600 11px -apple-system,Helvetica,Arial,sans-serif;color:#3d4b61;' +
      'border:1px solid #dbe2ec;border-radius:999px;padding:2px 9px;background:#f4f6f9;cursor:pointer;flex:none;';
    b.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(value); } catch (err) {}
      var key = label === 'Age/Sex' ? 'pccFillAgeSex' : (label === 'Allergies' ? 'pccFillAllergies' : null);
      if (key) { try { localStorage.setItem(key, JSON.stringify({ value: value, ts: Date.now() })); } catch (err) {} }
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
      'padding:12px 16px 14px;' + (opts.flex ? 'flex:1 1 230px;max-width:340px;' : 'flex:none;');
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
    v.style.cssText = 'margin-top:9px;font-size:' + (opts.size || 20) + 'px;font-weight:' + (opts.weight || 700) +
      ';line-height:1.3;color:' + (opts.color || '#131c2b') + ';';
    d.appendChild(lab); d.appendChild(v);
    return d;
  }

  function buildCards() {
    var bar = document.getElementById('residentHeaderButtons');
    if (!bar || !bar.parentNode) return;
    var d = cardData();
    var row = document.getElementById(ROW_ID);
    if (!d) { if (row) row.remove(); return; }
    var sig = [d.admission || '', d.ageSex || '', d.room || '', d.allergies || ''].join('|');
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
    if (d.ageSex) row.appendChild(tile('Age / Sex', d.ageSex, { size: 24, weight: 800, btn: copyBtn('Age/Sex', d.ageSex) }));
    if (d.room) row.appendChild(tile('Room', d.room, {}));
    if (d.allergies) row.appendChild(tile('Allergies', d.allergies, { rose: true, flex: true, size: 14.5, weight: 600, color: '#a33327', btn: copyBtn('Allergies', d.allergies) }));
    bar.parentNode.insertBefore(row, bar.nextSibling);
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
  }

  // Bounded staggered passes (the Connect button is built late by PCC's
  // own deferred script, so re-apply the state a few times). No
  // permanent timers, no observers.
  [300, 900, 1800, 3000, 5000, 8000, 12000, 20000].forEach(function (ms) { setTimeout(run, ms); });
})();
