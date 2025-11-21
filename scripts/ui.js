(function(){
  window.App = window.App || {};

  // App state lives in storage; ui uses derived state
  window.App.init = function(){
    const s = window.App.Storage.load();
    const first = !s.__initialized;
    const household = s.household || { id: window.App.Utils.uid(), members: ['mom'] };
    const ai = s.ai || { mode: 'local', key: '' };
    const tasks = s.tasks || getDefaultTasks();
    const notes = s.notes || [];
    const chat = s.chat || [];

    const wishlist = s.wishlist || [];
    const profile = s.profile || { role: 'mom', due: '' };
    const baby = s.baby || { sleep: [], feeds: [], moods: [] };

    window.App.Storage.save({ __initialized: true, household, ai, tasks, notes, chat, profile, wishlist, baby });

    // UI bindings
    bindTabs();
    bindSettings();
    bindAISettings();
    bindNotes();
    bindChecklist();

    bindWishlist();
    bindChat();
    bindShare();

    bindBaby();

    // Seed default due as 280 days from today (placeholder for demo)
    if(first && !profile.due){
      const d = new Date(Date.now() + 240*86400000); // approximate if unknown
      $('#due-input').val(d.toISOString().slice(0,10));
    }
  };

  window.App.render = async function(){
    renderSidebar();
    await renderDashboard();
    renderNotesList();
    renderChecklist();

    renderWishlist();

    renderBaby();
    toggleBabyTab();
    await renderReading();
    await renderWeekly();

    renderChat();
  };

  function renderSidebar(){
    const s = window.App.Storage.load();
    const today = new Date();
    $('#today-date').text(window.App.Utils.fmtDate(today));

    $('#household-code').val(s.household.id);

    const ga = window.App.Utils.gestationalAge(s.profile.due);
    const tri = window.App.Utils.trimester(ga.week);

    $('#ga-badge').text(ga.week ? `Week ${ga.week}, day ${ga.dayOfWeek}` : 'Set due date');
    $('#trimester-badge').text(tri ? `${tri}${tri===1?'st':tri===2?'nd':'rd'} trimester` : '—');

    // risk badge updates when we assess
  }

  async function renderDashboard(){
    const s = window.App.Storage.load();
    const ga = window.App.Utils.gestationalAge(s.profile.due);
    $('#week-number').text(ga.week || '—');
    $('#day-number').text(ga.dayOfWeek || '—');
    $('#due-date').text(s.profile.due ? window.App.Utils.fmtDate(new Date(s.profile.due)) : 'not set');
    $('#baby-size').text(`Baby size: ${window.App.Utils.babySize(ga.week||1)}`);

    const content = await window.App.Content.getForWeek(ga.week || 1);
    $('#today-guidance').text(content.summary);

    const next = window.App.Utils.nextUpForWeek(ga.week || 1);
    const $next = $('#next-up'); $next.empty();
    next.forEach(i=>{ $next.append(`<li class="flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-[#1ea896]"></span><span>${i}</span></li>`); });

    // Partner assist and mum supplements reminder
    const role = (s.profile && s.profile.role) || 'mom';

    // Supplements: show daily reminder for mum if not taken today
    if (role === 'mom') {
      const todayStr = window.App.Utils.todayStr();
      const profile = s.profile || {};
      const sup = Object.assign({ remind: true, lastTaken: '' }, profile.supplements || {});
      // Persist supplements object if missing
      if (!profile.supplements) {
        profile.supplements = sup;
        window.App.Storage.patch({ profile });
      }
      const due = sup.remind !== false && sup.lastTaken !== todayStr;
      if (due) {
        $('#supplement-reminder').removeClass('hidden');
      } else {
        $('#supplement-reminder').addClass('hidden');
      }
      $('#btn-supplement-taken').off('click').on('click', function(){
        const s2 = window.App.Storage.load();
        const p2 = s2.profile || {};
        const sup2 = Object.assign({ remind: true, lastTaken: '' }, p2.supplements || {});
        sup2.lastTaken = window.App.Utils.todayStr();
        p2.supplements = sup2;
        window.App.Storage.patch({ profile: p2 });
        $('#supplement-reminder').addClass('hidden');
        showToast('Great—supplements checked for today');
      });
    } else {
      $('#supplement-reminder').addClass('hidden');
    }

    // Partner help card: show suggestions and mum's recent state
    if (role !== 'mom') {
      const latest = (s.notes || [])[0];
      let feeling = 'No recent note yet.';
      if (latest) {
        const snippet = (latest.text || '').trim();
        const cut = snippet.length > 120 ? snippet.slice(0,120) + '…' : snippet;
        feeling = `Mood ${latest.mood}/5 • Sentiment ${latest.sentiment}${cut ? ' • "' + cut + '"' : ''}`;
      }
      const risk = latest && latest.risk ? latest.risk.level : null;
      const help = [];
      if (risk === 'high') help.push('Check in gently and consider contacting the clinician together.');
      else if (risk === 'medium') help.push('Offer a break, snacks, and a short walk or nap.');
      else help.push('Share chores, bring water, and plan a small relaxing moment together.');
      help.push('Hydration and prenatal supplements help daily.');
      const nextTasks = window.App.Utils.nextUpForWeek(ga.week || 1).slice(0,2);
      if (nextTasks.length) help.push('Upcoming: ' + nextTasks.join('; ') + '.');
      $('#partner-help').removeClass('hidden');
      $('#partner-help-body').html(
        `<p class="text-sm"><strong>How mum may be feeling:</strong> ${escapeHtml(feeling)}</p>` +
        `<p class="text-sm mt-2"><strong>Ways to help today:</strong> ${escapeHtml(help.join(' '))}</p>`
      );
    } else {
      $('#partner-help').addClass('hidden');
    }
  }

  function bindTabs(){
    $('[data-view]').on('click', function(){
      $('[data-view]').removeClass('tab-active').addClass('tab-inactive');
      $(this).addClass('tab-active').removeClass('tab-inactive');
      const v = $(this).data('view');
      $('#view-dashboard, #view-notes, #view-reading, #view-weekly, #view-checklist, #view-wishlist, #view-chat, #view-baby').addClass('hidden');
      $('#view-'+v).removeClass('hidden');
      if(v==='reading') renderReading();
      if(v==='weekly') renderWeekly();
      if(v==='notes') renderNotesList();
      if(v==='checklist') renderChecklist();

      if(v==='wishlist') renderWishlist();
      if(v==='chat') renderChat();
    });

    $('#btn-quick-note').on('click', function(){
      $('[data-view="notes"]').trigger('click');
      $('#note-date').val(window.App.Utils.todayStr());
      $('#note-text').focus();
    });
  }

  function bindSettings(){
    $('#btn-open-settings').on('click', ()=> $('#modal-settings').removeClass('hidden').addClass('flex'));
    $('#close-settings').on('click', ()=> $('#modal-settings').addClass('hidden').removeClass('flex'));

    const s = window.App.Storage.load();
    $('#due-input').val(s.profile.due || '');

    $('#baby-dob').val(s.profile.babyDob || '');
    $('#role-select').val(s.profile.role || 'mom');

    $('#save-settings').on('click', function(){
      const due = $('#due-input').val();
      const role = $('#role-select').val();

      const babyDob = $('#baby-dob').val();
      const cur = window.App.Storage.load();
      const p = Object.assign({}, cur.profile || {});
      p.role = role; p.due = due; p.babyDob = babyDob;
      window.App.Storage.patch({ profile: p });
      $('#modal-settings').addClass('hidden').removeClass('flex');
      // Navigate back to Dashboard and refresh UI
      $('[data-view="dashboard"]').trigger('click');
      renderSidebar();
      renderDashboard();
      renderReading();
      showToast('Settings saved');
    });

    // Quick open settings by clicking badges/due
    $('#ga-badge, #trimester-badge, #due-date')
      .addClass('cursor-pointer')
      .off('click keypress')
      .on('click keypress', function(e){
        if(e.type==='click' || e.key==='Enter' || e.key===' ' || e.key==='Spacebar'){
          $('#modal-settings').removeClass('hidden').addClass('flex');
          setTimeout(()=> $('#due-input').trigger('focus'), 50);
        }
      });
  }

  function bindAISettings(){
    $('#btn-ai-settings').on('click', ()=>{
      const s = window.App.Storage.load();
      $('#ai-mode').val((s.ai && s.ai.mode) || 'local');
      $('#openai-key').val((s.ai && s.ai.key) || '');
      toggleKeyField();
      $('#modal-ai').removeClass('hidden').addClass('flex');
    });
    $('#close-ai').on('click', ()=> $('#modal-ai').addClass('hidden').removeClass('flex'));
    $('#ai-mode').on('change', toggleKeyField);
    function toggleKeyField(){
      if($('#ai-mode').val()==='openai') $('#openai-key-wrap').removeClass('hidden'); else $('#openai-key-wrap').addClass('hidden');
    }
    $('#save-ai').on('click', function(){
      const mode = $('#ai-mode').val();
      const key = $('#openai-key').val();
      window.App.Storage.patch({ ai: { mode, key } });
      $('#modal-ai').addClass('hidden').removeClass('flex');
    });
  }

  function bindNotes(){
    $('#note-date').val(window.App.Utils.todayStr());
    let audioStats = null; let audioRecording = null; let collecting = false; let avg = { energy:0, rate:0, n:0 }; let recorder = null; let recChunks = [];

    $('#btn-start-voice').on('click', async function(){
      try {
        $('#voice-status').text('Listening...');
        $('#btn-start-voice').addClass('hidden');
        $('#btn-stop-voice').removeClass('hidden');
        avg = { energy:0, rate:0, n:0 };
        audioRecording = null;
        await window.App.AudioAnalyzer.start(({ energy, rate })=>{
          avg.energy += energy; avg.rate += rate; avg.n += 1;
        });
        const s = window.App.AudioAnalyzer.currentStream ? window.App.AudioAnalyzer.currentStream() : null;
        if (s && window.MediaRecorder) {
          try {
            recorder = new MediaRecorder(s);
            recChunks = [];
            recorder.ondataavailable = function(e){ if(e && e.data && e.data.size){ recChunks.push(e.data); } };
            recorder.onstop = function(){
              try {
                const blob = new Blob(recChunks, { type: (recorder && recorder.mimeType) || 'audio/webm' });
                if (blob && blob.size) {
                  audioRecording = URL.createObjectURL(blob);
                  $('#voice-status').text('Voice note captured');
                }
              } catch(err){ console.warn('Audio processing failed', err); }
            };
            recorder.start();
          } catch(err){ console.warn('Recorder init failed', err); }
        }
        collecting = true;
      } catch(e){
        console.warn('Mic start failed', e);
        $('#voice-status').text('Mic permission denied');
        $('#btn-stop-voice').addClass('hidden');
        $('#btn-start-voice').removeClass('hidden');
      }
    });
    $('#btn-stop-voice').on('click', async function(){
      try {
        if (recorder && recorder.state === 'recording') {
          $('#voice-status').text('Processing audio...');
          recorder.stop();
        }
      } catch(e){}
      await window.App.AudioAnalyzer.stop();
      collecting = false;
      const stats = avg.n>0 ? { energy: avg.energy/avg.n, rate: avg.rate/avg.n } : null;
      audioStats = stats;
      if(!audioRecording){
        $('#voice-status').text(stats ? 'Voice metrics captured' : 'No audio captured');
      }
      $('#btn-stop-voice').addClass('hidden');
      $('#btn-start-voice').removeClass('hidden');
    });

    $('#note-form').on('submit', function(e){
      e.preventDefault();
      const date = $('#note-date').val() || window.App.Utils.todayStr();
      const mood = parseInt($('#note-mood').val(), 10) || 3;
      const text = ($('#note-text').val() || '').trim();
      const sent = window.App.Sentiment ? window.App.Sentiment.score(text) : 0;
      const risk = window.App.RiskEngine.assess({ mood, sentiment: sent, audio: audioStats });
      const entry = { id: window.App.Utils.uid(), date, mood, text, sentiment: sent, audio: audioStats, risk, voiceUrl: audioRecording || '' };
      const s = window.App.Storage.load();
      const notes = [entry].concat(s.notes || []).sort((a,b)=> (a.date < b.date ? 1 : -1));
      window.App.Storage.patch({ notes });
      // reset form voice state for next entry
      audioStats = null; audioRecording = null; avg = { energy:0, rate:0, n:0 };
      $('#note-text').val('');
      $('#voice-status').text('Not recording');
      renderNotesList();
      updateRiskBanner();
      showToast('Note saved');
    });
  }
  function renderNotesList(){
    const s = window.App.Storage.load();
    const $list = $('#notes-list'); $list.empty();
    const items = s.notes || [];
    if(items.length===0){ $list.append('<div class="muted">No notes yet.</div>'); return; }
    items.forEach(n=>{
      const badge = n.risk && n.risk.level==='high' ? 'badge-risk-high' : n.risk && n.risk.level==='medium' ? 'badge-risk-med' : 'badge-risk-low';
      const html = $(`
        <div class="note-item p-4 rounded-xl ring-1 ring-black/5 bg-white">
          <div>
            <div class="text-sm muted">${window.App.Utils.fmtDate(new Date(n.date))}</div>
            <div class="mt-1">${escapeHtml(n.text || '')}</div>
            <div class="mt-2 flex items-center gap-2">
              <span class="pill ${badge}">Risk: ${n.risk ? n.risk.level : 'n/a'}</span>
              <span class="pill">Mood: ${n.mood}</span>
              <span class="pill">Sentiment: ${n.sentiment}</span>
            </div>
            ${n.voiceUrl ? `<div class="mt-2"><audio controls src="${n.voiceUrl}" class="w-full"></audio></div>` : ''}
          </div>
          <div>
            <button class="btn-secondary" data-del="${n.id}">Delete</button>
          </div>
        </div>
      `);
      $list.append(html);
    });
    $list.off('click','[data-del]').on('click','[data-del]',function(){
      const id = $(this).data('del');
      const s2 = window.App.Storage.load();
      window.App.Storage.patch({ notes: (s2.notes||[]).filter(x=>x.id!==id) });
      renderNotesList();
      updateRiskBanner();
    });
    updateRiskBanner();
  }

  function updateRiskBanner(){
    const s = window.App.Storage.load();
    const latest = (s.notes||[])[0];
    const $badge = $('#risk-badge');
    if(!latest || !latest.risk){ $('#risk-banner').addClass('hidden'); $badge.text('Not assessed'); return; }
    if(latest.risk.level==='high'){
      $('#risk-banner').removeClass('hidden').removeClass('bg-[#fff9e8] ring-[#ffe9a6]').addClass('bg-[#ffefef]').addClass('ring-[#ffc7c7]');
      $badge.text('High').attr('class','pill badge-risk-high');
    } else if(latest.risk.level==='medium'){
      $('#risk-banner').removeClass('hidden').removeClass('bg-[#ffefef] ring-[#ffc7c7]').addClass('bg-[#fff9e8]').addClass('ring-[#ffe9a6]');
      $badge.text('Medium').attr('class','pill badge-risk-med');
    } else {
      $('#risk-banner').addClass('hidden');
      $badge.text('Low').attr('class','pill badge-risk-low');
    }
  }

  async function renderReading(){
    const s = window.App.Storage.load();
    const ga = window.App.Utils.gestationalAge(s.profile.due);
    const data = await window.App.Content.getForWeek(ga.week || 1);
    const $a = $('#reading-article');
    $a.empty();
    $a.append(`<p>${escapeHtml(data.summary)}</p>`);
    $a.append(`<div class="mt-4 p-4 rounded-xl ring-1 ring-black/5 bg-white"><strong>Tip:</strong> ${escapeHtml(data.tip || 'Hydrate, rest, and note how you feel today.')} </div>`);
  }

  function getDefaultTasks(){
    return [
      { id: window.App.Utils.uid(), title:'Draft your baby list', week:24, done:false },
      { id: window.App.Utils.uid(), title:'Start nursery planning', week:30, done:false },
      { id: window.App.Utils.uid(), title:'Choose a pediatrician', week:32, done:false },
      { id: window.App.Utils.uid(), title:'Pack hospital bag', week:34, done:false },
      { id: window.App.Utils.uid(), title:'Install car seat', week:38, done:false }
    ];
  }

  function bindChecklist(){
    $('#btn-add-task').on('click', ()=> $('#modal-task').removeClass('hidden').addClass('flex'));
    $('#close-task').on('click', ()=> $('#modal-task').addClass('hidden').removeClass('flex'));
    $('#save-task').on('click', function(){
      const title = $('#task-title').val().trim();
      const week = parseInt($('#task-week').val(),10) || 20;
      if(!title) return;
      const s = window.App.Storage.load();
      const tasks = (s.tasks||[]).concat([{ id: window.App.Utils.uid(), title, week, done:false }]);
      window.App.Storage.patch({ tasks });
      $('#task-title').val('');
      $('#modal-task').addClass('hidden').removeClass('flex');
      renderChecklist();
    });
  }

  function renderChecklist(){
    const s = window.App.Storage.load();
    const ga = window.App.Utils.gestationalAge(s.profile.due);
    const wk = ga.week || 1;
    const groups = {
      now: [], soon: [], later: []
    };
    (s.tasks||[]).forEach(t=>{
      if(t.week<=wk) groups.now.push(t); else if(t.week<=wk+4) groups.soon.push(t); else groups.later.push(t);
    });

    const $wrap = $('#checklist-groups'); $wrap.empty();
    function box(title, key){
      const arr = groups[key];
      const el = $(`
        <div class="p-4 rounded-xl ring-1 ring-black/5 bg-white">
          <h4 class="heading text-xl">${title}</h4>
          <div class="mt-2 space-y-2" id="list-${key}"></div>
        </div>
      `);
      arr.sort((a,b)=>a.week-b.week);
      arr.forEach(item=>{
        const row = $(`
          <label class="flex items-center gap-3">
            <input type="checkbox" ${item.done?'checked':''} data-check="${item.id}" />
            <span>${escapeHtml(item.title)} <span class="text-xs text-[#6b7280]">(week ${item.week})</span></span>
            <button class="ml-auto text-xs btn-secondary" data-del-task="${item.id}">Remove</button>
          </label>
        `);
        el.find(`#list-${key}`).append(row);
      });
      return el;
    }

    $wrap.append(box('Do now', 'now'));
    $wrap.append(box('Do soon', 'soon'));
    $wrap.append(box('Plan for later', 'later'));

    $wrap.off('change','[data-check]').on('change','[data-check]', function(){
      const id = $(this).data('check');
      const s2 = window.App.Storage.load();
      const tasks = (s2.tasks||[]).map(x=> x.id===id ? Object.assign({}, x, { done: !!$(this).is(':checked') }) : x);
      window.App.Storage.patch({ tasks });
    });
    $wrap.off('click','[data-del-task]').on('click','[data-del-task]', function(){
      const id = $(this).data('del-task');
      const s2 = window.App.Storage.load();
      window.App.Storage.patch({ tasks: (s2.tasks||[]).filter(x=>x.id!==id) });
      renderChecklist();
    });
  }

  function bindWishlist(){
    $('#btn-add-wishlist').on('click', ()=> $('#modal-wishlist').removeClass('hidden').addClass('flex'));
    $('#close-wishlist').on('click', ()=> $('#modal-wishlist').addClass('hidden').removeClass('flex'));

    $('#save-wishlist-item').on('click', function(){
      const title = $('#wish-title').val().trim();
      const link = $('#wish-link').val().trim();
      const note = $('#wish-note').val().trim();
      const price = $('#wish-price').val().trim();
      if(!title) { $('#wish-title').focus(); return; }
      const s = window.App.Storage.load();
      const item = { id: window.App.Utils.uid(), title, link, note, price, created: Date.now() };
      const wishlist = (s.wishlist||[]).concat([item]);
      window.App.Storage.patch({ wishlist });
      $('#wish-title').val(''); $('#wish-link').val(''); $('#wish-note').val(''); $('#wish-price').val('');
      $('#modal-wishlist').addClass('hidden').removeClass('flex');
      renderWishlist();
      showToast('Added to wishlist');
    });

    $('#wishlist-list').off('click','[data-del-wish]').on('click','[data-del-wish]', function(){
      const id = $(this).data('del-wish');
      const s = window.App.Storage.load();
      window.App.Storage.patch({ wishlist: (s.wishlist||[]).filter(x=>x.id!==id) });
      renderWishlist();
    });

    $('#btn-share-wishlist').on('click', async function(){
      const s = window.App.Storage.load();
      const items = s.wishlist || [];
      if(items.length===0){ showToast('Wishlist is empty'); return; }
      const lines = items.map(i => '• ' + i.title + (i.link ? ' — ' + i.link : '') + (i.price ? ' (' + i.price + ')' : ''));
      const text = 'My pregnancy wishlist:\n' + lines.join('\n');
      const title = 'My pregnancy wishlist';
      try {
        if(navigator.share){ await navigator.share({ title, text }); }
        else { await navigator.clipboard.writeText(text); alert('Wishlist copied to clipboard'); }
      } catch(e){ if(!(e && e.name==='AbortError')) console.warn('Share wishlist failed', e); }
    });
  }

  function renderWishlist(){
    const s = window.App.Storage.load();
    const role = (s.profile && s.profile.role) || 'mom';
    if(role !== 'mom'){ $('#btn-add-wishlist').addClass('hidden'); } else { $('#btn-add-wishlist').removeClass('hidden'); }
    const $list = $('#wishlist-list'); const $empty = $('#wishlist-empty');
    $list.empty();
    const items = s.wishlist || [];
    if(items.length===0){ $empty.removeClass('hidden'); return; } else { $empty.addClass('hidden'); }
    items.forEach(w => {
      const linkHtml = w.link ? `<a class="link-cta break-all" href="${escapeHtml(w.link)}" target="_blank" rel="noopener">Link</a>` : '';
      const noteHtml = w.note ? `<div class="text-sm text-[#4b5563] mt-1">${escapeHtml(w.note)}</div>` : '';
      const priceHtml = w.price ? `<span class="pill">${escapeHtml(w.price)}</span>` : '';
      const row = $(`
        <div class="p-4 rounded-xl ring-1 ring-black/5 bg-white flex items-start gap-3">
          <div class="flex-1">
            <div class="font-medium flex items-center gap-2">${escapeHtml(w.title)} ${priceHtml}</div>
            ${noteHtml}
            ${linkHtml ? `<div class="mt-1">${linkHtml}</div>` : ''}
          </div>
          <div>
            <button class="btn-secondary" data-del-wish="${w.id}">Remove</button>
          </div>
        </div>
      `);
      $list.append(row);
    });
  }

  function toggleBabyTab(){
    const s = window.App.Storage.load();
    const hasBaby = !!(s.profile && s.profile.babyDob);
    const $tab = $('#tab-baby');
    if(!$tab.length) return;
    if(hasBaby){
      $tab.removeClass('hidden');
    } else {
      $tab.addClass('hidden');
      if ($('[data-view].tab-active').data('view') === 'baby') {
        $('[data-view="dashboard"]').trigger('click');
      }
    }
  }

  function bindBaby(){
    // Default inputs
    const setDefaults = () => {
      try {
        const now = new Date();
        const tzoff = now.getTimezoneOffset();
        const toLocalISO = (d) => new Date(d - tzoff*60000).toISOString().slice(0,16);
        $('#sleep-start').val(toLocalISO(now));
        $('#sleep-end').val(toLocalISO(new Date(now.getTime() + 60*60*1000)));
        $('#feed-time').val(toLocalISO(now));
        $('#pp-date').val(window.App.Utils.todayStr());
      } catch(e){}
    };
    setDefaults();

    // Add sleep session
    $('#btn-add-sleep').off('click').on('click', function(){
      const start = $('#sleep-start').val();
      const end = $('#sleep-end').val();
      if(!start || !end) { alert('Please set start and end'); return; }
      if(new Date(end) <= new Date(start)) { alert('End must be after start'); return; }
      const s = window.App.Storage.load();
      const baby = s.baby || { sleep: [], feeds: [], moods: [] };
      baby.sleep = (baby.sleep || []).concat([{ id: window.App.Utils.uid(), start, end }]).sort((a,b)=> a.start < b.start ? 1 : -1);
      window.App.Storage.patch({ baby });
      renderBaby();
      showToast('Sleep logged');
    });

    // Add feed event
    $('#btn-add-feed').off('click').on('click', function(){
      const time = $('#feed-time').val();
      if(!time){ alert('Please set feed time'); return; }
      const s = window.App.Storage.load();
      const baby = s.baby || { sleep: [], feeds: [], moods: [] };
      baby.feeds = (baby.feeds || []).concat([{ id: window.App.Utils.uid(), time }]).sort((a,b)=> a.time < b.time ? 1 : -1);
      window.App.Storage.patch({ baby });
      renderBaby();
      showToast('Feed logged');
    });

    // Add mum mood/concern
    $('#btn-add-mood').off('click').on('click', function(){
      const date = $('#pp-date').val() || window.App.Utils.todayStr();
      const mood = parseInt($('#pp-mood').val(), 10) || 3;
      const text = ($('#pp-concern').val() || '').trim();
      const s = window.App.Storage.load();
      const baby = s.baby || { sleep: [], feeds: [], moods: [] };
      const entry = { id: window.App.Utils.uid(), date, mood, text };
      baby.moods = (baby.moods || []).concat([entry]).sort((a,b)=> a.date < b.date ? 1 : -1);
      window.App.Storage.patch({ baby });
      $('#pp-concern').val('');
      renderBaby();
      showToast('Saved');
    });

    // Deletions via delegation
    $('#baby-sleep-list').off('click','[data-del-sleep]').on('click','[data-del-sleep]', function(){
      const id = $(this).data('del-sleep');
      const s = window.App.Storage.load();
      const baby = s.baby || { sleep: [], feeds: [], moods: [] };
      baby.sleep = (baby.sleep || []).filter(x=>x.id!==id);
      window.App.Storage.patch({ baby });
      renderBaby();
    });
    $('#baby-feed-list').off('click','[data-del-feed]').on('click','[data-del-feed]', function(){
      const id = $(this).data('del-feed');
      const s = window.App.Storage.load();
      const baby = s.baby || { sleep: [], feeds: [], moods: [] };
      baby.feeds = (baby.feeds || []).filter(x=>x.id!==id);
      window.App.Storage.patch({ baby });
      renderBaby();
    });
    $('#baby-mood-list').off('click','[data-del-mood]').on('click','[data-del-mood]', function(){
      const id = $(this).data('del-mood');
      const s = window.App.Storage.load();
      const baby = s.baby || { sleep: [], feeds: [], moods: [] };
      baby.moods = (baby.moods || []).filter(x=>x.id!==id);
      window.App.Storage.patch({ baby });
      renderBaby();
    });
  }

  function renderBaby(){
    const s = window.App.Storage.load();
    const hasBaby = !!(s.profile && s.profile.babyDob);
    const $view = $('#view-baby');
    if(!$view.length) return;
    if(!hasBaby){ $view.addClass('hidden'); return; }

    const baby = s.baby || { sleep: [], feeds: [], moods: [] };
    const $sleep = $('#baby-sleep-list');
    const $feeds = $('#baby-feed-list');
    const $moods = $('#baby-mood-list');
    $sleep.empty(); $feeds.empty(); $moods.empty();

    const fmtDT = (str)=>{ try{ const d=new Date(str); return window.App.Utils.fmtDate(d)+' '+d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); } catch(e){ return str; } };

    // Sleep entries
    (baby.sleep||[]).forEach(it=>{
      let dur='';
      try { const ms = new Date(it.end) - new Date(it.start); const mins = Math.max(0, Math.round(ms/60000)); dur = ` • ${Math.floor(mins/60)}h ${mins%60}m`; } catch(e){}
      const row = $(`
        <div class="p-3 rounded-xl ring-1 ring-black/5 bg-white flex items-center gap-2">
          <div class="flex-1 text-sm">${escapeHtml(fmtDT(it.start))} → ${escapeHtml(fmtDT(it.end))}${escapeHtml(dur)}</div>
          <button class="btn-secondary text-xs" data-del-sleep="${it.id}">Remove</button>
        </div>
      `);
      $sleep.append(row);
    });

    // Feed entries
    (baby.feeds||[]).forEach(it=>{
      const row = $(`
        <div class="p-3 rounded-xl ring-1 ring-black/5 bg-white flex items-center gap-2">
          <div class="flex-1 text-sm">Fed at ${escapeHtml(fmtDT(it.time))}</div>
          <button class="btn-secondary text-xs" data-del-feed="${it.id}">Remove</button>
        </div>
      `);
      $feeds.append(row);
    });

    // Mood/concerns entries
    (baby.moods||[]).forEach(it=>{
      const snippet = (it.text||'').trim();
      const cut = snippet.length>140 ? snippet.slice(0,140)+'…' : snippet;
      const row = $(`
        <div class="p-3 rounded-xl ring-1 ring-black/5 bg-white flex items-start gap-2">
          <div class="flex-1">
            <div class="text-sm muted">${escapeHtml(window.App.Utils.fmtDate(new Date(it.date)))} • Mood ${it.mood}/5</div>
            ${cut ? `<div class="mt-1 text-sm text-[#374151]">${escapeHtml(cut)}</div>` : ''}
          </div>
          <button class="btn-secondary text-xs" data-del-mood="${it.id}">Remove</button>
        </div>
      `);
      $moods.append(row);
    });

    $view.removeClass('hidden');
  }
  function bindChat(){
    $('#chat-form').on('submit', async function(e){
      e.preventDefault();
      const q = $('#chat-input').val().trim();
      if(!q) return;
      pushChat('user', q);
      $('#chat-input').val('');
      await answerChat(q);
    });
  }

  function renderChat(){
    const s = window.App.Storage.load();
    const $t = $('#chat-thread');
    if(!$t.length) return;
    $t.empty();
    (s.chat||[]).forEach(m=> appendMsg(m.role, m.text));
    $t.scrollTop($t[0].scrollHeight);
  }

  function pushChat(role, text){
    const s = window.App.Storage.load();
    const chat = (s.chat||[]).concat([{ role, text, id: window.App.Utils.uid(), ts: Date.now() }]);
    window.App.Storage.patch({ chat });
    appendMsg(role, text);
  }

  async function answerChat(q){
    const s = window.App.Storage.load();
    const ga = window.App.Utils.gestationalAge(s.profile.due);
    appendMsg('bot', 'Typing...');
    const ans = await window.App.AI.ask(q, { ga });
    // replace last 'Typing...' bubble
    const s2 = window.App.Storage.load();
    const updated = (s2.chat||[]);
    updated[updated.length-1] = { role:'bot', text: ans, id: window.App.Utils.uid(), ts: Date.now() };
    window.App.Storage.patch({ chat: updated });
    renderChat();
  }

  function appendMsg(role, text){
    const $t = $('#chat-thread');
    const bubbleClass = role==='user' ? 'chat-bubble chat-user' : 'chat-bubble chat-bot';
    const row = $(`
      <div class="chat-msg ${role==='user'?'justify-end':''}">
        <div class="${bubbleClass}">${escapeHtml(text)}</div>
      </div>
    `);
    $t.append(row);
    $t.stop().animate({ scrollTop: $t[0].scrollHeight }, 300);
  }

  function bindShare(){
    $('#btn-copy-code').on('click', function(){
      const code = $('#household-code').val();
      navigator.clipboard.writeText(code).then(()=>{
        $(this).text('Copied');
        setTimeout(()=> $(this).text('Copy'), 1200);
      });
    });

    $('#btn-share-invite').on('click', async function(){
      const s = window.App.Storage.load();
      const payload = {
        household: s.household.id,
        note: 'Join my Gentle Doula household to view updates.'
      };
      const url = location.origin + location.pathname.replace('app.html','app.html') + '#join=' + encodeURIComponent(JSON.stringify(payload));
      const text = `Please join my Gentle Doula: ${url}`;
      try {
        if(navigator.share){ await navigator.share({ title:'Gentle Doula', text, url }); }
        else { await navigator.clipboard.writeText(text); alert('Invite copied to clipboard'); }
      } catch(e){ if(e && e.name==='AbortError'){ /* user canceled share, ignore */ } else { console.warn('Share failed', e); } }
    });

    $('#btn-export').on('click', function(){
      const s = window.App.Storage.load();
      const blob = new Blob([JSON.stringify(s, null, 2)], { type:'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'gentle-doula-backup.json';
      a.click();
      setTimeout(()=> URL.revokeObjectURL(a.href), 1000);
    });

    $('#import-file').on('change', function(){
      const f = this.files && this.files[0];
      if(!f) return;
      const r = new FileReader();
      r.onload = function(){
        try {
          const data = JSON.parse(r.result);
          window.App.Storage.save(data);
          location.reload();
        } catch(e){ alert('Invalid file'); }
      };
      r.readAsText(f);
    });

    $('#btn-alert-partner').on('click', async function(){
      const s = window.App.Storage.load();
      const latest = (s.notes||[])[0];
      const msg = `I might need extra support today. Risk: ${latest && latest.risk && latest.risk.level}. From Gentle Doula.`;
      try {
        if(navigator.share){ await navigator.share({ title:'Gentle Doula update', text: msg }); }
        else { await navigator.clipboard.writeText(msg); alert('Message copied to clipboard.'); }
      } catch(e){ if(e && e.name==='AbortError'){ /* user canceled share, ignore */ } else { console.warn('Notify failed', e); } }
    });
  }

  // Helpers
  function escapeHtml(str){
    return (str||'').replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'})[m]; });
  }
  function showToast(msg){
    const $t = $('#toast');
    if(!$t.length) return;
    $t.text(msg || 'Saved');
    $t.removeClass('hidden');
    setTimeout(()=> $t.addClass('hidden'), 1800);
  }


  async function renderWeekly(){
    const s = window.App.Storage.load();
    const ga = window.App.Utils.gestationalAge(s.profile.due);
    const w = ga.week || 1;
    const data = await (window.App.Content.getWeekly ? window.App.Content.getWeekly(w) : Promise.resolve({ title: `Week ${w}`, post: 'Weekly guide coming soon.' }));
    const $w = $('#weekly-article');
    if(!$w.length) return;
    $w.empty();
    $w.append(`<h3 class="heading text-xl">${escapeHtml(data.title || `Week ${w}`)}</h3>`);
    const post = data.post || 'Weekly guide coming soon.';
    // Preserve newlines nicely for readability
    $w.append(`<div class="mt-2 whitespace-pre-wrap leading-7">${escapeHtml(post)}</div>`);
    // Gentle disclaimer
    $w.append(`<div class="mt-4 p-4 rounded-xl ring-1 ring-black/5 bg-white text-sm">This guide is general and supportive. It does not replace medical care. If something feels urgent or worrying, contact your clinician.</div>`);

  }
})();