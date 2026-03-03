'use strict';
const Utils={
STAGES:[
{id:1,key:'leads',name:'לידים',icon:'📌'},
{id:2,key:'phone',name:'ראיון טלפוני',icon:'📞'},
{id:3,key:'homeExam',name:'מטלה ביתית',icon:'📝'},
{id:4,key:'interview',name:'ראיון אישי',icon:'🤝'},
{id:5,key:'officeExam',name:'מטלה משרדית',icon:'🏢'},
{id:6,key:'advInterview',name:'ראיון מתקדם',icon:'🌟'},
{id:7,key:'ojt',name:'OJT סופי',icon:'🏭'}
],
PRIORITIES:{high:'גבוה',medium:'בינוני',low:'נמוך'},
PRIORITY_COLORS:{high:'#e74c3c',medium:'#f39c12',low:'#27ae60'},
STATUSES:{active:'פעיל',pass:'עבר',fail:'לא עבר',hesitation:'התלבטות',stopped:'הופסק',accepted:'התקבל',frozen:'הקפאה'},
STATUS_COLORS:{active:'#3498db',pass:'#27ae60',fail:'#e74c3c',hesitation:'#f39c12',stopped:'#95a5a6',accepted:'#2ecc71',frozen:'#9b59b6'},
getStage(id){return this.STAGES.find(s=>s.id===id)},
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
saveToContacts(name,phone,jobName){
try{const vcard='BEGIN:VCARD\nVERSION:3.0\nFN:'+name+' - מועמד\nTEL:'+phone+'\nORG:'+jobName+'\nNOTE:מועמד - '+jobName+'\nEND:VCARD';
const blob=new Blob([vcard],{type:'text/vcard'});const url=URL.createObjectURL(blob);
const a=document.createElement('a');a.href=url;a.download=name+'.vcf';a.click();URL.revokeObjectURL(url);
Utils.toast('קובץ איש קשר נוצר','success');}catch(e){Utils.toast('שגיאה','danger');}},
addToCalendar(title,date,time){try{
const dt=new Date(date+'T'+(time||'09:00'));
const url='https://www.google.com/calendar/event?action=TEMPLATE&text='+encodeURIComponent(title)+'&dates='+dt.toISOString().replace(/[-:]/g,'').split('.')[0]+'Z';
window.open(url,'_system');}catch(e){Utils.toast('הוספה ידנית ללוח שנה','info');}},
shareHtml(html,title){
if(navigator.share){navigator.share({title:title||'Mini Genius',text:html}).catch(()=>{});}
else{const blob=new Blob([html],{type:'text/html'});const url=URL.createObjectURL(blob);
const a=document.createElement('a');a.href=url;a.download=(title||'report')+'.html';a.click();}},
escHtml(s){if(!s)return'';return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')},
id(eid){return document.getElementById(eid)},
toast(msg,type){const t=document.createElement('div');t.className='toast toast-'+(type||'info');t.textContent=msg;
document.body.appendChild(t);setTimeout(()=>t.classList.add('show'),10);
setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),300)},2500);}
};
