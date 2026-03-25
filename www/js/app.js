'use strict';
const App={
  currentJob:null,currentStage:1,settings:{},_dirty:{},_saveTimer:null,

  async init(){
    setTimeout(function(){var sp=Utils.id('splashScreen');if(sp)sp.classList.add('hide');
      setTimeout(function(){if(sp)sp.remove();},600);},2500);
    _dbg('App.init start');
    await DB.init();await DB.initDefaults();
    this.settings=await DB.getAllSettings();
    _dbg('DB ready, settings loaded');
    this.checkFrozenCandidates();
    // v2.8: Set currentJob BEFORE rendering UI
    var jobs=await DB.getAllJobs();
    var activeId=this.settings.activeJobId;
    if(activeId){this.currentJob=activeId;}
    else if(jobs.length){this.currentJob=jobs[0].id;await DB.setSetting('activeJobId',this.currentJob);}
    this.setupRouting();this.renderJobLabel();this.renderTabs();this.setupFAB();
    var recruiters=JSON.parse(this.settings.recruiters||'[]');
    if(!recruiters.length){this.navigate('admin');Utils.toast('הגדר רכזים תחילה','warning');}
    else{
      this.navigate('stage',1);
    }
    Tasks.carryOverTasks();
    // v2.7 #9: Show opening screen after splash
    setTimeout(function(){App.showOpeningScreen()},3000);

    // FIX #4: Auto-save every 10 seconds (backup) + immediate on pause/visibility
    setInterval(function(){App.flushDirty()},10000);

    // v2.6: Auto-backup to settings every 60 seconds (crash protection)
    setInterval(function(){App.autoBackup()},60000);
    // Initial backup after load
    setTimeout(function(){App.autoBackup()},5000);

    // Save when app goes to background (WhatsApp, phone call, etc.)
    document.addEventListener('pause',function(){
      _dbg('APP PAUSE — flushing + backup');App.flushDirty();App.autoBackup();
    },false);
    document.addEventListener('resume',function(){
      _dbg('APP RESUME');
    },false);
    // Also handle browser visibility change
    document.addEventListener('visibilitychange',function(){
      if(document.hidden){_dbg('HIDDEN — flushing');App.flushDirty();}
    },false);
    // Save before page unload
    window.addEventListener('beforeunload',function(){App.flushDirty();});

    _dbg('App.init done');
  },

  // FIX #4: Mark field dirty + debounced save (500ms)
  markDirty(cid,field,val){
    if(!this._dirty[cid])this._dirty[cid]={};
    this._dirty[cid][field]=val;
    // Debounce: save 500ms after last change
    if(this._saveTimer)clearTimeout(this._saveTimer);
    this._saveTimer=setTimeout(function(){App.flushDirty()},500);
  },
  async flushDirty(){
    if(this._saveTimer){clearTimeout(this._saveTimer);this._saveTimer=null;}
    var keys=Object.keys(this._dirty);
    if(!keys.length)return;
    var snapshot=Object.assign({},this._dirty);
    this._dirty={};
    for(var i=0;i<keys.length;i++){
      var cid=keys[i];
      try{
        var c=await DB.getCandidate(cid);if(!c)continue;
        for(var f in snapshot[cid]){c[f]=snapshot[cid][f];}
        await DB.saveCandidate(c);
      }catch(e){_dbg('flushDirty err for '+cid+': '+e);}
    }
  },

  // v2.6: Auto-backup candidate count to detect data loss
  async autoBackup(){
    try{
      var all=await DB.getAllCandidates();
      var jobs=await DB.getAllJobs();
      var count=all.length;
      var prev=await DB.getSetting('_backupCount');
      if(prev&&parseInt(prev)>count+2&&count===0){
        _dbg('⚠️ DATA LOSS DETECTED: had '+prev+' candidates, now '+count);
        // Don't overwrite — keep old backup count
        return;
      }
      await DB.setSetting('_backupCount',String(count));
      await DB.setSetting('_backupDate',new Date().toISOString());
      _dbg('Auto-backup: '+count+' candidates, '+jobs.length+' jobs');
    }catch(e){_dbg('autoBackup err: '+e);}
  },

  async checkFrozenCandidates(){
    var all=await DB.getAllCandidates();var today=Utils.today();
    for(var i=0;i<all.length;i++){var c=all[i];
      if(c.status==='frozen'&&c.freezeEndDate&&c.freezeEndDate<=today){
        Utils.toast('⚡ '+c.name+' - סיום הקפאה!','warning');
      }
    }
  },

  renderJobLabel(){
    var el=Utils.id('jobLabel');if(!el)return;
    DB.getAllJobs().then(function(jobs){
      var active=jobs.find(function(j){return j.id===App.currentJob});
      el.textContent=active?active.name:'לא נבחר מחזור';
    });
  },

  setupRouting(){window.addEventListener('hashchange',function(){App.flushDirty();App.handleRoute()})},
  navigate(page,param){
    this.flushDirty();
    if(page==='stage')location.hash='#stage/'+param;
    else if(page==='candidate')location.hash='#candidate/'+param;
    else if(page==='dashboard')location.hash='#dashboard';
    else if(page==='tasks')location.hash='#tasks';
    else if(page==='daysummary')location.hash='#daysummary';
    else if(page==='admin')location.hash='#admin';
    else location.hash='#'+page;
  },

  handleRoute(){
    var hash=location.hash.replace('#','');var parts=hash.split('/');
    _dbg('Route: '+hash);
    if(parts[0]==='stage'){var s=parseInt(parts[1])||1;this.currentStage=s;this.renderStageList(s);}
    else if(parts[0]==='candidate'){this.renderCandidateView(parts[1]);}
    else if(parts[0]==='dashboard'){Dashboard.render(this.currentStage);}
    else if(parts[0]==='tasks'){Tasks.render(this.currentStage);}
    else if(parts[0]==='daysummary'){DaySummary.render();}
    else if(parts[0]==='admin'){Admin.render();}
    else{this.renderStageList(this.currentStage);}
    this.updateTabHighlight();
  },

  renderTabs(){
    var bar=Utils.id('tabBar');if(!bar)return;
    var html='';
    Utils.STAGES.forEach(function(s){
      html+='<div class="tab" data-stage="'+s.id+'" onclick="App.navigate(\'stage\','+s.id+')">'
      +'<span class="icon">'+s.icon+'</span>'
      +'<span id="tabBadge'+s.id+'"></span>'
      +s.name+'</div>';
    });
    bar.innerHTML=html;this.updateBadges();
  },

  async updateBadges(){
    for(var i=1;i<=7;i++){
      var cands=await DB.getByStage(i,this.currentJob);
      var active=cands.filter(function(c){return c.status==='active'}).length;
      var el=Utils.id('tabBadge'+i);
      if(el)el.innerHTML=active?'<span class="badge">'+active+'</span>':'';
    }
  },

  updateTabHighlight(){
    var tabs=document.querySelectorAll('.tab');
    tabs.forEach(function(t){t.classList.remove('active');
      if(parseInt(t.dataset.stage)===App.currentStage)t.classList.add('active');
    });
  },

  async renderStageList(stageId){
    var stage=Utils.getStage(stageId);if(!stage)return;
    var cands=await DB.getByStage(stageId,this.currentJob);
    var active=cands.filter(function(c){return c.status!=='stopped'&&c.status!=='frozen'});
    active.sort(function(a,b){var pa={high:0,medium:1,low:2};return(pa[a.priority]||1)-(pa[b.priority]||1);});
    var page=Utils.id('mainContent');
    var html='<div class="page active">';
    // v3.1 #4: Global search
    html+='<div style="padding:10px 14px;"><div class="search-bar">'
    +'<input class="form-input" id="stageSearch" placeholder="חפש מועמד בכל השלבים (שם או טלפון)..." oninput="App.globalSearch(this.value)" style="padding-right:14px;">'
    +'</div></div>';
    if(!active.length){
      html+='<div class="empty-state"><div class="icon">💭</div>'
      +'<div>אין מועמדים בשלב זה</div></div>';
    }else{
      html+='<div id="candidateList">';
      active.forEach(function(c){
        var ad=parseInt(App.settings['alertDaysStage'+stageId])||5;
        var days=Utils.workDaysSince(c.stageEnteredAt||c.updatedAt);var delayed=days>=ad;
        // v3.1 #3: Build grade summary
        var gradeSummary='';
        for(var si=1;si<stageId;si++){
          var g=c['stage'+si+'_grade'];
          if(g)gradeSummary+=(gradeSummary?' | ':'')+Utils.getStage(si).icon+g+'/7';
        }
        var notesTrim=(c.notes||'').substring(0,40);
        html+='<div class="card priority-'+c.priority+'" data-name="'+Utils.escHtml(c.name)+'" data-phone="'+Utils.escHtml(c.phone)+'">'
        +'<div class="card-header" onclick="App.navigate(\'candidate\',\''+c.id+'\')">'
        +'<span class="card-name">'+Utils.escHtml(c.name)+(c.recommendation?(' '+Utils.REC_ICONS[c.recommendation]):'')+'</span>'
        +'<span class="status-badge status-'+c.status+'">'+Utils.STATUSES[c.status]+'</span></div>'
        +'<div onclick="App.navigate(\'candidate\',\''+c.id+'\')">'
        +'<div class="card-meta">'+Utils.escHtml(c.phone)+' | '+days+' ימי עבודה'
        +(delayed?' | <span style="color:var(--danger);">בעיכוב!</span>':'')+'</div>';
        if(gradeSummary)html+='<div class="card-meta" style="color:var(--primary);">ציונים: '+gradeSummary+'</div>';
        if(notesTrim)html+='<div class="card-meta">📝 '+Utils.escHtml(notesTrim)+(c.notes.length>40?'...':'')+'</div>';
        html+='</div>'
        +'<div style="display:flex;justify-content:flex-end;padding-top:6px;border-top:1px solid var(--border);margin-top:8px;">'
        +'<button class="btn btn-outline btn-sm" style="font-size:.78rem;padding:5px 10px;" onclick="event.stopPropagation();App.editCandidate(\''+c.id+'\')">✏️ עריכה</button>'
        +'</div></div>';
      });
      html+='</div>';
    }
    // v3.1 #4: Global search results area
    html+='<div id="globalSearchResults" style="display:none;"></div>';
    html+='</div>';page.innerHTML=html;this.updateBadges();
    Tasks.renderInline(stageId);
  },

  // v3.1 #4: Global search across ALL stages
  async globalSearch(q){
    q=q.trim().toLowerCase();
    var listEl=Utils.id('candidateList');
    var resultsEl=Utils.id('globalSearchResults');
    if(!q||q.length<2){
      if(listEl)listEl.style.display='';
      if(resultsEl)resultsEl.style.display='none';
      return;
    }
    if(listEl)listEl.style.display='none';
    if(!resultsEl)return;
    var all=await DB.getAllCandidates();
    var matches=all.filter(function(c){
      return(c.jobId===App.currentJob)&&(
        (c.name||'').toLowerCase().includes(q)||
        (c.phone||'').includes(q)
      );
    });
    if(!matches.length){
      resultsEl.innerHTML='<div class="empty-state" style="padding:20px;"><div>לא נמצאו תוצאות</div></div>';
      resultsEl.style.display='block';return;
    }
    var html='<div style="padding:6px 14px;font-size:.82rem;color:var(--text-light);">'+matches.length+' תוצאות בכל השלבים</div>';
    matches.forEach(function(c){
      html+='<div class="card" onclick="App.navigate(\'candidate\',\''+c.id+'\')">'
      +'<div class="card-header"><span class="card-name">'+Utils.escHtml(c.name)+'</span>'
      +'<span class="status-badge status-'+c.status+'">'+Utils.STATUSES[c.status]+'</span></div>'
      +'<div class="card-meta">'+Utils.escHtml(c.phone)+' | '+Utils.getStageName(c.stage)+'</div></div>';
    });
    resultsEl.innerHTML=html;resultsEl.style.display='block';
  },

  async renderCandidateView(id){
    await this.flushDirty();
    var c=await DB.getCandidate(id);if(!c){Utils.toast('לא נמצא','danger');return;}
    var page=Utils.id('mainContent');
    var html='<div class="page active"><div style="display:flex;align-items:center;gap:10px;padding:14px;">'
    +'<button class="btn btn-outline btn-sm" onclick="App.navigate(\'stage\','+c.stage+')">←</button>'
    +'<div style="flex:1;"><div style="font-size:1.15rem;font-weight:700;">'+Utils.escHtml(c.name)+(c.recommendation?(' '+Utils.REC_ICONS[c.recommendation]):'')+'</div>'
    +'<div class="card-meta">'+Utils.escHtml(c.phone)+' | '+Utils.getStageName(c.stage)
    +(c.recommendation?' | '+Utils.REC_LABELS[c.recommendation]:'')+'</div></div>'
    +'<span class="status-badge status-'+c.status+'">'+Utils.STATUSES[c.status]+'</span></div>';
    html+='<div style="display:flex;gap:6px;padding:0 14px;flex-wrap:wrap;">'
    +'<button class="btn btn-call btn-sm" onclick="Utils.openDialer(\''+c.phone+'\')">📞 התקשר</button>'
    +'<button class="btn btn-wa btn-sm" onclick="Stages.sendWhatsApp('+c.stage+',\''+c.id+'\')">📱 וואצאפ</button>';
    if(c.stage<=2)html+='<button class="btn btn-purple btn-sm" onclick="Stages.freezeCandidate(\''+c.id+'\')">❄️ הקפאה</button>';
    html+='<button class="btn btn-danger btn-sm" onclick="Stages.stopProcess(\''+c.id+'\')">⛔ הפסק</button>';
    html+='</div>';
    if(c.stage===1)html+=Stage1.renderDetail(c);
    else if(c.stage===2)html+=Stage2.renderDetail(c);
    else if(c.stage===3)html+=Stage3.renderDetail(c);
    else html+=Stages.renderGenericDetail(c);
    html+='</div>';page.innerHTML=html;
  },

  // v3.0: Edit candidate modal — view/edit data + move between stages + delete
  async editCandidate(id){
    await this.flushDirty();
    var c=await DB.getCandidate(id);if(!c){Utils.toast('לא נמצא','danger');return;}
    var html='<div class="modal-title">✏️ עריכת מועמד</div>';
    html+='<div class="form-group"><label class="form-label">שם</label>'
    +'<input class="form-input" id="editName" value="'+Utils.escHtml(c.name)+'"></div>';
    html+='<div class="form-group"><label class="form-label">טלפון</label>'
    +'<input class="form-input" id="editPhone" type="tel" dir="ltr" value="'+Utils.escHtml(c.phone)+'"></div>';
    html+='<div class="form-group"><label class="form-label">ממליץ / רכז מפנה</label>'
    +'<input class="form-input" id="editReferrer" value="'+Utils.escHtml(c.referrer||'')+'"></div>';
    html+='<div class="form-group"><label class="form-label">הערות</label>'
    +'<textarea class="form-textarea" id="editNotes" rows="2">'+Utils.escHtml(c.notes||'')+'</textarea></div>';
    if(c.cvFileName)html+='<div class="info-box">📎 קו"ח: '+Utils.escHtml(c.cvFileName)+'</div>';
    var recs=JSON.parse(App.settings.recruiters||'[]');
    html+='<div class="form-group"><label class="form-label">רכז מטפל</label>'
    +'<select class="form-select" id="editRecruiter">';
    recs.forEach(function(r){html+='<option value="'+r+'"'+(r===c.recruiter?' selected':'')+'>'+r+'</option>';});
    html+='</select></div>';
    html+='<div class="form-group"><label class="form-label">עדיפות</label><div class="radio-group" id="editPriority">'
    +'<div class="radio-btn '+(c.priority==='high'?'active':'')+'" data-val="high" onclick="App._editPri(this)">🔴 גבוה</div>'
    +'<div class="radio-btn '+(c.priority==='medium'?'active':'')+'" data-val="medium" onclick="App._editPri(this)">🟠 בינוני</div>'
    +'<div class="radio-btn '+(c.priority==='low'?'active':'')+'" data-val="low" onclick="App._editPri(this)">🟢 נמוך</div>'
    +'</div></div>';
    html+='<div class="form-group"><label class="form-label">העבר לתחנה</label>'
    +'<select class="form-select" id="editStage">';
    Utils.STAGES.forEach(function(s){
      html+='<option value="'+s.id+'"'+(s.id===c.stage?' selected':'')+'>'+s.icon+' '+s.name+'</option>';
    });
    html+='</select></div>';
    // v3.0: Recommendation tag
    var rec=c.recommendation||'';
    html+='<div class="form-group"><label class="form-label">המלצה</label><div class="radio-group" id="editRec">'
    +'<div class="radio-btn '+(rec===''?'active':'')+'" data-val="" onclick="App._editRec(this)">ללא</div>'
    +'<div class="radio-btn '+(rec==='recommended'?'active':'')+'" data-val="recommended" onclick="App._editRec(this)">⭐ מומלצים</div>'
    +'<div class="radio-btn '+(rec==='unit'?'active':'')+'" data-val="unit" onclick="App._editRec(this)">🥈 מומלצי יחידה</div>'
    +'<div class="radio-btn '+(rec==='eitan'?'active':'')+'" data-val="eitan" onclick="App._editRec(this)">🥇 מומלצי איתן</div>'
    +'</div></div>';
    html+='<div style="display:flex;gap:8px;margin-top:16px;">'
    +'<button class="btn btn-primary" style="flex:1;" onclick="App.saveEdit(\''+c.id+'\')">💾 שמור</button>'
    +'<button class="btn btn-outline" style="flex:1;" onclick="Stages.closeModal()">ביטול</button></div>'
    +'<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">'
    +'<button class="btn btn-danger" style="width:100%;" onclick="App.deleteCandidate(\''+c.id+'\',\''+Utils.escHtml(c.name)+'\')">🗑 מחק מועמד</button></div>';
    Stages.showModal(html);
  },
  _editPri(el){el.parentElement.querySelectorAll('.radio-btn').forEach(function(b){b.classList.remove('active')});el.classList.add('active');},
  _editRec(el){el.parentElement.querySelectorAll('.radio-btn').forEach(function(b){b.classList.remove('active')});el.classList.add('active');},
  async saveEdit(id){
    var c=await DB.getCandidate(id);if(!c)return;
    c.name=Utils.id('editName')?.value?.trim()||c.name;
    c.phone=Utils.id('editPhone')?.value?.trim()||c.phone;
    c.referrer=Utils.id('editReferrer')?.value||'';
    c.notes=Utils.id('editNotes')?.value||'';
    c.recruiter=Utils.id('editRecruiter')?.value||c.recruiter;
    var priEl=document.querySelector('#editPriority .radio-btn.active');
    if(priEl)c.priority=priEl.dataset.val;
    // v3.0: Save recommendation
    var recEl=document.querySelector('#editRec .radio-btn.active');
    if(recEl)c.recommendation=recEl.dataset.val||'';
    if(c.recommendation&&!c.recommendedAt)c.recommendedAt=new Date().toISOString();
    var newStage=parseInt(Utils.id('editStage')?.value);
    if(newStage&&newStage!==c.stage){
      var oldStage=c.stage;
      c.stage=newStage;c.status='active';c.stageEnteredAt=new Date().toISOString();
      DB.logAction('העברה',c.name+' '+Utils.getStageName(oldStage)+' → '+Utils.getStageName(newStage));
    }
    await DB.saveCandidate(c);
    Stages.closeModal();Utils.toast('מועמד עודכן','success');this.renderStageList(this.currentStage);
  },
  async deleteCandidate(id,name){
    if(!confirm('למחוק את המועמד '+name+'?\nכל הנתונים יימחקו לצמיתות.'))return;
    await DB.del('candidates',id);
    try{var files=await DB.getAll('files');
    for(var i=0;i<files.length;i++){if(files[i].candidateId===id)await DB.del('files',files[i].id);}
    }catch(e){_dbg('Delete files err: '+e);}
    DB.logAction('מחיקה',name);
    Stages.closeModal();Utils.toast(name+' נמחק','success');this.renderStageList(this.currentStage);
  },

  // v3.0: Recommendations report
  async showRecommendationsReport(){
    var all=await DB.getAllCandidates();
    var recommended=all.filter(function(c){return c.recommendation&&c.recommendation!=='';});
    // Group by type
    var groups={eitan:[],unit:[],recommended:[]};
    recommended.forEach(function(c){
      if(groups[c.recommendation])groups[c.recommendation].push(c);
    });

    var page=Utils.id('mainContent');
    var html='<div class="page active"><div style="display:flex;align-items:center;gap:10px;padding:14px;">'
    +'<button class="btn btn-outline btn-sm" onclick="App.navigate(\'stage\','+App.currentStage+')">←</button>'
    +'<div style="flex:1;font-size:1.15rem;font-weight:700;">⭐ דוח מומלצים</div>'
    +'<button class="btn btn-outline btn-sm" onclick="App.exportRecommendationsReport()">📤 ייצוא</button></div>';

    if(!recommended.length){
      html+='<div class="empty-state"><div class="icon">⭐</div><div>אין מועמדים מומלצים</div></div>';
    }else{
      // KPIs
      html+='<div class="kpi-row" style="margin:12px 14px;">'
      +'<div class="kpi"><div class="kpi-value" style="color:#FFD700;">'+groups.eitan.length+'</div><div class="kpi-label">🥇 מומלצי איתן</div></div>'
      +'<div class="kpi"><div class="kpi-value" style="color:#C0C0C0;">'+groups.unit.length+'</div><div class="kpi-label">🥈 מומלצי יחידה</div></div>'
      +'<div class="kpi"><div class="kpi-value" style="color:#B8860B;">'+groups.recommended.length+'</div><div class="kpi-label">⭐ מומלצים</div></div>'
      +'</div>';

      // Render each group
      var order=[{key:'eitan',icon:'🥇',label:'מומלצי איתן',color:'#FFD700'},
                 {key:'unit',icon:'🥈',label:'מומלצי יחידה',color:'#C0C0C0'},
                 {key:'recommended',icon:'⭐',label:'מומלצים',color:'#B8860B'}];
      order.forEach(function(g){
        if(!groups[g.key].length)return;
        html+='<div class="section-title" style="border-color:'+g.color+';">'+g.icon+' '+g.label+' ('+groups[g.key].length+')</div>';
        groups[g.key].forEach(function(c){
          var stageName=Utils.getStageName(c.stage);
          var status=Utils.STATUSES[c.status]||c.status;
          var handled=c.recommendedAt?Utils.formatDate(c.recommendedAt):(c.createdAt?Utils.formatDate(c.createdAt):'-');
          html+='<div class="card" onclick="App.navigate(\'candidate\',\''+c.id+'\')">'
          +'<div class="card-header"><span class="card-name">'+g.icon+' '+Utils.escHtml(c.name)+'</span>'
          +'<span class="status-badge status-'+c.status+'">'+status+'</span></div>'
          +'<div class="card-meta">📱 '+Utils.escHtml(c.phone)+' | '+stageName+'</div>'
          +'<div class="card-meta">ממליץ: '+(c.referrer||'-')+' | רכז: '+(c.recruiter||'-')+'</div>'
          +'<div class="card-meta">סומן: '+handled+' | עדכון: '+Utils.formatDate(c.updatedAt)+'</div>'
          +'</div>';
        });
      });
    }
    html+='</div>';page.innerHTML=html;
  },

  // Export recommendations as HTML
  async exportRecommendationsReport(){
    var all=await DB.getAllCandidates();
    var recommended=all.filter(function(c){return c.recommendation&&c.recommendation!=='';});
    var groups={eitan:[],unit:[],recommended:[]};
    recommended.forEach(function(c){if(groups[c.recommendation])groups[c.recommendation].push(c);});

    var html='<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><style>'
    +'body{font-family:Arial;direction:rtl;padding:20px}h1{color:#1B2A4A}h2{margin-top:24px;padding-bottom:6px;border-bottom:2px solid #ddd}'
    +'table{width:100%;border-collapse:collapse;margin:10px 0}th,td{border:1px solid #ddd;padding:8px;text-align:right;font-size:14px}'
    +'th{background:#1B2A4A;color:#fff}.gold{color:#FFD700}.silver{color:#C0C0C0}.bronze{color:#B8860B}'
    +'</style></head><body><h1>⭐ דוח מומלצים — Mini Genius</h1>'
    +'<p>תאריך: '+Utils.formatDate(new Date().toISOString())+'</p>';

    var order=[{key:'eitan',icon:'🥇',label:'מומלצי איתן'},
               {key:'unit',icon:'🥈',label:'מומלצי יחידה'},
               {key:'recommended',icon:'⭐',label:'מומלצים'}];
    order.forEach(function(g){
      if(!groups[g.key].length)return;
      html+='<h2>'+g.icon+' '+g.label+' ('+groups[g.key].length+')</h2>'
      +'<table><tr><th>שם</th><th>טלפון</th><th>תחנה</th><th>סטטוס</th><th>ממליץ</th><th>רכז</th><th>סומן</th><th>עדכון</th></tr>';
      groups[g.key].forEach(function(c){
        html+='<tr><td>'+Utils.escHtml(c.name)+'</td><td>'+Utils.escHtml(c.phone)+'</td>'
        +'<td>'+Utils.getStageName(c.stage)+'</td><td>'+Utils.STATUSES[c.status]+'</td>'
        +'<td>'+Utils.escHtml(c.referrer||'-')+'</td><td>'+Utils.escHtml(c.recruiter||'-')+'</td>'
        +'<td>'+(c.recommendedAt?Utils.formatDate(c.recommendedAt):'-')+'</td>'
        +'<td>'+Utils.formatDate(c.updatedAt)+'</td></tr>';
      });
      html+='</table>';
    });
    html+='</body></html>';
    Utils.writeToCacheAndShare('recommendations_'+Utils.today()+'.html',html,'text/html','דוח מומלצים');
  },

  setupFAB(){
    var fab=Utils.id('fab');var menu=Utils.id('fabMenu');
    if(!fab||!menu)return;
    fab.addEventListener('click',function(){fab.classList.toggle('open');menu.classList.toggle('show');});
    document.addEventListener('click',function(e){
      if(!fab.contains(e.target)&&!menu.contains(e.target)){fab.classList.remove('open');menu.classList.remove('show');}
    });
  },

  // v2.7 #9: Opening screen with greeting + task status
  async showOpeningScreen(){
    try{
      var recs=JSON.parse(this.settings.recruiters||'[]');
      var lead=this.settings.leadRecruiter||recs[0]||'מגייס/ת';
      var hour=new Date().getHours();
      var greeting=hour<12?'בוקר טוב':'אחר הצהריים טובים';
      if(hour>=17)greeting='ערב טוב';

      var allTasks=await Tasks.getAllTasksSorted();
      var urgent=allTasks.filter(function(t){return t.urgent&&!t.done});
      var pending=allTasks.filter(function(t){return !t.done&&!t.urgent});
      var total=urgent.length+pending.length;

      var html='<div class="modal-title">'+greeting+', '+Utils.escHtml(lead)+'! 👋</div>';
      if(!total){
        html+='<div class="info-box" style="text-align:center;">🎉 אין משימות ליום — יום מצוין!</div>';
      }else{
        html+='<div style="text-align:center;margin-bottom:12px;font-size:.92rem;color:var(--text-light);">'
        +total+' משימות ליום'+(urgent.length?' ('+urgent.length+' דחופות)':'')+'</div>';
        // Show urgent tasks first, then pending (max 8)
        var shown=urgent.concat(pending).slice(0,8);
        shown.forEach(function(t){
          var cls=t.urgent?'border-right:3px solid var(--danger);':'';
          html+='<div style="padding:8px 10px;background:#f8fafc;border-radius:8px;margin-bottom:6px;font-size:.88rem;'+cls+'">'
          +t.icon+' '+Utils.escHtml(t.text)+'</div>';
        });
        if(allTasks.length>8)html+='<div style="text-align:center;color:var(--text-light);font-size:.82rem;margin-top:6px;">+'+(allTasks.length-8)+' נוספות</div>';
      }
      html+='<button class="btn btn-primary" style="width:100%;margin-top:16px;" onclick="Stages.closeModal()">בואו נתחיל! 💪</button>';
      Stages.showModal(html);
    }catch(e){_dbg('Opening screen err: '+e);}
  }
};

document.addEventListener('deviceready',function(){_dbg('deviceready');App.init();},false);
setTimeout(function(){if(!window.cordova){_dbg('No cordova, init directly');App.init();}},3000);
