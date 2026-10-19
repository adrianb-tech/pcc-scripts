// ==UserScript==
// @name         Every facility — Focus keeper (pop-ups)
// @version      1.5
// @description  WATCHER ONLY (v1.5, diagnostic): records where focus goes - every focus change, click, key, window open/close - into a shared log that any page capture can read. It NEVER moves focus: this file contains no focus() or blur() call anywhere. Built because his three pop-up flows (follow-up save, sign, pop-up close) strand focus with the acting keeper OFF, and the next fix must come from seeing the actual focus path, not another theory. The acting keeper (v1.4) is retired: its bisect showed it broke the Split View close, which works with it off.
// @updateURL    https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Focus-keeper.user.js
// @downloadURL  https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Focus-keeper.user.js
// @match        https://*.pointclickcare.com/*
// @run-at       document-idle
// @allFrames    true
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  var OFF = false;

  function describe(el) {
    if (!el) return 'none';
    if (el === document.body) return 'body';
    if (el === document.documentElement) return 'html';
    var s = (el.tagName || '?').toLowerCase();
    try {
      if (el.id) s += '#' + el.id;
      else if (el.className && typeof el.className === 'string' && el.className.trim()) s += '.' + el.className.trim().split(/\s+/)[0];
      var nm = el.getAttribute && (el.getAttribute('name') || el.getAttribute('type'));
      if (nm && !el.id) s += '[' + nm + ']';
    } catch (e) {}
    return s;
  }
  function pageTag() {
    var p = location.pathname.split('/').pop() || '';
    return p.replace(/\.(jsp|xhtml)$/i, '');
  }
  function stamp() {
    var d = new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2);
  }
  function logRender() {
    try {
      var n = document.getElementById('tmFocusLog');
      if (!n) {
        n = document.createElement('div');
        n.id = 'tmFocusLog';
        n.style.display = 'none';
        (document.body || document.documentElement).appendChild(n);
      }
      var arr = [];
      try { arr = JSON.parse(localStorage.getItem('tmFocusLogLS') || '[]'); } catch (e) {}
      n.textContent = arr.join(' | ');
    } catch (e) {}
  }
  function logEvent(msg) {
    if (OFF) return;
    try {
      var arr = [];
      try { arr = JSON.parse(localStorage.getItem('tmFocusLogLS') || '[]'); } catch (e) {}
      arr.push(stamp() + ' [' + pageTag() + '] ' + msg);
      while (arr.length > 14) arr.shift();
      try { localStorage.setItem('tmFocusLogLS', JSON.stringify(arr)); } catch (e) {}
    } catch (e) {}
    logRender();
  }

  var hasOpener = false;
  try { hasOpener = !!(window.opener && !window.opener.closed); } catch (e) {}
  logEvent('open (opener=' + (hasOpener ? 'yes' : 'no') + ', top=' + (window.top === window ? 'yes' : 'no') + ')');

  document.addEventListener('focusin', function (e) {
    logEvent('focus -> ' + describe(e.target));
  }, true);
  document.addEventListener('click', function (e) {
    if (!e.isTrusted) return;
    logEvent('click ' + describe(e.target) + ' (active: ' + describe(document.activeElement) + ')');
  }, true);
  var lastKeyLog = 0;
  document.addEventListener('keydown', function (e) {
    if (!e.isTrusted) return;
    if (e.key === '0' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      var t = e.target;
      var typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (!typing) { OFF = !OFF; return; }
    }
    var now = Date.now();
    if (now - lastKeyLog < 300) return;
    lastKeyLog = now;
    logEvent('key ' + e.key + ' on ' + describe(e.target) + ' (active: ' + describe(document.activeElement) + ')');
  }, true);
  window.addEventListener('blur', function () { logEvent('window blur'); });
  window.addEventListener('focus', function () { logEvent('window focus (active: ' + describe(document.activeElement) + ')'); });
  window.addEventListener('beforeunload', function () { logEvent('window closing'); });
  logRender();
})();
