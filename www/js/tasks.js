'use strict';
const Tasks={
  // v2.7: Stage icon map for task display
  STAGE_ICONS:{1:'📌',2:'📞',3:'📝',4:'🤝',5:'🏢',6:'⭐',7:'🏭',other:'❗'},

  async render(stageId){
    stageId=stageId||App.currentStage;var stage=Utils.getStage(stageId);
    var tasks=await Tasks.buildTaskList(stageId);

    var page=Utils.id('mainContent');
    var html='<div class="page active"><div style="display:flex;align-items:center;gap:10px;padding:14px;">'
    +'<button class="btn btn-outline btn-sm" onclick="App.navigate(\'stage\','+stageId+')">←</button>'
    +'<div style="flex:1;font-size:1.15rem;font-weight:700;">✅ משימות — '+stage.name+'</div>'
    +'<button class="btn btn-primary btn-sm" onclick="Tasks.addManual()">➕</button></div>';

    if(!tasks.length){
      html+='<div class="empty-state"><div class="icon">🎉</div>אין משימות</div>';
    }else{
      html+=Tasks._renderTaskItems(tasks,stageId);
    }
    html+='</div>';page.innerHTML=html;
  },

  // v2.8: Show ALL tasks from all stages inline
  async renderInline(stageId){
    var allTasks=await Tasks.getAllTasksSorted();
    if(!allTasks.length)return;
    var container=Utils.id('mainContent');
    if(!container||!container.querySelector('.page'))return;
    var html='<div style="padding:0 14px 20px;"><div class="section-title" style="margin:16px 0 0;">✅ משימות ('+allTasks.length+')'
    +'<button class="btn btn-primary btn-sm" style="float:left;margin-top:-4px;" onclick="Tasks.addManual()">➕</button></div>'
    +Tasks._renderTaskItems(allTasks,stageId)+'</div>';
    container.querySelector('.page').insertAdjacentHTML('beforeend',html);
  },

  // Build task list for a stage (system + manual)
  async buildTaskList(stageId){
    var cands=await DB.getByStage(stageId,App.currentJob);
    var ad=parseInt(App.settings['alertDaysStage'+stageId])||5;
    var today=Utils.today();var tasks=[];
    var stageIcon=Tasks.STAGE_ICONS[stageId]||'📌';

    cands.forEach(function(c){
      if(c.status==='stopped'||c.status==='frozen')return;
      var days=Utils.workDaysSince(c.updatedAt);
      if(c.status==='active'){
        if(stageId===1)tasks.push({icon:stageIcon,text:'התקשר ל'+c.name,id:c.id,urgent:days>=ad,system:true,stageId:1});
        if(stageId===2&&!c.stage2_callDone)tasks.push({icon:stageIcon,text:'שיחה טלפונית עם '+c.name,id:c.id,urgent:days>=ad,system:true,stageId:2});
        if(stageId===3&&!c.stage3_assigned)tasks.push({icon:stageIcon,text:'תאם מבחן ל'+c.name,id:c.id,urgent:false,system:true,stageId:3});
        if(stageId===3&&c.stage3_assigned&&!c.stage3_result)tasks.push({icon:stageIcon,text:'הזן תוצאה ל'+c.name,id:c.id,urgent:days>=ad,system:true,stageId:3});
        if(stageId>=4&&!c['stage'+stageId+'_date'])tasks.push({icon:stageIcon,text:'תאם '+Utils.getStageName(stageId)+' ל'+c.name,id:c.id,urgent:false,system:true,stageId:stageId});
        if(stageId>=4&&c['stage'+stageId+'_date']&&!c['stage'+stageId+'_grade'])tasks.push({icon:stageIcon,text:'הזן תוצאה ל'+c.name,id:c.id,urgent:days>=ad,system:true,stageId:stageId});
      }
      if(c.status==='pass'&&stageId<7)tasks.push({icon:stageIcon,text:'העבר את '+c.name+' לשלב הבא',id:c.id,urgent:false,system:true,stageId:stageId});
    });

    // Custom tasks — show tasks assigned to this stage + "other" tasks
    var custom=await DB.getTasksForDate(today);
    custom.forEach(function(t){
      var tStage=t.stageId||'other';
      if(String(tStage)===String(stageId)||tStage==='other'){
        var icon=Tasks.STAGE_ICONS[tStage]||'❗';
        var isOverdue=t.date<today&&!t.done;
        tasks.push({icon:icon,text:t.text,id:t.id,urgent:isOverdue,system:false,done:t.done,taskId:t.id,stageId:tStage});
      }
    });

    tasks.sort(function(a,b){return(b.urgent?1:0)-(a.urgent?1:0);});
    return tasks;
  },

  // Render task items HTML
  _renderTaskItems:function(tasks,stageId){
    var html='';
    tasks.forEach(function(t){
      var cls=t.urgent?'task-overdue':'';
      html+='<div class="task-item '+cls+'">';
      // v2.7 #6: Stage icon
      html+='<span style="font-size:1.1rem;flex-shrink:0;">'+t.icon+'</span>';
      if(t.system){
        html+='<div class="task-check" onclick="App.navigate(\'candidate\',\''+t.id+'\')">▶</div>';
      }else{
        html+='<div class="task-check '+(t.done?'done':'')+'" onclick="Tasks.toggleCustomTask(\''+t.taskId+'\')">'+(t.done?'✓':'○')+'</div>';
      }
      html+='<div class="task-text '+(t.done?'done':'')+'">'+Utils.escHtml(t.text)+'</div>';
      if(!t.system)html+='<button style="background:none;border:none;color:var(--danger);font-size:1.1rem;" onclick="Tasks.deleteTask(\''+t.taskId+'\')">×</button>';
      html+='</div>';
    });
    return html;
  },

  // v2.7 #7: Add task with station selector + #8: "other" category
  addManual(){
    var html='<div class="modal-title">➕ משימה חדשה</div>'
    +'<div class="form-group"><label class="form-label">תיאור</label>'
    +'<input class="form-input" id="newTaskText"></div>'
    +'<div class="form-group"><label class="form-label">תאריך</label>'
    +'<input class="form-input" id="newTaskDate" type="date" value="'+Utils.today()+'"></div>'
    +'<div class="form-group"><label class="form-label">שייך לתחנה</label>'
    +'<select class="form-select" id="newTaskStage">';
    Utils.STAGES.forEach(function(s){
      html+='<option value="'+s.id+'"'+(s.id===App.currentStage?' selected':'')+'>'+s.icon+' '+s.name+'</option>';
    });
    html+='<option value="other">❗ אחר</option>';
    html+='</select></div>'
    +'<button class="btn btn-primary" style="width:100%;margin-top:12px;" onclick="Tasks.saveManual()">שמור</button>';
    Stages.showModal(html);
  },
  async saveManual(){
    var text=Utils.id('newTaskText')?.value?.trim();var date=Utils.id('newTaskDate')?.value;
    var stageId=Utils.id('newTaskStage')?.value||'other';
    if(!text){Utils.toast('נא למלא תיאור','danger');return;}
    await DB.saveTask({text:text,date:date||Utils.today(),stageId:stageId,done:false});
    Stages.closeModal();
    // Refresh current view
    if(location.hash.startsWith('#tasks'))Tasks.render(App.currentStage);
    else App.renderStageList(App.currentStage);
  },
  async toggleCustomTask(taskId){
    var tasks=await DB.getAllTasks();var t=tasks.find(function(x){return x.id===taskId});
    if(!t)return;t.done=!t.done;await DB.saveTask(t);
    // Refresh
    if(location.hash.startsWith('#tasks'))Tasks.render(App.currentStage);
    else App.renderStageList(App.currentStage);
  },
  async deleteTask(taskId){
    await DB.delTask(taskId);
    if(location.hash.startsWith('#tasks'))Tasks.render(App.currentStage);
    else App.renderStageList(App.currentStage);
  },
  async carryOverTasks(){
    var today=Utils.today();var all=await DB.getAllTasks();
    all.forEach(async function(t){if(!t.done&&t.date<today){t.date=today;await DB.saveTask(t);}});
  },

  // v2.7 #9: Build all tasks for opening screen (across all stages)
  async getAllTasksSorted(){
    var today=Utils.today();var allTasks=[];
    for(var si=1;si<=7;si++){
      var tasks=await Tasks.buildTaskList(si);
      tasks.forEach(function(t){t._globalStage=si;});
      allTasks=allTasks.concat(tasks);
    }
    // Deduplicate (custom tasks show in multiple stages)
    var seen={};var unique=[];
    allTasks.forEach(function(t){
      var key=t.system?(t.id+'_'+t.stageId):(t.taskId||t.id);
      if(!seen[key]){seen[key]=true;unique.push(t);}
    });
    // Sort: urgent first, then system, then manual
    unique.sort(function(a,b){
      if(a.urgent!==b.urgent)return b.urgent?1:-1;
      if(a.system!==b.system)return a.system?-1:1;
      return 0;
    });
    return unique;
  }
};
