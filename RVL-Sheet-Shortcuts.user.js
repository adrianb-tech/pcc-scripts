// ==UserScript==
// @name         RVL — Sheet shortcuts
// @namespace    https://muse.ai/
// @version 1.1
// @description  Alt+Shift+R builds today's RVLs, Alt+Shift+I builds/updates invoice (RVL menu in Google Sheets).
// @match        https://docs.google.com/spreadsheets/*
// @grant        none
// @run-at       document-idle
// @updateURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/RVL-Sheet-Shortcuts.user.js
// @downloadURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/RVL-Sheet-Shortcuts.user.js
// ==/UserScript==

(function () {
  'use strict';

  // Nothing fires while typing.
  function typing() {
    var a = document.activeElement;
    if (!a) return false;
    var t = (a.tagName || '').toLowerCase();
    return t === 'input' || t === 'textarea' || a.isContentEditable;
  }

  // Click a top-level menu (e.g. "Extensions") by its visible label.
  function clickTopMenu(label) {
    var bars = document.querySelectorAll('[role="menubar"]');
    for (var b = 0; b < bars.length; b++) {
      var items = bars[b].querySelectorAll('[role="menuitem"]');
      for (var i = 0; i < items.length; i++) {
        if ((items[i].textContent || '').trim().toLowerCase() === label.toLowerCase()) {
          items[i].click();
          return true;
        }
      }
    }
    return false;
  }

  // Click a menu item by partial label text, searching open menus.
  function clickMenuItem(partial) {
    var items = document.querySelectorAll('[role="menuitem"], [role="menuitemradio"], .goog-menuitem');
    for (var i = 0; i < items.length; i++) {
      var txt = (items[i].textContent || '').trim();
      if (txt.toLowerCase().indexOf(partial.toLowerCase()) !== -1) {
        // Must be visible (in an open menu, not the hidden template).
        var r = items[i].getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          items[i].click();
          return true;
        }
      }
    }
    return false;
  }

  function fireClick(el) {
    ['mousedown', 'mouseup', 'click'].forEach(function (t) {
      el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window }));
    });
  }

  // Open Extensions > RVL > <itemLabel>
  function runRvlItem(itemLabel, done) {
    if (!clickTopMenu('Extensions')) { done(false); return; }
    setTimeout(function () {
      if (!clickMenuItem('RVL')) { done(false); return; }
      setTimeout(function () {
        done(clickMenuItem(itemLabel));
      }, 300);
    }, 300);
  }

  document.addEventListener('keydown', function (e) {
    if (typing()) return;
    if (!e.altKey || !e.shiftKey) return;
    var k = (e.key || '').toLowerCase();
    if (k !== 'r' && k !== 'i') return;
    e.preventDefault();
    e.stopPropagation();
    if (k === 'r') runRvlItem("Build today's RVLs", function (ok) {
      if (!ok) alert('RVL shortcut: could not find the menu item.');
    });
    else runRvlItem('Build / update invoice', function (ok) {
      if (!ok) alert('RVL shortcut: could not find the menu item.');
    });
  }, true);
})();
