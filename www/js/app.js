'use strict';
const App={
  currentJob:null,currentStage:1,settings:{},

  async init(){
    setTimeout(()=>{const sp=Utils.id('splashScreen');if(sp)sp.classList.add('hide');
      setTimeout(()=>{if(sp)sp.remove();},600);},2500);
    await DB.init();await DB.initDefaults();
    this.settings=await DB.getAllSettings();
    this.checkFrozenCandidates();
    this.setupRouting();this.renderJobSelector();this.renderTabs();this.setupFAB();
    const recruiters=JSON.parse(this.settings.recruiters||'[]');
    if(!recruiters.length){this.navigate('admin');Utils.toast('הגדר רכזים תחילה','warning');}
    else{const jobs=await DB.getAllJobs();if(jobs.length){this.currentJob=jobs[0].id;this.navigate('stage',1);}}
    this.autoSaveIndicator();Tasks.carryOverTasks();
  },

  async checkFrozenCandidates(){
    const all=await DB.getAllCandidates();const today=Utils.today();
    for(const c of all){
      if(c.status==='frozen'&&c.freezeEndDate&&c.freezeEndDate<=today){
        Utils.toast('⚡ '+c.name+' - סיום הקפאה!','warning');
      }
    }
  },

  setupRouting(){window.addEventListener('hashchange',()=>this.handleRoute())},
  navigate(page,param){
    if(page==='stage')location.hash='#stage/'+param;
    else if(page==='candidate')location.hash='#candidate/'+param;
    else location.hash='#'+page;
  },

  handleRoute(){
    const hash=location.hash.slice(1)||'stage/1';const[page,param]=hash.split('/');
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    if(page==='stage'){this.currentStage=parseInt(param)||1;this.renderStage(this.currentStage);this.updateTabHighlight();}
    else if(page==='candidate')this.renderCandidateView(param);
    else if(page==='admin')Admin.render();
    else if(page==='dashboard')Dashboard.render(this.currentStage);
    else if(page==='tasks')Tasks.render(this.currentStage);
    else if(page==='daysummary')DaySummary.render();
    else if(page==='newCandidate')Stage1.renderForm();
  },

  async renderJobSelector(){
    const jobs=await DB.getAllJobs();const c=Utils.id('jobSelector');
    c.innerHTML=jobs.map(j=>'<div class="job-chip '+(j.id===this.currentJob?'active':'')+'" data-job="'+j.id+'">'+j.name+'</div>').join('');
    c.querySelectorAll('.job-chip').forEach(el=>{el.addEventListener('click',()=>{
      this.currentJob=el.dataset.job;this.renderJobSelector();this.renderStage(this.currentStage);});});
  },

  renderTabs(){
    const c=Utils.id('tabBar');
    c.innerHTML=Utils.STAGES.map(s=>'<div class="tab '+(s.id===this.currentStage?'active':'')+'" data-stage="'+s.id+'"><span class="icon">'+s.icon+'</span><span class="count" id="tabCount'+s.id+'"></span>'+s.name+'</div>').join('')
    +'<div class="tab" data-page="admin"><span class="icon">⚙️</span>ניהול</div>';
    c.querySelectorAll('.tab').forEach(el=>{el.addEventListener('click',()=>{
      if(el.dataset.stage)this.navigate('stage',el.dataset.stage);
      else if(el.dataset.page)this.navigate(el.dataset.page);});});
    this.updateTabCounts();
  },

  async updateTabCounts(){
    for(const s of Utils.STAGES){
      const cands=await DB.getByStage(s.id,this.currentJob);
      const active=cands.filter(c=>c.status==='active'||c.status==='hesitation');
      const el=Utils.id('tabCount'+s.id);
      if(el)el.innerHTML=active.length?'<span class="badge">'+active.length+'</span>':'';
    }
  },
  updateTabHighlight(){document.querySelectorAll('.tab').forEach(t=>{t.classList.toggle('active',t.dataset.stage==this.currentStage)})},

  async renderStage(stageId){
    const stage=Utils.getStage(stageId);const page=Utils.id('mainContent');
    const candidates=await DB.getByStage(stageId,this.currentJob);
    const active=candidates.filter(c=>c.status!=='stopped');
    const frozen=await DB.getFrozen(this.currentJob);
    const stageFrozen=frozen.filter(f=>f.frozenFromStage===stageId);

    let html='<div class="page active" id="stagePage">';
    html+='<div style="display:flex;gap:8px;margin:10px 12px;align-items:center;">';
    html+='<div class="search-bar" style="flex:1;margin:0;"><input type="text" id="searchInput" placeholder="חיפוש..." oninput="App.filterCandidates()"><span class="search-icon">🔍</span></div>';
    if(stageId===1)html+='<button class="btn btn-primary btn-sm" onclick="Stage1.renderForm()">+ חדש</button>';
    html+='<button class="btn btn-outline btn-sm" onclick="App.navigate(\'dashboard\')">📊</button>';
    html+='<button class="btn btn-outline btn-sm" onclick="App.navigate(\'tasks\')">☑️</button></div>';

    if(stageFrozen.length){
      html+='<div class="purple-box" style="margin:0 12px;cursor:pointer;" onclick="App.showFrozenList('+stageId+')">❄️ '+stageFrozen.length+' מועמדים בהקפאה</div>';
    }

    html+='<div id="candidateList">';
    if(!active.length&&!stageFrozen.length){
      html+='<div class="empty-state"><div class="icon">💭</div><div>אין מועמדים בשלב זה</div></div>';
    }else{
      active.sort((a,b)=>{const po={high:0,medium:1,low:2};return(po[a.priority]||1)-(po[b.priority]||1)});
      html+=active.map(c=>this.renderCandidateCard(c,stageId)).join('');
    }
    html+='</div></div>';
    page.innerHTML=html;this.updateTabCounts();
  },

  renderCandidateCard(c,stageId){
    const pc=c.priority?'priority-'+c.priority:'';
    const sb=c.status?'<span class="status-badge status-'+c.status+'">'+(Utils.STATUSES[c.status]||c.status)+'</span>':'';
    const days=Utils.workDaysSince(c.updatedAt);
    const ad=parseInt(App.settings['alertDaysStage'+stageId])||5;
    const stale=days>=ad&&c.status==='active';
    let grade='';
    if(c['stage'+stageId+'_grade']){const g=c['stage'+stageId+'_grade'];
      grade='<div class="grade-circle '+(g>=5?'grade-high':g>=3?'grade-mid':'grade-low')+'">'+g+'</div>';}
    return '<div class="card '+pc+(stale?' stale':'')+'" data-id="'+c.id+'" data-name="'+Utils.escHtml(c.name)+'" onclick="App.navigate(\'candidate\',\''+c.id+'\')">'
    +'<div class="card-header"><div><div class="card-name">'+Utils.escHtml(c.name)+(stale?' ⚠️':'')+'</div>'
    +'<div class="card-meta">'+(c.phone||'')+' · '+Utils.formatDate(c.createdAt)+' '+sb+'</div></div>'+grade+'</div>'
    +(c.recruiter?'<div class="card-meta">רכז: '+Utils.escHtml(c.recruiter)+'</div>':'')
    +(c.notes?'<div class="card-meta" style="margin-top:4px;">'+Utils.escHtml(c.notes).substring(0,60)+'</div>':'')
    +'</div>';
  },

  filterCandidates(){
    const q=(Utils.id('searchInput')?.value||'').toLowerCase();
    document.querySelectorAll('#candidateList .card').forEach(card=>{
      card.style.display=!q||(card.dataset.name||'').toLowerCase().includes(q)?'':'none';});
  },

  async showFrozenList(stageId){
    const frozen=await DB.getFrozen(this.currentJob);
    const list=frozen.filter(f=>f.frozenFromStage===stageId);
    let html='<div class="modal-title">❄️ מועמדים בהקפאה</div>';
    list.forEach(c=>{
      const endDate=c.freezeEndDate?Utils.formatDate(c.freezeEndDate):'';
      const isReady=c.freezeEndDate&&c.freezeEndDate<=Utils.today();
      html+='<div class="card'+(isReady?' priority-high':' frozen')+'" onclick="Stages.closeModal();App.navigate(\'candidate\',\''+c.id+'\')">'
        +'<div class="card-name">'+Utils.escHtml(c.name)+'</div>'
        +'<div class="card-meta">סיבה: '+Utils.escHtml(c.freezeReason||'')+' | סיום: '+endDate+'</div>'
        +(isReady?'<div class="warn-box">⚡ מוכן להחזיר!</div>':'')+'</div>';
    });
    html+='<button class="btn btn-outline" style="width:100%;margin-top:10px;" onclick="Stages.closeModal()">סגור</button>';
    Stages.showModal(html);
  },

  async renderCandidateView(id){
    const c=await DB.getCandidate(id);if(!c){this.navigate('stage',1);return;}
    const page=Utils.id('mainContent');const stageId=c.stage;const stage=Utils.getStage(stageId);

    let html='<div class="page active"><div style="display:flex;align-items:center;gap:10px;padding:12px;">'
    +'<button class="btn btn-outline btn-sm" onclick="App.navigate(\'stage\','+stageId+')">←</button>'
    +'<div style="flex:1;"><div style="font-size:1.1rem;font-weight:700;">'+Utils.escHtml(c.name)+'</div>'
    +'<div style="font-size:.75rem;color:var(--text-light);">'+stage.icon+' '+stage.name+'</div></div></div>';

    html+='<div style="display:flex;gap:6px;padding:0 12px;flex-wrap:wrap;">';
    html+='<button class="btn btn-call btn-sm" onclick="Utils.openDialer(\''+c.phone+'\')">📞 חייג</button>';
    html+='<button class="btn btn-wa btn-sm" onclick="Stages.sendWhatsApp('+stageId+',\''+c.id+'\')">📱 WA</button>';
    if(stageId>=4)html+='<button class="btn btn-email btn-sm" onclick="Stages.sendUpdateEmail(\''+c.id+'\','+stageId+')">✉️ זימון</button>';
    if(c.status==='frozen'){
      html+='<button class="btn btn-purple btn-sm" onclick="Stages.unfreezeCandidate(\''+c.id+'\')">❄️ החזר</button>';
    }else{
      if(stageId<=2)html+='<button class="btn btn-purple btn-sm" onclick="Stages.freezeCandidate(\''+c.id+'\')">❄️ הקפאה</button>';
      html+='<button class="btn btn-danger btn-sm" onclick="Stages.stopProcess(\''+c.id+'\')">⛔ הפסקה</button>';
    }
    html+='</div>';

    if(c.status==='frozen'){
      html+='<div class="purple-box" style="margin:8px 12px;">❄️ בהקפאה עד '+Utils.formatDate(c.freezeEndDate)
        +'<br>סיבה: '+Utils.escHtml(c.freezeReason||'')+'</div>';
    }

    if(stageId===1)html+=Stage1.renderDetail(c);
    else if(stageId===2)html+=Stage2.renderDetail(c);
    else if(stageId===3)html+=Stage3.renderDetail(c);
    else html+=Stages.renderGenericDetail(c,stageId);

    html+='</div>';page.innerHTML=html;
  },

  setupFAB(){Utils.id('fab').addEventListener('click',()=>{
    Utils.id('fab').classList.toggle('open');Utils.id('fabMenu').classList.toggle('show');})},
  autoSaveIndicator(){setInterval(()=>{const el=Utils.id('saveIndicator');if(el)el.textContent='✅ '+Utils.formatDateTime(new Date().toISOString())},30000)},
  async refreshSettings(){this.settings=await DB.getAllSettings()}
};

document.addEventListener('deviceready',()=>App.init(),false);
if(!window.cordova)document.addEventListener('DOMContentLoaded',()=>App.init());
