'use strict';
const App={
  currentJob:null,currentStage:1,settings:{},_dirty:{},_saveTimer:null,

  _PIN:'9832339',
  _unlocked:false,

  async init(){
    // v3.4 #6: PIN lock — once per session only
    if(App._unlocked){App._afterUnlock();return;}
    App._showPinLock();
  },

  async _afterUnlock(){
    App._unlocked=true;
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
    Calendar.init();
    // v3.2: Init sync + show recruiter/sync prompt
    await Sync.init();
    setTimeout(function(){
      // Show opening screen, then check sync
      App.showOpeningScreen();
      setTimeout(function(){
        if(Sync.isSignedIn()&&!Sync._currentRecruiter){
          Sync.showRecruiterSelect();
        }else if(Sync.isSignedIn()){
          Sync._promptStartupSync();
        }
      },3500);
    },3000);

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
      Calendar.updateNotification();
    },false);
    document.addEventListener('visibilitychange',function(){
      if(document.hidden){_dbg('HIDDEN — flushing');App.flushDirty();}
    },false);
    window.addEventListener('beforeunload',function(){App.flushDirty();});
    _dbg('App.init done');
  },

  // v3.4 #6: PIN Lock
  _showPinLock:function(){
    var overlay=document.createElement('div');
    overlay.id='pinOverlay';
    overlay.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:#1B2A4A;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;';
    overlay.innerHTML='<img src="img/icon.png" style="width:80px;height:80px;border-radius:16px;margin-bottom:16px;">'
    +'<div style="color:#fff;font-size:1.2rem;font-weight:700;margin-bottom:8px;">Mini Genius</div>'
    +'<div style="color:#aaa;font-size:.85rem;margin-bottom:24px;">הזן קוד PIN</div>'
    +'<div id="pinDots" style="display:flex;gap:12px;margin-bottom:24px;"></div>'
    +'<div id="pinPad" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-width:260px;width:100%;direction:ltr;"></div>'
    +'<div id="pinError" style="color:#E74C3C;font-size:.85rem;margin-top:16px;min-height:20px;"></div>';
    document.body.appendChild(overlay);

    var entered='';var pinLen=App._PIN.length;
    function updateDots(){
      var dotsHtml='';
      for(var i=0;i<pinLen;i++){
        dotsHtml+='<div style="width:14px;height:14px;border-radius:50%;background:'+(i<entered.length?'#4A90D9':'#555')+';"></div>';
      }
      Utils.id('pinDots').innerHTML=dotsHtml;
    }
    function press(n){
      if(entered.length>=pinLen)return;
      entered+=n;updateDots();
      if(entered.length===pinLen){
        if(entered===App._PIN){
          overlay.style.transition='opacity .3s';overlay.style.opacity='0';
          setTimeout(function(){overlay.remove();App._afterUnlock();},300);
        }else{
          entered='';
          Utils.id('pinError').textContent='קוד שגוי — נסה שוב';
          updateDots();
          setTimeout(function(){Utils.id('pinError').textContent='';},2000);
        }
      }
    }
    var pad=Utils.id('pinPad');
    var btnStyle='background:rgba(255,255,255,.1);color:#fff;border:none;border-radius:12px;padding:16px;font-size:1.4rem;font-weight:700;cursor:pointer;';
    for(var i=1;i<=9;i++){
      var b=document.createElement('button');b.textContent=i;b.style.cssText=btnStyle;
      b.onclick=(function(n){return function(){press(String(n));};})(i);
      pad.appendChild(b);
    }
    var empty=document.createElement('div');pad.appendChild(empty);
    var b0=document.createElement('button');b0.textContent='0';b0.style.cssText=btnStyle;
    b0.onclick=function(){press('0');};pad.appendChild(b0);
    var bdel=document.createElement('button');bdel.textContent='⌫';bdel.style.cssText=btnStyle;
    bdel.onclick=function(){entered=entered.slice(0,-1);updateDots();};pad.appendChild(bdel);
    updateDots();
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

  setupRouting(){
    window.addEventListener('hashchange',function(){App.flushDirty();App.handleRoute()});
    // #3: Android back button restores previous view
    document.addEventListener('backbutton',function(e){
      e.preventDefault();
      if(document.getElementById('previewOverlay')){document.getElementById('previewOverlay').remove();return;}
      if(document.querySelector('.modal.show')){Stages.closeModal();return;}
      var hash=location.hash.replace('#','');
      if(hash.startsWith('candidate')){App.navigate('stage',App.currentStage);return;}
      if(hash.startsWith('dashboard')||hash.startsWith('tasks')||hash.startsWith('daysummary')||hash.startsWith('admin')){
        App.navigate('stage',App.currentStage);return;
      }
    },false);
  },
  navigate(page,param){
    // #3: Save current scroll position before navigating away
    App._scrollPositions=App._scrollPositions||{};
    var curHash=location.hash.replace('#','');
    App._scrollPositions[curHash]=window.scrollY;

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
    else if(parts[0]==='candidate'){window.scrollTo(0,0);this.renderCandidateView(parts[1]);}
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
    // #3: Save scroll position before rendering
    App._scrollPositions=App._scrollPositions||{};
    var stage=Utils.getStage(stageId);if(!stage)return;
    var cands=await DB.getByStage(stageId,this.currentJob);
    var active=cands.filter(function(c){return c.status!=='stopped'&&c.status!=='frozen'});
    active.sort(function(a,b){var pa={high:0,medium:1,low:2};return(pa[a.priority]||1)-(pa[b.priority]||1);});

    // #1: Get frozen candidates for stage 1
    var frozen=[];
    if(stageId===1){
      var allCands=await DB.getAllCandidates();
      frozen=allCands.filter(function(c){return c.status==='frozen'&&c.jobId===App.currentJob;});
    }

    var page=Utils.id('mainContent');
    var html='<div class="page active">';
    html+='<div style="padding:10px 14px;"><div class="search-bar">'
    +'<input class="form-input" id="stageSearch" placeholder="חפש מועמד בכל השלבים (שם או טלפון)..." oninput="App.globalSearch(this.value)" style="padding-right:14px;">'
    +'</div></div>';
    if(!active.length&&!frozen.length){
      html+='<div class="empty-state"><div class="icon">💭</div>'
      +'<div>אין מועמדים בשלב זה</div></div>';
    }else{
      html+='<div id="candidateList">';
      active.forEach(function(c){
        html+=App._renderCandidateCard(c,stageId);
      });
      // #1: Show frozen candidates with purple border
      if(frozen.length){
        html+='<div class="section-title" style="border-color:var(--purple);margin:16px 14px 0;">❄️ מוקפאים ('+frozen.length+')</div>';
        frozen.forEach(function(c){
          var frozenDays=Utils.daysSince(c.frozenAt);
          html+='<div class="card" style="border-right:4px solid #9B59B6;opacity:.85;" data-name="'+Utils.escHtml(c.name)+'" data-phone="'+Utils.escHtml(c.phone)+'">'
          +'<div class="card-header" onclick="App.navigate(\'candidate\',\''+c.id+'\')">'
          +'<span class="card-name">❄️ '+Utils.escHtml(Utils.displayName(c))+'</span>'
          +'<span class="status-badge status-frozen">הקפאה</span></div>'
          +'<div class="card-meta">'+Utils.escHtml(c.phone)+' | הוקפא לפני '+frozenDays+' ימים'
          +' | מתחנה: '+Utils.getStageName(c.frozenFromStage||c.stage)+'</div>'
          +'<div style="display:flex;gap:6px;justify-content:flex-end;padding-top:6px;border-top:1px solid var(--border);margin-top:8px;">'
          +'<button class="btn btn-outline btn-sm" style="font-size:.78rem;color:#9B59B6;" onclick="event.stopPropagation();Stages.unfreezeCandidate(\''+c.id+'\')">🔓 הוצא מהקפאה</button>'
          +'<button class="btn btn-outline btn-sm" style="font-size:.78rem;" onclick="event.stopPropagation();App.editCandidate(\''+c.id+'\')">✏️ עריכה</button>'
          +'</div></div>';
        });
      }
      html+='</div>';
    }
    html+='<div id="globalSearchResults" style="display:none;"></div>';
    html+='</div>';page.innerHTML=html;this.updateBadges();
    Tasks.renderInline(stageId);
    // #3: Restore scroll position
    var savedScroll=App._scrollPositions['stage/'+stageId];
    if(savedScroll)setTimeout(function(){window.scrollTo(0,savedScroll);},50);
  },

  // Helper to render a candidate card (reused in stage list)
  _renderCandidateCard:function(c,stageId){
    var ad=parseInt(App.settings['alertDaysStage'+stageId])||5;
    var days=Utils.workDaysSince(c.stageEnteredAt||c.updatedAt);var delayed=days>=ad;
    var gradeSummary='';
    for(var si=1;si<stageId;si++){
      var g=c['stage'+si+'_grade'];
      if(g)gradeSummary+=(gradeSummary?' | ':'')+Utils.getStage(si).icon+g+'/7';
    }
    var notesTrim=(c.notes||'').substring(0,40);
    var dName=Utils.displayName(c);
    var html='<div class="card priority-'+c.priority+'" data-name="'+Utils.escHtml(dName)+'" data-phone="'+Utils.escHtml(c.phone)+'">'
    +'<div class="card-header" onclick="App.navigate(\'candidate\',\''+c.id+'\')">'
    +'<span class="card-name">'+(Utils.PRI_DOTS[c.priority]||'')+' '+Utils.escHtml(dName)+(c.recommendation?(' '+Utils.REC_ICONS[c.recommendation]):'')+'</span>'
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
    return html;
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
    // v3.4: Search across ALL cycles
    var matches=all.filter(function(c){
      return(
        (c.name||'').toLowerCase().includes(q)||
        (c.fullName||'').toLowerCase().includes(q)||
        (c.phone||'').includes(q)
      );
    });
    if(!matches.length){
      resultsEl.innerHTML='<div class="empty-state" style="padding:20px;"><div>לא נמצאו תוצאות</div></div>';
      resultsEl.style.display='block';return;
    }
    // Get job names for display
    var jobs=await DB.getAllJobs();
    var jobMap={};jobs.forEach(function(j){jobMap[j.id]=j.name;});
    var html='<div style="padding:6px 14px;font-size:.82rem;color:var(--text-light);">'+matches.length+' תוצאות בכל השלבים והמחזורים</div>';
    matches.forEach(function(c){
      var dName=Utils.displayName(c);
      var cycleName=jobMap[c.jobId]||'';
      html+='<div class="card">'
      +'<div class="card-header" onclick="App.navigate(\'candidate\',\''+c.id+'\')">'
      +'<span class="card-name">'+(Utils.PRI_DOTS[c.priority]||'')+' '+Utils.escHtml(dName)+(c.recommendation?(' '+Utils.REC_ICONS[c.recommendation]):'')+'</span>'
      +'<span class="status-badge status-'+c.status+'">'+Utils.STATUSES[c.status]+'</span></div>'
      +'<div class="card-meta" onclick="App.navigate(\'candidate\',\''+c.id+'\')">'+Utils.escHtml(c.phone)+' | '+Utils.getStageName(c.stage)
      +(cycleName?' | 💼 '+Utils.escHtml(cycleName):'')+'</div>'
      +'<div style="display:flex;justify-content:flex-end;padding-top:6px;border-top:1px solid var(--border);margin-top:6px;">'
      +'<button class="btn btn-outline btn-sm" style="font-size:.78rem;padding:5px 10px;" onclick="event.stopPropagation();App.editCandidate(\''+c.id+'\')">✏️ עריכה</button>'
      +'</div></div>';
    });
    resultsEl.innerHTML=html;resultsEl.style.display='block';
  },

  async renderCandidateView(id){
    await this.flushDirty();
    var c=await DB.getCandidate(id);if(!c){Utils.toast('לא נמצא','danger');return;}
    var page=Utils.id('mainContent');
    var dName=Utils.displayName(c);
    // v3.4: Get job name
    var jobName='';
    try{var jobs=await DB.getAllJobs();var job=jobs.find(function(j){return j.id===c.jobId;});jobName=job?job.name:'';}catch(e){}
    var html='<div class="page active"><div style="display:flex;align-items:center;gap:10px;padding:14px;">'
    +'<button class="btn btn-outline btn-sm" onclick="App.navigate(\'stage\','+c.stage+')">←</button>'
    +'<div style="flex:1;"><div style="font-size:1.15rem;font-weight:700;">'+(Utils.PRI_DOTS[c.priority]||'')+' '+Utils.escHtml(dName)+(c.recommendation?(' '+Utils.REC_ICONS[c.recommendation]):'')+'</div>'
    +'<div class="card-meta">'+Utils.escHtml(c.phone)+' | '+Utils.getStageName(c.stage)
    +(jobName?' | 💼 '+Utils.escHtml(jobName):'')
    +(c.recommendation?' | '+Utils.REC_LABELS[c.recommendation]:'')+'</div></div>'
    +'<span class="status-badge status-'+c.status+'">'+Utils.STATUSES[c.status]+'</span></div>';
    html+='<div style="display:flex;gap:6px;padding:0 14px;flex-wrap:wrap;">'
    +'<button class="btn btn-call btn-sm" onclick="Utils.openDialer(\''+c.phone+'\')">📞 התקשר</button>'
    +'<button class="btn btn-wa btn-sm" onclick="Stages.sendWhatsApp('+c.stage+',\''+c.id+'\')">📱 וואצאפ</button>';
    if(c.stage<=2)html+='<button class="btn btn-purple btn-sm" onclick="Stages.freezeCandidate(\''+c.id+'\')">❄️ הקפאה</button>';
    html+='<button class="btn btn-danger btn-sm" onclick="Stages.stopProcess(\''+c.id+'\')">⛔ הפסק</button>';
    html+='<button class="btn btn-outline btn-sm" onclick="App.showCandidateOverview(\''+c.id+'\')">📋 סקירה</button>';
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
    html+='<div class="form-group"><label class="form-label">שם מקוצר (לייצוא)</label>'
    +'<input class="form-input" id="editName" value="'+Utils.escHtml(c.name)+'"></div>';
    html+='<div class="form-group"><label class="form-label">שם מלא (פנימי)</label>'
    +'<input class="form-input" id="editFullName" value="'+Utils.escHtml(c.fullName||c.name)+'"></div>';
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
    // v3.4: Recruiting cycle selector
    var jobs=await DB.getAllJobs();
    html+='<div class="form-group"><label class="form-label">💼 מחזור גיוס</label>'
    +'<select class="form-select" id="editJobId">';
    jobs.forEach(function(j){
      html+='<option value="'+j.id+'"'+(j.id===c.jobId?' selected':'')+'>'+Utils.escHtml(j.name)+'</option>';
    });
    html+='</select></div>';
    // v3.0: Recommendation tag
    var rec=c.recommendation||'';
    html+='<div class="form-group"><label class="form-label">המלצה</label><div class="radio-group" id="editRec">'
    +'<div class="radio-btn '+(rec===''?'active':'')+'" data-val="" onclick="App._editRec(this)">ללא</div>'
    +'<div class="radio-btn '+(rec==='recommended'?'active':'')+'" data-val="recommended" onclick="App._editRec(this)">⭐ מומלצים</div>'
    +'<div class="radio-btn '+(rec==='unit'?'active':'')+'" data-val="unit" onclick="App._editRec(this)">🥈 מומלצי יחידה</div>'
    +'<div class="radio-btn '+(rec==='eitan'?'active':'')+'" data-val="eitan" onclick="App._editRec(this)">🥇 מומלצי איתן</div>'
    +'<div class="radio-btn '+(rec==='employee'?'active':'')+'" data-val="employee" onclick="App._editRec(this)">🪪 עובדים</div>'
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
    c.fullName=Utils.id('editFullName')?.value?.trim()||c.name;
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
    // v3.4: Save job cycle
    var newJobId=Utils.id('editJobId')?.value;
    if(newJobId&&newJobId!==c.jobId){
      var oldJobName=c.jobId;c.jobId=newJobId;
      DB.logAction('העברת מחזור',c.name+' → '+newJobId);
    }
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
    var groups={eitan:[],unit:[],recommended:[],employee:[]};
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
      +'<div class="kpi"><div class="kpi-value" style="color:#4A90D9;">'+groups.employee.length+'</div><div class="kpi-label">🪪 עובדים</div></div>'
      +'</div>';

      var order=[{key:'eitan',icon:'🥇',label:'מומלצי איתן',color:'#FFD700'},
                 {key:'unit',icon:'🥈',label:'מומלצי יחידה',color:'#C0C0C0'},
                 {key:'recommended',icon:'⭐',label:'מומלצים',color:'#B8860B'},
                 {key:'employee',icon:'🪪',label:'עובדים',color:'#4A90D9'}];
      order.forEach(function(g){
        if(!groups[g.key].length)return;
        html+='<div class="section-title" style="border-color:'+g.color+';">'+g.icon+' '+g.label+' ('+groups[g.key].length+')</div>';
        groups[g.key].forEach(function(c){
          var stageName=Utils.getStageName(c.stage);
          var status=Utils.STATUSES[c.status]||c.status;
          var handled=c.recommendedAt?Utils.formatDate(c.recommendedAt):(c.createdAt?Utils.formatDate(c.createdAt):'-');
          var notesAll='';
          for(var si=1;si<=7;si++){var n=c['stage'+si+'_notes'];if(n)notesAll+=(notesAll?', ':'')+Utils.getStage(si).icon+n.substring(0,30);}
          html+='<div class="card" onclick="App.navigate(\'candidate\',\''+c.id+'\')">'
          +'<div class="card-header"><span class="card-name">'+g.icon+' '+Utils.escHtml(Utils.displayName(c))+'</span>'
          +'<span class="status-badge status-'+c.status+'">'+status+'</span></div>'
          +'<div class="card-meta">'+stageName+' | ממליץ: '+(c.referrer||'-')+' | רכז: '+(c.recruiter||'-')+'</div>'
          +(notesAll?'<div class="card-meta">📝 '+Utils.escHtml(notesAll)+'</div>':'')
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
    var groups={eitan:[],unit:[],recommended:[],employee:[]};
    recommended.forEach(function(c){if(groups[c.recommendation])groups[c.recommendation].push(c);});
    var stageNames={};for(var i=1;i<=7;i++)stageNames[i]=Utils.getStageName(i);
    var statusNames=Utils.STATUSES;

    // Build candidate data as JSON for the interactive page
    var candData=recommended.map(function(c){
      var notesAll='';
      for(var si=1;si<=7;si++){var n=c['stage'+si+'_notes'];if(n)notesAll+=(notesAll?' | ':'')+n.substring(0,40);}
      if(c.notes)notesAll=(c.notes.substring(0,40))+(notesAll?' | '+notesAll:'');
      return{id:c.id,name:Utils.exportName(c),stage:c.stage,status:c.status,
        recommendation:c.recommendation,referrer:c.referrer||'-',recruiter:c.recruiter||'-',
        notes:notesAll||'-',changes:[]};
    });

    var html='<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    +'<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial;direction:rtl;background:#EEF2F7;padding:16px;max-width:800px;margin:0 auto}'
    +'h1{color:#1B2A4A;font-size:1.3rem;margin-bottom:4px}p.sub{color:#7F8C8D;font-size:.82rem;margin-bottom:16px}'
    +'h2{margin-top:20px;padding-bottom:6px;border-bottom:2px solid #ddd;font-size:1rem}'
    +'.card{background:#fff;border-radius:10px;padding:14px;margin:8px 0;box-shadow:0 2px 6px rgba(0,0,0,.06)}'
    +'.name{font-weight:700;font-size:.95rem;margin-bottom:4px}.meta{font-size:.78rem;color:#7F8C8D;margin:2px 0}'
    +'.badge{display:inline-block;padding:2px 8px;border-radius:8px;font-size:.7rem;font-weight:600}'
    +'.badge-active{background:#EBF5FB;color:#4A90D9}.badge-pass{background:#d4edda;color:#155724}'
    +'.badge-fail{background:#f8d7da;color:#721c24}.badge-stopped{background:#f5c6cb;color:#721c24}'
    +'.actions{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}'
    +'button{padding:6px 12px;border-radius:8px;border:1px solid #ddd;background:#fff;cursor:pointer;font-size:.78rem}'
    +'button.primary{background:#4A90D9;color:#fff;border:none}button.danger{background:#E74C3C;color:#fff;border:none}'
    +'input,select,textarea{width:100%;padding:8px;border:1px solid #ddd;border-radius:8px;font-size:.85rem;direction:rtl;margin:4px 0}'
    +'.change-log{margin-top:8px;padding:8px;background:#f8f9fa;border-radius:8px;font-size:.72rem;color:#555}'
    +'.change-entry{border-bottom:1px solid #eee;padding:4px 0}.change-entry:last-child{border:none}'
    +'.modal-bg{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);z-index:99;display:flex;align-items:center;justify-content:center;padding:20px}'
    +'.modal{background:#fff;border-radius:16px;padding:20px;max-width:400px;width:100%;max-height:80vh;overflow-y:auto}'
    +'</style></head><body>'
    +'<h1>⭐ דוח מומלצים — Mini Genius</h1>'
    +'<p class="sub">תאריך הפקה: '+Utils.formatDate(new Date().toISOString())+' | ניתן לעריכה</p>'
    +'<div id="report"></div>'
    +'<script>'
    +'var stageNames='+JSON.stringify(stageNames)+';'
    +'var statusNames='+JSON.stringify(statusNames)+';'
    +'var recIcons={eitan:"🥇",unit:"🥈",recommended:"⭐",employee:"🪪"};'
    +'var recLabels={eitan:"מומלצי איתן",unit:"מומלצי יחידה",recommended:"מומלצים",employee:"עובדים"};'
    +'var candidates='+JSON.stringify(candData)+';'
    +'function render(){'
    +'var groups={eitan:[],unit:[],recommended:[],employee:[]};'
    +'candidates.forEach(function(c){if(groups[c.recommendation])groups[c.recommendation].push(c);});'
    +'var html="";'
    +'[{key:"eitan",icon:"🥇"},{key:"unit",icon:"🥈"},{key:"recommended",icon:"⭐"},{key:"employee",icon:"🪪"}].forEach(function(g){'
    +'if(!groups[g.key].length)return;'
    +'html+="<h2>"+g.icon+" "+recLabels[g.key]+" ("+groups[g.key].length+")</h2>";'
    +'groups[g.key].forEach(function(c,i){'
    +'var idx=candidates.indexOf(c);'
    +'var badgeCls="badge-"+(c.status==="stopped"?"stopped":c.status==="fail"?"fail":c.status==="pass"?"pass":"active");'
    +'html+="<div class=\\"card\\"><div class=\\"name\\">"+g.icon+" "+esc(c.name)+"</div>";'
    +'html+="<div class=\\"meta\\"><span class=\\"badge "+badgeCls+"\\">"+(statusNames[c.status]||c.status)+"</span> | תחנה: "+(stageNames[c.stage]||c.stage)+"</div>";'
    +'html+="<div class=\\"meta\\">ממליץ: "+esc(c.referrer)+" | רכז: "+esc(c.recruiter)+"</div>";'
    +'if(c.notes&&c.notes!=="-")html+="<div class=\\"meta\\">📝 "+esc(c.notes)+"</div>";'
    // Change log
    +'if(c.changes&&c.changes.length){'
    +'html+="<div class=\\"change-log\\">";'
    +'c.changes.forEach(function(ch){'
    +'html+="<div class=\\"change-entry\\">"+esc(ch.time)+" | "+esc(ch.by)+": "+esc(ch.text)+"</div>";'
    +'});html+="</div>"}'
    // Action buttons
    +'html+="<div class=\\"actions\\">";'
    +'html+="<button onclick=\\"editStage("+idx+")\\">🔄 שנה תחנה</button>";'
    +'html+="<button class=\\"danger\\" onclick=\\"stopProcess("+idx+")\\">⛔ סיום טיפול</button>";'
    +'html+="<button onclick=\\"addNote("+idx+")\\">📝 הוסף הערה</button>";'
    +'html+="</div></div>";'
    +'});});'
    +'document.getElementById("report").innerHTML=html;}'

    +'function esc(s){return(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}'

    +'function askName(){var n=prompt("שם המבצע:");return n?n.trim():null;}'
    +'function stamp(){return new Date().toLocaleString("he-IL");}'

    +'function editStage(idx){'
    +'var c=candidates[idx];var newStage=prompt("תחנה חדשה (1-7):",c.stage);'
    +'if(!newStage||isNaN(newStage))return;var by=askName();if(!by)return;'
    +'var old=c.stage;c.stage=parseInt(newStage);'
    +'c.changes.push({time:stamp(),by:by,text:"שינוי תחנה: "+(stageNames[old]||old)+" → "+(stageNames[c.stage]||c.stage)});'
    +'render();}'

    +'function stopProcess(idx){'
    +'var c=candidates[idx];if(!confirm("סיום טיפול ב"+c.name+"?"))return;'
    +'var reason=prompt("סיבה:");var by=askName();if(!by)return;'
    +'c.status="stopped";'
    +'c.changes.push({time:stamp(),by:by,text:"סיום טיפול"+(reason?" — "+reason:"")});'
    +'render();}'

    +'function addNote(idx){'
    +'var c=candidates[idx];var note=prompt("הערה:");if(!note)return;'
    +'var by=askName();if(!by)return;'
    +'c.changes.push({time:stamp(),by:by,text:"הערה: "+note});'
    +'render();}'

    +'render();'
    +'<\/script></body></html>';

    Utils.writeToCacheAndShare('recommendations_'+Utils.today()+'.html',html,'text/html','דוח מומלצים');
  },

  // v3.1: Full candidate overview
  async showCandidateOverview(id){
    var c=await DB.getCandidate(id);if(!c)return;
    var q=function(f){return c['stage2_q_'+f]||'';};
    var html='<div class="modal-title" style="font-size:1rem;">📋 סקירת מועמד — '+Utils.escHtml(c.name)+'</div>';
    // Basic info
    var jobName='';
    try{var jobs=await DB.getAllJobs();var job=jobs.find(function(j){return j.id===c.jobId;});jobName=job?job.name:'';}catch(e){}
    html+='<div style="margin-bottom:10px;font-size:.82rem;">'
    +'<div><strong>טלפון:</strong> '+Utils.escHtml(c.phone)+'</div>'
    +'<div><strong>תחנה:</strong> '+Utils.getStageName(c.stage)+' | <strong>סטטוס:</strong> '+Utils.STATUSES[c.status]+'</div>'
    +(jobName?'<div><strong>💼 מחזור:</strong> '+Utils.escHtml(jobName)+'</div>':'')
    +'<div><strong>עדיפות:</strong> '+(c.priority==='high'?'🔴 גבוה':c.priority==='low'?'🟢 נמוך':'🟠 בינוני')+'</div>';
    if(c.recommendation)html+='<div><strong>המלצה:</strong> '+(Utils.REC_ICONS[c.recommendation]||'')+' '+(Utils.REC_LABELS[c.recommendation]||'')+'</div>';
    if(c.referrer)html+='<div><strong>ממליץ:</strong> '+Utils.escHtml(c.referrer)+'</div>';
    if(c.recruiter)html+='<div><strong>רכז:</strong> '+Utils.escHtml(c.recruiter)+'</div>';
    if(c.notes)html+='<div><strong>הערות:</strong> '+Utils.escHtml(c.notes)+'</div>';
    html+='</div>';

    // Files
    if(c.cvFileName)html+='<div class="info-box" style="padding:6px 10px;">📎 קו"ח: '+Utils.escHtml(c.cvFileName)+'</div>';

    // Phone interview - FULL questionnaire
    var hasQ=q('age')||q('marital')||q('grade');
    if(hasQ){
      html+='<div style="font-weight:700;margin:10px 0 4px;font-size:.88rem;">📞 שאלון טלפוני</div>';
      if(q('grade'))html+='<div style="font-size:.82rem;padding:4px 0;"><strong>ציון:</strong> '+q('grade')+'/7'
      +(q('result')?' | <strong>תוצאה:</strong> '+Utils.escHtml(q('result')):'')+'</div>';

      var qSections=[
        {title:'פרטים אישיים',fields:[
          ['גיל',q('age')],['מצב משפחתי',q('marital')],['שוחח עם בן/בת זוג',q('partnerTalk'),q('partnerTalkDetail')],
          ['ילדים',q('children')],['רילוקציה',q('relocation')],['משרה מלאה',q('fullTime')],
          ['רשיון',q('license')],['רשיון C',q('licenseC')],['ימי התלבטות',q('hesitationDays')]
        ]},
        {title:'מצב רפואי',fields:[
          ['רפואי',q('medical'),q('medicalDetail')],['כושר',q('fitness')],
          ['פציעת צה"ל',q('idfInjury'),q('idfInjuryDetail')],['ראייה',q('vision'),q('visionDetail')],
          ['פרופיל',q('idfProfile')],['סממנים',q('tattoos')],['זמינות',q('availability'),q('availabilityDetail')]
        ]},
        {title:'השכלה ורקע',fields:[
          ['עיסוק נוכחי',q('currentJob')],['סיפור חיים',q('lifeStory')],
          ['בגרות',q('bagrut'),q('bagrutDetail')],['מקצועות מוגברים',q('enhancedSubjects')],
          ['אנגלית',q('english')],['מתמטיקה',q('math')],
          ['לקויות למידה',q('learningDisability'),q('learningDisabilityDetail')],
          ['מכינה/ישיבה',q('mechina'),q('mechinaDetail')]
        ]},
        {title:'צבא ותעסוקה',fields:[
          ['שירות צבאי',q('militaryService')],['לימודים אקדמאיים',q('academic'),q('academicDetail')],
          ['פסיכומטרי',q('psychometric')],['לאחר צבא',q('postArmy')]
        ]},
        {title:'שאלות אינטימיות',fields:[
          ['הסכמה',q('intimateConsent')],['נפשי',q('intimateMental'),q('intimateMentalDetail')],
          ['סמים',q('intimateDrugs'),q('intimateDrugsDetail')],
          ['פלילי',q('intimateCriminal'),q('intimateCriminalDetail')],
          ['משמעת צבאית',q('intimateMilitary'),q('intimateMilitaryDetail')]
        ]}
      ];
      qSections.forEach(function(sec){
        var hasData=sec.fields.some(function(f){return f[1];});
        if(!hasData)return;
        html+='<div style="font-weight:600;font-size:.78rem;color:var(--accent);margin:8px 0 2px;">'+sec.title+'</div>';
        sec.fields.forEach(function(f){
          if(!f[1])return;
          html+='<div style="font-size:.78rem;padding:2px 0;border-bottom:1px solid #f5f5f5;">'
          +'<span style="color:var(--text-light);">'+f[0]+':</span> '+Utils.escHtml(f[1]);
          if(f[2])html+=' <span style="color:var(--accent);font-style:italic;">('+Utils.escHtml(f[2])+')</span>';
          html+='</div>';
        });
      });
      if(q('notes'))html+='<div style="font-size:.78rem;padding:4px 0;"><strong>הערות שאלון:</strong> '+Utils.escHtml(q('notes'))+'</div>';
      if(q('rejectionReason'))html+='<div style="font-size:.78rem;padding:4px 0;color:var(--danger);"><strong>סיבת דחייה:</strong> '+Utils.escHtml(q('rejectionReason'))+'</div>';
    }

    // Stage grades & notes
    html+='<div style="font-weight:700;margin:10px 0 4px;font-size:.88rem;">ציונים והערות לפי תחנה:</div>';
    var hasStageData=false;
    for(var si=1;si<=7;si++){
      var grade=c['stage'+si+'_grade'];var notes=c['stage'+si+'_notes'];
      var decision=c['stage'+si+'_decision'];var completed=c['stage'+si+'_completedAt'];
      var result=c['stage'+si+'_result'];
      if(grade||notes||decision||completed||result){
        hasStageData=true;
        var st=Utils.getStage(si);
        html+='<div style="padding:4px 0;border-bottom:1px solid var(--border);font-size:.8rem;">'
        +'<strong>'+st.icon+' '+st.name+':</strong> ';
        var parts=[];
        if(grade)parts.push('ציון '+grade+'/7');
        if(decision||result){var d=decision||result;parts.push(d==='pass'?'✅ עבר':d==='fail'?'❌ לא עבר':'⏳ '+d);}
        if(completed)parts.push(Utils.formatDate(completed));
        html+=parts.join(' | ');
        if(notes)html+='<br>📝 '+Utils.escHtml(notes);
        html+='</div>';
      }
    }
    if(!hasStageData)html+='<div style="font-size:.8rem;color:var(--text-light);">אין נתונים עדיין</div>';

    // Export button
    if(hasQ)html+='<button class="btn btn-outline btn-sm" style="width:100%;margin-top:8px;" onclick="Stages.closeModal();Stage2.exportDocx(\''+c.id+'\')">📄 ייצוא שאלון ל-Word</button>';
    html+='<button class="btn btn-outline" style="width:100%;margin-top:8px;" onclick="Stages.closeModal()">סגור</button>';
    Stages.showModal(html);
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
