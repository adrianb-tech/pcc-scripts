// ==UserScript==
// @name         Every facility — Page capture (temporary diagnostic)
// @namespace    mica.pcc
// @version      1.1
// @description  TEMPORARY: small "HTML" button on every PCC frame. Clicking downloads the WHOLE frame tree (every frame's HTML, labeled with its URL + content type + a census of our scripts' marks) so Mica can see the page's real structure in one file.
// @match        https://*.pointclickcare.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
(function() {
  'use strict';
  if (window.__pccCaptureBtn) return;
  window.__pccCaptureBtn = true;

  var PROBES = ['[data-testid="pn-view-all-btn"]', '#tmPnViewAllF', '.pcc-f-btn', '#pnDxBox', '#tmGBtn', '#residentHeaderButtons', '#tmWtsFBadge', '#tmViewBtn', '#medListBox'];

  function census(doc) {
    var out = [];
    for (var i = 0; i < PROBES.length; i++) {
      try { out.push(PROBES[i] + '=' + doc.querySelectorAll(PROBES[i]).length); } catch (e) { out.push(PROBES[i] + '=ERR'); }
    }
    return out.join('  ');
  }

  function walk(win, depth, lines, docs) {
    var label = 'DOC ' + docs.length + ' (depth ' + depth + ')';
    var info;
    try {
      var doc = win.document;
      info = label + ' url=' + win.location.href + ' contentType=' + doc.contentType + ' readyState=' + doc.readyState + ' iframes=' + doc.querySelectorAll('iframe').length;
      docs.push({ info: info, census: census(doc), html: '<!DOCTYPE html>\n' + doc.documentElement.outerHTML });
    } catch (e) {
      docs.push({ info: label + ' INACCESSIBLE (' + e.message + ')', census: '', html: '' });
      return;
    }
    try {
      for (var i = 0; i < win.frames.length; i++) walk(win.frames[i], depth + 1, lines, docs);
    } catch (e) {}
  }

  var btn = document.createElement('button');
  btn.textContent = 'HTML';
  btn.title = 'Download the whole frame tree HTML + script census';
  btn.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:2147483647;' +
    'background:#2f6f4f;color:#fff;border:none;border-radius:6px;' +
    'padding:6px 12px;font:600 12px -apple-system,Helvetica,Arial,sans-serif;' +
    'cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.35);opacity:.92;';

  btn.addEventListener('click', function() {
    try {
      var docs = [];
      walk(window.top, 0, [], docs);
      var parts = ['FRAME TREE CAPTURE — ' + docs.length + ' documents\n'];
      for (var i = 0; i < docs.length; i++) {
        parts.push('\n\n########## ' + docs[i].info + '\n########## census: ' + docs[i].census + '\n' + docs[i].html);
      }
      var d = new Date();
      var hh = ('0' + d.getHours()).slice(-2), mm = ('0' + d.getMinutes()).slice(-2);
      var name = 'pcc-capture-TREE-' + hh + mm + '.html';
      var blob = new Blob([parts.join('')], { type: 'text/html' });
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
