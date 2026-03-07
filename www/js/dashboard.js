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

    // FIX #12 v2.5: Calculate early (1-4) / advanced (5-7) totals
    var earlyCount=0,advancedCount=0,allFrozenCount=frozen.length;
    Dashboard._stageData={}; // cache for export
    for(var si=1;si<=7;si++){
      var sc=await DB.getByStage(si,App.currentJob);
      var sAct=sc.filter(function(c){return c.status==='active'}).length;
      if(si<=4)earlyCount+=sAct; else advancedCount+=sAct;
      Dashboard._stageData[si]={cands:sc,active:sAct};
    }

    var page=Utils.id('mainContent');
    var html='<div class="page active"><div style="display:flex;align-items:center;gap:10px;padding:14px;">'
    +'<button class="btn btn-outline btn-sm" onclick="App.navigate(\'stage\','+stageId+')">←</button>'
    +'<div style="font-size:1.15rem;font-weight:700;">📊 דשבורד — '+stage.name+'</div>'
    +'<button class="btn btn-outline btn-sm" style="margin-right:auto;" onclick="Dashboard.exportReport('+stageId+')">📤 ייצוא</button></div>';

    // Timeline
    html+='<div class="timeline">';
    for(var i=1;i<=7;i++){
      var st=Utils.getStage(i);
      var sd=Dashboard._stageData[i];
      var sDelayed=sd.cands.filter(function(c){return c.status==='active'&&Utils.workDaysSince(c.updatedAt)>=(parseInt(App.settings['alertDaysStage'+i])||5)}).length;
      html+='<div class="timeline-stage'+(i===stageId?' current':'')+'" onclick="App.navigate(\'stage\','+i+')">'
      +'<span class="stage-icon">'+st.icon+'</span>'
      +'<span class="count">'+sd.active+'</span>'
      +'<span class="stage-nm">'+st.name+'</span>'
      +(sDelayed?'<span class="delayed">⚠'+sDelayed+'</span>':'')
      +'</div>';
    }
    html+='</div>';

    // FIX #12 v2.5: Early / Advanced / Frozen totals
    html+='<div class="kpi-row">'
    +Dashboard._kpi(earlyCount,'שלבים ראשוניים','--primary',stageId,'early')
    +Dashboard._kpi(advancedCount,'שלבים מתקדמים','--accent',stageId,'advanced')
    +Dashboard._kpi(allFrozenCount,'מוקפאים','--purple',stageId,'allFrozen')
    +'</div>';

    // Stage KPIs
    html+='<div class="kpi-row">';
    html+=Dashboard._kpi(active,'פעילים','--accent',stageId,'active');
    html+=Dashboard._kpi(pass,'עברו','--success',stageId,'pass');
    html+=Dashboard._kpi(fail,'לא עברו','--danger',stageId,'fail');
    html+='</div><div class="kpi-row">';
    html+=Dashboard._kpi(hesit,'התלבטות','--warning',stageId,'hesitation');
    html+=Dashboard._kpi(stale,'בעיכוב','--danger',stageId,'stale');
    html+=Dashboard._kpi(avg,'ממוצע','--primary',stageId,'avg');
    html+='</div>';
    // FIX #13 v2.5: Stage frozen always shown
    if(stageFrozen.length){
      html+='<div class="kpi-row">'+Dashboard._kpi(stageFrozen.length,'מוקפאים בשלב','--purple',stageId,'frozen')+'</div>';
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
    else if(type==='allFrozen'){list=await DB.getFrozen(App.currentJob);}
    // FIX #12: early/advanced
    else if(type==='early'){
      list=[];
      for(var si=1;si<=4;si++){var sc=await DB.getByStage(si,App.currentJob);list=list.concat(sc.filter(function(c){return c.status==='active'}));}
    }
    else if(type==='advanced'){
      list=[];
      for(var si=5;si<=7;si++){var sc=await DB.getByStage(si,App.currentJob);list=list.concat(sc.filter(function(c){return c.status==='active'}));}
    }
    var area=Utils.id('nameListArea');if(!area)return;
    if(!list.length){area.innerHTML='<div class="info-box">אין מועמדים</div>';return;}
    var html='<div class="name-list">';
    list.forEach(function(c){
      html+='<div class="name-list-item" onclick="App.navigate(\'candidate\',\''+c.id+'\')">'
      +Utils.escHtml(c.name)+' <span style="color:var(--text-light);font-size:.78rem;">'+Utils.escHtml(c.phone)
      +' | '+Utils.getStageName(c.stage)+'</span></div>';
    });
    html+='</div>';area.innerHTML=html;
  },

  // FIX #14 v2.5: Interactive HTML export with clickable KPIs
  async exportReport(stageId){
    var stage=Utils.getStage(stageId);
    var allData={};var frozen=await DB.getFrozen(App.currentJob);
    var earlyCount=0,advancedCount=0;
    for(var i=1;i<=7;i++){
      var sc=await DB.getByStage(i,App.currentJob);
      var ad=parseInt(App.settings['alertDaysStage'+i])||5;
      allData[i]={cands:sc,stage:Utils.getStage(i),
        active:sc.filter(function(c){return c.status==='active'}),
        pass:sc.filter(function(c){return c.status==='pass'}),
        fail:sc.filter(function(c){return c.status==='fail'}),
        hesit:sc.filter(function(c){return c.status==='hesitation'}),
        stale:sc.filter(function(c){return c.status==='active'&&Utils.workDaysSince(c.updatedAt)>=ad})
      };
      if(i<=4)earlyCount+=allData[i].active.length;
      else advancedCount+=allData[i].active.length;
    }
    var d=allData[stageId];
    var grades=d.cands.map(function(c){return c['stage'+stageId+'_grade']}).filter(function(g){return g});
    var avg=grades.length?(grades.reduce(function(a,b){return a+parseInt(b)},0)/grades.length).toFixed(1):'-';

    // Build interactive HTML
    var html='<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    +'<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;direction:rtl;background:#EEF2F7;padding:16px;max-width:600px;margin:0 auto}'
    +'h1{color:#1B2A4A;font-size:1.3rem;margin-bottom:8px}p{color:#7F8C8D;font-size:.85rem;margin-bottom:16px}'
    +'.timeline{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;background:#fff;padding:12px 8px;border-radius:12px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,.06)}'
    +'.ts{text-align:center;padding:6px 2px;border-radius:8px;font-size:.65rem;cursor:pointer}.ts.cur{background:#EBF5FB;border:2px solid #4A90D9}'
    +'.ts .n{font-size:1.1rem;font-weight:800;color:#1B2A4A;display:block}'
    +'.kpi-row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}'
    +'.kpi{background:#fff;border-radius:12px;padding:14px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.06);cursor:pointer}'
    +'.kpi:active{transform:scale(.96)}.kpi .v{font-size:1.8rem;font-weight:800}.kpi .l{font-size:.75rem;color:#7F8C8D;margin-top:4px}'
    +'.list{background:#fff;border-radius:12px;padding:12px;margin-top:12px;box-shadow:0 2px 8px rgba(0,0,0,.06);display:none;max-height:300px;overflow-y:auto}'
    +'.list.show{display:block}.li{padding:8px 0;border-bottom:1px solid #eee;font-size:.9rem}.li:last-child{border:none}'
    +'.li .ph{color:#7F8C8D;font-size:.78rem}</style></head><body>'
    +'<h1>📊 Mini Genius — '+Utils.escHtml(stage.name)+'</h1>'
    +'<p>'+Utils.formatDate(new Date().toISOString())+'</p>';

    // Timeline
    html+='<div class="timeline">';
    for(var i=1;i<=7;i++){
      var st=Utils.getStage(i);
      html+='<div class="ts'+(i===stageId?' cur':'')+'">'+st.icon+'<span class="n">'+allData[i].active.length+'</span>'+st.name+'</div>';
    }
    html+='</div>';

    // Global KPIs
    html+='<div class="kpi-row">'
    +'<div class="kpi" onclick="toggle(\'early\')"><div class="v" style="color:#1B2A4A">'+earlyCount+'</div><div class="l">שלבים ראשוניים</div></div>'
    +'<div class="kpi" onclick="toggle(\'advanced\')"><div class="v" style="color:#4A90D9">'+advancedCount+'</div><div class="l">שלבים מתקדמים</div></div>'
    +'<div class="kpi" onclick="toggle(\'frozen\')"><div class="v" style="color:#9B59B6">'+frozen.length+'</div><div class="l">מוקפאים</div></div>'
    +'</div>';

    // Stage KPIs
    html+='<div class="kpi-row">'
    +'<div class="kpi" onclick="toggle(\'active\')"><div class="v" style="color:#4A90D9">'+d.active.length+'</div><div class="l">פעילים</div></div>'
    +'<div class="kpi" onclick="toggle(\'pass\')"><div class="v" style="color:#2ECC71">'+d.pass.length+'</div><div class="l">עברו</div></div>'
    +'<div class="kpi" onclick="toggle(\'fail\')"><div class="v" style="color:#E74C3C">'+d.fail.length+'</div><div class="l">לא עברו</div></div>'
    +'</div><div class="kpi-row">'
    +'<div class="kpi" onclick="toggle(\'hesit\')"><div class="v" style="color:#F1C40F">'+d.hesit.length+'</div><div class="l">התלבטות</div></div>'
    +'<div class="kpi" onclick="toggle(\'stale\')"><div class="v" style="color:#E74C3C">'+d.stale.length+'</div><div class="l">בעיכוב</div></div>'
    +'<div class="kpi"><div class="v" style="color:#1B2A4A">'+avg+'</div><div class="l">ממוצע</div></div>'
    +'</div>';

    // Hidden name lists
    function nameList(id,arr){
      var h='<div class="list" id="'+id+'">';
      arr.forEach(function(c){h+='<div class="li">'+Utils.escHtml(c.name)+' <span class="ph">'+Utils.escHtml(c.phone)+'</span></div>';});
      if(!arr.length)h+='<div class="li" style="color:#7F8C8D;">אין מועמדים</div>';
      return h+'</div>';
    }
    html+=nameList('active',d.active);
    html+=nameList('pass',d.pass);
    html+=nameList('fail',d.fail);
    html+=nameList('hesit',d.hesit);
    html+=nameList('stale',d.stale);
    html+=nameList('frozen',frozen);
    // Early/advanced lists
    var earlyList=[],advList=[];
    for(var i=1;i<=4;i++)earlyList=earlyList.concat(allData[i].active);
    for(var i=5;i<=7;i++)advList=advList.concat(allData[i].active);
    html+=nameList('early',earlyList);
    html+=nameList('advanced',advList);

    html+='<script>function toggle(id){var els=document.querySelectorAll(".list");els.forEach(function(e){if(e.id===id)e.classList.toggle("show");else e.classList.remove("show");});}<\/script>';
    html+='</body></html>';

    var filename='dashboard_'+stage.key+'_'+Utils.today()+'.html';
    Utils.writeToCacheAndShare(filename,html,'text/html','דשבורד '+stage.name);
  }
};
