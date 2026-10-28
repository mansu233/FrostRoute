/* Phase 3: customers, camera reading (free on-device OCR), visit plan, GPS check-in, reminders */
let CUST=[],REM=[],cUnsub=null,rUnsub=null,CV={tab:'today',q:'',pos:null};
const DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const isoD=t=>new Date(t-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,10),todayD=()=>isoD(Date.now());
const ph=s=>{let d=dg(s).replace(/\D/g,'');if(d.startsWith('966'))d='0'+d.slice(3);if(d.length==9&&d[0]=='5')d='0'+d;return d};
const hav=(a,b,c,d)=>{const r=x=>x*Math.PI/180,h=Math.sin(r(c-a)/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(r(d-b)/2)**2;return Math.round(12742000*Math.asin(Math.sqrt(h)))};
const getPos=()=>new Promise((ok,no)=>navigator.geolocation?navigator.geolocation.getCurrentPosition(p=>ok({lat:p.coords.latitude,lng:p.coords.longitude,acc:Math.round(p.coords.accuracy)}),no,{enableHighAccuracy:true,timeout:15000}):no());
/* ---- auto translation (first draft, marked auto) ---- */
const W={'علي':'Ali','حسن':'Hassan','محمد':'Mohammed','أحمد':'Ahmed','احمد':'Ahmed','بن':'bin','سهلي':'Sahli','أسواق':'Aswaq','اسواق':'Aswaq','للتجارة':'Trading','التجارة':'Trading','مؤسسة':'Est.','بقالة':'Grocery','سوبرماركت':'Supermarket','مطعم':'Restaurant','شركة':'Company','مخبز':'Bakery','الكبير':'Al Kabeer','عبدالله':'Abdullah','عبد':'Abdul','الله':'Allah','سعد':'Saad','خالد':'Khalid','فهد':'Fahd','سلمان':'Salman','ابو':'Abu','أبو':'Abu','مركز':'Center','حلويات':'Sweets','هايبر':'Hyper','طريق':'Road','شارع':'Street','الملك':'King','الأمير':'Prince'};
const WR={};for(const k in W)WR[W[k].toLowerCase()]=k;
const A2E={ا:'a',أ:'a',إ:'i',آ:'a',ب:'b',ت:'t',ث:'th',ج:'j',ح:'h',خ:'kh',د:'d',ذ:'th',ر:'r',ز:'z',س:'s',ش:'sh',ص:'s',ض:'d',ط:'t',ظ:'z',ع:'a',غ:'gh',ف:'f',ق:'q',ك:'k',ل:'l',م:'m',ن:'n',ه:'h',ة:'a',و:'w',ي:'y',ى:'a',ئ:'e',ؤ:'o',ء:''};
const E2A={sh:'ش',kh:'خ',th:'ث',gh:'غ',b:'ب',t:'ت',j:'ج',h:'ه',d:'د',r:'ر',z:'ز',s:'س',f:'ف',q:'ق',k:'ك',l:'ل',m:'م',n:'ن',w:'و',y:'ي',p:'ب',v:'ف',c:'ك',g:'ج',x:'كس'};
const toEn=s=>s.split(/\s+/).map(w=>W[w]||(w.replace(/[\u0600-\u06FF]/g,c=>A2E[c]??'')).replace(/^./,c=>c.toUpperCase())).join(' ').trim();
const toAr=s=>s.split(/\s+/).map(w=>WR[w.toLowerCase()]||(/^[aeiou]/i.test(w)?'ا':'')+w.toLowerCase().replace(/sh|kh|th|gh|./g,m=>E2A[m]??'')).join(' ').trim();
const isAr=s=>/[\u0600-\u06FF]/.test(s||'');
/* ---- free on-device OCR (Tesseract.js, loads on first use, needs internet once) ---- */
async function ocr(file){
 if(!window.Tesseract)await new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';s.onload=ok;s.onerror=()=>no(new Error('Needs internet the first time'));document.head.appendChild(s)});
 const w=await Tesseract.createWorker('eng+ara');const r=await w.recognize(file);await w.terminate();return dg(r.data.text);
}
function parseCard(t){
 const L=t.split('\n').map(x=>x.trim()).filter(Boolean),o={};
 o.vat=(t.match(/\b3\d{13}3\b/)||[])[0];o.cr=(t.replace(/\s/g,'').match(/(?:س\.?ت|CR)[^\d]{0,6}(\d{10})/)||[])[1];
 const p=t.replace(/[\s-]/g,'').match(/(?:\+?966|0)?5\d{8}/);if(p)o.phone=ph(p[0]);
 const bad=/ضريب|فاتورة|invoice|tax|vat|الرقم|رقم|التاريخ/i;
 o.name=L.find(l=>isAr(l)&&l.length>6&&!bad.test(l)&&!/طريق|شارع/.test(l));
 const ad=L.find(l=>/طريق|شارع|حي |road|street/i.test(l));if(ad)o.address=isAr(ad)?toEn(ad):ad;
 return o;
}
async function readPack(file){
 let bc='';if('BarcodeDetector' in window)try{const b=await new BarcodeDetector({formats:['ean_13','ean_8','upc_a','upc_e','code_128','code_39']}).detect(await createImageBitmap(file));if(b.length)bc=b[0].rawValue}catch(e){}
 const t=await ocr(file),sz=(t.match(/(\d+(?:\.\d+)?)\s?(kg|g|gm|ml|l|ltr|oz|pcs)\b/i)||[]),
  ln=t.split('\n').map(x=>x.replace(/[^A-Za-z0-9&.' -]/g,'').replace(/\s+/g,' ').trim()).filter(x=>/[A-Za-z]{3,}/.test(x)&&x.length<=30&&!/ingredient|nutrition|keep|store|best before|expiry|produced|made in|www|\.com/i.test(x)),
  nm=ln.slice(0,3).join(' ').replace(sz[0]||'@@','').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()).trim();
 if(!bc){const m=t.replace(/\s/g,'').match(/\d{8,14}/);bc=m?m[0]:''}
 return {name:nm,size:(sz[0]||'').replace(/\s/g,'').toUpperCase(),barcode:bc};
}
/* ---- plan logic ---- */
function dueToday(c){
 const d=new Date(),t=todayD();if(c.extraDate==t)return true;if(c.skipDate==t)return false;
 if(c.visitType=='monthly'){const m=CUST.filter(x=>x.visitType=='monthly').sort((a,b)=>a.createdAt-b.createdAt),i=m.findIndex(x=>x.id==c.id);return d.getDate()==1+Math.floor(i*26/Math.max(1,m.length))}
 return c.day==d.getDay();
}
/* ---- main view ---- */
function customersView(el,member){
 el.innerHTML=`${member?'<button class="b s ghost" onclick="sig=\'\';route()">Back</button>':''}
 <div class=tabs>${['today','all','rem',...(member&&!(ME.perms&&ME.perms.viewRanking)?[]:['rank'])].map(k=>`<button data-t=${k} class="${CV.tab==k?'on':''}">${{today:'Today',all:'All customers',rem:'Reminders',rank:'Ranking'}[k]}</button>`).join('')}</div>
 <div id=cb></div>`;
 el.querySelector('.tabs').onclick=e=>{if(e.target.dataset.t){CV.tab=e.target.dataset.t;customersView(el,member)}};
 loadCash();
 startRem();
 drawCust();
}
function drawCust(){
 const b=$('#cb');if(!b)return;const admin=ME.role=='admin';if(CV.tab=='rank')return rankView(b);
 if(CV.tab=='rem')return remTab(b);
 let a=CUST.slice();const q=CV.q.toLowerCase(),qd=ph(CV.q);
 if(CV.tab=='today'){a=a.filter(dueToday)}
 else if(q)a=a.filter(c=>(`${c.nameEn} ${c.nameAr} ${c.sup} ${c.address} ${c.code} ${c.vat}`).toLowerCase().includes(q)||(qd.length>=3&&(c.phone||'').includes(qd)));
 if(CV.pos)a.forEach(c=>c._d=c.lat?hav(CV.pos.lat,CV.pos.lng,c.lat,c.lng):1e9),a.sort((x,y)=>x._d-y._d);else a.sort((x,y)=>(x.nameEn||'').localeCompare(y.nameEn||''));
 const lim=CFG.dailyVisitLimit;
 b.innerHTML=`<div class=row><input id=cq placeholder="Search name, phone, supervisor, address, code" value="${esc(CV.q)}"><button class="b s" id=cn style="width:auto">Nearest</button></div>
 <button class="b s" data-a=new>Add customer</button>${CV.tab=='today'&&a.length>lim?`<p class=err>${a.length} visits planned, over the daily limit of ${lim}.</p>`:''}
 <p class=mu>${a.length} customers${CV.tab=='today'?' planned for today':''}</p>`+a.map(c=>{const rc=REM.filter(r=>r.cid==c.id&&remActive(r)).length;
 return `<div class=card>${c.photo?`<img src="${c.photo}" style="float:right;width:64px;height:64px;object-fit:cover;border-radius:10px;margin-left:8px">`:''}<b>${esc(c.nameEn||'')}</b> <span dir=rtl>${esc(c.nameAr||'')}</span>
 <div class=mu>${esc(c.address||'')}${c.sup?', supervisor '+esc(c.sup):''}${c._d<1e9?', '+(c._d>999?(c._d/1000).toFixed(1)+' km':c._d+' m'):''}</div><div class=mu>${esc(c.phone||'')} ${c.code?'Code '+esc(c.code):''}</div>
 ${c.lat?'':'<span class="tag pending">No location</span> '}${c.lead?'<span class="tag admin">Lead</span> ':''}${custBal(c.id)>0?`<span class="tag rejected">Due ${money(custBal(c.id))}</span> `:''}${rc?`<button class="tag rejected" data-a=remv data-id=${c.id} style="border:0;cursor:pointer">${rc} reminder${rc>1?'s':''}</button> `:''}
 <span class=mu>${c.visitType=='monthly'?'Monthly':DAYS[c.day]||''}${c.visitType=='skip'?' (skip a week when set)':''}${c.lastVisit?', last visit '+c.lastVisit:''}${admin&&c.ownerName?', '+esc(c.ownerName):''}</span><div>
 <button class="b s grn" data-a=in data-id=${c.id}>Check in</button><button class="b s ghost" data-a=nav data-id=${c.id}>Navigate</button>
 <a class="b s ghost" style="display:inline-block;text-decoration:none" href="tel:${esc(c.phone)}">Call</a><a class="b s ghost" style="display:inline-block;text-decoration:none" href="https://wa.me/${c.phone?'966'+c.phone.slice(1):''}">WhatsApp</a>
 <button class="b s ghost" data-a=rem data-id=${c.id}>Reminder</button><button class="b s ghost" data-a=today data-id=${c.id}>Random visit today</button>
 <button class="b s ghost" data-a=skip data-id=${c.id}>Skip next week</button><button class="b s ghost" data-a=prof data-id=${c.id}>Profile</button>${admin?`<button class="b s ghost" data-a=reas data-id=${c.id}>Reassign</button>`:''}<button class="b s ghost" data-a=edit data-id=${c.id}>Edit</button></div>
 ${admin||(ME.perms&&ME.perms.createOrders)?`<div><button class="b s" data-a=shelf data-id=${c.id}>Shelf Check</button><button class="b s" data-a=order data-id=${c.id}>New order</button></div>`:''}
 <div>${admin||(ME.perms&&ME.perms.collectPayments)?`<button class="b s grn" data-a=pay data-id=${c.id}>Collect payment</button>`:''}${admin||(ME.perms&&ME.perms.makeReturns)?`<button class="b s red" data-a=ret data-id=${c.id}>Return</button>`:''}</div></div>`}).join('');
 $('#cq').oninput=e=>{CV.q=e.target.value;const p=e.target.selectionStart;drawCust();const n=$('#cq');n.focus();n.setSelectionRange(p,p)};
 $('#cn').onclick=async()=>{try{CV.pos=await getPos();drawCust()}catch(x){alert('Turn on GPS and allow location for this site.')}};
 b.onclick=async e=>{const d=e.target.dataset,c=CUST.find(x=>x.id==d.id);if(!d.a)return;
  if(d.a=='new')return custForm({});if(d.a=='prof')return profileView(c);if(d.a=='reas')return reassign(c);if(d.a=='shelf')return shelfStart(c);if(d.a=='order')return orderStart(c);if(d.a=='pay')return collectPay(c);if(d.a=='ret')return returnStart(c);if(d.a=='edit')return custForm(c);
  if(d.a=='nav')return c.lat?open(`https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`):alert('No saved location. Check in at the shop to save it.');
  if(d.a=='today')return db.doc('customers/'+c.id).update({extraDate:todayD()});
  if(d.a=='skip'){const n=new Date();n.setDate(n.getDate()+((c.day-n.getDay()+7)%7||7));await db.doc('customers/'+c.id).update({skipDate:isoD(+n)});return alert('Skipped on '+isoD(+n)+'. The weekly plan returns after that.')}
  if(d.a=='rem')return remView(c);if(d.a=='remv')return remView(c);
  if(d.a=='in')return checkIn(c);
 };
}
/* ---- add / edit form ---- */
async function custForm(c){
 const m=document.createElement('div');m.style.cssText='position:fixed;inset:0;background:var(--bg);overflow:auto;z-index:20;padding:12px;padding-top:calc(12px + env(safe-area-inset-top))';
 const f=(i,l,v='',x='')=>`<label class=mu>${l}</label><input id=c_${i} value="${esc(v)}" ${x}>`;
 m.innerHTML=`<div class=wrap><h2>${c.id?'Edit':'Add'} customer</h2>
 <img id=c_pv src="${c.photo||''}" style="display:${c.photo?'block':'none'};width:100%;max-height:220px;object-fit:cover;border-radius:14px;margin:6px 0"><div class=row><button class="b ghost" id=c_cam type=button>Shop photo: take</button><button class="b ghost" id=c_gl type=button>From gallery</button></div><input id=c_file type=file accept="image/*" capture=environment hidden><input id=c_gal type=file accept="image/*" hidden>
 ${f('en','Shop name (English)',c.nameEn)}${f('ar','Shop name (Arabic)',c.nameAr,'dir=rtl')}${f('code','Customer code',c.code)}${f('vat','VAT No',c.vat)}${f('cr','CR No (س.ت)',c.cr)}
 ${f('ph','Phone (required)',c.phone,'inputmode=tel')}${f('sup','Supervisor name',c.sup)}${f('ad','Address (English, required)',c.address)}
 <label class=mu>Visit</label><select id=c_vt><option value=weekly>Weekly</option><option value=skip>Weekly, can skip a week</option><option value=monthly>Monthly (app picks the day)</option></select>
 <select id=c_day>${DAYS.map((d,i)=>`<option value=${i}>${d}</option>`).join('')}</select>
 <p class=mu id=c_loc>${c.lat?'Location saved (±'+(c.acc||'?')+' m)':'Getting GPS location…'}</p><button class="b s ghost" id=c_rl type=button>Retake location</button>
 <p class=err id=c_er></p><button class=b id=c_sv>Save customer</button><button class="b ghost" id=c_x>Cancel</button></div>`;
 document.body.appendChild(m);draftBind(m,'cust',c.id);let SP=null;const g=i=>$('#c_'+i).value.trim();let pos=c.lat?{lat:c.lat,lng:c.lng,acc:c.acc}:null;
 $('#c_vt').value=c.visitType||'weekly';$('#c_day').value=c.day??new Date().getDay();$('#c_x').onclick=()=>{draftClear();m.remove()};
 const loc=async()=>{try{pos=await getPos();$('#c_loc').textContent='Location saved (±'+pos.acc+' m)'+(pos.acc>100?'. Weak GPS, try outside.':'')}catch(e){$('#c_loc').textContent='No location yet. It can be saved at the next check-in.'}};
 $('#c_rl').onclick=loc;if(!c.lat)loc();
 $('#c_en').onblur=()=>{if(g('en')&&(!g('ar')||m.autoAr))$('#c_ar').value=toAr(g('en')),m.autoAr=1};
 $('#c_ar').onblur=()=>{if(g('ar')&&(!g('en')||m.autoEn))$('#c_en').value=toEn(g('ar')),m.autoEn=1};
 const rdp=async e=>{const fl=e.target.files[0];if(!fl)return;const d=await shrink(fl);if(d){SP=d;$('#c_pv').src=d;$('#c_pv').style.display='block'}};
 $('#c_file').onchange=rdp;$('#c_gal').onchange=rdp;$('#c_cam').onclick=()=>pickFile($('#c_file'));$('#c_gl').onclick=()=>pickFile($('#c_gal'));
 $('#c_sv').onclick=async()=>{
  const er=t=>$('#c_er').textContent=t;let en=g('en'),ar=g('ar'),ad=g('ad');
  if(!en&&!ar)return er('Enter the shop name in English or Arabic.');if(!en)en=toEn(ar);if(!ar)ar=toAr(en);
  const phone=ph(g('ph'));if(phone.length<9)return er('A phone number is required.');if(!ad)return er('Address is required.');if(isAr(ad))ad=toEn(ad);
  const code=g('code'),vat=dg(g('vat')),cr=dg(g('cr')),oth=CUST.filter(x=>x.id!=c.id);
  if(code&&oth.find(x=>x.code==code))return er('This customer code already exists. Open the existing shop.');
  const dup=oth.filter(x=>(vat&&x.vat==vat)||(cr&&x.cr==cr)||x.phone==phone);
  if(dup.length){if(!code)return er('Possible duplicate of '+dup[0].nameEn+'. Add a different customer code to save it as another shop.');
   if(!confirm('Possible duplicate of '+dup[0].nameEn+' (same VAT, CR or phone). Save anyway as a different shop?'))return}
  const d={nameEn:en,nameAr:ar,code,vat,cr,phone,sup:g('sup'),address:ad,photo:SP||c.photo||'',visitType:$('#c_vt').value,day:+$('#c_day').value,updatedAt:Date.now()};
  if(pos){d.lat=pos.lat;d.lng=pos.lng;d.acc=pos.acc}
  if(!c.id){d.owner=U.uid;d.ownerName=ME.name;d.createdAt=Date.now();d.lead=true}
  try{await(c.id?db.doc('customers/'+c.id).update(d):db.collection('customers').add(d));draftClear();m.remove()}catch(x){er(x.message)}
 };
}

async function checkIn(c){try{const p=await getPos();let dist=null,ok=false;
   if(c.lat){dist=hav(p.lat,p.lng,c.lat,c.lng);ok=dist<=CFG.gpsRadius}
   else if(confirm('This shop has no saved location. Save your current position as the shop location?'))await db.doc('customers/'+c.id).update({lat:p.lat,lng:p.lng,acc:p.acc});
   await db.collection('visits').add({cid:c.id,cname:c.nameEn||c.nameAr,uid:U.uid,at:Date.now(),lat:p.lat,lng:p.lng,dist,verified:ok});
   await db.doc('customers/'+c.id).update({lastVisit:todayD()});
   const r=REM.filter(x=>x.cid==c.id&&remActive(x)).map(x=>x.text);
   alert((dist==null?'Checked in. Location saved.':ok?'Verified, '+dist+' m from the shop.':'Not at shop, '+dist+' m away (warning only).')+(r.length?'\nReminders:\n- '+r.join('\n- '):''))}catch(x){alert('GPS unavailable. Check-in not saved. Turn on location.')}}
