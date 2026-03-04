'use strict';
const Utils={
STAGES:[
{id:1,key:'leads',name:'לידים',icon:'📌'},
{id:2,key:'phone',name:'ראיון טלפוני',icon:'📞'},
{id:3,key:'homeExam',name:'מטלה ביתית',icon:'📝'},
{id:4,key:'interview',name:'ראיון אישי',icon:'🤝'},
{id:5,key:'officeExam',name:'מטלה משרדית',icon:'🏢'},
{id:6,key:'advInterview',name:'ראיון מתקדם',icon:'⭐'},
{id:7,key:'ojt',name:'OJT סופי',icon:'🏭'}
],
STATUSES:{active:'פעיל',pass:'עבר',fail:'לא עבר',hesitation:'התלבטות',stopped:'הופסק',accepted:'התקבל',frozen:'הקפאה'},
STATUS_COLORS:{active:'#4A90D9',pass:'#2ECC71',fail:'#E74C3C',hesitation:'#F1C40F',stopped:'#95a5a6',accepted:'#2ecc71',frozen:'#9B59B6'},
getStage(id){return this.STAGES.find(s=>s.id===id)},
getStageName(id){const s=this.getStage(id);return s?s.icon+' '+s.name:'שלב '+id;},
formatDate(iso){if(!iso)return'';return new Date(iso).toLocaleDateString('he-IL')},
formatDateTime(iso){if(!iso)return'';const d=new Date(iso);return d.toLocaleDateString('he-IL')+' '+d.toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})},
today(){return new Date().toISOString().split('T')[0]},
daysSince(iso){if(!iso)return 999;return Math.floor((Date.now()-new Date(iso).getTime())/864e5)},
workDaysSince(iso){if(!iso)return 999;let c=0;const s=new Date(iso),n=new Date(),d=new Date(s);
while(d<n){const day=d.getDay();if(day!==5&&day!==6)c++;d.setDate(d.getDate()+1);}return c;},
openWhatsApp(phone,msg){const clean=phone.replace(/\D/g,'');const intl=clean.startsWith('0')?'972'+clean.substring(1):clean;
window.open('https://wa.me/'+intl+'?text='+encodeURIComponent(msg),'_system');},
openDialer(phone){window.open('tel:'+phone,'_system')},
sendEmail(to,subj,body){window.open('mailto:'+to+'?subject='+encodeURIComponent(subj)+'&body='+encodeURIComponent(body),'_system')},

// Save to contacts via Android Intent
saveToContacts(name,phone,jobName){
  _dbg('saveToContacts: '+name+' '+phone);
  if(window.plugins&&window.plugins.intentShim){
    window.plugins.intentShim.startActivity({
      action:window.plugins.intentShim.ACTION_INSERT||'android.intent.action.INSERT',
      type:'vnd.android.cursor.dir/contact',
      extras:{'name':name+' - מועמד','phone':phone,'company':jobName||'Mini Genius'}
    },function(){Utils.toast('נפתח דף איש קשר','success');},
    function(e){_dbg('Intent err:'+JSON.stringify(e));Utils.saveToContactsVcf(name,phone,jobName);});
  }else{Utils.saveToContactsVcf(name,phone,jobName);}
},
saveToContactsVcf(name,phone,jobName){
  var vcardLines=['BEGIN:VCARD','VERSION:3.0','FN:'+name+' - מועמד',
    'TEL;TYPE=CELL:'+phone,'ORG:'+jobName,'NOTE:מועמד - '+jobName,'END:VCARD'];
  var vcardStr=vcardLines.join('\n');
  try{var blob=new Blob([vcardStr],{type:'text/vcard'});
  var url=URL.createObjectURL(blob);var a=document.createElement('a');
  a.href=url;a.download=name+'.vcf';document.body.appendChild(a);a.click();
  document.body.removeChild(a);URL.revokeObjectURL(url);
  Utils.toast('קובץ VCF נוצר — פתח לשמירה','success');
  }catch(e){Utils.toast('שגיאה','danger');}
},

// Reminder via Google Calendar intent (syncs with Samsung Reminder)
scheduleReminder(title,dateStr,timeStr){
  _dbg('scheduleReminder: '+title);
  var dt=new Date(dateStr+'T'+(timeStr||'09:00'));
  // Try local notification first
  if(window.cordova&&cordova.plugins&&cordova.plugins.notification&&cordova.plugins.notification.local){
    var id=Math.floor(Math.random()*100000);
    cordova.plugins.notification.local.schedule({
      id:id,title:'Mini Genius',text:title,trigger:{at:dt},foreground:true,vibrate:true
    });
    _dbg('Local notification scheduled id='+id);
    Utils.toast('תזכורת נקבעה!','success');
  }
  // Also add to calendar (syncs with Samsung Reminder)
  if(window.plugins&&window.plugins.intentShim){
    window.plugins.intentShim.startActivity({
      action:'android.intent.action.INSERT',
      type:'vnd.android.cursor.item/event',
      extras:{'title':'Mini Genius: '+title,'beginTime':dt.getTime(),'endTime':dt.getTime()+3600000,'allDay':false}
    },function(){_dbg('Calendar added');},function(){_dbg('Calendar fallback');});
  }else if(!window.cordova||!cordova.plugins||!cordova.plugins.notification){
    Utils.toast('הוסף ידנית ללוח שנה','info');}
},

// Share via social sharing plugin (like Improv app)
shareViaPlugin(msg,subj,files){
  if(window.plugins&&window.plugins.socialsharing){
    window.plugins.socialsharing.shareWithOptions({
      message:msg||'',subject:subj||'Mini Genius',files:files||[]
    },function(){_dbg('Share OK');},function(e){_dbg('Share err:'+e);});
  }else{Utils.toast('שיתוף לא זמין','danger');}
},

// Write to cache and get native URL (like Improv)
async writeToCacheAndShare(filename,content,mimeType,subject){
  if(!window.cordova||!window.cordova.file){
    // fallback: blob download
    var blob=new Blob([content],{type:mimeType||'text/html'});
    var url=URL.createObjectURL(blob);var a=document.createElement('a');
    a.href=url;a.download=filename;document.body.appendChild(a);a.click();
    document.body.removeChild(a);URL.revokeObjectURL(url);return;
  }
  window.resolveLocalFileSystemURL(cordova.file.cacheDirectory,function(dir){
    dir.getFile(filename,{create:true,exclusive:false},function(fe){
      fe.createWriter(function(writer){
        writer.onwriteend=function(){
          Utils.shareViaPlugin('',subject||'Mini Genius',[fe.nativeURL]);
        };
        writer.onerror=function(e){_dbg('Write err:'+e);};
        writer.write(new Blob([content],{type:mimeType||'text/html'}));
      });
    },function(e){_dbg('getFile err:'+e);});
  },function(e){_dbg('FS err:'+e);});
},

shareHtml(html,title){Utils.writeToCacheAndShare((title||'report')+'.html',html,'text/html',title);},
escHtml(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')},
id(eid){return document.getElementById(eid)},
toast(msg,type){var t=document.createElement('div');t.className='toast toast-'+(type||'info');t.textContent=msg;
document.body.appendChild(t);setTimeout(function(){t.classList.add('show')},10);
setTimeout(function(){t.classList.remove('show');setTimeout(function(){t.remove()},300)},2500);}
};
