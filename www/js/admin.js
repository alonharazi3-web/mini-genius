'use strict';
const Admin={
  async render(){
    const page=Utils.id('mainContent');const settings=await DB.getAllSettings();
    const recs=JSON.parse(settings.recruiters||'[]');const lead=settings.leadRecruiter||'';
    let html='<div class="page active"><div style="display:flex;align-items:center;gap:10px;padding:12px;">'
    +'<button class="btn btn-outline btn-sm" onclick="App.navigate(\'stage\','+App.currentStage+')">←</button>'
    +'<div style="font-size:1.1rem;font-weight:700;">⚙️ דף ניהול</div></div>';
    // Recruiters
    html+='<div class="admin-section"><h3>👥 רכזי גיוס</h3><div id="recruiterList">';
    recs.forEach((r,i)=>{html+='<span class="recruiter-chip '+(r===lead?'lead':'')+'">'+r+(r===lead?' ⭐':'')+' <span class="remove" onclick="Admin.removeRecruiter('+i+')">×</span></span>';});
    html+='</div><div style="display:flex;gap:6px;margin-top:10px;">'
    +'<input class="form-input" id="newRecruiter" placeholder="שם רכז חדש" style="flex:1;">'
    +'<button class="btn btn-primary btn-sm" onclick="Admin.addRecruiter()">הוסף</button></div>';
    if(recs.length){html+='<div class="form-group" style="margin-top:10px;"><label class="form-label">רכז מוביל</label>'
    +'<select class="form-select" id="leadSelect" onchange="Admin.setLead(this.value)">'
    +recs.map(r=>'<option value="'+r+'"'+(r===lead?' selected':'')+'>'+r+'</option>').join('')+'</select></div>';}
    html+='</div>';
    // Email & Phone
    html+='<div class="admin-section"><h3>📧 כתובות ומספרים</h3>'
    +'<div class="form-group"><label class="form-label">מייל לעדכונים</label>'
    +'<input class="form-input" id="sEmail" value="'+(settings.email||'')+'" type="email" dir="ltr" onchange="Admin.saveSetting(\'email\',this.value)"></div>'
    +'<div class="form-group"><label class="form-label">מספר מוקד מבחנים</label>'
    +'<input class="form-input" id="sExamPhone" value="'+(settings.examCenterPhone||'')+'" type="tel" dir="ltr" onchange="Admin.saveSetting(\'examCenterPhone\',this.value)"></div></div>';
    // Messages
    const msgs=[['msgStage1','שלב 1 — הודעת הזנה'],['msgStage2','שלב 2 — ניסו ליצור קשר'],['msgStage3Coord','שלב 3 — תיאום מבחן'],['msgStage3Results','שלב 3 — תוצאות'],['msgStageInvite','שלבים 4-7 — זימון'],['msgUnfreeze','ביטול הקפאה — חידוש קשר']];
    html+='<div class="admin-section"><h3>📱 הודעות WhatsApp</h3>'
    +'<div class="info-box">משתנים: {name}, {date}, {time}, {stageName}</div>';
    msgs.forEach(([k,l])=>{html+='<div class="form-group"><label class="form-label">'+l+'</label>'
    +'<textarea class="form-textarea" rows="2" onchange="Admin.saveSetting(\''+k+'\',this.value)">'+(settings[k]||'')+'</textarea></div>';});
    html+='</div>';
    // Alerts
    const alerts=[['alertDaysStage1','שלב 1'],['alertDaysStage2','שלב 2'],['alertDaysStage3Exam','שלב 3 (מבחן)'],['alertDaysStage3Transfer','שלב 3 (העברה)'],['alertDaysStage4','שלב 4'],['alertDaysStage5','שלב 5'],['alertDaysStage6','שלב 6'],['alertDaysStage7','שלב 7']];
    html+='<div class="admin-section"><h3>⏰ ספי התראות (ימי עבודה)</h3><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">';
    alerts.forEach(([k,l])=>{html+='<div class="form-group"><label class="form-label">'+l+'</label>'
    +'<input class="form-input" type="number" min="1" max="30" value="'+(settings[k]||5)+'" onchange="Admin.saveSetting(\''+k+'\',this.value)"></div>';});
    html+='</div></div></div>';page.innerHTML=html;
  },
  async addRecruiter(){const n=Utils.id('newRecruiter')?.value?.trim();if(!n)return;
    const recs=JSON.parse(App.settings.recruiters||'[]');if(recs.includes(n)){Utils.toast('רכז כבר קיים','danger');return;}
    if(recs.length>=4){Utils.toast('מקסימום 4','danger');return;}recs.push(n);
    await DB.setSetting('recruiters',JSON.stringify(recs));if(!App.settings.leadRecruiter)await DB.setSetting('leadRecruiter',n);
    await App.refreshSettings();this.render();},
  async removeRecruiter(i){const recs=JSON.parse(App.settings.recruiters||'[]');const rm=recs.splice(i,1)[0];
    await DB.setSetting('recruiters',JSON.stringify(recs));if(App.settings.leadRecruiter===rm&&recs.length)await DB.setSetting('leadRecruiter',recs[0]);
    await App.refreshSettings();this.render();},
  async setLead(n){await DB.setSetting('leadRecruiter',n);await App.refreshSettings();this.render();},
  async saveSetting(k,v){await DB.setSetting(k,v);await App.refreshSettings();Utils.toast('נשמר','success');}
};
