// ==UserScript==
// @version 1.0
// @updateURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-Psych-Orders-reorder-status-toggle.user.js
// @downloadURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-Psych-Orders-reorder-status-toggle.user.js
// @name         PCC Psych Orders — reorder + status toggle
// @namespace    pcc-psych-reorder
// @match        *://*.pointclickcare.com/clinical/ordersChart.xhtml*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Keyword lists (lowercase; matched as substrings of a row's text)
  // ---------------------------------------------------------------------------
  const CONSULT = [
    'psych consult','psychiatry consult','psychiatric consult',
    'psych consultation','psychiatry consultation','psychiatric consultation',
    'psych eval','psychiatry eval','psychiatric eval'
  ];

  const PSYCH_MEDS = [
    // Antipsychotics
    'olanzapine','quetiapine','seroquel','risperidone','risperdal','aripiprazole',
    'abilify','haloperidol','haldol','ziprasidone','geodon','paliperidone','invega',
    'clozapine','lurasidone','latuda','asenapine','chlorpromazine','fluphenazine',
    'perphenazine','thioridazine','loxapine','brexpiprazole','rexulti','cariprazine',
    'vraylar','pimavanserin','nuplazid',
    // Antidepressants (incl. doxepin)
    'sertraline','zoloft','fluoxetine','prozac','citalopram','celexa','escitalopram',
    'lexapro','paroxetine','paxil','venlafaxine','effexor','desvenlafaxine','pristiq',
    'duloxetine','cymbalta','bupropion','wellbutrin','mirtazapine','remeron','trazodone',
    'amitriptyline','nortriptyline','doxepin','imipramine','desipramine','vilazodone',
    'vortioxetine','fluvoxamine',
    // Mood stabilizers
    'lithium','valproate','valproic','divalproex','depakote','lamotrigine','lamictal',
    'carbamazepine','tegretol','oxcarbazepine',
    // Anxiolytics / benzodiazepines
    'lorazepam','ativan','alprazolam','xanax','clonazepam','klonopin','diazepam','valium',
    'buspirone','buspar','hydroxyzine','vistaril','atarax','chlordiazepoxide','temazepam','oxazepam',
    // Dementia
    'memantine','namenda','donepezil','aricept','rivastigmine','exelon','galantamine','razadyne',
    // Sleep
    'melatonin','zolpidem','ambien','eszopiclone','lunesta','zaleplon','sonata','ramelteon',
    'rozerem','suvorexant','belsomra','lemborexant','dayvigo',
    // ADHD
    'methylphenidate','ritalin','concerta','amphetamine','dextroamphetamine','lisdexamfetamine',
    'vyvanse','adderall','atomoxetine','strattera','guanfacine','intuniv','clonidine','kapvay',
    'modafinil','armodafinil',
    // Addiction
    'buprenorphine','suboxone','naltrexone','vivitrol','naloxone','methadone','acamprosate',
    'campral','disulfiram','antabuse','nicotine','varenicline','chantix',
    // EPS meds
    'benztropine','cogentin','trihexyphenidyl','artane','diphenhydramine','amantadine',
    'propranolol','valbenazine','ingrezza','deutetrabenazine','austedo','tetrabenazine','biperiden'
  ];

  const has = (t, list) => list.some(k => t.includes(k));
  const groupOf = text => {
    const t = (text || '').toLowerCase();
    if (has(t, CONSULT)) return 0;      // psych/psychiatry consult -> very top
    if (has(t, PSYCH_MEDS)) return 1;   // psych meds -> next
    return 2;                           // everything else, unchanged
  };

  // ---------------------------------------------------------------------------
  // Reorder the order table(s): consult, then psych meds, then the rest.
  // ---------------------------------------------------------------------------
  function reorderTable(tbody) {
    const rows = Array.from(tbody.children)
      .filter(r => r.tagName === 'TR' && !r.querySelector('th'));
    if (rows.length < 2) return;
    const dec = rows.map((row, i) => ({ row, i, g: groupOf(row.textContent) }));
    const sorted = [...dec].sort((a, b) => a.g - b.g || a.i - b.i);
    if (sorted.every((d, idx) => d === dec[idx])) return;
    sorted.forEach(d => tbody.appendChild(d.row));
  }

  function reorderOrderTables() {
    document.querySelectorAll('table').forEach(table => {
      const head = (table.tHead ? table.tHead.textContent : '').toLowerCase();
      const first = table.querySelector('tr');
      const looksLikeOrders = head.includes('order') ||
        (first && first.textContent.toLowerCase().includes('order'));
      if (looksLikeOrders) table.querySelectorAll('tbody').forEach(reorderTable);
    });
  }

  // ---------------------------------------------------------------------------
  // Am I on the Orders screen?
  // ---------------------------------------------------------------------------
  function onOrdersScreen() {
    const txt = document.body.innerText || '';
    return /Order Listing/i.test(txt) && /Display Filters/i.test(txt);
  }

  // ---------------------------------------------------------------------------
  // Toggle:
  //   OFF = all categories, active only (consult + psych meds float to top)
  //   ON  = pharmacy only, active + completed + discontinued (psych meds on top)
  // ---------------------------------------------------------------------------
  const MODE = 'pccPsychMode';

  function findFilterForm() {
    const anchor =
      document.querySelector('input[name="status_active"]') ||
      document.querySelector('input[name="status_discontinued"]');
    return anchor ? anchor.form : null;
  }

  function findDisplayFiltersToggle() {
    for (const el of document.querySelectorAll('a, span, div, td, th, button')) {
      if (el.childElementCount > 2) continue;
      const t = (el.textContent || '').trim().toLowerCase();
      if (t === 'display filters' || t === '+ display filters' || t === '- display filters') return el;
    }
    return null;
  }

  function ensureFilterForm(cb) {
    let form = findFilterForm();
    if (form) return cb(form);
    const expander = findDisplayFiltersToggle();
    if (!expander) return cb(null);
    expander.click();
    let tries = 0;
    const iv = setInterval(() => {
      form = findFilterForm();
      if (form || ++tries > 25) { clearInterval(iv); cb(form); }
    }, 100);
  }

  function setChk(form, name, on) {
    const el = form.elements[name];
    if (el && 'checked' in el) el.checked = on;
  }
  function setVal(form, name, val) {
    const el = form.elements[name];
    if (el && 'value' in el) el.value = val;
  }

  // Set every category_* checkbox on/off.
  function setAllCategories(form, on) {
    Array.from(form.elements).forEach(el => {
      if (el.type === 'checkbox' && /^category_/i.test(el.name || '')) el.checked = on;
    });
  }
  // Pharmacy only: uncheck all categories, then check pharmacy.
  function pharmacyOnly(form) {
    setAllCategories(form, false);
    setChk(form, 'category_pharmacy', true);
  }

  function submitFilter(mode) {
    ensureFilterForm(form => {
      if (!form) { toast("Couldn't open PCC's order filter — expand Display Filters once, then use the toggle."); return; }
      if (mode === 'on') {
        pharmacyOnly(form);                    // meds only
        setChk(form, 'status_active', true);
        setChk(form, 'status_completed', true);
        setChk(form, 'status_discontinued', true);
      } else {
        setAllCategories(form, true);          // all categories
        setChk(form, 'status_active', true);
        setChk(form, 'status_completed', false);
        setChk(form, 'status_discontinued', false);
      }
      setVal(form, 'filter', 'true');
      setVal(form, 'ESOLfilterRefresh', 'Y');
      setVal(form, 'page', '1');
      setVal(form, 'isChangingPage', 'false');
      localStorage.setItem(MODE, mode);
      form.submit();
    });
  }

  // ---------------------------------------------------------------------------
  // Single-line draggable toggle (bottom-right by default)
  // ---------------------------------------------------------------------------
  const OFF_LABEL = 'All active orders — psych + consult on top';
  const ON_LABEL  = 'All meds — active, completed & discontinued';

  function paint(wrap, on) {
    wrap.querySelector('.pcc-label').textContent = on ? ON_LABEL : OFF_LABEL;
    wrap.querySelector('.pcc-track').style.background = on ? '#2e7d32' : '#bbb';
    wrap.querySelector('.pcc-knob').style.left = on ? '22px' : '2px';
  }

  function toast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText =
      'position:fixed;bottom:70px;right:16px;z-index:2147483647;background:#b00020;color:#fff;' +
      'padding:10px 14px;border-radius:8px;font:13px sans-serif;max-width:340px;box-shadow:0 2px 8px rgba(0,0,0,.3);';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 6000);
  }

  function mountToggle() {
    if (document.getElementById('pcc-psych-toggle')) return;

    const wrap = document.createElement('div');
    wrap.id = 'pcc-psych-toggle';
    wrap.style.cssText =
      'position:fixed;z-index:2147483647;display:flex;align-items:center;gap:8px;' +
      'background:#fff;border:1px solid #999;border-radius:20px;padding:6px 12px 6px 8px;' +
      'box-shadow:0 2px 8px rgba(0,0,0,.25);font:13px/1.2 sans-serif;color:#222;' +
      'user-select:none;white-space:nowrap;';

    let placed = false;
    try {
      const saved = JSON.parse(localStorage.getItem('pccPsychTogglePos') || 'null');
      if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') {
        const L = Math.min(Math.max(saved.left, 0), Math.max(window.innerWidth - 60, 0));
        const T = Math.min(Math.max(saved.top, 0), Math.max(window.innerHeight - 30, 0));
        wrap.style.left = L + 'px'; wrap.style.top = T + 'px';
        placed = true;
      }
    } catch (e) {}
    if (!placed) { wrap.style.right = '16px'; wrap.style.bottom = '16px'; }

    wrap.innerHTML =
      '<span class="pcc-handle" title="Drag to move" style="cursor:move;font-size:14px;color:#888;padding:0 2px;">⠿</span>' +
      '<span class="pcc-switch" title="Toggle" style="position:relative;width:40px;height:20px;flex:0 0 auto;cursor:pointer;">' +
        '<span class="pcc-track" style="position:absolute;inset:0;border-radius:20px;background:#bbb;transition:background .15s;"></span>' +
        '<span class="pcc-knob"  style="position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.4);transition:left .15s;"></span>' +
      '</span>' +
      '<span class="pcc-label" style="cursor:pointer;"></span>';

    document.body.appendChild(wrap);

    const isOn = () => localStorage.getItem(MODE) === 'on';
    paint(wrap, isOn());

    const flip = () => { const next = !isOn(); paint(wrap, next); submitFilter(next ? 'on' : 'off'); };
    wrap.querySelector('.pcc-switch').addEventListener('click', flip);
    wrap.querySelector('.pcc-label').addEventListener('click', flip);

    const handle = wrap.querySelector('.pcc-handle');
    let sx, sy, ox, oy, dragging = false;
    handle.addEventListener('mousedown', e => {
      dragging = true;
      const r = wrap.getBoundingClientRect();
      ox = r.left; oy = r.top; sx = e.clientX; sy = e.clientY;
      wrap.style.left = ox + 'px'; wrap.style.top = oy + 'px';
      wrap.style.right = 'auto'; wrap.style.bottom = 'auto';
      e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      wrap.style.left = (ox + e.clientX - sx) + 'px';
      wrap.style.top  = (oy + e.clientY - sy) + 'px';
    });
    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      const r = wrap.getBoundingClientRect();
      localStorage.setItem('pccPsychTogglePos', JSON.stringify({ left: r.left, top: r.top }));
    });
  }

  function removeToggle() {
    const t = document.getElementById('pcc-psych-toggle');
    if (t) t.remove();
  }

  // ---------------------------------------------------------------------------
  // Run only on the Orders screen.
  // ---------------------------------------------------------------------------
  function run() {
    if (!onOrdersScreen()) { removeToggle(); return; }
    reorderOrderTables();
    mountToggle();
  }

  run();
  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => { scheduled = false; run(); }, 300);
  }).observe(document.body, { childList: true, subtree: true });
})();