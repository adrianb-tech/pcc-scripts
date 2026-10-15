// ==UserScript==
// @name         Every facility — Page capture (temporary diagnostic)
// @namespace    mica.pcc
// @version      1.2
// @description  TEMP diagnostic (v1.2): click the green HTML button, wait 3 seconds, and the whole frame tree downloads as one file - WITH live probes: what the page's rendered text actually contains, the View All button's size/visibility, and which of our badges exist 3s after the click. Delete after debugging.
// @match        https://*.pointclickcare.com/*
// @match        https://*.pointclickcare.ca/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
(function () {
  'use strict';

  var btn = document.createElement('button');
  btn.textContent = 'HTML';
  btn.setAttribute('style', [
    'position:fixed', 'right:14px', 'bottom:14px', 'z-index:2147483647',
    'background:#2f6f4f', 'color:#ffffff', 'border:none', 'border-radius:10px',
    'padding:12px 18px', 'font:700 15px -apple-system, "Segoe UI", Roboto, sans-serif',
    'cursor:pointer', 'box-shadow:0 4px 14px rgba(0,0,0,.35)'
  ].join(';'));

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  }

  function probes(doc) {
    var out = [];
    try {
      var t = ((doc.body && doc.body.innerText) || '').toLowerCase();
      out.push("rendered text: 'view all'=" + (t.indexOf('view all') !== -1) +
               " 'add progress note'=" + (t.indexOf('add progress note') !== -1) +
               " 'progress note'=" + (t.indexOf('progress note') !== -1) +
               " 'effective date'=" + (t.indexOf('effective date') !== -1));
    } catch (e) { out.push('rendered text: ERROR ' + e.message); }
    try {
      var b = doc.querySelector('[data-testid="pn-view-all-btn"]');
      if (b) {
        var r = b.getBoundingClientRect();
        var cs = doc.defaultView.getComputedStyle(b);
        out.push('pn-view-all-btn: rect=' + Math.round(r.width) + 'x' + Math.round(r.height) +
                 ' at ' + Math.round(r.left) + ',' + Math.round(r.top) +
                 ' display=' + cs.display + ' visibility=' + cs.visibility +
                 ' offsetParent=' + (b.offsetParent ? b.offsetParent.tagName : 'null') +
                 ' disabled=' + b.disabled);
      } else out.push('pn-view-all-btn: NOT FOUND');
    } catch (e) { out.push('pn-view-all-btn: ERROR ' + e.message); }
    try {
      out.push('#tmPnViewAllF=' + doc.querySelectorAll('#tmPnViewAllF').length +
               ' .pcc-f-btn=' + doc.querySelectorAll('.pcc-f-btn').length +
               ' #pcc-a-badge=' + doc.querySelectorAll('#pcc-a-badge').length +
               ' #pnDxBox=' + doc.querySelectorAll('#pnDxBox').length +
               ' #tmGBtn=' + doc.querySelectorAll('#tmGBtn').length);
    } catch (e) {}
    return out.join('\n');
  }

  function walk(doc, depth, lines, counter) {
    var n = counter.value++;
    var head = '\n\n<!-- ================= DOC ' + n + ' (depth ' + depth + ') url=' +
      esc(doc.location ? doc.location.href : '?') + ' contentType=' + esc(doc.contentType || '?') +
      ' readyState=' + esc(doc.readyState || '?') + ' iframes=' + doc.querySelectorAll('iframe').length + ' ================= -->\n' +
      '<!-- PROBES (live, at download time):\n' + probes(doc) + '\n-->\n';
    var html = '';
    try { html = doc.documentElement ? doc.documentElement.outerHTML : '(no documentElement)'; }
    catch (e) { html = '(outerHTML failed: ' + e.message + ')'; }
    lines.push(head + html);
    var frames = doc.querySelectorAll('iframe');
    for (var i = 0; i < frames.length; i++) {
      var cd = null;
      try { cd = frames[i].contentDocument; } catch (e) {}
      if (cd) walk(cd, depth + 1, lines, counter);
      else lines.push('\n\n<!-- DOC (depth ' + (depth + 1) + ') iframe ' + i + ': INACCESSIBLE (cross-origin or not loaded) -->');
    }
  }

  btn.addEventListener('click', function () {
    btn.disabled = true;
    btn.textContent = 'WAIT 3s...';
    // The delay is the point: several scripts plant their
    // badges a fraction of a second AFTER a click. Photograph
    // the page at +3s, not in the click itself.
    setTimeout(function () {
      try {
        var lines = ['<!-- PCC TREE CAPTURE v1.2 (delayed 3s) ' + new Date().toISOString() + ' top=' + location.href + ' -->'];
        walk(document, 0, lines, { value: 0 });
        var blob = new Blob([lines.join('\n')], { type: 'text/html' });
        var a = document.createElement('a');
        var d = new Date();
        a.href = URL.createObjectURL(blob);
        a.download = 'pcc-capture-TREE-' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0') + '.html';
        (document.body || document.documentElement).appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
        btn.textContent = 'SAVED';
      } catch (e) {
        btn.textContent = 'ERROR';
      }
      setTimeout(function () { btn.disabled = false; btn.textContent = 'HTML'; }, 2500);
    }, 3000);
  });

  (document.body || document.documentElement).appendChild(btn);
})();
