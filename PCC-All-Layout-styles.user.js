// ==UserScript==
// @name         PCC - Layout styles
// @version      1.0
// @description  His Stylus styles, recreated: wide self-growing note fields; meds/dx tables unclipped, header un-stuck.
// @match        *://*.pointclickcare.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==
// His three Stylus styles (exported 2026-10-22),
// recreated 1:1 so Stylus can come off. Pure CSS,
// injected once before first paint - no timers, no
// observers, no storage, nothing phones out. The two
// Stylus copies of the textarea rule (www30 + the
// whole domain) collapse into this one script: the
// @match already covers every subdomain.
(function () {
  'use strict';
  var css =
    // Stylus styles 1+2: every typing box wide and
    // self-growing (field-sizing is Chromium's
    // auto-height for textareas).
    'textarea {\n' +
    '  field-sizing: content !important;\n' +
    '  width: 700px !important;\n' +
    '  max-width: 95% !important;\n' +
    '  height: auto !important;\n' +
    '  min-height: 80px !important;\n' +
    '}\n' +
    // Stylus style 3 ('PCC expands meds/dx'): the
    // meds/dx tables show in full - no fixed-height
    // scroll window - and the frozen header row
    // scrolls with the page.
    '#tableContainer,\n' +
    '.tableContainer,\n' +
    '.scrollTable tbody,\n' +
    ':has(.tableContainer) {\n' +
    '  height: auto !important;\n' +
    '  max-height: none !important;\n' +
    '  overflow: visible !important;\n' +
    '}\n' +
    '.scrollTable thead.fixedHeader,\n' +
    '#fixedHeader {\n' +
    '  position: static !important;\n' +
    '}';
  var st = document.createElement('style');
  st.id = 'tmLayoutStyles';
  st.textContent = css;
  (document.head || document.documentElement).appendChild(st);
})();
