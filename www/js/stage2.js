'use strict';
const Stage2={
  renderDetail(c){
    var html='';
    html+=Stages.renderHistorySummary(c,2);
    html+='<div class="section-title">שיחה טלפונית</div><div class="card">';
    html+='<div class="cb-row" onclick="Stages.toggleCheck(\''+c.id+'\',\'stage2_callDone\',this)">'
    +'<div class="cb-box '+(c.stage2_callDone?'checked':'')+'">✓</div><span>שיחה בוצעה</span></div>';
    if(c.stage2_callDone)html+='<div class="info-box">✅ שיחה בוצעה '+Utils.formatDateTime(c.stage2_callAt||c.updatedAt)+'</div>';
    html+='</div>';
    html+='<div style="padding:8px 14px;">'
    +'<button class="btn btn-primary" style="width:100%;" onclick="Stage2.openQuestionnaire(\''+c.id+'\')">📝 שאלון</button></div>';
    if(c.stage2_q_age){
      html+='<div class="card"><div style="font-weight:700;margin-bottom:8px;">סיכום שאלון</div>'
      +'<div class="card-meta">גיל: '+c.stage2_q_age+' | מצב משפחתי: '+(c.stage2_q_marital||'-')+'</div>'
      +'<div class="card-meta">רילוקציה: '+(c.stage2_q_relocate||'-')+' | רישיון: '+(c.stage2_q_license||'-')+'</div>'
      +'<div class="card-meta">אנגלית: '+(c.stage2_q_english||'-')+' | מתמטיקה: '+(c.stage2_q_math||'-')+'</div></div>';}
    html+=Stages.renderEvaluation(c,2);
    return html;
  },

  async openQuestionnaire(id){
    var c=await DB.getCandidate(id);
    var q=function(f){return c['stage2_q_'+f]||''};
    var page=Utils.id('mainContent');
    var html='<div class="page active" style="padding-bottom:100px;">'
    +'<div style="display:flex;align-items:center;gap:10px;padding:14px;">'
    +'<button class="btn btn-outline btn-sm" onclick="App.renderCandidateView(\''+id+'\')">←</button>'
    +'<div style="font-size:1.15rem;font-weight:700;">שאלון — '+Utils.escHtml(c.name)+'</div></div>';

    // Personal
    html+='<div class="section-title">פרטים אישיים</div><div class="card">';
    html+=Stage2._field(id,'age','גיל','number',q('age'));
    html+=Stage2._select(id,'marital','מצב משפחתי',['רווק/ה','נשוי/אה','גרוש/ה','אחר'],q('marital'));
    html+=Stage2._field(id,'children','מספר ילדים','number',q('children'));
    html+=Stage2._field(id,'city','עיר מגורים','text',q('city'));
    html+=Stage2._yesNo(id,'relocate','מוכנות לרילוקציה',q('relocate'));
    html+='</div>';

    // Background
    html+='<div class="section-title">רקע מקצועי</div><div class="card">';
    html+=Stage2._field(id,'education','השכלה','text',q('education'));
    html+=Stage2._field(id,'lastJob','מקום עבודה אחרון','text',q('lastJob'));
    html+=Stage2._field(id,'experience','שנות ניסיון','text',q('experience'));
    html+=Stage2._select(id,'license','רישיון נהיגה',['אין','פרטי','משאית','כבדה'],q('license'));
    html+=Stage2._yesNo(id,'criminal','עבר פלילי',q('criminal'));
    html+='</div>';

    // Skills
    html+='<div class="section-title">יכולות</div><div class="card">';
    html+=Stage2._scale(id,'english','אנגלית',q('english'));
    html+=Stage2._scale(id,'math','מתמטיקה',q('math'));
    html+=Stage2._scale(id,'computer','מחשב',q('computer'));
    // Unique identifier with conditional textbox
    html+=Stage2._yesNoConditional(id,'uniqueMarker','סממן ייחודי',q('uniqueMarker'),q('uniqueMarkerDetail'));
    html+='</div>';

    // Availability
    html+='<div class="section-title">זמינות</div><div class="card">';
    html+=Stage2._select(id,'availability','זמינות להתחלה',['מיידית','תוך שבועיים','תוך חודש','לא ידוע'],q('availability'));
    html+=Stage2._select(id,'shifts','משמרות',['בוקר','ערב','לילה','גמיש'],q('shifts'));
    html+=Stage2._field(id,'salaryExpect','ציפיית שכר','text',q('salaryExpect'));
    html+='</div>';

    // Notes
    html+='<div class="section-title">הערות</div><div class="card">';
    html+='<div class="form-group"><textarea class="form-textarea" rows="3" onchange="Stage2._save(\''+id+'\',\'notes\',this.value)">'+Utils.escHtml(q('notes'))+'</textarea></div></div>';

    html+='<div style="padding:14px;"><button class="btn btn-success" style="width:100%;" onclick="Stage2.saveAndBack(\''+id+'\')">שמור וחזור</button></div></div>';
    page.innerHTML=html;
  },

  _field(id,key,label,type,val){
    return '<div class="form-group"><label class="form-label">'+label+'</label>'
    +'<input class="form-input" type="'+(type||'text')+'" value="'+Utils.escHtml(val)+'" '
    +'onchange="Stage2._save(\''+id+'\',\''+key+'\',this.value)"></div>';
  },
  _select(id,key,label,opts,val){
    var html='<div class="form-group"><label class="form-label">'+label+'</label>'
    +'<select class="form-select" onchange="Stage2._save(\''+id+'\',\''+key+'\',this.value)">'
    +'<option value="">בחר...</option>';
    opts.forEach(function(o){html+='<option value="'+o+'"'+(val===o?' selected':'')+'>'+o+'</option>';});
    return html+'</select></div>';
  },
  _yesNo(id,key,label,val){
    return '<div class="form-group"><label class="form-label">'+label+'</label><div class="radio-group">'
    +'<div class="radio-btn '+(val==='כן'?'active-success':'')+'" onclick="Stage2._saveRadio(\''+id+'\',\''+key+'\',\'\u05db\u05df\',this)">כן</div>'
    +'<div class="radio-btn '+(val==='לא'?'active-danger':'')+'" onclick="Stage2._saveRadio(\''+id+'\',\''+key+'\',\'\u05dc\u05d0\',this)">לא</div>'
    +'</div></div>';
  },
  // Yes/No with conditional textbox when "yes"
  _yesNoConditional(id,key,label,val,detailVal){
    var showDetail=(val==='כן');
    return '<div class="form-group"><label class="form-label">'+label+'</label><div class="radio-group">'
    +'<div class="radio-btn '+(val==='כן'?'active-success':'')+'" onclick="Stage2._saveRadioConditional(\''+id+'\',\''+key+'\',\'\u05db\u05df\',this)">כן</div>'
    +'<div class="radio-btn '+(val==='לא'?'active-danger':'')+'" onclick="Stage2._saveRadioConditional(\''+id+'\',\''+key+'\',\'\u05dc\u05d0\',this)">לא</div>'
    +'</div>'
    +'<div class="conditional '+(showDetail?'show':'')+'" id="cond_'+key+'">'
    +'<div class="form-group"><label class="form-label">פרט</label>'
    +'<textarea class="form-textarea" rows="2" onchange="Stage2._save(\''+id+'\',\''+key+'Detail\',this.value)">'+Utils.escHtml(detailVal||'')+'</textarea></div></div></div>';
  },
  _scale(id,key,label,val){
    var html='<div class="form-group"><label class="form-label">'+label+'</label><div class="scale-group">';
    for(var i=1;i<=5;i++){
      html+='<div class="scale-btn '+(parseInt(val)===i?'active':'')+'" onclick="Stage2._saveScale(\''+id+'\',\''+key+'\','+i+',this)">'+i+'</div>';
    }
    return html+'</div></div>';
  },
  async _save(id,key,val){App.markDirty(id,'stage2_q_'+key,val);},
  _saveRadio(id,key,val,el){
    el.parentElement.querySelectorAll('.radio-btn').forEach(function(b){b.className='radio-btn'});
    el.classList.add('radio-btn');el.classList.add(val==='כן'?'active-success':'active-danger');
    Stage2._save(id,key,val);
  },
  _saveRadioConditional(id,key,val,el){
    el.parentElement.querySelectorAll('.radio-btn').forEach(function(b){b.className='radio-btn'});
    el.classList.add('radio-btn');el.classList.add(val==='כן'?'active-success':'active-danger');
    Stage2._save(id,key,val);
    // Show/hide conditional
    var cond=Utils.id('cond_'+key);
    if(cond){if(val==='כן')cond.classList.add('show');else cond.classList.remove('show');}
  },
  _saveScale(id,key,val,el){
    el.parentElement.querySelectorAll('.scale-btn').forEach(function(b){b.classList.remove('active')});
    el.classList.add('active');Stage2._save(id,key,val);
  },
  async saveAndBack(id){await App.flushDirty();Utils.toast('נשמר','success');App.renderCandidateView(id);}
};
