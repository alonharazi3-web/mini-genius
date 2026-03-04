'use strict';
const Dashboard={
  async render(stageId){
    stageId=stageId||App.currentStage;var stage=Utils.getStage(stageId);
    var cands=await DB.getByStage(stageId,App.currentJob);
    var frozen=await DB.getFrozen(App.currentJob);
    var stageFrozen=frozen.filter(function(f){return f.frozenFromStage===stageId});
    var active=cands.filter(function(c){return c.status==='active'}).length;
    var pass=cands.filter(function(c){return c.status==='pass'}).length;
    var fail=cands.filter(function(c){return c.status==='fail'}).length;
    var hesit=cands.filter(function(c){return c.status==='hesitation'}).length;
    var stopped=cands.filter(function(c){return c.status==='stopped'}).length;
    var ad=parseInt(App.settings['alertDaysStage'+stageId])||5;
    var stale=cands.filter(function(c){return c.status==='active'&&Utils.workDaysSince(c.updatedAt)>=ad}).length;
    var grades=cands.map(function(c){return c['stage'+stageId+'_grade']}).filter(function(g){return g});
    var avg=grades.length?(grades.reduce(function(a,b){return a+parseInt(b)},0)/grades.length).toFixed(1):'-';

    var page=Utils.id('mainContent');
    var html='<div class="page active"><div style="display:flex;align-items:center;gap:10px;padding:14px;">'
    +'<button class="btn btn-outline btn-sm" onclick="App.navigate(\'stage\','+stageId+')">←</button>'
    +'<div style="font-size:1.15rem;font-weight:700;">📊 דשבורד — '+stage.name+'</div>'
    +'<button class="btn btn-outline btn-sm" style="margin-right:auto;" onclick="Dashboard.exportReport('+stageId+')">📤 ייצוא</button></div>';

    // Timeline - compact grid showing all stages
    html+='<div class="timeline">';
    for(var i=1;i<=7;i++){
      var st=Utils.getStage(i);
      var sc=await DB.getByStage(i,App.currentJob);
      var sActive=sc.filter(function(c){return c.status==='active'}).length;
      var sDelayed=sc.filter(function(c){return c.status==='active'&&Utils.workDaysSince(c.updatedAt)>=(parseInt(App.settings['alertDaysStage'+i])||5)}).length;
      html+='<div class="timeline-stage'+(i===stageId?' current':'')+'" onclick="App.navigate(\'stage\','+i+')">'
      +'<span class="stage-icon">'+st.icon+'</span>'
      +'<span class="count">'+sActive+'</span>'
      +'<span class="stage-nm">'+st.name+'</span>'
      +(sDelayed?'<span class="delayed">⚠'+sDelayed+'</span>':'')
      +'</div>';
    }
    html+='</div>';

    // KPIs
    html+='<div class="kpi-row">';
    html+=Dashboard._kpi(active,'פעילים','--accent',stageId,'active');
    html+=Dashboard._kpi(pass,'עברו','--success',stageId,'pass');
    html+=Dashboard._kpi(fail,'לא עברו','--danger',stageId,'fail');
    html+='</div><div class="kpi-row">';
    html+=Dashboard._kpi(hesit,'התלבטות','--warning',stageId,'hesitation');
    html+=Dashboard._kpi(stale,'בעיכוב','--danger',stageId,'stale');
    html+=Dashboard._kpi(avg,'ממוצע','--primary',stageId,'avg');
    html+='</div>';
    if(stageFrozen.length){
      html+=Dashboard._kpi(stageFrozen.length,'מוקפאים','--purple',stageId,'frozen');
    }
    html+='<div id="nameListArea"></div></div>';
    page.innerHTML=html;
  },

  _kpi(val,label,color,stageId,type){
    return '<div class="kpi" onclick="Dashboard.showNames('+stageId+',\''+type+'\')">'
    +'<div class="kpi-value" style="color:var('+color+')">'+val+'</div>'
    +'<div class="kpi-label">'+label+'</div></div>';
  },

  async showNames(stageId,type){
    var cands=await DB.getByStage(stageId,App.currentJob);
    var list=[];var ad=parseInt(App.settings['alertDaysStage'+stageId])||5;
    if(type==='active')list=cands.filter(function(c){return c.status==='active'});
    else if(type==='pass')list=cands.filter(function(c){return c.status==='pass'});
    else if(type==='fail')list=cands.filter(function(c){return c.status==='fail'});
    else if(type==='hesitation')list=cands.filter(function(c){return c.status==='hesitation'});
    else if(type==='stale')list=cands.filter(function(c){return c.status==='active'&&Utils.workDaysSince(c.updatedAt)>=ad});
    else if(type==='frozen'){list=await DB.getFrozen(App.currentJob);list=list.filter(function(f){return f.frozenFromStage===stageId});}
    var area=Utils.id('nameListArea');if(!area)return;
    if(!list.length){area.innerHTML='<div class="info-box">אין מועמדים</div>';return;}
    var html='<div class="name-list">';
    list.forEach(function(c){
      html+='<div class="name-list-item" onclick="App.navigate(\'candidate\',\''+c.id+'\')">'
      +Utils.escHtml(c.name)+' <span style="color:var(--text-light);font-size:.78rem;">'+Utils.escHtml(c.phone)+'</span></div>';
    });
    html+='</div>';area.innerHTML=html;
  },

  // Export via social sharing (like Improv)
  async exportReport(stageId){
    var stage=Utils.getStage(stageId);
    var cands=await DB.getByStage(stageId,App.currentJob);
    var html='<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><style>'
    +'body{font-family:Arial;direction:rtl;padding:20px;}table{width:100%;border-collapse:collapse;}'
    +'th,td{border:1px solid #ddd;padding:8px;text-align:right;font-size:14px;}'
    +'th{background:#1B2A4A;color:#fff;}h1{color:#1B2A4A;}</style></head><body>'
    +'<h1>Mini Genius - '+stage.name+'</h1>'
    +'<p>תאריך: '+Utils.formatDate(new Date().toISOString())+'</p>'
    +'<table><tr><th>שם</th><th>טלפון</th><th>סטטוס</th><th>ציון</th><th>עדכון</th></tr>';
    cands.forEach(function(c){
      html+='<tr><td>'+Utils.escHtml(c.name)+'</td><td>'+c.phone+'</td>'
      +'<td>'+Utils.STATUSES[c.status]+'</td>'
      +'<td>'+(c['stage'+stageId+'_grade']||'-')+'</td>'
      +'<td>'+Utils.formatDate(c.updatedAt)+'</td></tr>';
    });
    html+='</table></body></html>';
    var filename='report_'+stage.key+'_'+Utils.today()+'.html';
    Utils.writeToCacheAndShare(filename,html,'text/html','דוח '+stage.name);
  }
};
