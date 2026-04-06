'use strict';
var Calendar={
  _weekStart:null,
  _DAY_NAMES:['ראשון','שני','שלישי','רביעי','חמישי'],
  _DAY_COLORS:['#F8BBD0','#FFF9C4','#C8E6C9','#B2EBF2','#E1BEE7'],
  _HOURS_START:8,_HOURS_END:18,
  // Auto-durations per stage (minutes). null = day title only
  STAGE_DURATIONS:{1:30,2:45,3:null,4:120,5:null,6:180,7:null},
  // Attendance statuses
  ATTEND:{confirmed:'✅',tentative:'❓',declined:'❌',none:''},

  // Israeli holidays 2025-2027 (major)
  HOLIDAYS:{
    '2025-09-23':'ראש השנה','2025-09-24':'ראש השנה ב',
    '2025-10-02':'יום כיפור','2025-10-07':'סוכות','2025-10-14':'שמחת תורה',
    '2025-12-15':'חנוכה','2025-12-22':'חנוכה (אחרון)',
    '2026-03-03':'פורים','2026-04-02':'פסח','2026-04-08':'שביעי של פסח',
    '2026-04-15':'יום השואה','2026-04-22':'יום הזיכרון','2026-04-23':'יום העצמאות',
    '2026-05-22':'שבועות','2026-09-12':'ראש השנה','2026-09-13':'ראש השנה ב',
    '2026-09-21':'יום כיפור','2026-09-26':'סוכות','2026-10-03':'שמחת תורה',
    '2026-12-05':'חנוכה',
    '2027-03-23':'פורים','2027-04-22':'פסח','2027-04-28':'שביעי של פסח',
    '2027-05-04':'יום השואה','2027-05-11':'יום הזיכרון','2027-05-12':'יום העצמאות',
    '2027-06-11':'שבועות','2027-10-02':'ראש השנה','2027-10-03':'ראש השנה ב',
    '2027-10-11':'יום כיפור','2027-10-16':'סוכות','2027-10-23':'שמחת תורה'
  },

  init:function(){
    var now=new Date();Calendar._weekStart=new Date(now);
    Calendar._weekStart.setDate(now.getDate()-now.getDay());
    Calendar._weekStart.setHours(0,0,0,0);
    setInterval(function(){Calendar._checkReminders();},60000);
    // v3.4: Persistent lock screen notification
    Calendar._startNotificationUpdates();
  },

  // ===== WEEKLY VIEW — Vertical day cards =====
  async render(){
    var ws=Calendar._weekStart;
    var weekDates=[];
    for(var d=0;d<5;d++){var dt=new Date(ws);dt.setDate(ws.getDate()+d);weekDates.push(dt);}
    var monthStr=weekDates[2].toLocaleDateString('he-IL',{month:'long',year:'numeric'});
    var weekNum=Calendar._getWeekNumber(weekDates[0]);

    var page=Utils.id('mainContent');
    var html='<div class="page active">';
    // Header
    html+='<div style="display:flex;align-items:center;gap:6px;padding:10px 14px;">'
    +'<button class="btn btn-outline btn-sm" onclick="Calendar.prevWeek()">◀</button>'
    +'<div style="flex:1;text-align:center;"><div style="font-size:1.05rem;font-weight:700;">📅 '+monthStr+'</div>'
    +'<div style="font-size:.72rem;color:var(--text-light);">שבוע '+weekNum+'</div></div>'
    +'<button class="btn btn-outline btn-sm" onclick="Calendar.nextWeek()">▶</button>'
    +'<button class="btn btn-outline btn-sm" style="font-size:.7rem;" onclick="Calendar.goToday()">היום</button>'
    +'<button class="btn btn-primary btn-sm" onclick="Calendar.addEvent()">➕</button></div>';

    html+='<div style="padding:0 10px 6px;display:flex;gap:6px;">'
    +'<button class="btn btn-outline btn-sm" style="font-size:.68rem;" onclick="Calendar.importIcs()">📥 ICS</button>'
    +'<input type="file" id="icsImportFile" accept="*/*" style="display:none" onchange="Calendar._processIcsImport(this)">'
    +'</div>';

    // 5 day cards — vertical layout like the planner image
    for(var d=0;d<5;d++){
      var dt=weekDates[d];var dStr=Calendar._dateStr(dt);
      var isToday=dStr===Calendar._dateStr(new Date());
      var holiday=Calendar.HOLIDAYS[dStr]||'';
      var dayEvents=await DB.getEventsByDate(dStr);
      var titles=dayEvents.filter(function(ev){return ev.dayTitle;});
      var timed=dayEvents.filter(function(ev){return!ev.dayTitle;});
      timed.sort(function(a,b){return(a.time||'').localeCompare(b.time||'');});

      // Check overlaps
      var overlapPairs=Calendar._findOverlaps(timed);

      // Day card
      html+='<div style="margin:0 10px 10px;border-radius:12px;overflow:hidden;'
      +(isToday?'border:2px solid var(--accent);box-shadow:0 2px 12px rgba(74,144,217,.2);':'border:1px solid #ddd;')
      +'">';
      // Day header
      html+='<div style="background:'+Calendar._DAY_COLORS[d]+';padding:8px 12px;display:flex;align-items:center;gap:8px;">'
      +'<div style="font-weight:700;font-size:.95rem;">'+Calendar._DAY_NAMES[d]+'</div>'
      +'<div style="font-size:.85rem;">'+dt.getDate()+'/'+(dt.getMonth()+1)+'</div>'
      +(isToday?'<span style="background:var(--accent);color:#fff;font-size:.65rem;padding:2px 8px;border-radius:10px;">היום</span>':'')
      +'<div style="flex:1;"></div>'
      +'<button style="background:none;border:none;font-size:1rem;cursor:pointer;" onclick="Calendar.addEvent(\''+dStr+'\')">➕</button>'
      +'</div>';

      // Holiday/titles
      if(holiday||titles.length){
        var titleParts=[];
        if(holiday)titleParts.push('🕎 '+holiday);
        titles.forEach(function(t){titleParts.push(Utils.escHtml(t.title));});
        html+='<div style="padding:4px 12px;background:'+Calendar._DAY_COLORS[d]+'60;font-size:.78rem;color:#555;">'
        +titleParts.join(' | ')+'</div>';
      }

      // Events list
      html+='<div style="background:#fff;min-height:40px;padding:6px 0;">';
      if(!timed.length){
        html+='<div style="text-align:center;color:var(--text-light);font-size:.8rem;padding:12px;">אין אירועים</div>';
      }else{
        timed.forEach(function(ev){
          var attend=Calendar.ATTEND[ev.attendance]||'';
          var hasOverlap=overlapPairs[ev.id]||false;
          html+='<div onclick="Calendar.viewEvent(\''+ev.id+'\')" style="display:flex;gap:8px;padding:6px 12px;cursor:pointer;'
          +'border-right:4px solid '+(ev.color||'#4A90D9')+';'
          +(hasOverlap?'background:#fff0f0;':'')
          +'border-bottom:1px solid #f5f5f5;">';
          // Time column
          html+='<div style="min-width:55px;font-size:.78rem;font-weight:600;color:'+( ev.color||'#4A90D9')+';">'
          +(ev.time||'')+(ev.timeEnd?'<br><span style="font-size:.65rem;color:var(--text-light);">'+ev.timeEnd+'</span>':'')+'</div>';
          // Content
          html+='<div style="flex:1;min-width:0;">'
          +'<div style="font-weight:600;font-size:.85rem;">'+attend+Utils.escHtml(ev.title)+'</div>';
          if(ev.candidateName)html+='<div style="font-size:.75rem;color:var(--text-light);">👤 '+Utils.escHtml(ev.candidateName)+'</div>';
          if(ev.room)html+='<div style="font-size:.75rem;color:var(--text-light);">📍 '+Utils.escHtml(ev.room)+'</div>';
          if(ev.participants)html+='<div style="font-size:.75rem;color:var(--text-light);">👥 '+Utils.escHtml(ev.participants)+'</div>';
          if(hasOverlap)html+='<div style="font-size:.65rem;color:var(--danger);">⚠️ חפיפה בזמנים</div>';
          html+='</div></div>';
        });
      }
      html+='</div></div>'; // events + card
    }

    html+='</div>';page.innerHTML=html;
  },

  // ===== NAV =====
  prevWeek:function(){Calendar._weekStart.setDate(Calendar._weekStart.getDate()-7);Calendar.render();},
  nextWeek:function(){Calendar._weekStart.setDate(Calendar._weekStart.getDate()+7);Calendar.render();},
  goToday:function(){var now=new Date();Calendar._weekStart=new Date(now);Calendar._weekStart.setDate(now.getDate()-now.getDay());Calendar._weekStart.setHours(0,0,0,0);Calendar.render();},

  // ===== ADD EVENT =====
  addEvent:function(date,time){
    date=date||Calendar._dateStr(new Date());time=time||'09:00';
    var html='<div class="modal-title">➕ אירוע חדש</div>'
    +'<div class="form-group"><label class="form-label">כותרת</label>'
    +'<input class="form-input" id="evTitle" placeholder="ראיון / פגישה / תזכורת"></div>'
    +'<div class="form-group"><label class="form-label">תאריך</label>'
    +'<input class="form-input" id="evDate" type="date" value="'+date+'"></div>'
    +'<div class="cb-row" onclick="this.querySelector(\'.cb-box\').classList.toggle(\'checked\')">'
    +'<div class="cb-box" id="evDayTitle">✓</div><span>סמן ככותרת יום (ללא שעה)</span></div>'
    +'<div id="evTimeSection">'
    +'<div style="display:flex;gap:8px;">'
    +'<div class="form-group" style="flex:1;"><label class="form-label">התחלה</label>'
    +'<input class="form-input" id="evTime" type="time" value="'+time+'"></div>'
    +'<div class="form-group" style="flex:1;"><label class="form-label">סיום</label>'
    +'<input class="form-input" id="evTimeEnd" type="time" value="'+Calendar._addMin(time,60)+'"></div></div></div>'
    +'<div class="form-group"><label class="form-label">👤 מועמד</label>'
    +'<input class="form-input" id="evCandidate" placeholder="הקלד שם מועמד..." oninput="Calendar._searchCandidate(this.value)">'
    +'<input type="hidden" id="evCandidateId">'
    +'<div id="evCandidateResults" style="max-height:120px;overflow-y:auto;"></div></div>'
    +'<div class="form-group"><label class="form-label">👥 משתתפים / מזומנים</label>'
    +'<input class="form-input" id="evParticipants" placeholder="שמות"></div>'
    +'<div class="form-group"><label class="form-label">📍 חדר / מיקום</label>'
    +'<input class="form-input" id="evRoom" placeholder="חדר ישיבות"></div>'
    +'<div class="form-group"><label class="form-label">🚦 אישור הגעה</label>'
    +'<div class="radio-group" id="evAttend">'
    +'<div class="radio-btn active" data-val="none" onclick="Calendar._pick(this)">ללא</div>'
    +'<div class="radio-btn" data-val="confirmed" onclick="Calendar._pick(this)">✅ אישר</div>'
    +'<div class="radio-btn" data-val="tentative" onclick="Calendar._pick(this)">❓ אולי</div>'
    +'<div class="radio-btn" data-val="declined" onclick="Calendar._pick(this)">❌ סירב</div>'
    +'</div></div>'
    +'<div class="form-group"><label class="form-label">🔔 תזכורת</label>'
    +'<select class="form-select" id="evReminder">'
    +'<option value="0">ללא</option><option value="5">5 דקות</option>'
    +'<option value="15" selected>15 דקות</option><option value="30">30 דקות</option>'
    +'<option value="60">שעה</option><option value="1440">יום</option></select></div>'
    +'<div class="form-group"><label class="form-label">🎨 צבע</label><div class="radio-group" id="evColor">'
    +'<div class="radio-btn active" data-val="#4A90D9" onclick="Calendar._pick(this)" style="background:#4A90D9;color:#fff;min-width:28px;">●</div>'
    +'<div class="radio-btn" data-val="#2ECC71" onclick="Calendar._pick(this)" style="background:#2ECC71;color:#fff;min-width:28px;">●</div>'
    +'<div class="radio-btn" data-val="#E74C3C" onclick="Calendar._pick(this)" style="background:#E74C3C;color:#fff;min-width:28px;">●</div>'
    +'<div class="radio-btn" data-val="#F39C12" onclick="Calendar._pick(this)" style="background:#F39C12;color:#fff;min-width:28px;">●</div>'
    +'<div class="radio-btn" data-val="#9B59B6" onclick="Calendar._pick(this)" style="background:#9B59B6;color:#fff;min-width:28px;">●</div>'
    +'</div></div>'
    +'<div class="form-group"><label class="form-label">הערות</label>'
    +'<textarea class="form-textarea" id="evNotes" rows="2"></textarea></div>'
    +'<button class="btn btn-primary" style="width:100%;margin-top:8px;" onclick="Calendar.saveEvent()">💾 שמור</button>';
    Stages.showModal(html);
  },

  _pick:function(el){el.parentElement.querySelectorAll('.radio-btn').forEach(function(b){b.classList.remove('active')});el.classList.add('active');},

  // v3.4: Candidate autocomplete search
  async _searchCandidate(q){
    var resultsEl=Utils.id('evCandidateResults');
    if(!resultsEl)return;
    if(!q||q.length<2){resultsEl.innerHTML='';return;}
    var all=await DB.getAllCandidates();
    var matches=all.filter(function(c){
      return(c.fullName||c.name||'').toLowerCase().includes(q.toLowerCase())||
        (c.name||'').toLowerCase().includes(q.toLowerCase());
    }).slice(0,5);
    if(!matches.length){resultsEl.innerHTML='<div style="font-size:.75rem;color:var(--text-light);padding:4px;">לא נמצא</div>';return;}
    var html='';
    matches.forEach(function(c){
      html+='<div onclick="Calendar._selectCandidate(\''+c.id+'\',\''+Utils.escHtml(Utils.displayName(c))+'\')" '
      +'style="padding:6px 8px;border-bottom:1px solid #eee;cursor:pointer;font-size:.82rem;">'
      +Utils.escHtml(Utils.displayName(c))+' <span style="color:var(--text-light);">'+Utils.getStageName(c.stage)+'</span></div>';
    });
    resultsEl.innerHTML=html;
  },
  _selectCandidate:function(id,name){
    Utils.id('evCandidate').value=name;
    Utils.id('evCandidateId').value=id;
    Utils.id('evCandidateResults').innerHTML='';
  },

  async saveEvent(existingId){
    var title=Utils.id('evTitle')?.value?.trim();
    if(!title){Utils.toast('נא למלא כותרת','danger');return;}
    var isDayTitle=Utils.id('evDayTitle')?.classList.contains('checked');
    var colorEl=document.querySelector('#evColor .radio-btn.active');
    var attendEl=document.querySelector('#evAttend .radio-btn.active');
    var ev={
      id:existingId||undefined,
      title:title,
      date:Utils.id('evDate')?.value||Calendar._dateStr(new Date()),
      dayTitle:isDayTitle||false,
      time:isDayTitle?'':Utils.id('evTime')?.value||'09:00',
      timeEnd:isDayTitle?'':Utils.id('evTimeEnd')?.value||'',
      candidateName:Utils.id('evCandidate')?.value||'',
      candidateId:Utils.id('evCandidateId')?.value||'',
      participants:Utils.id('evParticipants')?.value||'',
      room:Utils.id('evRoom')?.value||'',
      attendance:attendEl?attendEl.dataset.val:'none',
      reminderMin:parseInt(Utils.id('evReminder')?.value)||0,
      color:colorEl?colorEl.dataset.val:'#4A90D9',
      notes:Utils.id('evNotes')?.value||'',
      createdBy:Sync._currentRecruiter||''
    };
    if(ev.reminderMin>0&&ev.time){
      var dt=new Date(ev.date+'T'+ev.time);
      ev.reminderAt=new Date(dt.getTime()-ev.reminderMin*60000).toISOString();
    }
    await DB.saveEvent(ev);
    DB.logAction('אירוע',ev.title+' '+ev.date+' '+(ev.time||'יום שלם'));
    Stages.closeModal();Utils.toast('אירוע נשמר','success');
    Calendar.updateNotification();
    Calendar.render();
  },

  // ===== VIEW EVENT =====
  async viewEvent(id){
    var ev=await DB.getEvent(id);if(!ev)return;
    var attend=Calendar.ATTEND[ev.attendance]||'';
    var html='<div class="modal-title" style="border-right:4px solid '+(ev.color||'#4A90D9')+';">'
    +attend+' '+Utils.escHtml(ev.title)+'</div>'
    +'<div style="font-size:.85rem;margin-bottom:12px;">'
    +'<div>📅 '+Utils.formatDate(ev.date+'T00:00')+( ev.dayTitle?' (כותרת יום)':'')+'</div>';
    if(ev.time)html+='<div>🕐 '+ev.time+(ev.timeEnd?' — '+ev.timeEnd:'')+'</div>';
    if(ev.candidateName)html+='<div>👤 '+Utils.escHtml(ev.candidateName)+'</div>';
    if(ev.participants)html+='<div>👥 '+Utils.escHtml(ev.participants)+'</div>';
    if(ev.room)html+='<div>📍 '+Utils.escHtml(ev.room)+'</div>';
    if(ev.attendance&&ev.attendance!=='none')html+='<div>🚦 הגעה: '+Calendar.ATTEND[ev.attendance]+' '+(ev.attendance==='confirmed'?'אישר':ev.attendance==='tentative'?'אולי':'סירב')+'</div>';
    if(ev.reminderMin)html+='<div>🔔 '+ev.reminderMin+' דקות לפני</div>';
    if(ev.notes)html+='<div>📝 '+Utils.escHtml(ev.notes)+'</div>';
    if(ev.createdBy)html+='<div style="color:var(--text-light);font-size:.72rem;">נוצר: '+Utils.escHtml(ev.createdBy)+'</div>';
    html+='</div><div style="display:flex;flex-direction:column;gap:8px;">'
    +'<button class="btn btn-outline" onclick="Calendar.editEvent(\''+ev.id+'\')">✏️ ערוך</button>'
    +'<button class="btn btn-outline" onclick="Calendar.exportEventIcs(\''+ev.id+'\')">📤 ייצוא ICS</button>'
    +'<div style="display:flex;gap:8px;">'
    +'<button class="btn btn-danger btn-sm" style="flex:1;" onclick="Calendar.deleteEvent(\''+ev.id+'\')">🗑 מחק</button>'
    +'<button class="btn btn-outline btn-sm" style="flex:1;" onclick="Stages.closeModal()">סגור</button></div></div>';
    Stages.showModal(html);
  },

  async editEvent(id){
    var ev=await DB.getEvent(id);if(!ev)return;Stages.closeModal();
    Calendar.addEvent(ev.date,ev.time||'09:00');
    setTimeout(function(){
      if(Utils.id('evTitle'))Utils.id('evTitle').value=ev.title||'';
      if(Utils.id('evDate'))Utils.id('evDate').value=ev.date||'';
      if(Utils.id('evTime'))Utils.id('evTime').value=ev.time||'';
      if(Utils.id('evTimeEnd'))Utils.id('evTimeEnd').value=ev.timeEnd||'';
      if(Utils.id('evCandidate'))Utils.id('evCandidate').value=ev.candidateName||'';
      if(Utils.id('evParticipants'))Utils.id('evParticipants').value=ev.participants||'';
      if(Utils.id('evRoom'))Utils.id('evRoom').value=ev.room||'';
      if(Utils.id('evReminder'))Utils.id('evReminder').value=String(ev.reminderMin||15);
      if(Utils.id('evNotes'))Utils.id('evNotes').value=ev.notes||'';
      if(ev.dayTitle&&Utils.id('evDayTitle'))Utils.id('evDayTitle').classList.add('checked');
      // Color
      document.querySelectorAll('#evColor .radio-btn').forEach(function(b){b.classList.remove('active');if(b.dataset.val===ev.color)b.classList.add('active');});
      // Attendance
      document.querySelectorAll('#evAttend .radio-btn').forEach(function(b){b.classList.remove('active');if(b.dataset.val===(ev.attendance||'none'))b.classList.add('active');});
      // Update save button
      var btn=document.querySelector('.modal .btn-primary');
      if(btn){btn.textContent='💾 עדכן';btn.setAttribute('onclick',"Calendar.saveEvent('"+ev.id+"')");}
    },100);
  },

  async deleteEvent(id){if(!confirm('למחוק אירוע?'))return;await DB.delEvent(id);Stages.closeModal();Utils.toast('נמחק','success');Calendar.updateNotification();Calendar.render();},

  // ===== CREATE FROM CANDIDATE with auto-duration =====
  async createFromCandidate(candidateId,stageName,date,time,stageId){
    var c=await DB.getCandidate(candidateId);if(!c)return;
    var duration=Calendar.STAGE_DURATIONS[stageId]||60;
    var isDayTitle=(duration===null);

    var ev={
      title:stageName+' — '+c.name,
      date:date||Calendar._dateStr(new Date()),
      dayTitle:isDayTitle,
      time:isDayTitle?'':time||'09:00',
      timeEnd:isDayTitle?'':Calendar._addMin(time||'09:00',duration||60),
      candidateName:c.name,
      candidateId:candidateId,
      participants:Sync._currentRecruiter||'',
      room:'',
      attendance:'none',
      reminderMin:15,
      color:'#4A90D9',
      notes:'טלפון: '+c.phone,
      createdBy:Sync._currentRecruiter||''
    };
    if(!isDayTitle&&ev.reminderMin>0){
      var dt=new Date(ev.date+'T'+ev.time);
      ev.reminderAt=new Date(dt.getTime()-ev.reminderMin*60000).toISOString();
    }
    await DB.saveEvent(ev);DB.logAction('אירוע ביומן',ev.title);
    Calendar.updateNotification();
    Utils.toast('נוסף ליומן: '+(isDayTitle?'כותרת יום':''+ev.time+'-'+ev.timeEnd),'success');
  },

  // ===== ICS EXPORT =====
  async exportEventIcs(id){
    var ev=await DB.getEvent(id);if(!ev)return;
    var start=Calendar._toIcsDate(ev.date,ev.time||'09:00');
    var end=Calendar._toIcsDate(ev.date,ev.timeEnd||Calendar._addMin(ev.time||'09:00',60));
    var ics='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//MiniGenius//Calendar//HE\r\nBEGIN:VEVENT\r\n'
    +'UID:mg-'+ev.id+'@minigenius\r\nDTSTART:'+start+'\r\nDTEND:'+end+'\r\n'
    +'SUMMARY:'+Calendar._icsEsc(ev.title)+'\r\n';
    if(ev.room)ics+='LOCATION:'+Calendar._icsEsc(ev.room)+'\r\n';
    var desc=[];
    if(ev.candidateName)desc.push('מועמד: '+ev.candidateName);
    if(ev.participants)desc.push('משתתפים: '+ev.participants);
    if(ev.notes)desc.push(ev.notes);
    if(desc.length)ics+='DESCRIPTION:'+Calendar._icsEsc(desc.join('. '))+'\r\n';
    if(ev.reminderMin)ics+='BEGIN:VALARM\r\nTRIGGER:-PT'+ev.reminderMin+'M\r\nACTION:DISPLAY\r\nDESCRIPTION:reminder\r\nEND:VALARM\r\n';
    ics+='END:VEVENT\r\nEND:VCALENDAR';
    var fn=(ev.title||'event').replace(/[^א-תa-zA-Z0-9]/g,'_').substring(0,25)+'.ics';
    Utils.writeToCacheAndShare(fn,ics,'text/calendar',ev.title);
  },

  // ===== ICS IMPORT =====
  importIcs:function(){Utils.id('icsImportFile')?.click();},
  _processIcsImport:function(input){
    if(!input.files||!input.files[0])return;
    var reader=new FileReader();
    reader.onload=function(e){
      var events=Calendar._parseIcs(e.target.result);
      if(!events.length){Utils.toast('לא נמצאו אירועים','danger');return;}
      Calendar._pendingIcs=events;
      var html='<div class="modal-title">📥 ייבוא '+events.length+' אירועים</div>';
      events.slice(0,10).forEach(function(ev){
        html+='<div class="card" style="padding:8px;"><strong>'+Utils.escHtml(ev.title||'?')+'</strong>'
        +'<div class="card-meta">'+(ev.date||'')+' '+(ev.time||'')+'</div></div>';
      });
      if(events.length>10)html+='<div class="card-meta">+עוד '+(events.length-10)+'</div>';
      html+='<div style="display:flex;gap:8px;margin-top:12px;">'
      +'<button class="btn btn-primary" style="flex:1;" onclick="Calendar._doIcsImport()">✅ ייבא</button>'
      +'<button class="btn btn-outline" style="flex:1;" onclick="Stages.closeModal()">ביטול</button></div>';
      Stages.showModal(html);
    };reader.readAsText(input.files[0],'UTF-8');
  },
  _pendingIcs:[],
  async _doIcsImport(){
    for(var i=0;i<Calendar._pendingIcs.length;i++){
      var ev=Calendar._pendingIcs[i];ev.reminderMin=15;ev.color='#4A90D9';ev.attendance='none';
      await DB.saveEvent(ev);
    }
    Stages.closeModal();Utils.toast('יובאו '+Calendar._pendingIcs.length+' אירועים','success');Calendar.updateNotification();Calendar.render();
  },

  _parseIcs:function(text){
    var events=[];var cur=null;
    text.split(/\r?\n/).forEach(function(line){
      line=line.trim();
      if(line==='BEGIN:VEVENT')cur={};
      else if(line==='END:VEVENT'&&cur){events.push(cur);cur=null;}
      else if(cur){
        var m=line.match(/^([^:;]+)[;:](.*)$/);if(!m)return;
        var key=m[1].split(';')[0];var val=m[2];
        if(key==='SUMMARY')cur.title=val;
        if(key==='DTSTART'){var d=Calendar._parseIcsDate(val);if(d){cur.date=d.date;cur.time=d.time;}}
        if(key==='DTEND'){var d=Calendar._parseIcsDate(val);if(d)cur.timeEnd=d.time;}
        if(key==='LOCATION')cur.room=val;
        if(key==='DESCRIPTION')cur.notes=val;
      }
    });return events;
  },

  // ===== REMINDERS with popup + beep =====
  _activeAlarms:{},
  _checkReminders:function(){
    var now=new Date().toISOString();
    DB.getAllEvents().then(function(events){
      events.forEach(function(ev){
        if(!ev.reminderAt||ev.reminderFired)return;
        // Only fire if NOW is between reminderAt and event start time
        var eventTime=ev.date+'T'+(ev.time||'23:59');
        if(ev.reminderAt<=now&&now<=eventTime){
          ev.reminderFired=true;ev.reminderShownAt=now;
          DB.saveEvent(ev);
          Calendar._showAlarmPopup(ev);
        }else if(now>eventTime){
          // Event already passed — mark as fired silently
          ev.reminderFired=true;DB.saveEvent(ev);
        }
      });
    });
  },

  _showAlarmPopup:function(ev){
    var msg=ev.title;if(ev.time)msg+=' ב-'+ev.time;if(ev.candidateName)msg+=' ('+ev.candidateName+')';
    if(ev.room)msg+=' | '+ev.room;
    // Create persistent overlay
    var overlay=document.createElement('div');
    overlay.id='alarm_'+ev.id;
    overlay.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.innerHTML='<div style="background:#fff;border-radius:16px;padding:24px;max-width:340px;width:100%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.3);direction:rtl;">'
    +'<div style="font-size:2rem;margin-bottom:8px;">🔔</div>'
    +'<div style="font-size:1.1rem;font-weight:700;margin-bottom:12px;color:#1B2A4A;">תזכורת</div>'
    +'<div style="font-size:.95rem;margin-bottom:16px;line-height:1.5;">'+Utils.escHtml(msg)+'</div>'
    +'<button onclick="Calendar._dismissAlarm(\''+ev.id+'\')" style="background:#4A90D9;color:#fff;border:none;padding:12px 32px;border-radius:10px;font-size:1rem;font-weight:700;cursor:pointer;">✓ הבנתי</button>'
    +'</div>';
    document.body.appendChild(overlay);
    Calendar._activeAlarms[ev.id]={overlay:overlay,beeped:false};
    // After 60 seconds, play beep if not dismissed
    setTimeout(function(){
      if(Calendar._activeAlarms[ev.id]&&!Calendar._activeAlarms[ev.id].beeped){
        Calendar._activeAlarms[ev.id].beeped=true;
        Calendar._playBeep();
      }
    },60000);
  },

  _dismissAlarm:function(id){
    var alarm=Calendar._activeAlarms[id];
    if(alarm&&alarm.overlay&&alarm.overlay.parentNode){
      alarm.overlay.parentNode.removeChild(alarm.overlay);
    }
    delete Calendar._activeAlarms[id];
  },

  _playBeep:function(){
    try{
      var ctx=new (window.AudioContext||window.webkitAudioContext)();
      var osc=ctx.createOscillator();var gain=ctx.createGain();
      osc.connect(gain);gain.connect(ctx.destination);
      osc.frequency.value=880;osc.type='sine';
      gain.gain.value=0.3;
      osc.start();
      // 3 short beeps
      setTimeout(function(){gain.gain.value=0;},200);
      setTimeout(function(){gain.gain.value=0.3;},400);
      setTimeout(function(){gain.gain.value=0;},600);
      setTimeout(function(){gain.gain.value=0.3;},800);
      setTimeout(function(){osc.stop();ctx.close();},1000);
    }catch(e){_dbg('Beep err: '+e);}
  },

  // ===== HELPERS =====
  _dateStr:function(d){var y=d.getFullYear();var m=('0'+(d.getMonth()+1)).slice(-2);var dd=('0'+d.getDate()).slice(-2);return y+'-'+m+'-'+dd;},
  _eventInHour:function(ev,h){if(!ev.time)return false;return parseInt(ev.time.split(':')[0])===h;},
  _detectOverlap:function(events){
    if(events.length<2)return false;
    for(var i=0;i<events.length;i++){
      for(var j=i+1;j<events.length;j++){
        var a=events[i],b=events[j];
        if(!a.time||!b.time)continue;
        var aS=a.time,aE=a.timeEnd||Calendar._addMin(a.time,30);
        var bS=b.time,bE=b.timeEnd||Calendar._addMin(b.time,30);
        if(aS<bE&&bS<aE)return true;
      }
    }return false;
  },
  _findOverlaps:function(events){
    var map={};
    for(var i=0;i<events.length;i++){
      for(var j=i+1;j<events.length;j++){
        var a=events[i],b=events[j];
        if(!a.time||!b.time)continue;
        var aS=a.time,aE=a.timeEnd||Calendar._addMin(a.time,30);
        var bS=b.time,bE=b.timeEnd||Calendar._addMin(b.time,30);
        if(aS<bE&&bS<aE){map[a.id]=true;map[b.id]=true;}
      }
    }return map;
  },
  _addMin:function(t,m){var p=t.split(':');var h=parseInt(p[0]);var mi=parseInt(p[1]||0)+m;while(mi>=60){h++;mi-=60;}return('0'+h).slice(-2)+':'+('0'+mi).slice(-2);},
  _getWeekNumber:function(d){var o=new Date(d.getFullYear(),0,1);return Math.ceil(((d-o)/864e5+o.getDay()+1)/7);},
  _toIcsDate:function(d,t){return d.replace(/-/g,'')+'T'+(t||'09:00').replace(':','')+'00';},
  _parseIcsDate:function(v){var m=v.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);return m?{date:m[1]+'-'+m[2]+'-'+m[3],time:m[4]+':'+m[5]}:null;},
  _icsEsc:function(s){return(s||'').replace(/[,;\\]/g,function(c){return'\\'+c;}).replace(/\n/g,'\\n');},

  // ===== LOCK SCREEN NOTIFICATION via custom plugin =====
  async updateNotification(){
    var todayStr=Calendar._dateStr(new Date());
    var events=await DB.getEventsByDate(todayStr);
    var timed=events.filter(function(ev){return!ev.dayTitle&&ev.time;});
    timed.sort(function(a,b){return(a.time||'').localeCompare(b.time||'');});

    if(!window.MGNotification){_dbg('MGNotification plugin not available');return;}

    if(!timed.length){
      MGNotification.clear();
      return;
    }

    var title='📅 היום — '+timed.length+' אירועים';
    var dayTitles=events.filter(function(ev){return ev.dayTitle;});
    if(dayTitles.length)title+=' | '+dayTitles.map(function(ev){return ev.title;}).join(', ');

    var lines=[];
    timed.forEach(function(ev){
      var line=ev.time;
      if(ev.timeEnd)line+='–'+ev.timeEnd;
      line+=' '+ev.title;
      if(ev.candidateName)line+=' ('+ev.candidateName+')';
      if(ev.room)line+=' 📍'+ev.room;
      lines.push(line);
    });

    MGNotification.show(title,lines.join('\n'));
    _dbg('Lock screen notification: '+timed.length+' events');
  },

  // Start periodic notification updates
  _startNotificationUpdates:function(){
    // Update immediately
    Calendar.updateNotification();
    // Update every 5 minutes
    setInterval(function(){Calendar.updateNotification();},5*60*1000);
  }
};
