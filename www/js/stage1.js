'use strict';
const Stage1={
  renderForm(){
    var page=Utils.id('mainContent');
    var html='<div class="page active"><div style="display:flex;align-items:center;gap:10px;padding:14px;">'
    +'<button class="btn btn-outline btn-sm" onclick="App.navigate(\'stage\',1)">←</button>'
    +'<div style="font-size:1.15rem;font-weight:700;">מועמד חדש</div></div>'
    +'<div style="padding:0 14px;">'
    +'<div class="form-group"><label class="form-label">שם פרטי + אות שם משפחה <span class="required">*</span></label>'
    +'<input class="form-input" id="fName" placeholder="יוסי כ."></div>'
    +'<div class="form-group"><label class="form-label">מספר טלפון <span class="required">*</span></label>'
    +'<input class="form-input" id="fPhone" type="tel" placeholder="050-1234567" dir="ltr"></div>'
    +'<div class="form-group"><label class="form-label">ממליץ / רכז מפנה</label>'
    +'<input class="form-input" id="fReferrer"></div>'
    +'<div class="form-group"><label class="form-label">קורות חיים</label>'
    +'<div class="file-upload" id="cvUploadArea" onclick="Utils.id(\'cvFileInput\').click()">'
    +'📎 לחץ לצירוף קובץ</div>'
    +'<input type="file" id="cvFileInput" accept="*/*" style="display:none" onchange="Stage1.handleCvUpload(this)">'
    +'<div id="cvFileName" class="card-meta" style="margin-top:4px;"></div></div>'
    +'<div class="form-group"><label class="form-label">הערות</label>'
    +'<textarea class="form-textarea" id="fNotes" rows="2"></textarea></div>'
    +'<div class="form-group"><label class="form-label">עדיפות <span class="required">*</span></label>'
    +'<div class="radio-group" id="fPriority">'
    +'<div class="radio-btn" data-val="high" onclick="Stage1._sp(this)">🔴 גבוה</div>'
    +'<div class="radio-btn active" data-val="medium" onclick="Stage1._sp(this)">🟠 בינוני</div>'
    +'<div class="radio-btn" data-val="low" onclick="Stage1._sp(this)">🟢 נמוך</div></div></div>'
    +'<div class="form-group"><label class="form-label">תזכורת לשיחה</label>'
    +'<input class="form-input" id="fReminder" type="datetime-local"></div>'
    +'<div class="form-group"><label class="form-label">רכז מטפל <span class="required">*</span></label>'
    +'<select class="form-select" id="fRecruiter"><option value="">בחר...</option></select></div>'
    +'<div id="dupWarning" style="display:none;" class="warn-box">⚠️ מועמד עם אותו מספר טלפון כבר קיים</div>'
    +'<button class="btn btn-primary" style="width:100%;margin:16px 0;" onclick="Stage1.save()">שמור</button>'
    +'</div></div>';
    page.innerHTML=html;this._loadRecruiters();
    Utils.id('fPhone').addEventListener('blur',async function(){
      var phone=this.value.trim();if(phone.length>=9){
        var dups=await DB.findDups(phone);
        Utils.id('dupWarning').style.display=dups.length?'block':'none';
      }
    });
  },
  _cvData:null,_cvName:null,
  handleCvUpload(input){
    if(!input.files||!input.files[0])return;
    var file=input.files[0];Stage1._cvName=file.name;
    var reader=new FileReader();
    reader.onload=function(e){
      Stage1._cvData=e.target.result;
      Utils.id('cvUploadArea').classList.add('file-uploaded');
      Utils.id('cvUploadArea').textContent='✅ '+file.name;
      Utils.id('cvFileName').textContent='גודל: '+(file.size/1024).toFixed(1)+' KB';
    };
    reader.readAsDataURL(file);
  },
  _sp(el){el.parentElement.querySelectorAll('.radio-btn').forEach(function(b){b.classList.remove('active')});el.classList.add('active');},
  _loadRecruiters(){
    var sel=Utils.id('fRecruiter');var recs=JSON.parse(App.settings.recruiters||'[]');
    recs.forEach(function(r){var o=document.createElement('option');o.value=r;o.textContent=r;sel.appendChild(o);});
  },
  async save(){
    var name=Utils.id('fName')?.value?.trim();var phone=Utils.id('fPhone')?.value?.trim();
    var recruiter=Utils.id('fRecruiter')?.value;
    if(!name||!phone){Utils.toast('נא למלא שם וטלפון','danger');return;}
    if(!recruiter){Utils.toast('נא לבחור רכז','danger');return;}
    var priority='medium';var active=document.querySelector('#fPriority .radio-btn.active');
    if(active)priority=active.dataset.val;
    var c={name:name,phone:phone,stage:1,status:'active',priority:priority,
      referrer:Utils.id('fReferrer')?.value||'',notes:Utils.id('fNotes')?.value||'',
      recruiter:recruiter,jobId:App.currentJob,stageEnteredAt:new Date().toISOString()};
    // CV file
    if(Stage1._cvData){
      var fRec=await DB.saveFile({name:Stage1._cvName,data:Stage1._cvData,candidateId:'pending'});
      c.cvFileId=fRec.id;c.cvFileName=Stage1._cvName;
    }
    c=await DB.saveCandidate(c);
    if(Stage1._cvData&&c.cvFileId){var f=await DB.getFile(c.cvFileId);f.candidateId=c.id;await DB.saveFile(f);}
    DB.logAction('מועמד חדש',c.name);
    // Reminder
    var rem=Utils.id('fReminder')?.value;
    if(rem){var parts=rem.split('T');Utils.scheduleReminder('התקשר ל'+name,parts[0],parts[1]);}
    Stage1._cvData=null;Stage1._cvName=null;
    Utils.toast('מועמד נשמר! 🎉','success');App.navigate('stage',1);
  },
  renderDetail(c){
    var html='';
    // Save to contacts button
    html+='<div style="padding:8px 14px;">'
    +'<button class="btn btn-primary btn-sm" onclick="Utils.saveToContacts(\''+Utils.escHtml(c.name)+'\',\''+c.phone+'\',\'Mini Genius\')">📇 שמור באנשי קשר</button>';
    if(c.cvFileName)html+=' <button class="btn btn-outline btn-sm" onclick="Stage1.openCv(\''+c.id+'\')">'+c.cvFileName+'</button>';
    html+='</div>';
    // Info
    html+='<div class="card"><div class="card-meta">'
    +'ממליץ: '+(c.referrer||'-')+' | רכז: '+(c.recruiter||'-')
    +'</div>';
    if(c.notes)html+='<div class="card-meta" style="margin-top:6px;">הערות: '+Utils.escHtml(c.notes)+'</div>';
    html+='</div>';
    // Reminder
    html+='<div style="padding:6px 14px;">'
    +'<button class="btn btn-outline btn-sm" onclick="Stage1.setReminder(\''+c.id+'\')">🔔 הוסף תזכורת</button></div>';
    html+=Stages.renderEvaluation(c,1);
    return html;
  },
  setReminder(id){
    var html='<div class="modal-title">🔔 הוספת תזכורת</div>'
    +'<div class="form-group"><label class="form-label">תאריך ושעה</label>'
    +'<input class="form-input" id="remDateTime" type="datetime-local"></div>'
    +'<button class="btn btn-primary" style="width:100%;margin-top:12px;" onclick="Stage1.confirmReminder(\''+id+'\')">'+'הוסף</button>';
    Stages.showModal(html);
  },
  async confirmReminder(id){
    var dt=Utils.id('remDateTime')?.value;if(!dt){Utils.toast('בחר תאריך','danger');return;}
    var c=await DB.getCandidate(id);var parts=dt.split('T');
    Utils.scheduleReminder('התקשר ל'+c.name,parts[0],parts[1]);
    Stages.closeModal();
  },
  async openCv(id){
    var c=await DB.getCandidate(id);if(!c||!c.cvFileId)return;
    var f=await DB.getFile(c.cvFileId);if(!f||!f.data)return;
    // Open the base64 data
    var a=document.createElement('a');a.href=f.data;a.download=f.name||'cv';
    document.body.appendChild(a);a.click();document.body.removeChild(a);
  }
};
