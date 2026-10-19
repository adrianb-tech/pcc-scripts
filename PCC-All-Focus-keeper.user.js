// ==UserScript==
// @name         Every facility — Focus keeper (pop-ups)
// @version      1.3
// @description  His rule (2026-10-19): when a pop-up appears, the pop-up takes the focus; when the pop-up disappears, focus returns to the place it was before the pop-up. Built because after signing a note, focus stayed parked in the closed signature flow and every letter key went dead until he clicked the page. Detection is click-driven with bounded follow-up checks (no permanent observers, no timers): a trusted click arms a few quick looks for a dialog; while one is tracked, later clicks/keys check whether it has gone.
// @updateURL    https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Focus-keeper.user.js
// @downloadURL  https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Focus-keeper.user.js
// @match        https://*.pointclickcare.com/*
// @match        https://*.pointclickcare.com/*
// @run-at       document-idle
// @allFrames    true
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  var OFF = false;              // '0' kill switch, like the other scripts
  var tracked = null;           // the pop-up element currently holding focus duty
  var returnTo = null;          // element focused before the pop-up opened
  var lastUserTarget = null;    // where his latest click/key actually landed

  var POPUP_SEL = '[role="dialog"], .ui-dialog, .modal, .modal-dialog, .pcc-dialog, ' +
    '[class*="modal"], [class*="Modal"], [class*="dialog"], [class*="Dialog"]';

  function ours(el) {
    var n = el;
    while (n && n !== document.documentElement) {
      var id = n.id || '';
      if (/^tm|^pcc-|^pn[A-Z]/.test(id)) return true;
      n = n.parentElement;
    }
    return false;
  }

  function visible(el) {
    // v1.3: the pop-up counts as GONE when it has no
    // up the ancestor chain. v1.2 only read the tracked
    // node's OWN display style - but PCC closes dialogs
    // by hiding a WRAPPER around them, and a child's own
    // computed style still says 'block' while an ancestor
    // is display:none, so the keeper waited forever and
    // never gave the focus back.
    if (!el || !el.isConnected) return false;
    var n = el;
    while (n && n !== document.documentElement) {
      var cs = window.getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      n = n.parentElement;
    }
    return true;
  }

  function findPopup() {
    var cands = document.querySelectorAll(POPUP_SEL);
    for (var i = cands.length - 1; i >= 0; i--) {
      var el = cands[i];
      if (ours(el)) continue;
      if (!visible(el)) continue;
      // A pop-up holds controls; a stray styled div does not.
      if (el.querySelector('input, textarea, select, button, a[href], [tabindex]')) return el;
    }
    return null;
  }

  function firstFocusable(root) {
    // The RIGHT place inside a pop-up (v1.2): a field he
    // is meant to type in beats a button - v1.0/v1.1 took
    // the first focusable of any kind, which could be a
    // close link or the Cancel button. Also leaves a
    // hidden decision log in the page (#tmFocusLog) so a
    // capture can show exactly what the keeper did.
    var list = root.querySelectorAll('input:not([type="hidden"]), textarea, select, button, a[href], [tabindex]');
    var fallback = null;
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el.disabled || el.readOnly) continue;
      var cs = window.getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      var tag = el.tagName;
      var type = (el.getAttribute('type') || '').toLowerCase();
      if (tag === 'TEXTAREA' || (tag === 'INPUT' && type !== 'checkbox' && type !== 'radio' && type !== 'button' && type !== 'submit')) return el;
      if (!fallback) fallback = el;
    }
    return fallback;
  }

  function describe(el) {
    if (!el) return 'none';
    if (el === document.body) return 'body';
    var s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    else if (el.className && typeof el.className === 'string') s += '.' + el.className.split(' ')[0];
    return s;
  }
  function logEvent(msg) {
    try {
      var n = document.getElementById('tmFocusLog');
      if (!n) {
        n = document.createElement('div');
        n.id = 'tmFocusLog';
        n.style.display = 'none';
        (document.body || document.documentElement).appendChild(n);
      }
      var lines = (n.textContent || '').split(' | ').filter(Boolean);
      lines.push(msg);
      while (lines.length > 6) lines.shift();
      n.textContent = lines.join(' | ');
    } catch (e) {}
  }

  function usableReturn(el) {
    if (!el || !el.isConnected) return null;
    if (el === document.body || el === document.documentElement) return null;
    // The place it was before may have gone read-only / hidden
    // when the pop-up finished (a signed form). Parking focus
    // in a dead field would keep the keys asleep, so a dead
    // target means: neutral ground (the page body).
    if (el.disabled || el.readOnly) return null;
    var cs = window.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return null;
    return el;
  }

  function engage(popup) {
    tracked = popup;
    logEvent('engaged ' + describe(popup));
    escortStart();
    var back = usableReturn(returnTo);
    returnTo = back; // may be null -> body is the fallback
    var f = firstFocusable(popup);
    try {
      if (f) f.focus();
      else { popup.setAttribute('tabindex', '-1'); popup.focus(); }
    } catch (e) {}
  }

  function release() {
    escortStop();
    var back = usableReturn(returnTo);
    tracked = null;
    returnTo = null;
    // Only pull focus back if it is currently nowhere useful:
    // in the vanished pop-up, on the body, or parked in a
    // field he did not choose after the pop-up closed.
    var ae = document.activeElement;
    var focusLost = !ae || ae === document.body || ae === document.documentElement;
    if (lastUserTarget && ae === lastUserTarget && !focusLost) return; // he chose a new place himself
    logEvent('released -> ' + describe(back));
    try {
      if (back) back.focus();
      else if (document.body && document.body.focus) document.body.focus();
      if (!back && ae && ae.blur && ae !== document.activeElement) ae.blur();
      if (!back && document.activeElement && document.activeElement !== document.body &&
          (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') &&
          document.activeElement !== lastUserTarget) {
        document.activeElement.blur();
      }
    } catch (e) {}
  }

  // Escort (v1.1): while a pop-up is tracked, a SHORT
  // chain of checks (about once a second, hard cap ~60)
  // watches for it to vanish ON ITS OWN - a save that
  // finishes on the server and closes the dialog with no
  // click or key from him. That silent close is exactly
  // what stranded his focus after signing/locking/saving
  // a copied note: his first F went to the parked field,
  // only the second worked. The chain exists only while
  // a pop-up he summoned is open and stops the moment it
  // closes - nothing runs when no pop-up is up.
  var escortTimer = null, escortTicks = 0;
  function escortStart() {
    if (escortTimer) return;
    escortTicks = 0;
    escortTimer = setInterval(function () {
      escortTicks++;
      if (OFF || !tracked || escortTicks > 60) { escortStop(); return; }
      if (!visible(tracked)) { escortStop(); release(); }
    }, 900);
  }
  function escortStop() {
    if (escortTimer) { clearInterval(escortTimer); escortTimer = null; }
  }

  function checkAfterAction() {
    if (OFF) return;
    if (tracked) {
      if (!visible(tracked)) { release(); return; }
      return; // pop-up still up: it keeps the focus duty
    }
    var p = findPopup();
    if (p) engage(p);
  }

  function armChecks() {
    // One extra late check (v1.3): PCC's dialogs often
    // wait on a server round-trip and can open past the
    // old 2.2s window, in which case the keeper never
    // engaged at all and the close went unwatched.
    [120, 450, 1100, 2200, 4000].forEach(function (ms) { setTimeout(checkAfterAction, ms); });
  }

  document.addEventListener('click', function (e) {
    if (!e.isTrusted) return;
    lastUserTarget = e.target;
    if (!tracked) {
      // The place focus sat BEFORE this click is the return
      // address if this click summons a pop-up.
      returnTo = document.activeElement;
    }
    armChecks();
  }, true);

  // Window layer (v1.1): PCC often puts the form in a
  // pop-up WINDOW. When such a window closes after Save,
  // he should land back on the window that opened it.
  // As the window goes away, hand focus to the opener;
  // a broadcast also tells the opener's keeper to put
  // focus back on the element he was using there.
  var lastOwnFocus = null;
  document.addEventListener('focusin', function (e) {
    if (e.target && e.target !== document.body) lastOwnFocus = e.target;
  }, true);
  var chan = null;
  try { chan = new BroadcastChannel('tm-focus-keeper-v1'); } catch (e) {}
  if (chan) {
    chan.onmessage = function (ev) {
      if (OFF || !ev.data || ev.data.type !== 'popup-closed') return;
      try { window.focus(); } catch (e) {}
      var back = usableReturn(lastOwnFocus);
      try {
        if (back) back.focus();
        else if (document.body && document.body.focus) document.body.focus();
      } catch (e) {}
    };
  }
  window.addEventListener('pagehide', function () {
    try { if (window.opener && !window.opener.closed) window.opener.focus(); } catch (e) {}
    try { if (chan) chan.postMessage({ type: 'popup-closed' }); } catch (e) {}
  });

  document.addEventListener('keydown', function (e) {
    if (!e.isTrusted) return;
    if (e.key === '0' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      var t = e.target;
      var typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (!typing) { OFF = !OFF; tracked = null; returnTo = null; escortStop(); return; }
    }
    lastUserTarget = e.target;
    // A keypress is often the first sign a pop-up closed
    // (Enter/Escape inside it). One bounded look.
    if (tracked) setTimeout(checkAfterAction, 200);
  }, true);
})();
