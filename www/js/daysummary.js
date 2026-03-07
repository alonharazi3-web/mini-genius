'use strict';
const DaySummary={
  async render(){
    var page=Utils.id('mainContent');var today=Utils.today();
    var log=await DB.getDayLog(today);
    var allTasks=await DB.getTasksForDate(today);
    var remaining=allTasks.filter(function(t){return !t.done});
    var done=allTasks.filter(function(t){return t.done});

    var significantTypes=['קידום','התקבלות','החלטה','הפסקה','הקפאה','ביטול הקפאה','תוצאת מבחן','מועמד חדש'];
    var significant=log.filter(function(l){return significantTypes.indexOf(l.type)>=0});

    var html='<div class="page active"><div style="display:flex;align-items:center;gap:10px;padding:14px;">'
    +'<button class="btn btn-outline btn-sm" onclick="App.navigate(\'stage\','+App.currentStage+')">←</button>'
    +'<div style="font-size:1.15rem;font-weight:700;">📋 סיכום יום</div></div>';

    html+='<div class="day-section"><h3>✅ אירועים משמעותיים ('+significant.length+')</h3>';
    if(significant.length){significant.slice(-20).reverse().forEach(function(l){
      html+='<div style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:.88rem;">'
      +'<span style="color:var(--text-light);">'+Utils.formatDateTime(l.time)+'</span> '
      +'<strong>'+Utils.escHtml(l.type)+'</strong>: '+Utils.escHtml(l.desc)+'</div>';});}
    else html+='<div class="card-meta">אין אירועים עדיין</div>';
    html+='</div>';

    html+='<div class="day-section"><h3>⏳ משימות שנותרו ('+remaining.length+')</h3>';
    remaining.forEach(function(t){
      var icon=Tasks.STAGE_ICONS[t.stageId]||'❗';
      html+='<div class="task-item"><div class="task-check" onclick="Tasks.toggleCustomTask(\''+t.id+'\')">○</div>'
      +'<span style="margin-left:4px;">'+icon+'</span>'
      +'<div class="task-text">'+Utils.escHtml(t.text)+'</div></div>';});
    if(!remaining.length)html+='<div class="card-meta">הכל בוצע! 🎉</div>';
    html+='</div>';

    html+='<div class="day-section"><h3>📊 סיכום צינור</h3><div id="pipelineSummary">טוען...</div></div>';

    // v2.7 #4: Enhanced day close
    html+='<div style="padding:14px;">'
    +'<button class="btn btn-primary" style="width:100%;" onclick="DaySummary.closeDay()">📧 סגירת יום (שליחת דוח + קבצים)</button></div>';
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

  // v2.7 #4: Close day with attachments
  async closeDay(){
    var today=Utils.today();var log=await DB.getDayLog(today);
    var significantTypes=['קידום','התקבלות','החלטה','הפסקה','הקפאה','תוצאת מבחן','מועמד חדש'];
    var significant=log.filter(function(l){return significantTypes.indexOf(l.type)>=0});

    // Count available files
    var stage2Cands=await DB.getByStage(2,App.currentJob);
    var withQuestionnaire=stage2Cands.filter(function(c){return c.stage2_q_grade;});

    var html='<div class="modal-title">📧 סגירת יום — שליחת דוח</div>';
    html+='<div style="margin-bottom:12px;font-size:.88rem;">'
    +'<div>📊 דוח יומי HTML</div>';
    if(withQuestionnaire.length)html+='<div>📄 '+withQuestionnaire.length+' שאלונים טלפוניים (Word)</div>';
    html+='</div>';

    html+='<div class="cb-row" onclick="this.querySelector(\'.cb-box\').classList.toggle(\'checked\')">'
    +'<div class="cb-box checked" id="closeIncludeReport">✓</div><span>דוח יומי מסכם</span></div>';

    if(withQuestionnaire.length){
      html+='<div class="cb-row" onclick="this.querySelector(\'.cb-box\').classList.toggle(\'checked\')">'
      +'<div class="cb-box checked" id="closeIncludeWord">✓</div><span>שאלונים טלפוניים (Word)</span></div>';
    }

    html+='<div style="display:flex;gap:8px;margin-top:16px;">'
    +'<button class="btn btn-primary" style="flex:1;" onclick="DaySummary.executeDayClose()">📧 שלח</button>'
    +'<button class="btn btn-outline" style="flex:1;" onclick="Stages.closeModal()">ביטול</button></div>';

    Stages.showModal(html);
  },

  async executeDayClose(){
    Stages.closeModal();
    Utils.toast('מכין קבצים...','info');
    var today=Utils.today();
    var files=[];

    try{
      var includeReport=Utils.id('closeIncludeReport')?.classList.contains('checked');
      var includeWord=Utils.id('closeIncludeWord')?.classList.contains('checked');

      // 1. Generate HTML daily report
      if(includeReport!==false){
        var reportHtml=await DaySummary._generateReportHtml();
        if(window.cordova&&window.cordova.file){
          var reportUrl=await DaySummary._writeToCache('daily_report_'+today+'.html',reportHtml,'text/html');
          if(reportUrl)files.push(reportUrl);
        }
      }

      // 2. Generate Word files for questionnaires
      if(includeWord){
        var stage2Cands=await DB.getByStage(2,App.currentJob);
        for(var i=0;i<stage2Cands.length;i++){
          var c=stage2Cands[i];
          if(!c.stage2_q_grade)continue;
          try{
            var blob=DaySummary._buildDocxForCandidate(c);
            if(blob&&window.cordova&&window.cordova.file){
              var fn='questionnaire_'+c.name.replace(/\s/g,'_')+'.docx';
              var docUrl=await DaySummary._writeBlobToCache(fn,blob);
              if(docUrl)files.push(docUrl);
            }
          }catch(e){_dbg('Docx gen err for '+c.name+': '+e);}
        }
      }

      // 3. Share everything via email
      var email=App.settings.email||'';
      var subject='Mini Genius — סיכום יום '+Utils.formatDate(new Date().toISOString());
      if(files.length&&window.plugins&&window.plugins.socialsharing){
        window.plugins.socialsharing.shareWithOptions({
          message:subject,
          subject:subject,
          files:files,
          chooserTitle:'שלח דוח יומי'
        },function(){Utils.toast('נשלח!','success');},
        function(e){_dbg('Share err: '+e);Utils.toast('שגיאה בשליחה','danger');});
      }else{
        // Fallback: mailto
        if(email){
          var body='סיכום יום - Mini Genius\n'+Utils.formatDate(new Date().toISOString());
          Utils.sendEmail(email,subject,body);
        }else{
          Utils.toast('הגדר מייל עדכונים בדף ניהול','warning');
        }
      }
    }catch(e){_dbg('Day close err: '+e);Utils.toast('שגיאה','danger');}
  },

  _buildDocxForCandidate:function(c){
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
        {label:'שירות צבאי',value:q('militaryService')},{label:'פסיכומטרי',value:q('psychometric')}
      ]}
    ];
    return DocxBuilder.build(c.name,sections,q('grade'),q('result'),q('notes'));
  },

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

  _writeToCache:function(filename,content,mimeType){
    return new Promise(function(resolve){
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
