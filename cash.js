/* Phase 5: collect payment, returns, expenses, day closing + money counter, night load list, reports */
let PEND=[],PAY=[],RET=[],EXP=[],CLS=[],cashUn=false,RT=null,CNT={};
const DENOMS=[500,200,100,50,20,10,5,1,0.5,0.25],sum=(a,k)=>a.reduce((s,x)=>s+(+x[k]||0),0);
function loadCash(){
 loadData();
 if(!cUnsub)cUnsub=(ME.role=='admin'?db.collection('customers'):db.collection('customers').where('owner','==',U.uid)).onSnapshot(s=>{CUST=s.docs.map(d=>({id:d.id,...d.data()}));drawCust()},()=>{cUnsub=null});
 if(cashUn)return;cashUn=true;const own=c=>ME.role=='admin'?db.collection(c):db.collection(c).where('uid','==',U.uid);
 [['payments',x=>PAY=x],['returns',x=>{RET=x.filter(r=>r.status!='pending'&&r.status!='rejected');PEND=x.filter(r=>r.status=='pending')}],['expenses',x=>EXP=x],['closings',x=>CLS=x]].forEach(([n,f])=>own(n).onSnapshot(s=>{f(s.docs.map(d=>({id:d.id,...d.data()})));window.cashRedraw&&$('#cw2')&&cashRedraw();$('#cb')&&drawCust();window.tgDraw&&tgDraw()},()=>{cashUn=false}));
}
function calc(uid,day){
 const o=ORDS.filter(x=>x.uid==uid&&x.status!='cancelled'&&isoD(x.at)==day),cash=sum(o.filter(x=>x.pay=='cash'),'total'),credit=sum(o.filter(x=>x.pay=='credit'),'total'),
  p=PAY.filter(x=>x.uid==uid&&x.day==day),old=sum(p.filter(x=>x.method=='cash'),'amount'),bank=sum(p.filter(x=>x.method!='cash'),'amount'),
  r=RET.filter(x=>x.uid==uid&&x.day==day&&x.status!='cancelled'),ret=sum(r,'total'),cr=sum(r.filter(x=>x.refund=='cash'),'total'),e=sum(EXP.filter(x=>x.uid==uid&&x.day==day),'amount'),
  sale=cash+credit,net=sale-ret,recv=cash+old+bank;
 return {n:o.length,sale,ret,net,cash,credit,old,bank,recv,cr,e,hand:recv-bank-cr-e,bal:net-recv};
}
/* ---- collect payment (from customer card) ---- */
function collectPay(c){
 if(dayLocked())return;let m='';const due=typeof custBal=='function'?custBal(c.id):0,w=ov(),num=()=>+dg($('#pam').value).replace(/[^\d.]/g,'')||0;OV=null;
 w.innerHTML=`<div class=wrap style="padding-top:16px"><h2>Collect payment</h2><div class=mu>${esc(c.nameEn)}</div>${due>0?`<div class=card><div class=mu>Balance due</div><b style="font-size:22px">${money(due)}</b> <button class="b s ghost" id=pfu type=button>Use full balance</button></div>`:''}
 <label class=mu>Amount received</label><input id=pam type=number inputmode=decimal placeholder="0.00" style="font-size:22px;min-height:56px">
 <label class=mu>How was it paid? Choose one</label><div class=row id=pmt style="gap:8px">${[['cash','Cash'],['bank','Bank transfer'],['card','Card']].map(([k,l])=>`<button class="b ghost" type=button data-m=${k} style="flex:1;min-height:64px;margin:4px 0">${l}</button>`).join('')}</div>
 <button class=b id=psv disabled>Enter the amount and choose how it was paid</button><button class="b ghost" id=pcx>Cancel</button></div>`;
 const upd=()=>{const a=num(),b=$('#psv'),L={cash:'cash',bank:'bank transfer',card:'card'};b.disabled=!(a>0&&m);b.textContent=a>0&&m?'Save '+money(a)+' received by '+L[m]:'Enter the amount and choose how it was paid';
  w.querySelectorAll('[data-m]').forEach(x=>{const on=x.dataset.m==m;x.style.background=on?'var(--pr)':'transparent';x.style.color=on?'#fff':'var(--pr)'})};
 $('#pam').oninput=upd;if($('#pfu'))$('#pfu').onclick=()=>{$('#pam').value=due;upd()};
 $('#pmt').onclick=e=>{const k=e.target.dataset.m;if(k){m=k;upd()}};$('#pcx').onclick=closeOv;
 $('#psv').onclick=()=>{const a=num();if(!(a>0&&m))return;$('#psv').disabled=true;db.collection('payments').add({cid:c.id,cname:c.nameEn,uid:U.uid,by:ME.name,amount:a,method:m,at:Date.now(),day:todayD()});closeOv();alert('Payment saved: '+money(a)+' ('+m+')')};
 upd();
}
/* ---- sales return ---- */
function returnStart(c){loadCash();RT={c,lines:[],reason:'Damaged',refund:'cash'};retView()}
function retView(){
 OV=retView;const m=ov(),vp=CFG.vatPercent||0,sub=RT.lines.reduce((s,l)=>s+l.qty*l.rate,0),tot=sub*(1+vp/100);
 m.innerHTML=`<div class=row style="padding:8px 0"><h2 style=flex:1>Return: ${esc(RT.c.nameEn)}</h2><button class="b s ghost" id=rx>Close</button></div>
 <div class=row><input id=rbc placeholder="Scan or type barcode, then Enter"><button class="b s" id=rsc>Scan</button></div><input id=rad placeholder="Search product"><div id=rres></div>
 ${RT.lines.map((l,i)=>`<div class=card><b>${esc(l.name)}</b><div class=row><button class="b s" data-a=unit data-i=${i}>${l.unit}</button><input type=number min=1 value=${l.qty} data-a=qty data-i=${i} style="width:90px"><span class=mu>x ${money(l.rate)}</span><b style="margin-left:auto">${money(l.qty*l.rate)}</b><button class="b s ghost" data-a=del data-i=${i}>Remove</button></div></div>`).join('')}
 <div class=card><div class=row><span style=flex:1>Subtotal</span><b>${money(sub)}</b></div><div class=row><span style=flex:1><b>Return total (VAT ${vp}%)</b></span><b>${money(tot)}</b></div>
 <select id=rrs>${['Damaged','Expired','Melted','Wrong item','Customer refused','Other'].map(x=>`<option ${x==RT.reason?'selected':''}>${x}</option>`).join('')}</select>
 <select id=rrf><option value=cash ${RT.refund=='cash'?'selected':''}>Cash refund</option><option value=credit ${RT.refund=='credit'?'selected':''}>Credit note</option><option value=replace ${RT.refund=='replace'?'selected':''}>Replace (no money)</option></select></div>
 <button class=b id=rsv>Save return</button>`;
 $('#rx').onclick=closeOv;$('#rsc').onclick=()=>scanCam(retAdd);$('#rbc').onkeydown=e=>{if(e.key=='Enter'&&e.target.value.trim()){retAdd(e.target.value);e.target.value=''}};
 $('#rad').oninput=e=>{const q=e.target.value.trim().toLowerCase(),r=q?PRODS.filter(p=>(p.name+' '+p.sl).toLowerCase().includes(q)).slice(0,6):[];$('#rres').innerHTML=r.map(p=>`<div class=card data-p=${p.id}>${p.sl||''}. ${esc(p.name)}</div>`).join('')};
 $('#rres').onclick=e=>{const c=e.target.closest('[data-p]');if(c){RT.lines.push(mkLine(PRODS.find(p=>p.id==c.dataset.p),'pcs',1));retView()}};
 m.onchange=e=>{const d=e.target.dataset;if(d.a=='qty'){RT.lines[d.i].qty=Math.max(1,Math.round(+e.target.value)||1);return retView()}if(e.target.id=='rrs')RT.reason=e.target.value;if(e.target.id=='rrf')RT.refund=e.target.value};
 m.onclick=e=>{const d=e.target.dataset,l=RT.lines[d.i];if(d.a=='del'){RT.lines.splice(d.i,1);retView()}if(d.a=='unit'){const p=PRODS.find(x=>x.id==l.pid),av=avail(p),n=av[(av.indexOf(l.unit)+1)%av.length];l.unit=n;l.rate=+(p.rate*pu(p,n)).toFixed(2);retView()}};
 $('#rsv').onclick=async()=>{if(dayLocked())return;if(!RT.lines.length)return alert('Add at least one product.');const n=(+localStorage.getItem('retn_'+U.uid)||0)+1,no='R'+ME.name.replace(/[^A-Za-z]/g,'').slice(0,2).toUpperCase()+n;
  const o={no,cid:RT.c.id,cname:RT.c.nameEn,lines:RT.lines.map(l=>({pid:l.pid,name:l.name,unit:l.unit,qty:l.qty,rate:l.rate})),sub,vatPct:vp,total:+tot.toFixed(2),reason:RT.reason,refund:RT.refund,uid:U.uid,by:ME.name,at:Date.now(),day:todayD(),status:(CFG.returnLimit>0&&tot>CFG.returnLimit&&ME.role!='admin')?'pending':'saved'};
  if(o.status=='pending')alert('This return is above '+CFG.returnLimit+'. It needs admin approval before it counts in your closing.');
  db.collection('returns').add(o);localStorage.setItem('retn_'+U.uid,n);closeOv();
  const t=`*RETURN #${no}* – ${new Date().toLocaleDateString('en-GB')}\nCustomer: ${o.cname}\n`+o.lines.map((l,i)=>`${i+1}. ${l.name} – ${l.qty} ${l.unit} × ${money(l.rate)} = ${money(l.qty*l.rate)}`).join('\n')+`\nReason: ${o.reason}\n*TOTAL: ${money(o.total)}* (${o.refund})\nBy: ${o.by}`;
  open('https://wa.me/'+(RT.c.phone?'966'+ph(RT.c.phone).slice(1):'')+'?text='+encodeURIComponent(t))};
}
function retAdd(code){const f=byCode(bcn(code));if(!f)return alert('Product not found');RT.lines.push(mkLine(f.p,f.unit,1));retView()}
/* ---- day closing + money counter ---- */
function closingView(el,member){
 loadCash();const day=todayD(),mc=ME.role=='admin'||(ME.perms&&ME.perms.moneyCounter);let c,cl,tot,hand;
 const row=(l,v,b)=>`<div class=row><span style=flex:1>${l}</span>${b?`<b>${money(v)}</b>`:money(v)}</div>`;
 const draw=()=>{c=calc(U.uid,day);cl=CLS.find(x=>x.id==U.uid+'_'+day);tot=DENOMS.reduce((s,d)=>s+d*(CNT[d]||0),0);hand=Math.round(c.hand*100)/100;const counted=cl?cl.counted:(CNT.manual!==undefined&&CNT.manual!==''?+CNT.manual:tot),diff=Math.round((counted-hand)*100)/100;
 el.innerHTML=`<div id=cw2>${member?'<button class="b s ghost" onclick="sig=\'\';route()">Back</button>':''}<h2>Day closing, ${day}</h2>${(()=>{const k=OPEN.filter(o=>o.uid==U.uid).length;return k?`<div class=card style="border-color:var(--or)">${k} open order${k>1?'s':''} not billed yet. They do not count in today's sales.</div>`:''})()}
 <div class=card>${row('Total sale ('+c.n+' orders)',c.sale)}${row('Sales return','-'+money(c.ret).replace('-',''),0)}${row('Net sale',c.net,1)}<hr>
 ${row('Cash received',c.recv)}<div class=mu>cash sales ${money(c.cash)}, old balance collected ${money(c.old)}, bank/card ${money(c.bank)}</div>
 ${row('Cash return',c.cr)}${row('Balance (uncollected)',c.bal)}${row('Expense',c.e)}<hr>${row('Cash to hand over',hand,1)}</div>
 <button class="b s ghost" id=cex ${cl?'disabled':''}>Add expense</button>
 ${cl?`<div class=card>${row('Counted cash',cl.counted)}${row('Difference',cl.diff,1)}<span class="tag ${cl.status=='received'?'approved':'pending'}">${cl.status}</span><div class=mu>${esc(cl.note||'')}</div><p class=mu>This day is closed. Only the admin can reopen it.</p></div>`:`
 ${mc?`<div class=card><h2>Money counter</h2>${DENOMS.map(d=>`<div class=row style="margin:3px 0;${CNT[d]?'':'opacity:.55'}"><b style=width:60px>${d}</b><button class="b s ghost" data-d=${d} data-s=-1>-</button><input type=number min=0 value=${CNT[d]||''} placeholder=0 data-d=${d} style="width:80px"><button class="b s ghost" data-d=${d} data-s=1>+</button><span style="margin-left:auto">${money(d*(CNT[d]||0))}</span></div>`).join('')}
 <div class=row><b style=flex:1>Total counted</b><b>${money(tot)}</b></div><button class="b s ghost" id=cwa>Share count on WhatsApp</button><button class="b s ghost" id=ccl>Clear</button></div>`:''}
 ${!mc||CFG.manualTotal==1?`<input id=cmn type=number placeholder="Type total counted cash" value="${CNT.manual??''}">`:''}
 <div class=card>${row('Cash to hand over',hand)}${row('Counted cash',counted)}<div class=row><span style=flex:1>Difference</span><b class="${diff==0?'':'err'}">${money(diff)} ${diff==0?'Match':diff<0?'Short':'Over'}</b></div>
 <input id=cnt placeholder="Note (needed if there is a difference)"><button class=b id=csb>Submit closing</button></div>`}</div>`;
 const dd=$('#cwa');if(dd)dd.onclick=()=>open('https://wa.me/?text='+encodeURIComponent(`*CASH COUNT* – ${new Date().toLocaleDateString('en-GB')} – ${ME.name}\n`+DENOMS.filter(d=>CNT[d]).map(d=>`${d} × ${CNT[d]} = ${money(d*CNT[d])}`).join('\n')+`\n*TOTAL: ${money(tot)}*`));
 if($('#ccl'))$('#ccl').onclick=()=>{if(confirm('Clear all counts?')){CNT={};closingView(el,member)}};
 if($('#cex'))$('#cex').onclick=async()=>{if(dayLocked())return;const a=+dg(prompt('Expense amount')||'').replace(/[^\d.]/g,'');if(!a)return;await db.collection('expenses').add({uid:U.uid,by:ME.name,amount:a,note:prompt('What for? (fuel, parking...)')||'',at:Date.now(),day})};
 el.onclick=e=>{const d=e.target.dataset;if(d.s){CNT[d.d]=Math.max(0,(CNT[d.d]||0)+ +d.s);closingView(el,member)}};
 el.onchange=e=>{const d=e.target.dataset;if(d.d){CNT[d.d]=Math.max(0,Math.round(+e.target.value)||0);closingView(el,member)}if(e.target.id=='cmn'){CNT.manual=e.target.value;closingView(el,member)}};
 if($('#csb'))$('#csb').onclick=async()=>{const note=$('#cnt').value.trim(),counted=CNT.manual!==undefined&&CNT.manual!==''?+CNT.manual:tot,diff=Math.round((counted-hand)*100)/100;
  if(diff!=0&&!note)return alert('Add a note to explain the difference.');if(counted==0&&hand>0&&!confirm('Counted cash is 0. Submit anyway?'))return;
  if(!navigator.onLine)return alert('You are offline. Connect to the internet, then submit, so the admin gets the full day.');
  const ok=await Promise.race([db.waitForPendingWrites().then(()=>1),new Promise(r=>setTimeout(()=>r(0),8000))]);if(!ok)return alert('Some items are still syncing. Wait a moment and try again.');
  await db.doc('closings/'+U.uid+'_'+day).set({uid:U.uid,by:ME.name,day,...c,hand,counted,diff,note,breakdown:DENOMS.filter(d=>CNT[d]).map(d=>[d,CNT[d]]),status:'submitted',at:Date.now()});CNT={};alert('Day closed.')};
 };
 window.cashRedraw=draw;draw();
}
/* ---- night load list (suggestion from visit history) ---- */
function dueOn(c,t,ds){if(c.extraDate==ds)return true;if(c.skipDate==ds)return false;
 if(c.visitType=='monthly'){const m=CUST.filter(x=>x.visitType=='monthly').sort((a,b)=>a.createdAt-b.createdAt),i=m.findIndex(x=>x.id==c.id);return t.getDate()==1+Math.floor(i*26/Math.max(1,m.length))}return c.day==t.getDay()}
function loadListView(el,member){
 loadCash();const draw=()=>{const t=new Date();t.setDate(t.getDate()+1);const ds=isoD(+t),cs=CUST.filter(c=>dueOn(c,t,ds)),tot={};
 cs.forEach(c=>{const s=stats(c.id).cust;for(const pid in s){const k=pid+'|'+s[pid].unit;tot[k]=(tot[k]||0)+Math.max(1,Math.round(s[pid].q/s[pid].n))}});
 const buf=1+(CFG.loadBuffer||0)/100,L=Object.keys(tot).map(k=>{const [pid,u]=k.split('|'),p=PRODS.find(x=>x.id==pid);return {n:p?p.name:'?',u,q:Math.ceil(tot[k]*buf)}}).sort((a,b)=>a.n.localeCompare(b.n));
 const txt=`*LOAD LIST* – ${DAYS[t.getDay()]} ${ds}\n${cs.length} customers, +${CFG.loadBuffer}% buffer\n`+L.map((x,i)=>`${i+1}. ${x.n} – ${x.q} ${x.u}`).join('\n');
 el.innerHTML=`<div id=cw2>${member?'<button class="b s ghost" onclick="sig=\'\';route()">Back</button>':''}<h2>Load list for ${DAYS[t.getDay()]} ${ds}</h2><p class=mu>${cs.length} customers planned. Built from their past orders, plus ${CFG.loadBuffer}% buffer. It improves every week.</p>
 ${L.map(x=>`<div class=card><div class=row><b style=flex:1>${esc(x.n)}</b><b>${x.q} ${x.u}</b><input type=checkbox style="width:22px;margin:0 0 0 10px"></div></div>`).join('')||'<div class=card>No history yet for tomorrow\'s customers.</div>'}
 <button class=b id=lsh>Share on WhatsApp</button></div>`;
 $('#lsh').onclick=()=>open('https://wa.me/?text='+encodeURIComponent(txt))};window.cashRedraw=draw;draw();
}
/* ---- admin: reports and closing review ---- */
async function reportsView(el){
 loadCash();let day=todayD();
 const draw=async()=>{const us=(await db.collection('users').get()).docs.map(d=>({id:d.id,...d.data()})).filter(u=>u.status=='approved');
 const rows=us.map(u=>({u,c:calc(u.id,day),cl:CLS.find(x=>x.id==u.id+'_'+day)})),T=k=>sum(rows.map(r=>r.c),k);
 el.innerHTML=`<div id=cw2><input type=date id=rd value="${day}">${PEND.map(r=>`<div class=card style="border-color:var(--or)"><b>Return #${esc(r.no)} needs approval</b><div>${esc(r.cname)}, ${esc(r.by)}: ${money(r.total)} (${r.refund}, ${esc(r.reason)})</div><button class="b s grn" data-a=rapp data-id=${r.id}>Approve</button><button class="b s red" data-a=rrej data-id=${r.id}>Reject</button></div>`).join('')}<div class=card><b>All salesmen, ${day}</b><div class=mu>Sale ${money(T('sale'))}, returns ${money(T('ret'))}, net ${money(T('net'))}, cash to hand over ${money(T('hand'))}, expenses ${money(T('e'))}</div></div>
 ${rows.map(({u,c,cl})=>`<div class=card><div class=row><b style=flex:1>${esc(u.name)}</b><span class="tag ${cl?cl.status=='received'?'approved':'pending':'rejected'}">${cl?cl.status:'not closed'}</span></div>
 <div class=mu>${esc(u.branch||'')}</div><div>Sale ${money(c.sale)} (${c.n} orders), return ${money(c.ret)}, cash received ${money(c.recv)}, expense ${money(c.e)}</div>
 <div><b>To hand over ${money(c.hand)}</b>${cl?`, counted ${money(cl.counted)}, <span class="${cl.diff==0?'':'err'}">diff ${money(cl.diff)}</span>`:''}</div>${cl&&cl.note?`<div class=mu>${esc(cl.note)}</div>`:''}
 ${cl&&cl.status=='submitted'?`<button class="b s grn" data-a=rcv data-id=${cl.id}>Mark received</button>`:''}${cl?`<button class="b s ghost" data-a=reopen data-id=${cl.id}>Reopen day</button>`:''}</div>`).join('')}</div>`;
 $('#rd').onchange=e=>{day=e.target.value;draw()};
 el.onclick=async e=>{const d=e.target.dataset;if(d.a=='rapp'||d.a=='rrej'){await db.doc('returns/'+d.id).update({status:d.a=='rapp'?'saved':'rejected',approvedBy:ME.name});logAct('Return '+(d.a=='rapp'?'approved':'rejected'),d.id)}if(d.a=='rcv')await db.doc('closings/'+d.id).update({status:'received',receivedAt:Date.now()});if(d.a=='reopen'&&confirm('Reopen this closing? The salesman can submit again.'))await db.doc('closings/'+d.id).delete();logAct('Day reopened',d.id)}};
 window.cashRedraw=draw;draw();
}
function cashAdmin(el){el.innerHTML=`<div class=tabs><button data-k=c>My closing</button><button data-k=r>Reports</button><button data-k=l>Load list</button><button data-k=e>Export</button><button data-k=a>Activity</button></div><div id=cs></div>`;
 const go=k=>{const b=$('#cs');k=='c'?closingView(b):k=='r'?reportsView(b):k=='e'?exportView(b):k=='a'?activityView(b):loadListView(b)};el.querySelector('.tabs').onclick=e=>e.target.dataset.k&&go(e.target.dataset.k);go('r')}
