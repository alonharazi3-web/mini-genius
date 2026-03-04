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
getStage(id){return this.STAGES.find(function(s){return s.id===id})},
getStageName(id){var s=this.getStage(id);return s?s.icon+' '+s.name:'שלב '+id;},
formatDate(iso){if(!iso)return'';return new Date(iso).toLocaleDateString('he-IL')},
formatDateTime(iso){if(!iso)return'';var d=new Date(iso);return d.toLocaleDateString('he-IL')+' '+d.toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})},
today(){return new Date().toISOString().split('T')[0]},
daysSince(iso){if(!iso)return 999;return Math.floor((Date.now()-new Date(iso).getTime())/864e5)},
workDaysSince(iso){if(!iso)return 999;var c=0;var s=new Date(iso),n=new Date(),d=new Date(s);
while(d<n){var day=d.getDay();if(day!==5&&day!==6)c++;d.setDate(d.getDate()+1);}return c;},

// ===== FIX #1: WhatsApp via Intent (prevents web page stuck) =====
openWhatsApp(phone,msg){
  var clean=phone.replace(/\D/g,'');
  var intl=clean.startsWith('0')?'972'+clean.substring(1):clean;
  _dbg('openWhatsApp intent: '+intl);
  if(window.plugins&&window.plugins.intentShim){
    window.plugins.intentShim.startActivity({
      action:'android.intent.action.VIEW',
      url:'https://wa.me/'+intl+'?text='+encodeURIComponent(msg),
      extras:{}
    },function(){_dbg('WA intent OK');},
    function(e){
      _dbg('WA intent fallback:'+JSON.stringify(e));
      window.plugins.intentShim.startActivity({
        action:'android.intent.action.VIEW',
        url:'whatsapp://send?phone='+intl+'&text='+encodeURIComponent(msg),
        extras:{}
      },function(){},function(){
        window.open('https://wa.me/'+intl+'?text='+encodeURIComponent(msg),'_system');
      });
    });
  }else{
    window.open('https://wa.me/'+intl+'?text='+encodeURIComponent(msg),'_system');
  }
},

openDialer(phone){window.open('tel:'+phone,'_system')},
sendEmail(to,subj,body){window.open('mailto:'+to+'?subject='+encodeURIComponent(subj)+'&body='+encodeURIComponent(body),'_system')},

// ===== Save to contacts =====
saveToContacts(name,phone,jobName){
  _dbg('saveToContacts: '+name);
  if(window.plugins&&window.plugins.intentShim){
    window.plugins.intentShim.startActivity({
      action:'android.intent.action.INSERT',
      type:'vnd.android.cursor.dir/contact',
      extras:{'name':name+' - מועמד','phone':phone,'company':jobName||'Mini Genius'}
    },function(){Utils.toast('נפתח דף איש קשר','success');},
    function(e){Utils.saveToContactsVcf(name,phone,jobName);});
  }else{Utils.saveToContactsVcf(name,phone,jobName);}
},
saveToContactsVcf(name,phone,jobName){
  var vcard='BEGIN:VCARD\nVERSION:3.0\nFN:'+name+' - מועמד\nTEL;TYPE=CELL:'+phone+'\nORG:'+jobName+'\nEND:VCARD';
  try{var blob=new Blob([vcard],{type:'text/vcard'});
  var url=URL.createObjectURL(blob);var a=document.createElement('a');
  a.href=url;a.download=name+'.vcf';document.body.appendChild(a);a.click();
  document.body.removeChild(a);URL.revokeObjectURL(url);
  Utils.toast('קובץ VCF נוצר','success');
  }catch(e){Utils.toast('שגיאה','danger');}
},

// ===== FIX #4: Reminders — multiple Samsung options =====
scheduleReminder(title,dateStr,timeStr){
  _dbg('scheduleReminder: '+title);
  var dt=new Date(dateStr+'T'+(timeStr||'09:00'));
  if(!window.plugins||!window.plugins.intentShim){
    Utils.toast('הוסף ידנית ללוח שנה','info');return;
  }
  var safeTitle=title.replace(/'/g,"\\'");
  var html='<div class="modal-title">\u05d1\u05d7\u05e8 \u05e9\u05d9\u05d8\u05ea \u05ea\u05d6\u05db\u05d5\u05e8\u05ea</div>'
  +'<div style="display:flex;flex-direction:column;gap:10px;">'
  +'<button class="btn btn-primary" style="width:100%;" onclick="Utils._remCalendar(\''+safeTitle+'\','+dt.getTime()+')">\u{1f4c5} \u05dc\u05d5\u05d7 \u05e9\u05e0\u05d4 (Google/Samsung)</button>'
  +'<button class="btn btn-primary" style="width:100%;" onclick="Utils._remSamsungReminder(\''+safeTitle+'\','+dt.getTime()+')">\u{1f4cb} Samsung Reminder</button>'
  +'<button class="btn btn-primary" style="width:100%;" onclick="Utils._remAlarm(\''+safeTitle+'\','+dt.getTime()+')">\u23f0 \u05e9\u05e2\u05d5\u05df \u05de\u05e2\u05d5\u05e8\u05e8</button>'
  +'<button class="btn btn-outline" style="width:100%;" onclick="Utils._remIcs(\''+safeTitle+'\','+dt.getTime()+')">\u{1f4ce} \u05e7\u05d5\u05d1\u05e5 Outlook (.ics)</button>'
  +'</div>';
  Stages.showModal(html);
},
_remCalendar(title,ms){
  Stages.closeModal();
  window.plugins.intentShim.startActivity({
    action:'android.intent.action.INSERT',
    type:'vnd.android.cursor.item/event',
    extras:{'title':'Mini Genius: '+title,'beginTime':ms,'endTime':ms+3600000,'allDay':false}
  },function(){Utils.toast('\u05e0\u05e4\u05ea\u05d7 \u05dc\u05d5\u05d7 \u05e9\u05e0\u05d4','success');},
  function(){Utils.toast('\u05dc\u05d0 \u05d4\u05e6\u05dc\u05d9\u05d7','danger');});
},
_remSamsungReminder(title,ms){
  Stages.closeModal();
  window.plugins.intentShim.startActivity({
    component:{package:'com.samsung.android.app.reminder',class:'com.samsung.android.app.reminder.activity.MainActivity'},
    extras:{}
  },function(){Utils.toast('\u05e0\u05e4\u05ea\u05d7 Samsung Reminder','success');},
  function(){Utils.toast('Samsung Reminder \u05dc\u05d0 \u05d6\u05de\u05d9\u05df \u2014 \u05e0\u05e1\u05d4 \u05dc\u05d5\u05d7 \u05e9\u05e0\u05d4','warning');});
},
_remAlarm(title,ms){
  Stages.closeModal();
  var dt=new Date(ms);
  window.plugins.intentShim.startActivity({
    action:'android.intent.action.SET_ALARM',
    extras:{'android.intent.extra.alarm.HOUR':dt.getHours(),
    'android.intent.extra.alarm.MINUTES':dt.getMinutes(),
    'android.intent.extra.alarm.MESSAGE':'Mini Genius: '+title,
    'android.intent.extra.alarm.SKIP_UI':false}
  },function(){Utils.toast('\u05e0\u05e4\u05ea\u05d7 \u05e9\u05e2\u05d5\u05df','success');},
  function(){Utils.toast('\u05dc\u05d0 \u05d4\u05e6\u05dc\u05d9\u05d7','danger');});
},
_remIcs(title,ms){
  Stages.closeModal();
  Utils.generateIcsAndShare(title,new Date(ms));
},

// ===== FIX #2: Outlook .ics generation =====
generateIcsAndShare(title,startDate,endDate,location){
  if(!endDate)endDate=new Date(startDate.getTime()+3600000);
  function pad(n){return n<10?'0'+n:n;}
  function icsD(d){return d.getUTCFullYear()+pad(d.getUTCMonth()+1)+pad(d.getUTCDate())+'T'+pad(d.getUTCHours())+pad(d.getUTCMinutes())+'00Z';}
  var ics='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//MiniGenius//HR//HE\r\nBEGIN:VEVENT\r\n'
  +'UID:mg-'+Date.now()+'@app\r\n'
  +'DTSTART:'+icsD(startDate)+'\r\nDTEND:'+icsD(endDate)+'\r\n'
  +'SUMMARY:'+title+'\r\n'
  +(location?'LOCATION:'+location+'\r\n':'')
  +'DESCRIPTION:Mini Genius HR\r\n'
  +'BEGIN:VALARM\r\nTRIGGER:-PT30M\r\nACTION:DISPLAY\r\nDESCRIPTION:reminder\r\nEND:VALARM\r\n'
  +'END:VEVENT\r\nEND:VCALENDAR';
  var fn=title.replace(/[^א-תa-zA-Z0-9]/g,'_').substring(0,30)+'.ics';
  Utils.writeToCacheAndShare(fn,ics,'text/calendar','\u05e4\u05d2\u05d9\u05e9\u05d4: '+title);
},

// ===== FIX #2: Export questionnaire as Word-like HTML =====
exportQuestionnaireAsWord(candidateName,sections,grade,result,notes){
  var html='<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8">'
  +'<style>body{font-family:David,Arial;direction:rtl;padding:30px;max-width:800px;margin:0 auto;}'
  +'h1{color:#1B2A4A;border-bottom:2px solid #1B2A4A;padding-bottom:8px;font-size:22px;}'
  +'h2{color:#2D4A7A;margin-top:24px;border-bottom:1px solid #ddd;padding-bottom:4px;font-size:16px;}'
  +'table{width:100%;border-collapse:collapse;margin:10px 0;}'
  +'th,td{border:1px solid #ccc;padding:8px;text-align:right;font-size:14px;}'
  +'th{background:#1B2A4A;color:#fff;}'
  +'.yes{color:#22c55e;font-weight:bold;}.no{color:#dc2626;font-weight:bold;}'
  +'.grade-box{display:inline-block;padding:10px 20px;font-size:24px;font-weight:bold;border-radius:8px;margin:8px 0;}'
  +'.pass{background:#f0fdf4;color:#16a34a;border:2px solid #22c55e;}'
  +'.fail{background:#fef2f2;color:#dc2626;border:2px solid #ef4444;}'
  +'.hesit{background:#fffbeb;color:#b45309;border:2px solid #f59e0b;}</style></head><body>'
  +'<h1>\u{1f4cb} \u05e9\u05d0\u05dc\u05d5\u05df \u05d8\u05dc\u05e4\u05d5\u05e0\u05d9 \u2014 '+Utils.escHtml(candidateName)+'</h1>'
  +'<p>\u05ea\u05d0\u05e8\u05d9\u05da: '+Utils.formatDate(new Date().toISOString())+'</p>';
  if(grade){
    var cls=result==='pass'?'pass':result==='fail'?'fail':'hesit';
    var lbl=result==='pass'?'\u05e2\u05d1\u05e8':result==='fail'?'\u05dc\u05d0 \u05e2\u05d1\u05e8':'\u05d4\u05ea\u05dc\u05d1\u05d8\u05d5\u05ea';
    html+='<div class="grade-box '+cls+'">\u05e6\u05d9\u05d5\u05df: '+grade+'/7 | '+lbl+'</div>';
  }
  sections.forEach(function(sec){
    html+='<h2>'+Utils.escHtml(sec.title)+'</h2><table><tr><th>\u05e9\u05d0\u05dc\u05d4</th><th>\u05ea\u05e9\u05d5\u05d1\u05d4</th></tr>';
    sec.fields.forEach(function(f){
      var v=Utils.escHtml(f.value||'-');
      if(f.value==='\u05db\u05df')v='<span class="yes">\u2713 \u05db\u05df</span>';
      else if(f.value==='\u05dc\u05d0')v='<span class="no">\u2717 \u05dc\u05d0</span>';
      html+='<tr><td>'+Utils.escHtml(f.label)+'</td><td>'+v+'</td></tr>';
      if(f.detail)html+='<tr><td></td><td>'+Utils.escHtml(f.detail)+'</td></tr>';
    });
    html+='</table>';
  });
  if(notes)html+='<h2>\u05d4\u05e2\u05e8\u05d5\u05ea</h2><p>'+Utils.escHtml(notes)+'</p>';
  html+='</body></html>';
  var fn='\u05e9\u05d0\u05dc\u05d5\u05df_'+candidateName.replace(/\s/g,'_')+'_'+Utils.today()+'.html';
  Utils.writeToCacheAndShare(fn,html,'text/html','\u05e9\u05d0\u05dc\u05d5\u05df \u05d8\u05dc\u05e4\u05d5\u05e0\u05d9 \u2014 '+candidateName);
},

// ===== Share helpers =====
shareViaPlugin(msg,subj,files){
  if(window.plugins&&window.plugins.socialsharing){
    window.plugins.socialsharing.shareWithOptions({
      message:msg||'',subject:subj||'Mini Genius',files:files||[]
    },function(){_dbg('Share OK');},function(e){_dbg('Share err:'+e);});
  }else{Utils.toast('\u05e9\u05d9\u05ea\u05d5\u05e3 \u05dc\u05d0 \u05d6\u05de\u05d9\u05df','danger');}
},
async writeToCacheAndShare(filename,content,mimeType,subject){
  if(!window.cordova||!window.cordova.file){
    var blob=new Blob([content],{type:mimeType||'text/html'});
    var url=URL.createObjectURL(blob);var a=document.createElement('a');
    a.href=url;a.download=filename;document.body.appendChild(a);a.click();
    document.body.removeChild(a);URL.revokeObjectURL(url);return;
  }
  window.resolveLocalFileSystemURL(cordova.file.cacheDirectory,function(dir){
    dir.getFile(filename,{create:true,exclusive:false},function(fe){
      fe.createWriter(function(writer){
        writer.onwriteend=function(){Utils.shareViaPlugin('',subject||'Mini Genius',[fe.nativeURL]);};
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
