/* Phase 7: announcements, monthly target, CSV export, reassign customer, closed-day lock */
function annDraw(){const a=$('#ann');if(a)a.innerHTML=CFG.announcement?`<div class=card style="border-color:var(--pr)"><b>Announcement</b><div>${esc(CFG.announcement)}</div></div>`:''}
function tgDraw(){
 const e=$('#tg');if(!e)return;if(!ME||!ME.target){e.innerHTML='';return}
 const n=new Date(),m=n.getFullYear()*12+n.getMonth(),inM=t=>{const d=new Date(t);return d.getFullYear()*12+d.getMonth()==m};
 const v=sum(ORDS.filter(o=>o.uid==U.uid&&o.status!='cancelled'&&inM(o.at)),'total')-sum(RET.filter(r=>r.uid==U.uid&&r.status!='cancelled'&&inM(r.at)),'total'),p=Math.max(0,Math.min(100,Math.round(v/ME.target*100)));
 e.innerHTML=`<div class=card><div class=row><b style=flex:1>Monthly target</b><b>${p}%</b></div><div style="height:10px;background:var(--bd);border-radius:6px;margin:6px 0"><div style="height:10px;width:${p}%;background:var(--gr);border-radius:6px"></div></div><div class=mu>${money(v)} of ${money(ME.target)} (sales with VAT, minus returns)</div></div>`;
}
function dayLocked(){const l=CLS.find(x=>x.id==U.uid+'_'+todayD());if(l)alert('Today is already closed. Ask the admin to reopen the day to add more.');return !!l}
async function reassign(c){
 const us=(await db.collection('users').where('status','==','approved').get()).docs.map(d=>({id:d.id,...d.data()}));
 const i=+prompt('Move "'+c.nameEn+'" to which salesman?\n'+us.map((u,k)=>(k+1)+'. '+u.name+(u.branch?' ('+u.branch+')':'')).join('\n'));
 if(!i||!us[i-1])return;await db.doc('customers/'+c.id).update({owner:us[i-1].id,ownerName:us[i-1].name,reassignedAt:Date.now()});logAct('Customer reassigned',c.nameEn+' to '+us[i-1].name);alert('Customer moved to '+us[i-1].name);
}
function dl(name,rows){
 const csv='\uFEFF'+rows.map(r=>r.map(x=>'"'+String(x??'').replace(/"/g,'""')+'"').join(',')).join('\n'),a=document.createElement('a');
 a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=name+'-'+todayD()+'.csv';a.click();
}
function exportView(el){
 loadCash();const dt=t=>new Date(t).toISOString().slice(0,16).replace('T',' ');
 el.innerHTML=`<p class=mu>Download CSV files and open them in Excel. Keep a copy outside Firebase, for example in Google Drive. Cost prices are never exported.</p>`+
 [['customers','Customers'],['products','Products (same columns as the import)'],['orders','Orders (one row per line)'],['payments','Payments'],['returns','Returns'],['closings','Day closings']].map(([k,l])=>`<button class="b ghost" data-k=${k}>${l}</button>`).join('');
 el.onclick=e=>{const k=e.target.dataset.k;if(!k)return;
  if(k=='customers')dl(k,[['name_en','name_ar','code','vat','cr','phone','supervisor','address','lat','lng','visit_type','visit_day','owner'],...CUST.map(c=>[c.nameEn,c.nameAr,c.code,c.vat,c.cr,c.phone,c.sup,c.address,c.lat,c.lng,c.visitType,c.day,c.ownerName])]);
  if(k=='products')dl(k,[['sl','name','category','barcode','rate','packet_qty','packet_barcode','carton_qty','carton_barcode','active'],...PRODS.map(p=>{const u=p.units||{};return [p.sl,p.name,p.category,(u.pcs||{}).bc,p.rate,(u.packet||{}).qty,(u.packet||{}).bc,(u.carton||{}).qty,(u.carton||{}).bc,p.active!==false]})]);
  if(k=='orders')dl(k,[['order','date','customer','salesman','status','payment','product','unit','qty','rate','line_total','order_total_with_vat'],...ORDS.flatMap(o=>o.lines.map(l=>[o.no,dt(o.at),o.cname,o.by,o.status,o.pay,l.name,l.unit,l.qty,l.rate,l.total,o.total]))]);
  if(k=='payments')dl(k,[['date','customer','salesman','method','amount'],...PAY.map(p=>[dt(p.at),p.cname,p.by,p.method,p.amount])]);
  if(k=='returns')dl(k,[['return','date','customer','salesman','refund','reason','total'],...RET.map(r=>[r.no,dt(r.at),r.cname,r.by,r.refund,r.reason,r.total])]);
  if(k=='closings')dl(k,[['day','salesman','total_sale','sales_return','net_sale','cash_received','cash_return','expense','to_hand_over','counted','difference','status','note'],...CLS.map(c=>[c.day,c.by,c.sale,c.ret,c.net,c.recv,c.cr,c.e,c.hand,c.counted,c.diff,c.status,c.note])]);
 };
}

function logAct(a,d){try{db.collection('activity').add({uid:U.uid,by:ME.name,action:a,detail:d||'',at:Date.now()})}catch(e){}}
async function activityView(el){
 el.innerHTML='<p class=mu>Loading…</p>';
 const s=await db.collection('activity').orderBy('at','desc').limit(100).get();
 el.innerHTML='<p class=mu>Last 100 actions: user changes, product and rate changes, cancelled orders, reopened days, reassigned customers.</p>'+
 (s.docs.map(d=>d.data()).map(a=>`<div class=card><div class=row><b style=flex:1>${esc(a.action)}</b><span class=mu>${new Date(a.at).toLocaleString()}</span></div><div>${esc(a.detail)}</div><div class=mu>by ${esc(a.by)}</div></div>`).join('')||'<div class=card>Nothing logged yet.</div>');
}

/* member's own report */
let MR={p:'month'};
function myReport(el,member){
 loadCash();
 const draw=()=>{const n=new Date(),from=MR.p=='today'?new Date(n.getFullYear(),n.getMonth(),n.getDate()).getTime():MR.p=='week'?Date.now()-7*864e5:new Date(n.getFullYear(),n.getMonth(),1).getTime();
  const o=ORDS.filter(x=>x.uid==U.uid&&x.status!='cancelled'&&x.at>=from),r=RET.filter(x=>x.uid==U.uid&&x.status!='cancelled'&&x.at>=from),p=PAY.filter(x=>x.uid==U.uid&&x.at>=from),cu={},pr={};
  o.forEach(x=>{cu[x.cname]=(cu[x.cname]||0)+x.total;x.lines.forEach(l=>pr[l.name]=(pr[l.name]||0)+l.qty)});
  const top=m=>Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,5),sale=sum(o,'total'),ret=sum(r,'total'),row=(l,v)=>`<div class=row><span style=flex:1>${l}</span><b>${v}</b></div>`;
  el.innerHTML=`<div id=cw2>${member?'<button class="b s ghost" onclick="sig=\'\';route()">Back</button>':''}<h2>My report</h2>
  <div class=row>${[['today','Today'],['week','7 days'],['month','This month']].map(x=>`<button class="b s ${MR.p==x[0]?'':'ghost'}" data-p=${x[0]}>${x[1]}</button>`).join('')}</div>
  <div class=card>${row('Orders',o.length)}${row('Total sale (with VAT)',money(sale))}${row('Sales return','-'+money(ret).replace('-',''))}${row('Net sale',money(sale-ret))}${row('Average order',o.length?money(sale/o.length):'0.00')}${row('Payments collected',money(sum(p,'amount')))}</div>
  <div class=card><b>Top customers</b>${top(cu).map(t=>row(esc(t[0]),money(t[1]))).join('')||'<div class=mu>No orders in this period.</div>'}</div>
  <div class=card><b>Top products (quantity)</b>${top(pr).map(t=>row(esc(t[0]),t[1])).join('')||'<div class=mu>No orders in this period.</div>'}</div></div>`;
  el.onclick=e=>{if(e.target.dataset.p){MR.p=e.target.dataset.p;draw()}}};
 window.cashRedraw=draw;draw();
}

/* admin Home dashboard */
async function homeView(el){
 loadCash();
 const draw=async()=>{const t=todayD(),o=ORDS.filter(x=>x.status!='cancelled'&&isoD(x.at)==t),ret=RET.filter(x=>x.day==t&&x.status!='cancelled');
  let pend=0;try{pend=(await db.collection('users').where('status','==','pending').get()).size}catch(e){}
  const unc=[...new Set(o.map(x=>x.uid))].filter(u=>!CLS.find(c=>c.id==u+'_'+t)).length,tile=(l,v,go)=>`<div class=tile ${go?`data-go=${go} style="cursor:pointer"`:''}><div class=mu>${l}</div><b style="font-size:22px">${v}</b></div>`;
  el.innerHTML=`<div id=cw2><h2>Today, ${t}</h2><div class=grid>${tile('Sales (with VAT)',money(sum(o,'total')))}${tile('Orders',o.length,'ord')}${tile('Users waiting approval',pend,'users')}${tile('Days not closed yet',unc,'cash')}${tile('Returns to approve',PEND.length,'cash')}${tile('Returns today',money(sum(ret,'total')))}</div></div>`;
  el.onclick=e=>{const g=e.target.closest('[data-go]');if(g){if(g.dataset.go=='users')filter='pending';tab=g.dataset.go;adminView()}}};
 window.cashRedraw=draw;draw();
}
