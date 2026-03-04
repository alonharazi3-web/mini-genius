'use strict';
const Tasks={
  async render(stageId){
    stageId=stageId||App.currentStage;var stage=Utils.getStage(stageId);
    var cands=await DB.getByStage(stageId,App.currentJob);
    var ad=parseInt(App.settings['alertDaysStage'+stageId])||5;
    var today=Utils.today();var tasks=[];

    cands.forEach(function(c){
      if(c.status==='stopped'||c.status==='frozen')return;
      var days=Utils.workDaysSince(c.updatedAt);
      if(c.status==='active'){
        if(stageId===1)tasks.push({type:'call',text:'התקשר ל'+c.name,id:c.id,urgent:days>=ad,system:true});
        if(stageId===2&&!c.stage2_callDone)tasks.push({type:'call',text:'שיחה טלפונית עם '+c.name,id:c.id,urgent:days>=ad,system:true});
        if(stageId===3&&!c.stage3_assigned)tasks.push({type:'coord',text:'תאם מבחן ל'+c.name,id:c.id,urgent:false,system:true});
        if(stageId===3&&c.stage3_assigned&&!c.stage3_result)tasks.push({type:'result',text:'הזן תוצאה ל'+c.name,id:c.id,urgent:days>=ad,system:true});
        if(stageId>=4&&!c['stage'+stageId+'_date'])tasks.push({type:'coord',text:'תאם '+stage.name+' ל'+c.name,id:c.id,urgent:false,system:true});
        if(stageId>=4&&c['stage'+stageId+'_date']&&!c['stage'+stageId+'_grade'])tasks.push({type:'result',text:'הזן תוצאה ל'+c.name,id:c.id,urgent:days>=ad,system:true});
      }
      if(c.status==='pass'&&stageId<7)tasks.push({type:'advance',text:'העבר את '+c.name+' לשלב הבא',id:c.id,urgent:false,system:true});
    });

    var custom=await DB.getTasksForDate(today);
    var stageCustom=custom.filter(function(t){return !t.stageId||t.stageId==stageId});
    stageCustom.forEach(function(t){
      var isOverdue=t.date<today&&!t.done;
      tasks.push({type:'custom',text:t.text,id:t.id,urgent:isOverdue,system:false,done:t.done,taskId:t.id});
    });

    tasks.sort(function(a,b){return(b.urgent?1:0)-(a.urgent?1:0)});

    var page=Utils.id('mainContent');
    var html='<div class="page active"><div style="display:flex;align-items:center;gap:10px;padding:14px;">'
    +'<button class="btn btn-outline btn-sm" onclick="App.navigate(\'stage\','+stageId+')">←</button>'
    +'<div style="flex:1;font-size:1.15rem;font-weight:700;">✅ משימות — '+stage.name+'</div>'
    +'<button class="btn btn-primary btn-sm" onclick="Tasks.addManual('+stageId+')">➕</button></div>';

    if(!tasks.length){
      html+='<div class="empty-state"><div class="icon">🎉</div>אין משימות</div>';
    }else{
      tasks.forEach(function(t){
        var cls=t.urgent?'task-overdue':'';
        html+='<div class="task-item '+cls+'">';
        if(t.system){
          html+='<div class="task-check" onclick="App.navigate(\'candidate\',\''+t.id+'\')">▶</div>';
        }else{
          html+='<div class="task-check '+(t.done?'done':'')+'" onclick="Tasks.toggleCustomTask(\''+t.taskId+'\','+stageId+')">'+(t.done?'✓':'○')+'</div>';
        }
        html+='<div class="task-text '+(t.done?'done':'')+'">'+Utils.escHtml(t.text)+'</div>';
        if(!t.system)html+='<button style="background:none;border:none;color:var(--danger);font-size:1.1rem;" onclick="Tasks.deleteTask(\''+t.taskId+'\','+stageId+')">×</button>';
        html+='</div>';
      });
    }
    html+='</div>';page.innerHTML=html;
  },

  addManual(stageId){
    var html='<div class="modal-title">➕ משימה חדשה</div>'
    +'<div class="form-group"><label class="form-label">תיאור</label>'
    +'<input class="form-input" id="newTaskText"></div>'
    +'<div class="form-group"><label class="form-label">תאריך</label>'
    +'<input class="form-input" id="newTaskDate" type="date" value="'+Utils.today()+'"></div>'
    +'<button class="btn btn-primary" style="width:100%;margin-top:12px;" onclick="Tasks.saveManual('+stageId+')">שמור</button>';
    Stages.showModal(html);
  },
  async saveManual(stageId){
    var text=Utils.id('newTaskText')?.value?.trim();var date=Utils.id('newTaskDate')?.value;
    if(!text){Utils.toast('נא למלא תיאור','danger');return;}
    await DB.saveTask({text:text,date:date||Utils.today(),stageId:stageId,done:false});
    Stages.closeModal();Tasks.render(stageId);
  },
  async toggleCustomTask(taskId,stageId){
    var tasks=await DB.getAllTasks();var t=tasks.find(function(x){return x.id===taskId});
    if(!t)return;t.done=!t.done;await DB.saveTask(t);Tasks.render(stageId);
  },
  async deleteTask(taskId,stageId){
    await DB.delTask(taskId);Tasks.render(stageId);
  },
  async carryOverTasks(){
    var today=Utils.today();var all=await DB.getAllTasks();
    all.forEach(async function(t){if(!t.done&&t.date<today){t.date=today;await DB.saveTask(t);}});
  }
};
