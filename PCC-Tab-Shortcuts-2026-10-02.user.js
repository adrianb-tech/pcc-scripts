// ==UserScript==
// @name         PCC Tab Shortcuts (letter keys + bright badges)
// @version 1.19
// @updateURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-Tab-Shortcuts-2026-10-02.user.js
// @downloadURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-Tab-Shortcuts-2026-10-02.user.js
// @namespace    pcc-tab-shortcuts
// @description  Letter badges + single-key tab jumps (Q/W/E/R yellow top row, V/B green bottom row, A focuses resident search). Context number keys: Profile 1=Admission Record; Forms 1=Psych 2=BIMS 3=All; Prog Notes 1=View All. C copies a chart snapshot (allergies, contact, BIMS, dx, psych meds). S copies "Last, First<TAB>room" for visit sheets (E/W prefix at Crown Heights only). F edits/copies the most recent psych note. 0 toggles everything off/on. Never fires while typing. Nothing runs on its own.
// @match        https://*.pointclickcare.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  /* ============================================================
     CONFIG — change your layout here, nothing else needed.
     - TAB_KEYS: badge letter -> tab label(s) to open.
       E tries FORMS first, then ASSMNTS / ASSESSMENTS (Boro Park).
     - Badge colors follow your keyboard rows (see ROW_BOTTOM):
       top-row letters (Q W E R T) get yellow badges,
       bottom-row letters (V B) get green badges.
     - 'A': focuses the resident search box.
     - 'C': copies the chart snapshot (allergies, primary contact, BIMS,
       diagnoses, psych meds) to the clipboard, formatted for your note.
       Data is collected as you browse the chart and cached per resident.
     - 'S': copies "Last, First<TAB>room-bed" for your visit sheets (tab
       separates it into two spreadsheet columns). Only Crown Heights gets
       the E/W wing prefix (E404A); all other facilities use the bare
       room-bed (404A, 707D).
     - '1'/'2'/'3': context keys (Profile / Forms / Prog Notes).
       Profile '1' matches ADMISSION RECORD or FACE SHEET (Boro Park name).
       Forms '1' = psych consult ("Psych: Consult" at Boro Park, else the
       non-retired psych consult form); '2' = BIMS, or the non-retired
       "SS: Social Service Assessment" at Boro Park; '3' = All types
       (at Boro Park: "MD: psychiatry consult acknowledgement form").
     - '0': kill-switch — pauses/resumes ALL shortcuts instantly.
     - Spacebar: in Dia only, switches split-view panel (sends Shift+Ctrl+[).
       In other browsers, spacebar does nothing (but never scrolls).
       Never fires while typing.
     The script NEVER clicks or navigates by itself; every action
     needs one of your keypresses. Badges are paint-only.
     ============================================================ */
  var TAB_KEYS = {
    'Q': ['DASH'],
    'W': ['PROFILE'],
    'E': ['FORMS', 'ASSMNTS', 'ASSESSMENTS'],
    'R': ['PROG NOTES'],
    'V': ['WTS/VITALS'],
    'B': ['RESULTS']
  };

  // Letters on the keyboard's bottom row get green badges (top row = yellow).
  var ROW_BOTTOM = ['V', 'B'];

  // Spacebar cycles through tabs in this order, wrapping around.
  // Uses the same label matching as TAB_KEYS (E covers FORMS/ASSMNTS).
  var SPACE_CYCLE = [
    ['DASH'],
    ['PROFILE'],
    ['ORDERS'],
    ['WTS/VITALS'],
    ['RESULTS'],
    ['FORMS', 'ASSMNTS', 'ASSESSMENTS'],
    ['PROG NOTES'],
    ['MISC']
  ];
  var spaceIdx = -1;  // tracked position; resynced from the active tab when detectable

  // Profile page: enlarge the Relationships box (label, names, Copy button)
  // to make it larger and more visible. Set to false to turn this off.
  var ENLARGE_RELATIONSHIPS = true;

  // Chart Snapshot: collectors cache per-resident data (allergies, contact,
  // psych meds, BIMS, diagnoses) in localStorage as you browse the chart.
  // A dashboard panel appears right of the allergies Copy button, and pressing
  // C copies a note-ready block. Set to false to turn this off.
  var SNAPSHOT_ENABLED = true;

  var ALL_TAB_LABELS = ['DASH', 'PROFILE', 'CENSUS', 'MED DIAG', 'PROBLEMS',
    'ALLERGIES', 'IMMUN', 'ORDERS', 'WTS/VITALS', 'RESULTS', 'MDS', 'FORMS',
    'THERAPY', 'PROG NOTES', 'CARE PLAN', 'TASKS', 'MISC'];

  var BADGE_ATTR = 'data-pcc-tabkey';
  var ROW_ATTR = 'data-pcc-row';
  var TONE_ATTR = 'data-pcc-tone';   // e.g. tone="red" for the F badge
  var NUM_ATTR = 'data-pcc-numkey';
  var CSS_ID = 'pcc-tabkey-style';
  var TYPEKEYS_ID = 'pcc-typekeys';
  var RELBOX_ATTR = 'data-pcc-relbox';
  var RELBOX_CSS_ID = 'pcc-relbox-style';
  var ABADGE_ID = 'pcc-a-badge';
  var OFF_ID = 'pcc-keys-off';
  var ADM_ALERT_ATTR = 'data-pcc-adm-alert';  // red box on stale admission date

  var enabled = true;   // master kill-switch, toggled with '0'

  // True once the user has taken focus themselves (typing, clicking, or
  // pressing A). After that, the script never auto-manages focus.
  var userTookFocus = false;
  var pageLoadAt = Date.now();
  var noteFieldDone = false;  // set once we've successfully focused the note field

  // Skip the search box on load: if PCC auto-focuses it while we're still in
  // the load window and the user hasn't taken focus, send focus straight to
  // where it belongs (F target on the form page, note field on the edit page)
  // instead of bouncing through search. Registered at document-start and runs
  // synchronously in the focus event, so no intermediate paint.
  // (Function declarations below are hoisted, so these are safe to call.)
  document.addEventListener('focus', function (e) {
    try {
      if (userTookFocus) return;
      if (Date.now() - pageLoadAt > 8000) return;
      var t = e.target;
      if (!t || t === document || t === document.body) return;
      var sbox = null;
      try { sbox = findResidentSearchBox(document); } catch (e2) {}
      if (!sbox || t !== sbox) return;  // only intercept the search box
      var dest = null;
      try {
        if (isBoroPark(document) && !findTypeSelect(document)) dest = findSectionEditLink(document);
        if (!dest) dest = findMainNoteField(document);
      } catch (e3) {}
      if (dest && dest !== t) {
        try {
          var dtag = (dest.tagName || '').toLowerCase();
          if (!dest.hasAttribute('tabindex') && !/^(a|button|input|textarea|select)$/.test(dtag)) {
            dest.setAttribute('tabindex', '-1');
          }
          dest.focus();
        } catch (e4) {}
      } else if (!dest) {
        try { t.blur(); } catch (e5) {}
      }
    } catch (e6) {}
  }, true);

  function norm(s) {
    return (s || '').replace(/\s+/g, ' ').trim().toUpperCase();
  }

  function visible(el) {
    return !!(el.getClientRects && el.getClientRects().length);
  }

  function depth(el, doc) {
    var d = 0, p = el;
    while (p && p !== doc.body && d < 60) { d++; p = p.parentNode; }
    return d;
  }

  function injectCSS(doc) {
    var style = doc.getElementById(CSS_ID);
    if (!style) {
      style = doc.createElement('style');
      style.id = CSS_ID;
      (doc.head || doc.documentElement).appendChild(style);
    }
    // Always refresh the rules so updates apply even when the style element
    // already exists from a previous version.
    style.textContent =
      '[' + BADGE_ATTR + ']::after {' +
      ' content: attr(' + BADGE_ATTR + ');' +
      ' display: inline-block; margin-left: 6px; padding: 2px 9px;' +
      ' font-size: 13px; font-weight: 900; line-height: 1.4;' +
      ' color: #000; background: #ffea00;' +
      ' border: 2px solid #7a6400; border-radius: 5px;' +
      ' box-shadow: 0 0 6px rgba(255,234,0,.9);' +
      ' vertical-align: 1px; cursor: pointer;' +
      '}' +
      '[' + BADGE_ATTR + '][' + ROW_ATTR + '="bottom"]::after {' +
      ' background: #00e676;' +
      ' border-color: #005c2e;' +
      ' box-shadow: 0 0 6px rgba(0,230,118,.9);' +
      '}' +
      '[' + BADGE_ATTR + '][' + TONE_ATTR + '="red"]::after {' +
      ' color: #fff; background: #ff2020;' +
      ' border-color: #8f0000;' +
      ' box-shadow: 0 0 6px rgba(255,32,32,.9);' +
      '}' +
      '[' + NUM_ATTR + ']::after {' +
      ' content: attr(' + NUM_ATTR + ');' +
      ' display: inline-block; margin-left: 6px; padding: 3px 12px;' +
      ' font-size: 18px; font-weight: 900; line-height: 1.4;' +
      ' color: #000; background: #ff9500;' +
      ' border: 2px solid #7a4a00; border-radius: 5px;' +
      ' box-shadow: 0 0 6px rgba(255,149,0,.9);' +
      ' vertical-align: 1px; cursor: pointer;' +
      '}' +
      // Admission alert: large red shaded box around a stale admission date
      '[' + ADM_ALERT_ATTR + '] {' +
      ' border: 4px solid #ff0000 !important;' +
      ' background: #ffcccc !important;' +
      ' padding: 6px 12px !important;' +
      ' border-radius: 6px !important;' +
      ' box-shadow: 0 0 12px rgba(255,0,0,.7) !important;' +
      ' display: inline-block !important;' +
      '}';
  }

  // The tab strip: deepest visible container holding most of the known tab labels.
  function findTabStrip(doc) {
    var cands = doc.querySelectorAll('div, table, ul, nav, section, td, tr, tbody, header');
    var best = null, bestDepth = -1;
    for (var i = 0; i < cands.length; i++) {
      var el = cands[i];
      if (!visible(el)) continue;
      var t = ' ' + norm(el.textContent) + ' ';
      var count = 0;
      for (var j = 0; j < ALL_TAB_LABELS.length; j++) {
        if (t.indexOf(' ' + ALL_TAB_LABELS[j] + ' ') !== -1) count++;
      }
      if (count >= 8) {
        var d = depth(el, doc);
        if (d > bestDepth) { bestDepth = d; best = el; }
      }
    }
    return best;
  }

  // Deepest visible element within `scope` whose full text is exactly the label.
  function findInScope(scope, doc, label) {
    var els = scope.querySelectorAll('a, button, td, li, span, div, th');
    var best = null, bestDepth = -1;
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (norm(el.textContent) !== label) continue;
      if (!visible(el)) continue;
      var d = depth(el, doc);
      if (d > bestDepth) { bestDepth = d; best = el; }
    }
    return best;
  }

  // Run fn(doc) in this window's document and same-origin child frames; first non-null wins.
  function findInFrames(win, fn) {
    var found = null;
    (function search(w) {
      if (found) return;
      try {
        found = fn(w.document) || null;
        for (var i = 0; i < w.frames.length && !found; i++) search(w.frames[i]);
      } catch (e) { /* cross-origin frame: skip */ }
    })(win);
    return found;
  }

  // Tabs are searched ONLY inside the tab strip (falls back to whole doc if no strip found).
  function findTab(labels) {
    return findInFrames(window.top, function (doc) {
      var strip = findTabStrip(doc);
      var scope = strip || doc;
      for (var i = 0; i < labels.length; i++) {
        var t = findInScope(scope, doc, labels[i]);
        if (t) return t;
      }
      return null;
    });
  }

  // Text of an element, falling back to `value` for <input type="button">
  // controls — PCC renders some buttons as inputs, whose textContent is empty,
  // so a text-only search would never find them.
  function elText(el) {
    var t = norm(el.textContent);
    if (t) return t;
    if (el.value) return norm(el.value);
    var a = el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('alt'));
    return a ? norm(a) : '';
  }

  // Spacebar: cycle through SPACE_CYCLE tabs in order, wrapping around.
  // Tries to resync from the currently active tab first; falls back to the
  // tracked index. Skips tabs not present on the page. Never fires while
  // typing (handled by the keydown guard).
  function spaceNextTab() {
    try {
      var found = findInFrames(window.top, function (doc) {
        var strip = findTabStrip(doc);
        if (!strip) return null;
        // Try to find the active tab to resync the index
        var activeText = null;
        try {
          var cands = strip.querySelectorAll('*');
          for (var i = 0; i < cands.length; i++) {
            var cls = ((cands[i].className || '').toString() || '').toLowerCase();
            var aria = cands[i].getAttribute && cands[i].getAttribute('aria-selected');
            if ((/active|selected|current/.test(cls) || aria === 'true') && visible(cands[i])) {
              var t = elText(cands[i]);
              if (t) { activeText = t; break; }
            }
          }
        } catch (e) {}
        if (activeText) {
          for (var si = 0; si < SPACE_CYCLE.length; si++) {
            for (var sj = 0; sj < SPACE_CYCLE[si].length; sj++) {
              if (activeText.indexOf(SPACE_CYCLE[si][sj]) !== -1) { spaceIdx = si; break; }
            }
            if (spaceIdx === si) break;
          }
        }
        // Try each tab in cycle order until one is found and clicked
        for (var attempt = 0; attempt < SPACE_CYCLE.length; attempt++) {
          spaceIdx = (spaceIdx + 1) % SPACE_CYCLE.length;
          var labels = SPACE_CYCLE[spaceIdx];
          for (var k = 0; k < labels.length; k++) {
            var tab = findInScope(strip, doc, labels[k]);
            if (tab) { tab.click(); return true; }
          }
        }
        return null;
      });
      return !!found;
    } catch (e) { return false; }
  }

  // All visible elements whose full text is exactly `text`, deepest first.
  function findByExactText(doc, text) {
    var els = doc.querySelectorAll('a, button, input[type="button"], input[type="submit"], span, td, div, li');
    var out = [];
    for (var i = 0; i < els.length; i++) {
      if (elText(els[i]) === text && visible(els[i])) out.push(els[i]);
    }
    out.sort(function (a, b) { return depth(b, doc) - depth(a, doc); });
    return out;
  }

  // True when el sits inside a container mentioning the add-note button
  // (case-insensitive — facilities word it differently).
  function nearAddNote(el) {
    var p = el.parentElement;
    for (var j = 0; j < 5 && p; j++, p = p.parentElement) {
      if (/add[^a-z]*progress note/i.test(p.textContent || '')) return true;
    }
    return false;
  }

  // Are we on a Progress Notes page? Gates the looser VIEW ALL fallbacks.
  function progNotesContext(doc) {
    var els = doc.querySelectorAll('a, button, input[type="button"], input[type="submit"], span, div, td');
    for (var i = 0; i < els.length; i++) {
      if (/add[^a-z]*progress note/i.test(elText(els[i]))) return true;
    }
    return false;
  }

  // VIEW ALL on the Progress Notes tab. Tiered: exact label near the add-note
  // button first, then looser facility label variants — but never outside a
  // Progress Notes page, so a stray "View All" elsewhere can't match.
  function findViewAll(doc) {
    var cands = findByExactText(doc, 'VIEW ALL');
    for (var i = 0; i < cands.length; i++) {
      if (nearAddNote(cands[i])) return cands[i];
    }
    if (!progNotesContext(doc)) return null;
    if (cands.length) return cands[0];
    var els = doc.querySelectorAll('a, button, input[type="button"], input[type="submit"]');
    for (var j = 0; j < els.length; j++) {
      if (visible(els[j]) && /view all/i.test(elText(els[j]))) return els[j];
    }
    // last resort: the control sitting next to the add-note button
    for (var m = 0; m < els.length; m++) {
      if (!/add[^a-z]*progress note/i.test(elText(els[m]))) continue;
      var p = els[m].parentElement;
      if (!p) continue;
      var sibs = p.querySelectorAll('a, button, input[type="button"], input[type="submit"]');
      for (var k = 0; k < sibs.length; k++) {
        if (sibs[k] !== els[m] && visible(sibs[k])) return sibs[k];
      }
    }
    return null;
  }

  // Click + press Enter (some PCC links need the Enter keystroke to activate).
  function activateEl(el) {
    el.click();
    try {
      var init = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
      el.dispatchEvent(new KeyboardEvent('keydown', init));
      el.dispatchEvent(new KeyboardEvent('keypress', init));
    } catch (e) {}
  }

  // ---- Forms/Assessments filter helpers ----
  // The filter bar: container holding the Apply button and (Status + Type) selects.
  function findFilterBar(doc) {
    var apply = findApply(doc);
    if (!apply) return null;
    var bar = apply.parentElement;
    while (bar && bar.querySelectorAll('select').length < 2 && bar.parentElement) bar = bar.parentElement;
    return (bar && bar.querySelectorAll('select').length >= 2) ? bar : null;
  }

  // The Type dropdown: the select preceded by a "Type" label inside the filter
  // bar. Works at every facility regardless of what the options are named.
  function findTypeSelect(doc) {
    var bar = findFilterBar(doc);
    if (bar) {
      var sels = bar.querySelectorAll('select');
      for (var i = 0; i < sels.length; i++) {
        var node = sels[i].previousSibling, label = '';
        while (node && !label) {
          label = norm(node.textContent || '');
          node = node.previousSibling;
        }
        if (/^type:?$/.test(label)) return sels[i];
      }
      if (sels.length >= 2) return sels[sels.length - 1]; // Status first, Type last
    }
    var all = doc.querySelectorAll('select'); // legacy fallback: option text has "consult form"
    for (var j = 0; j < all.length; j++) {
      if (/consult form/i.test(all[j].textContent)) return all[j];
    }
    return null;
  }

  function findApply(doc) {
    var els = doc.querySelectorAll('input[type="button"], input[type="submit"], button');
    for (var i = 0; i < els.length; i++) {
      if (/^apply$/i.test(norm(els[i].value || els[i].textContent))) return els[i];
    }
    return null;
  }

  // Pick ONE option from the Type dropdown: first current (non-retired) match wins.
  // 'psych': "Psych: Consult" (Boro Park) > psych consult form > any non-retired psych option.
  // 'bims': a non-retired BIMS option > the non-retired "SS: Social Service Assessment" (Boro Park).
  function pickTypeOption(sel, kind) {
    var opts = sel.options, i, t;
    if (kind === 'psych') {
      for (i = 0; i < opts.length; i++) { t = opts[i].text || ''; if (!/retired/i.test(t) && /^psych\s*:\s*consult/i.test(t)) return opts[i]; }
      for (i = 0; i < opts.length; i++) { t = opts[i].text || ''; if (!/retired/i.test(t) && /consult form/i.test(t) && /psych/i.test(t)) return opts[i]; }
      for (i = 0; i < opts.length; i++) { t = opts[i].text || ''; if (!/retired/i.test(t) && /psych/i.test(t)) return opts[i]; }
      return null;
    }
    if (kind === 'bims') {
      for (i = 0; i < opts.length; i++) { t = opts[i].text || ''; if (!/retired/i.test(t) && /bims/i.test(t)) return opts[i]; }
      for (i = 0; i < opts.length; i++) { t = opts[i].text || ''; if (!/retired/i.test(t) && /social service assessment/i.test(t)) return opts[i]; }
      return null;
    }
    if (kind === 'mdack') {
      for (i = 0; i < opts.length; i++) { t = opts[i].text || ''; if (!/retired/i.test(t) && /md\s*:/i.test(t) && /acknowledg/i.test(t)) return opts[i]; }
      for (i = 0; i < opts.length; i++) { t = opts[i].text || ''; if (!/retired/i.test(t) && /psychiatry consult/i.test(t) && /acknowledg/i.test(t)) return opts[i]; }
      return null;
    }
    for (i = 0; i < opts.length; i++) { t = opts[i].text || ''; if (/^all$/i.test(norm(t))) return opts[i]; } // 'all'
    return null;
  }

  function setTypeFilter(doc, kind) {
    var sel = findTypeSelect(doc);
    if (!sel) return false;
    var picked = pickTypeOption(sel, kind);
    if (!picked) return false;
    for (var j = 0; j < sel.options.length; j++) sel.options[j].selected = (sel.options[j] === picked);
    try { sel.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
    var apply = findApply(doc);
    if (apply) { apply.click(); return true; }
    return false;
  }

  // Context number keys, scoped by page so a key can never hit another tab's button:
  // Forms/Assessments -> Type filter, Progress Notes -> View All, otherwise -> Admission Record.
  function handleNumber(k) {
    if (k === '1') {
      // Forms/Assessments page: filter Type to the psych consult form
      var acted = findInFrames(window.top, function (doc) {
        if (!findTypeSelect(doc)) return null;
        return setTypeFilter(doc, 'psych') ? true : null;
      });
      if (acted) return true;
      // Progress Notes page: View All
      var va = findInFrames(window.top, findViewAll);
      if (va) { activateEl(va); return true; }
    } else {
      // Forms/Assessments page: 2 = BIMS, 3 = All (Boro Park: MD acknowledgement form)
      var acted2 = findInFrames(window.top, function (doc) {
        if (!findTypeSelect(doc)) return null;
        if (k === '2') return setTypeFilter(doc, 'bims') ? true : null;
        // '3': at Boro Park try the MD acknowledgement form first, fall back to All
        if (isBoroPark(doc) && setTypeFilter(doc, 'mdack')) return true;
        return setTypeFilter(doc, 'all') ? true : null;
      });
      if (acted2) return true;
    }
    if (k === '1') {
      // Profile page: Admission Record — called "Face Sheet" at Boro Park
      var adm = findInFrames(window.top, function (doc) {
        var c = findByExactText(doc, 'ADMISSION RECORD');
        if (c.length) return c[0];
        var f = findByExactText(doc, 'FACE SHEET');
        return f[0] || null;
      });
      if (adm) { activateEl(adm); return true; }
    }
    return false;
  }

  // ---- G key: push all Copy-button values on this page to the note ----
  // Finds every .pcc-fill-copy button, clicks them (each drops a fill request
  // for the note panel). Skips Allergies if NKA. On the form page itself,
  // the Boro Park script's G handles the snapshot fill instead.
  document.addEventListener('keydown', function(e){
    try {
      if (!e.isTrusted) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var t = e.target;
      var tag = (t && t.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || (t && t.isContentEditable)) return;
      if (e.key !== 'g' && e.key !== 'G') return;
      // On the Psych Consult form, the Boro Park script owns G.
      var bodyT = document.body ? document.body.innerText : '';
      if (/A\.\s*Evaluation Type/i.test(bodyT)) return;
      var btns = document.querySelectorAll('.pcc-fill-copy');
      if (!btns.length) return;
      e.preventDefault();
      var n = 0;
      for (var i = 0; i < btns.length; i++) {
        var b = btns[i];
        if (!b || b.disabled || b.offsetParent === null) continue;
        var label = b.getAttribute('data-fill-label') || '';
        var val = b.getAttribute('data-fill-value') || '';
        // Skip Allergies when it's NKA — nothing to push.
        if (/allerg/i.test(label) && /^\s*(NKA|NKDA|none)\b/i.test(val)) continue;
        try { b.click(); n++; } catch(err){}
      }
      if (n) {
        var badge = document.createElement('div');
        badge.textContent = 'Pushed ' + n + ' to note';
        badge.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#1d4ed8;color:#fff;padding:8px 16px;border-radius:8px;font:14px sans-serif;z-index:999999;';
        document.body.appendChild(badge);
        setTimeout(function(){ badge.remove(); }, 1500);
      }
    } catch(err){}
  });

  // ---- D key: GDR section auto-fill (CNR/Saints only) ----
  // Reads the Psych meds from the note's Impression section, then:
  // - Q4 = C (N/A) if no meds, or only dementia meds / Ambien / melatonin
  // - Q4 = B (No) if on any other psychotropic, then fills:
  //   4b.a checked, 4b1 per indication, 4c.d checked, 4c1 = "see plan"
  function doGDRFill(doc) {
    try {
      if (!isCNROrSaints(doc)) { toast('D: CNR/Saints form only'); return; }
      if (!isConsultPsychiatryFormPage(doc)) { toast('D: not a psych consult form'); return; }

      // Find the Impression/Diagnosis textarea (section 5) and extract Psych meds
      var psychMedsText = '';
      var textareas = doc.querySelectorAll('textarea');
      for (var i = 0; i < textareas.length; i++) {
        var tv = textareas[i].value || '';
        if (/psych\s*meds/i.test(tv)) { psychMedsText = tv; break; }
      }
      // Fallback: search all text for a Psych meds block
      if (!psychMedsText) {
        var bodyT = doc.body ? doc.body.innerText : '';
        var m = bodyT.match(/psych\s*meds\s*\n([\s\S]{0,2000}?)(?=\n\s*(?:PLAN|DOS|DX|Allergies)\b)/i);
        if (m) psychMedsText = m[0];
      }

      // Parse med lines: "- Zoloft 50mg QD for depression and anxiety"
      var medLines = psychMedsText.split('\n').filter(function(l){
        return /^\s*-\s*\S/.test(l) && /psych\s*meds/i.test(psychMedsText.split('\n').slice(0, psychMedsText.split('\n').indexOf(l)).join('\n') + '\n' + l) || /for\s+\w+/i.test(l);
      });
      // Simpler: get lines between "Psych meds" and "PLAN"
      var inMeds = false, meds = [];
      var lines = psychMedsText.split('\n');
      for (var li = 0; li < lines.length; li++) {
        var ln = lines[li];
        if (/^\s*psych\s*meds/i.test(ln)) { inMeds = true; continue; }
        if (/^\s*plan\b/i.test(ln)) { inMeds = false; break; }
        if (inMeds && /^\s*-\s*\S/.test(ln)) meds.push(ln.trim());
      }

      // Dementia meds, Ambien, melatonin → excluded (not psychotropics for GDR)
      var excluded = /donepezil|aricept|memantine|namenda|rivastigmine|exelon|galantamine|razadyne|zolpidem|ambien|melatonin/i;
      var qualifying = meds.filter(function(med){ return !excluded.test(med); });

      // Find Q4 radios: look for "not on any psychotropic medication" (option C)
      var radios = doc.querySelectorAll('input[type="radio"]');
      var q4c = null, q4b = null;
      // Find by nearby label text
      for (var r = 0; r < radios.length; r++) {
        var lbl = '';
        var parent = radios[r].parentElement;
        if (parent) lbl = (parent.textContent || '');
        // Also check following siblings
        var sib = radios[r].nextSibling;
        while (sib && lbl.length < 100) {
          if (sib.nodeType === 3) lbl += sib.nodeValue;
          else if (sib.nodeType === 1) lbl += (sib.textContent || '');
          sib = sib.nextSibling;
        }
        if (/not on any psychotropic/i.test(lbl)) q4c = radios[r];
        // Q4b is the "No" option — harder to identify; look for 4b section context
      }

      if (qualifying.length === 0) {
        // No qualifying meds → Q4 = C (N/A)
        if (q4c && !q4c.checked) { fireClick(q4c); toast('D: Q4 = N/A (no psychotropics)'); }
        else toast('D: Q4 already N/A');
        return;
      }

      // Has qualifying meds → Q4 = B (No), fill 4b/4b1/4c/4c1
      // Find Q4b: the "No" radio in question 4 (before 4b section)
      // Strategy: find 4b.a checkbox first, then Q4 radios are before it
      var allInputs = doc.querySelectorAll('input[type="radio"], input[type="checkbox"]');
      var q4radios = [];
      var found4b = false;
      for (var ai = 0; ai < allInputs.length; ai++) {
        var at = (allInputs[ai].parentElement ? allInputs[ai].parentElement.textContent : '') || '';
        if (/personally assessed this resident/i.test(at)) { found4b = true; break; }
        if (allInputs[ai].type === 'radio') q4radios.push(allInputs[ai]);
      }
      // Q4b is likely the last radio before 4b section; Q4 has 3 options (a/b/c)
      // Take the last 3 radios before 4b as Q4a, Q4b, Q4c
      if (q4radios.length >= 3) {
        var q4bRadio = q4radios[q4radios.length - 2]; // b is middle of a/b/c
        if (q4bRadio && !q4bRadio.checked) fireClick(q4bRadio);
      }

      // 4b.a: "I have personally assessed..."
      var checkboxes = doc.querySelectorAll('input[type="checkbox"]');
      for (var c = 0; c < checkboxes.length; c++) {
        var ct = (checkboxes[c].parentElement ? checkboxes[c].parentElement.textContent : '') || '';
        if (/personally assessed this resident/i.test(ct) && !checkboxes[c].checked) {
          fireClick(checkboxes[c]);
          break;
        }
      }

      // 4b1: map indication from psych meds to a-g
      // Priority: schizophrenia > bipolar > depression > psychotic > anxiety
      var indications = qualifying.join(' ').toLowerCase();
      var target41 = null; // 'a' through 'g'
      if (/schizophrenia|schizoaffective/i.test(indications)) target41 = 'a';
      else if (/bipolar/i.test(indications)) target41 = 'b';
      else if (/depress/i.test(indications)) target41 = 'c';
      else if (/huntington/i.test(indications)) target41 = 'd';
      else if (/tourette/i.test(indications)) target41 = 'e';
      else if (/psychotic|psychosis/i.test(indications)) target41 = 'f';
      else if (/anxiety/i.test(indications)) target41 = 'g';

      if (target41) {
        // Find 4b1 checkboxes: they're in the "Specify Chronic Enduring Condition" section
        // Look for the label text matching the option
        var labels41 = {
          'a': /schizophrenia/i, 'b': /bipolar disorder/i, 'c': /major depressive disorder/i,
          'd': /huntington/i, 'e': /tourette/i, 'f': /psychotic disorders.*other than schizophrenia/i,
          'g': /anxiety disorder/i
        };
        var in41 = false;
        for (var c2 = 0; c2 < checkboxes.length; c2++) {
          var p2 = checkboxes[c2].parentElement;
          var pt2 = p2 ? (p2.textContent || '') : '';
          // Track if we're in 4b1 section
          if (/specify chronic enduring condition/i.test(pt2)) in41 = true;
          if (/specify contraindication/i.test(pt2)) in41 = false;
          if (in41 && labels41[target41].test(pt2) && !checkboxes[c2].checked) {
            fireClick(checkboxes[c2]);
            break;
          }
        }
      }

      // 4c.d: "other"
      var in4c = false;
      for (var c3 = 0; c3 < checkboxes.length; c3++) {
        var p3 = checkboxes[c3].parentElement;
        var pt3 = p3 ? (p3.textContent || '') : '';
        if (/specify contraindication of dose reduction/i.test(pt3)) in4c = true;
        if (/specify other/i.test(pt3)) in4c = false;
        if (in4c && /^\s*d\.\s*other/i.test(pt3.trim()) && !checkboxes[c3].checked) {
          fireClick(checkboxes[c3]);
          break;
        }
      }

      // 4c1: "see plan"
      for (var ta = 0; ta < textareas.length; ta++) {
        var prev = textareas[ta].parentElement ? textareas[ta].parentElement.textContent : '';
        // Check if this textarea is under "4c1. Specify other:"
        var section = '';
        var el = textareas[ta];
        for (var d = 0; d < 5 && el; d++) {
          section = (el.textContent || '') + ' ' + section;
          el = el.parentElement;
        }
        if (/4c1|specify other/i.test(section) && !/impression|diagnosis/i.test(section)) {
          if (!/see plan/i.test(textareas[ta].value)) {
            textareas[ta].value = 'see plan';
            textareas[ta].dispatchEvent(new Event('change', { bubbles: true }));
          }
          break;
        }
      }

      toast('D: GDR filled (' + qualifying.length + ' meds, 4b1=' + (target41 || '?') + ')');

      // Update the DOS date line in the note to the stored DOS date
      updateDOSDate(doc);

      // Compare note psych meds vs chart psych meds (from G-push cache)
      checkMedsMatch(doc, meds);
    } catch(e){ toast('D: error'); }
  }

  // Brand/generic normalization for med comparison
  var MED_SYNONYMS = {
    'sertraline': 'zoloft', 'zoloft': 'zoloft',
    'fluoxetine': 'prozac', 'prozac': 'prozac',
    'escitalopram': 'lexapro', 'lexapro': 'lexapro',
    'citalopram': 'celexa', 'celexa': 'celexa',
    'paroxetine': 'paxil', 'paxil': 'paxil',
    'mirtazapine': 'remeron', 'remeron': 'remeron',
    'bupropion': 'wellbutrin', 'wellbutrin': 'wellbutrin',
    'venlafaxine': 'effexor', 'effexor': 'effexor',
    'duloxetine': 'cymbalta', 'cymbalta': 'cymbalta',
    'quetiapine': 'seroquel', 'seroquel': 'seroquel',
    'olanzapine': 'zyprexa', 'zyprexa': 'zyprexa',
    'risperidone': 'risperdal', 'risperdal': 'risperdal',
    'aripiprazole': 'abilify', 'abilify': 'abilify',
    'memantine': 'namenda', 'namenda': 'namenda',
    'donepezil': 'aricept', 'aricept': 'aricept',
    'trazodone': 'trazodone', 'lorazepam': 'ativan', 'ativan': 'ativan',
    'clonazepam': 'klonopin', 'klonopin': 'klonopin',
    'alprazolam': 'xanax', 'xanax': 'xanax',
    'haloperidol': 'haldol', 'haldol': 'haldol'
  };
  function canonMedName(name) {
    var n = (name || '').toLowerCase().trim();
    return MED_SYNONYMS[n] || n;
  }
  function extractDrugName(line) {
    // "- Zoloft 50mg QD for depression" → "zoloft"
    var m = (line || '').replace(/^\s*-\s*/, '').match(/^([A-Za-z]+)/);
    return m ? canonMedName(m[1]) : '';
  }

  // Compare the note's psych meds against the chart's (from G-push cache).
  // Alerts if they don't match — med rec check.
  function checkMedsMatch(doc, noteMeds) {
    try {
      var cached = null;
      try { cached = JSON.parse(localStorage.getItem('pccFillPsychMeds') || 'null'); } catch(e){}
      if (!cached || !cached.value) {
        toast('D: no chart meds cached — press G on the profile page first');
        return;
      }
      // Check freshness (older than 2 hours = stale)
      var ageHrs = (Date.now() - (cached.ts || 0)) / 3600000;
      if (ageHrs > 2) {
        toast('D: chart meds cache is ' + Math.round(ageHrs) + 'h old — re-press G on profile');
      }
      var chartLines = (cached.value || '').split('\n').filter(function(l){ return l.trim(); });
      var chartMeds = chartLines.map(extractDrugName).filter(function(n){ return n; });
      var noteMedNames = (noteMeds || []).map(extractDrugName).filter(function(n){ return n; });

      var inNoteNotChart = noteMedNames.filter(function(n){ return chartMeds.indexOf(n) === -1; });
      var inChartNotNote = chartMeds.filter(function(n){ return noteMedNames.indexOf(n) === -1; });

      if (inNoteNotChart.length === 0 && inChartNotNote.length === 0) {
        toast('D: meds match chart ✓');
      } else {
        var msg = 'D: MED MISMATCH — ';
        if (inNoteNotChart.length) msg += 'in note not chart: ' + inNoteNotChart.join(', ') + '. ';
        if (inChartNotNote.length) msg += 'in chart not note: ' + inChartNotNote.join(', ') + '.';
        // Persistent alert (not auto-fading) for mismatches
        var alertBox = doc.createElement('div');
        alertBox.textContent = msg;
        alertBox.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);' +
          'background:#c0392b;color:#fff;padding:12px 20px;border-radius:8px;font:14px sans-serif;' +
          'z-index:999999;max-width:80%;box-shadow:0 4px 12px rgba(0,0,0,0.3);cursor:pointer;';
        alertBox.title = 'Click to dismiss';
        alertBox.addEventListener('click', function(){ alertBox.remove(); });
        doc.body.appendChild(alertBox);
        setTimeout(function(){ if (alertBox.parentNode) alertBox.remove(); }, 15000);
      }
    } catch(e){}
  }

  // Stored DOS date (set once a week via Shift+D). Used by D to update
  // the "DOS - pt was evaluated on [date]" line when copy-pasting notes.
  function getDOSDate() {
    try { return localStorage.getItem('pccDOSDate') || ''; } catch(e){ return ''; }
  }
  function setDOSDate(v) {
    try { localStorage.setItem('pccDOSDate', v); } catch(e){}
  }
  function promptDOSDate() {
    var cur = getDOSDate();
    var v = prompt('DOS date for this week (M/D/YY):', cur || '');
    if (v && v.trim()) { setDOSDate(v.trim()); toast('DOS date set: ' + v.trim()); }
  }

  // Find "DOS - pt was evaluated on [old date]" in the Impression textarea
  // and replace the date with the stored DOS date.
  function updateDOSDate(doc) {
    try {
      var dosDate = getDOSDate();
      if (!dosDate) { promptDOSDate(); dosDate = getDOSDate(); if (!dosDate) return; }
      var textareas = doc.querySelectorAll('textarea');
      for (var i = 0; i < textareas.length; i++) {
        var v = textareas[i].value || '';
        if (/DOS\s*-\s*pt was evaluated on/i.test(v)) {
          var nv = v.replace(/(DOS\s*-\s*pt was evaluated on\s*)\S+/i, '$1' + dosDate);
          if (nv !== v) {
            textareas[i].value = nv;
            textareas[i].dispatchEvent(new Event('input', { bubbles: true }));
            textareas[i].dispatchEvent(new Event('change', { bubbles: true }));
            toast('D: DOS date → ' + dosDate);
          }
          return;
        }
      }
    } catch(e){}
  }

  document.addEventListener('keydown', function(e){
    try {
      if (!e.isTrusted) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var t = e.target;
      var tag = (t && t.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || (t && t.isContentEditable)) return;
      if (e.key !== 'd' && e.key !== 'D') return;
      e.preventDefault();
      // Shift+D: set the DOS date for the week. Plain D: GDR fill + DOS update.
      if (e.shiftKey) { promptDOSDate(); return; }
      doGDRFill(document);
    } catch(err){}
  });

  // ---- F key: edit the most recent psych note (Boro Park only) ----
  // Boro Park detection: the header facility picker shows the facility name.
  // Also checks the page footer, which always names the current facility —
  // the form window may not have the header picker. Falls back to the top
  // document and the opener window, so it works in popups and iframes too.
  // Scoped so a facility mention deep in the chart can't false-positive.
  function isBoroParkInDoc(doc) {
    try {
      var els = doc.querySelectorAll('select, button, a, span, div, td, b, strong, p, li');
      var docH = 0, scrollY = 0;
      try { docH = Math.max(doc.body ? doc.body.scrollHeight : 0, doc.documentElement ? doc.documentElement.scrollHeight : 0); } catch (e) {}
      try { scrollY = window.scrollY || window.pageYOffset || 0; } catch (e2) {}
      for (var i = 0; i < els.length; i++) {
        var t = (els[i].textContent || '').trim();
        if (t.length > 90 || t.length < 6) continue;
        if (!/boro[\s-]*park/i.test(t)) continue;
        var r = null;
        try { r = els[i].getBoundingClientRect(); } catch (e3) {}
        if (!r || !r.width) continue;
        if ((r.top >= -50 && r.top < 300) || (docH > 0 && (r.top + scrollY) > docH - 600)) return true;
      }
    } catch (e) {}
    return false;
  }
  function isBoroPark(doc) {
    try { if (isBoroParkInDoc(doc)) return true; } catch (e) {}
    try {
      var topDoc = window.top.document;
      if (topDoc && topDoc !== doc && isBoroParkInDoc(topDoc)) return true;
    } catch (e2) {}
    try {
      if (window.opener && !window.opener.closed && window.opener.document &&
          isBoroParkInDoc(window.opener.document)) return true;
    } catch (e3) {}
    return false;
  }

  // The "edit" link on the most recent psych assessment row. Table order is
  // Assessment Date descending, so the first psych row with an edit link wins.
  function findPsychEditLink(doc) {
    try {
      var tables = doc.querySelectorAll('table');
      for (var ti = 0; ti < tables.length; ti++) {
        var first = tables[ti].querySelector('tr');
        if (!first) continue;
        var hcells = first.querySelectorAll('th, td'), di = -1, h;
        for (h = 0; h < hcells.length; h++) {
          if (norm(hcells[h].textContent) === 'DESCRIPTION') di = h;
        }
        if (di === -1) continue;
        var hdrTxt546 = norm(first.textContent);
        if (hdrTxt546.indexOf('ASSESSMENT DATE') === -1 && hdrTxt546.indexOf('FORM DATE') === -1) continue;
        var rows = tables[ti].querySelectorAll('tr');
        for (var r = 1; r < rows.length; r++) {
          if (rows[r].querySelector('tr')) continue;   // skip nested tables
          var cells = rows[r].querySelectorAll('td');
          if (cells.length <= di) continue;
          if (!/psych/i.test(cells[di].textContent || '')) continue;
          var links = rows[r].querySelectorAll('a');
          for (var li = 0; li < links.length; li++) {
            if (/^\s*edit\s*$/i.test(links[li].textContent || '')) return links[li];
          }
          // psych row without an edit link: keep looking at older psych rows
        }
      }
    } catch (e) {}
    return null;
  }

  // Most recent psych note's Assessment Date (table is date-descending, so the
  // first psych row wins). Null if none found or date unparseable.
  function getLastPsychDate(doc) {
    try {
      var tables = doc.querySelectorAll('table');
      for (var ti = 0; ti < tables.length; ti++) {
        var first = tables[ti].querySelector('tr');
        if (!first) continue;
        var hcells = first.querySelectorAll('th, td'), di = -1, ai = -1, h;
        for (h = 0; h < hcells.length; h++) {
          var ht = norm(hcells[h].textContent);
          if (ht === 'DESCRIPTION') di = h;
          if (ht === 'ASSESSMENT DATE') ai = h;
        }
        if (di === -1 || ai === -1) continue;
        var rows = tables[ti].querySelectorAll('tr');
        for (var r = 1; r < rows.length; r++) {
          if (rows[r].querySelector('tr')) continue;
          var cells = rows[r].querySelectorAll('td');
          if (cells.length <= Math.max(di, ai)) continue;
          if (!/psych/i.test(cells[di].textContent || '')) continue;
          var m = (cells[ai].textContent || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
          if (m) return new Date(m[3], m[1] - 1, m[2]);
          return null;
        }
      }
    } catch (e) {}
    return null;
  }

  // The "Admission (re-entry)" date from the resident header, plus the element
  // to highlight. Null if not found.
  function getAdmissionInfo(doc) {
    try {
      var els = doc.querySelectorAll('div, span, td, p, b, strong, font, label, th, a');
      var best = null, bestSize = Infinity, i;
      for (i = 0; i < els.length; i++) {
        var el = els[i];
        if (!/admission\s*\(re-entry\)/i.test(el.textContent || '')) continue;
        if (!visible(el)) continue;
        // Prefer the smallest (most specific) element holding the label
        var size = (el.textContent || '').length;
        if (size < bestSize) { bestSize = size; best = el; }
      }
      if (!best) return null;
      // Walk up to find a container holding a date
      var container = best, m = null, date = null;
      for (var depth = 0; depth < 5 && container; depth++) {
        m = (container.textContent || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (m) { date = new Date(m[3], m[1] - 1, m[2]); break; }
        container = container.parentElement;
      }
      if (!date || !container) return null;
      // Highlight the smallest element holding the date; fall back to container.
      var dateStr = m[0], hl = null;
      var cands = container.querySelectorAll('*');
      for (i = 0; i < cands.length; i++) {
        if (cands[i].children.length === 0 && (cands[i].textContent || '').indexOf(dateStr) !== -1) {
          hl = cands[i]; break;
        }
      }
      return { date: date, el: hl || container };
    } catch (e) { return null; }
  }

  // Admission alert: if the (re-)admission date is newer than the last psych
  // note (or there is no psych note), the resident needs a new consult —
  // put a large red shaded box around the admission date. Only runs when the
  // list is showing psych forms (Type = All or psych); skipped when filtered
  // to BIMS or other non-psych forms. Backs off if the standalone
  // PCC-Forms-Readmission-flag script is active (it handles this with more
  // detail) to avoid the two scripts fighting over the same element.
  function highlightStaleAdmission(doc) {
    try {
      // If the standalone Readmission-flag script is active, let it handle this
      // entirely — remove our attribute to avoid nested/conflicting boxes.
      if (doc.getElementById('tmReadmitBox')){
        var old = doc.querySelector('[' + ADM_ALERT_ATTR + ']');
        if (old) old.removeAttribute(ADM_ALERT_ATTR);
        return;
      }
      var sel = findTypeSelect(doc);
      if (!sel) return;  // need the assessments table
      // Check the Type filter — only proceed if showing psych forms
      var selText = '';
      try {
        var opt = sel.options[sel.selectedIndex];
        selText = opt ? (opt.text || '') : '';
      } catch (e) {}
      var showingPsych = /^\s*all\s*$/i.test(selText) || /psych/i.test(selText);
      if (!showingPsych) {
        // Filtered to non-psych (e.g. BIMS) — clear any stale alert and skip
        var old = doc.querySelector('[' + ADM_ALERT_ATTR + ']');
        if (old) old.removeAttribute(ADM_ALERT_ATTR);
        return;
      }
      var adm = getAdmissionInfo(doc);
      if (!adm) return;
      var lastPsych = getLastPsychDate(doc);
      var stale = !lastPsych || adm.date > lastPsych;
      if (stale) {
        if (!adm.el.hasAttribute(ADM_ALERT_ATTR)) adm.el.setAttribute(ADM_ALERT_ATTR, '1');
      } else {
        adm.el.removeAttribute(ADM_ALERT_ATTR);
      }
    } catch (e) {}
  }

  // The "edit" control on the assessment form page (the page you land on after
  // opening the assessment). Confirmed as a form page by its markers (Sign All
  // toolbar, or Section+Description headers), then the first visible "edit"
  // control wins — deepest element, so a link inside a cell beats the cell.
  function findSectionEditLink(doc) {
    try {
      if (findTypeSelect(doc)) return null;   // assessments list has its own finder
      var bodyText = norm(doc.body ? doc.body.textContent : '');
      var isForm = bodyText.indexOf('SIGN ALL') !== -1 ||
                   (bodyText.indexOf('SECTION') !== -1 && bodyText.indexOf('DESCRIPTION') !== -1);
      if (!isForm) return null;
      var cands = doc.querySelectorAll('a, button, input[type="button"], input[type="submit"], span, div, td, li');
      var best = null;
      for (var i = 0; i < cands.length; i++) {
        var el = cands[i];
        var t = (el.textContent || '').trim();
        var isEdit = /^\s*edit\s*$/i.test(t) || (el.value && /^\s*edit\s*$/i.test(el.value));
        if (!isEdit || !visible(el)) continue;
        if (!best) { best = el; continue; }
        if (best.contains(el)) best = el;   // deeper element for the same edit
      }
      return best;
    } catch (e) {}
    return null;
  }

  // Form page: the section action link — "edit" if the section is open,
  // "reopen" if it's signed (un-signs it for editing), "view" as a last
  // resort. findSectionEditLink only finds "edit", which doesn't exist on
  // signed sections. Searches broadly (PCC uses grids here, not tables).
  function findSectionActionLink(doc) {
    var editLink = findSectionEditLink(doc);
    if (editLink) return editLink;
    try {
      if (findTypeSelect(doc)) return null;   // assessments list has its own finder
      var bodyText = norm(doc.body ? doc.body.textContent : '');
      if (bodyText.indexOf('SECTION') === -1 || bodyText.indexOf('DESCRIPTION') === -1) return null;
      var cands = doc.querySelectorAll('a, button, input[type="button"], input[type="submit"], span');
      var reopen = null, view = null, i, t;
      for (i = 0; i < cands.length; i++) {
        t = ((cands[i].textContent || '') + ' ' + (cands[i].value || '')).trim().toLowerCase();
        if (t !== 'reopen' && t !== 'view') continue;
        if (!visible(cands[i])) continue;
        if (t === 'reopen' && !reopen) reopen = cands[i];
        if (t === 'view' && !view) view = cands[i];
      }
      if (reopen) return reopen;
      if (view) return view;
    } catch (e) {}
    return null;
  }

  // Largest visible textarea on a form section edit page (Save & Sign & Exit
  // present) — the main writing field. Falls back to a large contenteditable
  // or text input if no textarea qualifies. Null elsewhere.
  function findMainNoteField(doc) {
    try {
      var bodyText = (doc.body && doc.body.textContent) || '';
      if (!/save\s*&\s*sign\s*&\s*exit/i.test(bodyText)) return null;
      var best = null, bestArea = 0, i, el, r, a;
      var areas = doc.querySelectorAll('textarea');
      for (i = 0; i < areas.length; i++) {
        el = areas[i];
        if (!visible(el) || el.disabled || el.readOnly) continue;
        r = el.getBoundingClientRect();
        a = r.width * r.height;
        if (a > bestArea) { bestArea = a; best = el; }
      }
      if (best) return best;
      // fallback: large contenteditable or text input
      var others = doc.querySelectorAll('[contenteditable="true"], input[type="text"]');
      for (i = 0; i < others.length; i++) {
        el = others[i];
        if (!visible(el) || el.disabled || el.readOnly) continue;
        r = el.getBoundingClientRect();
        a = r.width * r.height;
        if (a > 20000 && a > bestArea) { bestArea = a; best = el; }
      }
      return best;
    } catch (e) { return null; }
  }

  // On a form section edit page (Save & Sign & Exit buttons present), focus the
  // main writing field — the largest visible textarea — on load, so he can
  // type immediately instead of landing in the search box. Keeps trying until
  // it succeeds (the form may load via AJAX after DOMContentLoaded). Never
  // steals focus from a link/button (e.g. the F target), a field he's typed
  // in, or once he's taken focus himself.
  function focusNoteField(doc) {
    try {
      if (userTookFocus || noteFieldDone) return;
      var best = findMainNoteField(doc);
      if (!best) return;
      var ae = null;
      try { ae = doc.activeElement; } catch (e) {}
      if (ae && ae !== doc.body) {
        var tag = (ae.tagName || '').toLowerCase();
        var isField = /^(input|textarea|select)$/.test(tag) || ae.isContentEditable;
        if (!isField) return;   // focus is on a link/button — leave it
        if (ae.value) return;   // he's typed — leave it
      }
      if (ae !== best) { try { best.focus(); } catch (e2) {} }
      // confirm it stuck; if so, stop trying
      try {
        if (doc.activeElement === best) noteFieldDone = true;
      } catch (e3) {}
    } catch (e4) {}
  }

  // Check if the Reasons for Assessment popup is open
  function isReasonsPopupOpen(doc) {
    try {
      var walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null, false);
      var tn;
      while (tn = walker.nextNode()) {
        if ((tn.nodeValue || '').trim() === 'Reasons for Assessment') return true;
      }
    } catch(e){}
    return false;
  }

  // Add F badge to the Reasons popup Save button
  function badgeReasonsPopupSave(doc) {
    try {
      var walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null, false);
      var tn, titleEl = null;
      while (tn = walker.nextNode()) {
        if ((tn.nodeValue || '').trim() === 'Reasons for Assessment') { titleEl = tn.parentElement; break; }
      }
      if (!titleEl) return;
      var container = titleEl;
      for (var d = 0; d < 8 && container; d++) {
        var btns = container.querySelectorAll('button, input[type="button"], input[type="submit"]');
        for (var b = 0; b < btns.length; b++) {
          var bt = ((btns[b].textContent || '') + ' ' + (btns[b].value || '')).trim();
          if (/^Save$/i.test(bt) && !btns[b].hasAttribute(BADGE_ATTR)) {
            btns[b].setAttribute(BADGE_ATTR, 'F');
            btns[b].setAttribute(TONE_ATTR, 'red');
            btns[b].setAttribute('title', 'Shortcut: press F');
          }
        }
        container = container.parentElement;
        if (!container || container === doc.body) break;
      }
    } catch(e){}
  }

  // Red "F" badge on the F target's edit link. Removed when not applicable.
  // On the form page, also makes the F target the active (focused) element
  // shortly after load, so F works immediately instead of being swallowed by
  // PCC's auto-focused search box. Never steals focus once you've typed.
  // Works at any facility: on the forms/assessments list it badges the most
  // recent psych row's edit link; on a form page it badges the section edit
  // link. (The clickable F button covers completed rows with no edit link.)
  function applyFBadge(doc) {
    try {
      // If Reasons popup is open, F = Save on the popup. Suppress the
      // copy-link badge and badge the popup Save instead.
      if (isReasonsPopupOpen(doc)) {
        var olds = doc.querySelectorAll('[' + BADGE_ATTR + '="F"]'), i;
        for (i = 0; i < olds.length; i++) { olds[i].removeAttribute(BADGE_ATTR); olds[i].removeAttribute(TONE_ATTR); }
        badgeReasonsPopupSave(doc);
        return;
      }
      var links = [];
      {
        var link = null;
        if (findTypeSelect(doc)) {
          // Assessments list: badge the most recent psych row's edit link.
          link = findPsychEditLink(doc);
        } else if (isPsychConsultFormPage(doc) || isConsultPsychiatryFormPage(doc)) {
          // Form page only: badge the section edit link. Other pages
          // (resident search, dashboard, etc.) get no badge.
          link = findSectionEditLink(doc);
        }
        if (link) links.push(link);
      }
      var olds = doc.querySelectorAll('[' + BADGE_ATTR + '="F"]'), i;
      for (i = 0; i < olds.length; i++) {
        if (links.indexOf(olds[i]) === -1) { olds[i].removeAttribute(BADGE_ATTR); olds[i].removeAttribute(TONE_ATTR); }
      }
      for (i = 0; i < links.length; i++) {
        if (!links[i].hasAttribute(BADGE_ATTR)) {
          links[i].setAttribute(BADGE_ATTR, 'F');
          links[i].setAttribute(TONE_ATTR, 'red');
          links[i].setAttribute('title', 'Shortcut: press F');
        }
      }
      // Form page only (section link, no Type filter): focus the F target so
      // it's the active element and F fires on the first press.
      if (links.length && !findTypeSelect(doc) && Date.now() - pageLoadAt < 8000) {
        var target = links[0], ae = null;
        try { ae = doc.activeElement; } catch (e) {}
        if (!(ae && ae.value)) {
          if (ae !== target) {
            try {
              if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
              target.focus();
            } catch (e2) {}
          }
          // fallback: if focus is still stuck in an empty field, drop it
          try {
            var ae2 = doc.activeElement;
            if (ae2 && !ae2.value && /^(input|textarea|select)$/i.test(ae2.tagName || '')) ae2.blur();
          } catch (e3) {}
        }
      }
    } catch (e) {}
  }

  // The F key action, shared by the keypress and the clickable F button.
  // Works at any facility: on the forms/assessments list it clicks the most
  // recent psych note's edit link; if the note is completed (no edit link),
  // it clicks its "copy" link to start a new note from it. On a Boro Park
  // Psych: Consult form page it clicks the section edit link, or Lock if the
  // form is signed (the sign-then-lock workflow). Toasts the reason when it
  // can't act, so a dead button is diagnosable.
  // If a "Reasons for Assessment" popup is open (New or Follow Up), F clicks its Save.
  function clickReasonsPopupSave(doc) {
    try {
      // Find text node containing the title (works even nested in other elements)
      var walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null, false);
      var tn, titleEl = null;
      while (tn = walker.nextNode()) {
        var t = (tn.nodeValue || '').trim();
        if (t === 'Reasons for Assessment') { titleEl = tn.parentElement; break; }
      }
      if (!titleEl) return false;
      // Walk up to find the dialog container, then find Save inside it
      var container = titleEl;
      for (var d = 0; d < 8 && container; d++) {
        var btns = container.querySelectorAll('button, input[type="button"], input[type="submit"]');
        for (var b = 0; b < btns.length; b++) {
          var bt = ((btns[b].textContent || '') + ' ' + (btns[b].value || '')).trim();
          // Match "Save" but not "Save & Sign & Exit" etc.
          if (/^Save$/i.test(bt) && btns[b].offsetParent !== null) {
            btns[b].click();
            return true;
          }
        }
        container = container.parentElement;
        if (!container || container === doc.body) break;
      }
      // Fallback: search the whole doc for a visible Save button
      // (popup might be in a sibling container, not an ancestor)
      var allBtns = doc.querySelectorAll('button, input[type="button"], input[type="submit"]');
      for (var i = 0; i < allBtns.length; i++) {
        var at = ((allBtns[i].textContent || '') + ' ' + (allBtns[i].value || '')).trim();
        if (/^Save$/i.test(at) && allBtns[i].offsetParent !== null) {
          // Only click if the Reasons popup is actually open (avoid wrong Save)
          allBtns[i].click();
          return true;
        }
      }
    } catch(e){}
    return false;
  }

  function doFAction() {
    var fWhy = '';
    // First: if Reasons popup is open, F = Save (not the normal F action)
    var popupSaved = findInFrames(window.top, function (doc) {
      return clickReasonsPopupSave(doc) ? true : null;
    });
    if (popupSaved) return;
    var fClicked = findInFrames(window.top, function (doc) {
      if (findTypeSelect(doc)) {
        // Assessments list: edit the most recent psych note; if completed,
        // copy it to start a new note.
        var link = findPsychEditLink(doc) || findPsychCopyLink(doc);
        if (!link) { fWhy = 'no edit link found'; return null; }
        link.click();
        return true;
      } else if (isPsychConsultFormPage(doc) || isConsultPsychiatryFormPage(doc)) {
        // Form page only (not resident search, dashboard, etc.): edit the
        // section if it's open; if it's a Boro Park signed section (no edit
        // link), F locks the form — the sign-then-lock workflow, same as the
        // F button next to Lock. On a Bedford/Crown Heights
        // Consult-Psychiatry form, F clicks Save & Sign & Lock & Exit.
        var editLink = findSectionEditLink(doc);
        if (editLink) { editLink.click(); return true; }
        if (isPsychConsultFormPage(doc)) {
          var lockBtn = findLockButton(doc);
          if (lockBtn) { lockBtn.click(); return true; }
        }
        if (isBedfordOrCrownHeights(doc) && isConsultPsychiatryFormPage(doc)) {
          var sslBtn = findSaveSignLockExitButton(doc);
          if (sslBtn) { sslBtn.click(); return true; }
        }
        if (isCNROrSaints(doc) && isConsultPsychiatryFormPage(doc)) {
          // Section-list page: F signs Section 2 if ready (sign link exists).
          var signLink = findSectionSignLink(doc);
          if (signLink) { signLink.click(); return true; }
          // Section-list page: F opens the Reason for Consultation view
          // (review the referral). Only when the view link exists.
          var reasonView = findReasonViewLink(doc);
          if (reasonView) { reasonView.click(); return true; }
          // Reason view page: F clicks Next Section (go to the note).
          var nextBtn = findNextSectionButton(doc);
          if (nextBtn) { nextBtn.click(); return true; }
          var seBtn = findSaveExitButton(doc);
          if (seBtn) { seBtn.click(); return true; }
        }
        fWhy = 'no edit link found';
        return null;
      } else {
        fWhy = 'not a forms page';
        return null;
      }
    });
    if (!fClicked && fWhy) toast('F: ' + fWhy);
    return fClicked;
  }

  // The "copy" link on the most recent psych assessment row. Fallback for
  // doFAction when the note is completed and has no "edit" link — copying
  // starts a new note pre-filled from the most recent one.
  function findPsychCopyLink(doc) {
    try {
      var row = findMostRecentPsychRow(doc);
      if (!row) return null;
      var links = row.querySelectorAll('a');
      for (var li = 0; li < links.length; li++) {
        if (/^\s*copy\s*$/i.test(links[li].textContent || '')) return links[li];
      }
    } catch (e) {}
    return null;
  }

  // The most recent psych assessment row. Table order is Assessment Date
  // descending, so the first psych row wins. Null if none found.
  function findMostRecentPsychRow(doc) {
    try {
      var tables = doc.querySelectorAll('table');
      for (var ti = 0; ti < tables.length; ti++) {
        var first = tables[ti].querySelector('tr');
        if (!first) continue;
        var hcells = first.querySelectorAll('th, td'), di = -1, h;
        for (h = 0; h < hcells.length; h++) {
          if (norm(hcells[h].textContent) === 'DESCRIPTION') di = h;
        }
        if (di === -1) continue;
        var hdrTxt888 = norm(first.textContent);
        if (hdrTxt888.indexOf('ASSESSMENT DATE') === -1 && hdrTxt888.indexOf('FORM DATE') === -1) continue;
        var rows = tables[ti].querySelectorAll('tr');
        for (var r = 1; r < rows.length; r++) {
          if (rows[r].querySelector('tr')) continue;   // skip nested tables
          var cells = rows[r].querySelectorAll('td');
          if (cells.length <= di) continue;
          if (!/psych/i.test(cells[di].textContent || '')) continue;
          return rows[r];
        }
      }
    } catch (e) {}
    return null;
  }

  // Clickable red "F" button next to the Lock button on the Psych: Consult
  // form page (Boro Park only). His workflow: sign the sections, then lock —
  // this button is a shortcut for Lock. The Lock button appears on many PCC
  // pages; this is scoped to the Psych: Consult form via the Sign All
  // toolbar + form title.
  // Page text including <input> button values. PCC renders toolbar buttons
  // (Back/Sign All/Lock/Print) as inputs, whose labels live in `value` and
  // are invisible to textContent alone.
  function pageText(doc) {
    try {
      var t = doc.body ? (doc.body.textContent || '') : '';
      var inputs = doc.querySelectorAll('input');
      for (var i = 0; i < inputs.length; i++) {
        if (inputs[i].value) t += ' ' + inputs[i].value;
      }
      return norm(t);
    } catch (e) {}
    return '';
  }
  function isPsychConsultFormPage(doc) {
    try {
      if (findTypeSelect(doc)) return false;   // assessments list, not the form
      var bodyText = pageText(doc);
      if (bodyText.indexOf('SIGN ALL') === -1) return false;
      if (bodyText.indexOf('PSYCH: CONSULT') === -1) return false;
      // Boro Park, position-independent (the header may be scrolled off or in
      // another frame) — check this doc, then top, then opener.
      if (bodyText.indexOf('BORO PARK') !== -1) return true;
      try {
        var topText = norm(window.top.document.body ? window.top.document.body.textContent : '');
        if (topText.indexOf('BORO PARK') !== -1) return true;
      } catch (e) {}
      try {
        if (window.opener && !window.opener.closed && window.opener.document) {
          var opText = norm(window.opener.document.body ? window.opener.document.body.textContent : '');
          if (opText.indexOf('BORO PARK') !== -1) return true;
        }
      } catch (e2) {}
      return false;
    } catch (e3) {}
    return false;
  }
  function findLockButton(doc) {
    try {
      // PCC renders toolbar buttons as button, input, or link elements —
      // cover all three. Page scoping (isPsychConsultFormPage) already
      // ensures we're on the right form, so any Lock here is the toolbar one.
      var els = doc.querySelectorAll('button, input[type="button"], input[type="submit"], a');
      for (var i = 0; i < els.length; i++) {
        if (elText(els[i]) === 'LOCK' && visible(els[i])) return els[i];
      }
    } catch (e) {}
    return null;
  }
  function applyFButtonFormPage(doc) {
    try {
      var olds = doc.querySelectorAll('.pcc-f-btn-form'), i;
      for (i = olds.length - 1; i >= 0; i--) olds[i].remove();
      if (!isPsychConsultFormPage(doc)) return;
      // If the section has an edit link, the F badge already marks it — the
      // toolbar button would duplicate it. The toolbar F (lock shortcut) only
      // appears on signed sections with no edit link.
      if (findSectionEditLink(doc)) return;
      var lockBtn = findLockButton(doc);
      if (!lockBtn || !lockBtn.parentNode) return;
      var btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'pcc-f-btn-form';
      btn.textContent = 'F';
      btn.title = 'Lock this form';
      btn.setAttribute('style', 'background:#c0392b;color:#fff;border:none;border-radius:4px;' +
        'font-weight:bold;font-size:14px;padding:2px 10px;margin-left:6px;cursor:pointer;');
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var lb = findLockButton(doc);   // fresh lookup in case the DOM shifted
        if (lb) lb.click();
      });
      if (lockBtn.nextSibling) lockBtn.parentNode.insertBefore(btn, lockBtn.nextSibling);
      else lockBtn.parentNode.appendChild(btn);
    } catch (e) {}
  }

  // Bedford/Crown Heights Consult-Psychiatry 1.0 form page. Detected by the
  // "Save & Sign & Lock & Exit" button (unique to this form) plus section
  // markers (B1/B2/B3). Not the assessments list (no type select there).
  function isConsultPsychiatryFormPage(doc) {
    try {
      if (findTypeSelect(doc)) return false;
      if (findSaveSignLockExitButton(doc)) return true;
      if (findSaveExitButton(doc)) return true;
      var t = doc.body ? norm(doc.body.textContent || '') : '';
      if (t.indexOf('CONSULT-PSYCHIATRY') !== -1) return true;
      // Section-list page: title says "Consult Form - Psychiatry 4 - V 1"
      if (/consult form - psychiatry/i.test(t)) return true;
    } catch (e) {}
    return false;
  }

  // The "Save & Sign & Lock & Exit" button on the Consult-Psychiatry form.
  // PCC renders these as inputs or buttons; the label may be in value.
  function findSaveSignLockExitButton(doc) {
    try {
      var els = doc.querySelectorAll('input[type="button"], input[type="submit"], button');
      for (var i = 0; i < els.length; i++) {
        var label = ((els[i].value || '') + ' ' + (els[i].textContent || '')).replace(/\s+/g, ' ').trim();
        if (/^save\s*&\s*sign\s*&\s*lock\s*&\s*exit$/i.test(label) && visible(els[i])) return els[i];
      }
    } catch (e) {}
    return null;
  }

  // Clickable red "F" button next to "Save & Sign & Lock & Exit" on the
  // Bedford/Crown Heights Consult-Psychiatry form. Clicking it clicks
  // "Save & Sign & Lock & Exit" — the sign-and-lock shortcut for these
  // facilities (parallel to Boro Park's F-next-to-Lock). Bedford/Crown
  // Heights only; Boro Park unchanged.
  function applyFButtonBedfordForm(doc) {
    try {
      var olds = doc.querySelectorAll('.pcc-f-btn-bf'), i;
      for (i = olds.length - 1; i >= 0; i--) olds[i].remove();
      if (!isBedfordOrCrownHeights(doc)) return;
      if (!isConsultPsychiatryFormPage(doc)) return;
      var target = findSaveSignLockExitButton(doc);
      if (!target || !target.parentNode) return;
      var btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'pcc-f-btn-bf';
      btn.textContent = 'F';
      btn.title = 'Save & Sign & Lock & Exit (same as F key)';
      btn.setAttribute('style', 'background:#c0392b;color:#fff;border:none;border-radius:4px;' +
        'font-weight:bold;font-size:14px;padding:2px 10px;margin-left:6px;cursor:pointer;');
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var tb = findSaveSignLockExitButton(doc);   // fresh lookup in case the DOM shifted
        if (tb) tb.click();
      });
      if (target.nextSibling) target.parentNode.insertBefore(btn, target.nextSibling);
      else target.parentNode.appendChild(btn);
    } catch (e) {}
  }

  // The "Save & Exit" button on the CNR/Saints Consult-Psychiatry form.
  // PCC renders these as inputs or buttons; the label may be in value.
  function findSaveExitButton(doc) {
    try {
      var els = doc.querySelectorAll('input[type="button"], input[type="submit"], button');
      for (var i = 0; i < els.length; i++) {
        var label = ((els[i].value || '') + ' ' + (els[i].textContent || '')).replace(/\s+/g, ' ').trim();
        if (/^save\s*&\s*exit$/i.test(label) && visible(els[i])) return els[i];
      }
    } catch (e) {}
    return null;
  }

  // Clickable red "F" button next to "Save & Exit" on the CNR/Saints
  // Consult-Psychiatry form. CNR/Saints only; other facilities unchanged.
  function applyFButtonCNRForm(doc) {
    try {
      var olds = doc.querySelectorAll('.pcc-f-btn-cnr'), i;
      for (i = olds.length - 1; i >= 0; i--) olds[i].remove();
      if (!isCNROrSaints(doc)) return;
      if (!isConsultPsychiatryFormPage(doc)) return;
      var target = findSaveExitButton(doc);
      if (!target || !target.parentNode) return;
      var btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'pcc-f-btn-cnr';
      btn.textContent = 'F';
      btn.title = 'Save & Exit (same as F key)';
      btn.setAttribute('style', 'background:#c0392b;color:#fff;border:none;border-radius:4px;' +
        'font-weight:bold;font-size:14px;padding:2px 10px;margin-left:6px;cursor:pointer;');
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var tb = findSaveExitButton(doc);
        if (tb) tb.click();
      });
      if (target.nextSibling) target.parentNode.insertBefore(btn, target.nextSibling);
      else target.parentNode.appendChild(btn);
    } catch (e) {}
  }

  // Find the "sign" link for Section 2 (Psychiatry MD - Evaluation and
  // Recommendation) on the CNR/Saints section-list page.
  function findSectionSignLink(doc) {
    try {
      var links = doc.querySelectorAll('a');
      for (var i = 0; i < links.length; i++) {
        if ((links[i].textContent || '').trim().toLowerCase() !== 'sign') continue;
        var row = links[i].closest('tr');
        if (row && /psychiatry md|evaluation and recommendation/i.test(row.textContent)) {
          if (visible(links[i])) return links[i];
        }
      }
    } catch (e) {}
    return null;
  }

  // Clickable red "F" button next to "sign" on Section 2 — CNR/Saints
  // section-list page only. Signs the note before the popup comes up.
  function applyFButtonSectionSign(doc) {
    try {
      var olds = doc.querySelectorAll('.pcc-f-btn-sign'), i;
      for (i = olds.length - 1; i >= 0; i--) olds[i].remove();
      if (!isCNROrSaints(doc)) return;
      if (!isConsultPsychiatryFormPage(doc)) return;
      var target = findSectionSignLink(doc);
      if (!target || !target.parentNode) return;
      var btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'pcc-f-btn-sign';
      btn.textContent = 'F';
      btn.title = 'Sign Section 2 (same as F key)';
      btn.setAttribute('style', 'background:#c0392b;color:#fff;border:none;border-radius:4px;' +
        'font-weight:bold;font-size:14px;padding:2px 8px;margin-left:6px;cursor:pointer;');
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var tb = findSectionSignLink(doc);
        if (tb) tb.click();
      });
      if (target.nextSibling) target.parentNode.insertBefore(btn, target.nextSibling);
      else target.parentNode.appendChild(btn);
    } catch (e) {}
  }

  // Find the "Next Section" button (CNR/Saints form pages).
  function findNextSectionButton(doc) {
    try {
      var els = doc.querySelectorAll('input[type="button"], input[type="submit"], button');
      for (var i = 0; i < els.length; i++) {
        var label = ((els[i].value || '') + ' ' + (els[i].textContent || '')).replace(/\s+/g, ' ').trim();
        if (/^next section$/i.test(label) && visible(els[i])) return els[i];
      }
    } catch (e) {}
    return null;
  }

  // Clickable red "F" button next to "Next Section" — CNR/Saints only.
  // After reviewing the referral, F jumps to the note (next section).
  function applyFButtonNextSection(doc) {
    try {
      var olds = doc.querySelectorAll('.pcc-f-btn-next'), i;
      for (i = olds.length - 1; i >= 0; i--) olds[i].remove();
      if (!isCNROrSaints(doc)) return;
      if (!isConsultPsychiatryFormPage(doc)) return;
      var target = findNextSectionButton(doc);
      if (!target || !target.parentNode) return;
      var btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'pcc-f-btn-next';
      btn.textContent = 'F';
      btn.title = 'Next Section (same as F key)';
      btn.setAttribute('style', 'background:#c0392b;color:#fff;border:none;border-radius:4px;' +
        'font-weight:bold;font-size:14px;padding:2px 8px;margin-left:6px;cursor:pointer;');
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var tb = findNextSectionButton(doc);
        if (tb) tb.click();
      });
      if (target.nextSibling) target.parentNode.insertBefore(btn, target.nextSibling);
      else target.parentNode.appendChild(btn);
    } catch (e) {}
  }

  // Find the "view" link for Section 1 (Reason for Consultation) on the
  // CNR/Saints consult form section-list page. Only matches the view link
  // in the row containing "Reason for Consultation".
  function findReasonViewLink(doc) {
    try {
      var links = doc.querySelectorAll('a');
      for (var i = 0; i < links.length; i++) {
        if ((links[i].textContent || '').trim().toLowerCase() !== 'view') continue;
        // Check if this link is in a row with "Reason for Consultation"
        var row = links[i].closest('tr');
        if (row && /reason for consultation/i.test(row.textContent)) {
          if (visible(links[i])) return links[i];
        }
      }
    } catch (e) {}
    return null;
  }

  // Clickable red "F" button next to "view" on Section 1 (Reason for
  // Consultation) — CNR/Saints section-list page only. Lets him review the
  // referral before writing. Does not touch edit-link F buttons.
  function applyFButtonReasonView(doc) {
    try {
      var olds = doc.querySelectorAll('.pcc-f-btn-reason'), i;
      for (i = olds.length - 1; i >= 0; i--) olds[i].remove();
      if (!isCNROrSaints(doc)) return;
      if (!isConsultPsychiatryFormPage(doc)) return;
      var target = findReasonViewLink(doc);
      if (!target || !target.parentNode) return;
      var btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'pcc-f-btn-reason';
      btn.textContent = 'F';
      btn.title = 'View Reason for Consultation (same as F key)';
      btn.setAttribute('style', 'background:#c0392b;color:#fff;border:none;border-radius:4px;' +
        'font-weight:bold;font-size:14px;padding:2px 8px;margin-left:6px;cursor:pointer;');
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var tb = findReasonViewLink(doc);
        if (tb) tb.click();
      });
      if (target.nextSibling) target.parentNode.insertBefore(btn, target.nextSibling);
      else target.parentNode.appendChild(btn);
    } catch (e) {}
  }

  // Clickable red "F" button next to the most recent psych row's action
  // links (view/unlock/copy/print/strike-out), assessments list, any
  // facility. Does exactly what the F key does: edit if the note is open,
  // copy if it's completed. Removed when not applicable.
  function applyFButton(doc) {
    try {
      var olds = doc.querySelectorAll('.pcc-f-btn'), i;
      for (i = olds.length - 1; i >= 0; i--) olds[i].remove();
      if (!findTypeSelect(doc)) return;   // assessments list only, not the form page
      var row = findMostRecentPsychRow(doc);
      if (!row) return;
      // If this row already has an edit link, the existing red F badge marks
      // it — a separate button would duplicate it. The button is only for
      // completed rows with no edit link (the copy workflow).
      var rowLinks = row.querySelectorAll('a'), hasEdit = false;
      for (i = 0; i < rowLinks.length; i++) {
        if (/^\s*edit\s*$/i.test(rowLinks[i].textContent || '')) { hasEdit = true; break; }
      }
      if (hasEdit) return;
      var cells = row.querySelectorAll('td');
      if (!cells.length) return;
      var actionsCell = cells[0];
      var btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'pcc-f-btn';
      btn.textContent = 'F';
      btn.title = 'Edit most recent psych note (same as F key)';
      btn.setAttribute('style', 'background:#c0392b;color:#fff;border:none;border-radius:4px;' +
        'font-weight:bold;font-size:14px;padding:2px 10px;margin-left:6px;margin-right:6px;cursor:pointer;');
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        doFAction();
      });
      // Place the F button right after the "copy" link; fall back to the
      // start of the cell if no copy link is found.
      var copyLink = null, cellLinks = actionsCell.querySelectorAll('a');
      for (i = 0; i < cellLinks.length; i++) {
        if (/^\s*copy\s*$/i.test(cellLinks[i].textContent || '')) { copyLink = cellLinks[i]; break; }
      }
      if (copyLink && copyLink.nextSibling) {
        actionsCell.insertBefore(btn, copyLink.nextSibling);
      } else if (copyLink) {
        actionsCell.appendChild(btn);
      } else {
        actionsCell.insertBefore(btn, actionsCell.firstChild);
      }
    } catch (e) {}
  }

  // ---- Resident search (A key): own-document heuristic, each frame handles itself ----
  function findResidentSearchBox(doc) {
    var inputs = doc.querySelectorAll('input[type="text"], input[type="search"], input:not([type])');
    var cands = [];
    for (var i = 0; i < inputs.length; i++) {
      var inp = inputs[i];
      if (!visible(inp) || inp.disabled || inp.readOnly) continue;
      var hay = ((inp.id || '') + ' ' + (inp.name || '') + ' ' +
                 (inp.placeholder || '') + ' ' + (inp.getAttribute('aria-label') || '') + ' ' +
                 (inp.title || '')).toLowerCase();
      var score = /resident/.test(hay) ? 3 : (/search/.test(hay) ? 2 : 0);
      if (score > 0) cands.push({ el: inp, score: score, top: inp.getClientRects()[0].top });
    }
    cands.sort(function (a, b) { return (b.score - a.score) || (a.top - b.top); });
    return cands.length ? cands[0].el : null;
  }

  function findResidentSearch() {
    return findInFrames(window.top, findResidentSearchBox);
  }

  function focusResidentSearch() {
    var box = findResidentSearch();
    if (box) {
      userTookFocus = true;
      box.focus();
      try { box.select(); } catch (e) {}
      return true;
    }
    return false;
  }

  // Floating "A" badge pinned to the search box corner (never intercepts clicks).
  function placeABadge() {
    try {
      var box = findResidentSearchBox(document);
      var badge = document.getElementById(ABADGE_ID);
      if (!box || !visible(box)) { if (badge) badge.style.display = 'none'; return; }
      if (!badge) {
        badge = document.createElement('div');
        badge.id = ABADGE_ID;
        badge.textContent = 'A';
        badge.title = 'Shortcut: press A to jump here';
        (document.body || document.documentElement).appendChild(badge);
      }
      // Restyled on every pass so color updates apply to the existing badge too.
      badge.setAttribute('style', 'position:fixed;z-index:999999;padding:2px 10px;' +
        'font-size:18px;font-weight:900;color:#fff;background:#ff2020;' +
        'border:2px solid #8f0000;border-radius:4px;box-shadow:0 0 6px rgba(255,32,32,.9);' +
        'pointer-events:none;');
      var r = box.getClientRects()[0];
      badge.style.display = 'block';
      badge.style.left = Math.max(0, r.right - 10) + 'px';
      badge.style.top = Math.max(0, r.top - 12) + 'px';
    } catch (e) {}
  }

  function isEditable(el) {
    if (!el || !el.tagName) return false;
    var tag = el.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    if (el.isContentEditable) return true;
    try {
      if (el.ownerDocument && el.ownerDocument.designMode === 'on') return true;
    } catch (x) {}
    return false;
  }

  function toast(msg) {
    try {
      var t = document.createElement('div');
      t.textContent = msg;
      t.setAttribute('style', 'position:fixed;bottom:18px;left:50%;transform:translateX(-50%);' +
        'z-index:999999;padding:6px 14px;font:700 13px system-ui,sans-serif;color:#fff;' +
        'background:#222;border-radius:6px;opacity:.95;pointer-events:none;');
      document.body.appendChild(t);
      setTimeout(function () { t.remove(); }, 1300);
    } catch (e) {}
  }

  // Persistent OFF indicator so the kill-switch can never mystify you.
  function renderOffIndicator() {
    try {
      var pill = document.getElementById(OFF_ID);
      if (!enabled && !pill) {
        pill = document.createElement('div');
        pill.id = OFF_ID;
        pill.textContent = 'PCC keys OFF — press 0 to resume';
        pill.setAttribute('style', 'position:fixed;right:14px;bottom:14px;z-index:999999;' +
          'padding:6px 12px;font:700 12px system-ui,sans-serif;color:#fff;background:#a00;' +
          'border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,.4);');
        (document.body || document.documentElement).appendChild(pill);
      } else if (enabled && pill) {
        pill.remove();
      }
    } catch (e) {}
  }

  // Number badge that also works on <input> buttons (::after doesn't render
  // on inputs, so those get a real sibling <span> instead of the CSS badge).
  var NUM_BADGE_CLASS = 'pcc-num-badge';

  function applyNumBadge(el, num) {
    if (!el) return;
    try {
      if (el.tagName === 'INPUT') {
        var doc = el.ownerDocument;
        var next = el.nextElementSibling;
        if (next && next.className === NUM_BADGE_CLASS) { next.textContent = num; return; }
        var s = doc.createElement('span');
        s.className = NUM_BADGE_CLASS;
        s.textContent = num;
        s.title = 'Shortcut: press ' + num;
        s.setAttribute('style', 'display:inline-block;margin-left:6px;padding:3px 12px;' +
          'font-size:18px;font-weight:900;line-height:1.4;color:#000;background:#ff9500;' +
          'border:2px solid #7a4a00;border-radius:5px;box-shadow:0 0 6px rgba(255,149,0,.9);' +
          'vertical-align:1px;');
        el.parentNode.insertBefore(s, el.nextSibling);
      } else if (!el.hasAttribute(NUM_ATTR)) {
        el.setAttribute(NUM_ATTR, num);
      }
    } catch (e) {}
  }

  // ================= CHART SNAPSHOT =================
  // Collectors cache per-resident chart data in localStorage as you browse the
  // chart (allergies + contact + age/sex from header/profile, psych meds from
  // your Dashboard's rendered med list, BIMS from the assessments table,
  // diagnoses from ICD-coded rows). C copies a note-ready block.
  var SNAP_KEY_PREFIX = 'pccSnap_';
  var SNAP_NEXT = 'Special Instructions|Code Status|Dietary|Diagnosis|Status|Physician|Location|DOB|Admission|Initial Admission|Discharge|Patient|Vital';

  function snapGet(id) {
    try { var s = localStorage.getItem(SNAP_KEY_PREFIX + id); return s ? JSON.parse(s) : null; }
    catch (e) { return null; }
  }
  function snapSet(id, data) {
    try { localStorage.setItem(SNAP_KEY_PREFIX + id, JSON.stringify(data)); } catch (e) {}
  }
  function snapUpdate(id, patch) {
    var d = snapGet(id) || { id: id };
    for (var k in patch) d[k] = patch[k];
    snapSet(id, d);
  }

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Resident id from the header "LAST, FIRST (id)"; null unless exactly one resident on the page.
  function snapshotResidentId(doc) {
    try {
      if (doc.__snapId !== undefined) return doc.__snapId;
      var txt = doc.body ? (doc.body.textContent || '') : '';
      var re = /[A-Za-z][A-Za-z'’.\-]*\s*,\s*[A-Za-z][A-Za-z'’.\- ]*?\(\s*([A-Za-z]{0,5}\d{3,})\s*\)/g;
      var m, ids = {}, order = [];
      while ((m = re.exec(txt))) { var id = m[1].toLowerCase(); if (!ids[id]) { ids[id] = 1; order.push(m[1]); } }
      doc.__snapId = order.length === 1 ? order[0] : null;
      return doc.__snapId;
    } catch (e) { return null; }
  }

  function readSnapshotAllergies(doc) {
    try {
      var txt = (doc.body && doc.body.textContent) ? doc.body.textContent : '';
      txt = txt.replace(/(?:Copy|Copied)\b/gi, '');
      var re = new RegExp('Allergies\\s*:?\\s*([^\\n]*?)(?=\\s*(?:' + SNAP_NEXT + ')\\b|\\n|$)', 'i');
      var m = txt.match(re);
      var raw = m ? m[1].replace(/\s+/g, ' ').trim() : '';
      if (!raw) return '';
      if (/^no\s+known\s+(?:drug\s+)?allergies/i.test(raw) || /^nkda?/i.test(raw)) return 'NKA';
      var parts = raw.split(/[,;\/]+/), out = [];
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i].replace(/\s+/g, ' ').trim();
        if (p) out.push(p);
      }
      return out.join(', ');
    } catch (e) { return ''; }
  }

  // Psych meds, reused from your Dashboard script's rendered list (#medListBox).
  function readDashboardMedList(doc) {
    try {
      var box = doc.getElementById('medListBox');
      if (!box) return null;
      var lines = [], divs = box.querySelectorAll('div');
      for (var i = 0; i < divs.length; i++) {
        var t = (divs[i].textContent || '').replace(/\s+/g, ' ').trim();
        if (!t || /^psych med list/i.test(t)) continue;
        if (/^⚠ REVIEW/i.test(t)) break;
        if (/^- /.test(t)) lines.push(t.replace(/^- /, ''));
      }
      return lines;
    } catch (e) { return null; }
  }

  // Latest BIMS score from the assessments table (Score + Assessment Date columns).
  function readLatestBims(doc) {
    try {
      var tables = doc.querySelectorAll('table');
      for (var ti = 0; ti < tables.length; ti++) {
        var first = tables[ti].querySelector('tr');
        if (!first) continue;
        var hcells = first.querySelectorAll('th, td'), headers = [], h;
        for (h = 0; h < hcells.length; h++) headers.push(norm(hcells[h].textContent));
        var si = -1, di = -1;
        for (h = 0; h < headers.length; h++) {
          if (headers[h] === 'SCORE') si = h;
          if (/ASSESSMENT DATE/.test(headers[h])) di = h;
        }
        if (si === -1 || di === -1 || !/bims|social service assessment/i.test(tables[ti].textContent)) continue;
        var best = null, rows = tables[ti].querySelectorAll('tr');
        for (var r = 1; r < rows.length; r++) {
          if (rows[r].querySelector('tr')) continue;
          var cells = rows[r].querySelectorAll('td');
          if (!cells.length || si >= cells.length || di >= cells.length) continue;
          if (!/bims|social service assessment/i.test(norm(rows[r].textContent))) continue;
          var score = (cells[si].textContent || '').trim();
          // Handle "0.0" -> "0" (SSA reports scores with decimal)
          var sm = score.match(/^(\d{1,2})(?:\.0)?$/);
          if (sm) score = sm[1];
          var dm = (cells[di].textContent || '').trim().match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
          if (!dm || !/^\d{1,2}$/.test(score)) continue;
          var dt = new Date(+dm[3], +dm[1] - 1, +dm[2]).getTime();
          if (!best || dt > best.dt) best = { dt: dt, score: score, date: dm[1] + '/' + dm[2] + '/' + dm[3] };
        }
        if (best) return { score: best.score, date: best.date };
      }
    } catch (e) {}
    return null;
  }

  // Diagnoses from ICD-coded table rows (needs >= 2 to count as a real list).
  function readDiagnoses(doc) {
    try {
      var trs = doc.querySelectorAll('tr'), out = [], seen = {};
      for (var i = 0; i < trs.length; i++) {
        var tr = trs[i];
        if (tr.querySelector('tr')) continue;
        var t = (tr.textContent || '').replace(/\s+/g, ' ').trim();
        var m = t.match(/\b[A-TV-Z][0-9][0-9AB]\b(?:\.[0-9A-Z]{1,4})?/);
        if (!m || /^(add|edit|delete|actions?)\b/i.test(t)) continue;
        var desc = t.replace(m[0], '').replace(/\s+/g, ' ').trim().replace(/^(active|inactive|resolved)[\s:,-]*/i, '');
        var line = m[0] + (desc ? ' ' + desc : '');
        if (line.length > 140 || seen[line]) continue;
        seen[line] = 1;
        out.push(line);
        if (out.length >= 25) break;
      }
      return out.length >= 2 ? out : null;
    } catch (e) { return null; }
  }

  // Primary family contact from the contacts table (first non-self row with a phone).
  function readPrimaryContact(doc) {
    try {
      var tables = doc.querySelectorAll('table');
      for (var ti = 0; ti < tables.length; ti++) {
        if (norm(tables[ti].textContent).slice(0, 400).indexOf('RELATION') === -1) continue;
        var trs = tables[ti].querySelectorAll('tr');
        for (var i = 0; i < trs.length; i++) {
          var tr = trs[i];
          if (tr.querySelector('tr')) continue;
          var cells = tr.querySelectorAll('td');
          if (cells.length < 4) continue;
          var texts = [], c;
          for (c = 0; c < cells.length; c++) texts.push((cells[c].textContent || '').replace(/\s+/g, ' ').trim());
          if (/^actions/i.test(texts[0])) continue;
          var rowT = texts.join(' | ');
          var phoneM = rowT.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
          if (!phoneM) continue;
          var relM = rowT.match(/\b(sister|brother|mother|father|wife|husband|daughter|son|spouse|friend|poa|guardian|niece|nephew|cousin|partner|child)\b/i);
          if (!relM) continue;
          var name = '';
          for (var n = 0; n < texts.length; n++) {
            var cn = texts[n].replace(/\s*\(\s*[A-Za-z]{0,5}\d{3,}\s*\)\s*$/, '').trim();
            if (/[A-Za-z]{2,}/.test(cn) && !/^(actions?|mobile|phone|email)$/i.test(cn) && cn.length < 60) { name = cn; break; }
          }
          if (!name) continue;
          return { name: name, phone: phoneM[0], relation: relM[1].toLowerCase() };
        }
      }
    } catch (e) {}
    return null;
  }

  // Demographics from Profile page: Marital Status, Religion, Race, Primary Language.
  // Searches for label-value pairs in tables and definition lists.
  function readDemographics(doc) {
    try {
      var out = {};
      var labels = {
        'marital status': 'marital', 'marital': 'marital',
        'religion': 'religion',
        '\braces?\b': 'race',
        'primary language': 'language', 'primary lang': 'language'
      };
      // Walk all elements, look for label text, then take the next sibling or cell value
      var els = doc.querySelectorAll('td, th, div, span, dt, dd, li, p');
      for (var i = 0; i < els.length; i++) {
        var t = (els[i].textContent || '').replace(/\s+/g, ' ').trim();
        if (t.length > 60) continue;
        for (var pat in labels) {
          var re = new RegExp('^' + pat + '\\s*:?\\s*(.+)$', 'i');
          var m = t.match(re);
          if (m && m[1] && m[1].length < 40) {
            var key = labels[pat];
            if (!out[key]) out[key] = m[1].trim();
          }
        }
        // Also try: label in one cell, value in next cell
        for (var pat2 in labels) {
          var re2 = new RegExp('^' + pat2 + '\\s*:?$', 'i');
          if (re2.test(t)) {
            var key2 = labels[pat2];
            if (!out[key2]) {
              var sib = els[i].nextElementSibling;
              if (sib) {
                var vt = (sib.textContent || '').replace(/\s+/g, ' ').trim();
                if (vt && vt.length < 40) out[key2] = vt;
              }
            }
          }
        }
      }
      if (out.marital || out.religion || out.race || out.language) return out;
    } catch(e){}
    return null;
  }

  // Fetch the Face Sheet PDF in the background and extract demographics.
  // The PDF isn't DOM, so we pull the raw bytes and regex the text out.
  function fetchFaceSheetDemographics(doc) {
    try {
      // Find the Face Sheet link/button to get the PDF URL
      var el = findByExactText(doc, 'FACE SHEET')[0] || findByExactText(doc, 'Face Sheet')[0];
      if (!el) return;
      var url = null;
      if (el.tagName === 'A' && el.href) url = el.href;
      else {
        var a = el.querySelector('a');
        if (a && a.href) url = a.href;
      }
      if (!url) return;
      // Fetch the PDF
      fetch(url, { credentials: 'include' })
        .then(function(r){ return r.arrayBuffer(); })
        .then(function(buf){
          var bytes = new Uint8Array(buf);
          var bin = '';
          for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
          // Extract text from PDF: (text) Tj and <hex> Tj operators
          var texts = [];
          var re1 = /\(([^\)\\]*(?:\\.[^\)\\]*)*)\)\s*Tj/gi, m1;
          while ((m1 = re1.exec(bin)) !== null) {
            var t = m1[1].replace(/\\([\\()])/g, '$1').replace(/\\n/g, ' ').trim();
            if (t) texts.push(t);
          }
          var re2 = /<([0-9A-Fa-f]+)>\s*Tj/gi, m2;
          while ((m2 = re2.exec(bin)) !== null) {
            try {
              var hex = m2[1], s = '';
              for (var h = 0; h < hex.length; h += 2) s += String.fromCharCode(parseInt(hex.substr(h, 2), 16));
              s = s.trim();
              if (s) texts.push(s);
            } catch(e){}
          }
          // Find demographics: label followed by value
          var demo = {};
          var labelMap = {
            'marital status': 'marital', 'marital': 'marital',
            'religion': 'religion',
            'race': 'race',
            'primary lang': 'language', 'primary language': 'language'
          };
          for (var i = 0; i < texts.length; i++) {
            var tl = texts[i].toLowerCase().trim();
            for (var lbl in labelMap) {
              if (tl === lbl || tl === lbl + ':') {
                var val = (texts[i+1] || '').trim();
                if (val && val.length < 30 && !labelMap[val.toLowerCase()]) {
                  demo[labelMap[lbl]] = val;
                }
              }
            }
          }
          if (demo.marital || demo.religion || demo.race || demo.language) {
            // Save to snapshot
            var rid = pccResidentId();
            if (rid) {
              var key = 'pccSnap_' + rid;
              var snap = {};
              try { snap = JSON.parse(localStorage.getItem(key) || '{}'); } catch(e){}
              snap.demographics = demo;
              try { localStorage.setItem(key, JSON.stringify(snap)); } catch(e){}
            }
          }
        })
        .catch(function(){});
    } catch(e){}
  }

  // Age + sex from the chart header "(74/Male)" — your Emphasize script
  // renders this big and blue, so it's easy to find.
  function readAgeSex(doc) {
    try {
      var txt = doc.body ? (doc.body.textContent || '') : '';
      var m = txt.match(/\(\s*(\d{1,3})\s*\/\s*(Male|Female)\s*\)/);
      if (m) return { age: parseInt(m[1], 10), sex: m[2] };
    } catch (e) {}
    return null;
  }

  function collectSnapshot(doc) {
    if (!SNAPSHOT_ENABLED) return;
    try {
      var id = snapshotResidentId(doc);
      if (!id) return;
      var patch = {}, has = false;
      var alg = readSnapshotAllergies(doc);
      if (alg) { patch.allergies = alg; has = true; }
      var asx = readAgeSex(doc);
      if (asx) { patch.age = asx.age; patch.sex = asx.sex; has = true; }
      var relOut = doc.getElementById('relOut');
      if (relOut) {
        var rt = (relOut.textContent || '').replace(/\s+/g, ' ').trim();
        if (rt && !/^n\/a$/i.test(rt)) { patch.rels = rt; has = true; }
      }
      var pc = readPrimaryContact(doc);
      if (pc) { patch.primaryContact = pc; has = true; }
      var demo = readDemographics(doc);
      if (demo) { patch.demographics = demo; has = true; }
      // DISABLED 2026-10-05: Face Sheet PDF fetch was pulling wrong patient's
      // demographics. Do not re-enable until resident-ID scoping is verified.
      // fetchFaceSheetDemographics(doc);
      var meds = readDashboardMedList(doc);
      if (meds !== null) { patch.meds = meds; has = true; }
      var bims = readLatestBims(doc);
      if (bims) { patch.bims = bims; has = true; }
      var dx = readDiagnoses(doc);
      if (dx) { patch.dx = dx; has = true; }
      if (has) snapUpdate(id, patch);
    } catch (e) {}
  }

  // Display strings for the panel (signature = JSON of these).
  function snapDisplay(s) {
    var d = {};
    d.allergies = s.allergies || '—';
    d.bims = s.bims ? (s.bims.score + (/\//.test(s.bims.score) ? '' : '/15') + ' (' + s.bims.date + ')') : '—';
    d.meds = (s.meds && s.meds.length) ? (s.meds.length + ' — ' + s.meds.slice(0, 2).join('; ') + (s.meds.length > 2 ? '; …' : '')) : '—';
    d.dx = (s.dx && s.dx.length) ? (s.dx.length + ' — ' + s.dx.slice(0, 2).join('; ') + (s.dx.length > 2 ? '; …' : '')) : '—';
    d.contact = s.primaryContact ? (s.primaryContact.name + ' (' + s.primaryContact.relation + ') ' + s.primaryContact.phone) : (s.rels || '—');
    return d;
  }

  function snapSectionText(s, key) {
    if (key === 'meds') return 'Psych meds:\n' + ((s.meds && s.meds.length ? s.meds.map(function (m) { return '- ' + m; }).join('\n') : '- none'));
    if (key === 'dx') return 'DX:\n' + ((s.dx && s.dx.length ? s.dx.map(function (d) { return '- ' + d; }).join('\n') : '- —'));
    var d = snapDisplay(s);
    var labels = { allergies: 'Allergies', bims: 'BIMS', contact: 'Primary contact' };
    return (labels[key] || key) + ': ' + (d[key] || '—');
  }

  // Note-ready block, mirroring your note's sections.
  function formatSnapshot(s) {
    var L = [];
    L.push('Allergies: ' + (s.allergies || '—'));
    L.push('');
    if (s.primaryContact) L.push('Primary contact: ' + s.primaryContact.name + ' (' + s.primaryContact.relation + ') — ' + s.primaryContact.phone);
    else L.push('Relationships: ' + (s.rels || '—'));
    L.push('');
    L.push('BIMS: ' + (s.bims ? s.bims.score + (/\//.test(s.bims.score) ? '' : '/15') + ' (' + s.bims.date + ')' : '—'));
    L.push('');
    L.push('DX:');
    if (s.dx && s.dx.length) s.dx.forEach(function (x) { L.push('- ' + x); });
    else L.push('- —');
    L.push('');
    L.push('Psych meds:');
    if (s.meds && s.meds.length) s.meds.forEach(function (x) { L.push('- ' + x); });
    else L.push('- none');
    return L.join('\n');
  }

  function copyTextToClipboard(doc, text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text); return; }
    } catch (e) {}
    try {
      var ta = doc.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
      doc.body.appendChild(ta);
      ta.focus(); ta.select();
      doc.execCommand('copy');
      doc.body.removeChild(ta);
    } catch (e2) {}
  }

  function copySnapshot() {
    if (!SNAPSHOT_ENABLED) return false;
    var hit = findInFrames(window.top, function (doc) {
      var id = snapshotResidentId(doc);
      return id ? { id: id, doc: doc } : null;
    });
    if (!hit) { toast('No resident found'); return false; }
    collectSnapshot(hit.doc);
    var snap = snapGet(hit.id);
    if (!snap) { toast('Snapshot empty — browse the chart tabs first'); return false; }
    copyTextToClipboard(hit.doc, formatSnapshot(snap));
    toast('Snapshot copied — paste into your note');
    return true;
  }

  // ================= S KEY: copy "Last, First<TAB>room" =================
  // For your visit sheets: copies "Last, First" + a tab + the room-bed
  // number, so it pastes straight into two spreadsheet columns.
  // Only Crown Heights gets the E/W wing prefix (E404A, W707D); every other
  // facility uses the bare room-bed (404A, 707D).

  // True when the header facility picker shows Crown Heights. Scoped to the
  // top of the page so a "Crown Heights" mention deep in the chart can't
  // false-positive.
  function isCrownHeights(doc) {
    try {
      var els = doc.querySelectorAll('select, button, a, span, div, td');
      for (var i = 0; i < els.length; i++) {
        var t = (els[i].textContent || '').trim();
        if (t.length > 90 || t.length < 6) continue;
        if (!/crown\s*heights/i.test(t)) continue;
        var r = null;
        try { r = els[i].getBoundingClientRect(); } catch (e) {}
        if (r && r.top >= -50 && r.top < 300) return true;
      }
    } catch (e) {}
    return false;
  }

  // True when the header facility picker shows Bedford. Same scoping as
  // isCrownHeights — header area only, so a "Bedford" mention in the HPI
  // can't false-positive.
  function isBedford(doc) {
    try {
      var els = doc.querySelectorAll('select, button, a, span, div, td');
      for (var i = 0; i < els.length; i++) {
        var t = (els[i].textContent || '').trim();
        if (t.length > 90 || t.length < 4) continue;
        if (!/\bbedford\b/i.test(t)) continue;
        var r = null;
        try { r = els[i].getBoundingClientRect(); } catch (e) {}
        if (r && r.top >= -50 && r.top < 300) return true;
      }
    } catch (e) {}
    return false;
  }

  // True when the header facility picker shows CNR (Downtown Brooklyn
  // Nursing & Rehabilitation Center). Checks header area and footer.
  function isCNR(doc) {
    try {
      var els = doc.querySelectorAll('select, button, a, span, div, td');
      for (var i = 0; i < els.length; i++) {
        var t = (els[i].textContent || '').trim();
        if (t.length > 90 || t.length < 3) continue;
        if (!/\bCNR\b/i.test(t) && !/downtown\s*brooklyn/i.test(t)) continue;
        var r = null;
        try { r = els[i].getBoundingClientRect(); } catch (e) {}
        // Header (top 300px) or footer (bottom of page)
        if (r && (r.top < 300 || r.top > window.innerHeight - 300)) return true;
      }
    } catch (e) {}
    return false;
  }

  // True when the header facility picker shows Saints Joachim.
  function isSaints(doc) {
    try {
      var els = doc.querySelectorAll('select, button, a, span, div, td');
      for (var i = 0; i < els.length; i++) {
        var t = (els[i].textContent || '').trim();
        if (t.length > 90 || t.length < 6) continue;
        if (!/saints?\s*joachim/i.test(t)) continue;
        var r = null;
        try { r = els[i].getBoundingClientRect(); } catch (e) {}
        if (r && r.top >= -50 && r.top < 300) return true;
      }
    } catch (e) {}
    return false;
  }

  // CNR or Saints Joachim (the Tuesday facilities with Save & Exit forms).
  function isCNROrSaints(doc) {
    try { if (isCNR(doc)) return true; } catch (e) {}
    try { if (isSaints(doc)) return true; } catch (e2) {}
    return false;
  }

  // Bedford or Crown Heights (the Consult-Psychiatry facilities).
  function isBedfordOrCrownHeights(doc) {
    try { if (isBedford(doc)) return true; } catch (e) {}
    try { if (isCrownHeights(doc)) return true; } catch (e2) {}
    return false;
  }

  // "Last, First" from the header's "LAST, FIRST (id)".
  function residentLastFirst(doc) {
    try {
      var txt = doc.body ? (doc.body.textContent || '') : '';
      var m = txt.match(/([A-Za-z][A-Za-z'’.\-]*(?:\s+[A-Za-z][A-Za-z'’.\-]*)*\s*,\s*[A-Za-z][A-Za-z'’.\- ]*?)\s*\(\s*[A-Za-z]{0,5}\d{3,}\s*\)/);
      if (m) return m[1].replace(/\s+/g, ' ').trim();
    } catch (e) {}
    return '';
  }

  // Room-bed from the Location field ("6 West 612-B" -> "612B", or "W612B"
  // at Crown Heights). Set withWing=false everywhere except Crown Heights.
  function roomBedNumber(doc, withWing) {
    try {
      var txt = (doc.body && doc.body.textContent) ? doc.body.textContent : '';
      txt = txt.replace(/(?:Copy|Copied)\b/g, '');
      var m = txt.match(/\bLocation\s*:?\s*([^\n]*?)(?=\s*(?:Status|Code Status|Physician|DOB|Admission|Initial Admission|Discharge|Allergies|Special Instructions)\b|\n|$)/);
      var v = m ? m[1].replace(/\s+/g, ' ').trim() : '';
      var rm = v.match(/\b(\d{2,4})\s*-?\s*([A-Za-z])?\b/);
      if (!rm) return '';
      var pre = '';
      if (withWing) {
        var tok = v.slice(0, rm.index).match(/([A-Za-z]+)\s*$/);
        if (tok && /^(east|west)$/i.test(tok[1])) pre = tok[1].charAt(0).toUpperCase();
        else if (tok && tok[1].length === 1 && /[ew]/i.test(tok[1])) pre = tok[1].toUpperCase();
      }
      return pre + rm[1] + (rm[2] ? rm[2].toUpperCase() : '');
    } catch (e) { return ''; }
  }

  var SCOPIED_ID = 'pcc-s-copied';
  // Big yellow "S" confirmation badge + what was copied. Fades out on its own.
  function flashCopiedIndicator(name, room) {
    try {
      var old = document.getElementById(SCOPIED_ID);
      if (old && old.parentNode) old.parentNode.removeChild(old);
      var d = document.createElement('div');
      d.id = SCOPIED_ID;
      d.setAttribute('style', 'position:fixed;right:16px;bottom:16px;z-index:999999;' +
        'display:flex;align-items:center;gap:12px;padding:12px 20px;' +
        'background:#222;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.45);' +
        'font:700 20px system-ui,sans-serif;color:#fff;pointer-events:none;' +
        'transition:opacity .4s;');
      var s = document.createElement('span');
      s.textContent = 'S';
      s.setAttribute('style', 'display:inline-block;padding:4px 14px;font-size:22px;font-weight:900;' +
        'color:#000;background:#ffea00;border:2px solid #7a6400;border-radius:5px;');
      var t = document.createElement('span');
      t.textContent = name + '  ' + room;
      d.appendChild(s);
      d.appendChild(t);
      (document.body || document.documentElement).appendChild(d);
      setTimeout(function () {
        try { d.style.opacity = '0'; } catch (e) {}
        setTimeout(function () { try { if (d.parentNode) d.parentNode.removeChild(d); } catch (e2) {} }, 450);
      }, 1700);
    } catch (e) {}
  }

  function copyNameRoom() {
    var doc = document;
    var name = residentLastFirst(doc);
    if (!name) { toast('No resident name found'); return false; }
    var room = roomBedNumber(doc, isCrownHeights(doc));
    if (!room) { toast('No room found for ' + name); return false; }
    copyTextToClipboard(doc, name + '\t' + room);
    flashCopiedIndicator(name, room);
    return true;
  }

  // ---- Badges + floating hint (passive; never clicks anything) ----
  function applyBadges() {
    try {
      injectCSS(document);
      // Letter badges on tabs (searched inside the tab strip only)
      var strip = findTabStrip(document);
      var scope = strip || document;
      Object.keys(TAB_KEYS).forEach(function (key) {
        var labels = TAB_KEYS[key];
        var tab = null;
        for (var i = 0; i < labels.length && !tab; i++) tab = findInScope(scope, document, labels[i]);
        if (tab && !tab.hasAttribute(BADGE_ATTR)) {
          tab.setAttribute(BADGE_ATTR, key);
          if (ROW_BOTTOM.indexOf(key) !== -1) tab.setAttribute(ROW_ATTR, 'bottom');
          tab.setAttribute('title', 'Shortcut: press ' + key);
        }
      });
      // Number badge: 1 on ADMISSION RECORD — called FACE SHEET at Boro Park (Profile tab)
      var admCands = findByExactText(document, 'ADMISSION RECORD');
      if (!admCands.length) admCands = findByExactText(document, 'FACE SHEET');
      applyNumBadge(admCands[0], '1');
      // Number badge: 1 on VIEW ALL (Progress Notes tab)
      applyNumBadge(findViewAll(document), '1');
      // Orange key badges above the Forms/Assessments Type filter: 1 psych · 2 BIMS · 3 All
      addTypeKeyBadges(document);
      // F badge on the most-recent-psych-note edit link
      applyFBadge(document);
      // Re-run every second so the Reasons popup Save gets its F badge
      // when the popup opens (it's not there on page load). Search frames
      // too — the popup may not be in the top document.
      setInterval(function(){
        try {
          findInFrames(window.top, function(doc){
            applyFBadge(doc);
            return null;
          });
        } catch(e){}
      }, 1000);
      // Clickable red F button by the most recent psych row's action links
      applyFButton(document);
      // Clickable red F button next to Lock on the Psych: Consult form page —
      // a shortcut for Lock (his sign-then-lock workflow).
      applyFButtonFormPage(document);
      // Clickable red F button next to Save & Sign & Lock & Exit on the
      // Bedford/Crown Heights Consult-Psychiatry form page.
      applyFButtonBedfordForm(document);
      // Clickable red F button next to Save & Exit on the CNR/Saints
      // Consult-Psychiatry form page.
      applyFButtonCNRForm(document);
      // Clickable red F button next to "view" on Section 1 (Reason for
      // Consultation) — CNR/Saints section-list page only.
      applyFButtonReasonView(document);
      // Clickable red F button next to "Next Section" — CNR/Saints only.
      applyFButtonNextSection(document);
      // Clickable red F button next to "sign" on Section 2 — CNR/Saints only.
      applyFButtonSectionSign(document);
      // Form section edit page: focus the main writing field on load
      focusNoteField(document);
      // Admission alert DISABLED (2026-10-02): the standalone PCC-Forms-Readmission-flag
      // script handles this with more detail. Having both active caused a rendering
      // loop (nested boxes, flickering bold). This call is kept as a no-op for
      // easy re-enable if the other script is ever removed.
      // highlightStaleAdmission(document);
      // PCC auto-focuses the resident search box on many pages, which swallows
      // single-key shortcuts. If it did that on load and the user hasn't taken
      // focus themselves, drop it.
      if (!userTookFocus && Date.now() - pageLoadAt < 8000) {
        try {
          var ae = document.activeElement;
          if (ae && !ae.value) {
            var sbox = findResidentSearchBox(document);
            if (sbox && ae === sbox) ae.blur();
          }
        } catch (e2) {}
      }
      // Profile page: enlarge the Relationships box
      enlargeRelationships(document);
      // Chart snapshot: collect per-resident data (throttled); C copies it
      if (SNAPSHOT_ENABLED && (!document.__snapLast || Date.now() - document.__snapLast > 5000)) {
        document.__snapLast = Date.now();
        collectSnapshot(document);
      }
      // A badge pinned to the resident search box
      placeABadge();
    } catch (e) { /* not ready yet */ }
  }

  // Profile page: make the Relationships box (built by your "PCC Profile -
  // Contact relationships (copy box)" script, id="relBox") larger and more
  // visible, with label + names + Copy button on one line.
  // Paint-only: changes no layout or behavior.
  function enlargeRelationships(doc) {
    if (!ENLARGE_RELATIONSHIPS) return;
    try {
      var box = doc.getElementById('relBox');
      if (!box || !visible(box)) return;
      box.setAttribute(RELBOX_ATTR, '1');
      // one-line layout: "Relationships: <names> [Copy]", centered
      var head = box.querySelector('div');
      var out = box.querySelector('#relOut');
      var btn = box.querySelector('#relCopyBtn');
      if (head && out && btn) {
        if (out.parentElement !== head) head.insertBefore(out, btn);
        head.style.justifyContent = 'center';
        head.style.gap = '12px';
        head.style.flexWrap = 'wrap';
        var b = head.querySelector('b');
        if (b && !/:$/.test(b.textContent || '')) b.textContent += ':';
      }
      if (!doc.getElementById(RELBOX_CSS_ID)) {
        var st = doc.createElement('style');
        st.id = RELBOX_CSS_ID;
        st.textContent =
          '[' + RELBOX_ATTR + '] { font-size: 20px !important; line-height: 1.5 !important; margin: 8px 0 8px 16px !important; text-align: center !important; }' +
          '[' + RELBOX_ATTR + '] b, [' + RELBOX_ATTR + '] div { font-size: 20px !important; }' +
          '[' + RELBOX_ATTR + '] #relOut { text-align: center !important; }' +
          '[' + RELBOX_ATTR + '] #relCopyBtn { font-size: 16px !important; font-weight: 800 !important; padding: 8px 22px !important; }';
        (doc.head || doc.documentElement).appendChild(st);
      }
    } catch (e) {}
  }

  // Orange 1/2/3 key badges on their own line right above the Type dropdown.
  function addTypeKeyBadges(doc) {
    if (doc.getElementById(TYPEKEYS_ID)) return;
    var sel = findTypeSelect(doc);
    if (!sel || !sel.parentNode) return;
    try {
      var row = doc.createElement('div');
      row.id = TYPEKEYS_ID;
      row.setAttribute('style', 'margin:2px 0 4px 0;');
      var isBP = false;
      try { isBP = isBoroPark(doc); } catch (e) {}
      var items = [['1', 'psych'], ['2', 'BIMS'], ['3', isBP ? 'MD review' : 'All']];
      for (var i = 0; i < items.length; i++) {
        var b = doc.createElement('span');
        b.textContent = items[i][0];
        b.title = 'Shortcut: press ' + items[i][0] + ' for ' + items[i][1];
        b.setAttribute('style', 'display:inline-block;margin-right:5px;padding:2px 10px;' +
          'font-size:16px;font-weight:900;color:#000;background:#ff9500;' +
          'border:2px solid #7a4a00;border-radius:4px;box-shadow:0 0 5px rgba(255,149,0,.8);' +
          'vertical-align:1px;');
        row.appendChild(b);
        var lab = doc.createElement('span');
        lab.textContent = items[i][1];
        lab.setAttribute('style', 'margin-right:14px;font-size:13px;color:#222;');
        row.appendChild(lab);
      }
      sel.parentNode.insertBefore(row, sel);
    } catch (e) {}
  }

  // DOM-dependent setup waits for the document; the focus interceptor above is
  // already active at document-start.
  function initBadges() {
    applyBadges();
    setTimeout(applyBadges, 1500);
    setTimeout(applyBadges, 4000);
    var debounce = null;
    try {
      new MutationObserver(function () {
        clearTimeout(debounce);
        debounce = setTimeout(applyBadges, 400);
      }).observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {}
    try {
      window.addEventListener('scroll', function () { placeABadge(); }, true);
      window.addEventListener('resize', function () { placeABadge(); });
    } catch (e) {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBadges);
  } else {
    initBadges();
  }

  // ---- Keyboard shortcuts (runs in every frame so it works wherever focus is) ----
  // Any click means the user placed focus themselves — stop auto-managing it.
  document.addEventListener('mousedown', function () { userTookFocus = true; }, true);
  document.addEventListener('keydown', function (e) {
    // Option+F (Alt+F on Mac): trigger the F action even while typing in a
    // field. Single-key F is dead while typing (never hijack notes); the
    // Option modifier makes this a deliberate shortcut that can't fire
    // accidentally while writing. E.g. on the Bedford/Crown Heights form,
    // Option+F clicks Save & Sign & Lock & Exit without leaving the note.
    // Cmd+F (find) and Ctrl combos are left alone.
    if (e.altKey && !e.metaKey && !e.ctrlKey && !e.repeat && (e.key || '').toUpperCase() === 'F') {
      if (!enabled) return;
      e.preventDefault();
      e.stopPropagation();
      doFAction();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;   // leave combos alone (incl. Option+key on Mac)
    if (e.repeat) return;                             // holding a key never repeat-fires
    if (isEditable(e.target)) { userTookFocus = true; return; }  // never hijack typing (notes, fields, open dropdowns)
    var k = (e.key || '').toUpperCase();
    if (k.length !== 1) return;
    if (k === '0') {                                  // kill-switch
      enabled = !enabled;
      renderOffIndicator();
      toast(enabled ? 'PCC shortcuts ON' : 'PCC shortcuts OFF');
      e.preventDefault();
      return;
    }
    if (!enabled) return;
    // Spacebar: switch Dia split-view panel via Shift+Ctrl+[ (previous panel).
    // Only in Dia (checked via user agent) — in other browsers spacebar does nothing
    // (but still never scrolls). Never fires while typing (guarded above).
    // Note: synthetic key events may not trigger browser-chrome shortcuts.
    if (e.key === ' ') {
      e.preventDefault();
      try {
        var ua = (navigator.userAgent || '').toLowerCase();
        var isDia = ua.indexOf('dia') !== -1;
        if (isDia){
          var mkEv = function(type) {
            return new KeyboardEvent(type, {
              key: '[', code: 'BracketLeft',
              shiftKey: true, ctrlKey: true,
              bubbles: true, cancelable: true
            });
          };
          document.dispatchEvent(mkEv('keydown'));
          document.dispatchEvent(mkEv('keyup'));
        }
      } catch (e2) {}
      return;
    }
    if (k === 'A') {
      if (focusResidentSearch()) e.preventDefault();
      return;
    }
    if (k === 'C') {
      if (copySnapshot()) e.preventDefault();
      return;
    }
    if (k === 'S') {
      if (copyNameRoom()) e.preventDefault();
      return;
    }
    if (k === 'F') {
      // Boro Park only: assessments list -> edit the most recent psych note;
      // form page -> edit the section. Shared with the clickable F button.
      if (doFAction()) e.preventDefault();
      return;
    }
    if (TAB_KEYS[k]) {
      var tab = findTab(TAB_KEYS[k]);
      if (tab) { e.preventDefault(); tab.click(); }
      return;
    }
    if (k === '1' || k === '2' || k === '3') {
      try { if (handleNumber(k)) e.preventDefault(); } catch (err) { /* ignore */ }
    }
  }, true);
})();
