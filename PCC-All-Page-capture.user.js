// ==UserScript==
// @name         Every facility — Page capture (temporary diagnostic)
// @namespace    mica.pcc
// @version      1.0
// @description  TEMPORARY: puts a small "HTML" button on every PCC frame. Clicking it downloads that frame's full HTML source so Mica can read the real markup (field names, real row structure) instead of guessing from screenshots. Delete after the debugging round.
// @match        https://*.pointclickcare.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
(function() {
  'use strict';
  if (window.__pccCaptureBtn) return;
  window.__pccCaptureBtn = true;

  var btn = document.createElement('button');
  btn.textContent = 'HTML';
  btn.title = 'Download this frame\u2019s HTML source';
  btn.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:2147483647;' +
    'background:#2f6f4f;color:#fff;border:none;border-radius:6px;' +
    'padding:6px 12px;font:600 12px -apple-system,Helvetica,Arial,sans-serif;' +
    'cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.35);opacity:.92;';

  btn.addEventListener('click', function() {
    try {
      var html = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
      var seg = (location.pathname.split('/').pop() || 'page').replace(/[^\w.-]+/g, '_');
      var d = new Date();
      var hh = ('0' + d.getHours()).slice(-2), mm = ('0' + d.getMinutes()).slice(-2);
      var name = 'pcc-capture-' + seg + '-' + hh + mm + '.html';
      var blob = new Blob([html], { type: 'text/html' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(function() { URL.revokeObjectURL(a.href); a.remove(); }, 400);
      btn.textContent = 'saved \u2713';
      setTimeout(function() { btn.textContent = 'HTML'; }, 2000);
    } catch (e) {
      btn.textContent = 'failed';
      setTimeout(function() { btn.textContent = 'HTML'; }, 2000);
    }
  });

  (document.body || document.documentElement).appendChild(btn);
})();
