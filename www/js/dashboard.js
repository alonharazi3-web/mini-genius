'use strict';
const Dashboard={
  async render(stageId){
    stageId=stageId||App.currentStage;
    var frozen=await DB.getFrozen(App.currentJob);

    // v3.1: Aggregate ALL stages for KPIs
    var allActive=0,allPass=0,allFail=0,allHesit=0,allStopped=0,allStale=0;
    var allGrades=[];
    var earlyCount=0,advancedCount=0,allFrozenCount=frozen.length;
    Dashboard._stageData={};
    for(var si=1;si<=7;si++){
      var sc=await DB.getByStage(si,App.currentJob);
      var ad=parseInt(App.settings['alertDaysStage'+si])||5;
      var sAct=sc.filter(function(c){return c.status==='active'});
      var sPass=sc.filter(function(c){return c.status==='pass'});
      var sFail=sc.filter(function(c){return c.status==='fail'});
      var sHesit=sc.filter(function(c){return c.status==='hesitation'});
      var sStopped=sc.filter(function(c){return c.status==='stopped'});
      var sStale=sAct.filter(function(c){return Utils.workDaysSince(c.stageEnteredAt||c.updatedAt)>=ad});
      allActive+=sAct.length;allPass+=sPass.length;allFail+=sFail.length;
      allHesit+=sHesit.length;allStopped+=sStopped.length;allStale+=sStale.length;
      if(si<=4)earlyCount+=sAct.length;else advancedCount+=sAct.length;
      var grades=sc.map(function(c){return c['stage'+si+'_grade']}).filter(function(g){return g});
      allGrades=allGrades.concat(grades);
      Dashboard._stageData[si]={cands:sc,active:sAct.length,pass:sPass.length,fail:sFail.length,
        hesitation:sHesit.length,stopped:sStopped.length,stale:sStale.length};
    }
    var avg=allGrades.length?(allGrades.reduce(function(a,b){return a+parseInt(b)},0)/allGrades.length).toFixed(1):'-';

    var page=Utils.id('mainContent');
    var html='<div class="page active"><div style="display:flex;align-items:center;gap:10px;padding:14px;">'
    +'<button class="btn btn-outline btn-sm" onclick="App.navigate(\'stage\','+stageId+')">←</button>'
    +'<div style="font-size:1.15rem;font-weight:700;">📊 דשבורד — כל השלבים</div>'
    +'<button class="btn btn-outline btn-sm" style="margin-right:auto;" onclick="Dashboard.exportReport()">📤 ייצוא</button></div>';

    // Timeline
    html+='<div class="timeline">';
    for(var i=1;i<=7;i++){
      var st=Utils.getStage(i);var sd=Dashboard._stageData[i];
      html+='<div class="timeline-stage'+(i===stageId?' current':'')+'" onclick="App.navigate(\'stage\','+i+')">'
      +'<span class="stage-icon">'+st.icon+'</span>'
      +'<span class="count">'+sd.active+'</span>'
      +'<span class="stage-nm">'+st.name+'</span>'
      +(sd.stale?'<span class="delayed">⚠'+sd.stale+'</span>':'')
      +'</div>';
    }
    html+='</div>';

    // Global totals
    html+='<div class="kpi-row">'
    +Dashboard._kpi(earlyCount,'שלבים ראשוניים','--primary','all','early')
    +Dashboard._kpi(advancedCount,'שלבים מתקדמים','--accent','all','advanced')
    +Dashboard._kpi(allFrozenCount,'מוקפאים','--purple','all','allFrozen')
    +'</div>';

    // All-stages KPIs
    html+='<div class="kpi-row">';
    html+=Dashboard._kpi(allActive,'פעילים','--accent','all','active');
    html+=Dashboard._kpi(allPass,'עברו','--success','all','pass');
    html+=Dashboard._kpi(allFail,'לא עברו','--danger','all','fail');
    html+='</div><div class="kpi-row">';
    html+=Dashboard._kpi(allHesit,'התלבטות','--warning','all','hesitation');
    html+=Dashboard._kpi(allStale,'בעיכוב','--danger','all','stale');
    html+=Dashboard._kpi(avg,'ממוצע','--primary','all','avg');
    html+='</div>';
    html+='<div id="nameListArea"></div></div>';
    page.innerHTML=html;
  },

  _kpi(val,label,color,stageId,type){
    var sid=typeof stageId==='string'?"'"+stageId+"'":stageId;
    return '<div class="kpi" onclick="Dashboard.showNames('+sid+',\''+type+'\')">'
    +'<div class="kpi-value" style="color:var('+color+')">'+val+'</div>'
    +'<div class="kpi-label">'+label+'</div></div>';
  },

  async showNames(stageId,type){
    var list=[];
    // v3.1: Aggregate ALL stages
    if(type==='early'){
      for(var si=1;si<=4;si++){var sc=await DB.getByStage(si,App.currentJob);list=list.concat(sc.filter(function(c){return c.status==='active'}));}
    }else if(type==='advanced'){
      for(var si=5;si<=7;si++){var sc=await DB.getByStage(si,App.currentJob);list=list.concat(sc.filter(function(c){return c.status==='active'}));}
    }else if(type==='allFrozen'){
      list=await DB.getFrozen(App.currentJob);
    }else{
      // Aggregate from all stages
      for(var si=1;si<=7;si++){
        var sc=await DB.getByStage(si,App.currentJob);
        var ad=parseInt(App.settings['alertDaysStage'+si])||5;
        if(type==='active')list=list.concat(sc.filter(function(c){return c.status==='active'}));
        else if(type==='pass')list=list.concat(sc.filter(function(c){return c.status==='pass'}));
        else if(type==='fail')list=list.concat(sc.filter(function(c){return c.status==='fail'}));
        else if(type==='hesitation')list=list.concat(sc.filter(function(c){return c.status==='hesitation'}));
        else if(type==='stale')list=list.concat(sc.filter(function(c){return c.status==='active'&&Utils.workDaysSince(c.stageEnteredAt||c.updatedAt)>=ad}));
      }
    }
    var area=Utils.id('nameListArea');if(!area)return;
    if(!list.length){area.innerHTML='<div class="info-box">אין מועמדים</div>';return;}
    var html='<div class="name-list">';
    list.forEach(function(c){
      html+='<div class="name-list-item" onclick="App.navigate(\'candidate\',\''+c.id+'\')">'
      +Utils.escHtml(c.name)+' <span style="color:var(--text-light);font-size:.78rem;">'+Utils.escHtml(c.phone)
      +' | '+Utils.getStageName(c.stage)+'</span>';
      // v3.1 #1: Show stop/message info for failed/stopped candidates
      if(c.status==='fail'||c.status==='stopped'){
        var stopped=c.stoppedAt?'⛔ הופסק '+Utils.formatDate(c.stoppedAt):'';
        var reason=c.stopReason?' ('+Utils.escHtml(c.stopReason.substring(0,30))+')':'';
        if(stopped)html+='<div style="font-size:.72rem;color:var(--danger);">'+stopped+reason+'</div>';
        else html+='<div style="font-size:.72rem;color:var(--warning);">⚠️ לא בוצעה הפסקת תהליך</div>';
      }
      html+='</div>';
    });
    html+='</div>';area.innerHTML=html;
  },

  // FIX #14 v2.5: Interactive HTML export with clickable KPIs
  async exportReport(){
    var allData={};var frozen=await DB.getFrozen(App.currentJob);
    var earlyCount=0,advancedCount=0;
    var totActive=[],totPass=[],totFail=[],totHesit=[],totStale=[];
    var allGrades=[];
    for(var i=1;i<=7;i++){
      var sc=await DB.getByStage(i,App.currentJob);
      var ad=parseInt(App.settings['alertDaysStage'+i])||5;
      allData[i]={cands:sc,stage:Utils.getStage(i),
        active:sc.filter(function(c){return c.status==='active'}),
        pass:sc.filter(function(c){return c.status==='pass'}),
        fail:sc.filter(function(c){return c.status==='fail'}),
        hesit:sc.filter(function(c){return c.status==='hesitation'}),
        stale:sc.filter(function(c){return c.status==='active'&&Utils.workDaysSince(c.stageEnteredAt||c.updatedAt)>=ad})
      };
      if(i<=4)earlyCount+=allData[i].active.length;
      else advancedCount+=allData[i].active.length;
      totActive=totActive.concat(allData[i].active);
      totPass=totPass.concat(allData[i].pass);
      totFail=totFail.concat(allData[i].fail);
      totHesit=totHesit.concat(allData[i].hesit);
      totStale=totStale.concat(allData[i].stale);
      var grades=sc.map(function(c){return c['stage'+i+'_grade']}).filter(function(g){return g});
      allGrades=allGrades.concat(grades);
    }
    var avg=allGrades.length?(allGrades.reduce(function(a,b){return a+parseInt(b)},0)/allGrades.length).toFixed(1):'-';

    var html='<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    +'<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;direction:rtl;background:#EEF2F7;padding:16px;max-width:600px;margin:0 auto}'
    +'h1{color:#1B2A4A;font-size:1.3rem;margin-bottom:8px}p{color:#7F8C8D;font-size:.85rem;margin-bottom:16px}'
    +'.timeline{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;background:#fff;padding:12px 8px;border-radius:12px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,.06)}'
    +'.ts{text-align:center;padding:6px 2px;border-radius:8px;font-size:.65rem}.ts .n{font-size:1.1rem;font-weight:800;color:#1B2A4A;display:block}'
    +'.kpi-row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}'
    +'.kpi{background:#fff;border-radius:12px;padding:14px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.06);cursor:pointer}'
    +'.kpi .v{font-size:1.8rem;font-weight:800}.kpi .l{font-size:.75rem;color:#7F8C8D;margin-top:4px}'
    +'.list{background:#fff;border-radius:12px;padding:12px;margin-top:12px;box-shadow:0 2px 8px rgba(0,0,0,.06);display:none;max-height:300px;overflow-y:auto}'
    +'.list.show{display:block}.li{padding:8px 0;border-bottom:1px solid #eee;font-size:.9rem}.li:last-child{border:none}'
    +'.li .ph{color:#7F8C8D;font-size:.78rem}</style></head><body>'
    +'<h1>📊 Mini Genius — כל השלבים</h1>'
    +'<p>'+Utils.formatDate(new Date().toISOString())+'</p>';

    html+='<div class="timeline">';
    for(var i=1;i<=7;i++){
      var st=Utils.getStage(i);
      html+='<div class="ts">'+st.icon+'<span class="n">'+allData[i].active.length+'</span>'+st.name+'</div>';
    }
    html+='</div>';

    html+='<div class="kpi-row">'
    +'<div class="kpi" onclick="toggle(\'early\')"><div class="v" style="color:#1B2A4A">'+earlyCount+'</div><div class="l">שלבים ראשוניים</div></div>'
    +'<div class="kpi" onclick="toggle(\'advanced\')"><div class="v" style="color:#4A90D9">'+advancedCount+'</div><div class="l">שלבים מתקדמים</div></div>'
    +'<div class="kpi" onclick="toggle(\'frozen\')"><div class="v" style="color:#9B59B6">'+frozen.length+'</div><div class="l">מוקפאים</div></div>'
    +'</div>';

    html+='<div class="kpi-row">'
    +'<div class="kpi" onclick="toggle(\'active\')"><div class="v" style="color:#4A90D9">'+totActive.length+'</div><div class="l">פעילים</div></div>'
    +'<div class="kpi" onclick="toggle(\'pass\')"><div class="v" style="color:#2ECC71">'+totPass.length+'</div><div class="l">עברו</div></div>'
    +'<div class="kpi" onclick="toggle(\'fail\')"><div class="v" style="color:#E74C3C">'+totFail.length+'</div><div class="l">לא עברו</div></div>'
    +'</div><div class="kpi-row">'
    +'<div class="kpi" onclick="toggle(\'hesit\')"><div class="v" style="color:#F1C40F">'+totHesit.length+'</div><div class="l">התלבטות</div></div>'
    +'<div class="kpi" onclick="toggle(\'stale\')"><div class="v" style="color:#E74C3C">'+totStale.length+'</div><div class="l">בעיכוב</div></div>'
    +'<div class="kpi"><div class="v" style="color:#1B2A4A">'+avg+'</div><div class="l">ממוצע</div></div>'
    +'</div>';

    function nameList(id,arr){
      var h='<div class="list" id="'+id+'">';
      arr.forEach(function(c){h+='<div class="li">'+Utils.escHtml(c.name)+' <span class="ph">'+Utils.escHtml(c.phone)+' | '+Utils.getStageName(c.stage)+'</span></div>';});
      if(!arr.length)h+='<div class="li" style="color:#7F8C8D;">אין מועמדים</div>';
      return h+'</div>';
    }
    html+=nameList('active',totActive);
    html+=nameList('pass',totPass);
    html+=nameList('fail',totFail);
    html+=nameList('hesit',totHesit);
    html+=nameList('stale',totStale);
    html+=nameList('frozen',frozen);
    var earlyList=[],advList=[];
    for(var i=1;i<=4;i++)earlyList=earlyList.concat(allData[i].active);
    for(var i=5;i<=7;i++)advList=advList.concat(allData[i].active);
    html+=nameList('early',earlyList);
    html+=nameList('advanced',advList);

    html+='<script>function toggle(id){var els=document.querySelectorAll(".list");els.forEach(function(e){if(e.id===id)e.classList.toggle("show");else e.classList.remove("show");});}<\/script>';
    html+='</body></html>';

    Utils.writeToCacheAndShare('dashboard_all_'+Utils.today()+'.html',html,'text/html','דשבורד כל השלבים');
  }
};
