'use strict';
const DaySummary={
  _files:[], // cached generated files

  async render(){
    var page=Utils.id('mainContent');var today=Utils.today();
    var log=await DB.getDayLog(today);
    var allTasks=await DB.getTasksForDate(today);
    var remaining=allTasks.filter(function(t){return !t.done});

    var significantTypes=['קידום','התקבלות','החלטה','הפסקה','הקפאה','ביטול הקפאה','תוצאת מבחן','מועמד חדש'];
    var significant=log.filter(function(l){return significantTypes.indexOf(l.type)>=0});

    var html='<div class="page active"><div style="display:flex;align-items:center;gap:10px;padding:14px;">'
    +'<button class="btn btn-outline btn-sm" onclick="App.navigate(\'stage\','+App.currentStage+')">←</button>'
    +'<div style="font-size:1.15rem;font-weight:700;">📋 סיכום יום</div></div>';

    // Events
    html+='<div class="day-section"><h3>✅ אירועים משמעותיים ('+significant.length+')</h3>';
    if(significant.length){significant.slice(-20).reverse().forEach(function(l){
      html+='<div style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:.88rem;">'
      +'<span style="color:var(--text-light);">'+Utils.formatDateTime(l.time)+'</span> '
      +'<strong>'+Utils.escHtml(l.type)+'</strong>: '+Utils.escHtml(l.desc)+'</div>';});}
    else html+='<div class="card-meta">אין אירועים עדיין</div>';
    html+='</div>';

    // Remaining tasks
    html+='<div class="day-section"><h3>⏳ משימות שנותרו ('+remaining.length+')</h3>';
    remaining.forEach(function(t){
      var icon=Tasks.STAGE_ICONS[t.stageId]||'❗';
      html+='<div class="task-item"><div class="task-check" onclick="Tasks.toggleCustomTask(\''+t.id+'\')">○</div>'
      +'<span style="margin-left:4px;">'+icon+'</span>'
      +'<div class="task-text">'+Utils.escHtml(t.text)+'</div></div>';});
    if(!remaining.length)html+='<div class="card-meta">הכל בוצע! 🎉</div>';
    html+='</div>';

    // Pipeline
    html+='<div class="day-section"><h3>📊 סיכום צינור</h3><div id="pipelineSummary">טוען...</div></div>';

    // Close day button
    html+='<div style="padding:14px;">'
    +'<button class="btn btn-primary" style="width:100%;" onclick="DaySummary.prepareCloseDay()">📧 סגירת יום</button></div>';
    html+='</div>';page.innerHTML=html;
    DaySummary.loadPipeline();
  },

  async loadPipeline(){
    var el=Utils.id('pipelineSummary');if(!el)return;
    var html='';
    for(var i=1;i<=7;i++){
      var st=Utils.getStage(i);
      var cands=await DB.getByStage(i,App.currentJob);
      var active=cands.filter(function(c){return c.status==='active'}).length;
      if(active)html+='<div style="padding:4px 0;">'+st.icon+' '+st.name+': <strong>'+active+'</strong> פעילים</div>';
    }
    el.innerHTML=html||'אין מועמדים פעילים';
  },

  // ===== CLOSE DAY: Generate all documents, show file list =====
  async prepareCloseDay(){
    Utils.toast('מכין מסמכים...','info');
    DaySummary._files=[];
    var today=Utils.today();

    try{
      // 1. Daily summary report (HTML)
      var reportHtml=await DaySummary._generateReportHtml();
      DaySummary._files.push({
        name:'סיכום_יום_'+today+'.html',
        icon:'📊',
        label:'דוח סיכום יומי',
        content:reportHtml,
        mime:'text/html',
        type:'html'
      });

      // 2. Dashboard report (HTML)
      var dashHtml=await DaySummary._generateDashboardHtml();
      DaySummary._files.push({
        name:'dashboard_'+today+'.html',
        icon:'📈',
        label:'דשבורד',
        content:dashHtml,
        mime:'text/html',
        type:'html'
      });

      // 3. Word questionnaires for candidates with completed phone interviews
      var stage2Cands=await DB.getByStage(2,App.currentJob);
      var allCands=await DB.getAllCandidates();
      // Include candidates who had phone interview today or have grades
      var withQ=allCands.filter(function(c){
        return c.stage2_q_grade&&c.jobId===App.currentJob;
      });
      for(var i=0;i<withQ.length;i++){
        var c=withQ[i];
        try{
          var blob=DaySummary._buildDocx(c);
          DaySummary._files.push({
            name:'שאלון_'+c.name.replace(/\s/g,'_')+'.docx',
            icon:'📄',
            label:'שאלון — '+c.name,
            blob:blob,
            mime:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            type:'docx'
          });
        }catch(e){_dbg('Docx err for '+c.name+': '+e);}
      }

      // Show the file picker modal
      DaySummary._showFileModal();
    }catch(e){
      _dbg('prepareCloseDay err: '+e);
      Utils.toast('שגיאה בהכנת מסמכים','danger');
    }
  },

  _showFileModal:function(){
    var files=DaySummary._files;
    var html='<div class="modal-title">📧 סגירת יום — '+files.length+' מסמכים</div>';

    if(!files.length){
      html+='<div class="info-box">אין מסמכים לשליחה</div>';
    }else{
      html+='<div style="margin-bottom:12px;font-size:.82rem;color:var(--text-light);">סמן אילו מסמכים לשלוח במייל. לחץ על שם הקובץ לצפייה.</div>';

      files.forEach(function(f,idx){
        html+='<div style="display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid var(--border);">'
        // Checkbox
        +'<div class="cb-box checked" id="fileCheck_'+idx+'" onclick="event.stopPropagation();this.classList.toggle(\'checked\')">✓</div>'
        // File info (clickable for preview)
        +'<div style="flex:1;cursor:pointer;" onclick="DaySummary.previewFile('+idx+')">'
        +'<div style="font-size:.92rem;font-weight:600;">'+f.icon+' '+Utils.escHtml(f.label)+'</div>'
        +'<div style="font-size:.75rem;color:var(--text-light);">'+Utils.escHtml(f.name)+'</div>'
        +'</div>'
        // Preview button
        +'<button class="btn btn-outline btn-sm" style="flex-shrink:0;" onclick="DaySummary.previewFile('+idx+')">👁</button>'
        +'</div>';
      });
    }

    html+='<div style="display:flex;gap:8px;margin-top:16px;">'
    +'<button class="btn btn-primary" style="flex:1;" onclick="DaySummary.sendSelected()">📧 שלח במייל</button>'
    +'<button class="btn btn-outline" style="flex:1;" onclick="Stages.closeModal()">סגור</button></div>';

    Stages.showModal(html);
  },

  // Preview a file
  async previewFile(idx){
    var f=DaySummary._files[idx];
    if(!f)return;
    _dbg('Preview file: '+f.name);

    if(f.type==='html'){
      // Write HTML to cache and open
      if(window.cordova&&window.cordova.file){
        var url=await DaySummary._writeToCache(f.name,f.content,f.mime);
        if(url){
          if(window.plugins&&window.plugins.intentShim){
            plugins.intentShim.startActivity({
              action:'android.intent.action.VIEW',url:url,type:'text/html',extras:{}
            },function(){},function(){
              // Fallback: share
              Utils.shareViaPlugin('',' צפייה',[url]);
            });
          }else{Utils.shareViaPlugin('','צפייה',[url]);}
        }
      }else{
        var blob=new Blob([f.content],{type:'text/html'});
        window.open(URL.createObjectURL(blob),'_blank');
      }
    }else if(f.type==='docx'){
      // Write docx to cache and share/open
      if(window.cordova&&window.cordova.file){
        var url=await DaySummary._writeBlobToCache(f.name,f.blob);
        if(url){Utils.shareViaPlugin('','צפייה — '+f.label,[url]);}
      }else{
        var u=URL.createObjectURL(f.blob);
        var a=document.createElement('a');a.href=u;a.download=f.name;
        document.body.appendChild(a);a.click();document.body.removeChild(a);
      }
    }
  },

  // Send selected files via email
  async sendSelected(){
    var email=App.settings.email||'';
    var selected=[];

    for(var i=0;i<DaySummary._files.length;i++){
      var cb=Utils.id('fileCheck_'+i);
      if(cb&&cb.classList.contains('checked')){
        selected.push(DaySummary._files[i]);
      }
    }

    if(!selected.length){Utils.toast('בחר לפחות קובץ אחד','warning');return;}
    Stages.closeModal();
    Utils.toast('מכין '+selected.length+' קבצים...','info');

    try{
      var fileUrls=[];
      for(var i=0;i<selected.length;i++){
        var f=selected[i];
        var url;
        if(f.type==='html'&&window.cordova&&window.cordova.file){
          url=await DaySummary._writeToCache(f.name,f.content,f.mime);
        }else if(f.type==='docx'&&window.cordova&&window.cordova.file){
          url=await DaySummary._writeBlobToCache(f.name,f.blob);
        }
        if(url)fileUrls.push(url);
      }

      var subject='Mini Genius — סיכום יום '+Utils.formatDate(new Date().toISOString());
      var body='דוח יומי — '+selected.length+' קבצים מצורפים\n\nMini Genius v2.8';

      if(fileUrls.length&&window.plugins&&window.plugins.socialsharing){
        window.plugins.socialsharing.shareWithOptions({
          message:body,
          subject:subject,
          files:fileUrls,
          chooserTitle:'שלח דוח יומי'
        },function(){Utils.toast('נשלח!','success');},
        function(e){_dbg('Share err: '+e);Utils.toast('שגיאה בשליחה','danger');});
      }else if(email){
        Utils.sendEmail(email,subject,body);
      }else{
        Utils.toast('הגדר מייל עדכונים בדף ניהול','warning');
      }
    }catch(e){_dbg('sendSelected err: '+e);Utils.toast('שגיאה','danger');}
  },

  // ===== Helper: build docx for candidate =====
  _buildDocx:function(c){
    var q=function(f){return c['stage2_q_'+f]||'';};
    var sections=[
      {title:'פרטים אישיים',fields:[
        {label:'גיל',value:q('age')},{label:'מצב משפחתי',value:q('marital')},
        {label:'שוחח עם בן/בת זוג',value:q('partnerTalk')},{label:'ילדים',value:q('children')},
        {label:'מוכנות לרילוקציה',value:q('relocation')},{label:'משרה מלאה',value:q('fullTime')},
        {label:'רשיון נהיגה',value:q('license')},{label:'רשיון C',value:q('licenseC')}
      ]},
      {title:'מצב רפואי',fields:[
        {label:'מצב רפואי',value:q('medical'),detail:q('medicalDetail')},
        {label:'כושר גופני',value:q('fitness')},
        {label:'פציעת צה"ל',value:q('idfInjury')},
        {label:'ראייה/עיוורון',value:q('vision'),detail:q('visionDetail')},
        {label:'פרופיל צבאי',value:q('idfProfile')}
      ]},
      {title:'רקע והשכלה',fields:[
        {label:'עיסוק נוכחי',value:q('currentJob')},
        {label:'בגרות מלאה',value:q('bagrut'),detail:q('bagrutDetail')},
        {label:'אנגלית (0-7)',value:q('english')},{label:'מתמטיקה (0-5)',value:q('math')},
        {label:'לקויות למידה',value:q('learningDisability'),detail:q('learningDisabilityDetail')}
      ]},
      {title:'שירות צבאי ותעסוקה',fields:[
        {label:'שירות צבאי',value:q('militaryService')},
        {label:'לימודים אקדמיים',value:q('academic'),detail:q('academicDetail')},
        {label:'פסיכומטרי',value:q('psychometric')}
      ]}
    ];
    return DocxBuilder.build(c.name,sections,q('grade'),q('result'),q('notes'));
  },

  // ===== Generate report HTML =====
  async _generateReportHtml(){
    var today=Utils.today();var log=await DB.getDayLog(today);
    var significantTypes=['קידום','התקבלות','החלטה','הפסקה','הקפאה','תוצאת מבחן','מועמד חדש'];
    var significant=log.filter(function(l){return significantTypes.indexOf(l.type)>=0});

    var html='<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><style>'
    +'body{font-family:Arial;direction:rtl;padding:20px}h1{color:#1B2A4A}h2{color:#2D4A7A;margin-top:20px}'
    +'table{width:100%;border-collapse:collapse;margin:10px 0}th,td{border:1px solid #ddd;padding:8px;text-align:right}'
    +'th{background:#1B2A4A;color:#fff}</style></head><body>'
    +'<h1>Mini Genius — סיכום יום</h1>'
    +'<p>'+Utils.formatDate(new Date().toISOString())+'</p>'
    +'<h2>אירועים</h2><table><tr><th>שעה</th><th>סוג</th><th>פירוט</th></tr>';
    significant.forEach(function(l){
      html+='<tr><td>'+Utils.formatDateTime(l.time)+'</td><td>'+Utils.escHtml(l.type)+'</td><td>'+Utils.escHtml(l.desc)+'</td></tr>';
    });
    html+='</table><h2>צינור</h2><table><tr><th>שלב</th><th>פעילים</th></tr>';
    for(var i=1;i<=7;i++){
      var st=Utils.getStage(i);
      var cands=await DB.getByStage(i,App.currentJob);
      var active=cands.filter(function(c){return c.status==='active'}).length;
      html+='<tr><td>'+st.icon+' '+st.name+'</td><td>'+active+'</td></tr>';
    }
    html+='</table></body></html>';
    return html;
  },

  // ===== Generate dashboard HTML =====
  async _generateDashboardHtml(){
    var stageId=App.currentStage;var stage=Utils.getStage(stageId);
    var frozen=await DB.getFrozen(App.currentJob);
    var earlyCount=0,advancedCount=0;
    var allData={};
    for(var i=1;i<=7;i++){
      var sc=await DB.getByStage(i,App.currentJob);
      var ad=parseInt(App.settings['alertDaysStage'+i])||5;
      allData[i]={cands:sc,active:sc.filter(function(c){return c.status==='active'}),
        pass:sc.filter(function(c){return c.status==='pass'}),
        fail:sc.filter(function(c){return c.status==='fail'})};
      if(i<=4)earlyCount+=allData[i].active.length;else advancedCount+=allData[i].active.length;
    }

    var html='<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><style>'
    +'body{font-family:Arial;direction:rtl;padding:20px}h1{color:#1B2A4A}h2{color:#2D4A7A;margin-top:20px}'
    +'table{width:100%;border-collapse:collapse;margin:10px 0}th,td{border:1px solid #ddd;padding:8px;text-align:right}'
    +'th{background:#1B2A4A;color:#fff}.num{font-weight:bold;font-size:1.1rem}'
    +'</style></head><body>'
    +'<h1>Mini Genius — דשבורד</h1>'
    +'<p>'+Utils.formatDate(new Date().toISOString())+'</p>'
    +'<h2>סיכום כללי</h2>'
    +'<table><tr><th>מדד</th><th>כמות</th></tr>'
    +'<tr><td>שלבים ראשוניים (1-4)</td><td class="num">'+earlyCount+'</td></tr>'
    +'<tr><td>שלבים מתקדמים (5-7)</td><td class="num">'+advancedCount+'</td></tr>'
    +'<tr><td>מוקפאים</td><td class="num">'+frozen.length+'</td></tr></table>'
    +'<h2>פירוט לפי שלב</h2>'
    +'<table><tr><th>שלב</th><th>פעילים</th><th>עברו</th><th>נכשלו</th></tr>';
    for(var i=1;i<=7;i++){
      var st=Utils.getStage(i);var d=allData[i];
      html+='<tr><td>'+st.icon+' '+st.name+'</td><td>'+d.active.length+'</td><td>'+d.pass.length+'</td><td>'+d.fail.length+'</td></tr>';
    }
    html+='</table>';
    // Candidate list per stage
    for(var i=1;i<=7;i++){
      var st=Utils.getStage(i);var d=allData[i];
      if(d.active.length){
        html+='<h2>'+st.icon+' '+st.name+' — פעילים</h2><table><tr><th>שם</th><th>טלפון</th><th>סטטוס</th></tr>';
        d.active.forEach(function(c){
          html+='<tr><td>'+Utils.escHtml(c.name)+'</td><td>'+Utils.escHtml(c.phone)+'</td><td>'+Utils.STATUSES[c.status]+'</td></tr>';
        });
        html+='</table>';
      }
    }
    html+='</body></html>';
    return html;
  },

  // ===== File system helpers =====
  _writeToCache:function(filename,content,mimeType){
    return new Promise(function(resolve){
      if(!window.cordova||!window.cordova.file){resolve(null);return;}
      window.resolveLocalFileSystemURL(cordova.file.cacheDirectory,function(dir){
        dir.getFile(filename,{create:true,exclusive:false},function(fe){
          fe.createWriter(function(w){
            w.onwriteend=function(){resolve(fe.nativeURL);};
            w.onerror=function(){resolve(null);};
            w.write(new Blob([content],{type:mimeType}));
          });
        },function(){resolve(null);});
      },function(){resolve(null);});
    });
  },

  _writeBlobToCache:function(filename,blob){
    return new Promise(function(resolve){
      if(!window.cordova||!window.cordova.file){resolve(null);return;}
      var reader=new FileReader();
      reader.onload=function(){
        var buf=new Uint8Array(reader.result);
        window.resolveLocalFileSystemURL(cordova.file.cacheDirectory,function(dir){
          dir.getFile(filename,{create:true,exclusive:false},function(fe){
            fe.createWriter(function(w){
              w.onwriteend=function(){resolve(fe.nativeURL);};
              w.onerror=function(){resolve(null);};
              w.write(new Blob([buf]));
            });
          },function(){resolve(null);});
        },function(){resolve(null);});
      };
      reader.readAsArrayBuffer(blob);
    });
  }
};
