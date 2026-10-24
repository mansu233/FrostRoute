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
 if(!i||!us[i-1])return;await db.doc('customers/'+c.id).update({owner:us[i-1].id,ownerName:us[i-1].name,reassignedAt:Date.now()});alert('Customer moved to '+us[i-1].name);
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
