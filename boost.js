/* Sales boosters: reorder-due alerts, cross-sell, focus products, lost sales, credit control, WhatsApp reminders */
const DM=864e5;
const billsOf=cid=>ORDS.filter(o=>o.cid==cid&&o.status!='cancelled').sort((a,b)=>a.at-b.at);
function gapInfo(c){const b=billsOf(c.id);if(b.length<3)return null;let t=0;for(let i=1;i<b.length;i++)t+=b[i].at-b[i-1].at;
 return {g:Math.max(1,Math.round(t/(b.length-1)/DM)),d:Math.floor((Date.now()-b[b.length-1].at)/DM),last:b[b.length-1].at,n:b.length}}
function waRemind(c,kind){
 const g=gapInfo(c),bal=custBal(c.id),nm=c.nameEn||c.nameAr,ar=c.nameAr||nm,
 T={reorder:`Hello ${nm}, it has been ${g?g.d:'some'} days since your last order. Shall we visit you this week? Please tell us what you need.\nمرحبًا ${ar}، مضت ${g?g.d:'عدة'} يومًا على آخر طلب. هل نزوركم هذا الأسبوع؟ أخبرونا بما تحتاجون.`,
 pay:`Hello ${nm}, a friendly reminder: your balance with us is ${money(bal)} SAR. Please tell us when we can collect it. Thank you.\nمرحبًا ${ar}، تذكير ودّي: رصيدكم لدينا ${money(bal)} ريال. نرجو إخبارنا بموعد الاستلام. شكرًا لكم.`}[kind],p=ph(c.phone||'');
 open('https://wa.me/'+(p?'966'+p.slice(1):'')+'?text='+encodeURIComponent(T));
}
/* ---- Reorder due tab ---- */
function dueView(b){
 const L=CUST.map(c=>({c,i:gapInfo(c)})).filter(x=>x.i&&x.i.d>=x.i.g).sort((x,y)=>y.i.d/y.i.g-x.i.d/x.i.g);
 b.innerHTML=`<p class=mu>Shops that usually order every few days and are now late. Needs at least 3 bills per shop.</p>`+(L.map(({c,i})=>`<div class=card><b>${esc(c.nameEn||'')}</b> <span dir=rtl class=mu>${esc(c.nameAr||'')}</span><div class=mu>Usually orders every ${i.g} days. Last order ${i.d} days ago (${i.n} bills).</div>
 <button class="b s" data-a=prof data-id=${c.id}>Profile</button><button class="b s grn" data-a=wa data-id=${c.id}>WhatsApp reminder</button></div>`).join('')||'<div class=card>No late shops right now.</div>');
 b.onclick=e=>{const d=e.target.dataset,c=CUST.find(x=>x.id==d.id);if(!c)return;if(d.a=='prof')profileView(c);if(d.a=='wa')waRemind(c,'reorder')};
}
/* ---- Credit aging tab ---- */
function aging(c){
 const D=[];if((c.opening||0)>0)D.push({t:0,a:+c.opening,op:1});
 ORDS.filter(o=>o.cid==c.id&&o.status!='cancelled'&&o.pay=='credit').forEach(o=>D.push({t:o.at,a:o.total}));D.sort((x,y)=>x.t-y.t);
 let cr=sum(PAY.filter(p=>p.cid==c.id),'amount')+sum(RET.filter(r=>r.cid==c.id&&r.refund=='credit'&&r.status!='cancelled'),'total');const k={a:0,b:0,c:0,o:0};
 for(const d of D){let x=d.a;const u=Math.min(x,cr);cr-=u;x-=u;if(x<=0)continue;const age=(Date.now()-d.t)/DM;if(d.op)k.o+=x;else if(age<=30)k.a+=x;else if(age<=60)k.b+=x;else k.c+=x}
 return k;
}
function balView(b){
 const L=CUST.map(c=>({c,k:aging(c)})).map(x=>({...x,t:x.k.a+x.k.b+x.k.c+x.k.o})).filter(x=>x.t>0.5).sort((x,y)=>(y.k.c*3+y.k.b*2+y.k.o*2+y.k.a)-(x.k.c*3+x.k.b*2+x.k.o*2+x.k.a)),T=k=>sum(L.map(x=>x.k),k);
 b.innerHTML=`<div class=card><b>Money owed to us: ${money(L.reduce((s,x)=>s+x.t,0))}</b><div class=mu>0 to 30 days ${money(T('a'))}, 31 to 60 days ${money(T('b'))}, over 60 days ${money(T('c'))}, from before the app ${money(T('o'))}</div></div>`+
 (L.map(({c,k,t})=>`<div class=card><div class=row><b style=flex:1>${esc(c.nameEn||'')}</b><b class="${k.c>0?'err':''}">${money(t)}</b></div><div class=mu>0-30: ${money(k.a)}, 31-60: ${money(k.b)}, 60+: ${money(k.c)}, before app: ${money(k.o)}${c.creditLimit>0?', limit '+money(c.creditLimit):''}</div>
 <button class="b s" data-a=prof data-id=${c.id}>Profile</button><button class="b s grn" data-a=wa data-id=${c.id}>Payment reminder</button></div>`).join('')||'<div class=card>Nobody owes money.</div>');
 b.onclick=e=>{const d=e.target.dataset,c=CUST.find(x=>x.id==d.id);if(!c)return;if(d.a=='prof')profileView(c);if(d.a=='wa')waRemind(c,'pay')};
}
/* ---- focus products and cross-sell inside the order screen ---- */
const focusProds=()=>(CFG.focus||[]).map(l=>{const [k,n]=l.split('|').map(x=>x.trim()),p=PRODS.find(x=>(x.bcs||[]).includes(bcn(k))||x.name.toLowerCase().includes(k.toLowerCase()));return p&&p.active!==false?{p,note:n||''}:null}).filter(Boolean);
function crossSell(cid){
 const S={};ORDS.filter(o=>o.status!='cancelled'&&o.cid).forEach(o=>{const s=S[o.cid]=S[o.cid]||new Set();o.lines.forEach(l=>s.add(l.pid))});
 const mine=S[cid]||new Set();if(mine.size<2)return[];const sc={},cn={};let sim=0;
 for(const k in S){if(k==cid)continue;const s=S[k];let i=0;mine.forEach(x=>{if(s.has(x))i++});if(i<2)continue;sim++;const w=i/(mine.size+s.size-i);s.forEach(p=>{if(!mine.has(p)){sc[p]=(sc[p]||0)+w;cn[p]=(cn[p]||0)+1}})}
 if(sim<2)return[];return Object.keys(sc).sort((a,b)=>sc[b]-sc[a]).slice(0,3).map(id=>({p:PRODS.find(x=>x.id==id),n:cn[id],of:sim})).filter(x=>x.p&&x.p.active!==false);
}
function boostOrder(){
 const ol=$('#ol');if(!ol||!OD)return;const c=OD.cust?CUST.find(k=>k.id==OD.cust.id):null,have=new Set(OD.lines.map(l=>l.pid)),f=focusProds().filter(z=>!have.has(z.p.id)),xs=c?crossSell(c.id).filter(z=>!have.has(z.p.id)):[],lim=c&&c.creditLimit>0?c.creditLimit:0,bal=c?custBal(c.id):0;
 const add=(z,t)=>`<div class=row style="margin:4px 0"><span style=flex:1>${esc(z.p.name)}<div class=mu>${t}</div></span><button class="b s" data-bx=${z.p.id}>Add</button></div>`;
 let h=lim&&bal>lim*.8?`<div class=err>Credit: balance ${money(bal)} of limit ${money(lim)}${bal>lim?' (over the limit)':''}</div>`:'';
 if(f.length)h+=`<b>&#9733; This week's focus</b>`+f.map(z=>add(z,esc(z.note))).join('');
 if(xs.length)h+=`<b style="display:block;margin-top:6px">Shops like this also buy</b>`+xs.map(z=>add(z,z.n+' of '+z.of+' similar shops')).join('');
 h+=`<button class="b s ghost" id=xlost>Customer wanted something we don't have?</button>`;
 ol.insertAdjacentHTML('beforebegin',`<div class=card id=xs>${h}</div>`);
 $('#xs').onclick=e=>{const id=e.target.dataset.bx;if(id)addProd(PRODS.find(p=>p.id==id),'pcs');if(e.target.id=='xlost')lostSale(c)};
}
const _ov=orderView;orderView=function(){_ov();boostOrder()};
const _so=sendOrder;sendOrder=async function(sub,vat,tot,vp,asOpen){
 if(!asOpen&&OD&&OD.cust&&OD.pay=='credit'){const c=CUST.find(k=>k.id==OD.cust.id);
  if(c&&c.creditLimit>0&&custBal(c.id)+tot>c.creditLimit&&!confirm('This bill puts '+c.nameEn+' over the credit limit of '+money(c.creditLimit)+'. The new balance would be '+money(custBal(c.id)+tot)+'. Make the bill anyway?'))return}
 return _so(sub,vat,tot,vp,asOpen)};
/* ---- lost sales ---- */
function lostSale(c){
 const w=document.createElement('div');w.style.cssText='position:fixed;inset:0;background:var(--bg);overflow:auto;z-index:30;padding:12px;padding-top:calc(12px + env(safe-area-inset-top))';let why='Out of stock',pid='';
 w.innerHTML=`<div class=wrap><h2>Lost sale</h2><div class=mu>${esc(c?c.nameEn:'Walk-in')}</div><input id=ls placeholder="Search our product, or type the name"><div id=lr></div><label class=mu>Why?</label><div class=row style="flex-wrap:wrap">${['Out of stock','We do not carry it','Price','Other'].map(x=>`<button class="b s" data-w="${x}">${x}</button>`).join('')}</div><button class=b id=lsv>Save</button><button class="b ghost" id=lx>Cancel</button></div>`;
 document.body.appendChild(w);const pw=()=>w.querySelectorAll('[data-w]').forEach(x=>{x.classList.toggle('ghost',x.dataset.w!=why)});pw();
 $('#ls').oninput=e=>{pid='';const s=e.target.value.trim().toLowerCase(),r=s?PRODS.filter(p=>p.name.toLowerCase().includes(s)).slice(0,5):[];$('#lr').innerHTML=r.map(p=>`<div class=card data-p=${p.id}>${esc(p.name)}</div>`).join('')};
 w.onclick=e=>{const d=e.target.dataset;if(d.w){why=d.w;pw()}const p=e.target.closest('[data-p]');if(p){pid=p.dataset.p;$('#ls').value=PRODS.find(x=>x.id==pid).name;$('#lr').innerHTML=''}};
 $('#lx').onclick=()=>w.remove();
 $('#lsv').onclick=()=>{const n=$('#ls').value.trim();if(!n)return alert('Type or choose the product.');db.collection('lostSales').add({cid:c?c.id:'',cname:c?c.nameEn:'Walk-in',pid,name:n,reason:why,uid:U.uid,by:ME.name,branch:ME.branch||'',at:Date.now(),day:todayD()});w.remove();alert('Lost sale saved.')};
}
async function lostSummary(all){
 const q=ME.role=='admin'?db.collection('lostSales'):db.collection('lostSales').where('uid','==',U.uid),days=all?30:7,g={};
 (await q.get()).docs.map(d=>d.data()).filter(x=>x.at>=Date.now()-days*DM).forEach(x=>{const k=x.name.toLowerCase(),o=g[k]=g[k]||{n:x.name,c:0,r:{}};o.c++;o.r[x.reason]=(o.r[x.reason]||0)+1});
 return Object.values(g).sort((a,b)=>b.c-a.c);
}
async function lostBox(el){try{const L=(await lostSummary(false)).slice(0,10),h=el.querySelector('#cw2');if(!L.length||!h||h.querySelector('#lsb'))return;
 h.insertAdjacentHTML('beforeend','<div class=card id=lsb><b>Customers asked for these in the last 7 days</b>'+L.map(x=>`<div class=row><span style=flex:1>${esc(x.n)}</span><b>${x.c}</b></div>`).join('')+'</div>')}catch(e){}}
const _ll=loadListView;loadListView=function(el,m){_ll(el,m);lostBox(el);setTimeout(()=>lostBox(el),1500)};
async function lostView(el){el.innerHTML='<p class=mu>Loading...</p>';
 try{const L=await lostSummary(true);el.innerHTML='<h2>Lost sales, last 30 days</h2><p class=mu>What customers asked for and you could not sell. Use it to decide what to stock and load.</p>'+(L.map(o=>`<div class=card><div class=row><b style=flex:1>${esc(o.n)}</b><b>${o.c}</b></div><div class=mu>${Object.entries(o.r).map(([k,v])=>k+': '+v).join(', ')}</div></div>`).join('')||'<div class=card>No lost sales recorded yet.</div>')}catch(e){el.innerHTML='<div class=card>Could not load. Check the internet and publish the latest rules.</div>'}}
