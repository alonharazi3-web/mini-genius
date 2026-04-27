'use strict';
// Google Drive Sync — OAuth2 via InAppBrowser, Drive REST API v3
var Sync={
  _token:null,_tokenExpiry:0,_syncFileId:null,_autoUploadTimer:null,_autoCheckTimer:null,_tokenRefreshTimer:null,
  _lastSyncHash:'',_currentRecruiter:'',

  // ===== INIT — start timers if sync is configured =====
  async init(){
    var clientId=App.settings.gdrive_clientId||'';
    var token=App.settings.gdrive_token||'';
    var expiry=parseInt(App.settings.gdrive_tokenExpiry)||0;
    Sync._syncFileId=App.settings.gdrive_fileId||'';
    Sync._currentRecruiter=App.settings.currentRecruiter||'';
    if(clientId&&token){
      Sync._token=token;Sync._tokenExpiry=expiry;
      _dbg('Sync init: token loaded, refreshToken: '+(App.settings.gdrive_refreshToken?'YES':'NO'));
      if(expiry>Date.now()){
        _dbg('Sync: token valid, expires '+new Date(expiry).toLocaleTimeString());
      }else if(App.settings.gdrive_refreshToken){
        _dbg('Sync: token expired but have refresh token — refreshing now');
        Sync._refreshAccessToken().catch(function(e){_dbg('Init refresh err: '+e);});
      }else{
        _dbg('Sync: token expired, no refresh token');
      }
      Sync._startTimers();
    }
  },

  // ===== RECRUITER SELECTION =====
  showRecruiterSelect(){
    var recs=JSON.parse(App.settings.recruiters||'[]');
    if(!recs.length){Utils.toast('הגדר רכזים בניהול','warning');return;}
    var html='<div class="modal-title">👤 בחר רכז מטפל</div>';
    recs.forEach(function(r){
      var active=r===Sync._currentRecruiter?' style="background:var(--accent);color:#fff;"':'';
      html+='<div class="card" onclick="Sync.setRecruiter(\''+Utils.escHtml(r)+'\')"'+active+'>'
      +'<div style="font-size:1rem;font-weight:600;text-align:center;">'+Utils.escHtml(r)+'</div></div>';
    });
    html+='<button class="btn btn-outline" style="width:100%;margin-top:12px;" onclick="Stages.closeModal()">ביטול</button>';
    Stages.showModal(html);
  },
  async setRecruiter(name){
    Sync._currentRecruiter=name;
    await DB.setSetting('currentRecruiter',name);
    App.settings.currentRecruiter=name;
    Stages.closeModal();
    Utils.toast('רכז: '+name,'success');
  },

  // ===== GOOGLE SIGN-IN — authorization code flow with refresh token =====
  async signIn(){
    var clientId=App.settings.gdrive_clientId||'';
    var clientSecret=App.settings.gdrive_clientSecret||'';
    if(!clientId){Utils.toast('הגדר Client ID בהגדרות סנכרון','danger');return;}
    if(!clientSecret){Utils.toast('הגדר Client Secret בהגדרות סנכרון','danger');return;}
    _dbg('Sync: starting OAuth code flow...');

    var redirectUri=App.settings.gdrive_redirectUri||'https://alonharazi3-web.github.io/mini-genius/oauth.html';
    var scope='https://www.googleapis.com/auth/drive.file';
    var url='https://accounts.google.com/o/oauth2/v2/auth'
    +'?client_id='+encodeURIComponent(clientId)
    +'&redirect_uri='+encodeURIComponent(redirectUri)
    +'&response_type=code'
    +'&access_type=offline'
    +'&prompt=consent'
    +'&scope='+encodeURIComponent(scope);

    if(window.cordova&&window.cordova.InAppBrowser){
      cordova.InAppBrowser.open(url,'_system');
    }else{window.open(url,'_blank');}

    setTimeout(function(){Sync._showCodePasteDialog();},2000);
  },

  _showCodePasteDialog:function(){
    var html='<div class="modal-title">🔑 הדבק קוד אימות</div>'
    +'<div class="info-box">1. היכנס עם Google בכרום<br>2. אשר גישה<br>3. העתק את <strong>קוד האימות</strong> שמופיע<br>4. חזור לכאן והדבק</div>'
    +'<div class="form-group"><label class="form-label">קוד אימות</label>'
    +'<input class="form-input" id="pasteCode" dir="ltr" placeholder="4/0Ax..." style="font-size:.8rem;"></div>'
    +'<div style="display:flex;gap:8px;margin-top:12px;">'
    +'<button class="btn btn-primary" style="flex:1;" onclick="Sync._exchangeCode()">✅ התחבר</button>'
    +'<button class="btn btn-outline" style="flex:1;" onclick="Stages.closeModal()">ביטול</button></div>';
    Stages.showModal(html);
  },

  async _exchangeCode(){
    var code=(Utils.id('pasteCode')?.value||'').trim();
    if(!code||code.length<5){Utils.toast('קוד לא תקין','danger');return;}
    var clientId=App.settings.gdrive_clientId||'';
    var clientSecret=App.settings.gdrive_clientSecret||'';
    var redirectUri=App.settings.gdrive_redirectUri||'https://alonharazi3-web.github.io/mini-genius/oauth.html';

    if(!clientSecret){
      Utils.toast('חסר Client Secret! הגדר בניהול → Google Drive','danger');
      _dbg('ERROR: No client secret configured');
      return;
    }

    _dbg('=== CODE EXCHANGE ===');
    _dbg('Client ID: '+clientId.substring(0,20)+'...');
    _dbg('Client Secret: '+clientSecret.substring(0,8)+'...');
    _dbg('Redirect URI: '+redirectUri);
    _dbg('Code: '+code.substring(0,15)+'...');

    Utils.toast('מחליף קוד לטוקן...','info');
    try{
      var body='code='+encodeURIComponent(code)
        +'&client_id='+encodeURIComponent(clientId)
        +'&client_secret='+encodeURIComponent(clientSecret)
        +'&redirect_uri='+encodeURIComponent(redirectUri)
        +'&grant_type=authorization_code';
      _dbg('POST body: '+body.substring(0,100)+'...');

      var resp=await fetch('https://oauth2.googleapis.com/token',{
        method:'POST',
        headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body:body
      });
      var raw=await resp.text();
      _dbg('Response status: '+resp.status);
      _dbg('Response body: '+raw.substring(0,300));

      var data=JSON.parse(raw);
      if(data.error){
        _dbg('TOKEN ERROR: '+data.error+' — '+data.error_description);
        Utils.toast('שגיאה: '+(data.error_description||data.error),'danger');
        return;
      }
      if(!data.access_token){
        _dbg('NO ACCESS TOKEN in response!');
        Utils.toast('לא התקבל טוקן','danger');
        return;
      }

      _dbg('✅ access_token received, expires_in: '+data.expires_in);
      _dbg('✅ refresh_token received: '+(data.refresh_token?'YES ('+data.refresh_token.substring(0,10)+'...)':'NO!!!'));

      Sync._token=data.access_token;
      Sync._tokenExpiry=Date.now()+((data.expires_in||3600)*1000);
      await DB.setSetting('gdrive_token',data.access_token);
      await DB.setSetting('gdrive_tokenExpiry',String(Sync._tokenExpiry));
      App.settings.gdrive_token=data.access_token;
      App.settings.gdrive_tokenExpiry=String(Sync._tokenExpiry);

      if(data.refresh_token){
        await DB.setSetting('gdrive_refreshToken',data.refresh_token);
        App.settings.gdrive_refreshToken=data.refresh_token;
        _dbg('✅ Refresh token SAVED to DB — connection will auto-renew!');
      }else{
        _dbg('⚠️ NO refresh_token! Google only sends it on FIRST authorization with prompt=consent');
        _dbg('⚠️ If you already authorized before, revoke access at https://myaccount.google.com/permissions then try again');
      }

      Stages.closeModal();
      await Sync._findOrCreateSyncFile();
      Sync._startTimers();
      Utils.toast(data.refresh_token?'מחובר לצמיתות! 🔒':'מחובר (ללא refresh token ⚠️)','success');
      Sync.renderSettings();
    }catch(e){
      _dbg('Exchange EXCEPTION: '+e);
      Utils.toast('שגיאה: '+e.message,'danger');
    }
  },

  // Auto-refresh using stored refresh token
  async _refreshAccessToken(){
    var refreshToken=App.settings.gdrive_refreshToken||'';
    var clientId=App.settings.gdrive_clientId||'';
    var clientSecret=App.settings.gdrive_clientSecret||'';
    if(!refreshToken){_dbg('Refresh: NO refresh token stored');return false;}
    if(!clientId||!clientSecret){_dbg('Refresh: missing clientId/clientSecret');return false;}
    try{
      _dbg('=== AUTO REFRESH ===');
      _dbg('Refresh token: '+refreshToken.substring(0,10)+'...');
      var resp=await fetch('https://oauth2.googleapis.com/token',{
        method:'POST',
        headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body:'refresh_token='+encodeURIComponent(refreshToken)
          +'&client_id='+encodeURIComponent(clientId)
          +'&client_secret='+encodeURIComponent(clientSecret)
          +'&grant_type=refresh_token'
      });
      var raw=await resp.text();
      _dbg('Refresh response: '+resp.status+' — '+raw.substring(0,200));
      var data=JSON.parse(raw);
      if(data.access_token){
        Sync._token=data.access_token;
        Sync._tokenExpiry=Date.now()+((data.expires_in||3600)*1000);
        await DB.setSetting('gdrive_token',data.access_token);
        await DB.setSetting('gdrive_tokenExpiry',String(Sync._tokenExpiry));
        App.settings.gdrive_token=data.access_token;
        _dbg('✅ Token refreshed! Expires: '+new Date(Sync._tokenExpiry).toLocaleTimeString());
        return true;
      }
      _dbg('❌ Refresh FAILED: '+(data.error||'unknown')+' — '+(data.error_description||''));
      if(data.error==='invalid_grant'){
        _dbg('⚠️ Refresh token was revoked or expired. Need to re-authorize.');
        _dbg('⚠️ Check: Google Cloud Console → OAuth consent screen → Publishing status should be "In production"');
      }
      return false;
    }catch(e){_dbg('Refresh EXCEPTION: '+e);return false;}
  },

  async signOut(){
    Sync._token=null;Sync._tokenExpiry=0;Sync._syncFileId='';
    await DB.setSetting('gdrive_token','');
    await DB.setSetting('gdrive_tokenExpiry','0');
    await DB.setSetting('gdrive_refreshToken','');
    await DB.setSetting('gdrive_fileId','');
    App.settings.gdrive_token='';
    App.settings.gdrive_refreshToken='';
    Sync._stopTimers();
    Utils.toast('נותקת מ-Google Drive','success');
    Sync.renderSettings();
  },

  // v3.4: Delete cloud data with local backup first
  async deleteCloudData(){
    if(!confirm('זה ימחק את כל הנתונים בענן!\nגיבוי מקומי ייווצר אוטומטית.\nלהמשיך?'))return;
    try{
      await Sync._saveLocalBackup();
      Utils.toast('גיבוי מקומי נשמר','info');
      // Upload empty data to cloud
      var emptyData={version:2,candidates:[],jobs:[],tasks:[],events:[],
        exportedAt:new Date().toISOString(),exportedBy:'DELETED by '+(Sync._currentRecruiter||'user')};
      await Sync.upload(emptyData);
      Utils.toast('נתוני ענן נמחקו. גיבוי מקומי נשמר.','success');
    }catch(e){
      _dbg('deleteCloud err: '+e);
      Utils.toast('שגיאה: '+e.message,'danger');
    }
  },

  isSignedIn(){return !!Sync._token;},

  // ===== DRIVE API HELPERS =====
  async _apiCall(url,opts){
    if(!Sync._token)throw new Error('Not signed in');
    opts=opts||{};opts.headers=opts.headers||{};
    opts.headers['Authorization']='Bearer '+Sync._token;
    var resp=await fetch(url,opts);
    if(resp.status===401){
      _dbg('Sync: 401 — attempting refresh...');
      var refreshed=await Sync._refreshAccessToken();
      if(refreshed){
        opts.headers['Authorization']='Bearer '+Sync._token;
        resp=await fetch(url,opts);
        if(resp.ok)return resp;
      }
      _dbg('Sync: refresh failed, need re-auth');
      if(Sync._isUserAction){
        Sync._showCodePasteDialog();
      }
      throw new Error('Token expired');
    }
    return resp;
  },

  async _findOrCreateSyncFile(){
    var folderName=App.settings.gdrive_folder||'MiniGenius';
    _dbg('Sync: looking for folder: '+folderName);

    // Find folder
    var q="name='"+folderName+"' and mimeType='application/vnd.google-apps.folder' and trashed=false";
    var resp=await Sync._apiCall('https://www.googleapis.com/drive/v3/files?q='+encodeURIComponent(q)+'&fields=files(id,name)');
    var data=await resp.json();
    var folderId;
    if(data.files&&data.files.length){
      folderId=data.files[0].id;
    }else{
      // Create folder
      var fResp=await Sync._apiCall('https://www.googleapis.com/drive/v3/files',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({name:folderName,mimeType:'application/vnd.google-apps.folder'})
      });
      var fData=await fResp.json();
      folderId=fData.id;
      _dbg('Sync: created folder: '+folderId);
    }

    // Find sync file in folder
    var jobName=(App.settings.activeJobName||'default').replace(/[^א-תa-zA-Z0-9]/g,'_');
    var fileName='minigenius_'+jobName+'.json';
    var q2="name='"+fileName+"' and '"+folderId+"' in parents and trashed=false";
    var resp2=await Sync._apiCall('https://www.googleapis.com/drive/v3/files?q='+encodeURIComponent(q2)+'&fields=files(id,name,modifiedTime)');
    var data2=await resp2.json();
    if(data2.files&&data2.files.length){
      Sync._syncFileId=data2.files[0].id;
      _dbg('Sync: found file: '+Sync._syncFileId);
    }else{
      // Create file
      var meta={name:fileName,parents:[folderId]};
      var form=new FormData();
      form.append('metadata',new Blob([JSON.stringify(meta)],{type:'application/json'}));
      form.append('file',new Blob([JSON.stringify({version:1,candidates:[],jobs:[],tasks:[],settings:{},syncedAt:new Date().toISOString()})],{type:'application/json'}));
      var cResp=await Sync._apiCall('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',{
        method:'POST',body:form
      });
      var cData=await cResp.json();
      Sync._syncFileId=cData.id;
      _dbg('Sync: created file: '+Sync._syncFileId);
    }
    await DB.setSetting('gdrive_fileId',Sync._syncFileId);
    App.settings.gdrive_fileId=Sync._syncFileId;
  },

  // ===== DOWNLOAD & UPLOAD =====
  async download(){
    if(!Sync._syncFileId)await Sync._findOrCreateSyncFile();
    var resp=await Sync._apiCall('https://www.googleapis.com/drive/v3/files/'+Sync._syncFileId+'?alt=media');
    var remote=await resp.json();
    _dbg('Sync: downloaded '+( remote.candidates||[]).length+' candidates');
    return remote;
  },

  async upload(data){
    if(!Sync._syncFileId)await Sync._findOrCreateSyncFile();
    data.syncedAt=new Date().toISOString();
    data.syncedBy=Sync._currentRecruiter||'unknown';
    var body=JSON.stringify(data);
    var resp=await Sync._apiCall('https://www.googleapis.com/upload/drive/v3/files/'+Sync._syncFileId+'?uploadType=media',{
      method:'PATCH',
      headers:{'Content-Type':'application/json'},
      body:body
    });
    _dbg('Sync: uploaded '+(data.candidates||[]).length+' candidates');
    Sync._lastSyncHash=Sync._hash(body);
    await DB.setSetting('_lastSyncTime',new Date().toISOString());
    return resp.ok;
  },

  // ===== EXPORT LOCAL DB TO JSON =====
  async exportLocal(){
    var candidates=await DB.getAllCandidates();
    var jobs=await DB.getAllJobs();
    var tasks=await DB.getAllTasks();
    var events=await DB.getAllEvents();
    return{version:2,candidates:candidates,jobs:jobs,tasks:tasks,events:events,
      exportedAt:new Date().toISOString(),
      exportedBy:Sync._currentRecruiter||'unknown'};
  },

  // ===== LOCAL BACKUP before any sync =====
  async _saveLocalBackup(){
    var data=await Sync.exportLocal();
    var backupStr=JSON.stringify(data);
    await DB.setSetting('_localBackup',backupStr);
    await DB.setSetting('_localBackupTime',new Date().toISOString());
    _dbg('Sync: local backup saved ('+data.candidates.length+' candidates)');
  },

  // ===== FULL UPLOAD — sends ALL local data to cloud =====
  async fullUpload(){
    Sync._isUserAction=true;
    try{
      Utils.toast('מעלה נתונים...','info');
      await Sync._saveLocalBackup();
      var data=await Sync.exportLocal();
      var ok=await Sync.upload(data);
      if(ok){
        await DB.setSetting('_lastSyncTime',new Date().toISOString());
        App.settings._lastSyncTime=new Date().toISOString();
        App.settings=await DB.getAllSettings();
        Utils.toast('הועלו '+data.candidates.length+' מועמדים לענן','success');
        Sync.renderSettings();
      }else Utils.toast('שגיאה בהעלאה','danger');
    }catch(e){
      _dbg('fullUpload err: '+e);
      Utils.toast('שגיאת העלאה: '+e.message,'danger');
    }finally{Sync._isUserAction=false;}
  },

  // ===== FULL DOWNLOAD — replaces local with cloud =====
  async fullDownload(){
    Sync._isUserAction=true;
    try{
      Utils.toast('מוריד נתונים...','info');
      await Sync._saveLocalBackup();
      var remote=await Sync.download();
      // Replace all local candidates
      var localAll=await DB.getAllCandidates();
      for(var i=0;i<localAll.length;i++)await DB.del('candidates',localAll[i].id);
      for(var i=0;i<(remote.candidates||[]).length;i++){
        await DB.put('candidates',remote.candidates[i]);
      }
      // Replace jobs
      var localJobs=await DB.getAllJobs();
      for(var i=0;i<localJobs.length;i++)await DB.del('jobs',localJobs[i].id);
      for(var i=0;i<(remote.jobs||[]).length;i++){
        await DB.put('jobs',remote.jobs[i]);
      }
      // Replace tasks
      var localTasks=await DB.getAllTasks();
      for(var i=0;i<localTasks.length;i++)await DB.del('tasks',localTasks[i].id);
      for(var i=0;i<(remote.tasks||[]).length;i++){
        await DB.put('tasks',remote.tasks[i]);
      }
      // Replace events
      var localEvents=await DB.getAllEvents();
      for(var i=0;i<localEvents.length;i++)await DB.del('events',localEvents[i].id);
      for(var i=0;i<(remote.events||[]).length;i++){
        await DB.put('events',remote.events[i]);
      }
      await DB.setSetting('_lastSyncTime',new Date().toISOString());
      Utils.toast('הורדו '+(remote.candidates||[]).length+' מועמדים מהענן','success');
      App.settings=await DB.getAllSettings();
      App.renderStageList(App.currentStage);App.updateBadges();
      Sync.renderSettings();
    }catch(e){
      _dbg('fullDownload err: '+e);
      Utils.toast('שגיאת הורדה: '+e.message,'danger');
    }finally{Sync._isUserAction=false;}
  },

  // ===== SMART MERGE — compare by ID, auto-merge when possible =====
  async mergeAndSync(){
    Sync._isUserAction=true;
    try{
      Utils.toast('מסנכרן...','info');
      await Sync._saveLocalBackup();
      var local=await Sync.exportLocal();
      var remote=await Sync.download();
      var lastSync=App.settings._lastSyncTime||'1970-01-01';

      // Build ID maps
      var localMap={};local.candidates.forEach(function(c){localMap[c.id]=c;});
      var remoteMap={};(remote.candidates||[]).forEach(function(c){remoteMap[c.id]=c;});

      var conflicts=[];
      var merged=[];var mergeStats={kept:0,fromCloud:0,conflicts:0,newLocal:0,newRemote:0};

      // Process all unique IDs
      var allIds={};
      local.candidates.forEach(function(c){allIds[c.id]=true;});
      (remote.candidates||[]).forEach(function(c){allIds[c.id]=true;});

      Object.keys(allIds).forEach(function(id){
        var lc=localMap[id];
        var rc=remoteMap[id];

        if(lc&&!rc){
          // Only exists locally — keep it
          merged.push(lc);mergeStats.newLocal++;
        }else if(!lc&&rc){
          // Only exists in cloud — take it
          merged.push(rc);mergeStats.newRemote++;
        }else if(lc&&rc){
          // Exists in both — check which is newer
          var localChanged=lc.updatedAt>lastSync;
          var remoteChanged=rc.updatedAt>lastSync;

          if(lc.updatedAt===rc.updatedAt){
            // Identical — keep local
            merged.push(lc);mergeStats.kept++;
          }else if(localChanged&&remoteChanged){
            // BOTH changed since last sync — REAL conflict
            conflicts.push({local:lc,remote:rc});
            mergeStats.conflicts++;
          }else if(remoteChanged){
            // Only cloud changed — take cloud
            merged.push(rc);mergeStats.fromCloud++;
          }else{
            // Only local changed (or neither) — keep local
            merged.push(lc);mergeStats.kept++;
          }
        }
      });

      _dbg('Sync merge: kept='+mergeStats.kept+' fromCloud='+mergeStats.fromCloud+
        ' newLocal='+mergeStats.newLocal+' newRemote='+mergeStats.newRemote+
        ' conflicts='+mergeStats.conflicts);

      if(conflicts.length){
        Sync._conflicts=conflicts;
        Sync._merged=merged;
        Sync._mergeStats=mergeStats;
        Sync._remoteTasks=remote.tasks||[];
        Sync._remoteEvents=remote.events||[];
        Sync._remoteJobs=remote.jobs||[];
        Sync._conflictIdx=0;
        Sync._showConflict();
      }else{
        await Sync._finalizeMerge(merged,mergeStats,remote.tasks||[],remote.events||[],remote.jobs||[]);
      }
    }catch(e){
      _dbg('Sync err: '+e);
      Utils.toast('שגיאת סנכרון: '+e.message,'danger');
    }finally{Sync._isUserAction=false;}
  },

  _conflicts:[],_merged:[],_mergeStats:{},_remoteTasks:[],_remoteEvents:[],_remoteJobs:[],_conflictIdx:0,

  _showConflict:function(){
    var idx=Sync._conflictIdx;
    if(idx>=Sync._conflicts.length){
      Sync._finalizeMerge(Sync._merged,Sync._mergeStats,Sync._remoteTasks,Sync._remoteEvents,Sync._remoteJobs);
      return;
    }
    var c=Sync._conflicts[idx];var lc=c.local;var rc=c.remote;
    var html='<div class="modal-title">⚠️ התנגשות '+(idx+1)+'/'+Sync._conflicts.length+'</div>';
    html+='<div style="font-size:1.05rem;font-weight:700;margin-bottom:10px;">'+Utils.escHtml(lc.name||rc.name)+'</div>';

    html+='<div style="display:flex;gap:8px;">';
    html+='<div style="flex:1;background:#f0f9ff;padding:10px;border-radius:8px;border:2px solid #4A90D9;">'
    +'<div style="font-weight:700;color:#4A90D9;margin-bottom:6px;">📱 מקומי</div>'
    +'<div style="font-size:.78rem;">תחנה: '+Utils.getStageName(lc.stage)+'</div>'
    +'<div style="font-size:.78rem;">סטטוס: '+(Utils.STATUSES[lc.status]||lc.status)+'</div>'
    +'<div style="font-size:.78rem;">רכז: '+(lc.recruiter||'-')+'</div>'
    +'<div style="font-size:.78rem;">עדכון: '+Utils.formatDateTime(lc.updatedAt)+'</div>'
    +'</div>';
    html+='<div style="flex:1;background:#fef9f0;padding:10px;border-radius:8px;border:2px solid #F39C12;">'
    +'<div style="font-weight:700;color:#F39C12;margin-bottom:6px;">☁️ ענן</div>'
    +'<div style="font-size:.78rem;">תחנה: '+Utils.getStageName(rc.stage)+'</div>'
    +'<div style="font-size:.78rem;">סטטוס: '+(Utils.STATUSES[rc.status]||rc.status)+'</div>'
    +'<div style="font-size:.78rem;">רכז: '+(rc.recruiter||'-')+'</div>'
    +'<div style="font-size:.78rem;">עדכון: '+Utils.formatDateTime(rc.updatedAt)+'</div>'
    +'</div></div>';

    html+='<div style="display:flex;flex-direction:column;gap:8px;margin-top:14px;">'
    +'<button class="btn btn-primary" onclick="Sync._resolveConflict(\'local\')">📱 השאר מקומי</button>'
    +'<button class="btn btn-outline" onclick="Sync._resolveConflict(\'remote\')">☁️ קח מהענן</button>'
    +'</div>';
    Stages.showModal(html);
  },

  _resolveConflict:function(choice){
    var c=Sync._conflicts[Sync._conflictIdx];
    // Add chosen version to merged list
    if(choice==='local')Sync._merged.push(c.local);
    else Sync._merged.push(c.remote);
    Sync._conflictIdx++;
    Stages.closeModal();
    Sync._showConflict();
  },

  async _finalizeMerge(merged,stats,remoteTasks,remoteEvents,remoteJobs){
    // 1. Save ALL merged candidates to local DB
    var localAll=await DB.getAllCandidates();
    var localIds={};localAll.forEach(function(c){localIds[c.id]=true;});

    // Add new candidates from cloud
    for(var i=0;i<merged.length;i++){
      var c=merged[i];
      await DB.put('candidates',c);
    }

    // 1b. Merge jobs
    var localJobs=await DB.getAllJobs();
    var localJobIds={};localJobs.forEach(function(j){localJobIds[j.id]=true;});
    for(var i=0;i<(remoteJobs||[]).length;i++){
      if(!localJobIds[remoteJobs[i].id])await DB.put('jobs',remoteJobs[i]);
    }

    // 2. Merge tasks
    var localTasks=await DB.getAllTasks();
    var localTaskIds={};localTasks.forEach(function(t){localTaskIds[t.id]=true;});
    for(var i=0;i<remoteTasks.length;i++){
      var rt=remoteTasks[i];
      if(!localTaskIds[rt.id]){
        await DB.put('tasks',rt);
      }
    }

    // 2b. Merge events
    var localEvts=await DB.getAllEvents();
    var localEvtIds={};localEvts.forEach(function(e){localEvtIds[e.id]=true;});
    for(var i=0;i<(remoteEvents||[]).length;i++){
      if(!localEvtIds[remoteEvents[i].id])await DB.put('events',remoteEvents[i]);
    }

    // 3. Upload COMPLETE merged state to cloud
    var fullData=await Sync.exportLocal();
    await Sync.upload(fullData);

    // 4. Update last sync time
    await DB.setSetting('_lastSyncTime',new Date().toISOString());

    var msg='סנכרון הושלם: '+fullData.candidates.length+' מועמדים';
    if(stats.newRemote)msg+=' ('+stats.newRemote+' חדשים מענן)';
    if(stats.conflicts)msg+=' ('+stats.conflicts+' התנגשויות נפתרו)';
    Utils.toast(msg,'success');
    _dbg('Sync finalized: '+fullData.candidates.length+' total candidates uploaded');

    App.settings=await DB.getAllSettings();
    App.renderStageList(App.currentStage);App.updateBadges();
    Sync.renderSettings();
  },
  _startTimers:function(){
    Sync._stopTimers();
    Sync._autoUploadTimer=setInterval(function(){
      if(Sync.isSignedIn()){
        _dbg('Sync: auto-upload (30min)');
        Sync.fullUpload().catch(function(e){_dbg('Auto-upload err: '+e);});
      }
    },30*60*1000);
    Sync._autoCheckTimer=setInterval(function(){
      if(Sync.isSignedIn())Sync._checkRemoteChanges();
    },60*60*1000);
    // v3.5: Proactive token refresh — every 1 min check if token expires soon
    Sync._tokenRefreshTimer=setInterval(function(){
      if(!Sync._token||!App.settings.gdrive_refreshToken)return;
      var timeLeft=Sync._tokenExpiry-Date.now();
      if(timeLeft<5*60*1000){
        _dbg('Sync: proactive refresh ('+Math.round(timeLeft/1000)+'s left)');
        Sync._refreshAccessToken().catch(function(e){_dbg('Refresh err: '+e);});
      }
    },60*1000);
    _dbg('Sync: timers started (upload 30m, check 60m, refresh 1m)');
  },

  _stopTimers:function(){
    if(Sync._autoUploadTimer){clearInterval(Sync._autoUploadTimer);Sync._autoUploadTimer=null;}
    if(Sync._autoCheckTimer){clearInterval(Sync._autoCheckTimer);Sync._autoCheckTimer=null;}
    if(Sync._tokenRefreshTimer){clearInterval(Sync._tokenRefreshTimer);Sync._tokenRefreshTimer=null;}
  },

  async _checkRemoteChanges(){
    Sync._isUserAction=true;
    try{
      var resp=await Sync._apiCall('https://www.googleapis.com/drive/v3/files/'+Sync._syncFileId+'?fields=modifiedTime');
      var data=await resp.json();
      var lastSync=App.settings._lastSyncTime||'';
      if(data.modifiedTime&&data.modifiedTime>lastSync){
        _dbg('Sync: remote changes detected!');
        Stages.showModal('<div class="modal-title">☁️ שינויים בענן</div>'
        +'<div class="info-box">נמצאו שינויים בקובץ הסנכרון.<br>האם לעדכן?</div>'
        +'<div style="display:flex;gap:8px;margin-top:12px;">'
        +'<button class="btn btn-primary" style="flex:1;" onclick="Stages.closeModal();Sync.mergeAndSync()">🔄 עדכן</button>'
        +'<button class="btn btn-outline" style="flex:1;" onclick="Stages.closeModal()">לא עכשיו</button></div>');
      }else{
        Utils.toast('✅ אין שינויים חדשים בענן','success');
      }
    }catch(e){_dbg('Check remote err: '+e);}finally{Sync._isUserAction=false;}
  },

  // ===== EXIT — upload + optional report + close =====
  async exitApp(){
    var html='<div class="modal-title">🚪 יציאה מהאפליקציה</div>';
    if(Sync.isSignedIn()){
      html+='<div class="info-box">האפליקציה תעלה את הנתונים לענן לפני היציאה.</div>';
    }
    html+='<div class="cb-row" onclick="this.querySelector(\'.cb-box\').classList.toggle(\'checked\')">'
    +'<div class="cb-box checked" id="exitUpload">✓</div><span>העלה נתונים לענן</span></div>'
    +'<div style="display:flex;flex-direction:column;gap:8px;margin-top:16px;">'
    +'<button class="btn btn-primary" style="width:100%;" onclick="Sync._doExitDayClose()">📋 סגירת יום (דוח + מייל)</button>'
    +'<button class="btn btn-danger" style="width:100%;" onclick="Sync._doExit()">🚪 צא בלי דוח</button>'
    +'<button class="btn btn-outline" style="width:100%;" onclick="Stages.closeModal()">ביטול</button></div>';
    Stages.showModal(html);
  },

  async _doExitDayClose(){
    Stages.closeModal();
    var doUpload=Utils.id('exitUpload')?.classList.contains('checked');
    if(doUpload&&Sync.isSignedIn()){
      Utils.toast('מעלה נתונים...','info');
      try{await Sync.fullUpload();}catch(e){_dbg('Exit upload err: '+e);}
    }
    // Open full day close flow
    DaySummary.prepareCloseDay();
  },

  async _doExit(){
    Stages.closeModal();
    var doUpload=Utils.id('exitUpload')?.classList.contains('checked');
    if(doUpload&&Sync.isSignedIn()){
      Utils.toast('מעלה נתונים...','info');
      try{await Sync.fullUpload();}catch(e){_dbg('Exit upload err: '+e);}
    }
    if(navigator.app&&navigator.app.exitApp){
      navigator.app.exitApp();
    }else{
      Utils.toast('לא ניתן לסגור — סגור ידנית','info');
    }
  },

  _hash:function(str){
    var hash=0;
    for(var i=0;i<str.length;i++){hash=((hash<<5)-hash)+str.charCodeAt(i);hash|=0;}
    return hash.toString(36);
  },

  // v3.2: Prompt on startup
  _promptStartupSync:function(){
    var lastSync=App.settings._lastSyncTime||'';
    Stages.showModal('<div class="modal-title">☁️ סנכרון</div>'
    +'<div class="info-box">רכז: <strong>'+Utils.escHtml(Sync._currentRecruiter)+'</strong>'
    +(lastSync?'<br>סנכרון אחרון: '+Utils.formatDateTime(lastSync):'')+'</div>'
    +'<div style="display:flex;gap:8px;margin-top:12px;">'
    +'<button class="btn btn-primary" style="flex:1;" onclick="Stages.closeModal();Sync.mergeAndSync()">🔄 עדכן מהענן</button>'
    +'<button class="btn btn-outline" style="flex:1;" onclick="Stages.closeModal()">עבוד אופליין</button></div>');
  },

  // ===== SETTINGS UI =====
  renderSettings:function(){
    var signedIn=Sync.isSignedIn();
    var clientId=App.settings.gdrive_clientId||'';
    var html='<div class="admin-section"><h3>☁️ סנכרון Google Drive</h3>';

    if(!signedIn){
      var clientSecret=App.settings.gdrive_clientSecret||'';
      html+='<div class="info-box">חבר את האפליקציה ל-Google Drive לסנכרון בין מכשירים.</div>'
      +'<div class="form-group"><label class="form-label">Google Client ID</label>'
      +'<input class="form-input" id="sClientId" dir="ltr" value="'+Utils.escHtml(clientId)+'" '
      +'placeholder="xxx.apps.googleusercontent.com" '
      +'onchange="Admin.saveSetting(\'gdrive_clientId\',this.value)"></div>'
      +'<div class="form-group"><label class="form-label">Google Client Secret</label>'
      +'<input class="form-input" id="sClientSecret" dir="ltr" type="password" value="'+Utils.escHtml(clientSecret)+'" '
      +'placeholder="GOCSPX-..." '
      +'onchange="Admin.saveSetting(\'gdrive_clientSecret\',this.value)"></div>'
      +'<button class="btn btn-primary" style="width:100%;" onclick="Sync.signIn()">🔑 התחבר ל-Google Drive</button>';
    }else{
      var lastSync=App.settings._lastSyncTime||'';
      var backupTime=App.settings._localBackupTime||'';
      var hasRefresh=!!App.settings.gdrive_refreshToken;
      html+='<div class="info-box" style="background:#f0fdf4;border-color:#bbf7d0;">'
      +'✅ מחובר ל-Google Drive'
      +(hasRefresh?' (חיבור קבוע 🔒)':' (טוקן זמני ⚠️)')
      +(lastSync?'<br>סנכרון אחרון: '+Utils.formatDateTime(lastSync):'')
      +(backupTime?'<br>גיבוי מקומי: '+Utils.formatDateTime(backupTime):'')+'</div>'
      +'<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:8px;">'
      +'<button class="btn btn-primary" style="width:100%;" onclick="Sync.mergeAndSync()">🔄 סנכרן (מיזוג חכם)</button>'
      +'<div style="display:flex;gap:8px;">'
      +'<button class="btn btn-outline" style="flex:1;" onclick="Sync.fullUpload()">⬆️ העלה הכל</button>'
      +'<button class="btn btn-outline" style="flex:1;" onclick="if(confirm(\'זה יחליף את כל הנתונים המקומיים!\\nלהמשיך?\'))Sync.fullDownload()">⬇️ הורד הכל</button></div>'
      +'<button class="btn btn-outline" style="width:100%;" onclick="Sync._checkRemoteChanges()">🔍 בדוק עדכונים מהענן</button>'
      +'<button class="btn btn-outline" style="width:100%;color:var(--danger);" onclick="Sync.deleteCloudData()">🗑 מחק נתוני ענן (גיבוי מקומי לפני)</button>'
      +'<button class="btn btn-outline" style="width:100%;" onclick="Sync.signOut()">🔓 נתק מ-Google Drive</button>'
      +'</div>';
    }

    // Recruiter selection
    html+='<div class="form-group"><label class="form-label">רכז נוכחי (זיהוי מכשיר)</label>'
    +'<div style="display:flex;gap:8px;align-items:center;">'
    +'<span style="font-weight:700;">'+(Sync._currentRecruiter||'לא נבחר')+'</span>'
    +'<button class="btn btn-outline btn-sm" onclick="Sync.showRecruiterSelect()">שנה</button></div></div>';

    html+='</div>';
    return html;
  }
};
