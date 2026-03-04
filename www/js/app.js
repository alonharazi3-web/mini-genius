'use strict';
const App={
  currentJob:null,currentStage:1,settings:{},_dirty:{},

  async init(){
    setTimeout(function(){var sp=Utils.id('splashScreen');if(sp)sp.classList.add('hide');
      setTimeout(function(){if(sp)sp.remove();},600);},2500);
    _dbg('App.init start');
    await DB.init();await DB.initDefaults();
    this.settings=await DB.getAllSettings();
    _dbg('DB ready, settings loaded');
    this.checkFrozenCandidates();
    this.setupRouting();this.renderJobLabel();this.renderTabs();this.setupFAB();
    var recruiters=JSON.parse(this.settings.recruiters||'[]');
    if(!recruiters.length){this.navigate('admin');Utils.toast('הגדר רכזים תחילה','warning');}
    else{
      var jobs=await DB.getAllJobs();
      var activeId=this.settings.activeJobId;
      if(activeId){this.currentJob=activeId;}
      else if(jobs.length){this.currentJob=jobs[0].id;}
      this.navigate('stage',1);
    }
    Tasks.carryOverTasks();
    // Auto-save every 30 seconds
    setInterval(function(){App.flushDirty()},30000);
    _dbg('App.init done');
  },

  // Mark field as dirty for auto-save
  markDirty(cid,field,val){
    if(!this._dirty[cid])this._dirty[cid]={};
    this._dirty[cid][field]=val;
  },
  async flushDirty(){
    for(var cid in this._dirty){
      var c=await DB.getCandidate(cid);if(!c)continue;
      for(var f in this._dirty[cid]){c[f]=this._dirty[cid][f];}
      await DB.saveCandidate(c);
    }
    this._dirty={};
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
    // Search
    html+='<div style="padding:10px 14px;"><div class="search-bar">'
    +'<input class="form-input" id="stageSearch" placeholder="חפש..." oninput="App.filterList(this.value)" style="padding-right:14px;">'
    +'</div></div>';
    if(!active.length){
      html+='<div class="empty-state"><div class="icon">💭</div>'
      +'<div>אין מועמדים בשלב זה</div></div>';
    }else{
      html+='<div id="candidateList">';
      active.forEach(function(c){
        var ad=parseInt(App.settings['alertDaysStage'+stageId])||5;
        var days=Utils.workDaysSince(c.updatedAt);var delayed=days>=ad;
        html+='<div class="card priority-'+c.priority+'" data-name="'+Utils.escHtml(c.name)+'" onclick="App.navigate(\'candidate\',\''+c.id+'\')">'
        +'<div class="card-header"><span class="card-name">'+Utils.escHtml(c.name)+'</span>'
        +'<span class="status-badge status-'+c.status+'">'+Utils.STATUSES[c.status]+'</span></div>'
        +'<div class="card-meta">'+Utils.escHtml(c.phone)+' | '+days+' ימי עבודה'
        +(delayed?' | <span style="color:var(--danger);">בעיכוב!</span>':'')
        +'</div></div>';
      });
      html+='</div>';
    }
    html+='</div>';page.innerHTML=html;this.updateBadges();
  },

  filterList(q){
    q=q.toLowerCase();
    document.querySelectorAll('#candidateList .card').forEach(function(el){
      el.style.display=el.dataset.name.toLowerCase().includes(q)?'':'none';
    });
  },

  async renderCandidateView(id){
    this.flushDirty();
    var c=await DB.getCandidate(id);if(!c){Utils.toast('לא נמצא','danger');return;}
    var page=Utils.id('mainContent');
    var html='<div class="page active"><div style="display:flex;align-items:center;gap:10px;padding:14px;">'
    +'<button class="btn btn-outline btn-sm" onclick="App.navigate(\'stage\','+c.stage+')">←</button>'
    +'<div style="flex:1;"><div style="font-size:1.15rem;font-weight:700;">'+Utils.escHtml(c.name)+'</div>'
    +'<div class="card-meta">'+Utils.escHtml(c.phone)+' | '+Utils.getStageName(c.stage)+'</div></div>'
    +'<span class="status-badge status-'+c.status+'">'+Utils.STATUSES[c.status]+'</span></div>';
    // Action buttons
    html+='<div style="display:flex;gap:6px;padding:0 14px;flex-wrap:wrap;">'
    +'<button class="btn btn-call btn-sm" onclick="Utils.openDialer(\''+c.phone+'\')">📞 התקשר</button>'
    +'<button class="btn btn-wa btn-sm" onclick="Stages.sendWhatsApp('+c.stage+',\''+c.id+'\')">📱 וואצאפ</button>';
    if(c.stage<=2)html+='<button class="btn btn-purple btn-sm" onclick="Stages.freezeCandidate(\''+c.id+'\')">❄️ הקפאה</button>';
    html+='<button class="btn btn-danger btn-sm" onclick="Stages.stopProcess(\''+c.id+'\')">⛔ הפסק</button>';
    html+='</div>';
    // Stage-specific content
    if(c.stage===1)html+=Stage1.renderDetail(c);
    else if(c.stage===2)html+=Stage2.renderDetail(c);
    else if(c.stage===3)html+=Stage3.renderDetail(c);
    else html+=Stages.renderGenericDetail(c);
    html+='</div>';page.innerHTML=html;
  },

  setupFAB(){
    var fab=Utils.id('fab');var menu=Utils.id('fabMenu');
    if(!fab||!menu)return;
    fab.addEventListener('click',function(){fab.classList.toggle('open');menu.classList.toggle('show');});
    document.addEventListener('click',function(e){
      if(!fab.contains(e.target)&&!menu.contains(e.target)){fab.classList.remove('open');menu.classList.remove('show');}
    });
  }
};

document.addEventListener('deviceready',function(){_dbg('deviceready');App.init();},false);
setTimeout(function(){if(!window.cordova){_dbg('No cordova, init directly');App.init();}},3000);
