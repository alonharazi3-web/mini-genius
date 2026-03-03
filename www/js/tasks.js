'use strict';
const Tasks={
  async render(stageId){
    stageId=stageId||App.currentStage;const stage=Utils.getStage(stageId);
    const cands=await DB.getByStage(stageId,App.currentJob);
    const ad=parseInt(App.settings['alertDaysStage'+stageId])||5;
    const today=Utils.today();
    let tasks=[];

    // System tasks
    cands.forEach(c=>{
      if(c.status==='stopped'||c.status==='frozen')return;
      const days=Utils.workDaysSince(c.updatedAt);
      if(c.status==='active'){
        if(stageId===1)tasks.push({type:'call',text:'התקשר ל'+c.name,id:c.id,urgent:days>=ad,system:true});
        if(stageId===2&&!c.stage2_callDone)tasks.push({type:'call',text:'שיחה טלפונית עם '+c.name,id:c.id,urgent:days>=ad,system:true});
        if(stageId===3&&!c.stage3_assigned)tasks.push({type:'coord',text:'תאם מבחן ל'+c.name,id:c.id,urgent:false,system:true});
        if(stageId===3&&c.stage3_assigned&&!c.stage3_result)tasks.push({type:'result',text:'הזן תוצאת מבחן ל'+c.name,id:c.id,urgent:days>=ad,system:true});
        if(stageId>=4&&!c['stage'+stageId+'_date'])tasks.push({type:'coord',text:'תאם '+stage.name+' ל'+c.name,id:c.id,urgent:false,system:true});
        if(stageId>=4&&c['stage'+stageId+'_date']&&!c['stage'+stageId+'_grade'])tasks.push({type:'result',text:'הזן תוצאה ל'+c.name,id:c.id,urgent:days>=ad,system:true});
      }
      if(c.status==='pass'&&stageId<7)tasks.push({type:'advance',text:'העבר את '+c.name+' לשלב הבא',id:c.id,urgent:false,system:true});
    });

    // Custom tasks
    const custom=await DB.getTasksForDate(today);
    const stageCustom=custom.filter(t=>!t.stageId||t.stageId==stageId);
    stageCustom.forEach(t=>{
      const isOverdue=t.date<today&&!t.done;
      tasks.push({type:'custom',text:t.text,id:t.id,urgent:isOverdue,system:false,done:t.done,overdue:isOverdue,taskId:t.id});
    });

    tasks.sort((a,b)=>{
      if(a.done&&!b.done)return 1;if(!a.done&&b.done)return -1;
      if(a.urgent&&!b.urgent)return -1;if(!a.urgent&&b.urgent)return 1;return 0;});

    const page=Utils.id('mainContent');
    let html='<div class="page active"><div style="display:flex;align-items:center;gap:10px;padding:12px;">'
    +'<button class="btn btn-outline btn-sm" onclick="App.navigate(\'stage\','+stageId+')">←</button>'
    +'<div style="font-size:1.1rem;font-weight:700;">☑️ משימות — '+stage.name+'</div>'
    +'<span style="font-size:.75rem;color:var(--text-light);margin-right:auto;">'+tasks.length+' משימות</span>'
    +'<button class="btn btn-primary btn-sm" onclick="Tasks.addTaskModal('+stageId+')">+ חדש</button></div>';

    if(!tasks.length){html+='<div class="empty-state"><div class="icon">✅</div><div>אין משימות פתוחות!</div></div>';}
    else{tasks.forEach(t=>{
      const tags={call:'שיחה',coord:'תיאום',result:'תוצאה',advance:'העברה',custom:'ידני'};
      const overdueClass=t.overdue?'task-overdue':'';
      html+='<div class="task-item '+overdueClass+'">';
      if(t.system){
        html+='<div class="task-check" onclick="event.stopPropagation();App.navigate(\'candidate\',\''+t.id+'\')">○</div>';
      }else{
        html+='<div class="task-check '+(t.done?'done':'')+'" onclick="event.stopPropagation();Tasks.toggleCustomTask(\''+t.taskId+'\','+stageId+')">'+(t.done?'✓':'○')+'</div>';
      }
      html+='<div class="task-text '+(t.done?'done':'')+'" onclick="'+(t.system?"App.navigate(\'candidate\',\'"+t.id+"\')":"")+'">'+
      (t.urgent&&!t.done?'⚠️ ':'')+t.text+'</div>'
      +'<div class="task-tag">'+tags[t.type]+'</div></div>';
    });}

    html+='</div>';page.innerHTML=html;
  },

  addTaskModal(stageId){
    const html='<div class="modal-title">➕ משימה חדשה</div>'
    +'<div class="form-group"><label class="form-label">תיאור משימה</label>'
    +'<input class="form-input" id="newTaskText" placeholder="הזן משימה..."></div>'
    +'<div class="form-group"><label class="form-label">תאריך</label>'
    +'<input type="date" class="form-input" id="newTaskDate" value="'+Utils.today()+'"></div>'
    +'<div style="display:flex;gap:8px;margin-top:16px;">'
    +'<button class="btn btn-primary" style="flex:1" onclick="Tasks.saveNewTask('+stageId+')">שמור</button>'
    +'<button class="btn btn-outline" style="flex:1" onclick="Stages.closeModal()">ביטול</button></div>';
    Stages.showModal(html);
  },

  async saveNewTask(stageId){
    const text=Utils.id('newTaskText')?.value?.trim();
    const date=Utils.id('newTaskDate')?.value||Utils.today();
    if(!text){Utils.toast('נא למלא תיאור','danger');return;}
    await DB.saveTask({text,date,stageId,done:false,jobId:App.currentJob});
    Stages.closeModal();Utils.toast('משימה נוספה','success');Tasks.render(stageId);
  },

  async toggleCustomTask(taskId,stageId){
    const tasks=await DB.getAllTasks();const t=tasks.find(x=>x.id===taskId);
    if(t){t.done=!t.done;t.doneAt=t.done?new Date().toISOString():null;await DB.saveTask(t);Tasks.render(stageId);}
  },

  async carryOverTasks(){
    const all=await DB.getAllTasks();const today=Utils.today();
    for(const t of all){
      if(!t.done&&t.date<today){t.overdue=true;await DB.saveTask(t);}
    }
  }
};
