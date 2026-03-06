'use strict';
const Admin={
  async render(){
    var page=Utils.id('mainContent');var settings=await DB.getAllSettings();
    var recs=JSON.parse(settings.recruiters||'[]');var lead=settings.leadRecruiter||'';
    var html='<div class="page active"><div style="display:flex;align-items:center;gap:10px;padding:14px;">'
    +'<button class="btn btn-outline btn-sm" onclick="App.navigate(\'stage\','+App.currentStage+')">←</button>'
    +'<div style="font-size:1.15rem;font-weight:700;">⚙️ דף ניהול</div></div>';

    // Job cycles management
    html+='<div class="admin-section"><h3>💼 מחזורי גיוס</h3>';
    var jobs=await DB.getAllJobs();
    jobs.forEach(function(j){
      var isActive=j.id===App.currentJob;
      html+='<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);">'
      +'<span style="flex:1;font-weight:'+(isActive?'700':'400')+';">'+(isActive?'⭐ ':'')+Utils.escHtml(j.name)+'</span>';
      if(!isActive)html+='<button class="btn btn-primary btn-sm" onclick="Admin.switchJob(\''+j.id+'\')">הפעל</button>';
      html+='</div>';
    });
    html+='<div style="display:flex;gap:6px;margin-top:10px;">'
    +'<input class="form-input" id="newJobName" placeholder="שם מחזור חדש" style="flex:1;">'
    +'<button class="btn btn-primary btn-sm" onclick="Admin.addJob()">הוסף</button></div></div>';

    // Recruiters
    html+='<div class="admin-section"><h3>👥 רכזי גיוס</h3><div id="recruiterList">';
    recs.forEach(function(r,i){html+='<span class="recruiter-chip '+(r===lead?'lead':'')+'">'+r+(r===lead?' ⭐':'')+' <span class="remove" onclick="Admin.removeRecruiter('+i+')">×</span></span>';});
    html+='</div><div style="display:flex;gap:6px;margin-top:10px;">'
    +'<input class="form-input" id="newRecruiter" placeholder="שם רכז חדש" style="flex:1;">'
    +'<button class="btn btn-primary btn-sm" onclick="Admin.addRecruiter()">הוסף</button></div>';
    if(recs.length){html+='<div class="form-group" style="margin-top:10px;"><label class="form-label">רכז מוביל</label>'
    +'<select class="form-select" id="leadSelect" onchange="Admin.setLead(this.value)">'
    +recs.map(function(r){return '<option value="'+r+'"'+(r===lead?' selected':'')+'>'+r+'</option>'}).join('')+'</select></div>';}
    html+='</div>';

    // Email & Phone
    html+='<div class="admin-section"><h3>📧 כתובות ומספרים</h3>'
    +'<div class="form-group"><label class="form-label">מייל לעדכונים</label>'
    +'<input class="form-input" id="sEmail" value="'+(settings.email||'')+'" type="email" dir="ltr" onchange="Admin.saveSetting(\'email\',this.value)"></div>'
    +'<div class="form-group"><label class="form-label">מספר מוקד מבחנים</label>'
    +'<input class="form-input" id="sExamPhone" value="'+(settings.examCenterPhone||'')+'" type="tel" dir="ltr" onchange="Admin.saveSetting(\'examCenterPhone\',this.value)"></div>'
    +'</div>';

    // FIX #10 v2.5: Notification center + Factory secretary
    html+='<div class="admin-section"><h3>🏭 הודעות סיום תהליך</h3>'
    +'<div class="info-box">הודעות שישלחו כשמועמד מתקבל. משתנים: {name}</div>'
    +'<div class="form-group"><label class="form-label">טלפון מוקד הודעות</label>'
    +'<input class="form-input" type="tel" dir="ltr" value="'+(settings.notifCenterPhone||'')+'" onchange="Admin.saveSetting(\'notifCenterPhone\',this.value)"></div>'
    +'<div class="form-group"><label class="form-label">הודעה למוקד</label>'
    +'<textarea class="form-textarea" rows="2" onchange="Admin.saveSetting(\'notifCenterMsg\',this.value)">'+(settings.notifCenterMsg||'')+'</textarea></div>'
    +'<div class="form-group"><label class="form-label">טלפון מזכירת מפעל</label>'
    +'<input class="form-input" type="tel" dir="ltr" value="'+(settings.factorySecretaryPhone||'')+'" onchange="Admin.saveSetting(\'factorySecretaryPhone\',this.value)"></div>'
    +'<div class="form-group"><label class="form-label">הודעה למזכירה</label>'
    +'<textarea class="form-textarea" rows="2" onchange="Admin.saveSetting(\'factorySecretaryMsg\',this.value)">'+(settings.factorySecretaryMsg||'')+'</textarea></div>'
    +'</div>';

    // FIX #9: Transcription service settings
    var tSvc=settings.transcriptionService||'';
    html+='<div class="admin-section"><h3>🎙️ הגדרות תמלול</h3>'
    +'<div class="form-group"><label class="form-label">שירות תמלול</label><div class="radio-group">'
    +'<div class="radio-btn '+(tSvc==='assemblyai'?'active-success':'')+'" onclick="Admin._pickTransSvc(\'assemblyai\',this)">AssemblyAI (חינם)</div>'
    +'<div class="radio-btn '+(tSvc==='whisper'?'active-success':'')+'" onclick="Admin._pickTransSvc(\'whisper\',this)">Whisper (שרת עצמי)</div>'
    +'</div></div>'
    +'<div class="form-group"><label class="form-label">AssemblyAI API Key</label>'
    +'<input class="form-input" id="sAssemblyKey" value="'+(settings.assemblyAiKey||'')+'" dir="ltr" placeholder="הרשם ב-assemblyai.com — $50 קרדיט חינם" onchange="Admin.saveSetting(\'assemblyAiKey\',this.value)"></div>'
    +'<div class="form-group"><label class="form-label">Whisper Server URL</label>'
    +'<input class="form-input" id="sWhisper" value="'+(settings.whisperServerUrl||'')+'" type="url" dir="ltr" placeholder="https://your-server/api/transcribe" onchange="Admin.saveSetting(\'whisperServerUrl\',this.value)"></div></div>';

    // WhatsApp messages
    var msgs=[['msgStage1','📌 לידים — הודעת הזנה'],
    ['msgStage2','📞 ראיון טלפוני — ניסו קשר'],
    ['msgStage3Coord','📝 מטלה — תיאום מבחן'],
    ['msgStage3Results','📝 מטלה — תוצאות'],
    ['msgStageInvite','🤝 שלבים 4-7 — זימון'],
    ['msgUnfreeze','❄️ ביטול הקפאה — חידוש קשר']];
    html+='<div class="admin-section"><h3>📱 הודעות WhatsApp</h3>'
    +'<div class="info-box">משתנים: {name}, {date}, {time}, {stageName}</div>';
    msgs.forEach(function(m){html+='<div class="form-group"><label class="form-label">'+m[1]+'</label>'
    +'<textarea class="form-textarea" rows="2" onchange="Admin.saveSetting(\''+m[0]+'\',this.value)">'+(settings[m[0]]||'')+'</textarea></div>';});
    html+='</div>';

    // Alert days
    html+='<div class="admin-section"><h3>⏰ ימי התראה לעיכוב</h3>';
    for(var i=1;i<=7;i++){
      var st=Utils.getStage(i);var key='alertDaysStage'+i;
      html+='<div style="display:flex;align-items:center;gap:8px;padding:4px 0;">'
      +'<span style="flex:1;font-size:.88rem;">'+st.icon+' '+st.name+'</span>'
      +'<input class="form-input" type="number" min="1" max="30" value="'+(settings[key]||5)+'" '
      +'style="width:60px;text-align:center;" onchange="Admin.saveSetting(\''+key+'\',this.value)"> ימים</div>';
    }
    html+='</div>';

    // Data management
    html+='<div class="admin-section"><h3>💾 ניהול נתונים</h3>'
    +'<button class="btn btn-primary" style="width:100%;margin-bottom:8px;" onclick="Admin.exportData()">📤 ייצוא כל הנתונים</button>'
    +'<button class="btn btn-outline" style="width:100%;" onclick="Admin.importData()">📥 ייבוא נתונים</button>'
    +'<input type="file" id="importFile" accept=".json" style="display:none" onchange="Admin.processImport(this)">'
    +'</div></div>';

    page.innerHTML=html;
  },

  async saveSetting(key,val){await DB.setSetting(key,val);App.settings[key]=val;},
  _pickTransSvc(svc,el){
    el.parentElement.querySelectorAll('.radio-btn').forEach(function(b){b.className='radio-btn';});
    el.classList.add('radio-btn','active-success');
    Admin.saveSetting('transcriptionService',svc);
  },
  async addRecruiter(){
    var name=Utils.id('newRecruiter')?.value?.trim();if(!name)return;
    var recs=JSON.parse(App.settings.recruiters||'[]');
    if(recs.indexOf(name)>=0){Utils.toast('רכז כבר קיים','warning');return;}
    recs.push(name);await this.saveSetting('recruiters',JSON.stringify(recs));
    Utils.toast('רכז נוסף','success');this.render();
  },
  async removeRecruiter(idx){
    var recs=JSON.parse(App.settings.recruiters||'[]');recs.splice(idx,1);
    await this.saveSetting('recruiters',JSON.stringify(recs));this.render();
  },
  async setLead(name){await this.saveSetting('leadRecruiter',name);Utils.toast('רכז מוביל עודכן','success');},
  async addJob(){
    var name=Utils.id('newJobName')?.value?.trim();if(!name)return;
    await DB.saveJob({name:name,active:true});Utils.toast('מחזור נוסף','success');this.render();
  },
  async switchJob(jobId){
    App.currentJob=jobId;await this.saveSetting('activeJobId',jobId);
    App.renderJobLabel();Utils.toast('מחזור הוחלף','success');this.render();
  },
  async exportData(){
    // FIX #2 v2.5: include ALL stores
    var data={candidates:await DB.getAllCandidates(),settings:await DB.getAllSettings(),
      jobs:await DB.getAllJobs(),tasks:await DB.getAllTasks(),
      daylog:await DB.getAll('daylog'),files:await DB.getAll('files'),
      exportDate:new Date().toISOString(),version:'2.5'};
    var json=JSON.stringify(data,null,2);
    var filename='minigenius_backup_'+Utils.today()+'.json';
    Utils.writeToCacheAndShare(filename,json,'application/json','Mini Genius גיבוי');
  },
  importData(){Utils.id('importFile')?.click()},
  async processImport(input){
    if(!input.files||!input.files[0])return;
    var reader=new FileReader();
    reader.onload=async function(e){
      try{
        var data=JSON.parse(e.target.result);
        if(data.candidates){for(var i=0;i<data.candidates.length;i++){await DB.put('candidates',data.candidates[i]);}}
        if(data.jobs){for(var i=0;i<data.jobs.length;i++){await DB.put('jobs',data.jobs[i]);}}
        if(data.tasks){for(var i=0;i<data.tasks.length;i++){await DB.put('tasks',data.tasks[i]);}}
        if(data.daylog){for(var i=0;i<data.daylog.length;i++){await DB.put('daylog',data.daylog[i]);}}
        if(data.files){for(var i=0;i<data.files.length;i++){await DB.put('files',data.files[i]);}}
        if(data.settings){var s=data.settings;for(var k in s){if(s[k]&&s[k].key)await DB.put('settings',s[k]);}}
        App.settings=await DB.getAllSettings();
        Utils.toast('ייבוא הושלם!','success');Admin.render();
      }catch(err){Utils.toast('שגיאה בייבוא','danger');_dbg('Import err:'+err);}
    };
    reader.readAsText(input.files[0]);
  }
};
