'use strict';
const Stage3={
  renderDetail(c){
    let html='';html+=Stages.renderHistorySummary(c,3);
    html+='<div class="section-title">תיאום מבחן</div><div class="card">';
    html+='<div class="cb-row" onclick="Stages.toggleCheck(\''+c.id+'\',\'stage3_assigned\',this)">'
    +'<div class="cb-box '+(c.stage3_assigned?'checked':'')+'">✓</div><span class="cb-label">שובץ למבחן</span></div>';
    html+='<div class="form-group"><label class="form-label">תאריך מבחן</label>'
    +'<input type="date" class="form-input" value="'+(c.stage3_examDate||'')+'" onchange="Stages.saveField(\''+c.id+'\',\'stage3_examDate\',this.value)"></div>';
    html+='<div class="cb-row" onclick="Stages.toggleCheck(\''+c.id+'\',\'stage3_systemUpdated\',this)">'
    +'<div class="cb-box '+(c.stage3_systemUpdated?'checked':'')+'">✓</div><span class="cb-label">עודכן במערכת</span></div>';
    html+='<div style="display:flex;gap:6px;margin-top:8px;">'
    +'<button class="btn btn-wa btn-sm" onclick="Stages.sendWhatsApp(3,\''+c.id+'\')">📱 הודעה למועמד</button>'
    +'<button class="btn btn-wa btn-sm" onclick="Stage3.sendToExamCenter(\''+c.id+'\')">📱 הודעה למוקד</button></div></div>';
    html+='<div class="section-title">תוצאות</div><div class="card">';
    html+='<div class="form-group"><label class="form-label">תוצאה</label><div class="radio-group">'
    +'<div class="radio-btn '+(c.stage3_result==='pass'?'active-success':'')+'" onclick="Stage3._setResult(\''+c.id+'\',\'pass\')">עובר</div>'
    +'<div class="radio-btn '+(c.stage3_result==='fail'?'active-danger':'')+'" onclick="Stage3._setResult(\''+c.id+'\',\'fail\')">לא עובר</div></div></div>';
    html+='<div class="form-group"><label class="form-label">הערות</label>'
    +'<textarea class="form-textarea" rows="2" onchange="Stages.saveField(\''+c.id+'\',\'stage3_notes\',this.value)">'+Utils.escHtml(c.stage3_notes||'')+'</textarea></div></div>';
    if(c.stage3_result==='pass')html+='<div style="padding:12px;"><button class="btn btn-success" style="width:100%;" onclick="Stages.advanceToNextStage(\''+c.id+'\')">העבר לשלב 4</button></div>';
    if(c.stage3_examDate&&!c.stage3_result){const d=Utils.workDaysSince(c.stage3_examDate);
      if(d>=parseInt(App.settings.alertDaysStage3Exam||4))html+='<div class="warn-box">⚠️ '+d+' ימי עבודה מאז המבחן — לא הוזנה תוצאה!</div>';}
    return html;
  },
  async _setResult(id,result){const c=await DB.getCandidate(id);c.stage3_result=result;c.stage3_resultAt=new Date().toISOString();
    c.status=result==='pass'?'pass':'fail';
    if(result==='pass'){const msg=(App.settings.msgStage3Results||'').replace('{name}',c.name);if(msg)Utils.openWhatsApp(c.phone,msg);}
    await DB.saveCandidate(c);App.renderCandidateView(id);},
  async sendToExamCenter(id){const c=await DB.getCandidate(id);const phone=App.settings.examCenterPhone||'';
    if(!phone){Utils.toast('לא הוגדר מספר מוקד','danger');return;}
    Utils.openWhatsApp(phone,'שלום, מועמד: '+c.name+', טלפון: '+c.phone+(c.stage3_examDate?', תאריך: '+c.stage3_examDate:''));}
};
