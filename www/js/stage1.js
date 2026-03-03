'use strict';
const Stage1={
  renderForm(){
    const page=Utils.id('mainContent');
    let html='<div class="page active"><div style="display:flex;align-items:center;gap:10px;padding:12px;">'
    +'<button class="btn btn-outline btn-sm" onclick="App.navigate(\'stage\',1)">←</button>'
    +'<div style="font-size:1.1rem;font-weight:700;">מועמד חדש</div></div>'
    +'<div style="padding:0 12px;">'
    +'<div class="form-group"><label class="form-label">שם פרטי + אות שם משפחה <span class="required">*</span></label>'
    +'<input class="form-input" id="fName" placeholder="יוסי כ."></div>'
    +'<div class="form-group"><label class="form-label">מספר טלפון <span class="required">*</span></label>'
    +'<input class="form-input" id="fPhone" type="tel" placeholder="050-1234567" dir="ltr"></div>'
    +'<div class="form-group"><label class="form-label">ממליץ / רכז מפנה</label>'
    +'<input class="form-input" id="fReferrer"></div>'
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
    +'<div id="dupWarning" style="display:none;" class="warn-box">⚠️ מועמד עם אותו מספר טלפון כבר קיים במערכת</div>'
    +'<button class="btn btn-primary" style="width:100%;margin:16px 0;" onclick="Stage1.save()">שמור</button>'
    +'</div></div>';
    page.innerHTML=html;this._loadRecruiters();
    Utils.id('fPhone').addEventListener('blur',async function(){
      const phone=this.value.replace(/\D/g,'');
      if(phone.length>=9){const d=await DB.findDups(phone);Utils.id('dupWarning').style.display=d.length?'':'none';}});
  },

  _sp(el){el.parentElement.querySelectorAll('.radio-btn').forEach(b=>b.classList.remove('active'));el.classList.add('active');},

  async _loadRecruiters(){
    const recs=JSON.parse(App.settings.recruiters||'[]');const sel=Utils.id('fRecruiter');
    recs.forEach(r=>{const o=document.createElement('option');o.value=r;o.textContent=r;sel.appendChild(o);});},

  async save(){
    const name=Utils.id('fName')?.value?.trim();const phone=Utils.id('fPhone')?.value?.trim();
    const recruiter=Utils.id('fRecruiter')?.value;
    const priEl=document.querySelector('#fPriority .radio-btn.active');const priority=priEl?.dataset.val||'medium';
    if(!name){Utils.toast('נא למלא שם','danger');return;}
    if(!phone){Utils.toast('נא למלא טלפון','danger');return;}
    if(!recruiter){Utils.toast('נא לבחור רכז','danger');return;}
    const c=await DB.saveCandidate({
      name,phone,recruiter,priority,
      referrer:Utils.id('fReferrer')?.value?.trim()||'',
      notes:Utils.id('fNotes')?.value?.trim()||'',
      reminder:Utils.id('fReminder')?.value||'',
      stage:1,status:'active',jobId:App.currentJob
    });
    const msg=(App.settings.msgStage1||'').replace('{name}',name);
    if(msg)Utils.openWhatsApp(phone,msg);
    Utils.toast('מועמד נוסף!','success');App.navigate('stage',1);
  },

  renderDetail(c){
    const jobs=[];// get job name
    let html='<div class="card">';
    html+='<div class="form-group"><label class="form-label">שם</label>'
    +'<input class="form-input" value="'+Utils.escHtml(c.name)+'" onchange="Stages.saveField(\''+c.id+'\',\'name\',this.value)"></div>';
    html+='<div class="form-group"><label class="form-label">טלפון</label>'
    +'<input class="form-input" value="'+Utils.escHtml(c.phone)+'" dir="ltr" onchange="Stages.saveField(\''+c.id+'\',\'phone\',this.value)"></div>';
    html+='<div class="form-group"><label class="form-label">ממליץ</label>'
    +'<input class="form-input" value="'+Utils.escHtml(c.referrer||'')+'" onchange="Stages.saveField(\''+c.id+'\',\'referrer\',this.value)"></div>';
    html+='<div class="form-group"><label class="form-label">הערות</label>'
    +'<textarea class="form-textarea" rows="2" onchange="Stages.saveField(\''+c.id+'\',\'notes\',this.value)">'+Utils.escHtml(c.notes||'')+'</textarea></div>';
    html+='</div>';
    // Save to contacts button
    html+='<div style="padding:8px 12px;">'
    +'<button class="btn btn-outline btn-sm" onclick="Utils.saveToContacts(\''+Utils.escHtml(c.name)+'\',\''+c.phone+'\',\''+Utils.escHtml(c.jobId||'')+'\')">📇 שמור באנשי קשר</button></div>';
    // Advance
    html+='<div style="padding:12px;">'
    +'<button class="btn btn-success" style="width:100%;" onclick="Stages.quickAdvance(\''+c.id+'\',1)">✅ העבר לשלב 2</button></div>';
    return html;
  }
};
