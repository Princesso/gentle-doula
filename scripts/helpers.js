(function(){
  // Global namespace
  window.App = window.App || {};

  // Storage helpers with namespacing and safe JSON handling
  window.App.Storage = {
    key: 'gentle_doula_v1',
    load: function(){
      try {
        const raw = localStorage.getItem(this.key);
        return raw ? JSON.parse(raw) : {};
      } catch(e){ console.error('Storage load failed', e); return {}; }
    },
    save: function(data){
      try { localStorage.setItem(this.key, JSON.stringify(data)); } catch(e){ console.error('Storage save failed', e); }
    },
    patch: function(partial){
      const cur = this.load();
      const next = Object.assign({}, cur, partial);
      this.save(next); return next;
    }
  };

  // Utilities: dates, ids, GA, trimester, baby size
  window.App.Utils = {
    uid: function(){ return 'id_' + Math.random().toString(36).slice(2,10); },
    todayStr: function(){ const d = new Date(); return d.toISOString().slice(0,10); },
    parseDate: function(str){ const d = new Date(str); if(Number.isNaN(d.getTime())) return null; return d; },
    fmtDate: function(d){ try { return d.toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' }); } catch(e){ return d.toISOString().slice(0,10);} },
    // Return {week: 1..40, dayOfWeek:1..7, daysPregnant}
    gestationalAge: function(dueStr){
      const due = this.parseDate(dueStr);
      if(!due) return { week: null, dayOfWeek: null, daysPregnant: null };
      const msPerDay = 86400000;
      const today = new Date();
      const gaDays = Math.max(0, Math.round((280*msPerDay - (due - today)) / msPerDay));
      const clamped = Math.min(280, Math.max(0, gaDays));
      const week = Math.floor(clamped/7) + 1; // 1..40
      const dayOfWeek = clamped % 7 + 1;
      return { week: Math.min(40, week), dayOfWeek, daysPregnant: clamped };
    },
    trimester: function(week){ if(!week) return null; if(week<=13) return 1; if(week<=27) return 2; return 3; },
    babySize: function(week){
      const items = {
        5:'Sesame seed',8:'Raspberry',12:'Lime',16:'Avocado',20:'Banana',24:'Ear of corn',28:'Eggplant',32:'Butternut squash',36:'Honeydew',40:'Watermelon'
      };
      let size = 'Poppy seed';
      Object.keys(items).map(n=>parseInt(n,10)).sort((a,b)=>a-b).forEach(k=>{ if(week>=k) size = items[k]; });
      return size;
    },
    nextUpForWeek: function(week){
      const todos = [
        { w: 6, t: 'Schedule first prenatal visit' },
        { w: 10, t: 'Discuss prenatal vitamins' },
        { w: 12, t: 'Consider screening options' },
        { w: 16, t: 'Plan light movement routine' },
        { w: 20, t: 'Anatomy scan' },
        { w: 24, t: 'Start baby list draft' },
        { w: 28, t: 'Glucose screening' },
        { w: 30, t: 'Begin nursery setup' },
        { w: 32, t: 'Choose pediatrician' },
        { w: 34, t: 'Hospital bag prep' },
        { w: 36, t: 'Birth plan conversation' },
        { w: 38, t: 'Install car seat' }
      ];
      return todos.filter(x=>x.w>=week && x.w<=week+3).slice(0,4).map(x=>x.t);
    }
  };

  // Lightweight sentiment analysis
  window.App.Sentiment = (function(){
    const positive = ['calm','hope','better','good','relieved','excited','joy','love','okay','fine','grateful'];
    const negative = ['sad','down','tired','exhausted','anxious','worried','overwhelmed','cry','alone','angry','irritable','depressed','numb','hopeless','panic','insomnia','insomniac'];
    function score(text){
      if(!text) return 0;
      const t = text.toLowerCase();
      let s = 0;
      positive.forEach(w=>{ if(t.includes(w)) s += 1; });
      negative.forEach(w=>{ if(t.includes(w)) s -= 1; });
      return s;
    }
    return { score };

  // Generate long-form weekly guidance without external file
  window.App.Content.getWeekly = async function(week){
    try {
      const w = Math.min(40, Math.max(1, week||1));
      const tri = w<=13 ? 'first' : (w<=27 ? 'second' : 'third');

      function themeForWeek(num){
        if(num<=4) return 'Setting foundations';
        if(num<=8) return 'Settling into early changes';
        if(num<=12) return 'Closing the first trimester';
        if(num<=16) return 'A steadier groove';
        if(num<=20) return 'Flutters and scans';
        if(num<=24) return 'Growing rhythms';
        if(num<=28) return 'Glucose checks and third trimester';
        if(num<=32) return 'Comfort and preparation';
        if(num<=36) return 'Final prep and practice';
        return 'Almost there';
      }

      function bullets(arr){ return arr.map(x=>'- '+x).join('\n'); }

      const cluster = (w<=4)?1:(w<=8)?2:(w<=12)?3:(w<=16)?4:(w<=20)?5:(w<=24)?6:(w<=28)?7:(w<=32)?8:(w<=36)?9:10;

      let overview=[], mum=[], partner=[], checklist=[], red=[], self=[];

      if(cluster===1){
        overview = [
          `Week ${w} marks the very beginning of your pregnancy timeline. In the ${tri} trimester, hormones begin shifting and your body starts preparing for the journey ahead.`,
          `Energy may vary day to day—gentle routines, hydration, and small, steady meals can help.`,
          `If you just received a positive test, it’s normal to feel both excited and unsure; one step at a time.`
        ];
        mum = [
          `Nausea and fatigue can appear early or not at all—both are within the range of normal.`,
          `Begin or continue a prenatal vitamin if advised by your clinician.`,
          `Note how you feel each day; brief journaling supports patterns and self-compassion.`
        ];
        partner = [
          `Offer practical help: snacks, water, and space for rest go a long way.`,
          `Ask open questions like “How’s your body today?” and listen without fixing.`,
          `Protect quiet time and help with small tasks to reduce decision load.`
        ];
        checklist = [
          'Choose or confirm a prenatal vitamin (folate/folic acid, iron, iodine, vitamin D).',
          'Book or plan your first prenatal appointment.',
          'Start a simple daily check-in habit (two lines is enough).',
          'Plan 1–2 gentle movement windows this week (short walk, stretching).'
        ];
        red = [
          'Heavy bleeding with pain.',
          'Severe one-sided pain or fainting.'
        ];
        self = [
          'Create a soothing wind-down ritual (dim lights, calm music).',
          'Keep easy snacks nearby to steady energy.',
          'Write a kind note to yourself for tough days.'
        ];
      } else if(cluster===2){
        overview = [
          `By week ${w}, early symptoms like nausea, tender breasts, bloating, or vivid dreams may be present.`,
          `Small, frequent meals and steady hydration can ease queasiness.`,
          `Expect emotions to shift—it’s okay to feel many things at once.`
        ];
        mum = [
          `Experiment with foods and times of day that sit best for you.`,
          `If vomiting prevents keeping fluids down, contact your clinician.`,
          `Light movement and fresh air can reset your day.`
        ];
        partner = [
          `Check in with curiosity, not pressure. Offer a snack, water, or a nap setup.`,
          `Take on chores that feel heavy right now (dishes, laundry, meals).`,
          `If mornings are rough, help prep an evening routine to reduce stress tomorrow.`
        ];
        checklist = [
          'Confirm first prenatal visit details and any labs.',
          'Gather questions for your clinician.',
          'Try ginger or vitamin B6 for nausea if appropriate.',
          'Plan simple, easy-to-digest meals for the week.'
        ];
        red = [
          'Persistent inability to keep fluids down (risk of dehydration).',
          'Heavy bleeding or severe cramping.'
        ];
        self = [
          'Keep crackers or a snack by the bed.',
          'Practice 3-minute breathing breaks during the day.',
          'Hydrate with a reusable bottle you enjoy using.'
        ];
      } else if(cluster===3){
        overview = [
          `Approaching the end of the first trimester around week ${w} may bring subtle energy shifts.`,
          `Many choose to discuss screening options during this window—your clinician can guide you.`,
          `Celebrate small wins; you are building steady care for yourself and baby.`
        ];
        mum = [
          `Notice any improving patterns—lean into what helps (meals, rest, movement).`,
          `If headaches appear, hydrate and rest; seek guidance for sudden severe headache or vision changes.`,
          `Protect your calendar with gentle boundaries.`
        ];
        partner = [
          `Help track upcoming appointments and offer to join if desired.`,
          `Invite brief end-of-day check-ins: “What helped today? What could help tomorrow?”`,
          `Keep favorite snacks stocked and support early nights.`
        ];
        checklist = [
          'Review screening and scan options with your clinician.',
          'Plan a small celebration or soothing activity for the trimester milestone.',
          'Keep up with prenatal vitamins if advised.',
          'Begin a light movement routine if cleared and you feel up to it.'
        ];
        red = [
          'Severe headache with vision changes or sudden swelling of face/hands.',
          'Heavy bleeding or intense pain.'
        ];
        self = [
          'Choose one gentle weekly ritual (bath, journal, stretch).',
          'Curate a short playlist that makes you feel grounded.',
          'Set screen-free wind-down 30–60 minutes before bed.'
        ];
      } else if(cluster===4){
        overview = [
          `Entering the ${tri} trimester around week ${w} often feels a bit steadier.`,
          `Body changes become more visible; supportive clothes and cushions help comfort.`,
          `You may notice first movements in the coming weeks—every experience is unique.`
        ];
        mum = [
          `Experiment with side-lying sleep and pillow support between knees.`,
          `Gentle stretches and mindful breath can ease back and hip tightness.`,
          `Note new sensations without judgment—curiosity over worry.`
        ];
        partner = [
          `Offer light massage, a warm beverage, or to set up a cozy rest corner.`,
          `Share logistics (appointments, errands) to reduce mental load.`,
          `Be present: small, steady acts communicate care.`
        ];
        checklist = [
          'Review upcoming anatomy scan timing (often 18–22 weeks).',
          'Identify comfortable sleep positions and cushions.',
          'Plan brief daily movement (walks, prenatal yoga if cleared).',
          'Continue prenatals and hydration.'
        ];
        red = [
          'Severe or persistent abdominal pain.',
          'Severe headache or concerning symptoms that do not improve with rest/hydration.'
        ];
        self = [
          'Practice a 5-breath reset during the day.',
          'Keep water accessible in every room you frequent.',
          'Choose clothes that feel good on your changing body.'
        ];
      } else if(cluster===5){
        overview = [
          `Around week ${w}, many begin to feel flutters or stronger movements.`,
          `The anatomy scan typically happens in this window—emotions can be big and mixed; that’s normal.`,
          `Balance information with comfort: schedule something soothing afterward.`
        ];
        mum = [
          `Note movement patterns without over-monitoring; awareness grows naturally.`,
          `Support your back and posture; consider a prenatal support band if helpful.`,
          `Bring questions to your scan and ask for explanations in plain language.`
        ];
        partner = [
          `Offer to attend the scan, help with transport or post-scan plans.`,
          `Ask what would feel supportive today and follow through.`,
          `Share joy and steadiness; avoid minimizing worries—listen first.`
        ];
        checklist = [
          'Confirm anatomy scan date/time and logistics.',
          'Plan a comforting activity after the appointment.',
          'Explore movement-friendly routines (stretching, walks).',
          'Keep snacks and hydration easy to access.'
        ];
        red = [
          'Severe pain, bleeding, or fluid leakage.',
          'Fever or illness with concerning symptoms—seek clinician guidance.'
        ];
        self = [
          'Gentle music or a short podcast while resting.',
          'Warm shower with mindful breathing.',
          'Write a note about what you’re proud of this week.'
        ];
      } else if(cluster===6){
        overview = [
          `In week ${w}, growth continues and routines matter.`,
          `You may notice clearer daily rhythms with movement and rest.`,
          `Kick awareness begins to make more sense later in pregnancy—no pressure now.`
        ];
        mum = [
          `Rotate positions through the day to ease back and hip strain.`,
          `Stay ahead of thirst; add electrolytes if helpful.`,
          `Keep your calendar kind—leave room for rest.`
        ];
        partner = [
          `Share chores, plan easy meals, and offer breaks.`,
          `Invite a short walk together or set up a cozy rest space.`,
          `Ask “What would help right now?” and act on it.`
        ];
        checklist = [
          'Draft essentials for a baby list (keep it simple).',
          'Review upcoming glucose screening timing (often 24–28 weeks).',
          'Start thinking about a pediatrician (ask friends for recs).',
          'Keep a steady sleep and wind-down routine.'
        ];
        red = [
          'Persistent severe pain, bleeding, or fluid leakage.',
          'Symptoms that worry you or feel urgent—call your clinician.'
        ];
        self = [
          'Short naps if nights are tough.',
          'Light stretching before bed.',
          'Protect one screen-free hour in the evening.'
        ];
      } else if(cluster===7){
        overview = [
          `Around week ${w}, many have glucose screening and begin the ${tri} trimester.`,
          `Energy may shift; gentle pacing and comfort supports are key.`,
          `Clinicians often recommend a Tdap vaccine in late second/early third trimester—confirm timing locally.`
        ];
        mum = [
          `Focus on footwear, posture, and side-lying rest for comfort.`,
          `Small protein-forward meals can steady energy.`,
          `If swelling is new or sudden with other symptoms, seek guidance.`
        ];
        partner = [
          `Drive or accompany to appointments if desired.`,
          `Prep snacks and water for outings.`,
          `Stay patient—comfort can change hour to hour.`
        ];
        checklist = [
          'Complete glucose screening (24–28 weeks).',
          'Discuss Tdap timing with your clinician.',
          'Review nursery basics and storage needs.',
          'Keep a running list of questions for upcoming visits.'
        ];
        red = [
          'Severe headache, vision changes, sudden face/hand swelling (preeclampsia signs).',
          'Dehydration, fever, or illness that feels significant.'
        ];
        self = [
          'Elevate feet when you can.',
          'Hydrate consistently through the day.',
          'Gentle pelvic tilts and stretches if cleared.'
        ];
      } else if(cluster===8){
        overview = [
          `Week ${w} is a good time to lean into preparation without rushing.`,
          `Comfort measures (pillows, warm showers, mindful breath) make a big difference.`,
          `Reserve energy for what matters most this week.`
        ];
        mum = [
          `Refine sleep supports and experiment with positions.`,
          `Wear supportive shoes and consider a belly band if helpful.`,
          `Short, frequent breaks beat long push-throughs.`
        ];
        partner = [
          `Help set up or refresh the sleep environment (fans, pillows, tidy nightstand).`,
          `Batch errands and carry heavy items.`,
          `Offer presence and reassurance; avoid problem-solving unless asked.`
        ];
        checklist = [
          'Shortlist pediatricians and check availability.',
          'Organize essentials (diapers, wipes, a few outfits).',
          'Start a light hospital bag list.',
          'Schedule any remaining second-trimester tasks.'
        ];
        red = [
          'Regular painful contractions, bleeding, or fluid leakage—call promptly.',
          'Severe, persistent pain or worrisome symptoms.'
        ];
        self = [
          'Wind-down ritual with low light and music.',
          'Mindful showers or foot soaks.',
          'Brief journaling about what’s helping.'
        ];
      } else if(cluster===9){
        overview = [
          `Around week ${w}, final preparations come into focus.`,
          `Practice recognizing labor patterns vs. Braxton Hicks (true labor gets stronger, closer, and does not stop with rest).`,
          `Keep plans flexible—babies follow their own timing.`
        ];
        mum = [
          `Pack a simple hospital bag with comfort items and documents.`,
          `Install the car seat and review safety guidelines.`,
          `Rest counts as productive—protect naps and early nights.`
        ];
        partner = [
          `Learn a few comfort measures (pressure points, breath cues, hydration, position changes).`,
          `Handle logistics: fuel in the car, route to hospital, sitter/pet care if needed.`,
          `Be the calm presence; follow her lead.`
        ];
        checklist = [
          'Finalize birth preferences (simple and flexible).',
          'Pack hospital bag and keep it by the door.',
          'Install and check the car seat.',
          'Prep a few easy postpartum meals/snacks.'
        ];
        red = [
          'Bleeding, waters breaking (note time/color), or strong regular contractions—follow your clinician’s guidance.',
          'Severe headache with vision changes, chest pain, or shortness of breath—seek urgent care.'
        ];
        self = [
          'Daily quiet time to settle your nervous system.',
          'Light stretching or short walks if comfortable.',
          'Positive affirmations that feel authentic to you.'
        ];
      } else { // cluster 10
        overview = [
          `Week ${w} means baby could arrive any time.`,
          `Tune into your body’s rhythms and rest between bursts of energy.`,
          `Discuss questions about induction, membrane sweeps, or timing with your clinician if relevant.`
        ];
        mum = [
          `Keep hydration and nutrition easy and steady.`,
          `Notice labor signs—regular, intensifying contractions that continue with movement.`,
          `Trust your preparation and support network.`
        ];
        partner = [
          `Be on-call for practical needs and transport.`,
          `Offer reassurance, touch, and hydration; keep lights low and the space calm.`,
          `Track contraction patterns if asked, and communicate clearly with the birth team.`
        ];
        checklist = [
          'Confirm plans with your clinician for after-hours questions.',
          'Keep phones charged and bags ready.',
          'Have the car seat installed and checked if possible.',
          'Keep snacks, water, and layers ready for both of you.'
        ];
        red = [
          'Heavy bleeding, green/brown fluid with waters breaking, or markedly reduced fetal movement—seek guidance promptly.',
          'Severe headache, vision changes, chest pain, or shortness of breath—urgent care needed.'
        ];
        self = [
          'Alternate rest and gentle movement as comfortable.',
          'Soothing music or guided relaxation.',
          'Warm showers and low-light routines to invite calm.'
        ];
      }

      const title = `Week ${w}: ${themeForWeek(w)}`;
      const post = [
        overview.join(' '),
        '',
        'For mum:',
        mum.join(' '),
        '',
        'For partner:',
        partner.join(' '),
        '',
        'Checklist:',
        bullets(checklist),
        '',
        'Red flags (contact your clinician):',
        bullets(red),
        '',
        'Self-care ideas:',
        bullets(self),
        '',
        'This is general guidance and not medical advice.'
      ].join('\n');

      return { title, post };
    } catch(e){
      console.debug('Weekly content generation failed', e);
      const w = Math.min(40, Math.max(1, week||1));
      return { title: `Week ${w}`, post: 'Weekly guidance is temporarily unavailable.' };
    }
  };
  })();

  // Audio analyzer: volume, speaking rate approximation
  window.App.AudioAnalyzer = (function(){
    let ctx, mic, processor, mediaStream, chunks = [], active = false, onData;
    async function start(cb){
      if(active) return; onData = cb;
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      mic = ctx.createMediaStreamSource(mediaStream);
      processor = ctx.createScriptProcessor(2048, 1, 1);
      let lastZeroCross = 0, zeroCrossCount = 0, samplesCount = 0, energySum = 0;
      processor.onaudioprocess = function(e){
        const data = e.inputBuffer.getChannelData(0);
        let prev = data[0];
        for(let i=1;i<data.length;i++){
          const v = data[i];
          energySum += Math.abs(v);
          samplesCount++;
          if((prev<=0 && v>0) || (prev>=0 && v<0)){
            zeroCrossCount++;
            lastZeroCross = i;
          }
          prev = v;
        }
        // Every buffer, send rolling estimates
        const energy = energySum / samplesCount; // avg abs amplitude
        const rate = zeroCrossCount / (samplesCount/ctx.sampleRate); // approx crossings per second
        if(typeof onData === 'function') onData({ energy, rate });
      };
      mic.connect(processor); processor.connect(ctx.destination); active = true;
      return true;
    }
    async function stop(){
      try {
        if(processor){ processor.disconnect(); }
        if(mic){ mic.disconnect(); }
        if(ctx){ await ctx.close(); }

        if(mediaStream){ mediaStream.getTracks().forEach(t=> t.stop()); mediaStream = null; }
      } catch(e){}
      active = false; onData = null;
    }
    return { start, stop, currentStream: () => mediaStream };
  })();

  // Risk engine combining mood, sentiment, audio features
  window.App.RiskEngine = {
    assess: function({ mood, sentiment, audio }){
      // mood: 1..5, sentiment: -inf..+inf, audio: {energy,rate} averaged
      let risk = 0; // 0 low, 1 med, 2 high
      if(mood <= 2) risk += 1;
      if(mood === 1) risk += 1;
      if(sentiment <= -1) risk += 1;
      if(sentiment <= -3) risk += 1;
      if(audio){
        // low energy and low rate may suggest flat affect
        if(audio.energy < 0.02) risk += 1;
        if(audio.rate < 100) risk += 1;
      }
      if(risk <= 1) return { level: 'low', score: risk };
      if(risk === 2) return { level: 'medium', score: risk };
      return { level: 'high', score: risk };
    }
  };

  // AI wrapper: local mode or OpenAI (BYO key)
  window.App.AI = (function(){
    const systemLocal = 'You are a supportive pregnancy doula. Answer kindly, briefly, and suggest when to talk to a clinician if concerns are medical. Avoid diagnosing.';

async function localAnswer(q, ctx){
      const lc = (q||'').toLowerCase();
      const tokens = tokenize(lc);
      const ga = (ctx && ctx.ga) || {};
      const tri = window.App.Utils.trimester(ga.week);
      const stage = tri===1 ? 'first' : tri===2 ? 'second' : tri===3 ? 'third' : 'any';
      const contextBits = [];
      if(ga && ga.week){ contextBits.push(`You are around week ${ga.week}${tri?` (${['','first','second','third'][tri]} trimester)`:''}.`); }

      // Heuristic safety nudge for urgent flags
      const urgentFlag = /(heavy\s+bleed|severe\s+pain|no\s+movement|reduced\s+movement|vision\s+changes|chest\s+pain|shortness\s+of\s+breath|so\s+dehydrated|cannot\s+keep\s+fluids)/.test(lc);

      // Load knowledge and score
      const knowledge = await loadQA();
      let best = null, bestScore = -1;
      knowledge.forEach(item=>{
        const s = scoreQA(item, tokens, stage);
        if(s > bestScore){ best = item; bestScore = s; }
      });

      if(best && bestScore >= 2){
        const extra = urgentFlag ? ' If symptoms are severe, sudden, or worrying, contact your clinician or seek urgent care.' : '';
        return [contextBits.join(' '), best.a, extra].filter(Boolean).join(' ');
      }

      // Lightweight fallbacks if no strong match
      const parts = [];
      if(contextBits.length) parts.push(contextBits.join(' '));
      if(/vitamin|prenatal/.test(lc)) parts.push('Most prenatal vitamins include folate, iron, iodine, and vitamin D. Discuss specifics with your clinician.');
      if(/cramp|pain|bleed/.test(lc)) parts.push('If you have severe pain or bleeding, seek medical attention promptly.');
      if(/sleep|insomnia|tired|fatigue/.test(lc)) parts.push('Try a relaxing wind-down, hydration, and side-lying rest. Short walks can help sleep quality.');
      if(/nausea|vomit/.test(lc)) parts.push('Small frequent meals, ginger, and B6 can help nausea. If you cannot keep fluids down, contact your clinician.');
      if(/kick|movement/.test(lc)) parts.push('It is common to feel flutters around 18–22 weeks. If movement noticeably reduces later on, call your clinician.');
      if(parts.length===0) parts.push('That is a thoughtful question. Share a bit more detail and I can tailor suggestions. Topics I can help with include symptoms, baby kicks, sleep, nutrition, partner support, scans, and labor signs.');
      return parts.join(' ');
    }

    async function openaiAnswer(q, ctx, key){
      const payload = {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemLocal },
          { role: 'user', content: `Context: week ${(ctx && ctx.ga && ctx.ga.week) || 'unknown'}. Question: ${q}` }
        ],
        temperature: 0.4
      };
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify(payload)
      });
      if(!res.ok) throw new Error('OpenAI error ' + res.status);
      const data = await res.json();
      return data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || 'I could not get a response right now.';
    }

    async function ask(question, ctx){
      const store = window.App.Storage.load();
      const mode = (store.ai && store.ai.mode) || 'local';
      try {
        if(mode === 'openai' && store.ai && store.ai.key){
          return await openaiAnswer(question, ctx, store.ai.key);
        }
      } catch(e){ console.warn('AI remote failed, falling back to local', e); }
      return await localAnswer(question, ctx);
    }

    // Local knowledge base loader and matcher
    let qaCache = null;
    async function loadQA(){
      try {
        if(!qaCache){
          const resp = await fetch('data/qa.json', { cache: 'no-store' });
          const text = await resp.text().catch(()=> '');
          if(resp.ok && /^[\s\r\n\t]*\{/.test(text)){
            const data = JSON.parse(text);
            qaCache = Array.isArray(data.qa) ? data.qa : [];
          } else {
            qaCache = defaultQA();
          }
        }
      } catch(e){ console.debug('QA fetch failed', e); qaCache = defaultQA(); }
      return qaCache;
    }

    function tokenize(s){
      return (s||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(Boolean);
    }

    const synonymMap = {
      kick: ['kicks','kick','movement','movements','fetal','baby move','baby-moving','baby moves','count','counts'],
      movement: ['kick','kicks','movements','fetal'],
      cramp: ['cramps','cramping','pain','ache'],
      bleed: ['bleeding','spotting','spot','blood'],
      nausea: ['vomit','vomiting','morning sickness','sick'],
      headache: ['headaches','migraine','migraine','head pain'],
      heartburn: ['reflux','acid'],
      constipation: ['constipated','stool','poop','bowel'],
      sleep: ['insomnia','tired','rest','position','side sleeping'],
      partner: ['husband','spouse','dad','support'],
      vitamin: ['prenatal','folate','folic','iron','iodine','vit d','vitamin d'],
      exercise: ['workout','walk','yoga','movement','gym'],
      vaccine: ['vaccination','flu','tdap','whooping cough'],
      labor: ['contractions','braxton','birth','water broke','waters','rupture','5-1-1'],
      braxton: ['braxton hicks','hicks','practice contractions'],
      diabetes: ['gd','gestational diabetes','glucose','gtt'],
      preeclampsia: ['pre-eclampsia','vision','swelling','protein','bp','blood pressure'],
      travel: ['flight','flying','plane','car','drive','trip'],
      sex: ['sexual','intimacy','intercourse'],
      UTI: ['urine','urinary','pee','burning'],
      scan: ['ultrasound','anatomy','nuchal','screening','test'],
      kickcount: ['count','kick count','kick counting','movements count']
    };

    function expandToken(t){
      const extras = synonymMap[t] || [];
      return [t].concat(extras);
    }

    function scoreQA(item, tokens, stage){
      const q = (item.q||'').toLowerCase();
      const a = (item.a||'').toLowerCase();
      const tags = (item.tags||[]).map(x=> (x||'').toLowerCase());
      let score = 0;
      tokens.forEach(tok => {
        expandToken(tok).forEach(w=>{
          if(q.includes(w)) score += 2;
          if(a.includes(w)) score += 1; // light boost if present in answer text
          if(tags.includes(w)) score += 2;
        });
      });
      if(item.stage && (item.stage === stage || item.stage === 'any')) score += 2;
      // Boost exact phrase matches
      const joined = tokens.join(' ');
      if(joined.includes('reduced movement') && /reduced movement/.test(q)) score += 3;
      if(joined.includes('count kicks') && /count kicks|kick count/.test(q)) score += 3;
      return score;
    }

    function defaultQA(){
      // Minimal fallback in case qa.json cannot be loaded
      return [
        { q: 'When will I feel baby kicks?', a: 'Most first-time mums notice flutters around 18–22 weeks. If it is earlier in pregnancy, not feeling movement yet can be normal. If you have concerns later on, contact your clinician.', tags: ['kick','movement'], stage: 'second' },
        { q: 'What should be in prenatal vitamins?', a: 'A typical prenatal includes folate/folic acid, iron, iodine, and vitamin D. Some add DHA. Your clinician can personalize this based on labs and diet.', tags: ['vitamin','prenatal'], stage: 'any' },
        { q: 'Is spotting normal in pregnancy?', a: 'Light spotting can happen, but heavy bleeding or strong cramps are urgent flags. If you notice heavy bleeding, clots, or severe pain, seek medical care promptly.', tags: ['bleed','cramp'], stage: 'any' }
      ];
    }
    return { ask };
  })();

  // Content loader
  window.App.Content = {
    cache: null,
    async getForWeek(week){
      try {
        if(!this.cache){
          const resp = await fetch('data/pregnancy-content.json', { cache: 'no-store' });
          const ct = resp.headers.get('content-type') || '';
          const text = await resp.text().catch(()=> '');
          if(!resp.ok){
            console.debug('Content not available', resp.status);
            this.cache = { weeks: [] };
          } else if(!/application\/json/i.test(ct) && !/^[\s\n\r\t]*\{/.test(text)){
            // Non-JSON response (likely HTML fallback); use empty cache to avoid parse errors
            this.cache = { weeks: [] };
          } else {
            this.cache = JSON.parse(text);
          }
        }
        const w = Math.min(40, Math.max(1, week||1));
        const item = (this.cache.weeks || []).find(x=>x.week===w) || { summary: 'Gentle rest and hydration. Notice small changes and be kind to yourself.' };
        return item;
      } catch(e){
        console.debug('Content fetch failed', e);
        return { summary: 'Gentle rest and hydration. Notice small changes and be kind to yourself.' };
      }
    }
  };
})();