// ==UserScript==
// @name         Every facility — Form helper: e-signature username
// @version      1.4
// @description  On the Electronic Signature popup: plants the facility's login for the password manager (CNR/Saints pja.abalestra, Boro Park csc.abalestra, Bedford allure.abalestra, Crown Heights allure.AdBalestra), focuses the password field, and focuses Sign once the password is filled — never clicks Sign. v1.3: permanent intervals replaced with bounded staggered checks + input events (no-timers rule). Filed per facility in the master key — this one file serves all of them.
// @updateURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-E-signature-username.user.js
// @downloadURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-E-signature-username.user.js
// @match        https://*.pointclickcare.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function(){
  // Facility keyword (checked in order, first match wins) -> saved Chrome login
  var MAP = [
    [/crown\s*heights/i,                   'allure.AdBalestra'],
    [/bedford/i,                           'allure.abalestra'],
    [/boro(ugh)?\s*park/i,                 'csc.abalestra'],
    [/saints?|joachim|downtown|\bcnr\b/i,  'pja.abalestra']
  ];

  function tag(msg){
    var t = document.getElementById('tmHintTag');
    if (!t){
      t = document.createElement('div');
      t.id = 'tmHintTag';
      t.style.cssText = 'position:fixed;right:6px;bottom:4px;font:11px sans-serif;color:#888;z-index:99999;';
      document.body.appendChild(t);
    }
    t.textContent = msg;
  }

  // Reads the facility name from the main PCC window that opened this popup.
  // Scans aggressively: direct facility keywords anywhere in the opener,
  // then falls back to the Brooklyn/NY/SNF heuristic in the header area.
  function facilityText(){
    var docs = [];
    try { if (window.opener){ docs.push(window.opener.top.document); docs.push(window.opener.document); } } catch(e){}
    try { if (window.top && window.top !== window) docs.push(window.top.document); } catch(e){}
    var FAC_RE = /boro\s*park|bedford|crown\s*heights|saints?|joachim|downtown|\bbpcnr\b|\bcnr\b/i;
    for (var d = 0; d < docs.length; d++){
      var bodyT = '';
      try { bodyT = docs[d].body ? docs[d].body.innerText : ''; } catch(e){ continue; }
      var m = bodyT.match(FAC_RE);
      if (m) return m[0];
      // Fallback: header-area heuristic
      var els = docs[d].querySelectorAll('span,div,a,button,li,p,td,th,h1,h2,h3');
      var best = '';
      for (var i = 0; i < els.length; i++){
        var t = (els[i].textContent || '').replace(/\s+/g, ' ').trim();
        if (t.length < 10 || t.length > 150) continue;
        if (FAC_RE.test(t)) return t.match(FAC_RE)[0];
        var r = els[i].getBoundingClientRect();
        if (r.top > 300 || r.height === 0) continue;
        if (/(?:Brooklyn|,\s*NY|\bSNF\b|Rehabilitation|Nursing)/i.test(t) && (!best || t.length < best.length)) best = t;
      }
      if (best) return best;
    }
    return '';
  }

  // Once the password is filled, put the cursor on the Sign button.
  // It does NOT click Sign; you still press Enter yourself.
  // v1.3: bounded checks (staggered one-shots + input events) instead of a
  // permanent 250ms watch — browser autofill lands within seconds.
  function focusSignWhenFilled(pw){
    var handled = false;
    function check(){
      if (handled || !pw.value) return;
      handled = true;
      setTimeout(function(){
        var btns = document.querySelectorAll('input[type="button"],input[type="submit"],button');
        var found = false;
        for (var i = 0; i < btns.length; i++){
          if (/^Sign$/i.test((btns[i].value || btns[i].textContent || '').trim())){ btns[i].focus(); found = true; break; }
        }
        tag(found ? 'password filled - Sign focused' : 'password filled - Sign button not found');
      }, 150);
    }
    pw.addEventListener('input', check);
    pw.addEventListener('change', check);
    [600, 1500, 3000, 6000, 10000, 15000].forEach(function (ms) { setTimeout(check, ms); });
  }

  function findSignBtn(){
    var btns = document.querySelectorAll('input[type="button"],input[type="submit"],button');
    for (var i = 0; i < btns.length; i++){
      if (/^Sign$/i.test((btns[i].value || btns[i].textContent || '').trim())) return btns[i];
    }
    return null;
  }

  // D = Sign (his ask, 2026-10-14): left hand presses D, right hand
  // presses Enter (Sign is focused once the password is filled) —
  // either hand can sign. Green D badge beside Sign; key handler
  // ignores presses while typing in a field, with modifiers, or on
  // key-repeat. Planted on every e-sig popup, independent of the
  // login-hint flow below.
  var dArmed = false;
  function plantD(){
    if (!/Electronic Signature/i.test(document.title + ' ' + (document.body ? document.body.innerText.slice(0, 400) : ''))) return;
    var sign = findSignBtn();
    if (!sign || !sign.parentNode) return;
    if (!document.getElementById('tmEsigD')) {
      var d = document.createElement('span');
      d.id = 'tmEsigD';
      d.textContent = 'D';
      d.title = 'D = Sign';
      d.style.cssText = 'display:inline-block;margin-left:8px;padding:3px 12px;background:#1e7d32;color:#fff;border-radius:999px;font:bold 14px -apple-system,sans-serif;vertical-align:middle;';
      sign.parentNode.insertBefore(d, sign.nextSibling);
    }
    if (!dArmed) {
      dArmed = true;
      document.addEventListener('keydown', function (ev) {
        if (ev.metaKey || ev.ctrlKey || ev.altKey || ev.repeat) return;
        if (!ev.key || ev.key.toLowerCase() !== 'd') return;
        var tg = ev.target;
        if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.tagName === 'SELECT' || tg.isContentEditable)) return;
        var s = findSignBtn();
        if (s) { ev.preventDefault(); s.click(); }
      });
    }
  }

  function run(){
    plantD();
    if (document.getElementById('tmUserHint')) return;
    if (!/Electronic Signature/i.test(document.title + ' ' + (document.body ? document.body.innerText.slice(0, 400) : ''))) return;
    var pw = document.querySelector('input[type="password"]');
    if (!pw) return;

    var fac = facilityText();
    if (!fac){ tag('login hint: facility name not found' + (window.opener ? '' : ' (no opener)')); return; }

    var user = '';
    for (var i = 0; i < MAP.length; i++){ if (MAP[i][0].test(fac)){ user = MAP[i][1]; break; } }
    if (!user){ tag('login hint: no match for "' + fac.slice(0, 60) + '"'); return; }

    var u = document.createElement('input');
    u.type = 'text'; u.id = 'tmUserHint'; u.name = 'username'; u.autocomplete = 'username'; u.value = user;
    u.tabIndex = -1;
    u.style.cssText = 'position:absolute;top:0;left:0;width:2px;height:2px;opacity:0.01;border:0;padding:0;pointer-events:none;';
    pw.parentNode.insertBefore(u, pw);
    tag('login hint: ' + user);
    focusSignWhenFilled(pw);

    // Auto-focus the password field and show which login to pick.
    // (Browser security prevents scripts from selecting the native
    // password dropdown, so type the prefix + Enter yourself.)
    setTimeout(function(){
      try {
        pw.focus();
        var prefix = user.split('.')[0] || user;
        tag(user + ' — type "' + prefix + '" + Enter');
      } catch(e){}
    }, 600);
  }

  // Bounded staggered attempts (the signature popup's contents can settle
  // late) — run() exits for good once the hint is placed. No permanent timer.
  [300, 900, 1800, 3000, 5000, 8000, 12000, 20000].forEach(function (ms) { setTimeout(run, ms); });
})();
