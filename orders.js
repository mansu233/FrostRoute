/* Phase 4: Shelf Check, order builder, scanning, cancel and undo, WhatsApp text, history */
let OPEN=[],ORDS=[],oUnsub=null,OD=null,SC=null,OV=null,UNDO=null;
const canRate=()=>ME.role=='admin'||(ME.perms&&ME.perms.editRate),dKey=()=>'draft_'+U.uid;
const saveD=()=>{try{localStorage.setItem(dKey(),JSON.stringify({...OD,sel:[],hl:[]}))}catch(e){}};
const pu=(p,u)=>u=='pcs'?1:(p.units&&p.units[u]&&p.units[u].qty)||1;
const avail=p=>['pcs',...Object.keys(p.units||{}).filter(k=>k!='pcs'&&p.units[k]&&p.units[k].qty)];
const odraw=()=>{window.tgDraw&&tgDraw();window.cashRedraw&&$('#cw2')&&cashRedraw();typeof drawCust=='function'&&$('#cb')&&drawCust();return odrawX()};const odrawX=()=>OV?OV():(window.ordersRedraw&&$('#ow')&&ordersRedraw());
function loadData(){
 if(!pUnsub)pUnsub=db.collection('products').onSnapshot(s=>{PRODS=s.docs.map(d=>({id:d.id,...d.data()}));drawProds();odraw()},()=>{pUnsub=null});
 if(!oUnsub){const c=db.collection('orders');oUnsub=(ME.role=='admin'?c:c.where('uid','==',U.uid)).onSnapshot(s=>{const all=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>b.at-a.at);ORDS=all.filter(o=>o.status!='open');OPEN=all.filter(o=>o.status=='open');odraw()},()=>{oUnsub=null})}
}
function stats(cid){const fast={},cust={};ORDS.filter(o=>o.status!='cancelled').forEach(o=>(o.lines||[]).forEach(l=>{fast[l.pid]=(fast[l.pid]||0)+1;if(cid&&o.cid==cid){const x=cust[l.pid]||(cust[l.pid]={n:0,q:0,unit:'pcs'});x.n++;x.q+=l.qty;x.unit=l.unit}}));return{fast,cust}}
function ov(){let m=$('#ov');if(!m){m=document.createElement('div');m.id='ov';m.style.cssText='position:fixed;inset:0;background:var(--bg);overflow:auto;z-index:20;padding:0 12px 90px;padding-top:calc(8px + env(safe-area-inset-top))';document.body.appendChild(m)}return m}
const closeOv=()=>{const m=$('#ov');m&&m.remove();OV=null;window.ordersRedraw&&$('#ow')&&ordersRedraw()};
const mkLine=(p,unit,qty,st)=>({pid:p.id,sl:p.sl||'',name:p.name,unit,qty,rate:+(p.rate*pu(p,unit)).toFixed(2),edited:false,fresh:qty==1&&!st,st:st||''});
const byCode=c=>{const p=PRODS.find(p=>(p.bcs||[]).includes(c));return p?{p,unit:Object.keys(p.units||{}).find(k=>p.units[k]&&p.units[k].bc==c)||'pcs'}:null};
/* ---- entry points ---- */
function ordersHome(el,member){
 loadCash();OV=null;
 const draft=localStorage.getItem(dKey()),dr=draft&&JSON.parse(draft);
 const draw=()=>{el.innerHTML=`${member?'<button class="b s ghost" onclick="sig=\'\';route()">Back</button>':''}
 <button class="b s" id=ow>New walk-in order</button>${dr&&dr.lines.length?'<button class="b s grn" id=or>Resume draft ('+dr.lines.length+' lines)</button>':''}
 ${openHtml()}<h2 style="margin-top:10px">Bills and orders</h2>`+(ORDS.length?ORDS.slice(0,60).map(o=>`<div class=card><div class=row data-a=bill data-id=${o.id} style="cursor:pointer"><b style=flex:1>#${esc(o.no)} ${esc(o.cname||'Walk-in')}</b><span class="tag ${o.status=='cancelled'?'rejected':'approved'}">${o.status=='sent'?'billed':o.status}</span></div>
 <div class=mu>${new Date(o.at).toLocaleString()}, ${o.lines.length} lines, ${money(o.total)} with VAT, ${o.pay}${ME.role=='admin'?', '+esc(o.by):''}</div>${o.reason?`<div class=err>${esc(o.reason)}</div>`:''}
 <button class="b s ghost" data-a=bill data-id=${o.id}>Bill</button><button class="b s ghost" data-a=share data-id=${o.id}>Share</button><button class="b s ghost" data-a=rep data-id=${o.id}>Repeat</button>
 ${o.status=='sent'&&(ME.role=='admin'||(ME.perms&&ME.perms.cancelSent))?`<button class="b s red" data-a=can data-id=${o.id}>Cancel order</button>`:''}</div>`).join(''):'<div class=card>No orders yet.</div>');
 if($('#ow'))$('#ow').onclick=()=>orderStart(null);if($('#or'))$('#or').onclick=()=>{OD=dr;orderView()};
 el.onclick=async e=>{const t=e.target.closest('[data-a]');if(!t)return;const d=t.dataset,o=ORDS.find(x=>x.id==d.id)||OPEN.find(x=>x.id==d.id);
  if(d.a=='bill')return billView(o);
  if(d.a=='open'){const cu=CUST.find(c=>c.id==o.cid);OD={cust:cu?{id:cu.id,nameEn:cu.nameEn,nameAr:cu.nameAr,phone:cu.phone}:null,walk:{name:o.cname,phone:o.phone||''},lines:o.lines.map(l=>({...l,st:''})),pay:o.pay,note:o.note||'',budget:0,sel:[],hl:[],openId:o.id,no:o.no,orderedAt:o.orderedAt||o.at};return orderView()}
  if(d.a=='cano'){const r=prompt('Reason for cancelling open order #'+o.no);if(r)await db.doc('orders/'+o.id).update({status:'cancelled',reason:r,cancelledBy:ME.name,cancelledAt:Date.now()});return}
  if(d.a=='share')return open(waLink(o));
  if(d.a=='rep'){orderStart(CUST.find(c=>c.id==o.cid)||null,o.lines.map(l=>({...l,st:''})))}
  if(d.a=='can'){const r=prompt('Reason for cancelling order #'+o.no);if(r)await db.doc('orders/'+o.id).update({status:'cancelled',reason:r,cancelledBy:ME.name,cancelledAt:Date.now()}).then(()=>logAct('Order cancelled','#'+o.no+', '+o.cname+', '+r))}}};
 window.ordersRedraw=draw;draw();
}
function orderStart(c,lines){
 loadCash();const old=localStorage.getItem(dKey()),od=old&&JSON.parse(old);
 if(!lines&&od&&od.lines.length&&c&&od.cust&&od.cust.id==c.id&&confirm('Continue the unsent draft for this customer?')){OD=od;return orderView()}
 OD={cust:c?{id:c.id,nameEn:c.nameEn,nameAr:c.nameAr,phone:c.phone}:null,walk:{name:'',phone:''},lines:lines||[],pay:'cash',note:'',budget:0,sel:[],hl:[]};saveD();orderView();
}
/* ---- Shelf Check ---- */
function shelfStart(c){
 loadCash();const s=stats(c.id),ids=Object.keys(s.cust).sort((a,b)=>s.cust[b].n-s.cust[a].n).slice(0,30);
 const list=ids.length?ids.map(i=>PRODS.find(p=>p.id==i)).filter(Boolean):PRODS.filter(p=>p.active!==false).sort((a,b)=>(s.fast[b.id]||0)-(s.fast[a.id]||0)||(a.sl||0)-(b.sl||0)).slice(0,40);
 SC={c,list,rows:{}};shelfView();
}
function shelfView(){
 OV=shelfView;const m=ov(),s=stats(SC.c.id),n=Object.values(SC.rows).filter(r=>r.st).length;
 m.innerHTML=`<div class=row style="padding:8px 0"><h2 style=flex:1>Shelf Check: ${esc(SC.c.nameEn)}</h2><button class="b s ghost" id=sx>Close</button></div>
 <p class=mu>Mark only what you see. Untouched means OK. ${n} marked.</p><button class="b s" id=ssc>Scan blank carton / shelf item</button>
 ${SC.list.map(p=>{const r=SC.rows[p.id]||{},u=s.cust[p.id],avg=u?Math.max(1,Math.round(u.q/u.n)):1;
 return `<div class=card id=r_${p.id}><b>${p.sl||''}. ${esc(p.name)}</b><div class=mu>Usual order ${avg} ${u?u.unit:'pcs'}</div>
 <button class="b s ${r.st=='zero'?'red':'ghost'}" data-a=zero data-id=${p.id}>Zero</button><button class="b s ${r.st=='short'?'':'ghost'}" style="${r.st=='short'?'background:var(--or)':''}" data-a=short data-id=${p.id}>Short</button>
 <button class="b s ${r.st?'ghost':'grn'}" data-a=ok data-id=${p.id}>OK</button>
 ${r.st=='short'?`<input type=number placeholder="Left on shelf" value="${r.left??''}" data-a=left data-id=${p.id} style="width:130px;display:inline-block">`:''}</div>`}).join('')}
 <button class=b id=smk>Create order from marked items</button>`;
 $('#sx').onclick=closeOv;$('#ssc').onclick=()=>scanCam(c=>{const f=byCode(c);if(!f)return alert('Product not found');const p=f.p;
  if(!SC.list.includes(p))SC.list.unshift(p);SC.rows[p.id]={st:'short'};shelfView();setTimeout(()=>{const e=$('#r_'+p.id);e&&e.scrollIntoView({block:'center'})},50)});
 m.onclick=e=>{const d=e.target.dataset;if(!d.a||!d.id||d.a=='left')return;SC.rows[d.id]=d.a=='ok'?{}:{st:d.a};shelfView()};
 m.onchange=e=>{const d=e.target.dataset;if(d.a=='left'){const v=e.target.value;SC.rows[d.id]={st:v!==''&&+v==0?'zero':'short',left:v};shelfView()}};
 $('#smk').onclick=()=>{const miss=SC.list.filter(p=>(s.fast[p.id]||0)>=3&&!(SC.rows[p.id]&&SC.rows[p.id].st)).slice(0,8);
  if(miss.length&&!SC.asked){SC.asked=1;return alert('Fast-moving items not checked yet:\n- '+miss.map(p=>p.name).join('\n- ')+'\n\nCheck them, or tap Create order again to continue.')}
  const lines=[];SC.list.forEach(p=>{const r=SC.rows[p.id];if(!r||!r.st)return;const u=s.cust[p.id],avg=u?Math.max(1,Math.round(u.q/u.n)):1,unit=u&&avail(p).includes(u.unit)?u.unit:'pcs';
  const q=r.st=='zero'?avg:(r.left!==undefined&&r.left!==''?Math.max(1,avg-Math.round(+r.left)):Math.max(1,Math.ceil(avg/2)));lines.push(mkLine(p,unit,q,r.st))});
  if(!lines.length)return alert('Nothing marked Zero or Short.');const cu=SC.c;SC=null;orderStart(cu,lines);};
}
/* ---- Order builder ---- */
function rank(l,fast,p){const f=fast[l.pid]||0,today=todayD(),se=p&&p.seasonFrom&&today>=p.seasonFrom&&today<=p.seasonTo;return [l.st=='zero'?0:l.st=='short'?1:f>=3?2:se?3:4,-f]}
function orderView(){
 OV=orderView;const m=ov(),vp=CFG.vatPercent||0,sub=OD.lines.reduce((s,l)=>s+l.qty*l.rate,0),vat=sub*vp/100,tot=sub+vat,{fast}=stats(OD.cust&&OD.cust.id);
 const rows=OD.lines.map((l,i)=>({l,i,p:PRODS.find(x=>x.id==l.pid)})).sort((a,b)=>{const x=rank(a.l,fast,a.p),y=rank(b.l,fast,b.p);return x[0]-y[0]||x[1]-y[1]});
 const qa=l=>l.unit=='pcs'?[6,12]:[1,5];
 m.innerHTML=`<div class=row style="padding:8px 0"><h2 style=flex:1>${OD.cust?esc(OD.cust.nameEn):'Walk-in order'}</h2><button class="b s ghost" id=ox>Save and close</button></div>
 ${OD.cust?'':`<input id=wn placeholder="Name (optional)" value="${esc(OD.walk.name)}"><input id=wp placeholder="Phone (optional)" value="${esc(OD.walk.phone)}">`}
 <div class=row><input id=obc placeholder="Scan or type barcode, then Enter"><button class="b s" id=osc>Scan</button></div>
 <input id=oad placeholder="Search product to add"><div id=ores></div>
 ${OD.sel.length?`<button class="b s red" id=orm>Remove selected (${OD.sel.length})</button>`:''}
 <div id=ol>${rows.map(({l,i,p})=>`<div class=card style="${OD.hl.includes(l.pid)?'outline:3px solid var(--or)':''}" id=l_${i}><div class=row><input type=checkbox style="width:22px;margin:0" data-a=sel data-i=${i} ${OD.sel.includes(i)?'checked':''}>
 <b style=flex:1>${i+1}. ${esc(l.name)}</b>${l.st?`<span class="tag ${l.st=='zero'?'rejected':'pending'}" style="${l.st=='short'?'background:var(--or)':''}">${l.st}</span>`:''}${l.edited?'<span class="tag admin">edited</span>':''}<button class="b s ghost" data-a=del data-i=${i}>Remove</button></div>
 <div class=row><button class="b s" data-a=unit data-i=${i}>${l.unit}</button><input type=number min=1 value=${l.qty} data-a=qty data-i=${i} style="width:90px">
 ${qa(l).map(n=>`<button class="b s ghost" data-a=add data-n=${n} data-i=${i}>+${n}</button>`).join('')}<span class=mu>x</span>
 <input type=number step=any value=${l.rate} data-a=rate data-i=${i} style="width:90px" ${canRate()?'':'readonly'}><b style="margin-left:auto">${money(l.qty*l.rate)}</b></div></div>`).join('')||'<div class=card>No items yet. Scan, search, or use Shelf Check.</div>'}</div>
 <div class=card><div class=row><span style=flex:1>Subtotal</span><b>${money(sub)}</b></div><div class=row><span style=flex:1>VAT ${vp}%</span><b>${money(vat)}</b></div><div class=row><span style=flex:1><b>Total</b></span><b style="font-size:20px">${money(tot)}</b></div>
 <input id=obu type=number placeholder="Customer budget (optional)" value="${OD.budget||''}">${OD.budget&&tot>OD.budget?'<button class="b s" id=ofit>Auto-fit to budget</button>':''}${OD.budget?`<p class="${tot>OD.budget?'err':'mu'}">${tot>OD.budget?'Over budget by '+money(tot-OD.budget)+'. Reduce the lowest priority lines (bottom of the list).':'Within budget, '+money(OD.budget-tot)+' left.'}</p>`:''}
 <select id=opy><option value=cash ${OD.pay=='cash'?'selected':''}>Cash</option><option value=credit ${OD.pay=='credit'?'selected':''}>Credit</option></select><input id=ono placeholder="Order note" value="${esc(OD.note)}"></div>
 <button class=b id=osd>${OD.openId?'Convert to bill now':'Make bill now'}</button><button class="b ghost" id=oop>Save as open order (deliver later)</button><button class="b ghost" id=oca style="color:var(--rd);border-color:var(--rd)">Cancel entire order</button>
 <div id=undo></div>`;
 if(UNDO)showUndo();
 const hl=()=>{if(OD.hl.length){const e=document.querySelector('[id^=l_]');setTimeout(()=>{OD.hl=[];},3000)}};hl();
 $('#ox').onclick=()=>{saveD();closeOv()};
 if($('#ofit'))$('#ofit').onclick=()=>{let need=tot-OD.budget;const k=1+vp/100,plan=[],cand=rows.filter(r=>r.l.st!='zero').reverse().concat(rows.filter(r=>r.l.st=='zero').reverse());
  for(const r of cand){if(need<=0)break;const v=r.l.qty*r.l.rate*k;if(v<=need){plan.push({i:r.i,rm:1,t:'Remove '+r.l.name});need-=v}else{const q=Math.ceil(need/(r.l.rate*k));plan.push({i:r.i,q,t:'Reduce '+r.l.name+' by '+q});need=0}}
  if(need>0)return alert('Even removing everything does not fit this budget.');
  if(plan.some(x=>OD.lines[x.i].st=='zero')&&!confirm('Zero (empty shelf) items must be cut too. Continue?'))return;
  if(!confirm('Suggested changes:\n- '+plan.map(x=>x.t).join('\n- ')+'\n\nApply?'))return;
  plan.forEach(x=>{const l=OD.lines[x.i];if(x.rm||l.qty-x.q<=0)l.rm=1;else l.qty-=x.q});OD.lines=OD.lines.filter(l=>!l.rm);OD.sel=[];saveD();orderView()};
 const meta=()=>{if($('#wn')){OD.walk.name=$('#wn').value;OD.walk.phone=$('#wp').value}OD.pay=$('#opy').value;OD.note=$('#ono').value;saveD()};
 m.onchange=e=>{const d=e.target.dataset;if(!d.a){if(e.target.id=='obu'){OD.budget=+e.target.value||0;saveD();return orderView()}return meta()}
  const l=OD.lines[d.i];if(d.a=='sel')OD.sel=e.target.checked?[...OD.sel,+d.i]:OD.sel.filter(x=>x!=d.i);
  if(d.a=='qty'){l.qty=Math.max(1,Math.round(+e.target.value)||1);l.fresh=false}if(d.a=='rate'&&canRate()){l.rate=+e.target.value||l.rate;l.edited=true}
  saveD();orderView()};
 m.onclick=async e=>{const d=e.target.dataset;if(!d.a||d.a=='sel'||d.a=='qty'||d.a=='rate')return;const l=OD.lines[d.i];
  if(d.a=='add'){l.qty=(l.fresh&&l.qty==1)?+d.n:l.qty+ +d.n;l.fresh=false;saveD();const qi=m.querySelector('input[data-a=qty][data-i="'+d.i+'"]');if(qi)qi.value=l.qty;clearTimeout(window.rrT);window.rrT=setTimeout(orderView,350);return}
  if(d.a=='unit'){const p=PRODS.find(x=>x.id==l.pid);if(!p)return;const av=avail(p),nx=av[(av.indexOf(l.unit)+1)%av.length],o=OD.lines.findIndex((x,j)=>j!=d.i&&x.pid==l.pid&&x.unit==nx);
   if(o>=0){if(!confirm('A '+nx+' line already exists. Merge them?'))return;OD.lines[o].qty+=l.qty;OD.lines.splice(d.i,1)}else{l.unit=nx;l.rate=+(p.rate*pu(p,nx)).toFixed(2);l.edited=false}}
  if(d.a=='del'){if(!confirm('Remove "'+l.name+'"?'))return;UNDO={l,i:+d.i,t:setTimeout(()=>{UNDO=null;const u=$('#undo');u&&(u.innerHTML='')},10000)};OD.lines.splice(d.i,1);OD.sel=[]}
  saveD();orderView()};
 $('#osc').onclick=()=>scanCam(onScan);
 $('#obc').onkeydown=e=>{if(e.key=='Enter'&&e.target.value.trim()){onScan(bcn(e.target.value));e.target.value=''}};
 $('#oad').oninput=e=>{const q=e.target.value.trim().toLowerCase(),r=q?PRODS.filter(p=>p.active!==false&&(p.name+' '+p.sl).toLowerCase().includes(q)).slice(0,6):[];
  $('#ores').innerHTML=r.map(p=>`<div class=card data-p=${p.id}>${p.sl||''}. ${esc(p.name)} <b>${money(p.rate)}</b></div>`).join('')};
 $('#ores').onclick=e=>{const c=e.target.closest('[data-p]');if(c){addProd(PRODS.find(p=>p.id==c.dataset.p),'pcs')}};
 if($('#orm'))$('#orm').onclick=()=>{const c=Math.floor(100+Math.random()*900);if(prompt('Type '+c+' to remove '+OD.sel.length+' items')==c){OD.lines=OD.lines.filter((x,i)=>!OD.sel.includes(i));OD.sel=[];saveD();orderView()}else alert('Code did not match. Nothing removed.')};
 $('#oca').onclick=()=>{const c=Math.floor(100+Math.random()*900);if(prompt('Cancel the ENTIRE order ('+OD.lines.length+' lines, total '+money(tot)+')? Type '+c+' to confirm')==c){OD=null;localStorage.removeItem(dKey());closeOv()}else alert('Code did not match. Order kept.')};
 $('#osd').onclick=()=>sendOrder(sub,vat,tot,vp);$('#oop').onclick=()=>sendOrder(sub,vat,tot,vp,true);
}
function showUndo(){const u=$('#undo');if(u)u.innerHTML=`<div class=card style="position:fixed;left:12px;right:12px;bottom:12px;z-index:25;display:flex;align-items:center"><span style=flex:1>Item removed</span><button class="b s" id=uu>Undo</button></div>`;
 if($('#uu'))$('#uu').onclick=()=>{clearTimeout(UNDO.t);OD.lines.splice(UNDO.i,0,UNDO.l);UNDO=null;saveD();orderView()}}
function addProd(p,unit){if(!p)return;const ex=OD.lines.filter(l=>l.pid==p.id);
 if(ex.length){OD.hl=[p.id];if(navigator.vibrate)navigator.vibrate(120)}else{OD.lines.push(mkLine(p,unit,1));OD.hl=[p.id]}saveD();orderView();setTimeout(()=>{const e=document.querySelector('#ol .card[style*=outline]');e&&e.scrollIntoView({block:'center'})},60)}
function onScan(code){const f=byCode(bcn(code));if(!f)return alert('Product not found: '+code);
 const same=OD.lines.some(l=>l.pid==f.p.id);addProd(f.p,f.unit)}
/* ---- send + WhatsApp text ---- */
async function sendOrder(sub,vat,tot,vp,asOpen){
 if(!asOpen&&dayLocked())return;
 if(!OD.lines.length)return alert('Add at least one product.');
 const n=(+localStorage.getItem('ordn_'+U.uid)||0)+1,no=ME.name.replace(/[^A-Za-z]/g,'').slice(0,2).toUpperCase()+n,c=OD.cust;
 const o={no:(OD.openId&&OD.no)||no,cid:c?c.id:'',cname:c?c.nameEn:(OD.walk.name||'Walk-in'),cnameAr:c?c.nameAr:'',phone:c?c.phone:OD.walk.phone,lines:OD.lines.map(l=>({...l,fresh:false,total:+(l.qty*l.rate).toFixed(2)})),sub,vatPct:vp,vat,total:tot,pay:OD.pay,note:OD.note,budget:OD.budget,uid:U.uid,by:ME.name,branch:ME.branch||'',at:Date.now(),status:asOpen?'open':'sent',orderedAt:OD.orderedAt||Date.now()};
 try{(OD.openId?db.doc('orders/'+OD.openId).update(o):db.collection('orders').add(o));if(c&&!asOpen)db.doc('customers/'+c.id).update({lead:false}).catch(()=>{});if(o.lines.some(l=>l.edited))logAct('Rate edited in order','#'+no+', '+o.cname);if(!(OD.openId&&OD.no))localStorage.setItem('ordn_'+U.uid,n)}catch(e){return alert(e.message)}
 OD=null;localStorage.removeItem(dKey());closeOv();if(asOpen)alert('Saved as an open order. It is in Orders to deliver and does not count in sales until you make the bill.');else billView(o);if(window.ordersRedraw)ordersRedraw();
}
function waText(o){const d=new Date(o.at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}),L=ul=>({pcs:'Pcs',packet:'Pack',carton:'Cart'}[ul]||ul.charAt(0).toUpperCase()+ul.slice(1));
 return `*ORDER #${o.no}* – ${d}\nCustomer: ${o.cname}${o.cnameAr?' / '+o.cnameAr:''}\n`+o.lines.map((l,i)=>`${i+1}. ${l.name} – ${l.qty} ${L(l.unit)} × ${money(l.rate)} = ${money(l.total)}`).join('\n')
 +`\nSubtotal: ${money(o.sub)}\nVAT ${o.vatPct}%: ${money(o.vat)}\n*TOTAL: ${money(o.total)}*\n${o.pay=='credit'?'Credit':'Cash'}${o.note?'\nNote: '+o.note:''}\nBy: ${o.by}`}
function waLink(o){let p=ph(o.phone||'');return 'https://wa.me/'+(p?'966'+p.slice(1):'')+'?text='+encodeURIComponent(waText(o))}

/* open orders (deliver later) and the printable bill */
const openHtml=()=>{const L=OPEN.filter(o=>ME.role=='admin'||o.uid==U.uid);if(!L.length)return '';const lim=(CFG.openDays||3)*864e5;
 return `<h2 style="margin-top:10px">Orders to deliver (${L.length})</h2>`+L.map(o=>{const ms=Date.now()-(o.orderedAt||o.at),age=Math.floor(ms/864e5);
  return `<div class=card style="border-color:${ms>lim?'var(--rd)':'var(--or)'}"><div class=row data-a=open data-id=${o.id} style="cursor:pointer"><b style=flex:1>#${esc(o.no)} ${esc(o.cname||'Walk-in')}</b><span class="tag pending">to deliver</span></div><div class=mu>${o.lines.length} lines, about ${money(o.total)} with VAT, ${age} day${age==1?'':'s'} old${ms>lim?', overdue':''}${ME.role=='admin'?', '+esc(o.by):''}</div><button class="b s grn" data-a=open data-id=${o.id}>Deliver and bill</button><button class="b s red" data-a=cano data-id=${o.id}>Cancel</button></div>`}).join('')};
function billView(o){
 OV=null;const m=ov(),rw=(a,b,x)=>`<div style="display:flex;justify-content:space-between;${x||''}"><span>${a}</span><span>${b}</span></div>`;
 m.innerHTML=`<div class=wrap><div class=noprint><button class="b s ghost" id=bx>Close</button></div><div class=card style="background:#fff;color:#000;border-color:#ccc"><h2 style="text-align:center">SALES BILL</h2><div style="text-align:center;font-size:12px">Not a tax invoice</div><hr>
 ${rw('Bill #'+esc(o.no),new Date(o.at).toLocaleString())}<div>Customer: ${esc(o.cname)} ${esc(o.cnameAr||'')}</div><hr>
 ${o.lines.map((l,i)=>rw(`${i+1}. ${esc(l.name)}<br><small>${l.qty} ${esc(l.unit)} x ${money(l.rate)}</small>`,`<b>${money(l.total||l.qty*l.rate)}</b>`,'margin:4px 0')).join('')}<hr>
 ${rw('Subtotal',money(o.sub))}${rw('VAT '+o.vatPct+'%',money(o.vat))}${rw('<b>TOTAL</b>','<b>'+money(o.total)+'</b>')}<div>${o.pay=='credit'?'Credit':'Cash'}</div>${o.note?`<div>Note: ${esc(o.note)}</div>`:''}<div style="font-size:12px;margin-top:6px">By ${esc(o.by)}</div><div style="font-size:11px;text-align:center;margin-top:8px;border-top:1px dashed #999;padding-top:6px">Sales bill - not a tax invoice</div></div>
 <div class=noprint><button class=b id=bp>Print</button><button class="b ghost" id=bw>Share on WhatsApp</button></div></div>`;
 $('#bx').onclick=closeOv;$('#bp').onclick=()=>window.print();$('#bw').onclick=()=>open(waLink(o));
}
