'use strict';
const Dashboard={
  async render(stageId){
    stageId=stageId||App.currentStage;const stage=Utils.getStage(stageId);
    const cands=await DB.getByStage(stageId,App.currentJob);
    const frozen=await DB.getFrozen(App.currentJob);
    const stageFrozen=frozen.filter(f=>f.frozenFromStage===stageId);
    const active=cands.filter(c=>c.status==='active').length;
    const pass=cands.filter(c=>c.status==='pass').length;
    const fail=cands.filter(c=>c.status==='fail').length;
    const hesit=cands.filter(c=>c.status==='hesitation').length;
    const stopped=cands.filter(c=>c.status==='stopped').length;
    const ad=parseInt(App.settings['alertDaysStage'+stageId])||5;
    const stale=cands.filter(c=>c.status==='active'&&Utils.workDaysSince(c.updatedAt)>=ad).length;
    const grades=cands.map(c=>c['stage'+stageId+'_grade']).filter(g=>g);
    const avg=grades.length?(grades.reduce((a,b)=>a+parseInt(b),0)/grades.length).toFixed(1):'-';

    const page=Utils.id('mainContent');
    let html='<div class="page active"><div style="display:flex;align-items:center;gap:10px;padding:12px;">'
    +'<button class="btn btn-outline btn-sm" onclick="App.navigate(\'stage\','+stageId+')">←</button>'
    +'<div style="font-size:1.1rem;font-weight:700;">📊 דשבורד — '+stage.name+'</div>'
    +'<button class="btn btn-outline btn-sm" style="margin-right:auto;" onclick="Dashboard.exportHtml('+stageId+')">📤 ייצוא</button></div>';

    // KPIs — clickable
    html+='<div class="kpi-row">';
    html+=Dashboard._kpi(active,'פעילים','--accent',stageId,'active');
    html+=Dashboard._kpi(pass,'עברו','--success',stageId,'pass');
    html+=Dashboard._kpi(fail,'לא עברו','--danger',stageId,'fail');
    html+='</div><div class="kpi-row">';
    html+=Dashboard._kpi(hesit,'התלבטות','--warning',stageId,'hesitation');
    html+=Dashboard._kpi(stageFrozen.length,'הקפאה','--purple',stageId,'frozen');
    html+=Dashboard._kpi(stale,'⚠️ תקועים',stale?'--danger':'--text-light',stageId,'stale');
    html+='</div>';
    if(stageId>=2)html+='<div class="kpi-row"><div class="kpi" style="grid-column:span 3;"><div class="kpi-value">'+avg+'</div><div class="kpi-label">ממוצע ציון</div></div></div>';

    // Timeline
    html+='<div class="section-title">ציר זמן</div><div class="timeline">';
    for(const s of Utils.STAGES){
      const sc=await DB.getByStage(s.id,App.currentJob);
      const sa=sc.filter(c=>c.status==='active'||c.status==='hesitation').length;
      const sad=parseInt(App.settings['alertDaysStage'+s.id])||5;
      const delayed=sc.filter(c=>c.status==='active'&&Utils.workDaysSince(c.updatedAt)>=sad).length;
      html+='<div class="timeline-stage'+(s.id===stageId?' style="border:2px solid var(--accent);"':'')+'"><span class="count">'+sa+'</span>'+s.icon+' '+s.name
      +(delayed?'<div class="delayed">'+delayed+' בעיכוב</div>':'')+'</div>';
      if(s.id<7)html+='<span class="timeline-arrow">→</span>';
    }
    html+='</div>';

    // Name list container
    html+='<div id="nameListContainer"></div>';

    // Recruiter breakdown
    const recs=JSON.parse(App.settings.recruiters||'[]');
    if(recs.length>1){html+='<div class="section-title">חלוקה לפי רכז</div>';
      recs.forEach(r=>{const rc=cands.filter(c=>c.recruiter===r);const ra=rc.filter(c=>c.status==='active').length;
        html+='<div class="card" style="padding:10px;"><strong>'+r+'</strong>: '+ra+' פעילים ('+rc.length+' סה"כ)</div>';});}

    html+='</div>';page.innerHTML=html;
  },

  _kpi(val,label,color,stageId,type){
    return '<div class="kpi" onclick="Dashboard.showNameList('+stageId+',\''+type+'\')">'
    +'<div class="kpi-value" style="color:var('+color+')">'+val+'</div><div class="kpi-label">'+label+'</div></div>';
  },

  async showNameList(stageId,type){
    const cands=await DB.getByStage(stageId,App.currentJob);
    const frozen=await DB.getFrozen(App.currentJob);
    let list=[];
    if(type==='active')list=cands.filter(c=>c.status==='active');
    else if(type==='pass')list=cands.filter(c=>c.status==='pass');
    else if(type==='fail')list=cands.filter(c=>c.status==='fail');
    else if(type==='hesitation')list=cands.filter(c=>c.status==='hesitation');
    else if(type==='frozen')list=frozen.filter(f=>f.frozenFromStage===stageId);
    else if(type==='stale'){const ad=parseInt(App.settings['alertDaysStage'+stageId])||5;
      list=cands.filter(c=>c.status==='active'&&Utils.workDaysSince(c.updatedAt)>=ad);}
    const container=Utils.id('nameListContainer');
    if(!list.length){container.innerHTML='';return;}
    container.innerHTML='<div class="name-list">'+list.map(c=>
      '<div class="name-list-item" onclick="App.navigate(\'candidate\',\''+c.id+'\')">'+Utils.escHtml(c.name)+' — '+(c.phone||'')+'</div>'
    ).join('')+'</div>';
  },

  async exportHtml(stageId){
    const stage=Utils.getStage(stageId);const cands=await DB.getByStage(stageId,App.currentJob);
    let html='<html dir="rtl"><head><meta charset="utf-8"><style>body{font-family:Arial;direction:rtl}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px;text-align:right}th{background:#2E4057;color:#fff}.pass{color:green}.fail{color:red}</style></head><body>';
    html+='<h2>📊 '+stage.name+' — Mini Genius</h2><p>'+Utils.formatDate(new Date().toISOString())+'</p>';
    html+='<table><tr><th>שם</th><th>טלפון</th><th>סטטוס</th><th>ציון</th><th>רכז</th></tr>';
    cands.forEach(c=>{
      html+='<tr><td>'+Utils.escHtml(c.name)+'</td><td>'+Utils.escHtml(c.phone||'')+'</td>'
      +'<td class="'+(c.status==='pass'?'pass':c.status==='fail'?'fail':'')+'">'+(Utils.STATUSES[c.status]||'')+'</td>'
      +'<td>'+(c['stage'+stageId+'_grade']||'')+'</td><td>'+Utils.escHtml(c.recruiter||'')+'</td></tr>';
    });
    html+='</table></body></html>';
    Utils.shareHtml(html,'סטטוס_'+stage.name);
  }
};
