// ==UserScript==
// @version 1.0
// @updateURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-Forms-Assmnts-Universal-BIMS-Extractor.user.js
// @downloadURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-Forms-Assmnts-Universal-BIMS-Extractor.user.js
// @name         PCC Forms & Assmnts - Universal BIMS Extractor
// @match        https://*.pointclickcare.com/*
// @run-at       document-idle
// @allFrames    true
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    var BIMS_RE = /BIMS|cognitive|cognitively|impair|intact/i;
    var PSYCH_RE = /psychiatr|psych\s*:|psych\s+consult/i;
    var MDACK_RE = /MD:\s*Psychiatry\s+Consult\s+Ack/i;      // "MD: Psychiatry Consult Acknowledgement"
    var DATE_RE = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
    var SCORE_RE = /^\d{1,2}(\.\d+)?$/;
    var STYLE = {
        bims:  { bg: '#cfe8fb', bar: '#007bb6' },   // blue
        psych: { bg: '#d9f2c9', bar: '#4c9a2a' },   // green  (Psych: Consult)
        mdack: { bg: '#fde3b8', bar: '#d97706' }    // amber  (MD: Psychiatry Consult Acknowledgement)
    };
    var KIND_RANK = { bims: 0, psych: 1, mdack: 2 };           // display order

    function txt(el) { return (el.innerText || el.textContent || '').trim(); }

    function findByLabel(root, sel, re) {
        return Array.from(root.querySelectorAll(sel)).find(function (el) {
            return re.test((el.value || el.textContent || '').trim());
        });
    }

    function getBar() {
        var apply = findByLabel(document, 'input[type="button"],input[type="submit"],button', /^Apply$/i);
        if (!apply) return null;
        var el = apply.parentElement;
        while (el && el.querySelectorAll('select').length < 2) el = el.parentElement;
        return el;
    }

    function filtersAreAll() {
        var bar = getBar();
        if (!bar) return true;
        return Array.from(bar.querySelectorAll('select')).every(function (s) {
            var o = s.options[s.selectedIndex];
            return o && /^All$/i.test(o.text.trim());
        });
    }

    function readRow(row) {
        if (row.querySelector('tr') || row.cells.length < 6) return null;
        var t = Array.from(row.cells).map(txt);
        var dateStr = t.find(function (c) { return DATE_RE.test(c); }); // first date = assessment/form date
        if (!dateStr) return null;
        var rowText = t.join(' | ');
        var kind = MDACK_RE.test(rowText) ? 'mdack'
                 : PSYCH_RE.test(rowText) ? 'psych'
                 : (t.some(function (c) { return BIMS_RE.test(c); }) ? 'bims' : null);
        return {
            row: row, kind: kind, dateStr: dateStr, d: new Date(dateStr),
            score: t.find(function (c) { return SCORE_RE.test(c); }),
            complete: t.some(function (c) { return /^Complete$/i.test(c); })
        };
    }

    function organize(items) {
        if (!items.length) return;
        var parent = items[0].row.parentNode;
        var rows = items.filter(function (i) { return i.row.parentNode === parent; });
        var special = rows.filter(function (i) { return i.kind; }).sort(function (a, b) {
            if (a.kind !== b.kind) return KIND_RANK[a.kind] - KIND_RANK[b.kind];   // BIMS, then Psych: Consult, then MD ack
            return b.d - a.d;                                                      // newest first within each group
        });
        var others = rows.filter(function (i) { return !i.kind; });
        var desired = special.concat(others);

        var same = desired.every(function (it, i) { return it === rows[i]; });
        if (!same) {
            var after = rows[rows.length - 1].row.nextSibling;
            desired.forEach(function (it) { parent.insertBefore(it.row, after); });
        }

        special.forEach(function (it) {
            if (it.row.dataset.hl === it.kind) return;
            var s = STYLE[it.kind];
            Array.from(it.row.cells).forEach(function (c, idx) {
                c.style.backgroundColor = s.bg;
                if (idx === 0) c.style.borderLeft = '4px solid ' + s.bar;
            });
            it.row.dataset.hl = it.kind;
        });
    }

    function copyText(text, btn) {
        function done(msg) {
            btn.textContent = msg;
            setTimeout(function () { btn.textContent = 'Copy'; }, 1200);
        }
        function fallback() {
            var ok = false;
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;left:-9999px;top:0;';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            try { ok = document.execCommand('copy'); } catch (e) {}
            document.body.removeChild(ta);
            done(ok ? 'Copied!' : 'Copy failed');
        }
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(function () { done('Copied!'); }, fallback);
            } else {
                fallback();
            }
        } catch (e) { fallback(); }
    }

    // Badge is 2x the original size
    function makeBadge() {
        var box = document.createElement('span');
        box.id = 'custom-bims-badge';
        box.style.cssText = 'display:inline-flex;align-items:center;gap:20px;margin-left:16px;padding:8px 22px;border:2px solid #93c5fd;background:#eff6ff;border-radius:16px;font:26px/1.3 -apple-system,sans-serif;vertical-align:middle;';

        var title = document.createElement('b');
        title.textContent = 'BIMS';
        title.style.cssText = 'color:#1d4ed8;font-size:26px;';

        var value = document.createElement('span');
        value.className = 'bims-value';
        value.style.cssText = 'color:#111;font-weight:bold;font-size:30px;';

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = 'Copy';
        btn.style.cssText = 'cursor:pointer;border:2px solid #1d4ed8;background:#1d4ed8;color:#fff;border-radius:10px;padding:4px 24px;font:bold 24px sans-serif;';
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            copyText(box.dataset.copy || '', btn);
        });

        box.appendChild(title);
        box.appendChild(value);
        box.appendChild(btn);
        return box;
    }

    // The Forms/Assessments list has a "Score" column header; the resident search list does not.
    function hasScoreHeader() {
        return Array.from(document.querySelectorAll('th,td')).some(function (c) {
            return /^Score$/i.test(txt(c));
        });
    }

    function tick() {
        var apply = findByLabel(document, 'input[type="button"],input[type="submit"],button', /^Apply$/i);
        if (!apply || !hasScoreHeader()) {   // not the Forms/Assessments list
            var old = document.getElementById('custom-bims-badge');
            if (old && old.parentNode) old.parentNode.removeChild(old);
            return;
        }

        var items = [];
        document.querySelectorAll('tr').forEach(function (r) {
            var it = readRow(r);
            if (it) items.push(it);
        });

        organize(items);

        var best = items.filter(function (i) {
            var n = parseFloat(i.score);
            return i.kind === 'bims' && i.complete && i.score !== undefined && n >= 0 && n <= 15;
        }).sort(function (a, b) { return b.d - a.d; })[0];

        var box = document.getElementById('custom-bims-badge') || makeBadge();
        var newBtn = findByLabel(document, 'input[type="button"],input[type="submit"],button,a', /^New$/i);
        if (newBtn) {
            if (newBtn.nextElementSibling !== box) newBtn.insertAdjacentElement('afterend', box);
        } else if (apply.previousElementSibling !== box) {
            apply.insertAdjacentElement('beforebegin', box);
        }

        var out = 'N/A';
        if (best) {
            var p = best.dateStr.split('/');
            out = parseFloat(best.score) + ' on ' + parseInt(p[0], 10) + '/' + parseInt(p[1], 10) + '/' + p[2].slice(-2);
        }
        box.querySelector('.bims-value').textContent = out;
        box.dataset.copy = out;
        box.title = (!best && !filtersAreAll()) ? 'List is filtered, so a BIMS may exist under other types' : '';
    }

    setInterval(tick, 1000);
})();