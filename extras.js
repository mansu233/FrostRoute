/* Phase 6: ledger and balance, ranking A/B/C/Dormant, customer profile, nearby popup */
let NB={on:0,last:0,dis:{}};
const rnd=n=>Math.round(n*100)/100;
function custBal(cid){
 const o=sum(ORDS.filter(x=>x.cid==cid&&x.status!='cancelled'&&x.pay=='credit'),'total'),p=sum(PAY.filter(x=>x.cid==cid),'amount'),
  r=sum(RET.filter(x=>x.cid==cid&&x.refund=='credit'&&x.status!='cancelled'),'total');return rnd(o-p-r);
}
function ledgerRows(cid){
 const e=[];
 ORDS.filter(x=>x.cid==cid&&x.status!='cancelled').forEach(o=>e.push({t:o.at,type:`Order #${o.no} (${o.pay})`,dr:o.pay=='credit'?o.total:0,cr:0,info:o.pay=='cash'?'paid in cash':''}));
 PAY.filter(x=>x.cid==cid).forEach(p=>e.push({t:p.at,type:`Payment (${p.method})`,dr:0,cr:p.amount,info:''}));
 RET.filter(x=>x.cid==cid&&x.status!='cancelled').forEach(r=>e.push({t:r.at,type:`Return #${r.no} (${r.refund})`,dr:0,cr:r.refund=='credit'?r.total:0,info:r.refund!='credit'?'no balance effect':''}));
 e.sort((a,b)=>a.t-b.t);let b=0;e.forEach(x=>{b+=x.dr-x.cr;x.bal=rnd(b)});return e;
}
function ledgerView(c){
 OV=()=>ledgerView(c);const m=ov(),rows=ledgerRows(c.id).reverse(),bal=custBal(c.id);
 m.innerHTML=`<div class=row style="padding:8px 0"><h2 style=flex:1>Ledger: ${esc(c.nameEn)}</h2><button class="b s ghost" id=lx>Close</button></div>
 <div class=card><div class=mu>Balance due</div><div style="font-size:26px;font-weight:700" class="${bal>0?'err':''}">${money(bal)} SAR</div><div class=mu>Credit orders minus payments and credit notes</div></div>
 ${rows.map(r=>`<div class=card><div class=row><b style=flex:1>${esc(r.type)}</b><span>${r.dr?'+'+money(r.dr):r.cr?'-'+money(r.cr):'0.00'}</span></div>
 <div class=mu>${new Date(r.t).toLocaleString()} ${r.info?', '+r.info:''}</div><div class=mu>Running balance ${money(r.bal)}</div></div>`).join('')||'<div class=card>No entries yet.</div>'}`;
 $('#lx').onclick=closeOv;
}
/* ---- customer profile (opened from the nearby popup or the card) ---- */
function profileView(c){
 loadCash();OV=()=>profileView(c);const m=ov(),bal=custBal(c.id),last=ORDS.find(o=>o.cid==c.id&&o.status!='cancelled'),rem=REM.filter(r=>r.cid==c.id&&remActive(r));
 const b=(a,l,k='ghost')=>`<button class="b ${k}" data-a=${a}>${l}</button>`;
 m.innerHTML=`<div class=row style="padding:8px 0"><h2 style=flex:1>${esc(c.nameEn)}</h2><button class="b s ghost" id=px>Close</button></div>
 <div class=card>${c.photo?`<img src="${c.photo}" style="width:100%;max-height:200px;object-fit:cover;border-radius:12px;margin-bottom:8px">`:''}<div dir=rtl>${esc(c.nameAr||'')}</div><div class=mu>${esc(c.address||'')}</div><div>${esc(c.phone||'')} ${c.sup?', supervisor '+esc(c.sup):''}</div>
 <div class=mu>${c.code?'Code '+esc(c.code)+', ':''}${c.visitType=='monthly'?'Monthly visit':DAYS[c.day]+' visit'}${c.lastVisit?', last visit '+c.lastVisit:''}</div>
 <div class=row style="margin-top:8px"><div style=flex:1><div class=mu>Balance due</div><b class="${bal>0?'err':''}">${money(bal)}</b></div><div style=flex:1><div class=mu>Last order</div><b>${last?new Date(last.at).toLocaleDateString():'none'}</b>${last?`<div class=mu>${money(last.total)}</div>`:''}</div></div>
 ${rem.length?`<div class=err data-a=remv style="cursor:pointer">${rem.map(r=>esc(r.text)).join('; ')} (tap to manage)</div>`:''}</div>
 ${b('in','Check in','grn')}${b('ledger','Open ledger')}${b('shelf','Shelf Check','')}${b('order','New order','')}
 ${b('pay','Collect payment')}${b('ret','Return')}${b('remv','Reminders')}${b('hist','Sales history')}${b('nav','Navigate')}`;
 $('#px').onclick=closeOv;
 m.onclick=e=>{const a=e.target.dataset.a;if(!a)return;
  if(a=='in')return checkIn(c);if(a=='ledger')return ledgerView(c);if(a=='hist')return custHistory(c);if(a=='remv')return remView(c);if(a=='nav')return c.lat?open(`https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`):alert('No saved location.');
  closeOv();if(a=='shelf')shelfStart(c);if(a=='order')orderStart(c);if(a=='pay')collectPay(c);if(a=='ret')returnStart(c)};
}
/* ---- ranking ---- */
function rankView(el){
 const days=CV.days||90,now=Date.now(),a=now-days*864e5,b=a-days*864e5,dorm=(CFG.dormantDays||45)*864e5;
 const L=CUST.map(c=>{const os=ORDS.filter(x=>x.cid==c.id&&x.status!='cancelled'),inP=os.filter(x=>x.at>=a),pr=os.filter(x=>x.at<a&&x.at>=b),rt=RET.filter(x=>x.cid==c.id&&x.status!='cancelled'&&x.at>=a);
  return {c,sale:sum(inP,'total')-sum(rt,'total'),n:inP.length,prev:sum(pr,'total'),last:os.length?Math.max(...os.map(x=>x.at)):0,bal:custBal(c.id)}}).sort((x,y)=>y.sale-x.sale);
 const N=L.length;L.forEach((r,i)=>r.g=(!r.last||now-r.last>dorm)?'Dormant':i<N*.2?'A':i<N*.5?'B':'C');
 const col={A:'approved',B:'admin',C:'pending',Dormant:'rejected'};
 el.innerHTML=`<div class=row>${[30,90,365].map(d=>`<button class="b s ${d==days?'':'ghost'}" data-days=${d}>${d==365?'12 months':d+' days'}</button>`).join('')}</div>
 <p class=mu>Ranked by sales (with VAT, minus returns). Top 20% A, next 30% B, rest C. Dormant means no order for ${CFG.dormantDays||45} days.</p>
 ${L.map((r,i)=>`<div class=card data-c=${r.c.id}><div class=row><b style=width:28px>${i+1}</b><div style=flex:1><b>${esc(r.c.nameEn)}</b><div class=mu>${r.n} orders, last ${r.last?new Date(r.last).toLocaleDateString():'never'}${r.bal>0?', due '+money(r.bal):''}</div></div>
 <div style=text-align:right><b>${money(r.sale)}</b> ${r.sale>r.prev*1.1?'<span style=color:var(--gr)>&#9650;</span>':r.sale<r.prev*.9?'<span style=color:var(--rd)>&#9660;</span>':'&#9644;'}<div><span class="tag ${col[r.g]}">${r.g}</span></div></div></div></div>`).join('')||'<div class=card>No customers yet.</div>'}`;
 el.onclick=e=>{const d=e.target.dataset;if(d.days){CV.days=+d.days;return rankView(el)}const c=e.target.closest('[data-c]');if(c)custHistory(CUST.find(x=>x.id==c.dataset.c))};
}
async function custHistory(c){
 OV=()=>custHistory(c);const m=ov(),os=ORDS.filter(o=>o.cid==c.id&&o.status!='cancelled'),now=new Date(),mo=[];
 for(let i=5;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1),k=d.getFullYear()*12+d.getMonth();mo.push({l:d.toLocaleString('en',{month:'short'}),v:sum(os.filter(o=>{const x=new Date(o.at);return x.getFullYear()*12+x.getMonth()==k}),'total')})}
 const mx=Math.max(1,...mo.map(x=>x.v)),tp={};os.forEach(o=>o.lines.forEach(l=>tp[l.name]=(tp[l.name]||0)+l.qty));
 const top=Object.entries(tp).sort((a,b)=>b[1]-a[1]).slice(0,5);
 m.innerHTML=`<div class=row style="padding:8px 0"><h2 style=flex:1>History: ${esc(c.nameEn)}</h2><button class="b s ghost" id=hx>Close</button></div>
 <div class=card><b>Monthly sales</b><div class=row style="align-items:flex-end;height:110px;margin-top:8px">${mo.map(x=>`<div style="flex:1;text-align:center"><div style="height:${Math.round(x.v/mx*80)}px;background:var(--pr);border-radius:4px 4px 0 0"></div><div class=mu>${x.l}</div><div class=mu style=font-size:11px>${Math.round(x.v)}</div></div>`).join('')}</div></div>
 <div class=card><div class=row><span style=flex:1>Orders</span><b>${os.length}</b></div><div class=row><span style=flex:1>Average order</span><b>${os.length?money(sum(os,'total')/os.length):'0.00'}</b></div><div class=row><span style=flex:1>Balance due</span><b>${money(custBal(c.id))}</b></div><div class=row id=vv><span style=flex:1>Visits (last 90 days)</span><b>...</b></div></div>
 <div class=card><b>Top products</b>${top.map(t=>`<div class=row><span style=flex:1>${esc(t[0])}</span><b>${t[1]}</b></div>`).join('')||'<div class=mu>No orders yet.</div>'}</div>
 <button class=b id=hl>Open ledger</button>`;
 $('#hx').onclick=closeOv;$('#hl').onclick=()=>ledgerView(c);
 try{let q=db.collection('visits').where('cid','==',c.id);if(ME.role!='admin')q=q.where('uid','==',U.uid);const s=await q.get(),from=Date.now()-90*864e5,v=s.docs.map(d=>d.data()).filter(x=>x.at>=from);
  const e=$('#vv b');if(e)e.textContent=v.length+' ('+v.filter(x=>x.verified).length+' verified)'}catch(x){}
}
/* ---- nearby popup (works while the app is open and unlocked) ---- */
function startNearby(){
 if(NB.on||!navigator.geolocation||!(ME.role=='admin'||(ME.perms&&ME.perms.manageCustomers)))return;NB.on=1;loadCash();
 navigator.geolocation.watchPosition(p=>{
  if(!unlocked||Date.now()-NB.last<20000)return;NB.last=Date.now();
  const n=CUST.filter(c=>c.lat).map(c=>({c,d:hav(p.coords.latitude,p.coords.longitude,c.lat,c.lng)})).filter(x=>x.d<=(CFG.gpsRadius||150)&&!(NB.dis[x.c.id]>Date.now())).sort((a,b)=>a.d-b.d).slice(0,3);
  let bar=$('#nb');if(!n.length){bar&&bar.remove();return}
  if(!bar){bar=document.createElement('div');bar.id='nb';bar.style.cssText='position:fixed;left:10px;right:10px;top:calc(8px + env(safe-area-inset-top));z-index:40;background:var(--card);border:2px solid var(--pr);border-radius:12px;padding:10px;box-shadow:0 6px 20px rgba(0,0,0,.25)';document.body.appendChild(bar)}
  bar.innerHTML=n.map(x=>`<div class=row style="margin:3px 0"><div style=flex:1><b>You're near ${esc(x.c.nameEn)}</b><div class=mu>${x.d} m away</div></div><button class="b s" data-o=${x.c.id}>Open</button><button class="b s ghost" data-x=${x.c.id}>X</button></div>`).join('');
  bar.onclick=e=>{const d=e.target.dataset;if(d.o){bar.remove();profileView(CUST.find(c=>c.id==d.o))}if(d.x){NB.dis[d.x]=Date.now()+30*6e4;bar.remove()}};
 },()=>{NB.on=0},{enableHighAccuracy:true,maximumAge:15000,timeout:20000});
}

/* reminders: edit, delete, show-from and hide-after dates */
const remState=r=>{const t=todayD();return r.done?'done':r.from&&r.from>t?'scheduled':r.until&&r.until<t?'expired':'active'};
const remActive=r=>remState(r)=='active',REMT=['Bill / document','Product','Order call','Other'];
function startRem(){if(!rUnsub)rUnsub=(ME.role=='admin'?db.collection('reminders'):db.collection('reminders').where('uid','==',U.uid)).onSnapshot(s=>{REM=s.docs.map(d=>({id:d.id,...d.data()}));drawCust();window.remRedraw&&remRedraw()},()=>{rUnsub=null})}
const remCard=r=>{const st=remState(r),col={active:'rejected',scheduled:'admin',expired:'disabled',done:'approved'}[st];
 return `<div class=card style="${st=='expired'||st=='done'?'opacity:.7':''}"><div class=row><b style=flex:1>${esc(r.cname||'')}</b><span class="tag ${col}">${st}</span></div><div>${esc(r.text)}</div>
 <div class=mu>${esc(r.type||'Other')}, shows from ${r.from||r.due||'today'}${r.until?', hides after '+r.until:', no end date'}</div>
 <button class="b s ghost" data-r=edit data-id=${r.id}>Edit</button><button class="b s red" data-r=del data-id=${r.id}>Delete</button><button class="b s ${r.done?'ghost':'grn'}" data-r=done data-id=${r.id}>${r.done?'Reopen':'Done'}</button></div>`};
const remAct=e=>{const d=e.target.dataset;if(!d.r)return;const r=REM.find(x=>x.id==d.id);if(!r)return;
 if(d.r=='del'&&confirm('Delete this reminder?'))db.doc('reminders/'+r.id).delete();
 if(d.r=='done')db.doc('reminders/'+r.id).update({done:!r.done});
 if(d.r=='edit')remForm(CUST.find(c=>c.id==r.cid)||{id:r.cid,nameEn:r.cname},r)};
const remSort=a=>{const o={active:0,scheduled:1,expired:2,done:3};return a.slice().sort((x,y)=>o[remState(x)]-o[remState(y)]||(x.from||x.due||'').localeCompare(y.from||y.due||''))};
function remTab(b){startRem();b.innerHTML=remSort(REM).map(remCard).join('')||'<div class=card>No reminders yet. Open a customer and tap Reminder.</div>';b.onclick=remAct}
function remView(c){startRem();OV=()=>remView(c);window.remRedraw=()=>$('#rmv')&&remView(c);const m=ov();
 m.innerHTML=`<div id=rmv><div class=row style="padding:8px 0"><h2 style=flex:1>Reminders: ${esc(c.nameEn)}</h2><button class="b s ghost" id=rvx>Close</button></div><button class=b id=rva>Add reminder</button>${remSort(REM.filter(r=>r.cid==c.id)).map(remCard).join('')||'<div class=card>No reminders for this customer.</div>'}</div>`;
 $('#rvx').onclick=closeOv;$('#rva').onclick=()=>remForm(c);m.onclick=remAct}
function remForm(c,r){
 const w=document.createElement('div');w.style.cssText='position:fixed;inset:0;background:var(--bg);overflow:auto;z-index:30;padding:12px;padding-top:calc(12px + env(safe-area-inset-top))';
 w.innerHTML=`<div class=wrap><h2>${r?'Edit':'New'} reminder: ${esc(c.nameEn||'')}</h2><label class=mu>What to remember</label><textarea id=rt rows=3 style="width:100%;padding:10px;border:1.5px solid var(--bd);border-radius:12px;background:var(--card);color:var(--tx);font:inherit">${esc(r?r.text:'')}</textarea>
 <label class=mu>Type</label><select id=ry>${REMT.map(x=>`<option ${r&&r.type==x?'selected':''}>${x}</option>`).join('')}</select>
 <label class=mu>Show from</label><input type=date id=rf value="${(r&&(r.from||r.due))||todayD()}"><label class=mu>Hide after (empty = keep showing until done)</label><input type=date id=ru value="${(r&&r.until)||''}">
 <p class=err id=re></p><button class=b id=rs>Save reminder</button><button class="b ghost" id=rc>Cancel</button></div>`;
 document.body.appendChild(w);$('#rc').onclick=()=>w.remove();
 $('#rs').onclick=()=>{const t=$('#rt').value.trim(),f=$('#rf').value||todayD(),u=$('#ru').value;if(!t)return $('#re').textContent='Write the reminder.';if(u&&u<f)return $('#re').textContent='"Hide after" cannot be before "Show from".';
  const d={text:t,type:$('#ry').value,from:f,until:u,due:f};
  if(r)db.doc('reminders/'+r.id).update(d);else db.collection('reminders').add({...d,cid:c.id,cname:c.nameEn||c.nameAr,uid:U.uid,by:ME.name,done:false,at:Date.now()});
  w.remove()};
}
