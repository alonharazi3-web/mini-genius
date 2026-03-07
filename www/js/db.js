'use strict';
const DB={_db:null,DB_NAME:'MiniGenius',DB_VERSION:3,
async init(){return new Promise((res,rej)=>{const r=indexedDB.open(this.DB_NAME,this.DB_VERSION);
r.onupgradeneeded=e=>{const db=e.target.result;
if(!db.objectStoreNames.contains('candidates')){const s=db.createObjectStore('candidates',{keyPath:'id'});
s.createIndex('stage','stage',{unique:false});s.createIndex('phone','phone',{unique:false});
s.createIndex('jobId','jobId',{unique:false});s.createIndex('status','status',{unique:false});}
if(!db.objectStoreNames.contains('settings'))db.createObjectStore('settings',{keyPath:'key'});
if(!db.objectStoreNames.contains('jobs'))db.createObjectStore('jobs',{keyPath:'id'});
if(!db.objectStoreNames.contains('tasks'))db.createObjectStore('tasks',{keyPath:'id'});
if(!db.objectStoreNames.contains('daylog'))db.createObjectStore('daylog',{keyPath:'id'});
if(!db.objectStoreNames.contains('files'))db.createObjectStore('files',{keyPath:'id'});
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
async saveCandidate(c){c.updatedAt=new Date().toISOString();
if(!c.id){c.id='c_'+Date.now()+'_'+Math.random().toString(36).substr(2,6);c.createdAt=c.updatedAt;}
await this.put('candidates',c);return c;},
async getCandidate(id){return this.get('candidates',id)},
async getByStage(stage,jobId){const a=await this.getByIdx('candidates','stage',stage);return jobId?a.filter(c=>c.jobId===jobId):a;},
async getAllCandidates(){return this.getAll('candidates')},
async findDups(phone){return this.getByIdx('candidates','phone',phone)},
async getFrozen(jobId){const all=await this.getAllCandidates();return all.filter(c=>c.status==='frozen'&&(!jobId||c.jobId===jobId));},
async getSetting(k){const r=await this.get('settings',k);return r?r.value:null},
async setSetting(k,v){await this.put('settings',{key:k,value:v,updatedAt:new Date().toISOString()})},
async getAllSettings(){const rows=await this.getAll('settings');const o={};rows.forEach(r=>o[r.key]=r.value);return o;},
async saveJob(j){if(!j.id)j.id='j_'+Date.now();j.updatedAt=new Date().toISOString();await this.put('jobs',j);return j;},
async getAllJobs(){return this.getAll('jobs')},
async saveTask(t){if(!t.id)t.id='t_'+Date.now()+'_'+Math.random().toString(36).substr(2,4);
t.updatedAt=new Date().toISOString();await this.put('tasks',t);return t;},
async getAllTasks(){return this.getAll('tasks')},
async delTask(id){return this.del('tasks',id)},
async getTasksForDate(date){const all=await this.getAll('tasks');return all.filter(t=>t.date===date||(!t.done&&t.date<date));},
async saveFile(f){if(!f.id)f.id='f_'+Date.now();await this.put('files',f);return f;},
async getFile(id){return this.get('files',id)},
async logAction(type,desc){const today=new Date().toISOString().split('T')[0];
await this.put('daylog',{id:'dl_'+Date.now()+'_'+Math.random().toString(36).substr(2,4),type:type,desc:desc,date:today,time:new Date().toISOString()});},
async getDayLog(date){const all=await this.getAll('daylog');return all.filter(l=>l.date===date);},
async initDefaults(){const ex=await this.getAllSettings();
const defs={recruiters:'[]',leadRecruiter:'',email:'',examCenterPhone:'',activeJobId:'',
msgStage1:'\u05e9\u05dc\u05d5\u05dd {name}, \u05de\u05d5\u05e2\u05de\u05d3\u05d5\u05ea\u05da \u05d4\u05ea\u05e7\u05d1\u05dc\u05d4.',
msgStage2:'\u05e9\u05dc\u05d5\u05dd {name}, \u05e0\u05d9\u05e1\u05d9\u05e0\u05d5 \u05dc\u05d9\u05e6\u05d5\u05e8 \u05e2\u05d9\u05de\u05da \u05e7\u05e9\u05e8.',
msgStage3Coord:'\u05e9\u05dc\u05d5\u05dd {name}, \u05ea\u05d5\u05d0\u05dd \u05de\u05d1\u05d7\u05df \u05d1\u05ea\u05d0\u05e8\u05d9\u05da {date}.',
msgStage3Results:'\u05e9\u05dc\u05d5\u05dd {name}, \u05ea\u05d5\u05e6\u05d0\u05d5\u05ea \u05d4\u05de\u05d1\u05d7\u05df \u05d4\u05ea\u05e7\u05d1\u05dc\u05d5.',
msgStageInvite:'\u05e9\u05dc\u05d5\u05dd {name}, \u05d4\u05e0\u05da \u05de\u05d5\u05d6\u05de\u05df/\u05ea \u05dc{stageName} \u05d1\u05ea\u05d0\u05e8\u05d9\u05da {date} \u05d1\u05e9\u05e2\u05d4 {time}.',
msgUnfreeze:'\u05e9\u05dc\u05d5\u05dd {name}, \u05d0\u05e0\u05d5 \u05de\u05d7\u05d3\u05e9\u05d9\u05dd \u05e7\u05e9\u05e8. \u05d4\u05d0\u05dd \u05de\u05e2\u05d5\u05e0\u05d9\u05d9\u05df/\u05ea?',
alertDaysStage1:'3',alertDaysStage2:'3',alertDaysStage3Exam:'4',alertDaysStage3Transfer:'3',
alertDaysStage4:'5',alertDaysStage5:'5',alertDaysStage6:'5',alertDaysStage7:'5',
notifCenterPhone:'',notifCenterMsg:'שלום, {name} התקבל/ה לעבודה במפעל.',
factorySecretaryPhone:'',factorySecretaryMsg:'שלום, {name} התקבל/ה — נא לתאם כניסה למפעל.'};
for(const[k,v]of Object.entries(defs)){if(!(k in ex))await this.setSetting(k,v);}
const jobs=await this.getAllJobs();if(!jobs.length){
const j=await this.saveJob({id:'j_default',name:'\u05de\u05d7\u05d6\u05d5\u05e8 \u05d2\u05d9\u05d5\u05e1 \u05e8\u05d0\u05e9\u05d5\u05df',active:true});
if(!ex.activeJobId)await this.setSetting('activeJobId',j.id);}}
};
