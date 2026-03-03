'use strict';
const DB={_db:null,DB_NAME:'MiniGenius',DB_VERSION:2,
async init(){return new Promise((res,rej)=>{const r=indexedDB.open(this.DB_NAME,this.DB_VERSION);
r.onupgradeneeded=e=>{const db=e.target.result;
if(!db.objectStoreNames.contains('candidates')){const s=db.createObjectStore('candidates',{keyPath:'id'});
s.createIndex('stage','stage',{unique:false});s.createIndex('phone','phone',{unique:false});
s.createIndex('jobId','jobId',{unique:false});s.createIndex('status','status',{unique:false});}
if(!db.objectStoreNames.contains('settings'))db.createObjectStore('settings',{keyPath:'key'});
if(!db.objectStoreNames.contains('jobs'))db.createObjectStore('jobs',{keyPath:'id'});
if(!db.objectStoreNames.contains('tasks'))db.createObjectStore('tasks',{keyPath:'id'});
if(!db.objectStoreNames.contains('daylog'))db.createObjectStore('daylog',{keyPath:'id'});
};r.onsuccess=e=>{this._db=e.target.result;res();};r.onerror=e=>rej(e.target.error);})},
async _tx(st,mode,fn){return new Promise((res,rej)=>{const tx=this._db.transaction(st,mode);const s=tx.objectStore(st);const r=fn(s);
if(r&&r.onsuccess!==undefined){r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);}
else{tx.oncomplete=()=>res(r);tx.onerror=()=>rej(tx.error);}})},
async put(st,d){return this._tx(st,'readwrite',s=>s.put(d))},
async get(st,k){return this._tx(st,'readonly',s=>s.get(k))},
async getAll(st){return this._tx(st,'readonly',s=>s.getAll())},
async del(st,k){return this._tx(st,'readwrite',s=>s.delete(k))},
async getByIdx(st,idx,val){return new Promise((res,rej)=>{const tx=this._db.transaction(st,'readonly');
const r=tx.objectStore(st).index(idx).getAll(val);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);})},

// Candidates
async saveCandidate(c){c.updatedAt=new Date().toISOString();
if(!c.id){c.id='c_'+Date.now()+'_'+Math.random().toString(36).substr(2,6);c.createdAt=c.updatedAt;}
await this.put('candidates',c);this.logAction('candidate_update',{id:c.id,name:c.name,stage:c.stage,status:c.status});return c;},
async getCandidate(id){return this.get('candidates',id)},
async getByStage(stage,jobId){const a=await this.getByIdx('candidates','stage',stage);return jobId?a.filter(c=>c.jobId===jobId):a;},
async getByJob(jid){return this.getByIdx('candidates','jobId',jid)},
async getAllCandidates(){return this.getAll('candidates')},
async findDups(phone){return this.getByIdx('candidates','phone',phone)},
async getFrozen(jobId){const all=await this.getAllCandidates();return all.filter(c=>c.status==='frozen'&&(!jobId||c.jobId===jobId));},

// Settings
async getSetting(k){const r=await this.get('settings',k);return r?r.value:null},
async setSetting(k,v){await this.put('settings',{key:k,value:v,updatedAt:new Date().toISOString()})},
async getAllSettings(){const rows=await this.getAll('settings');const o={};rows.forEach(r=>o[r.key]=r.value);return o;},

// Jobs
async saveJob(j){if(!j.id)j.id='j_'+Date.now();j.updatedAt=new Date().toISOString();await this.put('jobs',j);return j;},
async getAllJobs(){return this.getAll('jobs')},

// Custom Tasks
async saveTask(t){if(!t.id)t.id='t_'+Date.now()+'_'+Math.random().toString(36).substr(2,4);
t.updatedAt=new Date().toISOString();await this.put('tasks',t);return t;},
async getAllTasks(){return this.getAll('tasks')},
async delTask(id){return this.del('tasks',id)},
async getTasksForDate(date){const all=await this.getAll('tasks');return all.filter(t=>t.date===date||(!t.done&&t.date<date));},

// Day Log
async logAction(type,data){const today=new Date().toISOString().split('T')[0];
const id='dl_'+Date.now()+'_'+Math.random().toString(36).substr(2,4);
await this.put('daylog',{id,type,data,date:today,time:new Date().toISOString()});},
async getDayLog(date){const all=await this.getAll('daylog');return all.filter(l=>l.date===date);},

// Defaults
async initDefaults(){const ex=await this.getAllSettings();
const defs={recruiters:'[]',leadRecruiter:'',email:'',examCenterPhone:'',
msgStage1:'שלום {name}, מועמדותך התקבלה ונמצאת בטיפול.',
msgStage2:'שלום {name}, ניסינו ליצור עימך קשר. אנא תאם/י מועד.',
msgStage3Coord:'שלום {name}, תואם עבורך מבחן ליום {date}.',
msgStage3Results:'שלום {name}, ייצרו עימך קשר בשבוע הקרוב.',
msgStageInvite:'שלום {name}, הנך מוזמן/ת ל{stageName} בתאריך {date} בשעה {time}.',
msgUnfreeze:'שלום {name}, אנו מחדשים עימך קשר לבקשתך. האם מעוניין/ת להמשיך בתהליך?',
alertDaysStage1:'3',alertDaysStage2:'3',alertDaysStage3Exam:'4',alertDaysStage3Transfer:'3',
alertDaysStage4:'5',alertDaysStage5:'5',alertDaysStage6:'5',alertDaysStage7:'5'};
for(const[k,v]of Object.entries(defs)){if(!(k in ex))await this.setSetting(k,v);}
const jobs=await this.getAllJobs();if(!jobs.length){
await this.saveJob({id:'j_nov26',name:'עובד מפעל נובמבר 26',active:true});
await this.saveJob({id:'j_apr27',name:'עובד מפעל אפריל 27',active:true});
await this.saveJob({id:'j_nov27',name:'עובד מפעל נובמבר 27',active:true});}}
};
