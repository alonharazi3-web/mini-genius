'use strict';
const Stages={
  async stopProcess(cid){
    var c=await DB.getCandidate(cid);if(!c)return;
    var html='<div class="modal-title">⛔ הפסקת תהליך — '+Utils.escHtml(c.name)+'</div>'
    +'<div class="form-group"><label class="form-label">סיבת הפסקה <span class="required">*</span></label>'
    +'<textarea class="form-textarea" id="stopReason" rows="3"></textarea></div>'
    +'<div class="cb-row" onclick="this.querySelector(\'.cb-box\').classList.toggle(\'checked\')">'
    +'<div class="cb-box" id="stopPhoneConfirm">✓</div>'
    +'<span>הודעה טלפונית נמסרה</span></div>'
    +'<div style="display:flex;gap:8px;margin-top:16px;">'
    +'<button class="btn btn-danger" style="flex:1" onclick="Stages.confirmStop(\''+c.id+'\')">אשר הפסקה</button>'
    +'<button class="btn btn-outline" style="flex:1" onclick="Stages.closeModal()">ביטול</button></div>';
    this.showModal(html);
  },
  async confirmStop(id){
    var reason=Utils.id('stopReason')?.value?.trim();
    var phoneOk=Utils.id('stopPhoneConfirm')?.classList.contains('checked');
    if(!reason){Utils.toast('נא למלא סיבה','danger');return;}
    if(!phoneOk){Utils.toast('נא לאשר שהודעה נמסרה','danger');return;}
    var c=await DB.getCandidate(id);
    c.status='stopped';c.stopReason=reason;c.stoppedAt=new Date().toISOString();
    await DB.saveCandidate(c);DB.logAction('הפסקה',c.name);
    this.closeModal();Utils.toast('התהליך הופסק','success');App.navigate('stage',c.stage);
  },

  async freezeCandidate(cid){
    var c=await DB.getCandidate(cid);if(!c)return;
    var html='<div class="modal-title">❄️ הקפאת מועמד — '+Utils.escHtml(c.name)+'</div>'
    +'<div class="form-group"><label class="form-label">סיבה <span class="required">*</span></label>'
    +'<textarea class="form-textarea" id="freezeReason" rows="2"></textarea></div>'
    +'<div class="form-group"><label class="form-label">תאריך סיום הקפאה</label>'
    +'<input class="form-input" id="freezeEnd" type="date"></div>'
    +'<div style="display:flex;gap:8px;margin-top:16px;">'
    +'<button class="btn btn-purple" style="flex:1" onclick="Stages.confirmFreeze(\''+c.id+'\')">הקפא</button>'
    +'<button class="btn btn-outline" style="flex:1" onclick="Stages.closeModal()">ביטול</button></div>';
    this.showModal(html);
  },
  async confirmFreeze(id){
    var reason=Utils.id('freezeReason')?.value?.trim();
    var endDate=Utils.id('freezeEnd')?.value;
    if(!reason){Utils.toast('נא למלא סיבה','danger');return;}
    var c=await DB.getCandidate(id);
    c.prevStatus=c.status;c.frozenFromStage=c.stage;c.status='frozen';
    c.freezeReason=reason;c.freezeEndDate=endDate||'';c.frozenAt=new Date().toISOString();
    await DB.saveCandidate(c);DB.logAction('הקפאה',c.name);
    this.closeModal();Utils.toast('מועמד הוקפא','success');App.navigate('stage',c.stage);
  },
  async unfreezeCandidate(cid){
    var c=await DB.getCandidate(cid);if(!c)return;
    c.status=c.prevStatus||'active';c.unfrozenAt=new Date().toISOString();
    await DB.saveCandidate(c);DB.logAction('ביטול הקפאה',c.name);
    // FIX #3: Ask before sending WhatsApp (not automatic)
    var msg=(App.settings.msgUnfreeze||'').replace('{name}',c.name);
    if(msg){
      Stages.showModal('<div class="modal-title">שלח הודעת עדכון?</div>'
      +'<p>האם לשלוח הודעת WhatsApp ל'+Utils.escHtml(c.name)+'?</p>'
      +'<div style="display:flex;gap:8px;margin-top:16px;">'
      +'<button class="btn btn-wa" style="flex:1" onclick="Stages.closeModal();Utils.openWhatsApp(\''+c.phone+'\',\''+msg.replace(/'/g,"\\'")+'\')">📱 כן, שלח</button>'
      +'<button class="btn btn-outline" style="flex:1" onclick="Stages.closeModal()">לא עכשיו</button></div>');
    }
    Utils.toast('הוקפא בוטל','success');App.renderCandidateView(cid);
  },

  sendWhatsApp(stageId,id){
    DB.getCandidate(id).then(function(c){if(!c)return;
      var key='msgStage'+stageId;var msg=App.settings[key]||App.settings.msgStage1||'';
      msg=msg.replace('{name}',c.name).replace('{stageName}',Utils.getStageName(stageId));
      Utils.openWhatsApp(c.phone,msg);
    });
  },

  saveField(id,field,val){
    App.markDirty(id,field,val);Utils.toast('נשמר','success');
  },

  async toggleCheck(id,field,el){
    var c=await DB.getCandidate(id);if(!c)return;
    c[field]=!c[field];if(c[field])c[field+'At']=new Date().toISOString();
    await DB.saveCandidate(c);
    var box=el.querySelector('.cb-box');if(box)box.classList.toggle('checked');
  },

  // FIX #10: History shows /7 instead of /10
  renderHistorySummary(c,currentStage){
    var html='<div class="history-compact">';
    for(var i=1;i<currentStage;i++){
      var stageName=Utils.getStageName(i);
      html+='<div>✅ '+stageName;
      if(c['stage'+i+'_grade'])html+=' — ציון: '+c['stage'+i+'_grade']+'/7';
      if(c['stage'+i+'_completedAt'])html+=' ('+Utils.formatDate(c['stage'+i+'_completedAt'])+')';
      html+='</div>';
    }
    html+='</div>';
    return html;
  },

  // FIX #10: Grade scale 1-7
  renderEvaluation(c,stageId){
    var grade=c['stage'+stageId+'_grade']||'';
    var html='<div class="section-title">הערכה</div><div class="card">'
    +'<div class="form-group"><label class="form-label">ציון 1-7</label><div class="scale-group">';
    for(var g=1;g<=7;g++){
      var cls=grade==g?(g>=5?'active':'fail'):'';
      html+='<div class="scale-btn '+cls+'" onclick="Stages.setGrade(\''+c.id+'\','+stageId+','+g+')">'+g+'</div>';
    }
    html+='</div></div>';
    html+='<div class="form-group"><label class="form-label">הערות</label>'
    +'<textarea class="form-textarea" rows="2" onchange="Stages.saveField(\''+c.id+'\',\'stage'+stageId+'_notes\',this.value)">'+Utils.escHtml(c['stage'+stageId+'_notes']||'')+'</textarea></div>';
    html+='<div class="form-group"><label class="form-label">החלטה</label><div class="radio-group">'
    +'<div class="radio-btn '+(c.status==='pass'?'active-success':'')+'" onclick="Stages.setDecision(\''+c.id+'\','+stageId+',\'pass\')">עובר</div>'
    +'<div class="radio-btn '+(c.status==='fail'?'active-danger':'')+'" onclick="Stages.setDecision(\''+c.id+'\','+stageId+',\'fail\')">לא עובר</div>'
    +'<div class="radio-btn '+(c.status==='hesitation'?'active':'')+'" onclick="Stages.setDecision(\''+c.id+'\','+stageId+',\'hesitation\')">התלבטות</div>'
    +'</div></div></div>';
    // FIX #3: Advance button asks about WhatsApp
    if(c.status==='pass'&&stageId<7){
      html+='<div style="padding:12px;"><button class="btn btn-success" style="width:100%;" onclick="Stages.advanceToNextStage(\''+c.id+'\')">העבר ל'+Utils.getStageName(stageId+1)+'</button></div>';
    }
    if(stageId===7&&c.status==='pass'){
      html+='<div style="padding:12px;"><button class="btn btn-success" style="width:100%;" onclick="Stages.acceptCandidate(\''+c.id+'\')">✅ התקבל!</button></div>';
    }
    return html;
  },

  async setGrade(id,stageId,grade){
    var c=await DB.getCandidate(id);c['stage'+stageId+'_grade']=grade;
    await DB.saveCandidate(c);App.renderCandidateView(id);
  },
  async setDecision(id,stageId,decision){
    var c=await DB.getCandidate(id);c.status=decision;
    c['stage'+stageId+'_decision']=decision;c['stage'+stageId+'_completedAt']=new Date().toISOString();
    await DB.saveCandidate(c);DB.logAction('החלטה',c.name+' - '+decision);
    App.renderCandidateView(id);
  },
  // FIX #3: Ask before WhatsApp on stage advance
  async advanceToNextStage(id){
    var c=await DB.getCandidate(id);var next=c.stage+1;
    c['stage'+c.stage+'_completedAt']=new Date().toISOString();
    c.stage=next;c.status='active';c.stageEnteredAt=new Date().toISOString();
    await DB.saveCandidate(c);DB.logAction('קידום',c.name+' → '+Utils.getStageName(next));
    Utils.toast(c.name+' עבר ל'+Utils.getStageName(next),'success');
    // Ask if user wants to send WhatsApp update
    var msgKey='msgStage'+next;
    var msg=App.settings[msgKey]||'';
    if(msg&&c.phone){
      msg=msg.replace('{name}',c.name).replace('{stageName}',Utils.getStageName(next));
      var safePhone=c.phone.replace(/'/g,'');
      var safeMsg=msg.replace(/'/g,"\\'");
      Stages.showModal('<div class="modal-title">📱 שלח הודעת עדכון?</div>'
      +'<p>'+Utils.escHtml(c.name)+' עבר ל'+Utils.getStageName(next)+'</p>'
      +'<p style="color:var(--text-light);font-size:.85rem;">האם לשלוח הודעת WhatsApp?</p>'
      +'<div style="display:flex;gap:8px;margin-top:16px;">'
      +'<button class="btn btn-wa" style="flex:1" onclick="Stages.closeModal();Utils.openWhatsApp(\''+safePhone+'\',\''+safeMsg+'\')">📱 כן, שלח</button>'
      +'<button class="btn btn-outline" style="flex:1" onclick="Stages.closeModal();App.navigate(\'stage\','+next+')">לא עכשיו</button></div>');
    }else{
      App.navigate('stage',next);
    }
  },
  // FIX #11 v2.5: flush dirty BEFORE setting accepted to prevent race condition overwrite
  async acceptCandidate(id){
    await App.flushDirty(); // prevent dirty 'pass' status from overwriting 'accepted'
    var c=await DB.getCandidate(id);c.status='accepted';c.acceptedAt=new Date().toISOString();
    c.stage7_decision='accepted';c.stage7_completedAt=new Date().toISOString();
    await DB.saveCandidate(c);DB.logAction('התקבלות',c.name);
    Utils.toast(c.name+' התקבל! 🎉','success');
    // FIX #10 v2.5: Show completion message buttons
    var notifPhone=App.settings.notifCenterPhone||'';
    var notifMsg=(App.settings.notifCenterMsg||'').replace('{name}',c.name);
    var secPhone=App.settings.factorySecretaryPhone||'';
    var secMsg=(App.settings.factorySecretaryMsg||'').replace('{name}',c.name);
    var html='<div class="modal-title">🎉 '+Utils.escHtml(c.name)+' התקבל!</div>'
    +'<div style="display:flex;flex-direction:column;gap:10px;">';
    if(notifPhone&&notifMsg){
      html+='<button class="btn btn-wa" style="width:100%;" onclick="Stages.closeModal();Utils.openWhatsApp(\''+notifPhone+'\',\''+notifMsg.replace(/'/g,"\\'")+'\')">📱 הודעה למוקד הודעות</button>';
    }
    if(secPhone&&secMsg){
      html+='<button class="btn btn-wa" style="width:100%;" onclick="Stages.closeModal();Utils.openWhatsApp(\''+secPhone+'\',\''+secMsg.replace(/'/g,"\\'")+'\')">📱 הודעה למזכירת מפעל</button>';
    }
    if(!notifPhone&&!secPhone){
      html+='<div class="info-box">הגדר מספרי טלפון בדף ניהול כדי לשלוח הודעות סיום</div>';
    }
    html+='<button class="btn btn-outline" style="width:100%;margin-top:8px;" onclick="Stages.closeModal();App.navigate(\'stage\',7)">סגור</button></div>';
    Stages.showModal(html);
  },

  // Generic detail for stages 4-7
  renderGenericDetail(c){
    var stageId=c.stage;var html='';
    html+=this.renderHistorySummary(c,stageId);
    var stageName=Utils.getStageName(stageId);
    html+='<div class="section-title">'+stageName+'</div><div class="card">';
    html+='<div class="form-group"><label class="form-label">תאריך</label>'
    +'<input type="date" class="form-input" value="'+(c['stage'+stageId+'_date']||'')+'" onchange="Stages.saveField(\''+c.id+'\',\'stage'+stageId+'_date\',this.value)"></div>';
    html+='<div class="form-group"><label class="form-label">שעה</label>'
    +'<input type="time" class="form-input" value="'+(c['stage'+stageId+'_time']||'')+'" onchange="Stages.saveField(\''+c.id+'\',\'stage'+stageId+'_time\',this.value)"></div>';
    if(stageId===6){
      html+='<div class="form-group"><label class="form-label">שם מנהל מצטרף</label>'
      +'<input class="form-input" value="'+Utils.escHtml(c.stage6_managerName||'')+'" onchange="Stages.saveField(\''+c.id+'\',\'stage6_managerName\',this.value)" placeholder="שם מנהל"></div>';
      // FIX #9 v2.5: share via WhatsApp contact picker instead of typing manager phone
      if(c.stage6_date){
        html+='<button class="btn btn-wa btn-sm" onclick="Stages.sendManagerReminder(\''+c.id+'\')">📱 שלח תזכורת למנהל (בחר איש קשר)</button>';
      }
    }
    html+='<div class="cb-row" onclick="Stages.toggleCheck(\''+c.id+'\',\'stage'+stageId+'_done\',this)">'
    +'<div class="cb-box '+(c['stage'+stageId+'_done']?'checked':'')+'">✓</div>'
    +'<span>בוצע</span></div>';
    html+='<div style="margin-top:8px;"><button class="btn btn-wa btn-sm" onclick="Stages.sendInvite(\''+c.id+'\','+stageId+')">📱 שלח זימון</button></div>';
    html+='</div>';
    if(c['stage'+stageId+'_date']){
      html+='<div style="padding:6px 14px;"><button class="btn btn-outline btn-sm" onclick="Utils.scheduleReminder(\''+Utils.escHtml(c.name)+' - '+Utils.escHtml(stageName)+'\',\''+c['stage'+stageId+'_date']+'\',\''+(c['stage'+stageId+'_time']||'09:00')+'\')">🔔 הוסף תזכורת</button></div>';
    }
    html+=this.renderEvaluation(c,stageId);
    return html;
  },

  async sendInvite(id,stageId){
    var c=await DB.getCandidate(id);if(!c)return;
    var msg=(App.settings.msgStageInvite||'').replace('{name}',c.name)
      .replace('{stageName}',Utils.getStageName(stageId))
      .replace('{date}',c['stage'+stageId+'_date']||'').replace('{time}',c['stage'+stageId+'_time']||'');
    Utils.openWhatsApp(c.phone,msg);
  },

  // FIX #9 v2.5: share message, user picks WhatsApp contact
  async sendManagerReminder(id){
    var c=await DB.getCandidate(id);if(!c)return;
    var managerName=c.stage6_managerName||'מנהל';
    var msg='שלום '+managerName+', תזכורת לראיון מתקדם עם '+c.name
    +' בתאריך '+(c.stage6_date||'')+' בשעה '+(c.stage6_time||'');
    Utils.shareWhatsApp(msg);
  },

  showModal(html){
    var existing=document.querySelector('.modal-overlay');if(existing)existing.remove();
    var overlay=document.createElement('div');overlay.className='modal-overlay';
    overlay.innerHTML='<div class="modal">'+html+'</div>';
    overlay.addEventListener('click',function(e){if(e.target===overlay)overlay.remove()});
    document.body.appendChild(overlay);
  },
  closeModal(){var m=document.querySelector('.modal-overlay');if(m)m.remove();}
};
