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

// ===== FIX #7 v2.5: WhatsApp — wa.me URL (tested on Samsung Galaxy) =====
async openWhatsApp(phone,msg){
  try{await App.flushDirty();}catch(e){_dbg('flush err:'+e);}
  var clean=phone.replace(/\D/g,'');
  var intl=clean.startsWith('0')?'972'+clean.substring(1):clean;
  _dbg('openWhatsApp: '+intl);
  var waUrl='https://wa.me/'+intl+'?text='+encodeURIComponent(msg);
  window.open(waUrl,'_system');
},

// ===== FIX v2.5: WhatsApp share — no phone, user picks contact =====
shareWhatsApp(msg){
  _dbg('shareWhatsApp (pick contact)');
  try{App.flushDirty();}catch(e){}
  var waUrl='https://wa.me/?text='+encodeURIComponent(msg);
  window.open(waUrl,'_system');
},

// ===== FIX #6 v2.5: Dial — location.href works reliably =====
openDialer(phone){
  try{App.flushDirty();}catch(e){}
  _dbg('openDialer: '+phone);
  window.location.href='tel:'+phone;
},
sendEmail(to,subj,body){window.open('mailto:'+to+'?subject='+encodeURIComponent(subj)+'&body='+encodeURIComponent(body),'_system')},

// ===== FIX #8 v2.5: Save to contacts — Cordova intent + wa.me fallback =====
saveToContacts(name,phone,jobName){
  _dbg('saveToContacts: '+name);
  try{App.flushDirty();}catch(e){}
  if(window.plugins&&window.plugins.intentShim){
    plugins.intentShim.startActivity({
      action:'android.intent.action.INSERT',
      type:'vnd.android.cursor.dir/contact',
      extras:{name:name+' - מועמד',phone:phone}
    },function(){Utils.toast('נפתח דף איש קשר','success');},
    function(e){
      _dbg('Contact intent err:'+JSON.stringify(e));
      // Fallback: open WhatsApp with unsaved number → shows "Add to contacts"
      var clean=phone.replace(/\D/g,'');
      var intl=clean.startsWith('0')?'972'+clean.substring(1):clean;
      window.open('https://wa.me/'+intl,'_system');
      Utils.toast('לחץ "הוסף לאנשי קשר" בווצאפ','info');
    });
  }else{
    // HTML fallback: wa.me shows "Add to contacts" for unsaved numbers
    var clean=phone.replace(/\D/g,'');
    var intl=clean.startsWith('0')?'972'+clean.substring(1):clean;
    window.open('https://wa.me/'+intl,'_system');
    Utils.toast('לחץ "הוסף לאנשי קשר" בווצאפ','info');
  }
},

// ===== FIX #3 v2.5: Calendar — INSERT intent (Samsung Calendar, no permission needed) =====
scheduleReminder(title,dateStr,timeStr){
  _dbg('scheduleReminder: '+title);
  var dt=new Date(dateStr+'T'+(timeStr||'09:00'));
  try{App.flushDirty();}catch(e){}
  // Primary: Cordova intent → Samsung Calendar with 5min reminder
  if(window.plugins&&window.plugins.intentShim){
    var startMs=dt.getTime();
    var endMs=startMs+3600000; // 1 hour
    plugins.intentShim.startActivity({
      action:'android.intent.action.INSERT',
      type:'vnd.android.cursor.item/event',
      extras:{
        'title':'Mini Genius: '+title,
        'beginTime':startMs,
        'endTime':endMs,
        'description':'תזכורת מ-Mini Genius',
        'allDay':false
      }
    },function(){Utils.toast('נפתח לוח שנה','success');},
    function(e){
      _dbg('Calendar intent err:'+JSON.stringify(e));
      // Fallback: .ics file
      Utils.generateIcsAndShare(title,dt);
    });
  }else{
    // No Cordova: .ics file download
    Utils.generateIcsAndShare(title,dt);
  }
},

// ===== Outlook .ics =====
generateIcsAndShare(title,startDate,endDate,location){
  if(!endDate)endDate=new Date(startDate.getTime()+3600000);
  function pad(n){return n<10?'0'+n:n;}
  function icsD(d){return d.getUTCFullYear()+pad(d.getUTCMonth()+1)+pad(d.getUTCDate())+'T'+pad(d.getUTCHours())+pad(d.getUTCMinutes())+'00Z';}
  var ics='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//MiniGenius//HR//HE\r\nBEGIN:VEVENT\r\n'
  +'UID:mg-'+Date.now()+'@app\r\nDTSTART:'+icsD(startDate)+'\r\nDTEND:'+icsD(endDate)+'\r\n'
  +'SUMMARY:'+title+'\r\n'+(location?'LOCATION:'+location+'\r\n':'')
  +'DESCRIPTION:Mini Genius HR\r\nBEGIN:VALARM\r\nTRIGGER:-PT30M\r\nACTION:DISPLAY\r\nDESCRIPTION:reminder\r\nEND:VALARM\r\n'
  +'END:VEVENT\r\nEND:VCALENDAR';
  var fn=title.replace(/[^א-תa-zA-Z0-9]/g,'_').substring(0,30)+'.ics';
  Utils.writeToCacheAndShare(fn,ics,'text/calendar','פגישה: '+title);
},

// ===== Export questionnaire as HTML (returns html string) =====
exportQuestionnaireAsWord(candidateName,sections,grade,result,notes){
  var html='<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8">'
  +'<style>body{font-family:David,Arial;direction:rtl;padding:30px;max-width:800px;margin:0 auto;}'
  +'h1{color:#1B2A4A;border-bottom:2px solid #1B2A4A;padding-bottom:8px;font-size:22px;}'
  +'h2{color:#2D4A7A;margin-top:24px;border-bottom:1px solid #ddd;padding-bottom:4px;font-size:16px;}'
  +'table{width:100%;border-collapse:collapse;margin:10px 0;}th,td{border:1px solid #ccc;padding:8px;text-align:right;font-size:14px;}'
  +'th{background:#1B2A4A;color:#fff;}.yes{color:#22c55e;font-weight:bold;}.no{color:#dc2626;font-weight:bold;}'
  +'.grade-box{display:inline-block;padding:10px 20px;font-size:24px;font-weight:bold;border-radius:8px;margin:8px 0;}'
  +'.pass{background:#f0fdf4;color:#16a34a;border:2px solid #22c55e;}'
  +'.fail{background:#fef2f2;color:#dc2626;border:2px solid #ef4444;}'
  +'.hesit{background:#fffbeb;color:#b45309;border:2px solid #f59e0b;}</style></head><body>'
  +'<h1>📋 שאלון טלפוני — '+Utils.escHtml(candidateName)+'</h1>'
  +'<p>תאריך: '+Utils.formatDate(new Date().toISOString())+'</p>';
  if(grade){
    var cls=result==='עבר'?'pass':result==='לא עבר'?'fail':'hesit';
    html+='<div class="grade-box '+cls+'">ציון: '+grade+'/7 | '+Utils.escHtml(result||'')+'</div>';
  }
  sections.forEach(function(sec){
    html+='<h2>'+Utils.escHtml(sec.title)+'</h2><table><tr><th>שאלה</th><th>תשובה</th></tr>';
    sec.fields.forEach(function(f){
      var v=Utils.escHtml(f.value||'-');
      if(f.value==='כן')v='<span class="yes">✓ כן</span>';
      else if(f.value==='לא')v='<span class="no">✗ לא</span>';
      html+='<tr><td>'+Utils.escHtml(f.label)+'</td><td>'+v+'</td></tr>';
      if(f.detail)html+='<tr><td></td><td>'+Utils.escHtml(f.detail)+'</td></tr>';
    });
    html+='</table>';
  });
  if(notes)html+='<h2>הערות</h2><p>'+Utils.escHtml(notes)+'</p>';
  html+='</body></html>';
  return html;
},

// ===== FIX #5: Export as DOCX (Word-compatible HTML) =====
exportQuestionnaireAsDocx(candidateName,sections,grade,result,notes){
  var bodyHtml=Utils.exportQuestionnaireAsWord(candidateName,sections,grade,result,notes);
  var docHtml='<html xmlns:o="urn:schemas-microsoft-com:office:office" '
  +'xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">'
  +'<head><meta charset="utf-8"><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->'
  +'<style>@page{size:A4;margin:2cm;}body{font-family:David,Arial;direction:rtl;}'
  +'table{width:100%;border-collapse:collapse;}th,td{border:1px solid #000;padding:6px;text-align:right;}'
  +'th{background:#1B2A4A;color:#fff;}</style></head><body>'
  +bodyHtml.replace(/.*<body>/,'').replace(/<\/body>.*/,'')+'</body></html>';
  var fn='שאלון_'+candidateName.replace(/\s/g,'_')+'_'+Utils.today()+'.doc';
  Utils.writeToCacheAndShare(fn,docHtml,'application/msword','שאלון טלפוני — '+candidateName);
},

// ===== Share helpers =====
shareViaPlugin(msg,subj,files){
  if(window.plugins&&window.plugins.socialsharing){
    window.plugins.socialsharing.shareWithOptions({
      message:msg||'',subject:subj||'Mini Genius',files:files||[]
    },function(){_dbg('Share OK');},function(e){_dbg('Share err:'+e);});
  }else{Utils.toast('שיתוף לא זמין','danger');}
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
escHtml(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;')},
id(eid){return document.getElementById(eid)},
toast(msg,type){var t=document.createElement('div');t.className='toast toast-'+(type||'info');t.textContent=msg;
document.body.appendChild(t);setTimeout(function(){t.classList.add('show')},10);
setTimeout(function(){t.classList.remove('show');setTimeout(function(){t.remove()},300)},2500);}
};
