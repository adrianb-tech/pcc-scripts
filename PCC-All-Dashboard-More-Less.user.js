// ==UserScript==
// @name         Every facility — Dashboard header: More / Less
// @version      1.1
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
    apply();
  }

  // Bounded staggered passes (the Connect button is built late by PCC's
  // own deferred script, so re-apply the state a few times). No
  // permanent timers, no observers.
  [300, 900, 1800, 3000, 5000, 8000, 12000, 20000].forEach(function (ms) { setTimeout(run, ms); });
})();
