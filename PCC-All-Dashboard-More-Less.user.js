// ==UserScript==
// @name         Every facility — Dashboard header: More / Less
// @version      1.0
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
  var shown = false; // default state: the two PCC buttons are hidden, button reads More

  function targets() {
    var out = [];
    var cp = document.querySelector('#residentHeaderButtons [data-testid="care-profile"]');
    if (cp) out.push(cp);
    var cq = document.getElementById('carequality-app');
    if (cq) out.push(cq);
    return out;
  }

  function apply() {
    targets().forEach(function (el) { el.style.display = shown ? '' : 'none'; });
    var b = document.getElementById(BTN_ID);
    if (b) b.textContent = shown ? 'Less' : 'More';
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
