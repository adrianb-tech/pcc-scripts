// ==UserScript==
// @name         PCC Progress Notes - Serious Diagnosis Extractor
// @version 1.7
// @updateURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-Progress-Notes-Serious-Diagnosis-Extractor.user.js
// @downloadURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-Progress-Notes-Serious-Diagnosis-Extractor.user.js
// @match        https://*.pointclickcare.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function(){
  // ===== Medical Abbreviations Mapping =====
  var ABBR = [
    // Cardiac / Vascular
    [/\b(?:obstructive\s+)?hypertrophic\s+(?:obstructive\s+)?cardiomyopathy\b/gi, 'HOCM'],
    [/\bcardiomyopathy\b/gi, 'CMP'],
    [/\bnonrheumatic\s+mitral\s+(?:\(valve\)\s+)?insufficiency\b/gi, 'MR'],
    [/\bmitral\s+valve\s+insufficiency\b/gi, 'MR'],
    [/\bmitral\s+regurgitation\b/gi, 'MR'],
    [/\bheart\s+failure\b/gi, 'HF'],
    [/\bcongestive\s+heart\s+failure\b/gi, 'CHF'],
    [/\bhypertension\b/gi, 'HTN'],
    [/\bhyperlipidemia\b/gi, 'HLD'],
    [/\batrial\s+fibrillation\b/gi, 'AFib'],
    [/\bcoronary\s+artery\s+disease\b/gi, 'CAD'],

    // Psychiatric / Neuro
    [/\bmajor\s+depressive\s+disorder\b/gi, 'MDD'],
    [/\bdepression\b/gi, 'MDD'],
    [/\bgeneralized\s+anxiety\s+disorder\b/gi, 'GAD'],
    [/\bcerebrovascular\s+accident\b/gi, 'CVA'],
    [/\btransient\s+ischemic\s+attack\b/gi, 'TIA'],

    // GI / Renal / Endocrine
    [/\bgastro-?esophageal\s+reflux(?:\s*disease)?(?:\s*without\s+esophagitis)?\b/gi, 'GERD'],
    [/\bchronic\s+kidney\s+disease\b/gi, 'CKD'],
    [/\bacute\s+kidney\s+injury\b/gi, 'AKI'],
    [/\bdiabetes\s+mellitus\b/gi, 'DM'],
    [/\btype\s*2\s*diabetes\b/gi, 'DMII'],

    // Heme / Onc
    [/\bmalt\s+lymphoma\b/gi, 'MALT Lymphoma'],
    [/\b(?:personal\s+history\s+of\s+other\s+)?malignant\s+neoplasms?\s+of\s+lymphoid(?:\s*,\s*hematopoietic[^\n]*)?\b/gi, 'MALT Lymphoma'],
    [/\biron\s+deficiency\s+anemia\b/gi, 'IDA'],
    [/\banemia\b/gi, 'Anemia'],

    // Wounds / Infections / Other
    [/\b(?:sacral\s+)?pressure\s+(?:ulcer|injury)(?:\s+of\s+sacral\s+region)?(?:\s+with\s+osteomyelitis)?\b/gi, 'Sacral Decubitus Ulcer'],
    [/\bsacral\s+osteomyelitis\b/gi, 'Sacral Osteomyelitis'],
    [/\bhypo-?osmolality(?:\s*,\s*hyponatremia)?\b/gi, 'Hyponatremia'],
    [/\bhyponatremia\b/gi, 'Hyponatremia'],
    [/\bovarian\s+cyst\b/gi, 'Ovarian Cyst'],
    [/\b(?:localized\s+)?visual\s+field\s+defect(?:\s+of\s+the\s+right\s+eye)?\b/gi, 'Visual Field Defect']
  ];

  function grab(text, re){
    var out = [], m;
    while ((m = re.exec(text)) !== null) {
      out.push(m[1]);
      if (m.index === re.lastIndex) re.lastIndex++;
    }
    return out;
  }

  function extractDx(text){
    if (!text) return [];
    text = text.replace(/[\u2018\u2019]/g, "'").replace(/[\u2010-\u2015]/g, '-')
               .replace(/\u00A0/g, ' ').replace(/\r/g, '');
    text = text.replace(/[ \t]+/g, ' ');

    var raw = [];
    function push(s){ if (s) raw.push(s); }

    // Read ICD lines
    grab(text, /^[ ]*[A-Za-z]\d{1,3}(?:\.\w{1,4})?:[ ]*([^\n]+?)[ ]*$/gm).forEach(function(s){
      s = s.split(',')[0].replace(/^(?:other|unspecified)\s+/i, '').replace(/\s*\([^)]*\)\s*$/, '');
      push(s);
    });

    // Read PMH sections
    grab(text, /(?:past\s+)?(?:medical|psychiatric)\s+history\s*(?:of|significant\s+for|includes?|notable\s+for|:|\/psh)\s*([^\n]+?)(?=\.\s+[A-Z]|\n|$)/gi).forEach(push);
    grab(text, /\bPMHx?\b\s*:?\s*(?:significant for\s*)?([^\n]+?)(?=\.\s+[A-Z]|\n|$)/gi).forEach(push);

    // "Additional Diagnosis:" / "Secondary diagnosis:" — capture verbatim
    // (explicit clinician statements, bypass condensing filters)
    var verbatim = [];
    grab(text, /\bAdditional Diagnosis\s*:\s*([^\n]+)/gi).forEach(function(s){ verbatim.push(s.trim()); });
    grab(text, /\bSecondary diagnosis\s*:\s*([^\n]+)/gi).forEach(function(s){
      // Avoid double-counting if already inside an Additional Diagnosis capture
      var dup = verbatim.some(function(v){ return v.toLowerCase().indexOf(s.trim().toLowerCase()) >= 0; });
      if (!dup) verbatim.push(s.trim());
    });

    // Filters for non-serious symptoms, functional items, and admission fluff
    var EXCLUDE_EXACT = /^(?:constipation|insomnia|advance careplanning|moderate protein-calorie malnutrition|muscle weakness|difficulty in walking|falling|need for assistance with personal care|gw|generalized weakness|history of|hx of|hx|past surgical history|surgical history|psh|reviewed in electronic medical record|reviewed in emr)$/i;
    var ADMIN_JUNK = /^(?:CPT Codes|ICD Codes|Admission|Minimal Depression|Moderate Depression|Severe Depression|Score|Attestation|Time spent|Date of Service|Transition of Care)/i;
    var PROSE = /^(?:the |res\b|resident|patient\b|pt\b|he |she )|\b(?:arrived|accompanied|presents?|presented|reports?|reported|denies|stretcher|ambulance|admitted to|was admitted|hospitalized|was hospitalized|seen (?:at|by))\b/i;
    // Fragments: start with preposition/conjunction/verb, or are narrative leftovers
    var FRAGMENT = /^(?:of|with|and|or|is|are|was|were|has|have|had|for|in|on|at|by|to|presence of)\b/i;
    var NARRATIVE = /\b(?:significant for|status post|s\/p|baseline|goals of care)\b/i;

    // Normalize for dedup: lowercase, strip qualifiers, keep the core concept
    function normDx(s){
      return s.toLowerCase()
        .replace(/\b(?:chronic|acute|bilateral|unilateral|recurrent|severe|mild|moderate)\b/g, '')
        .replace(/\s*(?:with|s\/p|\/)\s*.*$/, '')  // strip "with X", "s/p X", "/ X" tails
        .replace(/[^a-z0-9]/g, '');
    }

    var seen = {}, out = [];
    // Verbatim diagnoses go first, unfiltered
    verbatim.forEach(function(v){
      if (v && !seen['v:'+v.toLowerCase()]) { seen['v:'+v.toLowerCase()] = 1; out.push(v); }
    });
    raw.forEach(function(str){
      // Clean out tailing narrative phrases like "seen today for PA admission"
      str = str.replace(/\bseen\s+today\s+for\s+[^\n,]*/gi, '');
      // "who was hospitalized on 08/19/2026 for X" -> split into separate items
      // ("daily alcohol use" and "X" become separate diagnoses)
      str = str.replace(/\bwho\s+was\s+hospitalized\s+on\s+\d{1,2}\/\d{1,2}\/\d{2,4}\s+for\s+/gi, ', ');
      // Trailing "reviewed in electronic medical record" is charting fluff, not a diagnosis
      str = str.replace(/,?\s*reviewed\s+in\s+(?:the\s+)?electronic\s+medical\s+record\.?\s*$/gi, '');

      str.split(/\s*(?:,(?![^()]*\))|;|\u2022|\/\s+)\s*|\s+and\s+/i).forEach(function(it){
        it = (it || '').replace(/\s+/g, ' ')
               .replace(/^[-–—:\s.;()]+|[-–—:\s.;()]+$/g, '')
               .replace(/^(?:hx|history|recent|adm with dx|admitted for)\s+of\s+/i, '')
               .replace(/^\/PSH\s*/i, '');

        if (!it || ADMIN_JUNK.test(it) || PROSE.test(it) || EXCLUDE_EXACT.test(it)) return;
        if (/\d+\.\d+/.test(it)) return;
        // Reject fragments and narrative leftovers
        if (FRAGMENT.test(it) || NARRATIVE.test(it)) return;
        // Reject overly long items (real diagnoses are concise; longer = narrative)
        if (it.split(/\s+/).length > 6 || it.length > 50) return;

        // Apply Abbreviation Mappings
        for (var i = 0; i < ABBR.length; i++) {
          it = it.replace(ABBR[i][0], ABBR[i][1]);
        }
        it = it.replace(/\s+/g, ' ').trim();

        if (!it || ADMIN_JUNK.test(it) || EXCLUDE_EXACT.test(it)) return;
        if (FRAGMENT.test(it) || NARRATIVE.test(it)) return;
        if (it.split(/\s+/).length > 6 || it.length > 50) return;

        // Smart Deduplication: normalize and keep the shortest form
        var k = normDx(it);
        if (!k) return;
        if (seen[k]) {
          // Keep the shorter (cleaner) version
          var idx = seen[k] - 1;
          if (it.length < out[idx].length) out[idx] = it;
          return;
        }
        seen[k] = out.length + 1;
        out.push(it);
      });
    });
    // Cap at 12 most important (ICD lines come first, so they're prioritized)
    return out.slice(0, 12);
  }

  // ===== DOM Helpers =====
  function viewLink(txt){
    var links = document.querySelectorAll('a');
    for (var i = 0; i < links.length; i++) if ((links[i].textContent || '').trim() === txt) return links[i];
    return null;
  }

  function notesText(){
    var links = [].slice.call(document.querySelectorAll('a')).filter(function(a){
      return (a.textContent || '').trim().toLowerCase() === 'view';
    });
    if (!links.length) return '';
    var table = links[0].closest('table');
    if (!table) return '';
    return (table.innerText || '').replace(/\t/g, '\n');
  }

  function copyText(text, btn){
    function done(){ var o = btn.textContent; btn.textContent = 'Copied'; setTimeout(function(){ btn.textContent = o; }, 1200); }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, fb); return; }
    } catch (e) {}
    fb();
    function fb(){
      try {
        var ta = document.createElement('textarea');
        ta.value = text; ta.style.cssText = 'position:fixed;opacity:0;';
        document.body.appendChild(ta); ta.focus(); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta); done();
      } catch (e) {}
    }
  }

  // Common diagnosis abbreviations. Full name (lowercase) -> abbreviation.
  // If already abbreviated (e.g. "HTN"), it's left alone.
  var DX_ABBR = {
    'hypertension': 'HTN',
    'hyperlipidemia': 'HLD',
    'major depressive disorder': 'MDD',
    'major depression': 'MDD',
    'depressive disorder': 'MDD',
    'diabetes mellitus': 'DM',
    'diabetes mellitus type 2': 'DM2',
    'type 2 diabetes mellitus': 'DM2',
    'type 2 diabetes': 'DM2',
    'chronic kidney disease': 'CKD',
    'congestive heart failure': 'CHF',
    'coronary artery disease': 'CAD',
    'atrial fibrillation': 'AFib',
    'gastroesophageal reflux disease': 'GERD',
    'urinary tract infection': 'UTI',
    'benign prostatic hyperplasia': 'BPH',
    'chronic obstructive pulmonary disease': 'COPD',
    'cerebrovascular accident': 'CVA',
    'transient ischemic attack': 'TIA',
    'deep vein thrombosis': 'DVT',
    'pulmonary embolism': 'PE',
    'altered mental status': 'AMS',
    'urinary incontinence': 'UI',
    'fecal incontinence': 'FI',
    'chronic pain': 'chronic pain',
    'low back pain': 'LBP',
    'dementia': 'dementia',
    "alzheimer's disease": "Alz",
    'alzheimers disease': 'Alz',
    'parkinson disease': "Parkinson's",
    "parkinson's disease": "Parkinson's",
    'anxiety disorder': 'anxiety',
    'generalized anxiety disorder': 'GAD',
    'bipolar disorder': 'bipolar',
    'schizophrenia': 'schizophrenia',
    'schizoaffective disorder': 'schizoaffective',
    'insomnia': 'insomnia',
    'hypothyroidism': 'hypothyroid',
    'hyperthyroidism': 'hyperthyroid',
    'anemia': 'anemia',
    'hyponatremia': 'hyponatremia',
    'hypernatremia': 'hypernatremia',
    'hypokalemia': 'hypokalemia',
    'hyperkalemia': 'hyperkalemia',
    'leukocytosis': 'leukocytosis'
  };

  function abbrDx(items){
    var seen = {}, out = [];
    for (var i = 0; i < items.length; i++) {
      var raw = (items[i] || '').trim().replace(/\.+$/, '');
      if (!raw) continue;
      var low = raw.toLowerCase();
      var ab = raw;
      // Already abbreviated? (all caps, short, no spaces) -> leave it
      if (!/^[A-Z0-9]+$/.test(raw) || raw.length > 6) {
        if (DX_ABBR[low]) ab = DX_ABBR[low];
      }
      var key = ab.toLowerCase();
      if (!seen[key]) { seen[key] = true; out.push(ab); }
    }
    return out;
  }

  function runDx(){
    var out = document.getElementById('pnDxOut');
    var copy = document.getElementById('pnDxCopy');
    var items = extractDx(notesText());
    if (!items.length) {
      out.textContent = 'No serious diagnoses found in the loaded notes.';
      copy.style.display = 'none';
      return;
    }
    items = abbrDx(items);
    var text = items.join(', ');
    out.textContent = text;
    copy.style.display = '';
    copy.setAttribute('data-fill-value', text);
    copy.onclick = function(){
      copyText(text, copy);
      // Also drop a fill request so the note panel can insert after "Medical Hx".
      try {
        localStorage.setItem('pccFillDiagnoses', JSON.stringify({ value: text, ts: Date.now() }));
      } catch(err){}
    };
  }

  function insertBox(){
    if (document.getElementById('pnDxBox')) return;
    var all = viewLink('All Notes');
    if (!all) return;
    var bar = all.parentElement;
    var box = document.createElement('div');
    box.id = 'pnDxBox';
    box.style.cssText = 'margin:8px 0;padding:8px 12px;border:1px solid #2563eb;background:#eff6ff;font-size:13px;box-sizing:border-box;overflow-wrap:anywhere;';
    box.innerHTML =
      '<div style="font-weight:bold;color:#1d4ed8;margin-bottom:4px;">Diagnoses from notes ' +
      '<button id="pnDxRun" type="button" style="margin-left:6px;padding:1px 6px;font-size:11px;font-weight:normal;cursor:pointer;">Find diagnoses</button> ' +
      '<button class="pcc-fill-copy" id="pnDxCopy" data-fill-label="Diagnoses" type="button" style="margin-left:4px;padding:1px 6px;font-size:11px;font-weight:normal;cursor:pointer;display:none;">Copy</button></div>' +
      '<div id="pnDxOut"></div>';
    bar.parentNode.insertBefore(box, bar.nextSibling);
    document.getElementById('pnDxRun').onclick = runDx;
    runDx();
  }

  function tick(){
    var all = viewLink('All Notes');
    var onPN = all && viewLink('Last 30 days');
    if (!onPN) { try { sessionStorage.removeItem('pnClickedAll'); } catch (e) {} return; }
    if (!sessionStorage.getItem('pnClickedAll')) {
      try { sessionStorage.setItem('pnClickedAll', '1'); } catch (e) {}
      all.click();
      return;
    }
    insertBox();
  }

  setTimeout(tick, 800);
  setInterval(tick, 1500);
})();