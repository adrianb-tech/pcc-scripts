// ==UserScript==
// @name         Every facility — Header copy table
// @version 1.25
// @description  RETIRED 2026-10-14 at Adrian's direction: the tile row (Dashboard More/Less script) replaced this card, so this update removes the card and does nothing else. The script can be deleted from Tampermonkey once this version has run.
// @updateURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Header-copy-table.user.js
// @downloadURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Header-copy-table.user.js
// @match        https://*.pointclickcare.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';
  function removeCard() {
    var card = document.getElementById('copyInfoTable');
    if (card && card.parentNode) card.parentNode.removeChild(card);
    var st = document.getElementById('pccHdrCardStyle');
    if (st && st.parentNode) st.parentNode.removeChild(st);
  }
  removeCard();
  [600, 1800, 4000].forEach(function (ms) { setTimeout(removeCard, ms); });
})();
