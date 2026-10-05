// ==UserScript==
// @name         PCC Dashboard - Auto-size panels + psych meds/dx first + interaction flags
// @version 1.3
// @updateURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-Dashboard-Auto-size-panels-psych-meds-dx-first-interacti.user.js
// @downloadURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-Dashboard-Auto-size-panels-psych-meds-dx-first-interacti.user.js
// @match        https://*.pointclickcare.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function() {
  // ---- MEDS TIER 0 (top, counted): psychiatric meds ----
  var PSYCH = /\b(benztropine|cogentin|trihexyphenidyl|artane|procyclidine|biperiden|amantadine|valbenazine|ingrezza|deutetrabenazine|austedo|tetrabenazine|xenazine|donepezil|aricept|memantine|namenda|namzaric|galantamine|razadyne|rivastigmine|exelon|olanzapine|zyprexa|quetiapine|seroquel|risperidone|risperdal|aripiprazole|abilify|ziprasidone|geodon|haloperidol|haldol|clozapine|clozaril|lurasidone|latuda|paliperidone|invega|asenapine|saphris|brexpiprazole|rexulti|cariprazine|vraylar|lumateperone|caplyta|iloperidone|chlorpromazine|fluphenazine|perphenazine|thioridazine|thiothixene|loxapine|trifluoperazine|pimavanserin|nuplazid|sertraline|zoloft|escitalopram|lexapro|citalopram|celexa|fluoxetine|prozac|paroxetine|paxil|fluvoxamine|venlafaxine|effexor|desvenlafaxine|pristiq|duloxetine|cymbalta|bupropion|wellbutrin|mirtazapine|remeron|trazodone|nefazodone|vilazodone|viibryd|vortioxetine|trintellix|amitriptyline|nortriptyline|pamelor|imipramine|desipramine|doxepin|clomipramine|protriptyline|trimipramine|amoxapine|maprotiline|phenelzine|tranylcypromine|isocarboxazid|selegiline|emsam|lithium|lamotrigine|lamictal|valpro|divalproex|depakote|carbamazepine|tegretol|oxcarbazepine|trileptal|buspirone|buspar|hydroxyzine|lorazepam|ativan|alprazolam|xanax|clonazepam|klonopin|diazepam|valium|temazepam|oxazepam|chlordiazepoxide|clorazepate|zolpidem|ambien|eszopiclone|lunesta|zaleplon|ramelteon|suvorexant|lemborexant|nuedexta)/i;

  var TIER2_COUNTED = /\b(melatonin|methylphenidate|ritalin|concerta|metadate|methylin|daytrana|quillivant|quillichew|jornay|dexmethylphenidate|focalin|dextroamphetamine|dexedrine|procentra|zenzedi|amphetamine|adderall|lisdexamfetamine|vyvanse|methamphetamine|desoxyn)/i;
  var TIER2_UNCOUNTED = /\b(naltrexone|vivitrol|revia|buprenorphine|subutex|sublocade|brixadi|suboxone|zubsolv|bunavail|methadone|acamprosate|campral|disulfiram|antabuse|varenicline|chantix|lofexidine|lucemyra)/i;
  var PAIN = /\b(oxycodone|oxycontin|percocet|hydrocodone|vicodin|norco|morphine|ms contin|hydromorphone|dilaudid|fentanyl|codeine|tramadol|ultram|meperidine|demerol|tapentadol|nucynta|ibuprofen|advil|motrin|naproxen|aleve|meloxicam|celecoxib|celebrex|diclofenac|indomethacin|ketorolac|toradol|cyclobenzaprine|flexeril|methocarbamol|robaxin|baclofen|tizanidine|zanaflex|carisoprodol|soma|gabapentin|neurontin|pregabalin|lyrica)/i;

  // ---- UTI MEDICATIONS ----
  // UTI_TREATMENT: almost exclusively UTI (nitrofurantoin, fosfomycin)
  // UTI_SYMPTOM: urinary pain relief, NOT an antibiotic (phenazopyridine — orange urine)
  // UTI_POSSIBLE: common for UTI but also other infections — check the indication
  // UTI_PREVENTION: prophylaxis, not active treatment (methenamine)
  var UTI_TREATMENT = /\b(nitrofurantoin|macrobid|macrodantin|fosfomycin|monurol)\b/i;
  var UTI_SYMPTOM = /\b(phenazopyridine|pyridium)\b/i;
  var UTI_POSSIBLE = /\b(trimethoprim|sulfamethoxazole|bactrim|septra|ciprofloxacin|cipro|levofloxacin|levaquin|cephalexin|keflex|amoxicillin[\s-]*clavulanate|augmentin)\b/i;
  var UTI_PREVENTION = /\b(methenamine|hiprex|urex)\b/i;

  // ---- MED-MED INTERACTION SCREENING (highlight only, never moves rows) ----
  var SSRI_SNRI = /\b(sertraline|zoloft|escitalopram|lexapro|citalopram|celexa|fluoxetine|prozac|paroxetine|paxil|fluvoxamine|venlafaxine|effexor|desvenlafaxine|pristiq|duloxetine|cymbalta|vilazodone|viibryd|vortioxetine|trintellix)/i;
  var SSRI_ONLY = /\b(sertraline|zoloft|escitalopram|lexapro|citalopram|celexa|fluoxetine|prozac|paroxetine|paxil|fluvoxamine)/i;
  var ANTIDEPRESSANT = /\b(sertraline|zoloft|escitalopram|lexapro|citalopram|celexa|fluoxetine|prozac|paroxetine|paxil|fluvoxamine|venlafaxine|effexor|desvenlafaxine|pristiq|duloxetine|cymbalta|bupropion|wellbutrin|mirtazapine|remeron|trazodone|nefazodone|vilazodone|viibryd|vortioxetine|trintellix|amitriptyline|nortriptyline|pamelor|imipramine|desipramine|doxepin|clomipramine|protriptyline|trimipramine|amoxapine|maprotiline)/i;
  var MAOI = /\b(phenelzine|nardil|tranylcypromine|parnate|isocarboxazid|marplan|selegiline|emsam|rasagiline|azilect)/i;
  var SEROTONERGIC = /\b(sertraline|zoloft|escitalopram|lexapro|citalopram|celexa|fluoxetine|prozac|paroxetine|paxil|fluvoxamine|venlafaxine|effexor|desvenlafaxine|pristiq|duloxetine|cymbalta|vilazodone|viibryd|vortioxetine|trintellix|trazodone|clomipramine|tramadol|ultram|sumatriptan|rizatriptan|zolmitriptan|naratriptan|almotriptan|frovatriptan|eletriptan|linezolid|lithium|buspirone|buspar|dextromethorphan|nuedexta)/i;
  var ANTICOAG_NSAID = /\b(warfarin|coumadin|apixaban|eliquis|rivaroxaban|xarelto|dabigatran|pradaxa|edoxaban|savaysa|heparin|enoxaparin|lovenox|aspirin|clopidogrel|plavix|ibuprofen|advil|motrin|naproxen|aleve|meloxicam|celecoxib|celebrex|diclofenac|indomethacin|ketorolac|toradol)/i;
  var QTC = /\b(citalopram|celexa|ziprasidone|geodon|haloperidol|haldol|quetiapine|seroquel|methadone|ondansetron|zofran|azithromycin|erythromycin|levofloxacin|ciprofloxacin|moxifloxacin|amiodarone|sotalol)/i;
  var BENZO = /\b(lorazepam|ativan|alprazolam|xanax|clonazepam|klonopin|diazepam|valium|temazepam|oxazepam|chlordiazepoxide|clorazepate)/i;
  var OPIOID = /\b(oxycodone|oxycontin|percocet|hydrocodone|vicodin|norco|morphine|ms contin|hydromorphone|dilaudid|fentanyl|codeine|tramadol|ultram|methadone|buprenorphine|meperidine|demerol|tapentadol|nucynta)/i;
  var ZDRUG = /\b(zolpidem|ambien|eszopiclone|lunesta|zaleplon)/i;
  var ANTIPSYCHOTIC = /\b(olanzapine|zyprexa|quetiapine|seroquel|risperidone|risperdal|aripiprazole|abilify|ziprasidone|geodon|haloperidol|haldol|clozapine|clozaril|lurasidone|latuda|paliperidone|invega|asenapine|saphris|brexpiprazole|rexulti|cariprazine|vraylar|lumateperone|caplyta|iloperidone|chlorpromazine|fluphenazine|perphenazine|thioridazine|thiothixene|loxapine|trifluoperazine|pimavanserin|nuplazid)/i;
  var ANTICHOLINERGIC = /\b(benztropine|cogentin|trihexyphenidyl|artane|diphenhydramine|benadryl)/i;
  var ORTHOSTATIC = /\b(trazodone|amitriptyline|nortriptyline|pamelor|imipramine|desipramine|doxepin|clomipramine|protriptyline|trimipramine|amoxapine|maprotiline)/i;
  var FALL_RISK = new RegExp(BENZO.source + '|' + ZDRUG.source + '|' + ANTIPSYCHOTIC.source + '|' + ANTICHOLINERGIC.source + '|' + ORTHOSTATIC.source + '|' + OPIOID.source, 'i');

  // Patient age for Beers Criteria (applies at 65+). Checks the top document
  // header (e.g. "(91/Female)"). Null if not found — Beers flags still apply
  // when age is unknown, since SNF residents are overwhelmingly 65+.
  function getPatientAge() {
    try {
      var docs = [];
      try { if (window.top && window.top.document) docs.push(window.top.document); } catch (e) {}
      if (docs.indexOf(document) === -1) docs.push(document);
      for (var d = 0; d < docs.length; d++) {
        var text = (docs[d].body && docs[d].body.textContent) || '';
        var m = text.match(/\((\d{1,3})\s*\/\s*(Female|Male|F|M)\)/i);
        if (m) return parseInt(m[1], 10);
        m = text.match(/\bAge\s*:\s*(\d{1,3})\b/i);
        if (m) return parseInt(m[1], 10);
      }
    } catch (e2) {}
    return null;
  }

  // ---- BEERS CRITERIA (potentially inappropriate meds in older adults) ----
  // Flagged for documentation rationale; highlight-only like everything else.
  var BEERS_ANTICHOLINERGIC = /\b(diphenhydramine|benadryl|oxybutynin|ditropan|tolterodine|detrol|solifenacin|vesicare|darifenacin|fesoterodine|trospium|scopolamine|atropine|dicyclomine|bentyl|hyoscyamine|levsin|meclizine|antivert|promethazine|phenergan|hydroxyzine|vistaril|atarax|doxepin|sinequan|amitriptyline|elavil|imipramine|tofranil|clomipramine|anafranil|paroxetine|paxil|olanzapine|zyprexa|quetiapine|seroquel|benztropine|cogentin|trihexyphenidyl|artane)\b/i;
  var BEERS_BENZO = BENZO;  // reuse
  var BEERS_ZDRUG = ZDRUG;  // reuse
  var BEERS_NSAID = /\b(ibuprofen|advil|motrin|naproxen|aleve|meloxicam|mobic|celecoxib|celebrex|diclofenac|voltaren|indomethacin|indocin|ketorolac|toradol|piroxicam|nabumetone)\b/i;

  // ---- LAB MONITORING for psych meds ----
  // Each entry: regex to match the med, labs to monitor (with standard frequency).
  // Frequencies are general guidelines — follow facility protocol/clinical judgment.
  var LAB_MONITORING = [
    { rx: /\blithium\b/i, labs: 'Lithium level q3-6mo (5-7 days after start/dose change, then q2-3mo x2), BMP/creatinine q3-6mo with level, TSH q6-12mo, calcium annually' },
    { rx: /\b(valproate|divalproex|depakote|depakene)\b/i, labs: 'Valproate level 3-5 days after steady state then q6-12mo, LFTs baseline then q6-12mo, CBC with platelets baseline then q6-12mo' },
    { rx: /\bcarbamazepine|tegretol\b/i, labs: 'Carbamazepine level after steady state then q6-12mo, CBC baseline + 2 weeks then q3mo, LFTs baseline then q6-12mo, sodium baseline then periodically' },
    { rx: /\boxcarbazepine|trileptal\b/i, labs: 'Sodium baseline + 2 weeks then periodically (SIADH risk)' },
    { rx: /\bclozapine|clozaril\b/i, labs: 'ANC weekly x6mo, then q2weeks x6mo, then monthly (REMS protocol)' },
    { rx: /\b(olanzapine|zyprexa|quetiapine|seroquel|risperidone|risperdal|paliperidone|invega|aripiprazole|abilify|ziprasidone|geodon|haloperidol|haldol|lurasidone|latuda|asenapine|saphris|brexpiprazole|rexulti|cariprazine|vraylar|lumateperone|caplyta|iloperidone|fanapt|chlorpromazine|thorazine|fluphenazine|prolixin|perphenazine|trilafon)\b/i, labs: 'Weight/BMI baseline + monthly x3 then quarterly, fasting glucose/HbA1c baseline + 12 weeks then annually, lipid panel baseline + 12 weeks then annually' },
    { rx: /\b(risperidone|risperdal|paliperidone|invega|haloperidol|haldol|fluphenazine|prolixin)\b/i, labs: 'Prolactin only if galactorrhea/amenorrhea' },
    { rx: /\b(sertraline|zoloft|escitalopram|lexapro|citalopram|celexa|fluoxetine|prozac|paroxetine|paxil|fluvoxamine|luvox|venlafaxine|effexor|desvenlafaxine|pristiq|duloxetine|cymbalta|levomilnacipran|fetzima|vortioxetine|trintellix|vilazodone|viibryd)\b/i, labs: 'Sodium baseline in elderly/high-risk then if symptoms (SIADH/hyponatremia)' },
    { rx: /\bmirtazapine|remeron\b/i, labs: 'Weight baseline then periodically, lipid panel + fasting glucose baseline then annually if weight gain' },
    { rx: /\b(amitriptyline|elavil|nortriptyline|pamelor|imipramine|tofranil|desipramine|norpramin|doxepin|sinequan|clomipramine|anafranil|protriptyline|vivactil|trimipramine|surmontil)\b/i, labs: 'EKG baseline + after dose changes, sodium baseline in elderly then if symptoms' },
    { rx: /\bbupropion|wellbutrin\b/i, labs: 'Blood pressure baseline then periodically' },
    { rx: /\btrazodone|desyrel\b/i, labs: 'Orthostatic vitals (orthostasis risk, especially elderly); no routine labs' },
    { rx: /\b(memantine|namenda)\b/i, labs: 'No routine labs; renal dose adjustment in CKD; monitor cognition' },
    { rx: /\b(melatonin)\b/i, labs: 'No labs required' },
    { rx: /\blamotrigine|lamictal\b/i, labs: 'No routine labs; monitor skin for rash' },
    // Non-psych meds commonly seen in SNF
    { rx: /\b(metformin|glucophage)\b/i, labs: 'B12 annually, BMP q6-12mo (lactic acidosis risk in CKD), HbA1c q3-6mo' },
    { rx: /\b(insulin)\b/i, labs: 'Glucose, HbA1c q3-6mo; monitor hypoglycemia (sweating, confusion, tremor)' },
    { rx: /\b(linagliptin|tradjenta|sitagliptin|januvia)\b/i, labs: 'HbA1c q3-6mo; monitor pancreatitis symptoms (abdominal pain)' },
    { rx: /\b(glipizide|glucotrol|glyburide|diabeta|glimepiride|amaryl)\b/i, labs: 'Glucose, HbA1c q3-6mo; monitor hypoglycemia' },
    { rx: /\b(lisinopril|zestril|enalapril|vasotec|ramipril|altace)\b/i, labs: 'BMP (creatinine/K) 1-2 weeks after start then q6-12mo, BP; monitor cough, angioedema' },
    { rx: /\b(losartan|cozaar|valsartan|diovan|olmesartan|benicar)\b/i, labs: 'BMP (creatinine/K) 1-2 weeks after start then q6-12mo, BP' },
    { rx: /\b(metoprolol|lopressor|toprol|atenolol|tenormin|carvedilol|coreg)\b/i, labs: 'HR + BP; monitor bradycardia, fatigue, dizziness' },
    { rx: /\b(amlodipine|norvasc|diltiazem|cardizem|verapamil|calan)\b/i, labs: 'BP; monitor edema, headache, flushing' },
    { rx: /\b(furosemide|lasix|hydrochlorothiazide|hctz|bumetanide|bumex|torsemide|demadex)\b/i, labs: 'BMP (K, Mg, creatinine) 1-2 weeks after start then q3-6mo, weight, orthostatics; monitor dehydration, cramps' },
    { rx: /\b(digoxin|lanoxin)\b/i, labs: 'Digoxin level 7-14 days after start then q6-12mo, BMP (K), EKG; monitor nausea, vision changes, arrhythmia (toxicity)' },
    { rx: /\b(warfarin|coumadin)\b/i, labs: 'INR q4 weeks (stable) or per protocol; monitor bleeding, bruising' },
    { rx: /\b(apixaban|eliquis|rivaroxaban|xarelto|dabigatran|pradaxa)\b/i, labs: 'CBC + BMP annually; monitor bleeding' },
    { rx: /\b(omeprazole|prilosec|pantoprazole|protonix|esomeprazole|nexium|lansoprazole|prevacid)\b/i, labs: 'B12 + magnesium annually if long-term; monitor bone fracture risk' },
    { rx: /\b(levothyroxine|synthroid)\b/i, labs: 'TSH q6-12mo (6-8 weeks after dose change)' },
    { rx: /\b(ferrous sulfate|iron)\b/i, labs: 'CBC, ferritin q3-6mo until repleted; monitor constipation, dark stools' },
    { rx: /\b(tamsulosin|flomax)\b/i, labs: 'Orthostatic vitals, BP; monitor dizziness, especially first dose' },
    { rx: /\b(alendronate|fosamax|ibandronate|boniva)\b/i, labs: 'Dental exam baseline; monitor jaw pain, dysphagia, atypical fractures' },
    { rx: /\b(sennosides|senna|docusate|colace|polyethylene glycol|miralax|lactulose)\b/i, labs: 'Bowel movements; BMP if chronic use (electrolytes)' }
  ];

  // Black box warnings by drug (regex to match the med, warning text).
  var BLACK_BOX = [
    { rx: /\b(sertraline|zoloft|escitalopram|lexapro|citalopram|celexa|fluoxetine|prozac|paroxetine|paxil|fluvoxamine|luvox|venlafaxine|effexor|desvenlafaxine|pristiq|duloxetine|cymbalta|levomilnacipran|fetzima|vortioxetine|trintellix|vilazodone|viibryd|mirtazapine|remeron|bupropion|wellbutrin|amitriptyline|elavil|nortriptyline|pamelor|imipramine|tofranil|desipramine|norpramin|doxepin|sinequan|clomipramine|anafranil)\b/i,
      text: 'Suicidality: increased risk of suicidal thoughts/behaviors in children, adolescents, and young adults' },
    { rx: /\b(olanzapine|zyprexa|quetiapine|seroquel|risperidone|risperdal|paliperidone|invega|aripiprazole|abilify|ziprasidone|geodon|haloperidol|haldol|lurasidone|latuda|asenapine|saphris|brexpiprazole|rexulti|cariprazine|vraylar|lumateperone|caplyta|iloperidone|fanapt|chlorpromazine|thorazine|fluphenazine|prolixin|perphenazine|trilafon|clozapine|clozaril)\b/i,
      text: 'Increased mortality in elderly patients with dementia-related psychosis' },
    { rx: /\b(clozapine|clozaril)\b/i,
      text: 'Agranulocytosis, myocarditis/cardiomyopathy, severe constipation leading to ileus' },
    { rx: /\b(valproate|divalproex|depakote|depakene)\b/i,
      text: 'Hepatotoxicity (fatal, esp. children <2), pancreatitis, teratogenicity (neural tube defects)' },
    { rx: /\b(carbamazepine|tegretol)\b/i,
      text: 'Aplastic anemia/agranulocytosis, serious skin reactions (SJS/TEN)' },
    { rx: /\blithium\b/i,
      text: 'Lithium toxicity (narrow therapeutic index); monitor levels closely' }
  ];

  // Condition-based warnings: patient has [ICD prefix], is on [drug regex] → warning.
  // Covers psych + medical diagnoses that affect psych med safety/dosing.
  var CONDITION_WARNINGS = [
    // Glaucoma — SSRIs, SNRIs, TCAs, antipsychotics, mood stabilizers
    { dx: /^H40/, dxName: 'Glaucoma', rx: /\b(sertraline|zoloft|escitalopram|lexapro|citalopram|celexa|fluoxetine|prozac|paroxetine|paxil|fluvoxamine|luvox)\b/i,
      text: 'SSRIs: mild mydriasis risk — monitor eye pain, blurred vision, halos, headache, nausea (angle closure symptoms)' },
    { dx: /^H40/, dxName: 'Glaucoma', rx: /\b(venlafaxine|effexor|desvenlafaxine|pristiq|duloxetine|cymbalta|levomilnacipran|fetzima)\b/i,
      text: 'SNRIs: mydriasis risk — monitor eye pain, blurred vision, halos' },
    { dx: /^H40/, dxName: 'Glaucoma', rx: /\b(amitriptyline|elavil|nortriptyline|pamelor|imipramine|tofranil|desipramine|norpramin|doxepin|sinequan|clomipramine|anafranil|protriptyline|vivactil|trimipramine|surmontil)\b/i,
      text: 'TCAs: strong anticholinergic — high angle-closure risk; monitor eye pain, redness, blurred vision, halos, headache, nausea/vomiting' },
    { dx: /^H40/, dxName: 'Glaucoma', rx: /\b(olanzapine|zyprexa|quetiapine|seroquel|chlorpromazine|thorazine|thioridazine|mellaril)\b/i,
      text: 'Anticholinergic antipsychotics: angle-closure risk; monitor eye pain, blurred vision, halos' },
    { dx: /^H40/, dxName: 'Glaucoma', rx: /\b(topiramate|topamax)\b/i,
      text: 'Topiramate: acute angle-closure risk — monitor sudden eye pain, blurred vision, halos; urgent ophthalmology if symptoms' },
    { dx: /^H40/, dxName: 'Glaucoma', rx: /\b(lithium|valproate|divalproex|depakote|carbamazepine|tegretol|lamotrigine|lamictal)\b/i,
      text: 'Mood stabilizers: monitor intraocular pressure; report eye pain, blurred vision' },
    // Heart failure
    { dx: /^I50/, dxName: 'Heart failure', rx: /\b(olanzapine|zyprexa|quetiapine|seroquel|risperidone|risperdal|paliperidone|invega|aripiprazole|abilify|ziprasidone|geodon|clozapine|clozaril|haloperidol|haldol)\b/i,
      text: 'Antipsychotics: fluid retention, orthostasis — monitor daily weight, edema, SOB, crackles, orthostatic vitals' },
    { dx: /^I50/, dxName: 'Heart failure', rx: /\b(amitriptyline|elavil|nortriptyline|pamelor|imipramine|tofranil|doxepin|sinequan|clomipramine|anafranil)\b/i,
      text: 'TCAs: arrhythmia, orthostasis, worsened HF — monitor EKG, orthostatics, edema, SOB; consider alternative' },
    { dx: /^I50/, dxName: 'Heart failure', rx: /\b(citalopram|celexa|escitalopram|lexapro)\b/i,
      text: 'QT prolongation risk in HF — monitor EKG, palpitations, syncope' },
    // Kidney disease
    { dx: /^N18|^N19/, dxName: 'Kidney disease (CKD)', rx: /\blithium\b/i,
      text: 'Lithium cleared renally — reduce dose for eGFR; monitor lithium level, creatinine/eGFR, polyuria, thirst, tremor, confusion (toxicity)' },
    { dx: /^N18|^N19/, dxName: 'Kidney disease (CKD)', rx: /\b(gabapentin|neurontin|pregabalin|lyrica)\b/i,
      text: 'Renally cleared — reduce dose for eGFR; monitor sedation, dizziness, edema' },
    { dx: /^N18|^N19/, dxName: 'Kidney disease (CKD)', rx: /\b(topiramate|topamax)\b/i,
      text: 'Renally cleared — reduce dose; monitor kidney stones, metabolic acidosis' },
    { dx: /^N18|^N19/, dxName: 'Kidney disease (CKD)', rx: /\b(sertraline|zoloft|escitalopram|lexapro|citalopram|celexa|fluoxetine|prozac|paroxetine|paxil|fluvoxamine|luvox|venlafaxine|effexor|duloxetine|cymbalta)\b/i,
      text: 'SSRIs/SNRIs: hyponatremia risk higher in CKD/elderly — monitor sodium, confusion, falls' },
    // Liver disease
    { dx: /^K7/, dxName: 'Liver disease', rx: /\b(valproate|divalproex|depakote|depakene)\b/i,
      text: 'Valproate hepatotoxic — avoid in liver disease; monitor LFTs, ammonia, lethargy, confusion, jaundice, abdominal pain' },
    { dx: /^K7/, dxName: 'Liver disease', rx: /\b(olanzapine|zyprexa|quetiapine|seroquel|aripiprazole|abilify|duloxetine|cymbalta|venlafaxine|effexor|mirtazapine|remeron)\b/i,
      text: 'Hepatically metabolized — consider dose reduction; monitor LFTs, fatigue, jaundice, confusion' },
    { dx: /^K7/, dxName: 'Liver disease', rx: /\b(carbamazepine|tegretol)\b/i,
      text: 'Carbamazepine hepatotoxic — monitor LFTs; watch fatigue, jaundice, abdominal pain' },
    // Diabetes
    { dx: /^E1[01]/, dxName: 'Diabetes', rx: /\b(olanzapine|zyprexa|quetiapine|seroquel|risperidone|risperdal|paliperidone|invega|aripiprazole|abilify|ziprasidone|geodon|haloperidol|haldol|lurasidone|latuda|asenapine|saphris|brexpiprazole|rexulti|cariprazine|vraylar|lumateperone|caplyta|iloperidone|fanapt|chlorpromazine|thorazine|fluphenazine|prolixin|perphenazine|trilafon|clozapine|clozaril)\b/i,
      text: 'Antipsychotics worsen glycemic control — monitor fasting glucose/HbA1c, weight, polyuria, polydipsia' },
    { dx: /^E1[01]/, dxName: 'Diabetes', rx: /\b(mirtazapine|remeron|paroxetine|paxil)\b/i,
      text: 'Weight gain risk — monitor weight, glucose, increased appetite' },
    // Seizure disorder
    { dx: /^G40/, dxName: 'Seizure disorder', rx: /\b(bupropion|wellbutrin)\b/i,
      text: 'Bupropion lowers seizure threshold — CONTRAINDICATED; monitor seizure frequency' },
    { dx: /^G40/, dxName: 'Seizure disorder', rx: /\b(clozapine|clozaril)\b/i,
      text: 'Clozapine dose-dependent seizure risk — monitor seizure frequency' },
    { dx: /^G40/, dxName: 'Seizure disorder', rx: /\b(olanzapine|zyprexa|quetiapine|seroquel|chlorpromazine|thorazine)\b/i,
      text: 'Lowers seizure threshold — monitor seizure frequency' },
    { dx: /^G40/, dxName: 'Seizure disorder', rx: /\b(amitriptyline|elavil|imipramine|tofranil|clomipramine|anafranil)\b/i,
      text: 'TCAs lower seizure threshold — monitor seizure frequency; consider SSRI instead' },
    // Parkinson's
    { dx: /^G20/, dxName: "Parkinson's", rx: /\b(haloperidol|haldol|risperidone|risperdal|paliperidone|invega|olanzapine|zyprexa|fluphenazine|prolixin|chlorpromazine|thorazine|perphenazine|trilafon)\b/i,
      text: 'Dopamine blockade worsens parkinsonism — monitor rigidity, tremor, bradykinesia, gait; prefer quetiapine/clozapine' },
    // Dementia
    { dx: /^F03|^G30|^G31/, dxName: 'Dementia', rx: /\b(olanzapine|zyprexa|quetiapine|seroquel|risperidone|risperdal|paliperidone|invega|aripiprazole|abilify|haloperidol|haldol|ziprasidone|geodon)\b/i,
      text: 'Antipsychotic in dementia: increased mortality/stroke — document indication, lowest dose/duration; monitor sedation, falls, EPS' },
    { dx: /^F03|^G30|^G31/, dxName: 'Dementia', rx: /\b(oxybutynin|ditropan|tolterodine|detrol|solifenacin|vesicare|amitriptyline|elavil|paroxetine|paxil|diphenhydramine|benadryl)\b/i,
      text: 'Anticholinergics worsen cognition — monitor confusion, memory, urinary retention, constipation' },
    // Hypertension
    { dx: /^I10/, dxName: 'Hypertension', rx: /\b(venlafaxine|effexor|desvenlafaxine|pristiq|duloxetine|cymbalta|levomilnacipran|fetzima)\b/i,
      text: 'SNRIs raise BP dose-dependently — monitor BP, headache, chest pain' },
    { dx: /^I10/, dxName: 'Hypertension', rx: /\b(bupropion|wellbutrin)\b/i,
      text: 'Bupropion may raise BP — monitor BP, headache' },
    // Hypotension
    { dx: /^I95/, dxName: 'Hypotension', rx: /\b(quetiapine|seroquel|clozapine|clozaril|risperidone|risperdal|prazosin|minipress|trazodone|desyrel)\b/i,
      text: 'Orthostasis risk — monitor orthostatic vitals, dizziness, falls, syncope' },
    { dx: /^I95/, dxName: 'Hypotension', rx: /\b(amitriptyline|elavil|nortriptyline|pamelor|imipramine|tofranil|doxepin|sinequan)\b/i,
      text: 'TCAs: orthostasis — monitor orthostatics, dizziness, falls' },
    // QT prolongation
    { dx: /^I45\.8|^I49/, dxName: 'Cardiac conduction/QT risk', rx: /\b(citalopram|celexa|escitalopram|lexapro)\b/i,
      text: 'QT prolongation — monitor EKG; watch syncope, palpitations' },
    { dx: /^I45\.8|^I49/, dxName: 'Cardiac conduction/QT risk', rx: /\b(ziprasidone|geodon|haloperidol|haldol|thioridazine|mellaril|chlorpromazine|thorazine)\b/i,
      text: 'QT prolongation — monitor EKG; watch syncope, palpitations' },
    // Bleeding
    { dx: /^D6[89]|^Z79\.01/, dxName: 'Bleeding risk/anticoagulated', rx: /\b(sertraline|zoloft|escitalopram|lexapro|citalopram|celexa|fluoxetine|prozac|paroxetine|paxil|fluvoxamine|luvox|venlafaxine|effexor|desvenlafaxine|pristiq|duloxetine|cymbalta)\b/i,
      text: 'SSRIs/SNRIs impair platelet function — monitor bruising, petechiae, GI bleed, Hgb' },
    // Hyponatremia
    { dx: /^E87\.1/, dxName: 'Hyponatremia', rx: /\b(sertraline|zoloft|escitalopram|lexapro|citalopram|celexa|fluoxetine|prozac|paroxetine|paxil|fluvoxamine|luvox|venlafaxine|effexor|duloxetine|cymbalta)\b/i,
      text: 'SIADH risk — monitor sodium, confusion, lethargy, falls; hold if Na <130' },
    { dx: /^E87\.1/, dxName: 'Hyponatremia', rx: /\b(carbamazepine|tegretol|oxcarbazepine|trileptal)\b/i,
      text: 'SIADH risk — monitor sodium, confusion' },
    // Thyroid
    { dx: /^E0[03]/, dxName: 'Thyroid disorder', rx: /\blithium\b/i,
      text: 'Lithium causes hypothyroidism — monitor TSH, fatigue, cold intolerance, weight gain' },
    // BPH
    { dx: /^N40/, dxName: 'BPH', rx: /\b(amitriptyline|elavil|nortriptyline|pamelor|imipramine|tofranil|olanzapine|zyprexa|quetiapine|seroquel|paroxetine|paxil)\b/i,
      text: 'Anticholinergic urinary retention — monitor hesitancy, weak stream, retention, UTIs' },
    // Constipation
    { dx: /^K59\.0/, dxName: 'Constipation', rx: /\b(clozapine|clozaril)\b/i,
      text: 'Clozapine: severe constipation/ileus — monitor bowel movements daily; prophylactic laxatives' },
    // Sleep apnea
    { dx: /^G47\.3/, dxName: 'Sleep apnea', rx: /\b(clonazepam|klonopin|lorazepam|ativan|alprazolam|xanax|diazepam|valium|zolpidem|ambien|eszopiclone|lunesta)\b/i,
      text: 'Sedatives worsen apnea — monitor daytime sleepiness, morning headache, O2 desats' },
    // COPD
    { dx: /^J4[34]/, dxName: 'COPD', rx: /\b(clonazepam|klonopin|lorazepam|ativan|alprazolam|xanax|diazepam|valium)\b/i,
      text: 'Benzos: respiratory depression in COPD — monitor O2 sats, respiratory rate, sedation' },
    // Bipolar
    { dx: /^F31/, dxName: 'Bipolar disorder', rx: /\b(sertraline|zoloft|escitalopram|lexapro|citalopram|celexa|fluoxetine|prozac|paroxetine|paxil|venlafaxine|effexor|duloxetine|cymbalta|bupropion|wellbutrin)\b/i,
      text: 'Antidepressant alone may induce mania — monitor decreased sleep, pressured speech, impulsivity, grandiosity; ensure mood stabilizer co-prescribed' }
  ];

  // ---- DIAGNOSIS-BASED (drug + condition) PRESCRIBING ALERTS ----
  var LITHIUM_RE = /\blithium\b/i;
  var VALPROATE_RE = /\b(valpro|divalproex|depakote)/i;
  var SEIZURE_RISK_DRUGS = /\b(bupropion|wellbutrin|clozapine|clozaril)/i;
  var GLAUCOMA_RISK_DRUGS = new RegExp(ANTICHOLINERGIC.source + '|' + ORTHOSTATIC.source, 'i');
  var SEDATING_DRUGS = new RegExp(BENZO.source + '|' + ZDRUG.source + '|' + OPIOID.source, 'i');

  var CKD_RE = /^(N18|N19)/;
  var LIVER_RE = /^(K7[0-7])/;
  var SEIZURE_DX_RE = /^(G40)/;
  var DIABETES_RE = /^(E10|E11)/;
  var GLAUCOMA_DX_RE = /^(H402)/;
  var SLEEP_APNEA_RE = /^(G473)/;
  var PARKINSONS_RE = /^(G20)/;

  // Filled by sortDx, read by sortMeds. May lag up to ~2s after switching patients.
  var patientFlags = {};

  var SEVERITY = {
    'Multiple SSRIs': 'LOW',
    'antidepressants': 'LOW',
    'Bleed risk': 'MEDIUM',
    'Serotonin syndrome': 'HIGH',
    'QTc prolongation': 'MEDIUM',
    'Sedation': 'HIGH',
    'Risk for falls': 'MEDIUM',
    'kidney disease': 'HIGH',
    'liver disease': 'HIGH',
    'seizure disorder': 'HIGH',
    'diabetes': 'MEDIUM',
    'glaucoma': 'HIGH',
    'sleep apnea': 'HIGH',
    "Parkinson's": 'HIGH',
    'Beers:': 'MEDIUM',
    'UTI': 'LOW'
  };
  function severityFor(reason) {
    for (var k in SEVERITY) if (reason.indexOf(k) !== -1) return SEVERITY[k];
    return 'MEDIUM';
  }

  // ---- RATIONALE SENTENCES (click a flag to copy one) ----
  // [meds] = the flagged drug names, [indication] = fill in the reason for use.
  // Multiple variations per warning so notes don't read identically.
  var RATIONALE_SENTENCES = {
    'falls': [
      'Fall risk increased by [meds]; reviewed with nursing team. Fall precautions reinforced and documented.',
      '[Meds] contribute to fall risk in this elderly resident. Benefit for [indication] outweighs risk at this time; monitoring gait and balance.',
      'Polypharmacy fall risk noted ([meds]). Non-pharmacologic fall prevention strategies in place.'
    ],
    'bleed': [
      'Bleed risk from [meds]; monitoring for signs of bleeding. GI prophylaxis considered.',
      'Combination of [meds] increases bleeding risk. Risks discussed; will monitor hemoglobin and stool guaiac as indicated.'
    ],
    'serotonin': [
      'Serotonin syndrome risk from [meds]; team educated on signs (agitation, clonus, hyperthermia, rigidity). Monitoring.',
      'Multiple serotonergic agents ([meds]); risk/benefit reviewed. Will monitor for serotonin toxicity.'
    ],
    'qtc': [
      'QTc prolongation risk with [meds]; baseline EKG reviewed. Monitoring for cardiac symptoms and electrolyte abnormalities.',
      '[Meds] may prolong QTc. Risk discussed; avoiding additional QTc-prolonging agents.'
    ],
    'sedation': [
      'Sedating medications ([meds]); monitoring for oversedation and daytime somnolence. Dosing timed to minimize functional impact.',
      'Sedation risk from [meds] reviewed with team. Fall precautions in place due to sedation.'
    ],
    'beers_anticholinergic': [
      'Per Beers Criteria, [meds] has strong anticholinergic properties — avoid in elderly due to cognitive impairment, delirium, and fall risk. Rationale for continued use: [indication]. Monitoring for confusion and urinary retention.',
      'Anticholinergic burden from [meds] noted (Beers Criteria). Benefit for [indication] outweighs risk; will reassess need regularly.'
    ],
    'beers_benzo': [
      'Benzodiazepine ([meds]) flagged per Beers Criteria — increased fall, fracture, and cognitive impairment risk in elderly. Indicated for [indication]; using lowest effective dose. Tapering to be considered at each visit.',
      'Continued benzodiazepine after risk/benefit review; resident stable on current regimen. Fall precautions in place.'
    ],
    'beers_zdrug': [
      'Non-benzodiazepine hypnotic ([meds]) flagged per Beers Criteria — similar adverse effects to benzodiazepines in elderly (delirium, falls, fractures). Indicated for [indication]; using lowest effective dose for shortest duration.',
      'Z-drug continued for insomnia refractory to sleep hygiene measures. Monitoring for daytime sedation and falls.'
    ],
    'beers_nsaid': [
      'NSAID ([meds]) flagged per Beers Criteria — avoid chronic use in elderly due to GI bleed, renal injury, and cardiovascular risk. Rationale: [indication]. Using lowest effective dose; GI prophylaxis considered.',
      'Chronic NSAID use in elderly noted (Beers Criteria). Monitoring renal function and for GI symptoms.'
    ],
    'beers_antipsychotic': [
      'Per Beers Criteria, antipsychotic ([meds]) in elderly requires documented rationale: indicated for [psychosis/agitation] refractory to non-pharmacologic interventions. Risks of stroke, mortality, and metabolic effects reviewed. GDR to be attempted as tolerated.',
      'Antipsychotic continued in elderly resident; risks of cerebrovascular events and mortality reviewed per Beers Criteria. Benefit for target symptoms outweighs risk at this time. Will reassess need at each visit.',
      'In dementia, antipsychotic ([meds]) for behavioral disturbances requires documented rationale per Beers Criteria: severe symptoms refractory to non-pharmacologic measures. Risks/benefits discussed; informed consent obtained. Monitoring for EPS and sedation.'
    ],
    'diabetes': [
      'Antipsychotic ([meds]) may worsen glycemic control in diabetes; monitoring weight, glucose, and lipids per guidelines.',
      'Metabolic risk from [meds] in diabetic resident noted. Coordinating with primary team on glucose monitoring.'
    ],
    'parkinsons': [
      "Antipsychotic ([meds]) may worsen Parkinsonian symptoms; using lowest effective dose. Monitoring movement symptoms.",
      "Dopamine-blocking agent ([meds]) in Parkinson's disease — risk/benefit reviewed. Will monitor for worsening rigidity and bradykinesia."
    ],
    'kidney': [
      'Lithium in kidney disease ([meds]); dose adjusted for renal function. Monitoring levels and renal labs.',
      'Nephrotoxic risk from [meds] in CKD noted. Renal function to be monitored closely.'
    ],
    'liver': [
      'Valproate in liver disease ([meds]); monitoring LFTs. Dose adjusted as needed.',
      'Hepatotoxic risk from [meds] noted. Liver function to be followed.'
    ],
    'seizure': [
      '[Meds] lowers seizure threshold in resident with seizure disorder; risk/benefit reviewed. Monitoring for seizure activity.',
      'Seizure threshold concern with [meds]; team educated on seizure precautions.'
    ],
    'glaucoma': [
      'Anticholinergic ([meds]) in narrow-angle glaucoma — avoid; risk of acute angle closure. Alternative agents considered.',
      '[Meds] contraindicated in narrow-angle glaucoma per Beers Criteria. Discontinuation planned.'
    ],
    'sleepapnea': [
      'Sedating medication ([meds]) in sleep apnea — breathing risk. Using lowest effective dose; monitoring respiratory status.',
      '[Meds] may worsen sleep apnea; sleep hygiene and positional measures reinforced.'
    ],
    'uti': [
      'Resident appears to be treated for UTI ([meds]); will monitor response and review culture results when available.',
      'UTI treatment with [meds] noted; monitoring for symptom resolution and adverse effects.'
    ],
    'general': [
      'Medication warning ([meds]) reviewed; risk/benefit discussed with care team. Monitoring as indicated.',
      '[Meds] flagged for review; rationale for continued use documented. Will reassess at each visit.'
    ]
  };

  // Map a flag reason string to a rationale sentence group key.
  function rationaleKeyFor(reason) {
    var r = reason.toLowerCase();
    if (r.indexOf('beers: anticholinergic') !== -1) return 'beers_anticholinergic';
    if (r.indexOf('beers: benzodiazepine') !== -1) return 'beers_benzo';
    if (r.indexOf('beers: z-drug') !== -1) return 'beers_zdrug';
    if (r.indexOf('beers: nsaid') !== -1) return 'beers_nsaid';
    if (r.indexOf('beers: antipsychotic') !== -1) return 'beers_antipsychotic';
    if (r.indexOf('falls') !== -1) return 'falls';
    if (r.indexOf('bleed') !== -1) return 'bleed';
    if (r.indexOf('serotonin') !== -1) return 'serotonin';
    if (r.indexOf('qtc') !== -1) return 'qtc';
    if (r.indexOf('sedation') !== -1 || r.indexOf('breathing risk') !== -1) return 'sedation';
    if (r.indexOf('diabetes') !== -1) return 'diabetes';
    if (r.indexOf("parkinson") !== -1) return 'parkinsons';
    if (r.indexOf('kidney') !== -1) return 'kidney';
    if (r.indexOf('liver') !== -1) return 'liver';
    if (r.indexOf('seizure') !== -1) return 'seizure';
    if (r.indexOf('glaucoma') !== -1) return 'glaucoma';
    if (r.indexOf('sleep apnea') !== -1) return 'sleepapnea';
    if (r.indexOf('uti') !== -1) return 'uti';
    return 'general';
  }

  var COLOR_PSYCH = { border: '#2563eb', bg: 'rgba(37,99,235,0.10)' };
  var COLOR_LOW = { border: '#a16207', bg: 'rgba(161,98,7,0.10)' };
  var COLOR_MEDIUM = { border: '#9a3412', bg: 'rgba(154,52,18,0.14)' };
  var COLOR_HIGH = { border: '#b91c1c', bg: 'rgba(185,28,28,0.24)' };
  var COLOR_UTI = { border: '#0d9488', bg: 'rgba(13,148,136,0.14)' };
  function colorFor(sev) {
    return sev === 'HIGH' ? COLOR_HIGH : sev === 'LOW' ? COLOR_LOW : COLOR_MEDIUM;
  }

  var DX_FRAME = /diagnos/i;
  var RELATED_G = /^(G30|G31|G240|G251|G257|G211|G47(?!3))/;
  var RELATED_R = /^(R41|R44|R45|R46|R630)/;
  var CODE_RE = /\b[A-TV-Z][0-9][0-9AB]\b(?:\.[0-9A-Z]{1,4})?/g;

  // ============ PSYCH MED LIST (port of psychmeds.pl) ============
  // Order matters: first match wins. Third item overrides the group's indication.
  var MEDLIST = [];
  function addMeds(ind, tier, list) {
    list.forEach(function(m) {
      MEDLIST.push({ rx: new RegExp('\\b(' + m[0] + ')\\b', 'i'), name: m[1], ind: m[2] || ind, tier: tier });
    });
  }

  addMeds('depression', 0, [
    ['fluoxetine|prozac','Prozac'], ['sertraline|zoloft','Zoloft'], ['paroxetine|paxil','Paxil'],
    ['escitalopram|lexapro','Lexapro'], ['citalopram|celexa','Celexa'], ['fluvoxamine|luvox','Luvox'],
    ['vilazodone|viibryd','Viibryd'], ['desvenlafaxine|pristiq','Pristiq'], ['venlafaxine|effexor','Effexor'],
    ['duloxetine|cymbalta','Cymbalta'], ['levomilnacipran|fetzima','Fetzima'], ['milnacipran|savella','Savella'],
    ['vortioxetine|trintellix','Trintellix'], ['auvelity','Auvelity ER'], ['bupropion|wellbutrin','Wellbutrin'], ['mirtazapine|remeron','Remeron'],
    ['trazodone|desyrel','Trazodone'], ['nefazodone|serzone','Serzone'], ['mianserin|tolvon','Tolvon'],
    ['agomelatine|valdoxan','Valdoxan'], ['reboxetine|edronax','Edronax'], ['tianeptine|stablon','Stablon'],
    ['gepirone|exxua','Exxua'], ['esketamine|spravato','Spravato'], ['ketamine','ketamine'],
    ['brexanolone|zulresso','Zulresso'], ['zuranolone|zurzuvae','Zurzuvae'], ['amitriptyline|elavil','Elavil'],
    ['nortriptyline|pamelor','nortriptyline'], ['imipramine|tofranil','Tofranil'], ['desipramine|norpramin','Norpramin'],
    ['clomipramine|anafranil','Anafranil'], ['doxepin|sinequan|silenor','doxepin'], ['trimipramine|surmontil','Surmontil'],
    ['protriptyline|vivactil','Vivactil'], ['amoxapine|asendin','Asendin'], ['maprotiline|ludiomil','Ludiomil'],
    ['lofepramine|gamanil','Gamanil'], ['dosulepin|dothiepin|prothiaden','Prothiaden'], ['phenelzine|nardil','Nardil'],
    ['tranylcypromine|parnate','Parnate'], ['isocarboxazid|marplan','Marplan'], ['selegiline|emsam','Emsam'],
    ['moclobemide|manerix','Manerix']
  ]);
  addMeds('psychosis', 0, [
    ['haloperidol|haldol','Haldol'], ['chlorpromazine|thorazine','Thorazine'], ['fluphenazine|prolixin|modecate','Prolixin'],
    ['perphenazine|trilafon','Trilafon'], ['trifluoperazine|stelazine','Stelazine'], ['thioridazine|mellaril','Mellaril'],
    ['thiothixene|navane','Navane'], ['loxapine|loxitane','Loxitane'], ['molindone|moban','Moban'],
    ['pimozide|orap','Orap'], ['flupentixol|fluanxol','Fluanxol'], ['zuclopenthixol|clopixol','Clopixol'],
    ['sulpiride|dogmatil','Dogmatil'], ['mesoridazine|serentil','Serentil'], ['clozapine|clozaril','Clozaril'],
    ['risperidone|risperdal|rykindo|perseris|uzedy|risvan','Risperdal'], ['olanzapine|zyprexa','Zyprexa'],
    ['quetiapine|seroquel','Seroquel'], ['ziprasidone|geodon','Geodon'], ['aripiprazole|abilify|aristada|asimtufii','Abilify'],
    ['paliperidone|invega|erzofri','Invega'], ['asenapine|saphris','Saphris'], ['iloperidone|fanapt','Fanapt'],
    ['lurasidone|latuda','Latuda'], ['brexpiprazole|rexulti','Rexulti'], ['cariprazine|vraylar','Vraylar'],
    ['lumateperone|caplyta','Caplyta'], ['pimavanserin|nuplazid','Nuplazid'], ['amisulpride|solian','Solian'],
    ['zotepine|nipolept','Nipolept'], ['sertindole|serdolect','Serdolect'], ['xanomeline|cobenfy','Cobenfy'],
    ['periciazine|neulactil','Neulactil'], ['pipotiazine|piportil','Piportil'],
    ['levomepromazine|methotrimeprazine|nozinan','Nozinan'], ['promazine|sparine','Sparine'],
    ['acetophenazine|tindal','Tindal'], ['carphenazine|proketazine','Proketazine'], ['remoxipride|roxiam','Roxiam']
  ]);
  addMeds('mood', 0, [
    ['lithium|lithobid|eskalith','Lithium'], ['divalproex|valproate|valproic|depakote|depakene','Depakote'],
    ['carbamazepine|tegretol','Tegretol'], ['oxcarbazepine|trileptal','Trileptal'],
    ['lamotrigine|lamictal','Lamictal'], ['topiramate|topamax','Topamax']
  ]);
  addMeds('anxiety', 0, [
    ['alprazolam|xanax','Xanax'], ['lorazepam|ativan','Ativan'], ['clonazepam|klonopin','Klonopin'],
    ['diazepam|valium','Valium'], ['chlordiazepoxide|librium','Librium'], ['oxazepam|serax','Serax'],
    ['clorazepate|tranxene','Tranxene'], ['bromazepam|lexotan','Lexotan'], ['prazepam|centrax','Centrax'],
    ['halazepam|paxipam','Paxipam'], ['medazepam','medazepam'], ['clobazam|onfi','Onfi'],
    ['buspirone|buspar','Buspar'], ['meprobamate|miltown','Miltown']
  ]);
  addMeds('insomnia', 0, [
    ['temazepam|restoril','Restoril'], ['flurazepam|dalmane','Dalmane'], ['triazolam|halcion','Halcion'],
    ['estazolam|prosom','ProSom'], ['quazepam|doral','Doral'], ['nitrazepam|mogadon','Mogadon'],
    ['lormetazepam|noctamid','Noctamid'], ['loprazolam','loprazolam'], ['flunitrazepam|rohypnol','Rohypnol'],
    ['zolpidem|ambien','Ambien'], ['zaleplon|sonata','Sonata'], ['eszopiclone|lunesta','Lunesta'],
    ['zopiclone|imovane','Imovane'], ['ramelteon|rozerem','Ramelteon'], ['tasimelteon|hetlioz','Hetlioz'],
    ['suvorexant|belsomra','Belsomra'], ['lemborexant|dayvigo','Dayvigo'], ['daridorexant|quviviq','Quviviq'],
    ['melatonin','Melatonin','poor sleep'], ['chloral hydrate','chloral hydrate']
  ]);
  addMeds('ADHD', 0, [
    ['lisdexamfetamine|vyvanse','Vyvanse'], ['amphetamine|adderall|mydayis','Adderall'],
    ['dextroamphetamine|dexedrine','Dexedrine'], ['dexmethylphenidate|focalin','Focalin'],
    ['methylphenidate|ritalin|concerta|metadate|quillivant|daytrana','methylphenidate'],
    ['methamphetamine|desoxyn','Desoxyn'], ['atomoxetine|strattera','Strattera'],
    ['viloxazine|qelbree','Qelbree'], ['guanfacine|intuniv|tenex','guanfacine']
  ]);
  addMeds('EPS', 1, [
    ['benztropine|cogentin','Cogentin'],
    ['trihexyphenidyl|artane','Artane'],
    ['procyclidine|kemadrin','Kemadrin'],
    ['biperiden|akineton','Akineton'],
    ['amantadine|symmetrel|gocovri|osmolex','Amantadine']
  ]);
  addMeds('dementia', 0, [
    ['donepezil|aricept','Aricept'], ['rivastigmine|exelon','Exelon'], ['galantamine|razadyne','Razadyne'],
    ['memantine|namenda','Namenda'], ['tacrine|cognex','Cognex']
  ]);
  addMeds('tardive dyskinesia', 1, [
    ['deutetrabenazine|austedo','Austedo'], ['valbenazine|ingrezza','Ingrezza'], ['tetrabenazine|xenazine','Xenazine']
  ]);
  addMeds('substance use', 1, [
    ['buprenorphine\\b.*\\bnaloxone|suboxone','Suboxone'], ['buprenorphine|subutex|sublocade','Subutex'],
    ['methadone|dolophine','methadone'], ['naltrexone|revia|vivitrol','naltrexone'],
    ['acamprosate|campral','Campral'], ['disulfiram|antabuse','Antabuse'], ['nalmefene|selincro','Selincro'],
    ['varenicline|chantix','Chantix'], ['nicotine','nicotine (NRT)'], ['naloxone|narcan','Narcan'],
    ['chlormethiazole|heminevrin','Heminevrin']
  ]);

  var IND_NORM = {
    'depression':'depression', 'major depressive disorder':'depression', 'major depression':'depression',
    'recurrent depression':'depression', 'sleep disorder':'insomnia', 'sleep':'insomnia', 'insomnia':'insomnia',
    'parancia':'paranoia', 'paranoia':'paranoia', 'anxiety':'anxiety', 'anxiety disorder':'anxiety',
    'generalized anxiety disorder':'anxiety', 'axiety':'anxiety', 'axiety disorder':'anxiety',
    'psychosis':'psychosis', 'psychotic disorder':'psychosis', 'schizophrenia':'schizophrenia',
    'schizoaffective disorder':'SAD', 'bipolar':'bipolar', 'bipolar disorder':'bipolar',
    'bipolar i disorder':'bipolar', 'bipolar ii disorder':'bipolar', 'bipolar affective disorder':'bipolar',
    'mood disorder':'mood', 'adhd':'ADHD', 'extrapyramidal and movement disorder':'EPS', 'extrapyramidal disorder':'EPS',
    'convulsions':'seizures', 'unspecified convulsions':'seizures',
    "tourette's disorder":"tourette's disorder", 'tourettes disorder':"tourette's disorder"
  };
  var FORCED_IND = {
    'Melatonin': 'sleep', 'Remeron': 'depression', 'Trazodone': 'depression', 'Ambien': 'insomnia',
    'Xanax': 'anxiety', 'Ativan': 'anxiety', 'Klonopin': 'anxiety', 'Valium': 'anxiety', 'Librium': 'anxiety',
    'Serax': 'anxiety', 'Tranxene': 'anxiety', 'Lexotan': 'anxiety', 'Centrax': 'anxiety', 'Paxipam': 'anxiety',
    'medazepam': 'anxiety', 'Onfi': 'anxiety'
  };

  function matchMed(line) {
    for (var i = 0; i < MEDLIST.length; i++) if (MEDLIST[i].rx.test(line)) return MEDLIST[i];
    return null;
  }

  function fmtNum(n) {
    return n.toFixed(3).replace(/\.?0+$/, '');
  }

  function parseQty(s) {
    if (s == null) return null;
    s = s.replace('½', '0.5').replace('¼', '0.25').replace('¾', '0.75');
    var m = s.match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/);
    if (m) return (+m[2]) ? (+m[1]) / (+m[2]) : null;
    if (/^\s*\d*\.?\d+\s*$/.test(s)) return +s;
    return null;
  }

  function normUnit(u) {
    u = u.toLowerCase();
    if (/^(mg|milligram)/.test(u)) return 'mg';
    if (/^(mcg|microgram)/.test(u)) return 'mcg';
    if (/^(g|gram)/.test(u)) return 'g';
    return u;
  }

  function freqOf(t) {
    var hm = t.match(/\b(?:every|q)\s*(\d+)(?:\s*(?:-|–|to)\s*(\d+))?\s*(?:hours?|hrs?|h)\b/i);
    if (hm) return 'q' + hm[1] + (hm[2] ? '-' + hm[2] : '') + 'h';
    var m = t.match(/\b(every\s+\d+(?:\s*(?:-|–|to)\s*\d+)?\s*(?:hour|hr|day|week|wk|month|mo|year|yr)s?(?:\(s\))?)/i);
    if (m) return m[1].toLowerCase().replace(/\s+/g, ' ');
    m = t.match(/\b(every\s+(?:week|month|year)s?)\b/i);
    if (m) return m[1].toLowerCase().replace(/\s+/g, ' ');
    if (/\bmonthly\b/i.test(t)) return 'monthly';
    if (/\bweekly\b/i.test(t)) return 'weekly';
    var l = t.toLowerCase();
    if (/\bas needed\b|\bp\.r\.n\.?\b|\bprn\b/.test(l)) return 'PRN';
    if (/\bbefore meals?\b|\bante cibum\b|\ba\.c\.?|\bac\b/.test(l)) return 'AC';
    if (/\bafter meals?\b|\bpost cibum\b|\bp\.c\.?|\bpc\b/.test(l)) return 'PC';
    if (/\bbedtime\b|\bat night\b|\bnightly\b|\bevery night\b|\bbefore bed\b|\bin the evening\b|\bhora somni\b|\bh\.s\.?|\bhs\b|\bqhs\b/.test(l)) return 'QHS';
    if (/\bevery other day\b|\bqod\b/.test(l)) return 'QOD';
    if (/\btwo times a day\b|\btwice a day\b|\btwice daily\b|\bb\.i\.d\.?|\bbid\b|\b2 times a day\b/.test(l)) return 'BID';
    if (/\bthree times a day\b|\bthrice\b|\bt\.i\.d\.?|\btid\b|\b3 times a day\b/.test(l)) return 'TID';
    if (/\bfour times a day\b|\bq\.i\.d\.?|\bqid\b|\b4 times a day\b/.test(l)) return 'QID';
    if (/\bevery morning\b|\beach morning\b|\bin the morning\b|\bqam\b/.test(l)) return 'QAM';
    if (/\bevery evening\b|\bqpm\b/.test(l)) return 'QPM';
    if (/\bone time a day\b|\bonce a day\b|\bonce daily\b|\bevery day\b|\bdaily\b|\bq\.d\.?|\bqd\b|\bq day\b|\b1 time a day\b/.test(l)) return 'QD';
    return '';
  }

  function routeOf(t) {
    t = t.toLowerCase();
    if (/\bintramuscular(?:ly)?\b|\bi\.m\.?\b/.test(t)) return 'IM';
    if (/\bsubcutaneous(?:ly)?\b|\bsub-?q\b|\bsubcut\b/.test(t)) return 'SC';
    if (/\bintravenous(?:ly)?\b|\bi\.v\.?\b/.test(t)) return 'IV';
    if (/\bsublingual(?:ly)?\b/.test(t)) return 'SL';
    if (/\brectal(?:ly)?\b|\bper rectum\b/.test(t)) return 'PR';
    if (/\btransdermal(?:ly)?\b|\bpatch\b/.test(t)) return 'TD';
    if (/^\s*inject\b/.test(t)) return 'IM';
    return '';
  }

  function isLiquid(h) {
    return /\b(concentrate|solution|suspension|elixir|syrup|oral liquid|liquid|tincture|drops)\b/i.test(h);
  }

  function indicationOf(t, def) {
    var m, raw = null;
    if ((m = t.match(/\brelated to\s+(.+)$/is))) raw = m[1];
    else if ((m = t.match(/\bfor\s+(.+)$/is))) raw = m[1];
    if (raw === null) return def;
    raw = raw.replace(/[\t\r\n].*$/s, '');
    raw = raw.replace(/\*+.*$/, '');
    raw = raw.replace(/\s+(?:related to|addition to|in addition|along with|and give|give|total of|by mouth|orally|po|sublingual|tablets?|capsules?|caps?|\d+\s*\/\s*\d+|[½¼¾]|\d+(?:\.\d+)?\s*(?:mg|mcg|ml|g)\b).*$/i, '');
    raw = raw.replace(/\s*\([^)]*\)\s*$/, '');
    raw = raw.replace(/,.*$/, '');
    raw = raw.replace(/\s*\(\s*[A-Z]\d{2}(?:\.[0-9A-Z]{1,4})?\s*\)/g, '');            // ICD code in parentheses
    raw = raw.replace(/\s+(?:in the (?:morning|afternoon|evening)|at bedtime|at night)\b.*$/i, '');   // trailing timing words
    raw = raw.replace(/\s+without\s+behaviou?ral\b.*$/i, '');                          // "without behavioral disturbance"
    raw = raw.replace(/^\s*(?:other|unspecified|acute|chronic|mild|moderate|severe)\s+/i, '');
    raw = raw.replace(/^\s+|\s+$/g, '');
    if (!raw.length) return def;
    var key = raw.toLowerCase().replace(/\bd\/o\b/g, 'disorder');
    if (IND_NORM.hasOwnProperty(key)) return IND_NORM[key];                       // known phrase wins whole
    var primary = key.split(/\s+(?:for|and)\s+/)[0].replace(/^\s+|\s+$/g, '');     // else primary indication only
    return IND_NORM.hasOwnProperty(primary) ? IND_NORM[primary] : primary;
  }

  function headerText(g) {
    return g.rows[0].innerText.replace(/\s+/g, ' ').trim();
  }

  // First "Give/Inject/..." line among the rows under the drug (works even if the row is collapsed)
  function instrText(g) {
    for (var i = 1; i < g.rows.length; i++) {
      var t = (g.rows[i].textContent || '').replace(/\s+/g, ' ').trim();
      if (/^(?:Give|Inject|Take|Apply|Instill|Insert|Place|Infuse|Administer)\b/i.test(t)) return t;
    }
    return '';
  }

  function buildMedList(groups) {
    var rows = [];
    groups.forEach(function(g) {
      var hdr = headerText(g);
      if (!/\bActive\b/i.test(hdr)) return;
      var med = matchMed(hdr);
      if (!med) return;
      var instr = instrText(g);

      // Combination-product strength like "45-105 MG" (Auvelity): use the
      // full range as listed instead of parsing a single number ("105mg").
      var comboDose = null;
      var cdm = hdr.match(/(\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?\s*(?:mg|mcg|g))\b/i);
      if (cdm) comboDose = cdm[1].replace(/\s+/g, ' ').trim().toUpperCase();

      var ustr = null, uunit = null, cnum = null, cunit = null, cden = 1, m;
      if ((m = hdr.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g)\b(?!\s*\/)/i))) { ustr = m[1]; uunit = m[2].toLowerCase(); }
      if ((m = hdr.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g)\s*\/\s*(\d+(?:\.\d+)?)?\s*ml\b/i))) {
        cnum = m[1]; cunit = m[2].toLowerCase(); cden = m[3] ? m[3] : 1;
      }

      var dnum = null, dunit = null;
      if ((m = instr.match(/\btotal of\s*(\d+(?:\.\d+)?)\s*(mg|mcg|g)\b/i))) { dnum = +m[1]; dunit = m[2].toLowerCase(); }
      else if ((m = instr.match(/\b(?:Give|Inject|Take|Administer|Infuse|Instill)\s+(\d+(?:\.\d+)?)\s*(mg|milligrams?|mcg|micrograms?|g|grams?)\b/i))) { dnum = +m[1]; dunit = normUnit(m[2]); }
      else if (ustr !== null && (m = instr.match(/\b(?:Give|Take)\s+(\d+\s*\/\s*\d+|[½¼¾]|\d*\.?\d+)\s*(?:tablets?|capsules?|tabs?|caps?)\b/i))) { var q = parseQty(m[1]); if (q !== null) { dnum = q * (+ustr); dunit = uunit; } }
      else if (cnum !== null && (m = instr.match(/\b(?:Give|Inject|Instill|Infuse)\s+(\d+(?:\.\d+)?)\s*(?:ml|milliliters?|cc)\b/i))) { dnum = (+m[1]) * ((+cnum) / (+cden)); dunit = cunit; }
      else if (ustr !== null) { dnum = +ustr; dunit = uunit; }

      var dstr = (dnum !== null) ? fmtNum(dnum) + dunit : '';
      var rt = routeOf(instr);
      var disp = med.name + ((isLiquid(hdr) && rt === '') ? ' liquid' : '');
      var fr = freqOf(instr);
      var ind = indicationOf(instr, med.ind);
      if (FORCED_IND.hasOwnProperty(med.name)) ind = FORCED_IND[med.name];
      var raw = instr.replace(/\s+/g, ' ').trim();

      rows.push({ name: med.name, disp: disp, dnum: dnum, dunit: dunit, dstr: dstr, rt: rt, fr: fr, ind: ind, tier: med.tier, raw: raw, comboDose: comboDose });
    });

    function bucketOf(fr) { return (fr === 'QD' || fr === 'QAM' || fr === 'QPM') ? 'QD' : fr; }
    var RANK = { QAM: 0, QD: 1, QPM: 2, QHS: 3 };  // day -> night ordering for the "and" list

    // Group all timings of one drug (same route + indication) together
    var combos = {}, order = [];
    rows.forEach(function(r) {
      var key = [r.name, r.rt, r.ind, r.disp].join('|');
      if (!combos[key]) { combos[key] = { r0: r, buckets: {}, list: [] }; order.push(key); }
      var b = bucketOf(r.fr);
      if (!combos[key].buckets[b]) { combos[key].buckets[b] = []; combos[key].list.push(b); }
      combos[key].buckets[b].push(r);
    });

    var main = [], last = [], review = [], seen = {};
    order.forEach(function(key) {
      var c = combos[key];
      var bnames = c.list.slice().sort(function(a, b) { return (RANK[a] == null ? 4 : RANK[a]) - (RANK[b] == null ? 4 : RANK[b]); });
      var pairs = [];

      bnames.forEach(function(b) {
        var uniq = [], rs = {};
        c.buckets[b].forEach(function(r) { var rk = r.dnum + '|' + r.raw; if (!rs[rk]) { rs[rk] = 1; uniq.push(r); } });
        var r0 = uniq[0];
        var missing = uniq.some(function(r) { return r.dnum === null || r.fr === ''; });
        var unitMismatch = uniq.some(function(r) { return r.dunit !== r0.dunit; });
        if (missing || unitMismatch) {
          uniq.forEach(function(r) {
            var why = [];
            if (r.dnum === null) why.push('dose could not be determined');
            if (r.fr === '') why.push('frequency not recognized');
            if (unitMismatch) why.push('doses use different units');
            var guess = [r.dstr, r.fr, 'for', r.ind].filter(function(x) { return x.length; }).join(' ');
            review.push('- ' + r.name + ': best guess "' + guess + '" — ' + why.join('; ') + '\n    order: "' + r.raw + '"');
          });
          return;
        }
        var total = 0;
        uniq.forEach(function(r) { total += r.dnum; });
        var freqDisp = (uniq.length > 1 && b === 'QD') ? 'QD' : r0.fr;
        var dosePart = r0.comboDose ? r0.comboDose : (fmtNum(total) + r0.dunit);
        pairs.push([dosePart, r0.rt, freqDisp].filter(function(x) { return x.length; }).join(' '));
      });

      if (!pairs.length) return;
      var entry = '- ' + c.r0.disp + ' ' + pairs.join(' and ') + ' for ' + c.r0.ind;
      if (seen[entry]) return;
      seen[entry] = 1;
      (c.r0.tier === 1 ? last : main).push(entry);
    });

    return { lines: main.concat(last), review: review };
  }

  function copyToClipboard(doc, text, btn) {
    function done() { if (btn) { btn.textContent = 'Copied'; setTimeout(function() { btn.textContent = 'Copy'; }, 1200); } }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, fallback);
        return;
      }
    } catch (e) {}
    fallback();
    function fallback() {
      try {
        var ta = doc.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
        doc.body.appendChild(ta);
        ta.focus(); ta.select();
        doc.execCommand('copy');
        doc.body.removeChild(ta);
        done();
      } catch (e) {}
    }
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function buildMedListHtml(res) {
    var h = '<div style="font-weight:bold;margin-bottom:3px;color:#1d4ed8;">Psych med list <button id="copyMedListBtn" type="button" style="margin-left:10px;padding:3px 14px;font-size:16px;font-weight:700;cursor:pointer;border:2px solid #1d4ed8;background:#1d4ed8;color:#fff;border-radius:8px;">Copy</button></div>';
    var lines = res.lines.length ? res.lines : ['- none'];
    h += lines.map(function(l) { return '<div>' + esc(l) + '</div>'; }).join('');
    if (res.review.length) {
      h += '<div style="margin-top:6px;font-weight:bold;color:#9a3412;">⚠ REVIEW — interpret manually (excluded above):</div>';
      h += res.review.map(function(l) { return '<div style="white-space:pre-wrap;">' + esc(l) + '</div>'; }).join('');
    }
    return h;
  }
  // ============ END PSYCH MED LIST ============

  // ---- LABS TO MONITOR ----
  function buildLabsData(groups) {
    var out = [];
    groups.forEach(function(g) {
      var t = g.rows[0].innerText;
      var name = shortName(g);
      LAB_MONITORING.forEach(function(m) {
        if (m.rx.test(t)) {
          var exists = out.some(function(o) { return o.name === name && o.labs === m.labs; });
          if (!exists) out.push({ name: name, labs: m.labs });
        }
      });
    });
    var lines = ['Labs to monitor:'].concat(out.map(function(o) { return '- ' + o.name + ': ' + o.labs; }));
    return { items: out, lines: lines };
  }

  function buildLabsHtml(data) {
    var h = '<div style="font-weight:bold;margin-bottom:4px;color:#1d4ed8;">Labs to monitor ' +
      '<button id="copyLabsBtn" type="button" style="margin-left:10px;padding:3px 14px;font-size:13px;font-weight:700;cursor:pointer;border:2px solid #1d4ed8;background:#1d4ed8;color:#fff;border-radius:8px;">Copy</button></div>';
    if (!data.items.length) return h + '<em>No labs/monitoring needed for current meds.</em>';
    h += data.items.map(function(o) {
      return '<div style="margin:2px 0;"><b>' + esc(o.name) + '</b> — ' + esc(o.labs) + '</div>';
    }).join('');
    return h;
  }

  // ---- WARNINGS (black box + condition-based) ----
  function buildWarningsData(groups, doc) {
    var out = { blackBox: [], conditions: [] };
    // Collect all ICD codes from the page
    var allCodes = [];
    try {
      var bodyText = doc.body ? (doc.body.innerText || '') : '';
      var m, re = new RegExp(CODE_RE.source, 'g');
      while ((m = re.exec(bodyText))) allCodes.push(m[0].replace('.', ''));
    } catch (e) {}
    groups.forEach(function(g) {
      var t = g.rows[0].innerText;
      var name = shortName(g);
      // Black box warnings
      BLACK_BOX.forEach(function(b) {
        if (b.rx.test(t)) {
          var exists = out.blackBox.some(function(o) { return o.name === name && o.text === b.text; });
          if (!exists) out.blackBox.push({ name: name, text: b.text });
        }
      });
      // Condition-based warnings
      CONDITION_WARNINGS.forEach(function(cw) {
        var hasDx = allCodes.some(function(code) { return cw.dx.test(code); });
        if (hasDx && cw.rx.test(t)) {
          var key = cw.dxName + '|' + name;
          var exists2 = out.conditions.some(function(o) { return o.key === key; });
          if (!exists2) out.conditions.push({ key: key, dx: cw.dxName, name: name, text: cw.text });
        }
      });
    });
    var lines = ['Warnings:'];
    out.blackBox.forEach(function(o) { lines.push('- [BLACK BOX] ' + o.name + ': ' + o.text); });
    out.conditions.forEach(function(o) { lines.push('- [' + o.dx + '] ' + o.name + ': ' + o.text); });
    return { items: out, lines: lines };
  }

  function buildWarningsHtml(data) {
    var h = '';
    var bb = data.items.blackBox, cond = data.items.conditions;
    if (!bb.length && !cond.length) return '<em>No black box or condition warnings for current meds.</em>';
    if (bb.length) {
      h += '<div style="font-weight:bold;margin:0 0 2px;color:#991b1b;">Black box:</div>';
      h += bb.map(function(o) {
        return '<div style="margin:2px 0;"><b>' + esc(o.name) + '</b> — ' + esc(o.text) + '</div>';
      }).join('');
    }
    if (cond.length) {
      h += '<div style="font-weight:bold;margin:6px 0 2px;color:#991b1b;">Condition alerts:</div>';
      h += cond.map(function(o) {
        return '<div style="margin:3px 0;"><b>[' + esc(o.dx) + ']</b> <b>' + esc(o.name) + '</b><br><span style="margin-left:4px;">→ ' + esc(o.text) + '</span></div>';
      }).join('');
    }
    return h;
  }

  function isOn(key) {
    try { return localStorage.getItem(key) !== 'off'; } catch (e) { return true; }
  }
  function setOn(key, v) {
    try { localStorage.setItem(key, v ? 'on' : 'off'); } catch (e) {}
  }

  function setButton(doc, id, text, onclick) {
    var b = doc.getElementById(id);
    if (!b) {
      b = doc.createElement('button');
      b.id = id;
      b.type = 'button';
      b.style.cssText = 'margin:4px 4px 4px 0;padding:3px 8px;font-size:12px;cursor:pointer;';
      b.onclick = onclick;
      doc.body.insertBefore(b, doc.body.firstChild);
    }
    b.textContent = text;
  }

  // Two half-width boxes side by side: flags (left) and psych med list (right)
  var FLAG_BOX_CSS = 'display:block;flex:0 0 calc(50% - 4px);width:calc(50% - 4px);box-sizing:border-box;padding:6px 10px;font-size:12px;border:1px solid #9a3412;background:#fff7ed;overflow-wrap:anywhere;';
  var MED_BOX_CSS = 'flex:0 0 calc(50% - 4px);width:calc(50% - 4px);margin-left:auto;box-sizing:border-box;padding:6px 10px;font-size:20px;border:1px solid #2563eb;background:#eff6ff;overflow-wrap:anywhere;';

  function ensureRow(doc) {
    var row = doc.getElementById('pccTopRow');
    if (!row) {
      row = doc.createElement('div');
      row.id = 'pccTopRow';
      row.style.cssText = 'display:flex;gap:8px;align-items:stretch;width:100%;box-sizing:border-box;margin:0 0 6px 0;';
      var btn = doc.getElementById('interactionInfo');
      if (btn && btn.parentNode) btn.parentNode.insertBefore(row, btn.nextSibling);
      else doc.body.insertBefore(row, doc.body.firstChild);
    }
    return row;
  }

  function setBox(doc, id, css, html) {
    var row = ensureRow(doc);
    var p = doc.getElementById(id);
    if (!p) {
      p = doc.createElement('div');
      p.id = id;
      p.style.cssText = css;
      row.appendChild(p);
    }
    p.innerHTML = html;
  }

  function togglePanel(doc, id) {
    var p = doc.getElementById(id);
    if (p) p.style.display = (p.style.display === 'none') ? 'block' : 'none';
  }

  function clearRowStyle(g) {
    g.rows.forEach(function(r) {
      r.style.removeProperty('border-left');
      r.style.removeProperty('border-right');
      r.style.removeProperty('border-top');
      r.style.removeProperty('border-bottom');
      r.style.removeProperty('background-color');
      r.removeAttribute('title');
      // Clear cell borders too (group boxes are drawn on cells, since <tr> borders are unreliable)
      for (var c = 0; c < r.cells.length; c++) {
        r.cells[c].style.removeProperty('border-left');
        r.cells[c].style.removeProperty('border-right');
        r.cells[c].style.removeProperty('border-top');
        r.cells[c].style.removeProperty('border-bottom');
      }
    });
  }

  function applyColor(g, c, title) {
    g.rows.forEach(function(r, i) {
      r.style.setProperty('border-left', '4px solid ' + c.border, 'important');
      r.style.setProperty('background-color', c.bg, 'important');
      if (title && i === 0) r.title = title;
    });
  }

  // Draw a containing box around groups matching a filter (they're contiguous
  // after sorting). Borders go on the CELLS, not the rows, because <tr> borders
  // don't render reliably. Used for psych meds, pain meds, and psych diagnoses.
  // tierFilter can be a tier number or a function(g) returning true/false.
  function boxTier(groups, tierFilter, borderColor) {
    var tierGroups = groups.filter(function(g) {
      return typeof tierFilter === 'function' ? tierFilter(g) : g.tier === tierFilter;
    });
    if (!tierGroups.length) return;
    var rows = [];
    tierGroups.forEach(function(g) {
      g.rows.forEach(function(r) { rows.push(r); });
    });
    if (!rows.length) return;
    var W = '5px solid ' + borderColor;
    // Find the last visible row for the bottom border (detail rows may be hidden)
    var lastVisible = null;
    for (var vi = rows.length - 1; vi >= 0; vi--) {
      var vr = rows[vi];
      // A row is visible if it has layout (offsetParent) or is not display:none
      try {
        var cs = vr.ownerDocument.defaultView.getComputedStyle(vr);
        if (cs && cs.display !== 'none' && cs.visibility !== 'hidden') { lastVisible = vr; break; }
      } catch(e){ lastVisible = vr; break; }
    }
    if (!lastVisible) lastVisible = rows[rows.length - 1];
    rows.forEach(function(r, idx) {
      var cells = r.cells;
      if (!cells.length) return;
      cells[0].style.setProperty('border-left', W, 'important');
      cells[cells.length - 1].style.setProperty('border-right', W, 'important');
      if (idx === 0) {
        for (var c = 0; c < cells.length; c++) cells[c].style.setProperty('border-top', W, 'important');
      }
      if (r === lastVisible) {
        for (var c2 = 0; c2 < cells.length; c2++) cells[c2].style.setProperty('border-bottom', W, 'important');
      }
    });
  }

  function filled(r) {
    var n = 0;
    for (var i = 0; i < r.cells.length; i++) if (r.cells[i].innerText.trim()) n++;
    return n;
  }

  function getMedGroups(tbody) {
    var groups = [], cur = null;
    Array.prototype.forEach.call(tbody.children, function(r) {
      if (r.tagName !== 'TR') return;
      if (filled(r) >= 2) { cur = { rows: [r] }; groups.push(cur); }
      else if (cur) cur.rows.push(r);
    });
    return groups;
  }

  function hash(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return String(h);
  }

  function medKey(r) {
    return hash(r.innerText.replace(/\s+/g, ' ').trim().slice(0, 100));
  }

  function recentlyOpened(key) {
    try {
      var m = JSON.parse(sessionStorage.getItem('pccOpened') || '{}');
      return !!(m[key] && (Date.now() - m[key] < 60000));
    } catch (e) { return false; }
  }

  function markOpened(key) {
    try {
      var m = JSON.parse(sessionStorage.getItem('pccOpened') || '{}');
      var now = Date.now();
      Object.keys(m).forEach(function(k) { if (now - m[k] > 60000) delete m[k]; });
      m[key] = now;
      sessionStorage.setItem('pccOpened', JSON.stringify(m));
    } catch (e) {}
  }

  function shouldOpen(doc, key) {
    doc.__opened = doc.__opened || {};
    return !doc.__opened[key] && !recentlyOpened(key);
  }

  function noteOpened(doc, key) {
    doc.__opened = doc.__opened || {};
    doc.__opened[key] = true;
    markOpened(key);
  }

  function isCollapsed(doc, g) {
    var d = g.rows[1];
    return !d || doc.defaultView.getComputedStyle(d).display === 'none';
  }

  function findExpander(doc, r) {
    var cell = null, best = -1;
    for (var c = 0; c < Math.min(3, r.cells.length); c++) {
      var len = r.cells[c].innerText.trim().length;
      if (len > best) { best = len; cell = r.cells[c]; }
    }
    if (!cell) return null;
    var els = cell.querySelectorAll('*');
    for (var i = 0; i < els.length; i++) {
      var e = els[i];
      if (e.innerText && e.innerText.trim()) continue;
      var a = e.closest('a');
      if (a) {
        var href = a.getAttribute('href') || '';
        if (href && !/^(#|javascript:)/i.test(href)) continue;
      }
      var pointer = doc.defaultView.getComputedStyle(e).cursor === 'pointer';
      if (e.tagName === 'IMG' || e.hasAttribute('onclick') || pointer || a) return a || e;
    }
    return null;
  }

  // Short drug name for the flag list, e.g. "Haloperidol"
  function shortName(g) {
    var r = g.rows[0], cell = null, best = -1;
    for (var c = 0; c < Math.min(3, r.cells.length); c++) {
      var len = r.cells[c].innerText.trim().length;
      if (len > best) { best = len; cell = r.cells[c]; }
    }
    var t = (cell ? cell.innerText : r.innerText).trim().split(/\n|\t/)[0];
    var w = t.split(/[\s(]/)[0].replace(/[^A-Za-z\-]/g, '');
    return w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : t.slice(0, 30);
  }

  function flagAll(groups) {
    var ssriRows = [], adRows = [], serotRows = [], anticoagRows = [], qtcRows = [], benzoRows = [], opioidRows = [], fallRows = [];
    var lithiumRows = [], valproateRows = [], seizureDrugRows = [], antipsychoticRows = [], glaucomaRiskRows = [], sedatingRows = [];
    var beersAnticholinergicRows = [], beersBenzoRows = [], beersZdrugRows = [], beersNsaidRows = [];
    var utiTreatmentRows = [], utiSymptomRows = [], utiPossibleRows = [], utiPreventionRows = [];

    groups.forEach(function(g) {
      var t = g.rows[0].innerText;
      g.reasons = [];
      if (SSRI_ONLY.test(t)) ssriRows.push(g);
      if (ANTIDEPRESSANT.test(t)) adRows.push(g);
      if (SEROTONERGIC.test(t)) serotRows.push(g);
      if (MAOI.test(t)) g.isMAOI = true;
      if (ANTICOAG_NSAID.test(t)) anticoagRows.push(g);
      if (QTC.test(t)) qtcRows.push(g);
      if (BENZO.test(t)) benzoRows.push(g);
      if (OPIOID.test(t)) opioidRows.push(g);
      if (FALL_RISK.test(t)) fallRows.push(g);
      if (LITHIUM_RE.test(t)) lithiumRows.push(g);
      if (VALPROATE_RE.test(t)) valproateRows.push(g);
      if (SEIZURE_RISK_DRUGS.test(t)) seizureDrugRows.push(g);
      if (ANTIPSYCHOTIC.test(t)) antipsychoticRows.push(g);
      if (GLAUCOMA_RISK_DRUGS.test(t)) glaucomaRiskRows.push(g);
      if (SEDATING_DRUGS.test(t)) sedatingRows.push(g);
      if (BEERS_ANTICHOLINERGIC.test(t)) beersAnticholinergicRows.push(g);
      if (BEERS_BENZO.test(t)) beersBenzoRows.push(g);
      if (BEERS_ZDRUG.test(t)) beersZdrugRows.push(g);
      if (BEERS_NSAID.test(t)) beersNsaidRows.push(g);
      if (UTI_TREATMENT.test(t)) utiTreatmentRows.push(g);
      if (UTI_SYMPTOM.test(t)) utiSymptomRows.push(g);
      if (UTI_POSSIBLE.test(t)) utiPossibleRows.push(g);
      if (UTI_PREVENTION.test(t)) utiPreventionRows.push(g);
    });

    function flag(list, reason) {
      list.forEach(function(g) {
        if (g.reasons.indexOf(reason) === -1) g.reasons.push(reason);
      });
    }

    if (ssriRows.length >= 2) flag(ssriRows, 'Multiple SSRIs');
    // Count unique drugs, not orders — two Bupropion strengths (e.g. 300mg + 150mg)
    // are one drug, not two antidepressants.
    var uniqueADs = {};
    adRows.forEach(function(g) { uniqueADs[shortName(g).toLowerCase()] = true; });
    var uniqueADNames = Object.keys(uniqueADs);
    if (uniqueADNames.length >= 3) flag(adRows, uniqueADNames.length + ' antidepressants');

    var ssriSnriRows = groups.filter(function(g) { return SSRI_SNRI.test(g.rows[0].innerText); });
    if (ssriSnriRows.length && anticoagRows.length) {
      flag(ssriSnriRows, 'Bleed risk (SSRI/SNRI + NSAID/blood thinner)');
      flag(anticoagRows, 'Bleed risk (SSRI/SNRI + NSAID/blood thinner)');
    }

    var maoiRows = groups.filter(function(g) { return g.isMAOI; });
    if (serotRows.length >= 2) flag(serotRows, 'Serotonin syndrome risk');
    if (serotRows.length && maoiRows.length) {
      flag(serotRows, 'Serotonin syndrome risk (with MAOI)');
      flag(maoiRows, 'Serotonin syndrome risk (with MAOI)');
    }

    if (qtcRows.length >= 2) flag(qtcRows, 'QTc prolongation');

    if (benzoRows.length && opioidRows.length) {
      flag(benzoRows, 'Sedation/breathing risk (benzo + opioid)');
      flag(opioidRows, 'Sedation/breathing risk (benzo + opioid)');
    }

    if (fallRows.length >= 2) flag(fallRows, 'Risk for falls');

    // Beers Criteria: potentially inappropriate in older adults (65+) — document rationale.
    // Skipped if the patient's age is known to be under 65.
    var patientAge = getPatientAge();
    var isElderly = patientAge === null || patientAge >= 65;
    if (isElderly) {
      if (beersAnticholinergicRows.length) flag(beersAnticholinergicRows, 'Beers: anticholinergic — avoid in elderly');
      if (beersBenzoRows.length) flag(beersBenzoRows, 'Beers: benzodiazepine — avoid in elderly');
      if (beersZdrugRows.length) flag(beersZdrugRows, 'Beers: Z-drug — avoid in elderly');
      if (beersNsaidRows.length) flag(beersNsaidRows, 'Beers: NSAID — avoid chronic use in elderly');
      if (antipsychoticRows.length) flag(antipsychoticRows, 'Beers: antipsychotic — document rationale');
    }

    var pf = patientFlags;
    if (pf.ckd && pf.ckd.found && lithiumRows.length) {
      flag(lithiumRows, 'Lithium + kidney disease (' + pf.ckd.code + '): adjust dose, check levels');
    }
    if (pf.liver && pf.liver.found && valproateRows.length) {
      flag(valproateRows, 'Valproate + liver disease (' + pf.liver.code + '): check LFTs');
    }
    if (pf.seizure && pf.seizure.found && seizureDrugRows.length) {
      flag(seizureDrugRows, 'Bupropion/clozapine + seizure disorder (' + pf.seizure.code + '): lowers seizure threshold');
    }
    if (pf.diabetes && pf.diabetes.found && antipsychoticRows.length) {
      flag(antipsychoticRows, 'Antipsychotic + diabetes (' + pf.diabetes.code + '): monitor weight, glucose, lipids');
    }
    if (pf.glaucoma && pf.glaucoma.found && glaucomaRiskRows.length) {
      flag(glaucomaRiskRows, 'Anticholinergic/TCA + narrow-angle glaucoma (' + pf.glaucoma.code + '): avoid');
    }
    if (pf.sleepApnea && pf.sleepApnea.found && sedatingRows.length) {
      flag(sedatingRows, 'Sedating med + sleep apnea (' + pf.sleepApnea.code + '): breathing risk');
    }
    if (pf.parkinsons && pf.parkinsons.found && antipsychoticRows.length) {
      flag(antipsychoticRows, "Antipsychotic + Parkinson's (" + pf.parkinsons.code + '): may worsen movement symptoms');
    }

    // UTI medications — informational flags (LOW severity), teal highlight on rows.
    if (utiTreatmentRows.length) flag(utiTreatmentRows, 'Likely UTI treatment');
    if (utiSymptomRows.length) flag(utiSymptomRows, 'UTI urinary symptom relief (phenazopyridine — not an antibiotic)');
    if (utiPossibleRows.length) flag(utiPossibleRows, 'Possible UTI antibiotic — check indication');
    if (utiPreventionRows.length) flag(utiPreventionRows, 'UTI prevention (methenamine)');

    var flagged = [];
    groups.forEach(function(g) { if (g.reasons.length) flagged.push(g); });
    return flagged;
  }

  function collectEntries(flagged) {
    var byReason = {}, out = [];
    flagged.forEach(function(g) {
      var n = shortName(g);
      g.reasons.forEach(function(reason) {
        var e = byReason[reason];
        if (!e) {
          e = byReason[reason] = { reason: reason, names: [], sev: severityFor(reason) };
          out.push(e);
        }
        if (e.names.indexOf(n) === -1) e.names.push(n);
      });
    });
    var order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    out.sort(function(a, b) { return order[a.sev] - order[b.sev]; });
    return out;
  }

  function buildPanelHtml(entries) {
    if (!entries.length) return '<em>No flags.</em>';
    return entries.map(function(e) {
      var color = colorFor(e.sev).border;
      var key = rationaleKeyFor(e.reason);
      return '<div class="pcc-flag" data-rkey="' + key + '" data-meds="' + esc(e.names.join(', ')) + '" ' +
        'style="margin:2px 0;cursor:pointer;padding:2px 4px;border-radius:4px;" ' +
        'title="Click to copy a documentation sentence">' +
        '<b style="color:' + color + '">[' + e.sev + ']</b> ' +
        esc(e.reason) + ' — ' + esc(e.names.join(', ')) + ' <span style="color:#666;font-size:11px;">⧉</span></div>';
    }).join('');
  }

  // Floating popup with sentence variations; clicking one copies it.
  function showRationalePopup(doc, rkey, meds, anchorEl) {
    closeRationalePopup(doc);
    var sentences = RATIONALE_SENTENCES[rkey] || RATIONALE_SENTENCES['general'];
    var pop = doc.createElement('div');
    pop.id = 'pccRationalePop';
    pop.style.cssText = 'position:fixed;z-index:999999;max-width:480px;background:#fff;' +
      'border:2px solid #1d4ed8;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,.3);' +
      'padding:10px 12px;font-size:13px;';
    var title = doc.createElement('div');
    title.style.cssText = 'font-weight:bold;margin-bottom:8px;color:#1d4ed8;';
    title.textContent = 'Copy documentation sentence (' + meds + ') — click to copy:';
    pop.appendChild(title);
    sentences.forEach(function(s) {
      var filled = s.replace(/\[meds\]/gi, meds).replace(/\[Meds\]/g, meds);
      var btn = doc.createElement('button');
      btn.type = 'button';
      btn.style.cssText = 'display:block;width:100%;text-align:left;margin:0 0 6px 0;padding:6px 8px;' +
        'font-size:12px;cursor:pointer;border:1px solid #93c5fd;background:#eff6ff;border-radius:4px;';
      btn.textContent = filled;
      btn.onmouseenter = function() { btn.style.background = '#dbeafe'; };
      btn.onmouseleave = function() { btn.style.background = '#eff6ff'; };
      btn.onclick = function(ev) {
        ev.stopPropagation();
        copyToClipboard(doc, filled, null);
        btn.textContent = '✓ Copied: ' + filled;
        setTimeout(function() { closeRationalePopup(doc); }, 900);
      };
      pop.appendChild(btn);
    });
    var close = doc.createElement('button');
    close.type = 'button';
    close.textContent = 'Close';
    close.style.cssText = 'margin-top:2px;padding:3px 12px;font-size:12px;cursor:pointer;';
    close.onclick = function(ev) { ev.stopPropagation(); closeRationalePopup(doc); };
    pop.appendChild(close);
    // Position near the clicked flag, or centered if no anchor
    pop.style.visibility = 'hidden';
    doc.body.appendChild(pop);
    var r = null;
    try { r = anchorEl.getBoundingClientRect(); } catch (e) {}
    var x = r ? r.left + window.scrollX : window.innerWidth / 2 - 240;
    var y = r ? r.bottom + window.scrollY + 6 : window.innerHeight / 2 - 100;
    // Keep on screen
    x = Math.max(8, Math.min(x, window.innerWidth - 496));
    pop.style.left = x + 'px';
    pop.style.top = y + 'px';
    pop.style.visibility = 'visible';
    // Click elsewhere closes it
    setTimeout(function() {
      doc.addEventListener('click', closeRationalePopupOnOutside);
    }, 50);
    function closeRationalePopupOnOutside(ev) {
      if (!pop.contains(ev.target)) closeRationalePopup(doc);
    }
    pop.__outsideHandler = closeRationalePopupOnOutside;
  }

  function closeRationalePopup(doc) {
    var pop = doc.getElementById('pccRationalePop');
    if (pop) {
      if (pop.__outsideHandler) {
        try { doc.removeEventListener('click', pop.__outsideHandler); } catch (e) {}
      }
      pop.remove();
    }
  }

  function sortMeds(doc) {
    var tbody = doc.querySelector('table.scrollTable > tbody');
    if (!tbody) return;
    var groups = getMedGroups(tbody);
    if (!groups.length) return;

    var on = isOn('pccPsychFirst');
    tbody.__po = tbody.__po || 0;
    var psychOnly = 0, tier2c = 0, tier2u = 0, painCount = 0;
    groups.forEach(function(g) {
      var r = g.rows[0];
      if (!r.hasAttribute('data-po')) r.setAttribute('data-po', tbody.__po++);
      g.po = +r.getAttribute('data-po');

      var isPsych = PSYCH.test(r.innerText);
      var isT2c = !isPsych && TIER2_COUNTED.test(r.innerText);
      var isT2u = !isPsych && !isT2c && TIER2_UNCOUNTED.test(r.innerText);
      var isPain = !isPsych && !isT2c && !isT2u && PAIN.test(r.innerText);

      if (isPsych) { g.tier = 0; psychOnly++; }
      else if (isT2c) { g.tier = 1; tier2c++; }
      else if (isT2u) { g.tier = 1; tier2u++; }
      else if (isPain) { g.tier = 3; painCount++; }
      else g.tier = 2;

      g.listed = !!matchMed(headerText(g));
    });
    var psychCount = psychOnly + tier2c;

    var sorted = groups.slice().sort(function(a, b) {
      var ta = on ? a.tier : 2, tb = on ? b.tier : 2;
      return (ta - tb) || (a.po - b.po);
    });

    var changed = sorted.some(function(g, i) { return g !== groups[i]; });
    if (changed) {
      sorted.forEach(function(g) {
        g.rows.forEach(function(r) { tbody.appendChild(r); });
      });
    }

    var noExp = 0;
    if (on) {
      groups.forEach(function(g) {
        if ((g.tier > 1 && !g.listed) || !isCollapsed(doc, g)) return;
        var key = medKey(g.rows[0]);
        if (!shouldOpen(doc, key)) return;
        var x = findExpander(doc, g.rows[0]);
        if (x) { noteOpened(doc, key); x.click(); }
        else noExp++;
      });
    }

    groups.forEach(function(g) {
      clearRowStyle(g);
      if (g.tier <= 1) applyColor(g, COLOR_PSYCH);
      else {
        // UTI meds get a teal highlight (distinct from psych blue, pain orange,
        // and warning colors). Interaction warnings applied below override this.
        var t = g.rows[0].innerText;
        if (UTI_TREATMENT.test(t)) applyColor(g, COLOR_UTI, 'Likely UTI treatment');
        else if (UTI_SYMPTOM.test(t)) applyColor(g, COLOR_UTI, 'Urinary symptom relief — not an antibiotic');
        else if (UTI_PREVENTION.test(t)) applyColor(g, COLOR_UTI, 'UTI prevention');
        else if (UTI_POSSIBLE.test(t)) applyColor(g, COLOR_UTI, 'Often UTI — check indication');
      }
    });
    // Box around psych meds (tiers 0+1, blue) and pain meds (tier 3, orange)
    // Tiers 0+1 are the shaded psych meds — box them all together.
    // Uses sorted (DOM order) so first/last rows are correct.
    if (on) {
      boxTier(sorted, function(g) { return g.tier <= 1; }, '#2563eb');
      boxTier(sorted, 3, '#ea580c');
    }

    var flagged = flagAll(groups);
    flagged.forEach(function(g) {
      var worst = g.reasons.reduce(function(acc, r) {
        var s = severityFor(r);
        var rank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
        return rank[s] < rank[acc] ? s : acc;
      }, 'LOW');
      applyColor(g, colorFor(worst), g.reasons.map(function(x) { return severityFor(x) + ': ' + x; }).join(' | '));
    });

    var entries = collectEntries(flagged);
    var highCount = entries.filter(function(e) { return e.sev === 'HIGH'; }).length;

    setButton(doc, 'psychToggle',
      'Psych meds first: ' + (on ? 'ON' : 'OFF') + ' (' + psychCount + ' counted of ' + groups.length + ' meds' +
      (tier2u ? ', +' + tier2u + ' addiction meds uncounted' : '') +
      (painCount ? ', ' + painCount + ' pain meds moved to bottom' : '') + ')' +
      (noExp ? ' | could not open ' + noExp : ''),
      function() { setOn('pccPsychFirst', !isOn('pccPsychFirst')); sortMeds(doc); });

    setButton(doc, 'interactionInfo',
      '⚠ ' + entries.length + (entries.length === 1 ? ' flag' : ' flags') + ' (' + highCount + ' high) — click to hide/show · screening only',
      function() { togglePanel(doc, 'interactionPanel'); });

    setBox(doc, 'interactionPanel', FLAG_BOX_CSS, buildPanelHtml(entries));
    // Clickable flags: clicking a flag opens the rationale sentence popup
    try {
      var panel = doc.getElementById('interactionPanel');
      if (panel) {
        var flags = panel.querySelectorAll('.pcc-flag');
        for (var fi = 0; fi < flags.length; fi++) {
          (function(f) {
            f.onclick = function(ev) {
              ev.stopPropagation();
              showRationalePopup(doc, f.getAttribute('data-rkey'), f.getAttribute('data-meds'), f);
            };
            f.onmouseenter = function() { f.style.background = '#ffedd5'; };
            f.onmouseleave = function() { f.style.background = ''; };
          })(flags[fi]);
        }
      }
    } catch (e) {}

    var medRes = buildMedList(groups);
    setBox(doc, 'medListBox', MED_BOX_CSS, buildMedListHtml(medRes));
    var copyBtn = doc.getElementById('copyMedListBtn');
    if (copyBtn) copyBtn.onclick = function(e) {
      e.stopPropagation();
      var medText = medRes.lines.join('\n');
      copyToClipboard(doc, medText, copyBtn);
      // Also drop a fill request so the note panel can replace "- none".
      try {
        localStorage.setItem('pccFillPsychMeds', JSON.stringify({ value: medText, ts: Date.now() }));
      } catch(err){}
    };

    // Labs + Warnings row: two half-width boxes side by side
    var labsData = buildLabsData(groups);
    var warnData = buildWarningsData(groups, doc);
    var labsRow = doc.getElementById('pccLabsRow');
    if (!labsRow) {
      labsRow = doc.createElement('div');
      labsRow.id = 'pccLabsRow';
      labsRow.style.cssText = 'display:flex;gap:8px;align-items:stretch;width:100%;box-sizing:border-box;margin:0 0 6px 0;';
      var topRow = doc.getElementById('pccTopRow');
      if (topRow && topRow.parentNode) topRow.parentNode.insertBefore(labsRow, topRow.nextSibling);
      else doc.body.insertBefore(labsRow, doc.body.firstChild);
    }
    var labsBox = doc.getElementById('labsBox');
    if (!labsBox) {
      labsBox = doc.createElement('div');
      labsBox.id = 'labsBox';
      labsBox.style.cssText = 'flex:0 0 calc(50% - 4px);width:calc(50% - 4px);box-sizing:border-box;padding:6px 10px;font-size:13px;border:1px solid #1d4ed8;background:#eff6ff;overflow-wrap:anywhere;';
      labsRow.appendChild(labsBox);
    }
    labsBox.innerHTML = buildLabsHtml(labsData);
    var labsCopyBtn = doc.getElementById('copyLabsBtn');
    if (labsCopyBtn) labsCopyBtn.onclick = function(e) { e.stopPropagation(); copyToClipboard(doc, labsData.lines.join('\n'), labsCopyBtn); };
    // Warnings box (right half)
    var warnBox = doc.getElementById('warnBox');
    if (!warnBox) {
      warnBox = doc.createElement('div');
      warnBox.id = 'warnBox';
      warnBox.style.cssText = 'flex:0 0 calc(50% - 4px);width:calc(50% - 4px);box-sizing:border-box;padding:6px 10px;font-size:13px;border:1px solid #991b1b;background:#fef2f2;overflow-wrap:anywhere;';
      labsRow.appendChild(warnBox);
    }
    warnBox.innerHTML = buildWarningsHtml(warnData);
  }

  function codesIn(r) {
    return r.innerText.match(CODE_RE) || [];
  }

  function dxTier(r) {
    var best = 3;
    codesIn(r).forEach(function(code) {
      var c = code.replace('.', '');
      var t = c.charAt(0) === 'F' ? 0 : RELATED_G.test(c) ? 1 : RELATED_R.test(c) ? 2 : 3;
      if (t < best) best = t;
    });
    return best;
  }

  function scanPatientConditions(groups) {
    var flags = {};
    function set(name, code) { flags[name] = { found: true, code: code }; }
    groups.forEach(function(g) {
      codesIn(g.rows[0]).forEach(function(code) {
        var c = code.replace('.', '');
        if (CKD_RE.test(c)) set('ckd', code);
        if (LIVER_RE.test(c)) set('liver', code);
        if (SEIZURE_DX_RE.test(c)) set('seizure', code);
        if (DIABETES_RE.test(c)) set('diabetes', code);
        if (GLAUCOMA_DX_RE.test(c)) set('glaucoma', code);
        if (SLEEP_APNEA_RE.test(c)) set('sleepApnea', code);
        if (PARKINSONS_RE.test(c)) set('parkinsons', code);
      });
    });
    patientFlags = flags;
  }

  function sortDx(doc) {
    var trs = doc.querySelectorAll('tr'), first = null;
    for (var i = 0; i < trs.length; i++) {
      if (!trs[i].querySelector('tr') && codesIn(trs[i]).length) { first = trs[i]; break; }
    }
    if (!first) return;
    var tbody = first.parentElement;

    var groups = [], cur = null;
    Array.prototype.forEach.call(tbody.children, function(r) {
      if (r.tagName !== 'TR') return;
      if (codesIn(r).length) { cur = { rows: [r] }; groups.push(cur); }
      else if (cur) cur.rows.push(r);
    });
    if (!groups.length) return;

    scanPatientConditions(groups);

    tbody.__dpo = tbody.__dpo || 0;
    var fCount = 0, gCount = 0, rCount = 0;
    groups.forEach(function(g) {
      var r = g.rows[0];
      if (!r.hasAttribute('data-dpo')) r.setAttribute('data-dpo', tbody.__dpo++);
      g.po = +r.getAttribute('data-dpo');
      g.tier = dxTier(r);
      if (g.tier === 0) fCount++;
      else if (g.tier === 1) gCount++;
      else if (g.tier === 2) rCount++;
    });

    groups.forEach(function(g) {
      clearRowStyle(g);
      if (g.tier <= 1) applyColor(g, COLOR_PSYCH);
    });

    var on = isOn('pccDxFirst');
    var sorted = groups.slice().sort(function(a, b) {
      var ta = on ? a.tier : 3, tb = on ? b.tier : 3;
      return (ta - tb) || (a.po - b.po);
    });

    var changed = sorted.some(function(g, i) { return g !== groups[i]; });
    if (changed) {
      sorted.forEach(function(g) {
        g.rows.forEach(function(r) { tbody.appendChild(r); });
      });
    }
    // Box around psych diagnoses (tier 0 F-codes + tier 1 G-codes like insomnia/dementia, blue)
    // when psych-dx-first is on
    if (on) boxTier(sorted, function(g) { return g.tier <= 1; }, '#2563eb');
    setButton(doc, 'dxToggle',
      'Psych dx first: ' + (on ? 'ON' : 'OFF') + ' (F: ' + fCount + ', G: ' + gCount + ', R: ' + rCount + ', of ' + groups.length + ' dx)',
      function() { setOn('pccDxFirst', !isOn('pccDxFirst')); sortDx(doc); });
  }

  function expand(doc) {
    var win = doc.defaultView;
    doc.querySelectorAll('body *').forEach(function(e) {
      var cs = win.getComputedStyle(e);
      var clips = /(auto|scroll|hidden)/.test(cs.overflowY);
      if (clips && e.scrollHeight > e.clientHeight + 1) {
        e.style.setProperty('height', 'auto', 'important');
        e.style.setProperty('max-height', 'none', 'important');
        e.style.setProperty('overflow', 'visible', 'important');
      }
    });
    [doc.documentElement, doc.body].forEach(function(e) {
      e.style.setProperty('overflow', 'visible', 'important');
    });
  }

  function contentBottom(doc) {
    var bottom = 0;
    doc.querySelectorAll('tr').forEach(function(r) {
      var b = r.getBoundingClientRect().bottom;
      if (b > bottom) bottom = b;
    });
    return bottom || doc.body.scrollHeight;
  }

  function unclipParents(f) {
    var el = f.parentElement;
    while (el && el !== document.body && el !== document.documentElement) {
      if (el.clientHeight < f.offsetHeight - 2) {
        el.style.setProperty('height', 'auto', 'important');
        el.style.setProperty('max-height', 'none', 'important');
        el.style.setProperty('overflow', 'visible', 'important');
      }
      el = el.parentElement;
    }
  }

  function fit() {
    document.querySelectorAll('iframe[id^="iFramePanel_"]').forEach(function(f) {
      try {
        var doc = f.contentDocument || f.contentWindow.document;
        if (!doc || !doc.body) return;
        if (f.id === 'iFramePanel_Medications') sortMeds(doc);
        else if (DX_FRAME.test(f.id)) sortDx(doc);
        expand(doc);
        var h = Math.ceil(contentBottom(doc)) + 30;
        if (h > 80 && Math.abs(h - f.offsetHeight) > 5) f.style.height = h + 'px';
        unclipParents(f);
      } catch (e) {}
    });
  }

  setTimeout(fit, 1500);
  setInterval(fit, 2000);
})();