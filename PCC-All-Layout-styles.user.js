// ==UserScript==
// @name         PCC - Layout styles
// @version      1.3
// @description  His Stylus styles, recreated, plus the fixed frame + Apple Calendar main header (top row).
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
    '}\n' +
    // THE FIXED FRAME (his ruling, 2026-10-23): the
    // whole top field - picture row, tile band, the
    // row-2 tiles where a page carries them, the
    // extended row - is one fixed height on every tab
    // page, so the tab bar below it starts at the same
    // place on every tab and never drops when the
    // tiles plant. A floor, never a ceiling: content
    // taller than the floor still grows the field (no
    // clipping, ever) - the floor only pads shorter
    // pages up to the common height. The height is
    // MEASURED, not estimated: 1.1's 452 floor left a
    // white gap under the tiles on his Prog Notes
    // screenshot; the gap measures 195 CSS px against
    // the 72px band as the scale (image 3150x1810,
    // retina 2x), so the field's true content height
    // is 452 - 195 = 257. It is the one knob: if a
    // tab still sits lower, that page's natural height
    // is the new candidate; if the white runs long,
    // it comes down. In force from first paint (this
    // script runs at document-start).
    '#residentHeader {\n' +
    '  min-height: 257px !important;\n' +
    '}\n' +
    // APPLE CALENDAR MAIN HEADER — top row only (his lock 2026-10-30).
    // Frosted white, clean type, facility as a pill. The mega-menu nav
    // row below is NOT touched (complex, needs live inspection).
    '#slHeader {\n' +
    '  background: rgba(255,255,255,0.85) !important;\n' +
    '  backdrop-filter: blur(20px) !important;\n' +
    '  -webkit-backdrop-filter: blur(20px) !important;\n' +
    '  border-bottom: 1px solid rgba(0,0,0,0.06) !important;\n' +
    '}\n' +
    '#mainPageHeader {\n' +
    '  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif !important;\n' +
    '}\n' +
    '#pccFacLink {\n' +
    '  background: #f2f2f7 !important;\n' +
    '  border-radius: 10px !important;\n' +
    '  padding: 8px 14px !important;\n' +
    '  font-weight: 500 !important;\n' +
    '  color: #3a3a3c !important;\n' +
    '  text-decoration: none !important;\n' +
    '}';
  var st = document.createElement('style');
  st.id = 'tmLayoutStyles';
  st.textContent = css;
  (document.head || document.documentElement).appendChild(st);
})();
