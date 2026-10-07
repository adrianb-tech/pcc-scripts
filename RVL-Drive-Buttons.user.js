// ==UserScript==
// @name         RVL Drive Buttons
// @namespace    https://muse.ai/
// @version      1.5
// @description  Adds "Build RVLs" and "Build Invoice" buttons to the Google Drive folder page. Opens the RVL web app.
// @match        https://drive.google.com/drive/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/RVL-Drive-Buttons.user.js
// @downloadURL  https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/RVL-Drive-Buttons.user.js
// ==/UserScript==

(function () {
  'use strict';

  // >>> SET THIS after deploying the Apps Script as a web app <<<
  // Deploy: Extensions > Apps Script > Deploy > New deployment > Web app
  //   Execute as: Me | Who has access: Only myself
  // Paste the /exec URL here:
  var WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwzWpsjnZUp4P8-B0w6sGrW-d2s7oDF_MV6MLJLeXvKNkg_I4JusZhl1_4CUB0iUkbS/exec';

  var BTN_ID = 'rvl-drive-btns';

  function addButtons() {
    if (WEBAPP_URL.indexOf('PASTE_') === 0) return;  // not configured yet
    if (document.getElementById(BTN_ID)) return;

    var wrap = document.createElement('div');
    wrap.id = BTN_ID;

    function mkBtn(label, action) {
      var b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = 'background:#e8710a;color:#fff;border:none;border-radius:20px;' +
        'font-size:14px;font-weight:700;padding:10px 20px;cursor:pointer;width:100%;';
      b.onmouseover = function () { b.style.background = '#c95f08'; };
      b.onmouseout = function () { b.style.background = '#e8710a'; };
      // RVL builds directly; invoice opens the picker page (choose folder, see totals)
      b.onclick = function () {
        var url = action === 'invoice' ? WEBAPP_URL : WEBAPP_URL + '?action=rvl';
        window.open(url, '_blank');
      };
      return b;
    }

    wrap.appendChild(mkBtn('Build RVLs', 'rvl'));
    wrap.appendChild(mkBtn('Build Invoice', 'invoice'));

    // Place in the left sidebar, halfway between "+ New" and "Home"
    var newBtn = null;
    var btns = document.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      var t = (btns[i].textContent || '').trim();
      if (t === '+ New' || t === 'New') { newBtn = btns[i]; break; }
    }
    if (newBtn) {
      // Find the sidebar container and the Home link
      var sidebar = newBtn;
      for (var s = 0; s < 8 && sidebar; s++) {
        sidebar = sidebar.parentNode;
        if (sidebar && /home/i.test(sidebar.textContent || '') && (sidebar.textContent || '').length < 2000) break;
      }
      wrap.style.cssText = 'display:flex;flex-direction:column;gap:10px;margin:16px 16px 16px 0;';
      if (newBtn.parentNode) {
        // Insert right after the New button's container
        var newContainer = newBtn;
        // Walk up to find the element that sits alongside the nav items
        while (newContainer.parentNode && newContainer.parentNode.children.length < 3) {
          newContainer = newContainer.parentNode;
        }
        if (newContainer.parentNode) {
          newContainer.parentNode.insertBefore(wrap, newContainer.nextSibling);
          return;
        }
      }
    }

    // Fallback: fixed position top-right, always visible
    wrap.style.cssText = 'position:fixed;top:70px;right:20px;z-index:9999;' +
      'display:flex;gap:8px;background:#fff;padding:8px 12px;border-radius:12px;' +
      'box-shadow:0 2px 8px rgba(0,0,0,0.2);';
    document.body.appendChild(wrap);
  }

  // Drive is a SPA — retry until the toolbar exists
  var tries = 0;
  var iv = setInterval(function () {
    addButtons();
    if (document.getElementById(BTN_ID) || ++tries > 120) clearInterval(iv);
  }, 500);
})();
