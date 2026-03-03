'use strict';
const Stage2={
  renderDetail(c){
    let html='';
    html+=Stages.renderHistorySummary(c,2);
    html+='<div class="section-title">שיחה טלפונית</div><div class="card">';
    html+='<div class="cb-row" onclick="Stages.toggleCheck(\''+c.id+'\',\'stage2_callDone\',this)">'
    +'<div class="cb-box '+(c.stage2_callDone?'checked':'')+'">✓</div><span class="cb-label">שיחה בוצעה</span></div>';
    if(c.stage2_callDone)html+='<div class="info-box">✅ שיחה בוצעה '+Utils.formatDateTime(c.stage2_callAt||c.updatedAt)+'</div>';
    html+='</div>';
    html+='<div style="padding:8px 12px;">'
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
    const c=await DB.getCandidate(id);
    const q=f=>c['stage2_q_'+f]||'';
    let html='<div class="page active" style="padding-bottom:100px;">'
    +'<div style="display:flex;align-items:center;gap:10px;padding:12px;">'
    +'<button class="btn btn-outline btn-sm" onclick="App.renderCandidateView(\''+id+'\')">←</button>'
    +'<div style="font-size:1.1rem;font-weight:700;">שאלון — '+Utils.escHtml(c.name)+'</div></div>';

    // Personal
    html+='<div class="section-title">פרטים אישיים</div><div class="card">';
    html+='<div class="form-group"><label class="form-label">גיל <span class="required">*</span></label>'
    +'<input class="form-input" type="number" id="q_age" value="'+q('age')+'" min="18" max="45"></div>';
    html+='<div class="form-group"><label class="form-label">מצב משפחתי</label><div class="radio-group" id="q_marital">';
    for(const[v,l]of[['single','רווק'],['married','נשוי'],['engaged','מאורס'],['partner','זוגיות']]){
      html+='<div class="radio-btn '+(q('marital')===v?'active':'')+'" data-val="'+v+'" onclick="Stage2._radio(this)">'+l+'</div>';}
    html+='</div></div>';
    html+='<div class="conditional '+(q('marital')&&q('marital')!=='single'?'show':'')+'" id="q_marital_cond">'
    +'<div class="form-group"><label class="form-label">שוחח עם בן/בת זוג?</label><div class="radio-group" id="q_partnerDiscuss">'
    +'<div class="radio-btn '+(q('partnerDiscuss')==='yes'?'active':'')+'" data-val="yes" onclick="Stage2._radio(this)">כן</div>'
    +'<div class="radio-btn '+(q('partnerDiscuss')==='no'?'active':'')+'" data-val="no" onclick="Stage2._radio(this)">לא</div></div></div></div>';
    html+='<div class="conditional '+(q('marital')==='married'?'show':'')+'" id="q_children_cond">'
    +'<div class="form-group"><label class="form-label">מספר ילדים</label><div class="scale-group" id="q_children">';
    for(let n=0;n<=5;n++)html+='<div class="scale-btn '+(q('children')===String(n)?'active':'')+'" data-val="'+n+'" onclick="Stage2._scale(this)">'+n+'</div>';
    html+='</div></div></div></div>';

    // Job Requirements
    html+='<div class="section-title">הבנת תנאי תפקיד</div><div class="card">';
    html+=Stage2._yn('relocate','מוכן לעבור למרכז',q);
    html+=Stage2._yn('fulltime','משרה מלאה כולל שבתות, חגים, שעות בלתי שגרתיות',q);
    html+=Stage2._yn('license','רישיון נהיגה',q);
    html+=Stage2._yn('clicense','רישיון C',q);
    html+='</div>';

    // Medical
    html+='<div class="section-title">מצב רפואי</div><div class="card">';
    html+='<div class="form-group"><label class="form-label">מצב רפואי</label><div class="radio-group" id="q_medical">'
    +'<div class="radio-btn '+(q('medical')==='normal'?'active':'')+'" data-val="normal" onclick="Stage2._radio(this)">תקין</div>'
    +'<div class="radio-btn '+(q('medical')==='abnormal'?'active-danger':'')+'" data-val="abnormal" onclick="Stage2._radio(this)">לא תקין</div></div></div>';
    html+='<div class="conditional '+(q('medical')==='abnormal'?'show':'')+'" id="q_medical_cond">'
    +'<textarea class="form-textarea" id="q_medicalDetail" rows="2">'+q('medicalDetail')+'</textarea></div>';
    html+=Stage2._yn('fitness','עוסק בכושר באופן תדיר',q);
    html+=Stage2._yn('idfInjured','פצוע צה"ל / נכה / ועדות רפואיות',q);
    html+='<div class="conditional '+(q('idfInjured')==='yes'?'show':'')+'" id="q_idfInjured_cond">'
    +'<div class="warn-box">⚠️ יידרשו אישורים רפואיים</div></div>';
    html+=Stage2._yn('vision','בעיות ראייה / לייזר / עיוורון צבעים',q);
    html+='<div class="conditional '+(q('vision')==='yes'?'show':'')+'" id="q_vision_cond">'
    +'<textarea class="form-textarea" id="q_visionDetail" rows="2">'+q('visionDetail')+'</textarea></div></div>';

    // Military & Appearance
    html+='<div class="section-title">רקע צבאי ומראה</div><div class="card">';
    html+='<div class="form-group"><label class="form-label">פרופיל צה"ל</label>'
    +'<input class="form-input" id="q_idfProfile" value="'+q('idfProfile')+'"></div>';
    html+=Stage2._yn('distinctive','סממנים ייחודיים (קעקועים/צלקות/שיער)',q);
    html+=Stage2._yn('available','זמינות לתהליך',q);
    html+='<div class="conditional '+(q('available')==='no'?'show':'')+'" id="q_available_cond">'
    +'<textarea class="form-textarea" id="q_availableDetail" rows="2">'+q('availableDetail')+'</textarea></div></div>';

    // Education
    html+='<div class="section-title">רקע אישי והשכלה</div><div class="card">';
    html+='<div class="form-group"><label class="form-label">מה עושה היום</label>'
    +'<textarea class="form-textarea" id="q_currentJob" rows="2">'+q('currentJob')+'</textarea></div>';
    html+='<div class="form-group"><label class="form-label">קורות חיים</label>'
    +'<textarea class="form-textarea" id="q_lifeStory" rows="3">'+q('lifeStory')+'</textarea></div>';
    html+=Stage2._yn('bagrut','בגרות מלאה',q);
    html+='<div class="conditional '+(q('bagrut')==='no'?'show':'')+'" id="q_bagrut_cond">'
    +'<textarea class="form-textarea" id="q_bagrutDetail" rows="2">'+q('bagrutDetail')+'</textarea></div>';
    html+='<div class="form-group"><label class="form-label">מקצועות מוגברים</label>'
    +'<input class="form-input" id="q_enhanced" value="'+q('enhanced')+'"></div>';
    html+='<div class="form-group"><label class="form-label">אנגלית (0-7)</label><div class="scale-group" id="q_english">';
    for(let n=0;n<=7;n++)html+='<div class="scale-btn '+(q('english')===String(n)?'active':'')+'" data-val="'+n+'" onclick="Stage2._scale(this)">'+n+'</div>';
    html+='</div></div>';
    html+='<div class="form-group"><label class="form-label">מתמטיקה (0-5)</label><div class="scale-group" id="q_math">';
    for(let n=0;n<=5;n++)html+='<div class="scale-btn '+(q('math')===String(n)?'active':'')+'" data-val="'+n+'" onclick="Stage2._scale(this)">'+n+'</div>';
    html+='</div></div>';
    html+=Stage2._yn('learningDisability','אבחון דידקטי / לקויות למידה',q);
    html+='<div class="conditional '+(q('learningDisability')==='yes'?'show':'')+'" id="q_learningDisability_cond">'
    +'<textarea class="form-textarea" id="q_learningDisabilityDetail" rows="2">'+q('learningDisabilityDetail')+'</textarea></div>';
    html+=Stage2._yn('premilitary','מכינה/ישיבה/שנת שירות',q);
    html+='<div class="conditional '+(q('premilitary')==='yes'?'show':'')+'" id="q_premilitary_cond">'
    +'<textarea class="form-textarea" id="q_premilitaryDetail" rows="2">'+q('premilitaryDetail')+'</textarea></div></div>';

    // Military & Employment
    html+='<div class="section-title">שירות צבאי, לימודים ותעסוקה</div><div class="card">';
    html+='<div class="form-group"><label class="form-label">שירות צבאי מפורט</label>'
    +'<textarea class="form-textarea" id="q_military" rows="3">'+q('military')+'</textarea></div>';
    html+=Stage2._yn('academic','לימודים אקדמאיים',q);
    html+='<div class="conditional '+(q('academic')==='yes'?'show':'')+'" id="q_academic_cond">'
    +'<div class="form-group"><label class="form-label">ציון פסיכומטרי</label>'
    +'<input class="form-input" type="number" id="q_psychometric" value="'+q('psychometric')+'"></div>'
    +'<div class="form-group"><label class="form-label">פרטים</label>'
    +'<textarea class="form-textarea" id="q_academicDetail" rows="2">'+q('academicDetail')+'</textarea></div></div>';
    html+='<div class="form-group"><label class="form-label">לאחר צבא / תעסוקה / טיול</label>'
    +'<textarea class="form-textarea" id="q_postArmy" rows="2">'+q('postArmy')+'</textarea></div></div>';

    // Intimate
    html+='<div class="section-title">שאלות אינטימיות</div><div class="card">';
    html+=Stage2._yn('intimateConsent','המועמד מסכים לענות',q);
    html+='<div class="conditional '+(q('intimateConsent')==='yes'?'show':'')+'" id="q_intimateConsent_cond">';
    for(const[f,l]of[['mental','בעיות נפשיות'],['drugs','סמים'],['criminal','רקע פלילי אזרחי'],['discipline','משמעת/מצ"ח בצבא']]){
      html+=Stage2._yn(f,l,q);
      html+='<div class="conditional '+(q(f)==='yes'?'show':'')+'" id="q_'+f+'_cond">'
      +'<textarea class="form-textarea" id="q_'+f+'Detail" rows="2">'+q(f+'Detail')+'</textarea></div>';}
    html+='</div></div>';

    html+='<div style="padding:12px;"><button class="btn btn-primary" style="width:100%;" onclick="Stage2.saveQuestionnaire(\''+c.id+'\')">שמור שאלון</button></div></div>';
    Utils.id('mainContent').innerHTML=html;
  },

  _yn(field,label,q){
    return '<div class="form-group"><label class="form-label">'+label+'</label><div class="radio-group" id="q_'+field+'">'
    +'<div class="radio-btn '+(q(field)==='yes'?'active':'')+'" data-val="yes" onclick="Stage2._radio(this)">כן</div>'
    +'<div class="radio-btn '+(q(field)==='no'?'active':'')+'" data-val="no" onclick="Stage2._radio(this)">לא</div></div></div>';
  },

  _radio(el){
    el.parentElement.querySelectorAll('.radio-btn').forEach(b=>{b.classList.remove('active','active-success','active-danger','active-warning')});
    el.classList.add('active');
    const parent=el.parentElement;const id=parent.id;const val=el.dataset.val;
    const condEl=Utils.id(id+'_cond');
    if(condEl){
      if(id==='q_marital'){condEl.classList.toggle('show',val!=='single');
        const cc=Utils.id('q_children_cond');if(cc)cc.classList.toggle('show',val==='married');}
      else condEl.classList.toggle('show',val==='yes'||val==='abnormal');
    }
  },
  _scale(el){el.parentElement.querySelectorAll('.scale-btn').forEach(b=>b.classList.remove('active'));el.classList.add('active');},

  async saveQuestionnaire(id){
    const c=await DB.getCandidate(id);
    const fields=['age','marital','partnerDiscuss','children','relocate','fulltime','license','clicense',
    'medical','medicalDetail','fitness','idfInjured','vision','visionDetail','idfProfile','distinctive','available','availableDetail',
    'currentJob','lifeStory','bagrut','bagrutDetail','enhanced','english','math','learningDisability','learningDisabilityDetail',
    'premilitary','premilitaryDetail','military','academic','psychometric','academicDetail','postArmy',
    'intimateConsent','mental','mentalDetail','drugs','drugsDetail','criminal','criminalDetail','discipline','disciplineDetail'];
    fields.forEach(f=>{const el=Utils.id('q_'+f);
      if(!el){const a=document.querySelector('#q_'+f+' .radio-btn.active, #q_'+f+' .scale-btn.active');if(a)c['stage2_q_'+f]=a.dataset.val;}
      else c['stage2_q_'+f]=el.value;});
    await DB.saveCandidate(c);Utils.toast('שאלון נשמר!','success');App.renderCandidateView(id);
  }
};
