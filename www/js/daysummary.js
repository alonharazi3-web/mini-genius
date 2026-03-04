'use strict';
const DaySummary={
  async render(){
    var page=Utils.id('mainContent');var today=Utils.today();
    var log=await DB.getDayLog(today);
    var allTasks=await DB.getTasksForDate(today);
    var remaining=allTasks.filter(function(t){return !t.done});
    var done=allTasks.filter(function(t){return t.done});

    // Filter log: only show completed stages (advancement, acceptance, decisions)
    var significantTypes=['קידום','התקבלות','החלטה','הפסקה','הקפאה','ביטול הקפאה','תוצאת מבחן','מועמד חדש'];
    var significant=log.filter(function(l){return significantTypes.indexOf(l.type)>=0});

    var html='<div class="page active"><div style="display:flex;align-items:center;gap:10px;padding:14px;">'
    +'<button class="btn btn-outline btn-sm" onclick="App.navigate(\'stage\','+App.currentStage+')">←</button>'
    +'<div style="font-size:1.15rem;font-weight:700;">📋 סיכום יום</div></div>';

    // Significant actions only
    html+='<div class="day-section"><h3>✅ אירועים משמעותיים ('+significant.length+')</h3>';
    if(significant.length){significant.slice(-20).reverse().forEach(function(l){
      html+='<div style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:.88rem;">'
      +'<span style="color:var(--text-light);">'+Utils.formatDateTime(l.time)+'</span> '
      +'<strong>'+Utils.escHtml(l.type)+'</strong>: '+Utils.escHtml(l.desc)+'</div>';});}
    else html+='<div class="card-meta">אין אירועים עדיין</div>';
    html+='</div>';

    // Remaining
    html+='<div class="day-section"><h3>⏳ משימות שנותרו ('+remaining.length+')</h3>';
    remaining.forEach(function(t){
      html+='<div class="task-item"><div class="task-check" onclick="Tasks.toggleCustomTask(\''+t.id+'\',0)">○</div>'
      +'<div class="task-text">'+Utils.escHtml(t.text)+'</div></div>';});
    if(!remaining.length)html+='<div class="card-meta">הכל בוצע! 🎉</div>';
    html+='</div>';

    // Pipeline summary
    html+='<div class="day-section"><h3>📊 סיכום צינור</h3><div id="pipelineSummary">טוען...</div></div>';

    // Close day
    html+='<div style="padding:14px;">'
    +'<button class="btn btn-primary" style="width:100%;" onclick="DaySummary.closeDay()">📧 סגירת יום</button></div>';
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

  async closeDay(){
    var today=Utils.today();var log=await DB.getDayLog(today);
    var significantTypes=['קידום','התקבלות','החלטה','הפסקה','הקפאה','תוצאת מבחן','מועמד חדש'];
    var significant=log.filter(function(l){return significantTypes.indexOf(l.type)>=0});

    // Build email body
    var body='סיכום יום - '+Utils.formatDate(new Date().toISOString())+'\n\n';
    body+='אירועים משמעותיים:\n';
    significant.forEach(function(l){body+=l.type+': '+l.desc+'\n';});

    body+='\nצינור:\n';
    for(var i=1;i<=7;i++){
      var st=Utils.getStage(i);
      var cands=await DB.getByStage(i,App.currentJob);
      var active=cands.filter(function(c){return c.status==='active'}).length;
      if(active)body+=st.icon+' '+st.name+': '+active+' פעילים\n';
    }

    // Build HTML report for sharing
    var htmlReport='<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><style>'
    +'body{font-family:Arial;direction:rtl;padding:20px}h1{color:#1B2A4A}h2{color:#2D4A7A;margin-top:20px}'
    +'table{width:100%;border-collapse:collapse;margin:10px 0}th,td{border:1px solid #ddd;padding:8px;text-align:right}'
    +'th{background:#1B2A4A;color:#fff}</style></head><body>'
    +'<h1>Mini Genius - סיכום יום</h1>'
    +'<p>'+Utils.formatDate(new Date().toISOString())+'</p>'
    +'<h2>אירועים</h2><table><tr><th>שעה</th><th>סוג</th><th>פירוט</th></tr>';
    significant.forEach(function(l){
      htmlReport+='<tr><td>'+Utils.formatDateTime(l.time)+'</td><td>'+Utils.escHtml(l.type)+'</td><td>'+Utils.escHtml(l.desc)+'</td></tr>';
    });
    htmlReport+='</table><h2>צינור</h2><table><tr><th>שלב</th><th>פעילים</th></tr>';
    for(var i=1;i<=7;i++){
      var st=Utils.getStage(i);
      var cands=await DB.getByStage(i,App.currentJob);
      var active=cands.filter(function(c){return c.status==='active'}).length;
      htmlReport+='<tr><td>'+st.icon+' '+st.name+'</td><td>'+active+'</td></tr>';
    }
    htmlReport+='</table></body></html>';

    // Share via social sharing plugin
    var filename='day_summary_'+today+'.html';
    Utils.writeToCacheAndShare(filename,htmlReport,'text/html','Mini Genius - סיכום יום '+Utils.formatDate(new Date().toISOString()));

    // Also open mailto as backup
    var email=App.settings.email||'';
    if(email){Utils.sendEmail(email,'Mini Genius - סיכום יום '+Utils.formatDate(new Date().toISOString()),body);}
  }
};
