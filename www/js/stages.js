'use strict';
const Stages={
  async stopProcess(cid){
    const c=await DB.getCandidate(cid);if(!c)return;
    const html='<div class="modal-title">⛔ הפסקת תהליך — '+Utils.escHtml(c.name)+'</div>'
    +'<div class="form-group"><label class="form-label">סיבת הפסקה <span class="required">*</span></label>'
    +'<textarea class="form-textarea" id="stopReason" rows="3"></textarea></div>'
    +'<div class="cb-row" onclick="this.querySelector(\'.cb-box\').classList.toggle(\'checked\')">'
    +'<div class="cb-box" id="stopPhoneConfirm">✓</div>'
    +'<span class="cb-label">הודעה טלפונית נמסרה למועמד</span></div>'
    +'<div style="display:flex;gap:8px;margin-top:16px;">'
    +'<button class="btn btn-danger" style="flex:1" onclick="Stages.confirmStop(\''+c.id+'\')">אשר הפסקה</button>'
    +'<button class="btn btn-outline" style="flex:1" onclick="Stages.closeModal()">ביטול</button></div>';
    this.showModal(html);
  },

  async confirmStop(id){
    const reason=Utils.id('stopReason')?.value?.trim();
    const phoneOk=Utils.id('stopPhoneConfirm')?.classList.contains('checked');
    if(!reason){Utils.toast('נא למלא סיבה','danger');return;}
    if(!phoneOk){Utils.toast('נא לאשר שהודעה טלפונית נמסרה','danger');return;}
    const c=await DB.getCandidate(id);
    c.status='stopped';c.stopReason=reason;c.stoppedAt=new Date().toISOString();c.stopPhoneConfirmed=true;
    await DB.saveCandidate(c);this.closeModal();Utils.toast('התהליך הופסק','success');App.navigate('stage',c.stage);
  },

  // --- Freeze ---
  async freezeCandidate(cid){
    const c=await DB.getCandidate(cid);if(!c)return;
    const html='<div class="modal-title">❄️ הקפאת מועמד — '+Utils.escHtml(c.name)+'</div>'
    +'<div class="form-group"><label class="form-label">סיבת הקפאה <span class="required">*</span></label>'
    +'<textarea class="form-textarea" id="freezeReason" rows="2"></textarea></div>'
    +'<div class="form-group"><label class="form-label">תאריך סיום הקפאה <span class="required">*</span></label>'
    +'<input type="date" class="form-input" id="freezeEndDate"></div>'
    +'<div style="display:flex;gap:8px;margin-top:16px;">'
    +'<button class="btn btn-purple" style="flex:1" onclick="Stages.confirmFreeze(\''+c.id+'\')">הקפא</button>'
    +'<button class="btn btn-outline" style="flex:1" onclick="Stages.closeModal()">ביטול</button></div>';
    this.showModal(html);
  },

  async confirmFreeze(id){
    const reason=Utils.id('freezeReason')?.value?.trim();
    const endDate=Utils.id('freezeEndDate')?.value;
    if(!reason){Utils.toast('נא למלא סיבה','danger');return;}
    if(!endDate){Utils.toast('נא לבחור תאריך סיום','danger');return;}
    const c=await DB.getCandidate(id);
    c.prevStatus=c.status;c.frozenFromStage=c.stage;
    c.status='frozen';c.freezeReason=reason;c.freezeEndDate=endDate;c.frozenAt=new Date().toISOString();
    await DB.saveCandidate(c);this.closeModal();Utils.toast('מועמד הוקפא','success');App.navigate('stage',c.stage);
  },

  async unfreezeCandidate(cid){
    const c=await DB.getCandidate(cid);if(!c)return;
    const html='<div class="modal-title">❄️ ביטול הקפאה — '+Utils.escHtml(c.name)+'</div>'
    +'<div class="info-box">סיבת הקפאה: '+Utils.escHtml(c.freezeReason||'')+'</div>'
    +'<div style="display:flex;gap:8px;margin-top:16px;">'
    +'<button class="btn btn-success" style="flex:1" onclick="Stages.confirmUnfreeze(\''+c.id+'\',true)">החזר + WA</button>'
    +'<button class="btn btn-primary" style="flex:1" onclick="Stages.confirmUnfreeze(\''+c.id+'\',false)">החזר בלבד</button>'
    +'<button class="btn btn-outline" onclick="Stages.closeModal()">ביטול</button></div>';
    this.showModal(html);
  },

  async confirmUnfreeze(id,sendWA){
    const c=await DB.getCandidate(id);
    c.status=c.prevStatus||'active';c.unfrozenAt=new Date().toISOString();
    delete c.freezeReason;delete c.freezeEndDate;delete c.frozenAt;delete c.prevStatus;
    await DB.saveCandidate(c);
    if(sendWA){
      const msg=(App.settings.msgUnfreeze||'').replace('{name}',c.name);
      if(msg)Utils.openWhatsApp(c.phone,msg);
    }
    this.closeModal();Utils.toast('מועמד הוחזר לתהליך','success');App.navigate('stage',c.stage);
  },

  // --- Advance ---
  async advanceToNextStage(id){
    const c=await DB.getCandidate(id);if(!c||c.status!=='pass')return;
    const next=c.stage+1;
    if(next>7){c.status='accepted';c.acceptedAt=new Date().toISOString();await DB.saveCandidate(c);
      Utils.toast('המועמד התקבל!','success');App.navigate('stage',7);return;}
    c.stage=next;c.status='active';c['stage'+next+'_startedAt']=new Date().toISOString();
    await DB.saveCandidate(c);
    Utils.toast('הועבר לשלב '+next,'success');App.navigate('stage',next);
  },

  // --- Evaluation ---
  renderEvaluation(c,stageId){
    const p='stage'+stageId+'_';const grade=c[p+'grade']||'';const dec=c[p+'decision']||'';
    const notes=c[p+'notes']||'';const failR=c[p+'failReason']||'';const hd=c[p+'hesitDays']||'';
    let html='<div class="section-title">הערכה</div><div class="card">';
    html+='<div class="form-group"><label class="form-label">ציון 1-7 <span class="required">*</span></label><div class="scale-group">';
    for(let i=1;i<=7;i++){const cls=grade==i?(i<3?'active fail':'active'):'';
      html+='<div class="scale-btn '+cls+'" onclick="Stages.setGrade(\''+c.id+'\','+stageId+','+i+')">'+i+'</div>';}
    html+='</div></div>';
    html+='<div class="form-group"><label class="form-label">החלטה</label><div class="radio-group">';
    html+='<div class="radio-btn '+(dec==='pass'?'active-success':'')+'" onclick="Stages.setDecision(\''+c.id+'\','+stageId+',\'pass\')">עובר</div>';
    html+='<div class="radio-btn '+(dec==='hesitation'?'active-warning':'')+'" onclick="Stages.setDecision(\''+c.id+'\','+stageId+',\'hesitation\')">התלבטות</div>';
    html+='<div class="radio-btn '+(dec==='fail'?'active-danger':'')+'" onclick="Stages.setDecision(\''+c.id+'\','+stageId+',\'fail\')">לא עובר</div>';
    html+='</div></div>';
    if(dec==='hesitation'){
      html+='<div class="conditional show"><label class="form-label">ימים להחלטה</label><div class="radio-group">';
      for(const d of[3,5,7,10,14])html+='<div class="radio-btn '+(hd==d?'active':'')+'" onclick="Stages.setHesitDays(\''+c.id+'\','+stageId+','+d+')">'+d+'</div>';
      html+='</div></div>';}
    if(dec==='fail'){
      html+='<div class="conditional show"><label class="form-label">סיבת פסילה</label>'
      +'<textarea class="form-textarea" rows="2" onchange="Stages.saveField(\''+c.id+'\',\''+p+'failReason\',this.value)">'+Utils.escHtml(failR)+'</textarea></div>';}
    html+='<div class="form-group"><label class="form-label">הערות</label>'
    +'<textarea class="form-textarea" rows="3" onchange="Stages.saveField(\''+c.id+'\',\''+p+'notes\',this.value)">'+Utils.escHtml(notes)+'</textarea></div>';
    if(dec==='pass'){const btn=stageId<7?'העבר לשלב '+(stageId+1):'סיים — התקבל!';
      html+='<button class="btn btn-success" style="width:100%;margin-top:10px;" onclick="Stages.advanceToNextStage(\''+c.id+'\')">'+btn+'</button>';}
    html+='</div>';return html;
  },

  async setGrade(id,sid,g){const c=await DB.getCandidate(id);c['stage'+sid+'_grade']=g;
    if(g<3){c['stage'+sid+'_decision']='fail';c.status='fail';}await DB.saveCandidate(c);App.renderCandidateView(id);},
  async setDecision(id,sid,dec){const c=await DB.getCandidate(id);const g=c['stage'+sid+'_grade']||0;
    if(g<3&&dec!=='fail'){Utils.toast('ציון מתחת 3','danger');return;}
    c['stage'+sid+'_decision']=dec;c.status=dec==='pass'?'pass':dec==='fail'?'fail':'hesitation';
    c['stage'+sid+'_decidedAt']=new Date().toISOString();await DB.saveCandidate(c);App.renderCandidateView(id);},
  async setHesitDays(id,sid,d){const c=await DB.getCandidate(id);c['stage'+sid+'_hesitDays']=d;
    c['stage'+sid+'_hesitDeadline']=new Date(Date.now()+d*864e5).toISOString();await DB.saveCandidate(c);App.renderCandidateView(id);},
  async saveField(id,field,val){const c=await DB.getCandidate(id);c[field]=val;await DB.saveCandidate(c);},
  async toggleCheck(id,field,el){const c=await DB.getCandidate(id);c[field]=!c[field];await DB.saveCandidate(c);el.querySelector('.cb-box').classList.toggle('checked');},

  // --- Generic detail (stages 4-7) ---
  renderGenericDetail(c,sid){
    const stage=Utils.getStage(sid);const p='stage'+sid+'_';
    let html=this.renderHistorySummary(c,sid);
    html+='<div class="section-title">תיאום</div><div class="card">';
    html+='<div class="form-group"><label class="form-label">תאריך</label>'
    +'<input type="date" class="form-input" value="'+(c[p+'date']||'')+'" onchange="Stages.saveField(\''+c.id+'\',\''+p+'date\',this.value)"></div>';
    html+='<div class="form-group"><label class="form-label">שעה</label>'
    +'<input type="time" class="form-input" value="'+(c[p+'time']||'')+'" onchange="Stages.saveField(\''+c.id+'\',\''+p+'time\',this.value)"></div>';
    html+='<div class="cb-row" onclick="Stages.toggleCheck(\''+c.id+'\',\''+p+'outlookEntered\',this)">'
    +'<div class="cb-box '+(c[p+'outlookEntered']?'checked':'')+'">✓</div><span class="cb-label">הוזן זימון ב-Outlook</span></div>';
    html+='<div class="cb-row" onclick="Stages.toggleCheck(\''+c.id+'\',\''+p+'inviteSent\',this)">'
    +'<div class="cb-box '+(c[p+'inviteSent']?'checked':'')+'">✓</div><span class="cb-label">נשלח זימון למועמד</span></div></div>';
    html+='<div style="padding:0 12px;margin:8px 0;">'
    +'<button class="btn btn-email btn-sm" onclick="Stages.sendUpdateEmail(\''+c.id+'\','+sid+')">✉️ שלח מייל עדכון</button></div>';
    html+=this.renderEvaluation(c,sid);return html;
  },

  renderHistorySummary(c,upTo){
    let items=[];if(c.createdAt)items.push('שלב 1: '+Utils.formatDate(c.createdAt));
    for(let s=2;s<upTo;s++){const g=c['stage'+s+'_grade'];const d=c['stage'+s+'_decision'];
      if(g||d)items.push('שלב '+s+': '+(g?'ציון '+g:'')+(d?' — '+(Utils.STATUSES[d]||d):''));}
    if(!items.length)return'';
    return '<div class="history-compact"><strong>היסטוריה:</strong> '+items.join(' | ')+'</div>';
  },

  // --- WhatsApp ---
  async sendWhatsApp(sid,cid){const c=await DB.getCandidate(cid);if(!c)return;
    let key='msgStage1';if(sid===2)key='msgStage2';else if(sid===3)key='msgStage3Coord';else if(sid>=4)key='msgStageInvite';
    let msg=App.settings[key]||'';msg=msg.replace('{name}',c.name||'').replace('{date}',c['stage'+sid+'_date']||'')
    .replace('{time}',c['stage'+sid+'_time']||'').replace('{stageName}',Utils.getStage(sid)?.name||'');
    Utils.openWhatsApp(c.phone,msg);},

  // --- Emails ---
  async sendUpdateEmail(id,sid){
    const c=await DB.getCandidate(id);const to=App.settings.email||'';
    if(!to){Utils.toast('לא הוגדר מייל בדף ניהול','danger');return;}
    const stage=Utils.getStage(sid);
    const subj='עדכון - '+c.name+' - '+stage.name;
    const body='שם: '+c.name+'\nשלב: '+stage.name+'\nציון: '+(c['stage'+sid+'_grade']||'')+'\nתוצאה: '+(Utils.STATUSES[c.status]||'');
    Utils.sendEmail(to,subj,body);},

  // --- Modal ---
  showModal(html){const o=document.createElement('div');o.className='modal-overlay';o.id='modalOverlay';
    o.innerHTML='<div class="modal">'+html+'</div>';o.addEventListener('click',e=>{if(e.target===o)Stages.closeModal();});
    document.body.appendChild(o);},
  closeModal(){const m=Utils.id('modalOverlay');if(m)m.remove();}
};

// Quick advance for stage 1
Stages.quickAdvance=async function(id,from){
  const c=await DB.getCandidate(id);c.status='pass';c['stage'+from+'_decision']='pass';
  c['stage'+from+'_completedAt']=new Date().toISOString();await DB.saveCandidate(c);await Stages.advanceToNextStage(id);
};
