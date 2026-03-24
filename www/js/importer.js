'use strict';
var Importer={
  _rows:[],_headers:[],_mapping:null,_candidates:[],_currentIdx:0,

  // ===== CSV Parser (handles quotes, commas, Hebrew) =====
  _parseCSV:function(text,delimiter){
    if(!delimiter){
      var firstLine=text.split('\n')[0];
      if(firstLine.split('\t').length>firstLine.split(',').length)delimiter='\t';
      else delimiter=',';
    }
    var rows=[],row=[''],c='',inQuote=false,i=0;
    for(;i<text.length;i++){
      c=text[i];
      if(inQuote){
        if(c==='"'&&text[i+1]==='"'){row[row.length-1]+='"';i++;}
        else if(c==='"')inQuote=false;
        else row[row.length-1]+=c;
      }else{
        if(c==='"')inQuote=true;
        else if(c===delimiter){row.push('');}
        else if(c==='\n'||c==='\r'){
          if(c==='\r'&&text[i+1]==='\n')i++;
          if(row.length>1||row[0]!=='')rows.push(row);
          row=[''];
        }else{row[row.length-1]+=c;}
      }
    }
    if(row.length>1||row[0]!=='')rows.push(row);
    return rows;
  },

  // ===== Launch import from admin =====
  start:function(){
    var lastDate=App.settings._lastImportDate||'';
    var lastCount=App.settings._lastImportCount||'';
    var html='<div class="modal-title">📥 ייבוא מ-Mega Genius</div>'
    +'<div class="info-box">בחר קובץ CSV או TSV מיוצא מ-Mega Genius.<br>ניתן לייצא מ-Excel כ-CSV (שמור בשם → CSV UTF-8).</div>';
    if(lastDate){
      html+='<div class="info-box" style="background:#f0fdf4;border-color:#bbf7d0;">ייבוא אחרון: '+Utils.formatDateTime(lastDate)+' ('+lastCount+' מועמדים)<br>המערכת תזהה אוטומטית מה חדש.</div>';
    }
    html+='<div class="form-group"><label class="form-label">בחר קובץ</label>'
    +'<input type="file" id="importFile" accept=".csv,.tsv,.txt" class="form-input" onchange="Importer.onFileSelected(this)"></div>'
    +'<div id="importPreview"></div>'
    +'<button class="btn btn-outline" style="width:100%;margin-top:12px;" onclick="Stages.closeModal()">ביטול</button>';
    Stages.showModal(html);
  },

  onFileSelected:function(input){
    if(!input.files||!input.files[0])return;
    var file=input.files[0];
    _dbg('Import file: '+file.name+' ('+file.size+' bytes)');
    var reader=new FileReader();
    reader.onload=function(e){
      var text=e.target.result;
      var rows=Importer._parseCSV(text);
      if(rows.length<2){Utils.toast('קובץ ריק או לא תקין','danger');return;}
      Importer._headers=rows[0];
      Importer._rows=rows.slice(1);
      _dbg('Parsed: '+Importer._headers.length+' columns, '+Importer._rows.length+' rows');
      Importer._showColumnMapping();
    };
    reader.readAsText(file,'UTF-8');
  },

  // ===== Column Mapping UI =====
  _showColumnMapping:function(){
    Stages.closeModal();
    var headers=Importer._headers;
    // Load saved mapping
    var savedRaw=App.settings.megaGeniusMapping||'';
    var saved=null;
    try{if(savedRaw)saved=JSON.parse(savedRaw);}catch(e){}

    var fields=[
      {key:'name',label:'שם מועמד',required:true},
      {key:'phone',label:'מספר טלפון',required:true},
      {key:'notes',label:'הערות',required:false},
      {key:'referrer',label:'ממליץ / מפנה',required:false},
      {key:'recruiter',label:'רכז מטפל',required:false}
    ];
    var stageFields=[];
    Utils.STAGES.forEach(function(s){
      stageFields.push({key:'stage'+s.id+'_date',label:s.icon+' '+s.name+' (עמודת תאריך)',stageId:s.id});
    });

    var html='<div class="page active" style="padding-bottom:100px;">'
    +'<div style="display:flex;align-items:center;gap:10px;padding:14px;">'
    +'<button class="btn btn-outline btn-sm" onclick="Importer.start()">←</button>'
    +'<div style="font-size:1.15rem;font-weight:700;">📥 מיפוי עמודות</div></div>';

    html+='<div class="info-box" style="margin:0 14px;">נמצאו <strong>'+Importer._rows.length+'</strong> שורות עם <strong>'+headers.length+'</strong> עמודות.<br>'
    +'שייך כל שדה לעמודה המתאימה. עמודות תחנה — אם יש תאריך בעמודה, המועמד עבר את התחנה.</div>';

    // Basic fields
    html+='<div class="card" style="margin:10px 14px;"><div style="font-weight:700;margin-bottom:10px;">שדות בסיסיים</div>';
    fields.forEach(function(f){
      html+='<div class="form-group"><label class="form-label">'+f.label+(f.required?' <span class="required">*</span>':'')+'</label>'
      +'<select class="form-select" id="map_'+f.key+'">'
      +'<option value="">— לא ממופה —</option>';
      headers.forEach(function(h,idx){
        var sel=(saved&&saved[f.key]===idx)?' selected':'';
        html+='<option value="'+idx+'"'+sel+'>'+Utils.escHtml(h)+' (עמודה '+(idx+1)+')</option>';
      });
      html+='</select></div>';
    });
    html+='</div>';

    // Stage columns — date/result + grade
    html+='<div class="card" style="margin:10px 14px;"><div style="font-weight:700;margin-bottom:10px;">עמודות תחנות</div>'
    +'<div class="info-box" style="margin-bottom:10px;">לכל תחנה ניתן לשייך עמודת תאריך/סטטוס ועמודת ציון.<br>'
    +'המערכת מזהה אוטומטית: תאריך, עבר/לא עבר, מספר 1-7.</div>';
    stageFields.forEach(function(f){
      html+='<div style="padding:8px 0;border-bottom:1px solid var(--border);">'
      +'<div style="font-weight:600;font-size:.88rem;margin-bottom:6px;">'+f.label+'</div>';
      // Date/result column
      html+='<div class="form-group" style="margin-bottom:6px;"><label class="form-label" style="font-size:.8rem;">עמודת תאריך / סטטוס</label>'
      +'<select class="form-select" id="map_'+f.key+'" style="font-size:.85rem;">'
      +'<option value="">— לא ממופה —</option>';
      headers.forEach(function(h,idx){
        var sel=(saved&&saved[f.key]===idx)?' selected':'';
        html+='<option value="'+idx+'"'+sel+'>'+Utils.escHtml(h)+' (#'+(idx+1)+')</option>';
      });
      html+='</select></div>';
      // Grade column
      html+='<div class="form-group" style="margin-bottom:0;"><label class="form-label" style="font-size:.8rem;">עמודת ציון (1-7)</label>'
      +'<select class="form-select" id="map_stage'+f.stageId+'_grade" style="font-size:.85rem;">'
      +'<option value="">— לא ממופה —</option>';
      headers.forEach(function(h,idx){
        var sel=(saved&&saved['stage'+f.stageId+'_grade']===idx)?' selected':'';
        html+='<option value="'+idx+'"'+sel+'>'+Utils.escHtml(h)+' (#'+(idx+1)+')</option>';
      });
      html+='</select></div></div>';
    });
    html+='</div>';

    // Sample data preview
    html+='<div class="card" style="margin:10px 14px;"><div style="font-weight:700;margin-bottom:10px;">תצוגה מקדימה (3 שורות ראשונות)</div>'
    +'<div style="overflow-x:auto;font-size:.75rem;direction:ltr;">';
    html+='<table style="border-collapse:collapse;min-width:100%;"><tr>';
    headers.forEach(function(h,i){html+='<th style="border:1px solid #ddd;padding:4px 6px;background:#1B2A4A;color:#fff;white-space:nowrap;font-size:.7rem;">'+Utils.escHtml(h)+'<br><span style="opacity:.6;">#'+(i+1)+'</span></th>';});
    html+='</tr>';
    for(var r=0;r<Math.min(3,Importer._rows.length);r++){
      html+='<tr>';
      for(var ci=0;ci<headers.length;ci++){
        html+='<td style="border:1px solid #ddd;padding:4px 6px;font-size:.7rem;white-space:nowrap;">'+Utils.escHtml(Importer._rows[r][ci]||'')+'</td>';
      }
      html+='</tr>';
    }
    html+='</table></div></div>';

    html+='<div style="padding:14px;"><button class="btn btn-primary" style="width:100%;" onclick="Importer.processMapping()">▶ המשך לבדיקת מועמדים</button></div>';
    html+='</div>';
    Utils.id('mainContent').innerHTML=html;
  },

  // ===== Process mapping → build candidate list with smart detection =====
  async processMapping(){
    var mapping={};
    var allFields=['name','phone','notes','referrer','recruiter'];
    Utils.STAGES.forEach(function(s){
      allFields.push('stage'+s.id+'_date');
      allFields.push('stage'+s.id+'_grade');
    });
    allFields.forEach(function(key){
      var el=Utils.id('map_'+key);
      if(el&&el.value!=='')mapping[key]=parseInt(el.value);
    });
    if(mapping.name===undefined||mapping.phone===undefined){
      Utils.toast('שם וטלפון הם שדות חובה','danger');return;
    }
    Importer._mapping=mapping;
    DB.setSetting('megaGeniusMapping',JSON.stringify(mapping));
    App.settings.megaGeniusMapping=JSON.stringify(mapping);

    var prevSnapshotRaw=await DB.getSetting('_importSnapshot');
    var prevSnapshot={};
    try{if(prevSnapshotRaw)prevSnapshot=JSON.parse(prevSnapshotRaw);}catch(e){}
    var prevCount=Object.keys(prevSnapshot).length;

    Importer._candidates=[];
    var newCount=0,changedCount=0,unchangedCount=0;
    Importer._rows.forEach(function(row,idx){
      var name=(row[mapping.name]||'').trim();
      var phone=(row[mapping.phone]||'').trim();
      if(!name||!phone)return;
      var c={
        _rowIdx:idx,name:name,phone:phone,
        notes:mapping.notes!==undefined?(row[mapping.notes]||'').trim():'',
        referrer:mapping.referrer!==undefined?(row[mapping.referrer]||'').trim():'',
        recruiter:mapping.recruiter!==undefined?(row[mapping.recruiter]||'').trim():'',
        _stageDates:{},_stageDecisions:{},_stageGrades:{}
      };
      var highestStage=0;
      Utils.STAGES.forEach(function(s){
        var dateKey='stage'+s.id+'_date';
        var gradeKey='stage'+s.id+'_grade';
        var stageCompleted=false;

        // Parse date/status column
        if(mapping[dateKey]!==undefined){
          var val=(row[mapping[dateKey]]||'').trim();
          if(val){
            var parsed=Importer._parseStageCell(val);
            if(parsed.date){c._stageDates[s.id]=parsed.date;stageCompleted=true;}
            if(parsed.decision){c._stageDecisions[s.id]=parsed.decision;if(parsed.decision==='pass')stageCompleted=true;}
            if(parsed.grade){c._stageGrades[s.id]=parsed.grade;stageCompleted=true;}
          }
        }
        // Parse separate grade column
        if(mapping[gradeKey]!==undefined){
          var gVal=(row[mapping[gradeKey]]||'').trim();
          if(gVal){
            var gParsed=Importer._parseStageCell(gVal);
            if(gParsed.grade)c._stageGrades[s.id]=gParsed.grade;
            if(gParsed.decision&&!c._stageDecisions[s.id])c._stageDecisions[s.id]=gParsed.decision;
            if(gParsed.grade||gParsed.decision)stageCompleted=true;
          }
        }
        if(stageCompleted&&s.id>highestStage)highestStage=s.id;
      });
      c._highestStage=highestStage;
      c._targetStage=Math.min(highestStage+1,Utils.STAGES[Utils.STAGES.length-1].id);
      if(highestStage===0)c._targetStage=1;

      var cleanPhone=phone.replace(/\D/g,'');
      var prev=prevSnapshot[cleanPhone];
      if(!prev){c._importStatus='new';newCount++;}
      else if(prev.stage!==c._targetStage||prev.name!==name){c._importStatus='changed';changedCount++;}
      else{c._importStatus='unchanged';unchangedCount++;}
      Importer._candidates.push(c);
    });

    _dbg('Import smart: '+newCount+' new, '+changedCount+' changed, '+unchangedCount+' unchanged');
    Importer._currentIdx=0;
    Importer._showSmartSummary(newCount,changedCount,unchangedCount,prevCount);
  },

  // ===== Parse cell value — detect date, pass/fail (Hebrew/English), grade 1-7 =====
  _parseStageCell:function(val){
    var result={date:null,decision:null,grade:null};
    if(!val)return result;
    val=val.trim();
    // Check Hebrew/English pass/fail
    if(/^(עבר|עברה|עבר\/ה|pass)$/i.test(val))result.decision='pass';
    else if(/^(לא עבר|לא עברה|נכשל|נכשלה|fail)$/i.test(val))result.decision='fail';
    // Check grade (standalone number 1-7)
    var num=parseFloat(val);
    if(!isNaN(num)&&num>=1&&num<=7&&num===Math.round(num)){
      result.grade=num;
      if(!result.decision)result.decision=num>=4?'pass':'fail';
    }
    // Check date
    if(Importer._looksLikeDate(val)){
      result.date=val;
      if(!result.decision)result.decision='pass';
    }
    // Mixed content — extract parts
    if(!result.date&&!result.decision&&!result.grade&&val.length>1){
      var dateMatch=val.match(/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/);
      if(dateMatch){result.date=dateMatch[0];if(!result.decision)result.decision='pass';}
      if(/עבר/.test(val)&&!/לא\s*עבר/.test(val))result.decision='pass';
      if(/לא\s*עבר|נכשל/.test(val))result.decision='fail';
      var numMatch=val.match(/\b([1-7])\b/);
      if(numMatch)result.grade=parseInt(numMatch[1]);
    }
    return result;
  },

  // ===== Smart summary — let user choose import mode =====
  _showSmartSummary:function(newCount,changedCount,unchangedCount,prevCount){
    var total=Importer._candidates.length;
    var html='<div class="page active"><div style="padding:14px;">'
    +'<div style="text-align:center;padding:20px 0;">'
    +'<div style="font-size:2.5rem;margin-bottom:8px;">📊</div>'
    +'<div style="font-size:1.2rem;font-weight:700;color:var(--primary);">סריקת קובץ הושלמה</div></div>';

    html+='<div class="kpi-row" style="margin:16px 0;">'
    +'<div class="kpi"><div class="kpi-value" style="color:var(--success)">'+newCount+'</div><div class="kpi-label">חדשים</div></div>'
    +'<div class="kpi"><div class="kpi-value" style="color:var(--warning)">'+changedCount+'</div><div class="kpi-label">השתנו</div></div>'
    +'<div class="kpi"><div class="kpi-value" style="color:var(--text-light)">'+unchangedCount+'</div><div class="kpi-label">ללא שינוי</div></div>'
    +'</div>';

    if(prevCount)html+='<div class="info-box" style="margin:0 0 16px;">ייבוא קודם: '+prevCount+' מועמדים</div>';

    html+='<div style="display:flex;flex-direction:column;gap:10px;">';

    if(newCount||changedCount){
      html+='<button class="btn btn-primary" style="width:100%;" onclick="Importer._importSmartAuto()">⚡ ייבוא חכם — חדשים ושינויים בלבד ('+( newCount+changedCount)+')</button>';
    }
    html+='<button class="btn btn-outline" style="width:100%;" onclick="Importer._currentIdx=0;Importer._showCandidate()">🔍 סקירה ידנית — מועמד אחר מועמד ('+total+')</button>';

    if(newCount){
      html+='<button class="btn btn-outline" style="width:100%;" onclick="Importer._importOnlyNew()">➕ ייבא רק חדשים ('+newCount+')</button>';
    }
    html+='</div></div></div>';
    Utils.id('mainContent').innerHTML=html;
  },

  // Auto-import new + changed, skip unchanged
  async _importSmartAuto(){
    Utils.toast('מייבא...','info');
    for(var i=0;i<Importer._candidates.length;i++){
      var c=Importer._candidates[i];
      if(c._importStatus==='unchanged'){c._action='skipped (unchanged)';continue;}
      var dups=await DB.findDups(c.phone);
      if(dups.length){
        if(c._importStatus==='changed'){
          // Auto-update existing
          var existing=dups[0];
          if(c.notes&&!existing.notes)existing.notes=c.notes;
          if(c.referrer&&!existing.referrer)existing.referrer=c.referrer;
          if(c._targetStage>existing.stage){
            existing.stage=c._targetStage;existing.status='active';
            existing.stageEnteredAt=new Date().toISOString();
          }
          Importer._applyStageData(existing,c,true);if(false){
          }
          await DB.saveCandidate(existing);c._action='updated';
          DB.logAction('עדכון ייבוא',c.name+' (Mega Genius)');
        }else{c._action='skipped (duplicate)';}
      }else{
        var newC={name:c.name,phone:c.phone,notes:c.notes,referrer:c.referrer,
          recruiter:c.recruiter||App.settings.leadRecruiter||'',
          stage:c._targetStage,status:'active',priority:'medium',
          jobId:App.currentJob,stageEnteredAt:new Date().toISOString(),
          importedFrom:'MegaGenius',importedAt:new Date().toISOString()};
        Importer._applyStageData(newC,c);if(false){
          newC['stage'+sid+'_completedAt']=c._stageDates[sid];
          newC['stage'+sid+'_decision']='pass';
        }
        await DB.saveCandidate(newC);c._action='imported';
        DB.logAction('ייבוא',c.name+' (Mega Genius)');
      }
    }
    Importer._currentIdx=Importer._candidates.length;
    await Importer._saveSnapshot();
    Importer._showSummary();
  },

  // Import only new candidates
  async _importOnlyNew(){
    Utils.toast('מייבא חדשים...','info');
    for(var i=0;i<Importer._candidates.length;i++){
      var c=Importer._candidates[i];
      if(c._importStatus!=='new'){c._action='skipped';continue;}
      var dups=await DB.findDups(c.phone);
      if(dups.length){c._action='skipped (duplicate)';continue;}
      var newC={name:c.name,phone:c.phone,notes:c.notes,referrer:c.referrer,
        recruiter:c.recruiter||App.settings.leadRecruiter||'',
        stage:c._targetStage,status:'active',priority:'medium',
        jobId:App.currentJob,stageEnteredAt:new Date().toISOString(),
        importedFrom:'MegaGenius',importedAt:new Date().toISOString()};
      Importer._applyStageData(newC,c);if(false){
        newC['stage'+sid+'_completedAt']=c._stageDates[sid];
        newC['stage'+sid+'_decision']='pass';
      }
      await DB.saveCandidate(newC);c._action='imported';
      DB.logAction('ייבוא',c.name+' (Mega Genius)');
    }
    Importer._currentIdx=Importer._candidates.length;
    await Importer._saveSnapshot();
    Importer._showSummary();
  },

  // ===== Apply stage data from import candidate to DB candidate =====
  _applyStageData:function(target,c,updateMode){
    for(var sid in c._stageDates){
      if(!updateMode||!target['stage'+sid+'_completedAt'])target['stage'+sid+'_completedAt']=c._stageDates[sid];
    }
    for(var sid in c._stageDecisions){
      if(!updateMode||!target['stage'+sid+'_decision'])target['stage'+sid+'_decision']=c._stageDecisions[sid];
    }
    for(var sid in c._stageGrades){
      if(!updateMode||!target['stage'+sid+'_grade'])target['stage'+sid+'_grade']=c._stageGrades[sid];
    }
  },

  _looksLikeDate:function(s){
    if(!s||s.length<4)return false;
    // Check common date patterns: dd/mm/yyyy, yyyy-mm-dd, dd.mm.yyyy, dd-mm-yyyy, or just has digits and separators
    return /\d{1,4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,4}/.test(s)||/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(s);
  },

  // ===== Show candidate for approval =====
  async _showCandidate(){
    var idx=Importer._currentIdx;
    var total=Importer._candidates.length;
    if(idx>=total){
      Importer._showSummary();return;
    }
    var c=Importer._candidates[idx];
    // Check for duplicates
    var dups=await DB.findDups(c.phone);
    var existingMatch=dups.length?dups[0]:null;

    var html='<div class="page active" style="padding-bottom:100px;">'
    +'<div style="display:flex;align-items:center;gap:10px;padding:14px;">'
    +'<button class="btn btn-outline btn-sm" onclick="Importer._showColumnMapping()">←</button>'
    +'<div style="flex:1;font-size:1.1rem;font-weight:700;">מועמד '+(idx+1)+'/'+total+'</div>'
    +'<span style="font-size:.82rem;color:var(--text-light);">'+Math.round((idx/total)*100)+'%</span></div>';

    // Progress bar
    html+='<div style="margin:0 14px 12px;height:6px;background:var(--border);border-radius:3px;">'
    +'<div style="height:100%;width:'+Math.round((idx/total)*100)+'%;background:var(--accent);border-radius:3px;"></div></div>';

    // Candidate card
    html+='<div class="card" style="border-right-color:var(--accent);">'
    +'<div style="font-size:1.1rem;font-weight:700;margin-bottom:8px;">'+Utils.escHtml(c.name)+'</div>'
    +'<div class="card-meta">📱 '+Utils.escHtml(c.phone)+'</div>';
    if(c.referrer)html+='<div class="card-meta">ממליץ: '+Utils.escHtml(c.referrer)+'</div>';
    if(c.recruiter)html+='<div class="card-meta">רכז: '+Utils.escHtml(c.recruiter)+'</div>';
    if(c.notes)html+='<div class="card-meta">הערות: '+Utils.escHtml(c.notes)+'</div>';

    // Stage dates, decisions, grades
    var hasStageData=Object.keys(c._stageDates).length||Object.keys(c._stageDecisions).length||Object.keys(c._stageGrades).length;
    if(hasStageData){
      html+='<div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border);">';
      Utils.STAGES.forEach(function(s){
        var date=c._stageDates[s.id];var decision=c._stageDecisions[s.id];var grade=c._stageGrades[s.id];
        if(date||decision||grade){
          var icon=decision==='fail'?'❌':'✅';
          var parts=[s.icon+' '+s.name+':'];
          if(date)parts.push(Utils.escHtml(date));
          if(decision)parts.push(decision==='pass'?'עבר':'לא עבר');
          if(grade)parts.push('ציון '+grade+'/7');
          html+='<div class="card-meta">'+icon+' '+parts.join(' | ')+'</div>';
        }
      });
      html+='</div>';
    }
    html+='<div style="margin-top:10px;padding:8px;background:var(--bg);border-radius:8px;">'
    +'<strong>יושב בתחנה:</strong> '+Utils.getStageName(c._targetStage)+'</div>';
    html+='</div>';

    // Duplicate warning
    if(existingMatch){
      html+='<div class="warn-box" style="margin:10px 14px;">⚠️ <strong>מועמד קיים במערכת!</strong><br>'
      +'שם: '+Utils.escHtml(existingMatch.name)+'<br>'
      +'טלפון: '+Utils.escHtml(existingMatch.phone)+'<br>'
      +'תחנה נוכחית: '+Utils.getStageName(existingMatch.stage)+'<br>'
      +'סטטוס: '+Utils.STATUSES[existingMatch.status]+'<br>'
      +'עדכון אחרון: '+Utils.formatDate(existingMatch.updatedAt)+'</div>';

      html+='<div style="padding:0 14px;"><div class="form-group"><label class="form-label">מה לעשות?</label>'
      +'<div style="display:flex;flex-direction:column;gap:8px;">'
      +'<button class="btn btn-primary" onclick="Importer._approve('+idx+',\'update\')">🔄 עדכן מועמד קיים</button>'
      +'<button class="btn btn-outline" onclick="Importer._approve('+idx+',\'new\')">➕ ייבא כמועמד חדש</button>'
      +'<button class="btn btn-outline" onclick="Importer._approve('+idx+',\'skip\')" style="color:var(--text-light);">⏭ דלג</button>'
      +'</div></div></div>';
    }else{
      html+='<div style="padding:14px;display:flex;gap:8px;">'
      +'<button class="btn btn-primary" style="flex:1;" onclick="Importer._approve('+idx+',\'new\')">✅ ייבא</button>'
      +'<button class="btn btn-outline" style="flex:1;" onclick="Importer._approve('+idx+',\'skip\')">⏭ דלג</button></div>';
    }

    // Skip all / Import all remaining
    html+='<div style="padding:0 14px 20px;display:flex;gap:8px;">'
    +'<button class="btn btn-outline btn-sm" style="flex:1;color:var(--text-light);" onclick="Importer._skipAll()">דלג על כל השאר</button>'
    +'<button class="btn btn-outline btn-sm" style="flex:1;" onclick="Importer._importAllRemaining()">ייבא את כל השאר</button>'
    +'</div></div>';
    Utils.id('mainContent').innerHTML=html;
  },

  // ===== Approve/skip candidate =====
  async _approve(idx,action){
    var c=Importer._candidates[idx];
    if(action==='skip'){
      c._action='skipped';
    }else if(action==='new'){
      var newC={
        name:c.name,phone:c.phone,notes:c.notes,referrer:c.referrer,
        recruiter:c.recruiter||App.settings.leadRecruiter||'',
        stage:c._targetStage,status:'active',priority:'medium',
        jobId:App.currentJob,stageEnteredAt:new Date().toISOString(),
        importedFrom:'MegaGenius',importedAt:new Date().toISOString()
      };
      Importer._applyStageData(newC,c);if(false){
        newC['stage'+sid+'_completedAt']=c._stageDates[sid];
        newC['stage'+sid+'_decision']='pass';
      }
      await DB.saveCandidate(newC);
      c._action='imported';
      DB.logAction('ייבוא',c.name+' (Mega Genius)');
    }else if(action==='update'){
      var dups=await DB.findDups(c.phone);
      if(dups.length){
        var existing=dups[0];
        if(c.notes&&!existing.notes)existing.notes=c.notes;
        if(c.referrer&&!existing.referrer)existing.referrer=c.referrer;
        if(c.recruiter&&!existing.recruiter)existing.recruiter=c.recruiter;
        if(c._targetStage>existing.stage){
          existing.stage=c._targetStage;existing.status='active';
          existing.stageEnteredAt=new Date().toISOString();
        }
        Importer._applyStageData(existing,c,true);if(false){
          if(!existing['stage'+sid+'_completedAt']){
            existing['stage'+sid+'_completedAt']=c._stageDates[sid];
            existing['stage'+sid+'_decision']='pass';
          }
        }
        await DB.saveCandidate(existing);
        c._action='updated';
        DB.logAction('עדכון ייבוא',c.name+' (Mega Genius)');
      }
    }
    Importer._currentIdx++;
    if(Importer._currentIdx>=Importer._candidates.length){
      await Importer._saveSnapshot();
    }
    Importer._showCandidate();
  },

  _skipAll:function(){
    for(var i=Importer._currentIdx;i<Importer._candidates.length;i++){
      Importer._candidates[i]._action='skipped';
    }
    Importer._currentIdx=Importer._candidates.length;
    Importer._saveSnapshot().then(function(){Importer._showSummary();});
  },

  async _importAllRemaining(){
    Utils.toast('מייבא '+(Importer._candidates.length-Importer._currentIdx)+' מועמדים...','info');
    for(var i=Importer._currentIdx;i<Importer._candidates.length;i++){
      var c=Importer._candidates[i];
      var dups=await DB.findDups(c.phone);
      if(dups.length){
        c._action='skipped (duplicate)';
        continue;
      }
      var newC={
        name:c.name,phone:c.phone,notes:c.notes,referrer:c.referrer,
        recruiter:c.recruiter||App.settings.leadRecruiter||'',
        stage:c._targetStage,status:'active',priority:'medium',
        jobId:App.currentJob,stageEnteredAt:new Date().toISOString(),
        importedFrom:'MegaGenius',importedAt:new Date().toISOString()
      };
      Importer._applyStageData(newC,c);if(false){
        newC['stage'+sid+'_completedAt']=c._stageDates[sid];
        newC['stage'+sid+'_decision']='pass';
      }
      await DB.saveCandidate(newC);
      c._action='imported';
      DB.logAction('ייבוא',c.name+' (Mega Genius)');
    }
    Importer._currentIdx=Importer._candidates.length;
    await Importer._saveSnapshot();
    Importer._showSummary();
  },

  // ===== Save import snapshot for smart comparison =====
  async _saveSnapshot(){
    var snapshot={};
    Importer._candidates.forEach(function(c){
      var cleanPhone=c.phone.replace(/\D/g,'');
      snapshot[cleanPhone]={name:c.name,stage:c._targetStage,importedAt:new Date().toISOString()};
    });
    await DB.setSetting('_importSnapshot',JSON.stringify(snapshot));
    await DB.setSetting('_lastImportDate',new Date().toISOString());
    await DB.setSetting('_lastImportCount',String(Importer._candidates.length));
    _dbg('Snapshot saved: '+Object.keys(snapshot).length+' phones');
  },

  // ===== Summary =====
  _showSummary:function(){
    var imported=Importer._candidates.filter(function(c){return c._action==='imported'}).length;
    var updated=Importer._candidates.filter(function(c){return c._action==='updated'}).length;
    var skipped=Importer._candidates.filter(function(c){return c._action&&c._action.startsWith('skip')}).length;
    var total=Importer._candidates.length;

    var html='<div class="page active"><div style="padding:14px;">'
    +'<div style="text-align:center;padding:30px 0;">'
    +'<div style="font-size:3rem;margin-bottom:12px;">✅</div>'
    +'<div style="font-size:1.3rem;font-weight:700;color:var(--primary);">ייבוא הושלם!</div></div>';

    html+='<div class="kpi-row" style="margin:20px 0;">'
    +'<div class="kpi"><div class="kpi-value" style="color:var(--success)">'+imported+'</div><div class="kpi-label">יובאו</div></div>'
    +'<div class="kpi"><div class="kpi-value" style="color:var(--accent)">'+updated+'</div><div class="kpi-label">עודכנו</div></div>'
    +'<div class="kpi"><div class="kpi-value" style="color:var(--text-light)">'+skipped+'</div><div class="kpi-label">דולגו</div></div>'
    +'</div>';

    html+='<button class="btn btn-primary" style="width:100%;margin-top:20px;" onclick="App.navigate(\'stage\',1)">חזור לאפליקציה</button>'
    +'</div></div>';
    Utils.id('mainContent').innerHTML=html;
    App.updateBadges();
  }
};
