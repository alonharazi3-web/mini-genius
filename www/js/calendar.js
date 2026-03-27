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
  },

  // ===== WEEKLY VIEW =====
  async render(){
    var ws=Calendar._weekStart;
    var weekDates=[];
    for(var d=0;d<5;d++){var dt=new Date(ws);dt.setDate(ws.getDate()+d);weekDates.push(dt);}
    var monthStr=weekDates[2].toLocaleDateString('he-IL',{month:'long',year:'numeric'});
    var weekNum=Calendar._getWeekNumber(weekDates[0]);

    var allEvents=[];
    for(var d=0;d<5;d++){
      var dateStr=Calendar._dateStr(weekDates[d]);
      var dayEvents=await DB.getEventsByDate(dateStr);
      dayEvents.forEach(function(ev){ev._dayIdx=d;});
      allEvents=allEvents.concat(dayEvents);
    }

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

    // Grid
    html+='<div style="padding:0 4px;overflow-x:auto;-webkit-overflow-scrolling:touch;">';
    html+='<div style="display:grid;grid-template-columns:36px repeat(5,1fr);min-width:340px;">';

    // Day headers with holiday/title
    html+='<div></div>';
    for(var d=0;d<5;d++){
      var dt=weekDates[d];var dStr=Calendar._dateStr(dt);
      var isToday=dStr===Calendar._dateStr(new Date());
      var holiday=Calendar.HOLIDAYS[dStr]||'';
      // Day titles (events marked as dayTitle)
      var dayTitles=allEvents.filter(function(ev){return ev._dayIdx===d&&ev.dayTitle;});
      var titleText=dayTitles.map(function(ev){return ev.title;}).join(', ');
      if(holiday)titleText=holiday+(titleText?', '+titleText:'');

      html+='<div style="text-align:center;padding:4px 2px;font-size:.65rem;font-weight:700;'
      +'background:'+Calendar._DAY_COLORS[d]+';border-radius:6px 6px 0 0;'
      +(isToday?'border:2px solid var(--accent);':'')
      +'">'+Calendar._DAY_NAMES[d]+'<br><span style="font-size:.8rem;">'+dt.getDate()+'</span>';
      if(titleText)html+='<br><span style="font-size:.55rem;color:#555;font-weight:400;">'+Utils.escHtml(titleText)+'</span>';
      html+='</div>';
    }

    // Hour rows
    for(var h=Calendar._HOURS_START;h<Calendar._HOURS_END;h++){
      html+='<div style="font-size:.6rem;color:var(--text-light);text-align:left;padding:1px 2px 0;height:40px;border-top:1px solid #eee;">'+('0'+h).slice(-2)+'</div>';
      for(var d=0;d<5;d++){
        var cellDate=Calendar._dateStr(weekDates[d]);
        var cellEvents=allEvents.filter(function(ev){return ev._dayIdx===d&&!ev.dayTitle&&Calendar._eventInHour(ev,h);});
        var bgColor=Calendar._DAY_COLORS[d]+'30';
        // Overlap detection
        var hasOverlap=Calendar._detectOverlap(cellEvents);
        html+='<div style="height:40px;border-top:1px solid #eee;border-left:1px solid #f0f0f0;background:'+bgColor+';position:relative;cursor:pointer;'
        +(hasOverlap?'outline:2px solid var(--danger);outline-offset:-2px;':'')
        +'" onclick="Calendar.addEvent(\''+cellDate+'\',\''+('0'+h).slice(-2)+':00\')">';
        cellEvents.forEach(function(ev,ei){
          var evColor=ev.color||'#4A90D9';
          var attend=Calendar.ATTEND[ev.attendance]||'';
          var topOff=ei*14;
          html+='<div onclick="event.stopPropagation();Calendar.viewEvent(\''+ev.id+'\')" style="position:absolute;left:1px;right:1px;top:'+topOff+'px;'
          +'background:'+evColor+';color:#fff;border-radius:3px;padding:1px 3px;font-size:.52rem;overflow:hidden;'
          +'white-space:nowrap;text-overflow:ellipsis;z-index:'+(2+ei)+';cursor:pointer;line-height:1.3;'
          +'opacity:'+(ei>0?'.85':'1')+';">'
          +attend+(ev.time?ev.time.substring(0,5)+' ':'')+Utils.escHtml(ev.title||'')+'</div>';
        });
        html+='</div>';
      }
    }
    html+='</div></div>';

    // Today's events
    var todayStr=Calendar._dateStr(new Date());
    var todayEvents=await DB.getEventsByDate(todayStr);
    todayEvents=todayEvents.filter(function(ev){return!ev.dayTitle;});
    if(todayEvents.length){
      html+='<div style="padding:10px 14px;"><div class="section-title">📌 אירועי היום</div>';
      todayEvents.sort(function(a,b){return(a.time||'').localeCompare(b.time||'');});
      todayEvents.forEach(function(ev){
        var attend=Calendar.ATTEND[ev.attendance]||'';
        html+='<div class="card" onclick="Calendar.viewEvent(\''+ev.id+'\')" style="border-right:4px solid '+(ev.color||'#4A90D9')+';">'
        +'<div style="font-weight:700;font-size:.85rem;">'+attend+(ev.time||'')+' — '+Utils.escHtml(ev.title)+'</div>';
        if(ev.timeEnd)html+='<div class="card-meta">עד '+ev.timeEnd+'</div>';
        if(ev.room)html+='<div class="card-meta">📍 '+Utils.escHtml(ev.room)+'</div>';
        if(ev.participants)html+='<div class="card-meta">👥 '+Utils.escHtml(ev.participants)+'</div>';
        if(ev.candidateName)html+='<div class="card-meta">👤 '+Utils.escHtml(ev.candidateName)+'</div>';
        html+='</div>';
      });
      html+='</div>';
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
    +'<input class="form-input" id="evCandidate" placeholder="שם מועמד"></div>'
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
    Stages.closeModal();Utils.toast('אירוע נשמר','success');Calendar.render();
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

  async deleteEvent(id){if(!confirm('למחוק אירוע?'))return;await DB.delEvent(id);Stages.closeModal();Utils.toast('נמחק','success');Calendar.render();},

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
    Stages.closeModal();Utils.toast('יובאו '+Calendar._pendingIcs.length+' אירועים','success');Calendar.render();
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

  // ===== REMINDERS =====
  _checkReminders:function(){
    var now=new Date().toISOString();
    DB.getAllEvents().then(function(events){
      events.forEach(function(ev){
        if(ev.reminderAt&&!ev.reminderFired&&ev.reminderAt<=now){
          ev.reminderFired=true;DB.saveEvent(ev);
          var msg='🔔 '+ev.title;if(ev.time)msg+=' ב-'+ev.time;if(ev.candidateName)msg+=' ('+ev.candidateName+')';
          Utils.toast(msg,'warning');
        }
      });
    });
  },

  // ===== HELPERS =====
  _dateStr:function(d){return d.toISOString().split('T')[0];},
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
  _addMin:function(t,m){var p=t.split(':');var h=parseInt(p[0]);var mi=parseInt(p[1]||0)+m;while(mi>=60){h++;mi-=60;}return('0'+h).slice(-2)+':'+('0'+mi).slice(-2);},
  _getWeekNumber:function(d){var o=new Date(d.getFullYear(),0,1);return Math.ceil(((d-o)/864e5+o.getDay()+1)/7);},
  _toIcsDate:function(d,t){return d.replace(/-/g,'')+'T'+(t||'09:00').replace(':','')+'00';},
  _parseIcsDate:function(v){var m=v.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);return m?{date:m[1]+'-'+m[2]+'-'+m[3],time:m[4]+':'+m[5]}:null;},
  _icsEsc:function(s){return(s||'').replace(/[,;\\]/g,function(c){return'\\'+c;}).replace(/\n/g,'\\n');}
};
