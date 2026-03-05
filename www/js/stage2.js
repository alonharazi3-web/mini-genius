'use strict';
var Stage2={
  renderDetail:function(c){
    var html='';
    html+=Stages.renderHistorySummary(c,2);
    html+='<div class="section-title">\u05e9\u05d9\u05d7\u05d4 \u05d8\u05dc\u05e4\u05d5\u05e0\u05d9\u05ea</div><div class="card">';
    html+='<div class="cb-row" onclick="Stages.toggleCheck(\''+c.id+'\',\'stage2_callDone\',this)">'
    +'<div class="cb-box '+(c.stage2_callDone?'checked':'')+'">✓</div><span>\u05e9\u05d9\u05d7\u05d4 \u05d1\u05d5\u05e6\u05e2\u05d4</span></div>';
    if(c.stage2_callDone)html+='<div class="info-box">\u2705 \u05e9\u05d9\u05d7\u05d4 \u05d1\u05d5\u05e6\u05e2\u05d4 '+Utils.formatDateTime(c.stage2_callAt||c.updatedAt)+'</div>';
    html+='</div>';

    // ====== RECORDING SECTION ======
    html+='<div class="section-title">\u{1f399}\ufe0f \u05d4\u05e7\u05dc\u05d8\u05d4</div><div class="card">';
    if(c.stage2_recFileId){
      html+='<div class="info-box" style="background:#f0fdf4;border-color:#bbf7d0;">'
      +'\u2705 \u05d4\u05e7\u05dc\u05d8\u05d4 \u05e9\u05de\u05d5\u05e8\u05d4: <strong>'+(c.stage2_recFileName||'\u05e7\u05d5\u05d1\u05e5 \u05e9\u05de\u05e2')+'</strong></div>'
      +'<div style="display:flex;gap:8px;flex-wrap:wrap;">'
      +'<button class="btn btn-outline btn-sm" onclick="Stage2.playRecording(\''+c.id+'\')">\u25b6 \u05e0\u05d2\u05df</button>'
      +'<button class="btn btn-outline btn-sm" onclick="Stage2.exportRecording(\''+c.id+'\')">\u{1f4e4} \u05e9\u05ea\u05e3 \u05d4\u05e7\u05dc\u05d8\u05d4</button>'
      +'<button class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="Stage2.removeRecording(\''+c.id+'\')">\u{1f5d1} \u05de\u05d7\u05e7</button>'
      +'</div>';
    }else{
      html+='<div style="display:flex;flex-direction:column;gap:8px;">'
      +'<button class="btn btn-primary btn-sm" onclick="Stage2.scanRecording(\''+c.id+'\')">\u{1f50d} \u05e1\u05e8\u05d5\u05e7 \u05d4\u05e7\u05dc\u05d8\u05d5\u05ea Samsung</button>'
      +'<div style="position:relative;">'
      +'<button class="btn btn-outline btn-sm" onclick="document.getElementById(\'recUpload_'+c.id+'\').click()">\u{1f4c1} \u05d4\u05e2\u05dc\u05d0\u05d4 \u05d9\u05d3\u05e0\u05d9\u05ea</button>'
      +'<input type="file" id="recUpload_'+c.id+'" accept="audio/*" style="display:none;" onchange="Stage2.uploadRecording(\''+c.id+'\',this)">'
      +'</div></div>';
    }
    html+='</div>';

    // ====== TRANSCRIPTION SECTION ======
    html+='<div class="section-title">\u{1f4dd} \u05ea\u05de\u05dc\u05d5\u05dc</div><div class="card">';
    if(c.stage2_transcription){
      html+='<div class="info-box" style="background:#f0fdf4;border-color:#bbf7d0;">\u2705 \u05ea\u05de\u05dc\u05d5\u05dc \u05e9\u05de\u05d5\u05e8</div>'
      +'<div style="max-height:200px;overflow-y:auto;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;margin:8px 0;font-size:0.85rem;line-height:1.6;direction:rtl;">'
      +Stage2._renderTranscription(c.stage2_transcription)+'</div>'
      +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">'
      +'<button class="btn btn-outline btn-sm" onclick="Stage2.exportTranscription(\''+c.id+'\')">\u{1f4e4} \u05d9\u05d9\u05e6\u05d5\u05d0 \u05ea\u05de\u05dc\u05d5\u05dc</button>'
      +'<button class="btn btn-outline btn-sm" onclick="Stage2.copyTranscriptionForAI(\''+c.id+'\')">\u{1f916} \u05d4\u05e2\u05ea\u05e7 \u05dc-AI</button>'
      +'<button class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="Stage2.removeTranscription(\''+c.id+'\')">\u{1f5d1} \u05de\u05d7\u05e7</button>'
      +'</div>';
    }else{
      if(c.stage2_recFileId){
        html+='<button class="btn btn-primary btn-sm" onclick="Stage2.transcribe(\''+c.id+'\')">\u{1f399} \u05ea\u05de\u05dc\u05dc (2 \u05d3\u05d5\u05d1\u05e8\u05d9\u05dd)</button>'
        +'<div class="card-meta" style="margin-top:6px;">AssemblyAI (חינם) או Whisper — הגדר בכפתור למעלה</div>';
      }else{
        html+='<div class="card-meta">\u{1f4a1} \u05d4\u05e2\u05dc\u05d4 \u05d4\u05e7\u05dc\u05d8\u05d4 \u05ea\u05d7\u05d9\u05dc\u05d4 \u05db\u05d3\u05d9 \u05dc\u05ea\u05de\u05dc\u05dc</div>';
      }
      // Manual paste transcription
      html+='<button class="btn btn-outline btn-sm" style="margin-top:8px;" onclick="Stage2.manualTranscription(\''+c.id+'\')">\u{1f4cb} \u05d4\u05d3\u05d1\u05e7 \u05ea\u05de\u05dc\u05d5\u05dc \u05d9\u05d3\u05e0\u05d9\u05ea</button>';
    }
    html+='</div>';

    html+='<div style="padding:8px 14px;display:flex;gap:8px;flex-wrap:wrap;">'
    +'<button class="btn btn-primary" style="flex:1;" onclick="Stage2.openQuestionnaire(\''+c.id+'\')">\u{1f4dd} \u05e9\u05d0\u05dc\u05d5\u05df</button>';
    // Export buttons appear after questionnaire is filled
    if(c.stage2_q_grade){
      html+='<button class="btn btn-outline btn-sm" onclick="Stage2.exportWord(\''+c.id+'\')">\u{1f4c4} \u05d9\u05d9\u05e6\u05d5\u05d0 Word</button>';
      html+='<button class="btn btn-outline btn-sm" onclick="Stage2.exportDocx(\''+c.id+'\')">\u{1f4c4} \u05d9\u05d9\u05e6\u05d5\u05d0 .doc</button>';
    }
    html+='</div>';
    // Show questionnaire summary if filled
    if(c.stage2_q_age){
      html+='<div class="card"><div style="font-weight:700;margin-bottom:8px;">\u05e1\u05d9\u05db\u05d5\u05dd \u05e9\u05d0\u05dc\u05d5\u05df</div>'
      +'<div class="card-meta">\u05d2\u05d9\u05dc: '+c.stage2_q_age+' | \u05de\u05e6\u05d1 \u05de\u05e9\u05e4\u05d7\u05ea\u05d9: '+(c.stage2_q_marital||'-')+'</div>'
      +'<div class="card-meta">\u05e8\u05d9\u05dc\u05d5\u05e7\u05e6\u05d9\u05d4: '+(c.stage2_q_relocation||'-')+' | \u05e8\u05e9\u05d9\u05d5\u05df: '+(c.stage2_q_license||'-')+'</div>'
      +'<div class="card-meta">\u05d0\u05e0\u05d2\u05dc\u05d9\u05ea: '+(c.stage2_q_english||'-')+' | \u05de\u05ea\u05de\u05d8\u05d9\u05e7\u05d4: '+(c.stage2_q_math||'-')+'</div>';
      if(c.stage2_q_grade)html+='<div class="card-meta" style="font-weight:700;font-size:1.05rem;">\u05e6\u05d9\u05d5\u05df: '+c.stage2_q_grade+'/7</div>';
      html+='</div>';
    }
    // Schedule meeting button with Outlook export
    html+='<div style="padding:8px 14px;display:flex;gap:8px;">'
    +'<button class="btn btn-outline btn-sm" onclick="Stage2.scheduleMeeting(\''+c.id+'\')">\u{1f4c5} \u05e7\u05d1\u05e2 \u05e4\u05d2\u05d9\u05e9\u05d4</button>'
    +'<button class="btn btn-outline btn-sm" onclick="Stage2.exportOutlookMeeting(\''+c.id+'\')">\u{1f4ce} \u05e4\u05d2\u05d9\u05e9\u05ea Outlook</button></div>';
    html+=Stages.renderEvaluation(c,2);
    return html;
  },

  // ===== Outlook meeting export =====
  async exportOutlookMeeting(id){
    var c=await DB.getCandidate(id);
    var html='<div class="modal-title">\u{1f4ce} \u05e4\u05d2\u05d9\u05e9\u05ea Outlook</div>'
    +'<div class="form-group"><label class="form-label">\u05ea\u05d0\u05e8\u05d9\u05da \u05d5\u05e9\u05e2\u05d4</label>'
    +'<input class="form-input" id="olkDateTime" type="datetime-local"></div>'
    +'<div class="form-group"><label class="form-label">\u05de\u05d9\u05e7\u05d5\u05dd</label>'
    +'<input class="form-input" id="olkLocation" value=""></div>'
    +'<button class="btn btn-primary" style="width:100%;margin-top:12px;" onclick="Stage2._doExportOutlook(\''+id+'\')">\u{1f4ce} \u05e6\u05d5\u05e8 \u05e7\u05d5\u05d1\u05e5 .ics</button>';
    Stages.showModal(html);
  },
  async _doExportOutlook(id){
    var c=await DB.getCandidate(id);
    var dt=Utils.id('olkDateTime')?.value;
    if(!dt){Utils.toast('\u05d1\u05d7\u05e8 \u05ea\u05d0\u05e8\u05d9\u05da','danger');return;}
    var loc=Utils.id('olkLocation')?.value||'';
    Stages.closeModal();
    Utils.generateIcsAndShare('\u05e8\u05d0\u05d9\u05d5\u05df \u05d8\u05dc\u05e4\u05d5\u05e0\u05d9 — '+c.name,new Date(dt),null,loc);
  },

  // ===== Schedule meeting via calendar =====
  scheduleMeeting:function(id){
    var html='<div class="modal-title">\u{1f4c5} \u05e7\u05d1\u05d9\u05e2\u05ea \u05e4\u05d2\u05d9\u05e9\u05d4</div>'
    +'<div class="form-group"><label class="form-label">\u05ea\u05d0\u05e8\u05d9\u05da \u05d5\u05e9\u05e2\u05d4</label>'
    +'<input class="form-input" id="mtgDateTime" type="datetime-local"></div>'
    +'<button class="btn btn-primary" style="width:100%;margin-top:12px;" onclick="Stage2._doScheduleMeeting(\''+id+'\')">\u05d4\u05d5\u05e1\u05e3 \u05dc\u05dc\u05d5\u05d7 \u05e9\u05e0\u05d4</button>';
    Stages.showModal(html);
  },
  async _doScheduleMeeting(id){
    var c=await DB.getCandidate(id);
    var dt=Utils.id('mtgDateTime')?.value;
    if(!dt){Utils.toast('\u05d1\u05d7\u05e8 \u05ea\u05d0\u05e8\u05d9\u05da','danger');return;}
    var parts=dt.split('T');
    Utils.scheduleReminder('\u05e8\u05d0\u05d9\u05d5\u05df \u05d8\u05dc\u05e4\u05d5\u05e0\u05d9 — '+c.name,parts[0],parts[1]);
  },

  // ===== Word export of questionnaire =====
  async exportWord(id){
    var c=await DB.getCandidate(id);
    var q=function(f){return c['stage2_q_'+f]||'';};
    var sections=[
      {title:'\u05e4\u05e8\u05d8\u05d9\u05dd \u05d0\u05d9\u05e9\u05d9\u05d9\u05dd',fields:[
        {label:'\u05d2\u05d9\u05dc',value:q('age')},
        {label:'\u05de\u05e6\u05d1 \u05de\u05e9\u05e4\u05d7\u05ea\u05d9',value:q('marital')},
        {label:'\u05e9\u05d5\u05d7\u05d7 \u05e2\u05dd \u05d1\u05df/\u05d1\u05ea \u05d6\u05d5\u05d2',value:q('partnerTalk')},
        {label:'\u05de\u05e1\u05e4\u05e8 \u05d9\u05dc\u05d3\u05d9\u05dd',value:q('children')},
        {label:'\u05de\u05d5\u05db\u05e0\u05d5\u05ea \u05dc\u05e8\u05d9\u05dc\u05d5\u05e7\u05e6\u05d9\u05d4',value:q('relocation')},
        {label:'\u05de\u05e9\u05e8\u05d4 \u05de\u05dc\u05d0\u05d4',value:q('fullTime')},
        {label:'\u05e8\u05e9\u05d9\u05d5\u05df \u05e0\u05d4\u05d9\u05d2\u05d4',value:q('license')},
        {label:'\u05e8\u05e9\u05d9\u05d5\u05df C',value:q('licenseC')}
      ]},
      {title:'\u05de\u05e6\u05d1 \u05e8\u05e4\u05d5\u05d0\u05d9',fields:[
        {label:'\u05de\u05e6\u05d1 \u05e8\u05e4\u05d5\u05d0\u05d9',value:q('medical'),detail:q('medicalDetail')},
        {label:'\u05db\u05d5\u05e9\u05e8 \u05d2\u05d5\u05e4\u05e0\u05d9',value:q('fitness')},
        {label:'\u05e4\u05e6\u05d9\u05e2\u05ea \u05e6\u05d4"\u05dc',value:q('idfInjury')},
        {label:'\u05d1\u05e2\u05d9\u05d5\u05ea \u05e8\u05d0\u05d9\u05d9\u05d4/\u05e2\u05d9\u05d5\u05d5\u05e8\u05d5\u05df',value:q('vision'),detail:q('visionDetail')},
        {label:'\u05e4\u05e8\u05d5\u05e4\u05d9\u05dc \u05e6\u05d1\u05d0\u05d9',value:q('idfProfile')},
        {label:'\u05e1\u05de\u05de\u05e0\u05d9\u05dd \u05d9\u05d9\u05d7\u05d5\u05d3\u05d9\u05d9\u05dd',value:q('tattoos')},
        {label:'\u05d6\u05de\u05d9\u05e0\u05d5\u05ea \u05dc\u05ea\u05d4\u05dc\u05d9\u05da',value:q('availability'),detail:q('availabilityDetail')}
      ]},
      {title:'\u05e8\u05e7\u05e2 \u05d0\u05d9\u05e9\u05d9 \u05d5\u05d4\u05e9\u05db\u05dc\u05d4',fields:[
        {label:'\u05e2\u05d9\u05e1\u05d5\u05e7 \u05e0\u05d5\u05db\u05d7\u05d9',value:q('currentJob')},
        {label:'\u05e1\u05d9\u05e4\u05d5\u05e8 \u05d7\u05d9\u05d9\u05dd',value:q('lifeStory')},
        {label:'\u05d1\u05d2\u05e8\u05d5\u05ea \u05de\u05dc\u05d0\u05d4',value:q('bagrut'),detail:q('bagrutDetail')},
        {label:'\u05de\u05e7\u05e6\u05d5\u05e2\u05d5\u05ea \u05de\u05d5\u05d2\u05d1\u05e8\u05d9\u05dd',value:q('enhancedSubjects')},
        {label:'\u05d0\u05e0\u05d2\u05dc\u05d9\u05ea (0-7)',value:q('english')},
        {label:'\u05de\u05ea\u05de\u05d8\u05d9\u05e7\u05d4 (0-5)',value:q('math')},
        {label:'\u05d0\u05d1\u05d7\u05d5\u05df \u05d3\u05d9\u05d3\u05e7\u05d8\u05d9/\u05dc\u05e7\u05d5\u05d9\u05d5\u05ea \u05dc\u05de\u05d9\u05d3\u05d4',value:q('learningDisability'),detail:q('learningDisabilityDetail')},
        {label:'\u05de\u05db\u05d9\u05e0\u05d4/\u05d9\u05e9\u05d9\u05d1\u05d4/\u05e9\u05e0\u05ea \u05e9\u05d9\u05e8\u05d5\u05ea',value:q('mechina'),detail:q('mechinaDetail')}
      ]},
      {title:'\u05e9\u05d9\u05e8\u05d5\u05ea \u05e6\u05d1\u05d0\u05d9 \u05d5\u05ea\u05e2\u05e1\u05d5\u05e7\u05d4',fields:[
        {label:'\u05e9\u05d9\u05e8\u05d5\u05ea \u05e6\u05d1\u05d0\u05d9',value:q('militaryService')},
        {label:'\u05dc\u05d9\u05de\u05d5\u05d3\u05d9\u05dd \u05d0\u05e7\u05d3\u05de\u05d0\u05d9\u05d9\u05dd',value:q('academic'),detail:q('academicDetail')},
        {label:'\u05e4\u05e1\u05d9\u05db\u05d5\u05de\u05d8\u05e8\u05d9',value:q('psychometric')},
        {label:'\u05dc\u05d0\u05d7\u05e8 \u05e6\u05d1\u05d0/\u05ea\u05e2\u05e1\u05d5\u05e7\u05d4',value:q('postArmy')}
      ]},
      {title:'\u05e9\u05d0\u05dc\u05d5\u05ea \u05d0\u05d9\u05e0\u05d8\u05d9\u05de\u05d9\u05d5\u05ea',fields:[
        {label:'\u05d4\u05e1\u05db\u05de\u05d4 \u05dc\u05e2\u05e0\u05d5\u05ea',value:q('intimateConsent')},
        {label:'\u05e0\u05e4\u05e9\u05d9',value:q('intimateMental'),detail:q('intimateMentalDetail')},
        {label:'\u05e1\u05de\u05d9\u05dd',value:q('intimateDrugs'),detail:q('intimateDrugsDetail')},
        {label:'\u05e4\u05dc\u05d9\u05dc\u05d9/\u05d0\u05d6\u05e8\u05d7\u05d9',value:q('intimateCriminal'),detail:q('intimateCriminalDetail')},
        {label:'\u05de\u05e9\u05de\u05e2\u05ea/\u05de\u05e6"\u05d7 \u05d1\u05e6\u05d1\u05d0',value:q('intimateMilitary'),detail:q('intimateMilitaryDetail')}
      ]}
    ];
    Utils.exportQuestionnaireAsWord(c.name,sections,q('grade'),q('result'),q('notes'));
  },

  // FIX #5: DOCX export (Word-compatible HTML saved as .doc)
  async exportDocx(id){
    var c=await DB.getCandidate(id);
    var q=function(f){return c['stage2_q_'+f]||'';};
    var sections=[
      {title:'פרטים אישיים',fields:[
        {label:'גיל',value:q('age')},{label:'מצב משפחתי',value:q('marital')},
        {label:'רשיון נהיגה',value:q('license')},{label:'מוכנות לרילוקציה',value:q('relocation')}
      ]},
      {title:'מצב רפואי',fields:[
        {label:'מצב רפואי',value:q('medical'),detail:q('medicalDetail')},
        {label:'כושר גופני',value:q('fitness')}
      ]},
      {title:'רקע והשכלה',fields:[
        {label:'אנגלית',value:q('english')},{label:'מתמטיקה',value:q('math')},
        {label:'בגרות',value:q('bagrut'),detail:q('bagrutDetail')}
      ]},
      {title:'שירות צבאי',fields:[
        {label:'שירות צבאי',value:q('militaryService')},
        {label:'פסיכומטרי',value:q('psychometric')}
      ]}
    ];
    Utils.exportQuestionnaireAsDocx(c.name,sections,q('grade'),q('result'),q('notes'));
  },

  // ===== QUESTIONNAIRE =====
  async openQuestionnaire(id){
    var c=await DB.getCandidate(id);
    var q=function(f){return c['stage2_q_'+f]||'';};
    var page=Utils.id('mainContent');
    var html='<div class="page active" style="padding-bottom:100px;">'
    +'<div style="display:flex;align-items:center;gap:10px;padding:14px;">'
    +'<button class="btn btn-outline btn-sm" onclick="App.renderCandidateView(\''+id+'\')">\u2190</button>'
    +'<div style="font-size:1.15rem;font-weight:700;">\u{1f4dd} \u05e9\u05d0\u05dc\u05d5\u05df \u2014 '+Utils.escHtml(c.name)+'</div></div>';

    // ====== SECTION 1: Personal ======
    html+='<div class="section-title">\u{1f464} \u05e4\u05e8\u05d8\u05d9\u05dd \u05d0\u05d9\u05e9\u05d9\u05d9\u05dd</div><div class="card">';
    html+=Stage2._field(id,'age','\u05d2\u05d9\u05dc','number',q('age'));
    html+=Stage2._select(id,'marital','\u05de\u05e6\u05d1 \u05de\u05e9\u05e4\u05d7\u05ea\u05d9',['\u05e8\u05d5\u05d5\u05e7/\u05d4','\u05e0\u05e9\u05d5\u05d9/\u05d0\u05d4','\u05de\u05d0\u05d5\u05e8\u05e1/\u05ea','\u05d6\u05d5\u05d2\u05d9\u05d5\u05ea'],q('marital'));
    html+=Stage2._yesNoConditional(id,'partnerTalk','\u05e9\u05d5\u05d7\u05d7 \u05e2\u05dd \u05d1\u05df/\u05d1\u05ea \u05d6\u05d5\u05d2 \u05e2\u05dc \u05de\u05d0\u05e4\u05d9\u05d9\u05e0\u05d9 \u05d4\u05ea\u05e4\u05e7\u05d9\u05d3',q('partnerTalk'),q('partnerTalkDetail'));
    html+=Stage2._numButtons(id,'children','\u05de\u05e1\u05e4\u05e8 \u05d9\u05dc\u05d3\u05d9\u05dd',[0,1,2,3,4,5],q('children'));
    html+='</div>';

    // ====== SECTION 2: Job conditions ======
    html+='<div class="section-title">\u{1f4cc} \u05d4\u05d1\u05e0\u05ea \u05ea\u05e0\u05d0\u05d9 \u05d4\u05ea\u05e4\u05e7\u05d9\u05d3</div><div class="card">';
    html+=Stage2._yesNo(id,'relocation','\u05de\u05d5\u05db\u05e0\u05d5\u05ea \u05dc\u05e8\u05d9\u05dc\u05d5\u05e7\u05e6\u05d9\u05d4 \u05dc\u05d0\u05d6\u05d5\u05e8 \u05d4\u05de\u05e8\u05db\u05d6',q('relocation'));
    html+=Stage2._yesNo(id,'fullTime','\u05de\u05e9\u05e8\u05d4 \u05de\u05dc\u05d0\u05d4 \u2014 \u05e9\u05d1\u05ea\u05d5\u05ea, \u05d7\u05d2\u05d9\u05dd, \u05e1\u05d5\u05e4"\u05e9\u05d9\u05dd \u05d5\u05e9\u05e2\u05d5\u05ea \u05d1\u05dc\u05ea\u05d9 \u05e9\u05d2\u05e8\u05ea\u05d9\u05d5\u05ea',q('fullTime'));
    html+=Stage2._yesNo(id,'license','\u05e8\u05e9\u05d9\u05d5\u05df \u05e0\u05d4\u05d9\u05d2\u05d4',q('license'));
    html+=Stage2._yesNo(id,'licenseC','\u05e8\u05e9\u05d9\u05d5\u05df \u05e0\u05d4\u05d9\u05d2\u05d4 C',q('licenseC'));
    html+='</div>';

    // ====== SECTION 3: Medical ======
    html+='<div class="section-title">\u{1f3e5} \u05de\u05e6\u05d1 \u05e8\u05e4\u05d5\u05d0\u05d9</div><div class="card">';
    html+=Stage2._yesNoConditional(id,'medical','\u05de\u05e6\u05d1 \u05e8\u05e4\u05d5\u05d0\u05d9 (\u05e0\u05d9\u05ea\u05d5\u05d7\u05d9\u05dd/\u05e4\u05e6\u05d9\u05e2\u05d5\u05ea/\u05ea\u05e8\u05d5\u05e4\u05d5\u05ea \u05e7\u05d1\u05d5\u05e2\u05d5\u05ea) \u2014 \u05ea\u05e7\u05d9\u05df?',q('medical'),q('medicalDetail'));
    html+=Stage2._yesNo(id,'fitness','\u05e2\u05d5\u05e1\u05e7/\u05ea \u05d1\u05db\u05d5\u05e9\u05e8 \u05d1\u05d0\u05d5\u05e4\u05df \u05ea\u05d3\u05d9\u05e8',q('fitness'));
    html+=Stage2._yesNoConditional(id,'idfInjury','\u05e4\u05e6\u05d9\u05e2\u05ea \u05e6\u05d4"\u05dc / \u05e0\u05db\u05d4 \u05e6\u05d4"\u05dc / \u05d5\u05e2\u05d3\u05d5\u05ea \u05e8\u05e4\u05d5\u05d0\u05d9\u05d5\u05ea',q('idfInjury'),q('idfInjuryDetail'));
    html+=Stage2._yesNoConditional(id,'vision','\u05d1\u05e2\u05d9\u05d5\u05ea \u05e8\u05d0\u05d9\u05d9\u05d4 / \u05e0\u05d9\u05ea\u05d5\u05d7 \u05dc\u05d9\u05d9\u05d6\u05e8 / \u05e2\u05d9\u05d5\u05d5\u05e8\u05d5\u05df \u05e6\u05d1\u05e2\u05d9\u05dd',q('vision'),q('visionDetail'));
    html+=Stage2._field(id,'idfProfile','\u05e4\u05e8\u05d5\u05e4\u05d9\u05dc \u05e6\u05d1\u05d0\u05d9','text',q('idfProfile'));
    html+=Stage2._yesNo(id,'tattoos','\u05e1\u05de\u05de\u05e0\u05d9\u05dd \u05d9\u05d9\u05d7\u05d5\u05d3\u05d9\u05d9\u05dd \u05d1\u05d5\u05dc\u05d8\u05d9\u05dd (\u05e7\u05e2\u05e7\u05d5\u05e2\u05d9\u05dd/\u05e6\u05dc\u05e7\u05d5\u05ea)',q('tattoos'));
    html+=Stage2._yesNoConditional(id,'availability','\u05d6\u05de\u05d9\u05e0\u05d5\u05ea \u05dc\u05ea\u05d4\u05dc\u05d9\u05da \u05d4\u05de\u05d9\u05d5\u05df (\u05dc\u05dc\u05d0 \u05de\u05d2\u05d1\u05dc\u05d5\u05ea \u05d7\u05d5"\u05dc/\u05dc\u05d9\u05de\u05d5\u05d3\u05d9\u05dd)',q('availability'),q('availabilityDetail'));
    html+='</div>';

    // ====== SECTION 4: Background & Education ======
    html+='<div class="section-title">\u{1f4dd} \u05e8\u05e7\u05e2 \u05d0\u05d9\u05e9\u05d9 \u05d5\u05d4\u05e9\u05db\u05dc\u05d4</div><div class="card">';
    html+=Stage2._textarea(id,'currentJob','\u05de\u05d4 \u05e2\u05d5\u05e9\u05d4 \u05d4\u05d9\u05d5\u05dd',q('currentJob'));
    html+=Stage2._textarea(id,'lifeStory','\u05e1\u05e4\u05e8/\u05d9 \u05e7\u05e6\u05ea \u05e2\u05dc \u05e7\u05d5\u05e8\u05d5\u05ea \u05d7\u05d9\u05d9\u05da \u2014 \u05de\u05e9\u05e4\u05d7\u05d4, \u05de\u05d2\u05d5\u05e8\u05d9\u05dd, \u05d9\u05dc\u05d3\u05d5\u05ea, \u05ea\u05d7\u05d1\u05d9\u05d1\u05d9\u05dd',q('lifeStory'));
    html+=Stage2._yesNoConditional(id,'bagrut','\u05d1\u05d2\u05e8\u05d5\u05ea \u05de\u05dc\u05d0\u05d4',q('bagrut'),q('bagrutDetail'));
    html+=Stage2._field(id,'enhancedSubjects','\u05de\u05e7\u05e6\u05d5\u05e2\u05d5\u05ea \u05de\u05d5\u05d2\u05d1\u05e8\u05d9\u05dd','text',q('enhancedSubjects'));
    html+=Stage2._numButtons(id,'english','\u05d0\u05e0\u05d2\u05dc\u05d9\u05ea (0-7)',[0,1,2,3,4,5,6,7],q('english'));
    html+=Stage2._numButtons(id,'math','\u05de\u05ea\u05de\u05d8\u05d9\u05e7\u05d4 (0-5)',[0,1,2,3,4,5],q('math'));
    html+=Stage2._yesNoConditional(id,'learningDisability','\u05d0\u05d1\u05d7\u05d5\u05df \u05d3\u05d9\u05d3\u05e7\u05d8\u05d9 \u05d0\u05d5 \u05dc\u05e7\u05d5\u05d9\u05d5\u05ea \u05dc\u05de\u05d9\u05d3\u05d4',q('learningDisability'),q('learningDisabilityDetail'));
    html+=Stage2._yesNoConditional(id,'mechina','\u05de\u05db\u05d9\u05e0\u05d4 / \u05d9\u05e9\u05d9\u05d1\u05d4 / \u05e9\u05e0\u05ea \u05e9\u05d9\u05e8\u05d5\u05ea',q('mechina'),q('mechinaDetail'));
    html+='</div>';

    // ====== SECTION 5: Military, Academic, Employment ======
    html+='<div class="section-title">\u{1f396}\ufe0f \u05e9\u05d9\u05e8\u05d5\u05ea \u05e6\u05d1\u05d0\u05d9, \u05dc\u05d9\u05de\u05d5\u05d3\u05d9\u05dd \u05d5\u05ea\u05e2\u05e1\u05d5\u05e7\u05d4</div><div class="card">';
    html+=Stage2._textarea(id,'militaryService','\u05e9\u05d9\u05e8\u05d5\u05ea \u05e6\u05d1\u05d0\u05d9 \u05de\u05e4\u05d5\u05e8\u05d8',q('militaryService'));
    html+=Stage2._yesNoConditional(id,'academic','\u05dc\u05d9\u05de\u05d5\u05d3\u05d9\u05dd \u05d0\u05e7\u05d3\u05de\u05d0\u05d9\u05d9\u05dd',q('academic'),q('academicDetail'));
    html+=Stage2._field(id,'psychometric','\u05e6\u05d9\u05d5\u05df \u05e4\u05e1\u05d9\u05db\u05d5\u05de\u05d8\u05e8\u05d9','number',q('psychometric'));
    html+=Stage2._textarea(id,'postArmy','\u05dc\u05d0\u05d7\u05e8 \u05e6\u05d1\u05d0 / \u05ea\u05e2\u05e1\u05d5\u05e7\u05d4 / \u05d8\u05d9\u05d5\u05dc',q('postArmy'));
    html+='</div>';

    // ====== SECTION 6: Intimate Questions ======
    html+='<div class="section-title">\u{1f512} \u05e9\u05d0\u05dc\u05d5\u05ea \u05d0\u05d9\u05e0\u05d8\u05d9\u05de\u05d9\u05d5\u05ea</div><div class="card">';
    html+=Stage2._yesNo(id,'intimateConsent','\u05d4\u05de\u05d5\u05e2\u05de\u05d3/\u05ea \u05d9\u05db\u05d5\u05dc/\u05d4 \u05dc\u05e2\u05e0\u05d5\u05ea?',q('intimateConsent'));
    html+='<div class="conditional '+(q('intimateConsent')==='\u05db\u05df'?'show':'')+'" id="cond_intimateBlock">';
    html+=Stage2._yesNoConditional(id,'intimateMental','\u05e0\u05e4\u05e9\u05d9',q('intimateMental'),q('intimateMentalDetail'));
    html+=Stage2._yesNoConditional(id,'intimateDrugs','\u05e1\u05de\u05d9\u05dd',q('intimateDrugs'),q('intimateDrugsDetail'));
    html+=Stage2._yesNoConditional(id,'intimateCriminal','\u05e4\u05dc\u05d9\u05dc\u05d9 \u05d0\u05d6\u05e8\u05d7\u05d9',q('intimateCriminal'),q('intimateCriminalDetail'));
    html+=Stage2._yesNoConditional(id,'intimateMilitary','\u05de\u05e9\u05de\u05e2\u05ea \u05d0\u05d5 \u05de\u05e6"\u05d7 \u05d1\u05e6\u05d1\u05d0',q('intimateMilitary'),q('intimateMilitaryDetail'));
    html+='</div></div>';

    // ====== SECTION 7: Summary & Grade ======
    html+='<div class="section-title">\u2b50 \u05e1\u05d9\u05db\u05d5\u05dd \u05d5\u05d4\u05e2\u05e8\u05db\u05d4</div><div class="card" style="border:2px solid var(--primary);">';
    // Grade 1-7
    html+='<div class="form-group"><label class="form-label">\u05e6\u05d9\u05d5\u05df (1-7) \u2014 \u05de\u05ea\u05d7\u05ea \u05dc-3 = \u05e4\u05e1\u05d9\u05dc\u05d4 \u05d0\u05d5\u05d8\u05d5\u05de\u05d8\u05d9\u05ea</label><div class="scale-group">';
    for(var i=1;i<=7;i++){
      var gColor=i<=2?'var(--danger)':i<=3?'var(--warning)':i<=5?'var(--primary)':'var(--success)';
      html+='<div class="scale-btn '+(parseInt(q('grade'))===i?'active':'')+'" style="'+(parseInt(q('grade'))===i?'background:'+gColor+';color:#fff;border-color:'+gColor:'')
      +'" onclick="Stage2._saveGrade(\''+id+'\','+i+',this)">'+i+'</div>';
    }
    html+='</div></div>';
    // Auto fail warning
    if(parseInt(q('grade'))>0&&parseInt(q('grade'))<3){
      html+='<div class="info-box" style="background:#fef2f2;color:#dc2626;border-color:#fca5a5;">\u26a0\ufe0f \u05e6\u05d9\u05d5\u05df \u05de\u05ea\u05d7\u05ea \u05dc-3 \u2014 \u05e4\u05e1\u05d9\u05dc\u05d4 \u05d0\u05d5\u05d8\u05d5\u05de\u05d8\u05d9\u05ea</div>';
    }
    // Result
    html+='<div class="form-group"><label class="form-label">\u05d4\u05d7\u05dc\u05d8\u05d4</label><div class="radio-group">'
    +'<div class="radio-btn '+(q('result')==='\u05e2\u05d1\u05e8'?'active-success':'')+'" onclick="Stage2._saveResult(\''+id+'\',\'\u05e2\u05d1\u05e8\',this)">\u2713 \u05e2\u05d5\u05d1\u05e8/\u05ea</div>'
    +'<div class="radio-btn '+(q('result')==='\u05d4\u05ea\u05dc\u05d1\u05d8\u05d5\u05ea'?'active-warning':'')+'" onclick="Stage2._saveResult(\''+id+'\',\'\u05d4\u05ea\u05dc\u05d1\u05d8\u05d5\u05ea\',this)">\u23f3 \u05d4\u05ea\u05dc\u05d1\u05d8\u05d5\u05ea</div>'
    +'<div class="radio-btn '+(q('result')==='\u05dc\u05d0 \u05e2\u05d1\u05e8'?'active-danger':'')+'" onclick="Stage2._saveResult(\''+id+'\',\'\u05dc\u05d0 \u05e2\u05d1\u05e8\',this)">\u2715 \u05dc\u05d0 \u05e2\u05d5\u05d1\u05e8/\u05ea</div>'
    +'</div></div>';
    // Hesitation days
    html+='<div class="conditional '+(q('result')==='\u05d4\u05ea\u05dc\u05d1\u05d8\u05d5\u05ea'?'show':'')+'" id="cond_hesitDays">';
    html+=Stage2._numButtons(id,'hesitationDays','\u05ea\u05d5\u05e7\u05e3 \u05d9\u05de\u05d9\u05dd \u05dc\u05d4\u05d7\u05dc\u05d8\u05d4',[3,5,7,10,14],q('hesitationDays'));
    html+='</div>';
    // Rejection reason
    html+='<div class="conditional '+(q('result')==='\u05dc\u05d0 \u05e2\u05d1\u05e8'?'show':'')+'" id="cond_rejectReason">';
    html+=Stage2._textarea(id,'rejectionReason','\u05e1\u05d9\u05d1\u05ea \u05e4\u05e1\u05d9\u05dc\u05d4',q('rejectionReason'));
    html+='</div>';
    // Notes
    html+=Stage2._textarea(id,'notes','\u05d4\u05e2\u05e8\u05d5\u05ea \u05db\u05dc\u05dc\u05d9\u05d5\u05ea',q('notes'));
    html+='</div>';

    // Save + Export buttons
    html+='<div style="padding:14px;display:flex;flex-direction:column;gap:8px;">'
    +'<button class="btn btn-success" style="width:100%;" onclick="Stage2.saveAndBack(\''+id+'\')">\u{1f4be} \u05e9\u05de\u05d5\u05e8 \u05d5\u05d7\u05d6\u05d5\u05e8</button>'
    +'<button class="btn btn-outline" style="width:100%;" onclick="Stage2.exportWord(\''+id+'\')">\u{1f4c4} \u05d9\u05d9\u05e6\u05d5\u05d0 \u05e9\u05d0\u05dc\u05d5\u05df \u05db-Word</button>'
    +'<button class="btn btn-outline" style="width:100%;" onclick="Stage2.exportDocx(\''+id+'\')">\u{1f4c4} \u05d9\u05d9\u05e6\u05d5\u05d0 .doc</button>'
    +'</div></div>';
    page.innerHTML=html;
    window.scrollTo(0,0);
  },

  // ===== RECORDING =====
  // Scan Samsung recording folders for recent call recordings
  async scanRecording(id){
    var c=await DB.getCandidate(id);
    if(!window.cordova||!window.resolveLocalFileSystemURL){
      Utils.toast('\u05e1\u05e8\u05d9\u05e7\u05d4 \u05d6\u05de\u05d9\u05e0\u05d4 \u05e8\u05e7 \u05d1\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4 \u2014 \u05d4\u05e2\u05dc\u05d4 \u05d9\u05d3\u05e0\u05d9\u05ea','warning');return;
    }
    Utils.toast('\u05e1\u05d5\u05e8\u05e7 \u05d4\u05e7\u05dc\u05d8\u05d5\u05ea...','info');
    // FIX #8: Samsung recording paths — primary path is /Call/ on Galaxy A55
    var paths=[
      'file:///storage/emulated/0/Call/',
      'file:///storage/emulated/0/Recordings/Call/',
      'file:///storage/emulated/0/DCIM/.Recordings/',
      'file:///storage/emulated/0/Music/Recordings/',
      'file:///storage/emulated/0/Sounds/CallRecording/',
      'file:///storage/emulated/0/Recordings/',
      'file:///storage/emulated/0/Record/Call/'
    ];
    var allFiles=[];
    var checked=0;
    var total=paths.length;
    paths.forEach(function(p){
      window.resolveLocalFileSystemURL(p,function(dir){
        var reader=dir.createReader();
        reader.readEntries(function(entries){
          entries.forEach(function(e){
            if(e.isFile&&/\.(m4a|mp3|wav|aac|ogg|amr|3gp)$/i.test(e.name)){
              // Match Samsung format: "Call recording NAME_YYMMDD_HHMMSS.m4a"
              // Also match any audio file in Call folders
              allFiles.push({name:e.name,path:e.nativeURL,modified:0});
            }
          });
          checked++;
          if(checked>=total)Stage2._showScanResults(id,allFiles);
        },function(){checked++;if(checked>=total)Stage2._showScanResults(id,allFiles);});
      },function(){checked++;if(checked>=total)Stage2._showScanResults(id,allFiles);});
    });
  },

  _showScanResults:function(id,files){
    if(files.length===0){
      Utils.toast('\u05dc\u05d0 \u05e0\u05de\u05e6\u05d0\u05d5 \u05d4\u05e7\u05dc\u05d8\u05d5\u05ea \u2014 \u05d4\u05e2\u05dc\u05d4 \u05d9\u05d3\u05e0\u05d9\u05ea','warning');return;
    }
    // Sort by name descending (newest Samsung recordings have timestamps)
    files.sort(function(a,b){return b.name.localeCompare(a.name);});
    var html='<div class="modal-title">\u{1f399}\ufe0f \u05d4\u05e7\u05dc\u05d8\u05d5\u05ea \u05e9\u05e0\u05de\u05e6\u05d0\u05d5 ('+files.length+')</div>'
    +'<div style="max-height:300px;overflow-y:auto;">';
    files.slice(0,20).forEach(function(f,i){
      html+='<div class="card" style="padding:10px;margin:6px 0;cursor:pointer;" onclick="Stage2._pickScannedFile(\''+id+'\',\''+f.path.replace(/'/g,"\\'")+'\')">'
      +'<div style="font-weight:600;font-size:0.9rem;">'+Utils.escHtml(f.name)+'</div>'
      +'</div>';
    });
    html+='</div>';
    Stages.showModal(html);
  },

  async _pickScannedFile(id,nativeURL){
    Stages.closeModal();
    Utils.toast('\u05e7\u05d5\u05e8\u05d0 \u05e7\u05d5\u05d1\u05e5...','info');
    window.resolveLocalFileSystemURL(nativeURL,function(fe){
      fe.file(function(file){
        var reader=new FileReader();
        reader.onloadend=function(){
          var b64=reader.result;
          var fname=file.name||'recording.m4a';
          DB.saveFile({name:fname,data:b64,type:file.type||'audio/m4a',candidateId:id}).then(function(fRec){
            DB.getCandidate(id).then(function(c){
              c.stage2_recFileId=fRec.id;c.stage2_recFileName=fname;
              DB.saveCandidate(c).then(function(){
                Utils.toast('\u05d4\u05e7\u05dc\u05d8\u05d4 \u05e0\u05e9\u05de\u05e8\u05d4! \u{1f399}','success');
                App.renderCandidateView(id);
              });
            });
          });
        };
        reader.readAsDataURL(file);
      });
    },function(e){_dbg('Scan pick err:'+JSON.stringify(e));Utils.toast('\u05e9\u05d2\u05d9\u05d0\u05d4 \u05d1\u05e7\u05e8\u05d9\u05d0\u05d4','danger');});
  },

  // Manual upload
  async uploadRecording(id,input){
    if(!input.files||!input.files[0])return;
    var file=input.files[0];
    Utils.toast('\u05e9\u05d5\u05de\u05e8 \u05d4\u05e7\u05dc\u05d8\u05d4...','info');
    var reader=new FileReader();
    reader.onload=async function(e){
      var fRec=await DB.saveFile({name:file.name,data:e.target.result,type:file.type,candidateId:id});
      var c=await DB.getCandidate(id);
      c.stage2_recFileId=fRec.id;c.stage2_recFileName=file.name;
      await DB.saveCandidate(c);
      Utils.toast('\u05d4\u05e7\u05dc\u05d8\u05d4 \u05e0\u05e9\u05de\u05e8\u05d4! \u{1f399}','success');
      App.renderCandidateView(id);
    };
    reader.readAsDataURL(file);
  },

  // Play recording
  async playRecording(id){
    var c=await DB.getCandidate(id);
    if(!c.stage2_recFileId)return;
    var f=await DB.getFile(c.stage2_recFileId);
    if(!f||!f.data)return;
    // Create audio and play
    if(Stage2._audioEl){Stage2._audioEl.pause();Stage2._audioEl=null;}
    Stage2._audioEl=new Audio(f.data);
    Stage2._audioEl.play();
    Utils.toast('\u25b6 \u05de\u05e0\u05d2\u05df...','info');
  },

  // Export recording via share
  async exportRecording(id){
    var c=await DB.getCandidate(id);
    if(!c.stage2_recFileId)return;
    var f=await DB.getFile(c.stage2_recFileId);
    if(!f||!f.data)return;
    // Convert base64 to blob and share
    var parts=f.data.split(',');var mime=parts[0].match(/:(.*?);/)[1];
    var bstr=atob(parts[1]);var n=bstr.length;var u8=new Uint8Array(n);
    for(var i=0;i<n;i++)u8[i]=bstr.charCodeAt(i);
    var blob=new Blob([u8],{type:mime});
    var fn=f.name||'recording.m4a';
    if(window.cordova&&window.cordova.file){
      window.resolveLocalFileSystemURL(cordova.file.cacheDirectory,function(dir){
        dir.getFile(fn,{create:true,exclusive:false},function(fe){
          fe.createWriter(function(w){
            w.onwriteend=function(){Utils.shareViaPlugin('','\u05d4\u05e7\u05dc\u05d8\u05ea \u05e9\u05d9\u05d7\u05d4',[fe.nativeURL]);};
            w.write(blob);
          });
        });
      });
    }else{
      var url=URL.createObjectURL(blob);var a=document.createElement('a');
      a.href=url;a.download=fn;document.body.appendChild(a);a.click();
      document.body.removeChild(a);URL.revokeObjectURL(url);
    }
  },

  async removeRecording(id){
    if(!confirm('\u05dc\u05de\u05d7\u05d5\u05e7 \u05d0\u05ea \u05d4\u05d4\u05e7\u05dc\u05d8\u05d4?'))return;
    var c=await DB.getCandidate(id);
    c.stage2_recFileId=null;c.stage2_recFileName=null;
    await DB.saveCandidate(c);
    Utils.toast('\u05d4\u05e7\u05dc\u05d8\u05d4 \u05e0\u05de\u05d7\u05e7\u05d4','info');
    App.renderCandidateView(id);
  },

  // ===== TRANSCRIPTION =====
  // FIX #9: Support AssemblyAI (free tier) + Whisper server
  async transcribe(id){
    var c=await DB.getCandidate(id);
    if(!c.stage2_recFileId){Utils.toast('אין הקלטה','danger');return;}
    var service=App.settings.transcriptionService||'';
    var whisperUrl=App.settings.whisperServerUrl||'';
    var assemblyKey=App.settings.assemblyAiKey||'';
    if(!service||(service==='whisper'&&!whisperUrl)||(service==='assemblyai'&&!assemblyKey)){
      Stage2._showTranscriptionSetup(id);return;
    }
    Utils.toast('שולח לתמלול...','info');
    try{
      var f=await DB.getFile(c.stage2_recFileId);
      if(!f||!f.data){Utils.toast('קובץ הקלטה לא נמצא','danger');return;}
      var transcription;
      if(service==='assemblyai'){
        transcription=await Stage2._transcribeAssemblyAI(f,assemblyKey);
      }else{
        transcription=await Stage2._transcribeWhisper(f,whisperUrl);
      }
      c.stage2_transcription=JSON.stringify(transcription);
      c.stage2_transcriptionAt=new Date().toISOString();
      await DB.saveCandidate(c);
      Utils.toast('תמלול הושלם! ✅','success');
      App.renderCandidateView(id);
    }catch(e){
      _dbg('Transcribe err:'+e.message);
      Utils.toast('שגיאה בתמלול: '+e.message,'danger');
    }
  },

  async _transcribeAssemblyAI(f,apiKey){
    var b64data=f.data.split(',')[1]||f.data;
    var bstr=atob(b64data);var n=bstr.length;var u8=new Uint8Array(n);
    for(var i=0;i<n;i++)u8[i]=bstr.charCodeAt(i);
    var uploadResp=await fetch('https://api.assemblyai.com/v2/upload',{
      method:'POST',headers:{'Authorization':apiKey,'Content-Type':'application/octet-stream'},body:u8
    });
    if(!uploadResp.ok)throw new Error('Upload: '+uploadResp.status);
    var uploadData=await uploadResp.json();
    var transResp=await fetch('https://api.assemblyai.com/v2/transcript',{
      method:'POST',headers:{'Authorization':apiKey,'Content-Type':'application/json'},
      body:JSON.stringify({audio_url:uploadData.upload_url,language_code:'he',speaker_labels:true,speakers_expected:2})
    });
    if(!transResp.ok)throw new Error('Transcribe: '+transResp.status);
    var transData=await transResp.json();var tid=transData.id;
    var maxTries=60;var tries=0;
    while(tries<maxTries){
      await new Promise(function(r){setTimeout(r,3000);});
      var pollResp=await fetch('https://api.assemblyai.com/v2/transcript/'+tid,{headers:{'Authorization':apiKey}});
      var pd=await pollResp.json();
      if(pd.status==='completed'){
        if(pd.utterances&&pd.utterances.length>0){
          return pd.utterances.map(function(u){return {speaker:u.speaker==='A'?'רכז':'מועמד',text:u.text};});
        }
        return pd.text?[{speaker:'רכז',text:pd.text}]:[{speaker:'',text:'אין תוצאות'}];
      }else if(pd.status==='error'){throw new Error(pd.error||'Failed');}
      tries++;
      if(tries%5===0)Utils.toast('ממתין... ('+tries*3+' שניות)','info');
    }
    throw new Error('Timeout');
  },

  async _transcribeWhisper(f,serverUrl){
    var b64data=f.data.split(',')[1]||f.data;
    var resp=await fetch(serverUrl,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({audio_base64:b64data,language:'he',diarize:true,num_speakers:2,filename:f.name||'recording.m4a'})
    });
    if(!resp.ok)throw new Error('Server: '+resp.status);
    var result=await resp.json();
    if(result.segments&&result.segments.length>0)return result.segments;
    return result.text?[{speaker:'רכז',text:result.text}]:[{speaker:'רכז',text:JSON.stringify(result)}];
  },

  _showTranscriptionSetup(id){
    var svc=App.settings.transcriptionService||'';
    var html='<div class="modal-title">🎙 הגדרת שירות תמלול</div>'
    +'<div class="card-meta" style="margin-bottom:10px;">בחר שירות תמלול ורשום מפתח API</div>'
    +'<div class="form-group"><label class="form-label">שירות</label><div class="radio-group">'
    +'<div class="radio-btn '+(svc==='assemblyai'?'active-success':'')+'" onclick="Stage2._pickTransSvc(\'assemblyai\',this)">AssemblyAI (חינם)</div>'
    +'<div class="radio-btn '+(svc==='whisper'?'active-success':'')+'" onclick="Stage2._pickTransSvc(\'whisper\',this)">Whisper (שרת עצמי)</div>'
    +'</div></div><div id="transSetupFields"></div>'
    +'<button class="btn btn-primary" style="width:100%;margin-top:12px;" onclick="Stage2._saveTransSettings(\''+id+'\')">💾 שמור והתחל תמלול</button>';
    Stages.showModal(html);if(svc)Stage2._showTransFields(svc);
  },
  _selectedTransSvc:'',
  _pickTransSvc(svc,el){
    el.parentElement.querySelectorAll('.radio-btn').forEach(function(b){b.className='radio-btn';});
    el.classList.add('radio-btn','active-success');Stage2._selectedTransSvc=svc;Stage2._showTransFields(svc);
  },
  _showTransFields(svc){
    var el=Utils.id('transSetupFields');if(!el)return;
    if(svc==='assemblyai'){
      el.innerHTML='<div class="form-group"><label class="form-label">AssemblyAI API Key</label>'
      +'<input class="form-input" id="transApiKey" dir="ltr" value="'+(App.settings.assemblyAiKey||'')+'" placeholder="your-api-key"></div>'
      +'<div class="card-meta">$50 קרדיט חינם (~100 שעות). הרשמה: assemblyai.com</div>';
    }else{
      el.innerHTML='<div class="form-group"><label class="form-label">כתובת שרת Whisper</label>'
      +'<input class="form-input" id="transApiKey" dir="ltr" value="'+(App.settings.whisperServerUrl||'')+'" placeholder="https://server/api/transcribe"></div>';
    }
  },
  async _saveTransSettings(id){
    var svc=Stage2._selectedTransSvc;var key=Utils.id('transApiKey')?.value?.trim();
    if(!svc){Utils.toast('בחר שירות','danger');return;}
    if(!key){Utils.toast('הכנס מפתח/כתובת','danger');return;}
    await Admin.saveSetting('transcriptionService',svc);App.settings.transcriptionService=svc;
    if(svc==='assemblyai'){await Admin.saveSetting('assemblyAiKey',key);App.settings.assemblyAiKey=key;}
    else{await Admin.saveSetting('whisperServerUrl',key);App.settings.whisperServerUrl=key;}
    Stages.closeModal();Stage2.transcribe(id);
  },

  // Manual transcription paste
  manualTranscription:function(id){
    var html='<div class="modal-title">\u{1f4cb} \u05d4\u05d3\u05d1\u05e7\u05ea \u05ea\u05de\u05dc\u05d5\u05dc</div>'
    +'<div class="card-meta" style="margin-bottom:8px;">\u05d4\u05d3\u05d1\u05e7 \u05ea\u05de\u05dc\u05d5\u05dc \u05de\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4 \u05d7\u05d9\u05e6\u05d5\u05e0\u05d9\u05ea \u05d0\u05d5 \u05db\u05ea\u05d5\u05d1 \u05d9\u05d3\u05e0\u05d9\u05ea.<br>\u05e4\u05d5\u05e8\u05de\u05d8: \u05db\u05dc \u05e9\u05d5\u05e8\u05d4 = \u05d3\u05d5\u05d1\u05e8 \u05d7\u05d3\u05e9. \u05e8\u05e9\u05d5\u05ea "\u05e8\u05db\u05d6:" \u05d0\u05d5 "\u05de\u05d5\u05e2\u05de\u05d3:" \u05d1\u05ea\u05d7\u05d9\u05dc\u05ea \u05e9\u05d5\u05e8\u05d4.</div>'
    +'<div class="form-group"><textarea class="form-textarea" id="manualTransText" rows="8" placeholder="\u05e8\u05db\u05d6: \u05e9\u05dc\u05d5\u05dd, \u05d0\u05e0\u05d9 \u05de\u05ea\u05e7\u05e9\u05e8 \u05dc...\n\u05de\u05d5\u05e2\u05de\u05d3: \u05d4\u05d9\u05d9, \u05e9\u05dc\u05d5\u05dd..."></textarea></div>'
    +'<button class="btn btn-primary" style="width:100%;margin-top:8px;" onclick="Stage2._saveManualTranscription(\''+id+'\')">\u{1f4be} \u05e9\u05de\u05d5\u05e8 \u05ea\u05de\u05dc\u05d5\u05dc</button>';
    Stages.showModal(html);
  },

  async _saveManualTranscription(id){
    var text=Utils.id('manualTransText')?.value;
    if(!text||!text.trim()){Utils.toast('\u05d4\u05db\u05e0\u05e1 \u05ea\u05de\u05dc\u05d5\u05dc','danger');return;}
    // Parse lines into segments
    var lines=text.trim().split('\n');
    var segments=[];
    lines.forEach(function(line){
      line=line.trim();
      if(!line)return;
      var match=line.match(/^([^:]+):\s*(.+)$/);
      if(match){
        segments.push({speaker:match[1].trim(),text:match[2].trim()});
      }else{
        segments.push({speaker:'',text:line});
      }
    });
    var c=await DB.getCandidate(id);
    c.stage2_transcription=JSON.stringify(segments);
    c.stage2_transcriptionAt=new Date().toISOString();
    await DB.saveCandidate(c);
    Stages.closeModal();
    Utils.toast('\u05ea\u05de\u05dc\u05d5\u05dc \u05e0\u05e9\u05de\u05e8!','success');
    App.renderCandidateView(id);
  },

  // Render transcription with speaker labels
  _renderTranscription:function(jsonStr){
    try{
      var segs=JSON.parse(jsonStr);
      var html='';
      segs.forEach(function(s){
        var spkColor=s.speaker&&s.speaker.indexOf('\u05de\u05d5\u05e2\u05de\u05d3')>-1?'#7c3aed':'#059669';
        html+='<div style="margin-bottom:6px;">';
        if(s.speaker)html+='<strong style="color:'+spkColor+';">'+Utils.escHtml(s.speaker)+':</strong> ';
        html+=Utils.escHtml(s.text)+'</div>';
      });
      return html;
    }catch(e){return Utils.escHtml(jsonStr);}
  },

  // Export transcription as HTML file
  async exportTranscription(id){
    var c=await DB.getCandidate(id);
    if(!c.stage2_transcription)return;
    var html='<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8">'
    +'<style>body{font-family:David,Arial;direction:rtl;padding:30px;max-width:800px;margin:0 auto;}'
    +'h1{color:#1B2A4A;}.recruiter{color:#059669;font-weight:bold;}.candidate{color:#7c3aed;font-weight:bold;}'
    +'.line{margin:8px 0;padding:8px;border-radius:6px;background:#f8fafc;}</style></head><body>'
    +'<h1>\u{1f4dd} \u05ea\u05de\u05dc\u05d5\u05dc \u05e9\u05d9\u05d7\u05d4 \u2014 '+Utils.escHtml(c.name)+'</h1>'
    +'<p>\u05ea\u05d0\u05e8\u05d9\u05da: '+Utils.formatDate(c.stage2_transcriptionAt||new Date().toISOString())+'</p>';
    try{
      var segs=JSON.parse(c.stage2_transcription);
      segs.forEach(function(s){
        var cls=s.speaker&&s.speaker.indexOf('\u05de\u05d5\u05e2\u05de\u05d3')>-1?'candidate':'recruiter';
        html+='<div class="line"><span class="'+cls+'">'+Utils.escHtml(s.speaker||'')+':</span> '+Utils.escHtml(s.text)+'</div>';
      });
    }catch(e){html+='<pre>'+Utils.escHtml(c.stage2_transcription)+'</pre>';}
    html+='</body></html>';
    var fn='\u05ea\u05de\u05dc\u05d5\u05dc_'+c.name.replace(/\s/g,'_')+'_'+Utils.today()+'.html';
    Utils.writeToCacheAndShare(fn,html,'text/html','\u05ea\u05de\u05dc\u05d5\u05dc \u05e9\u05d9\u05d7\u05d4 \u2014 '+c.name);
  },

  // Copy transcription text for external AI
  async copyTranscriptionForAI(id){
    var c=await DB.getCandidate(id);
    if(!c.stage2_transcription)return;
    var text='\u05ea\u05de\u05dc\u05d5\u05dc \u05e9\u05d9\u05d7\u05d4 \u05d8\u05dc\u05e4\u05d5\u05e0\u05d9\u05ea \u05e2\u05dd '+c.name+':\n\n';
    try{
      var segs=JSON.parse(c.stage2_transcription);
      segs.forEach(function(s){
        text+=(s.speaker?s.speaker+': ':'')+s.text+'\n';
      });
    }catch(e){text+=c.stage2_transcription;}
    text+='\n\n\u05e0\u05d0 \u05e0\u05ea\u05d7 \u05e1\u05d9\u05db\u05d5\u05dd \u05e9\u05dc \u05d4\u05e9\u05d9\u05d7\u05d4, \u05e0\u05e7\u05d5\u05d3\u05d5\u05ea \u05d7\u05d5\u05d6\u05e7\u05d4 \u05d5\u05d7\u05d5\u05dc\u05e9\u05d5\u05ea, \u05d5\u05d4\u05de\u05dc\u05e6\u05d5\u05ea \u05dc\u05d4\u05de\u05e9\u05da \u05dc\u05e9\u05dc\u05d1\u05d9 \u05d4\u05d2\u05d9\u05d5\u05e1 \u05d4\u05d1\u05d0\u05d9\u05dd.';
    // Try clipboard, fallback to share
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(function(){
        Utils.toast('\u05d4\u05d5\u05e2\u05ea\u05e7 \u05dc\u05dc\u05d5\u05d7! \u05d4\u05d3\u05d1\u05e7 \u05d1-AI','success');
      }).catch(function(){
        Utils.shareViaPlugin(text,'\u05ea\u05de\u05dc\u05d5\u05dc \u05dc-AI',[]);
      });
    }else{
      Utils.shareViaPlugin(text,'\u05ea\u05de\u05dc\u05d5\u05dc \u05dc-AI',[]);
    }
  },

  async removeTranscription(id){
    if(!confirm('\u05dc\u05de\u05d7\u05d5\u05e7 \u05d0\u05ea \u05d4\u05ea\u05de\u05dc\u05d5\u05dc?'))return;
    var c=await DB.getCandidate(id);
    c.stage2_transcription=null;c.stage2_transcriptionAt=null;
    await DB.saveCandidate(c);
    Utils.toast('\u05ea\u05de\u05dc\u05d5\u05dc \u05e0\u05de\u05d7\u05e7','info');
    App.renderCandidateView(id);
  },

  _audioEl:null,

  // ===== Form helpers =====
  _field:function(id,key,label,type,val){
    return '<div class="form-group"><label class="form-label">'+label+'</label>'
    +'<input class="form-input" type="'+(type||'text')+'" value="'+Utils.escHtml(val)+'" '
    +'onchange="Stage2._save(\''+id+'\',\''+key+'\',this.value)"></div>';
  },
  _textarea:function(id,key,label,val){
    return '<div class="form-group"><label class="form-label">'+label+'</label>'
    +'<textarea class="form-textarea" rows="2" onchange="Stage2._save(\''+id+'\',\''+key+'\',this.value)">'+Utils.escHtml(val)+'</textarea></div>';
  },
  _select:function(id,key,label,opts,val){
    var html='<div class="form-group"><label class="form-label">'+label+'</label>'
    +'<select class="form-select" onchange="Stage2._save(\''+id+'\',\''+key+'\',this.value)">'
    +'<option value="">\u05d1\u05d7\u05e8...</option>';
    opts.forEach(function(o){html+='<option value="'+o+'"'+(val===o?' selected':'')+'>'+o+'</option>';});
    return html+'</select></div>';
  },
  _yesNo:function(id,key,label,val){
    return '<div class="form-group"><label class="form-label">'+label+'</label><div class="radio-group">'
    +'<div class="radio-btn '+(val==='\u05db\u05df'?'active-success':'')+'" onclick="Stage2._saveRadio(\''+id+'\',\''+key+'\',\'\u05db\u05df\',this)">\u05db\u05df</div>'
    +'<div class="radio-btn '+(val==='\u05dc\u05d0'?'active-danger':'')+'" onclick="Stage2._saveRadio(\''+id+'\',\''+key+'\',\'\u05dc\u05d0\',this)">\u05dc\u05d0</div>'
    +'</div></div>';
  },
  _yesNoConditional:function(id,key,label,val,detailVal){
    var show=(val==='\u05db\u05df');
    return '<div class="form-group"><label class="form-label">'+label+'</label><div class="radio-group">'
    +'<div class="radio-btn '+(val==='\u05db\u05df'?'active-success':'')+'" onclick="Stage2._saveRadioConditional(\''+id+'\',\''+key+'\',\'\u05db\u05df\',this)">\u05db\u05df</div>'
    +'<div class="radio-btn '+(val==='\u05dc\u05d0'?'active-danger':'')+'" onclick="Stage2._saveRadioConditional(\''+id+'\',\''+key+'\',\'\u05dc\u05d0\',this)">\u05dc\u05d0</div>'
    +'</div>'
    +'<div class="conditional '+(show?'show':'')+'" id="cond_'+key+'">'
    +'<div class="form-group"><label class="form-label">\u05e4\u05e8\u05d8</label>'
    +'<textarea class="form-textarea" rows="2" onchange="Stage2._save(\''+id+'\',\''+key+'Detail\',this.value)">'+Utils.escHtml(detailVal||'')+'</textarea></div></div></div>';
  },
  _numButtons:function(id,key,label,nums,val){
    var html='<div class="form-group"><label class="form-label">'+label+'</label><div class="scale-group">';
    nums.forEach(function(n){
      html+='<div class="scale-btn '+(String(val)===String(n)?'active':'')+'" onclick="Stage2._saveScale(\''+id+'\',\''+key+'\',\''+n+'\',this)">'+n+'</div>';
    });
    return html+'</div></div>';
  },
  _save:function(id,key,val){App.markDirty(id,'stage2_q_'+key,val);},
  _saveRadio:function(id,key,val,el){
    el.parentElement.querySelectorAll('.radio-btn').forEach(function(b){b.className='radio-btn';});
    el.classList.add('radio-btn');el.classList.add(val==='\u05db\u05df'?'active-success':'active-danger');
    Stage2._save(id,key,val);
    // Show/hide intimate block
    if(key==='intimateConsent'){
      var blk=Utils.id('cond_intimateBlock');
      if(blk){if(val==='\u05db\u05df')blk.classList.add('show');else blk.classList.remove('show');}
    }
  },
  _saveRadioConditional:function(id,key,val,el){
    el.parentElement.querySelectorAll('.radio-btn').forEach(function(b){b.className='radio-btn';});
    el.classList.add('radio-btn');el.classList.add(val==='\u05db\u05df'?'active-success':'active-danger');
    Stage2._save(id,key,val);
    var cond=Utils.id('cond_'+key);
    if(cond){if(val==='\u05db\u05df')cond.classList.add('show');else cond.classList.remove('show');}
  },
  _saveGrade:function(id,val,el){
    el.parentElement.querySelectorAll('.scale-btn').forEach(function(b){b.classList.remove('active');b.style='';});
    var gColor=val<=2?'var(--danger)':val<=3?'var(--warning)':val<=5?'var(--primary)':'var(--success)';
    el.classList.add('active');el.style.cssText='background:'+gColor+';color:#fff;border-color:'+gColor;
    Stage2._save(id,'grade',String(val));
    if(val<3){Stage2._save(id,'result','\u05dc\u05d0 \u05e2\u05d1\u05e8');}
  },
  _saveResult:function(id,val,el){
    el.parentElement.querySelectorAll('.radio-btn').forEach(function(b){b.className='radio-btn';});
    el.classList.add('radio-btn');
    if(val==='\u05e2\u05d1\u05e8')el.classList.add('active-success');
    else if(val==='\u05d4\u05ea\u05dc\u05d1\u05d8\u05d5\u05ea')el.classList.add('active-warning');
    else el.classList.add('active-danger');
    Stage2._save(id,'result',val);
    var hd=Utils.id('cond_hesitDays');var rr=Utils.id('cond_rejectReason');
    if(hd){if(val==='\u05d4\u05ea\u05dc\u05d1\u05d8\u05d5\u05ea')hd.classList.add('show');else hd.classList.remove('show');}
    if(rr){if(val==='\u05dc\u05d0 \u05e2\u05d1\u05e8')rr.classList.add('show');else rr.classList.remove('show');}
  },
  _saveScale:function(id,key,val,el){
    el.parentElement.querySelectorAll('.scale-btn').forEach(function(b){b.classList.remove('active');});
    el.classList.add('active');Stage2._save(id,key,val);
  },
  async saveAndBack(id){await App.flushDirty();Utils.toast('\u05e0\u05e9\u05de\u05e8','success');App.renderCandidateView(id);}
};
