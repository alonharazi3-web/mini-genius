'use strict';
const DaySummary={
  async render(){
    const page=Utils.id('mainContent');const today=Utils.today();
    const log=await DB.getDayLog(today);
    const allTasks=await DB.getTasksForDate(today);
    const remaining=allTasks.filter(t=>!t.done);
    const done=allTasks.filter(t=>t.done);

    let html='<div class="page active"><div style="display:flex;align-items:center;gap:10px;padding:12px;">'
    +'<button class="btn btn-outline btn-sm" onclick="App.navigate(\'stage\','+App.currentStage+')">←</button>'
    +'<div style="font-size:1.1rem;font-weight:700;">📋 סיכום יום</div></div>';

    // Actions performed today
    html+='<div class="day-section"><h3>✅ פעולות שבוצעו היום ('+log.length+')</h3>';
    if(log.length){log.slice(-20).reverse().forEach(l=>{
      html+='<div class="action-log-item"><span style="color:var(--text-light);">'+Utils.formatDateTime(l.time)+'</span> '
      +Utils.escHtml(l.type)+': '+Utils.escHtml(JSON.stringify(l.data||{}).substring(0,80))+'</div>';});}
    else html+='<div class="card-meta">אין פעולות עדיין</div>';
    html+='</div>';

    // Remaining tasks
    html+='<div class="day-section"><h3>⏳ משימות שנותרו ('+remaining.length+')</h3>';
    remaining.forEach(t=>{
      html+='<div class="task-item"><div class="task-check" onclick="Tasks.toggleCustomTask(\''+t.id+'\',0)">○</div>'
      +'<div class="task-text">'+Utils.escHtml(t.text)+'</div></div>';});
    if(!remaining.length)html+='<div class="card-meta">הכל בוצע! 🎉</div>';
    html+='</div>';

    // Tomorrow planning
    const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);
    const tomorrowStr=tomorrow.toISOString().split('T')[0];
    const tomorrowTasks=await DB.getTasksForDate(tomorrowStr);
    html+='<div class="day-section"><h3>📅 מחר ('+tomorrowTasks.length+' משימות)</h3>';
    tomorrowTasks.forEach(t=>{
      html+='<div class="task-item"><div class="task-text">'+Utils.escHtml(t.text)+'</div></div>';});
    html+='<button class="btn btn-outline btn-sm" style="margin-top:8px;" onclick="Tasks.addTaskModal(0)">+ הוסף משימה למחר</button></div>';

    // Close Day button
    html+='<div style="padding:12px;"><button class="btn btn-primary" style="width:100%;padding:14px;font-size:1rem;" onclick="DaySummary.closeDay()">🔒 סגירת יום</button>'
    +'<div class="card-meta" style="text-align:center;margin-top:8px;">ישלח מייל מרוכז עם כל עדכוני היום</div></div>';

    html+='</div>';page.innerHTML=html;
  },

  async closeDay(){
    const today=Utils.today();const to=App.settings.email||'';
    if(!to){Utils.toast('לא הוגדר מייל בדף ניהול','danger');return;}
    const log=await DB.getDayLog(today);
    const cands=await DB.getAllCandidates();
    const todayCands=cands.filter(c=>c.createdAt&&c.createdAt.startsWith(today));
    const todayInterviews=cands.filter(c=>c.stage2_callDone&&c.updatedAt&&c.updatedAt.startsWith(today));
    const tasks=await DB.getTasksForDate(today);
    const remaining=tasks.filter(t=>!t.done);

    let body='📋 סיכום יום — Mini Genius — '+today+'\n\n';
    body+='=== מועמדים חדשים ('+todayCands.length+') ===\n';
    todayCands.forEach(c=>{body+=c.name+' | '+c.phone+' | '+(c.recruiter||'')+'\n';});
    body+='\n=== ראיונות טלפוניים היום ('+todayInterviews.length+') ===\n';
    todayInterviews.forEach(c=>{body+=c.name+' | ציון: '+(c.stage2_grade||'-')+' | '+(Utils.STATUSES[c.stage2_decision]||'')+'\n';});
    body+='\n=== פעולות שבוצעו ('+log.length+') ===\n';
    log.forEach(l=>{body+=Utils.formatDateTime(l.time)+' — '+l.type+'\n';});
    body+='\n=== משימות שנותרו ('+remaining.length+') ===\n';
    remaining.forEach(t=>{body+=t.text+'\n';});
    body+='\n---\nMini Genius HR Recruit';

    const subj='סיכום יום — Mini Genius — '+today;
    Utils.sendEmail(to,subj,body);
    Utils.toast('מייל סגירת יום נשלח','success');
  }
};
