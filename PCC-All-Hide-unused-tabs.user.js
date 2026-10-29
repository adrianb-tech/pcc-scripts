// ==UserScript==
// @name         Every facility — Hide unused tabs
// @version 1.19
// @updateURL    https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Hide-unused-tabs.user.js
// @downloadURL  https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Hide-unused-tabs.user.js
// @match        https://*.pointclickcare.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

var __s3mod_Hide_unused_tabs = 1;
(function () {
  'use strict';

  // Hides the resident-chart tabs Adrian never uses (his list, 2026-10-13;
  // WTS/VITALS and RESULTS joined the set 2026-10-23):
  // CENSUS, PROBLEMS, ALLERGIES, IMMUN, MDS, THERAPY, CARE PLAN, TASKS,
  // MED DIAG, MISC, WTS/VITALS, RESULTS. The MORE/LESS toggle sits IN the
  // row, immediately after PROG NOTES - one spot in both states, so he
  // can open and close rapidly (his spec, 2026-10-23). MORE brings the
  // hidden set back to the toggle's right, in his order: WTS/VITALS,
  // RESULTS, MED DIAG, MISC, then the rest in PCC's original order.
  //
  // v1.2 fix: v1.1 matched the first element with each name ANYWHERE on the
  // page — "ALLERGIES" hit the header label instead of the tab, and MDS hit
  // a stray element, so those two tabs stayed and the button landed in the
  // wrong place. Now the tab bar is located first (the smallest container
  // holding >=5 known tab labels) and tabs are matched only inside it. The
  // run also un-hides any exact-label element OUTSIDE the bar that a
  // previous version hid by mistake.
  //
  // Bounded staggered runs + click re-runs (no permanent timers).

  var HIDE = ['CENSUS', 'PROBLEMS', 'ALLERGIES', 'IMMUN', 'MDS', 'THERAPY', 'CARE PLAN', 'TASKS',
    'MED DIAG', 'MISC', 'WTS/VITALS', 'RESULTS'];
  var ALL_TABS = ['DASH', 'PROFILE', 'CENSUS', 'MED DIAG', 'PROBLEMS', 'ALLERGIES', 'IMMUN',
    'ORDERS', 'WTS/VITALS', 'RESULTS', 'MDS', 'FORMS', 'ASSMNTS', 'THERAPY', 'PROG NOTES', 'CARE PLAN',
    'TASKS', 'MISC'];

  // v1.11 (2026-10-15, his design - Option A + invert, mocked and
  // approved by him first): the tabs are TILES now, styled like his
  // data tiles (Admission / Age/Sex / Room). His four working tabs
  // are big white tiles with a colored dot; the tab he is ON is
  // INVERTED - filled with its color, white text, the dot becomes a
  // white ring. Pressing a tile inverts it instantly, before the
  // page even changes. The second tier (ORDERS, WTS/VITALS,
  // RESULTS, MED DIAG, MISC) stays smaller in its light-red family;
  // the overflow tabs under MORE are plain small white tiles; the
  // MORE/LESS toggle is a tile too.
  var MAINS = {
    'DASH': '#2563eb', 'PROFILE': '#7c3aed', 'FORMS': '#d97706',
    'ASSMNTS': '#d97706', 'PROG NOTES': '#059669'
  };
  // PROFILE's color history: a violet MAIN at v1.11; moved to the
  // red second tier 2026-10-19 (his call then); RESTORED as a main
  // with its own violet 2026-10-23 (his call now: 'Dash, Profile,
  // Forms, Prog Notes should all be their own color'). The four
  // working mains each carry their own color again.
  var SECOND = { 'ORDERS': 1, 'WTS/VITALS': 1, 'RESULTS': 1, 'MED DIAG': 1, 'MISC': 1 };

  function setKids(el, color, size) {
    var kids = el.querySelectorAll('*');
    for (var i = 0; i < kids.length; i++) {
      if (kids[i].classList && kids[i].classList.contains('tmTabDot')) continue;
      kids[i].style.color = color;
      kids[i].style.fontWeight = '700';
      kids[i].style.fontSize = size;
    }
  }
  function dotFor(el, colorHex, inverted) {
    var dot = null;
    for (var i = 0; i < el.children.length; i++) {
      if (el.children[i].classList && el.children[i].classList.contains('tmTabDot')) { dot = el.children[i]; break; }
    }
    if (!dot) {
      dot = document.createElement('span');
      dot.className = 'tmTabDot';
      dot.setAttribute('aria-hidden', 'true');
      if (el.firstChild) el.insertBefore(dot, el.firstChild); else el.appendChild(dot);
    }
    dot.style.cssText = 'display:inline-block;border-radius:50%;margin-right:8px;vertical-align:middle;' +
      (inverted ? 'width:8px;height:8px;background:transparent;border:2.5px solid #ffffff;'
                : 'width:11px;height:11px;background:' + colorHex + ';border:2.5px solid transparent;');
    return dot;
  }
  function paintTab(el, name, isCur) {
    if (!el) return;
    el.style.borderRadius = '12px';
    el.style.cursor = 'pointer';
    el.style.whiteSpace = 'nowrap';
    el.style.boxSizing = 'border-box';
    el.style.lineHeight = '1.15';
    if (MAINS[name]) {
      el.style.padding = '10px 14px';
      el.style.fontSize = '16px';
      el.style.fontWeight = '700';
      if (isCur) {
        el.style.backgroundColor = MAINS[name];
        el.style.color = '#ffffff';
        el.style.border = '1px solid ' + MAINS[name];
        el.style.boxShadow = '0 1px 3px rgba(16,24,40,.25)';
        dotFor(el, MAINS[name], true);
        setKids(el, '#ffffff', '16px');
      } else {
        el.style.backgroundColor = '#ffffff';
        el.style.color = '#131c2b';
        el.style.border = '1px solid #e2e8f0';
        el.style.boxShadow = '0 1px 2px rgba(16,24,40,.05)';
        dotFor(el, MAINS[name], false);
        setKids(el, '#131c2b', '16px');
      }
    } else if (SECOND[name]) {
      el.style.padding = '8px 10px';
      el.style.fontSize = '12.5px';
      el.style.fontWeight = '700';
      if (isCur) {
        el.style.backgroundColor = '#b91c1c';
        el.style.color = '#ffffff';
        el.style.border = '1px solid #b91c1c';
        setKids(el, '#ffffff', '12.5px');
      } else {
        el.style.backgroundColor = '#fff5f5';
        el.style.color = '#7f1d1d';
        el.style.border = '1px solid #fecaca';
        setKids(el, '#7f1d1d', '12.5px');
      }
      el.style.boxShadow = '0 1px 2px rgba(16,24,40,.05)';
    } else {
      el.style.padding = '8px 10px';
      el.style.fontSize = '12.5px';
      el.style.fontWeight = '700';
      if (isCur) {
        el.style.backgroundColor = '#475569';
        el.style.color = '#ffffff';
        el.style.border = '1px solid #475569';
        setKids(el, '#ffffff', '12.5px');
      } else {
        el.style.backgroundColor = '#ffffff';
        el.style.color = '#5b6b7d';
        el.style.border = '1px solid #e2e8f0';
        setKids(el, '#5b6b7d', '12.5px');
      }
      el.style.boxShadow = '0 1px 2px rgba(16,24,40,.05)';
    }
  }
  var MORE_TILE_CSS = 'cursor:pointer;padding:10px 14px;border:1.5px dashed #b6c2cf;border-radius:12px;' +
    'background:#ffffff;color:#5b6b7d;font:700 13.5px -apple-system,Helvetica,Arial,sans-serif;white-space:nowrap;';
  // When MORE is open, these overflow tabs come FIRST, right of the
  // toggle (his order, 2026-10-23) — the rest follow in PCC's
  // original relative order.
  var EXPAND_FIRST = ['WTS/VITALS', 'RESULTS', 'MED DIAG', 'MISC'];

  var tabsHidden = true;   // his default: hidden
  var origOrder = [];      // PCC's own tab order, captured on first sight

  function norm(s) { return (s || '').replace(/\s+/g, ' ').trim().toUpperCase(); }

  function candidates() {
    var els = document.querySelectorAll('a,button,[role="tab"],td,li,span,div');
    var out = [];
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.children.length > 2) continue;
      var t = norm(el.textContent);
      if (ALL_TABS.indexOf(t) !== -1) out.push({ name: t, el: el });
    }
    return out;
  }

  // The tab bar = the smallest container holding at least 5 distinct tab
  // labels (most labels wins; ties go to the smaller subtree).
  function findBar(cands) {
    var recs = [];
    var byNode = new Map();
    cands.forEach(function (c, idx) {
      var node = c.el.parentElement;
      for (var up = 0; up < 8 && node; up++) {
        var rec = byNode.get(node);
        if (!rec) { rec = { node: node, members: [], names: {} }; byNode.set(node, rec); recs.push(rec); }
        if (rec.members.indexOf(idx) === -1) { rec.members.push(idx); rec.names[c.name] = 1; }
        node = node.parentElement;
      }
    });
    var best = null;
    recs.forEach(function (rec) {
      var nNames = Object.keys(rec.names).length;
      if (nNames < 5) return;
      var size = rec.node.querySelectorAll('*').length;
      if (!best || nNames > best.nNames || (nNames === best.nNames && size < best.size)) {
        best = { node: rec.node, nNames: nNames, size: size };
      }
    });
    return best ? best.node : null;
  }

  function tabElement(el, name) {
    var target = el;
    for (var up = 0; up < 6 && target; up++) {
      var tag = target.tagName;
      if (tag === 'A' || tag === 'BUTTON' || tag === 'TD' || tag === 'LI' ||
          target.onclick || target.getAttribute('onclick')) break;
      target = target.parentElement;
    }
    return (target && norm(target.textContent) === name) ? target : el;
  }

  function run() {
    var cands = candidates();
    if (!cands.length) return false;
    var bar = findBar(cands);
    if (!bar) return false;

    var tabs = {};    // name -> element to show/hide
    var order = [];   // names in document order
    cands.forEach(function (c) {
      if (!bar.contains(c.el) || tabs[c.name]) return;
      tabs[c.name] = tabElement(c.el, c.name);
      order.push(c.name);
    });
    if (order.length < 5) return false;

    // Repair: un-hide any exact-label element outside the bar that an
    // earlier version hid by mistake (e.g. the header "Allergies" label).
    var styled = document.querySelectorAll('[style*="display: none"],[style*="display:none"]');
    for (var i = 0; i < styled.length; i++) {
      var s = styled[i];
      if (bar.contains(s)) continue;
      if (ALL_TABS.indexOf(norm(s.textContent)) !== -1 && s.children.length <= 2) s.style.display = '';
    }

    // Current tab from the URL first (v1.16): the page URL
    // already says where he is, while the session memory
    // may still name the tab he came FROM and PCC's
    // selected class may not be set yet on the first
    // paint. PCC's own selected class still wins below
    // when it exists; the memory is the fallback.
    // Unknown URLs yield '' and the memory/class path
    // decides - never paint a wrong current.
    function urlTab() {
      var u = location.href;
      if (/cp_residentdashboard/i.test(u)) return 'DASH';
      if (/cp_careclientprofile/i.test(u)) return 'PROFILE';
      if (/progressnotes/i.test(u)) return 'PROG NOTES';
      return '';
    }
    // Current-tab memory (v1.7, his report): MORE -> click a hidden tab ->
    // the page loads but the bar re-collapses without that tab, so he can't
    // see where he is. Remember his tab clicks for the session; if he is ON
    // a normally-hidden tab, keep THAT tab visible in the collapsed bar and
    // mark it as current. Bonus signal: PCC's own selected-tab class.
    var cur = urlTab();
    try { if (!cur) cur = sessionStorage.getItem('pccCurTab') || ''; } catch (e) {}
    order.forEach(function (name) {
      var el = tabs[name];
      var a = el.querySelector('a');
      var cls = String(el.className || '') + ' ' + (a ? String(a.className || '') : '');
      if (/(selected|active|current)/i.test(cls) || el.getAttribute('aria-selected') === 'true') cur = name;
      if (!el.dataset.pccFwd) {
        el.dataset.pccFwd = '1';
        el.addEventListener('click', function (ev) {
          // Dead-padding forward (v1.16, his report
          // 2026-10-24): paintTab styles the CONTAINER
          // (TD/LI) when PCC's navigation lives on a
          // smaller inner link, so the padding ring
          // looks like a button but clicks nothing.
          // Forward a click that did NOT land on a
          // link to the container's own link, so the
          // whole painted button navigates. Skipped
          // when the container itself is the link or
          // button, or carries its own onclick - those
          // already navigate from the padding.
          if (ev.target && ev.target.closest && ev.target.closest('a')) return;
          if (el.tagName === 'A' || el.tagName === 'BUTTON' || el.onclick) return;
          var a = el.querySelector('a');
          if (a) a.click();
        });
      }
      if (!el.dataset.pccTrack) {
        el.dataset.pccTrack = '1';
        el.addEventListener('click', function () {
          // NO click-time paint (v1.15, his report
          // 2026-10-23): painting the clicked tab current
          // made navigation feel two-step — the color
          // flipped instantly, then he waited for PCC's
          // page to arrive. The tab now changes only
          // when the new page lands and paints itself
          // from where he actually is. The click still
          // records the current-tab memory below.
          try {
            if (HIDE.indexOf(name) !== -1) sessionStorage.setItem('pccCurTab', name);
            else sessionStorage.removeItem('pccCurTab');
          } catch (e2) {}
        });
      }
    });

    HIDE.forEach(function (name) {
      if (!tabs[name]) return;
      var keep = tabsHidden && name === cur;   // the tab he is ON stays visible
      tabs[name].style.display = (tabsHidden && !keep) ? 'none' : '';
    });

    order.forEach(function (name) { paintTab(tabs[name], name, name === cur); });

    // Layout (2026-10-23, his spec - supersedes the v1.8 end-of-bar
    // layout): the toggle lives IN the row, immediately after PROG
    // NOTES, in both states - one spot, so he can open and close
    // rapidly. Closed: the main row in PCC's order, the toggle after
    // Prog Notes, then nothing. Open: the MORE set lines up to the
    // toggle's RIGHT in his order (EXPAND_FIRST, then the rest in
    // PCC order). Moves are idempotent and run on every pass.
    if (!origOrder.length) origOrder = order.slice();
    var anchorName = tabs['PROG NOTES'] ? 'PROG NOTES'
      : (tabs['FORMS'] ? 'FORMS' : (tabs['ASSMNTS'] ? 'ASSMNTS' : order[order.length - 1]));
    var anchor = tabs[anchorName];
    function placeAfter(ref, el) {
      if (!ref || !el || el === ref) return;
      var p = ref.parentElement;
      if (!p || el.parentElement !== p) return;
      p.insertBefore(el, ref.nextSibling);
    }

    // MORE / LESS button - ensured first, so the layout below can
    // seat it (and the opened set) around it.
    var btn = document.getElementById('pccMoreTabsBtn');
    var holder = btn ? btn.parentElement : null;
    if (!btn) {
      if (!anchor || !anchor.parentElement) return true;
      if (anchor.tagName === 'TD') holder = document.createElement('td');
      else if (anchor.tagName === 'LI') holder = document.createElement('li');
      else holder = document.createElement('span');
      btn = document.createElement('button');
      btn.id = 'pccMoreTabsBtn';
      btn.type = 'button';
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        tabsHidden = !tabsHidden;
        run();
      });
      holder.appendChild(btn);
      anchor.parentElement.insertBefore(holder, anchor.nextSibling);
    }
    btn.textContent = tabsHidden ? 'MORE ▸' : 'LESS ▾';
    btn.style.cssText = MORE_TILE_CSS;

    // Tabs back into PCC's own relative order, then the toggle
    // seats right after the anchor.
    var prev = null;
    origOrder.forEach(function (name) {
      var el = tabs[name];
      if (!el) return;
      if (prev) placeAfter(prev, el);
      prev = el;
    });
    if (anchor && holder) placeAfter(anchor, holder);

    if (!tabsHidden) {
      var expandList = EXPAND_FIRST.concat(origOrder.filter(function (name) {
        return HIDE.indexOf(name) !== -1 && EXPAND_FIRST.indexOf(name) === -1;
      }));
      var ref = holder || anchor;
      expandList.forEach(function (name) {
        var el = tabs[name];
        if (el && ref) { placeAfter(ref, el); ref = el; }
      });
    } else if (cur && HIDE.indexOf(cur) !== -1 && tabs[cur]) {
      // The tab he is ON stays visible in the closed bar - right
      // after the toggle, like the opened set it belongs to.
      placeAfter(holder || anchor, tabs[cur]);
    }
    return true;
  }

  // document-start burst (v1.4 pilot, his anti-flicker request): retry every
  // 50ms until the tab bar exists and has been processed (max ~2s), so the
  // hiding + colors land before the first paint in practice. Then the usual
  // staggered passes cover PCC's late re-renders. Bounded — not a poller.
  var burstLeft = 40;
  (function burst() {
    if (run()) return;
    if (--burstLeft <= 0) return;
    setTimeout(burst, 50);
  })();
  // SWAP RE-STYLE/RE-PLANT (v1.17, his Immun→MDS + Misc→MDS reports):
  // a PCC swap replaces the tab bar (fresh DOM: no pccTrack, no MORE
  // button) and can remove the band row, and nothing re-applies our
  // styling. This is NOT a return to the frozen-bar re-runs (which
  // re-touched a styled bar on every click and made clicks land on a
  // moving target): the burst below does NOTHING when markers are
  // present — it only acts when the bar was actually wiped. Bounded
  // (setTimeout chain like the burst above, max 20×500ms ≈ 10s,
  // early-exit when fixed), click-triggered only (a document capture
  // listener — it survives swaps, unlike per-tab listeners on wiped
  // DOM), no preventDefault, no stopPropagation, no DOM writes on
  // the click itself. First check at 500ms (the swap has not happened
  // yet on the click itself, so an immediate check would see the old
  // bar and never start).
  var swapTimer = null, swapTries = 0;
  function swapMarkersOk() {
    return !!document.querySelector('[data-pcc-track]') && !!document.getElementById('pccMoreTabsBtn');
  }
  function swapBurst() {
    if (swapTimer) return;
    swapTries = 0;
    var tick = function () {
      swapTries++;
      var barOk = swapMarkersOk();
      var bandOk = !!document.getElementById('tmCardsRow');
      if (barOk && bandOk) { swapTimer = null; return; }
      if (!barOk) { try { run(); } catch (e) {} }
      if (!bandOk) { try { if (window.__tmCore && window.__tmCore.replant) window.__tmCore.replant(); } catch (e) {} }
      if (swapTries >= 20) { swapTimer = null; return; }
      swapTimer = setTimeout(tick, 500);
    };
    swapTimer = setTimeout(tick, 500);
  }
  function isTabClick(e) {
    var t = e && e.target;
    if (!t || !t.closest) return false;
    if (t.closest('#pccMoreTabsBtn')) return true;
    if (t.closest('[data-pcc-track]')) return true;
    var a = t.closest('a[href]');
    return !!(a && ALL_TABS.indexOf(norm(a.textContent)) !== -1);
  }
  document.addEventListener('click', function (e) {
    if (isTabClick(e)) swapBurst();
  }, true);
  // TAB SHORTCUTS (v1.18, his request 2026-10-29; v1.19 O-toggle fix):
  // single-key tab jumps. H dash (dasH — D is bound on the popup defaults
  // scripts), P profile, O forms/assmnts pair (toggle: on forms → assmnts,
  // elsewhere → forms; v1.19: toggle reads PCC's selected-tab mark, not
  // the URL), N prog notes (prog Notes — P is profile). Same guards as the Keys
  // scripts: isTrusted only, no modifiers, no repeat, dead while typing.
  // '0' toggles the shortcuts locally (like the Keys scripts). Claimed
  // keys (A/F/G/Q/1/2/3) are left alone — this handler ignores them.
  var tabKeysOn = true;
  function tabKeyEditable(t) {
    return !!(t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.isContentEditable));
  }
  function tabKeyUrlTab() {
    var u = location.href;
    if (/cp_residentdashboard/i.test(u)) return 'DASH';
    if (/cp_careclientprofile/i.test(u)) return 'PROFILE';
    if (/progressnotes/i.test(u)) return 'PROG NOTES';
    if (/cp_assessment|assessments/i.test(u)) return 'ASSMNTS';
    if (/forms/i.test(u)) return 'FORMS';
    return '';
  }
  function tabKeyCurrentTab() {
    // PCC's own current-tab mark in the bar (the same selected/active
    // signal run() uses to paint the current tab). Used for the O toggle
    // because the real forms-page URL shape is unproven — URL-sniffing
    // alone made O a no-op there (1.18 miss, his report 2026-10-29).
    var cands = candidates();
    if (!cands.length) return '';
    var bar = findBar(cands);
    if (!bar) return '';
    for (var i = 0; i < cands.length; i++) {
      if (!bar.contains(cands[i].el)) continue;
      var nm = norm(cands[i].el.textContent);
      var el = tabElement(cands[i].el, nm);
      var a = (el.tagName === 'A') ? el : el.querySelector('a');
      var cls = String(el.className || '') + ' ' + (a ? String(a.className || '') : '');
      if (/(selected|active|current)/i.test(cls) || el.getAttribute('aria-selected') === 'true') return nm;
    }
    return '';
  }
  function tabKeyOnForms() {
    var cur = tabKeyCurrentTab();
    if (cur) return cur === 'FORMS';
    return tabKeyUrlTab() === 'FORMS'; // fallback: URL sniffing
  }
  function tabKeyFind(name) {
    var cands = candidates();
    if (!cands.length) return null;
    var bar = findBar(cands);
    if (!bar) return null;
    for (var i = 0; i < cands.length; i++) {
      if (!bar.contains(cands[i].el)) continue;
      if (norm(cands[i].el.textContent) !== name) continue;
      var el = tabElement(cands[i].el, name);
      var a = (el.tagName === 'A') ? el : el.querySelector('a');
      return { el: el, a: a, href: (a && a.href) ? a.href : null };
    }
    return null;
  }
  function tabKeyGo(name) {
    window.__tmTabKeys = window.__tmTabKeys || {};
    var found = tabKeyFind(name);
    if (!found) return;
    if (found.href) {
      window.__tmTabKeys.lastNav = found.href; // href as-is (the Dot's 1.1 lesson: no params appended)
      location.href = found.href;
      return;
    }
    // No usable href (PCC sometimes navigates via JS, not a link) —
    // click the tab the way he would. Hook records 'click:NAME'.
    window.__tmTabKeys.lastNav = 'click:' + name;
    try { (found.a || found.el).click(); } catch (err) {}
  }
  document.addEventListener('keydown', function (e) {
    if (!e.isTrusted) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.repeat) return;
    if (tabKeyEditable(e.target)) return;
    var k = (e.key || '').toUpperCase();
    if (k.length !== 1) return;
    if (k === '0') { tabKeysOn = !tabKeysOn; return; }
    if (!tabKeysOn) return;
    var target = null;
    if (k === 'H') target = 'DASH';
    else if (k === 'P') target = 'PROFILE';
    else if (k === 'N') target = 'PROG NOTES';
    else if (k === 'O') target = tabKeyOnForms() ? 'ASSMNTS' : 'FORMS';
    else return;
    tabKeyGo(target);
    try { e.preventDefault(); } catch (err) {}
  }, true);
  // FROZEN BAR (v1.13, his report 2026-10-19): the late
  // passes (2.5s/4.5s/7s) and the re-run 300ms after
  // every click are GONE. PCC re-renders the bar with
  // all tabs restored, so each re-run re-hid them a beat
  // after he clicked - the tabs slid left in steps while
  // he was aiming at the next one, and clicks landed on
  // a moving target or a gap ('sometimes I hit it and it
  // doesn't register'). His priority: a click must
  // register the first time, every time. So this script
  // now styles the bar ONCE, during the document-start
  // burst (plus a single 2.5s pass for PCC's slowest
  // first render), and never touches it again for the
  // life of the page. (The 2.5s pass was dropped too:
  // the document-start burst already retries every
  // 50ms for up to ~2s, so the bar is styled the moment
  // PCC renders it - a later pass only re-opens the
  // moving window.) Trade-off, accepted: if PCC
  // re-renders the bar mid-session, hidden tabs stay
  // visible until the next chart opens.
})();
