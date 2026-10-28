/* 30-day skill plan. Progress is private to each person (Firestore rules block everyone else, admin included). */
const PLAN0=[
"Learn the 10 fastest-moving products and their prices|Check pieces per carton for 5 products",
"Learn 10 more products with prices including VAT|Take the product quiz",
"Learn which products are seasonal now|Learn the unit barcodes of 5 products",
"Study the 5 products customers ask for most|Take the product quiz",
"Learn the company sales and return policy|Learn the payment and credit rules",
"Compare 3 of our products with competitors on price and size|Note one selling point for each",
"Take the product quiz|Write 3 things you still forget",
"Write your opening line for a shop visit|Say it to 3 customers",
"Prepare 3 questions to ask at every Shelf Check|Use them in 3 visits",
"Prepare a short explanation of one product's value|Use it with one customer",
"Prepare answers to \"the price is too high\"|Note what the customer replies",
"Prepare answers to \"no money now\" and \"I still have stock\"|Add them to the notebook",
"Ask 3 questions before you offer anything|Note one thing each customer needs",
"Rate your communication|Pick your weakest talking point",
"Recommend 2 fast-moving products in every visit|Check the shop's usual items before you go in",
"Suggest the reorder quantity from the Shelf Check, not a guess|Ask for the repeat order",
"Offer one product the shop does not stock yet|Note the reaction",
"Improve one display or freezer layout with the owner|Note what changed",
"Visit a Lead and ask for the first order|Follow up one reminder",
"End every visit by confirming the next visit day|Read the order total back to the customer",
"Check your orders per visit|Find your best visit this week and why",
"Compare your sales with your monthly target|Check the target bar on your home screen",
"List customers visited with no order this month|Plan a different approach for each",
"Visit or call one dormant shop|Ask why they stopped ordering",
"Check your returns: which product and why|Plan how to avoid it",
"Open the ranking and visit 2 B customers to move them to A|Prepare an offer idea",
"Check your cash closings for short or over days|Fix one habit",
"Review your objection notebook|Keep the 3 best answers",
"Rate all four skills honestly|Pick your weakest skill",
"Set your next 30-day goal|Write 3 actions for your weakest skill"];
const planLines=()=>PLAN0.map((d,i)=>(CFG.plan&&CFG.plan[i])||d);
const planTasks=d=>planLines()[d-1].split('|').map(x=>x.trim()).filter(Boolean);
const WK=d=>d<=7?['Week 1','Learn']:d<=14?['Week 2','Communicate']:d<=21?['Week 3','Sell']:['Week 4','Measure'];
const SKILLS=[['pk','Product knowledge'],['cm','Communication'],['cl','Asking for the order'],['fu','Follow-up']];
const shuf=a=>a.map(x=>[Math.random(),x]).sort((x,y)=>x[0]-y[0]).map(x=>x[1]);
let PL=null,PV=0,PELEM=null;
const dayNo=s=>Math.max(1,Math.min(30,Math.floor((new Date(todayD())-new Date(s))/864e5)+1));
const planSave=()=>db.doc('planProgress/'+U.uid).set(PL);
async function planView(el){
 PELEM=el;loadCash();el.innerHTML='<p class=mu>Loading...</p>';
 try{const s=await db.doc('planProgress/'+U.uid).get();PL=s.exists?s.data():null}catch(e){el.innerHTML='<div class=card>Could not load the plan. Check the internet and that the admin turned it on for you.</div>';return}
 PV=0;planDraw();
}
async function planStats(){
 const n=Date.now(),w=n-7*864e5,mine=ORDS.filter(x=>x.uid==U.uid&&x.status!='cancelled'),o=mine.filter(x=>x.at>=w);let v=0;
 try{v=(await db.collection('visits').where('uid','==',U.uid).get()).docs.filter(d=>d.data().at>=w).length}catch(e){}
 const cnt={};mine.filter(x=>x.at>=n-30*864e5).forEach(x=>cnt[x.cid]=(cnt[x.cid]||0)+1);
 return {v,o:o.length,sale:sum(o,'total'),avg:o.length?sum(o,'total')/o.length:0,conv:v?Math.round(o.length/v*100):0,rep:Object.values(cnt).filter(k=>k>1).length,dorm:CUST.filter(c=>!mine.some(x=>x.cid==c.id&&x.at>=n-45*864e5)).length};
}
async function planDraw(){
 const el=PELEM;if(!el)return;
 if(!PL){el.innerHTML=`<div id=cw3><button class="b s ghost" onclick="sig='';route()">Back</button><h2>My 30-day plan</h2><div class=card><p>30 days, 2 or 3 small tasks a day (5 to 10 minutes). Four weeks: Learn, Communicate, Sell, Measure.</p><p class=mu>Your progress, quiz scores and notes are private. Nobody else can read them, not even the admin.</p><button class=b id=pst>Start my plan today</button></div></div>`;
  $('#pst').onclick=async()=>{PL={start:todayD(),done:{},ratings:{},quiz:[],notes:[]};await planSave();planDraw()};return}
 const today=dayNo(PL.start),d=PV||today,tk=planTasks(d),dn=PL.done[d]||[],tot=PLAN0.reduce((s,_,i)=>s+planTasks(i+1).length,0),fin=Object.keys(PL.done).reduce((s,k)=>s+(PL.done[k]||[]).filter(i=>i<planTasks(+k).length).length,0),pc=Math.round(fin/tot*100),[wk,th]=WK(d);
 const chip=i=>{const n=i+1,k=(PL.done[n]||[]).length,t=planTasks(n).length,c=n>today?'var(--bd)':k>=t?'var(--gr)':k>0?'var(--or)':'var(--rd)';return `<button data-day=${n} style="flex:0 0 34px;height:34px;border-radius:9px;border:${n==d?'3px solid var(--tx)':'0'};background:${c};color:#fff;font-weight:700" ${n>today?'disabled':''}>${n}</button>`};
 el.innerHTML=`<div id=cw3><button class="b s ghost" onclick="sig='';route()">Back</button><h2>My 30-day plan</h2>
 <div class=card><div class=row><b style=flex:1>${pc}% done</b><span class=mu>Day ${today} of 30</span></div><div style="height:10px;background:var(--bd);border-radius:6px;margin:6px 0"><div style="height:10px;width:${pc}%;background:var(--gr);border-radius:6px"></div></div>
 <div class=row style="flex-wrap:wrap;gap:6px">${Array.from({length:30},(_,i)=>chip(i)).join('')}</div></div>
 <div class=card><div class=row><b style=flex:1>Day ${d}</b><span class="tag admin">${wk}: ${th}</span></div>${d<today?'<div class=mu>Catching up on an earlier day</div>':''}
 ${tk.map((t,i)=>`<label class=perm><input type=checkbox data-t=${i} ${dn.includes(i)?'checked':''}><span>${esc(t)}</span></label>`).join('')}</div>
 <div id=pstat class=card><div class=mu>Your numbers, last 7 days...</div></div>
 <div class=row style="flex-wrap:wrap"><button class="b s" id=pq>Product quiz</button><button class="b s" id=pr>Weekly rating</button><button class="b s" id=pn>Objection notebook</button></div>
 ${PL.quiz.length?`<p class=mu>Last quiz: ${PL.quiz[PL.quiz.length-1].score}/5 (${PL.quiz.length} taken)</p>`:''}</div>`;
 el.onclick=e=>{const t=e.target.dataset;if(t.day){PV=+t.day;planDraw()}};
 el.onchange=e=>{const t=e.target.dataset;if(t.t===undefined)return;const i=+t.t,a=(PL.done[d]||[]).filter(x=>x!=i);if(e.target.checked)a.push(i);PL.done[d]=a;planSave();planDraw()};
 $('#pq').onclick=planQuiz;$('#pr').onclick=planRate;$('#pn').onclick=planNotes;
 const s=await planStats(),b=$('#pstat');
 if(b)b.innerHTML=`<b>Your numbers, last 7 days</b><div class=row><span style=flex:1>Visits</span><b>${s.v}</b></div><div class=row><span style=flex:1>Orders</span><b>${s.o}</b></div><div class=row><span style=flex:1>Orders per visit</span><b>${s.conv}%</b></div><div class=row><span style=flex:1>Average order</span><b>${money(s.avg)}</b></div><div class=row><span style=flex:1>Repeat customers (30 days)</span><b>${s.rep}</b></div><div class=row><span style=flex:1>Shops with no order in 45 days</span><b>${s.dorm}</b></div>${ME.target?`<div class=row><span style=flex:1>Monthly target</span><b>see Home</b></div>`:''}`;
}
function planQuiz(){
 loadCash();const P=PRODS.filter(p=>p.active!==false&&p.rate),vp=CFG.vatPercent||0;
 if(P.length<4)return alert('The quiz needs at least 4 products, and your account needs permission to view products.');
 const Q=[];for(let i=0;i<5;i++){const p=P[Math.floor(Math.random()*P.length)],us=Object.keys(p.units||{}).filter(k=>k!='pcs'&&p.units[k].qty),pv=p.rate*(1+vp/100);
  if(us.length&&i%2==0){const k=us[0],a=+p.units[k].qty;Q.push({q:`How many pieces are in one ${p.units[k].label||k} of ${p.name}?`,a:String(a),o:shuf([...new Set([a,a+6,Math.max(1,a-6),a*2,a+12].map(String))]).slice(0,4)})}
  else Q.push({q:`What is the price of 1 piece of ${p.name} including VAT?`,a:pv.toFixed(2),o:shuf([...new Set([pv,pv*1.2,pv*.8,p.rate,pv*1.5].map(x=>x.toFixed(2)))]).slice(0,4)})}
 Q.forEach(x=>{if(!x.o.includes(x.a))x.o[0]=x.a;x.o=shuf(x.o)});
 let i=0,sc=0;const m=ov(),show=()=>{OV=null;
  if(i>=5){PL.quiz.push({at:Date.now(),score:sc});planSave();m.innerHTML=`<div class=wrap style="padding-top:20px"><h2>Quiz result</h2><div class=card><div style="font-size:40px;font-weight:800">${sc} / 5</div><p class=mu>${sc==5?'Excellent.':sc>=3?'Good. Review the ones you missed.':'Study the product list again and retry tomorrow.'}</p></div><button class=b id=qx>Close</button></div>`;$('#qx').onclick=()=>{closeOv();planDraw()};return}
  const q=Q[i];m.innerHTML=`<div class=wrap style="padding-top:20px"><div class=mu>Question ${i+1} of 5</div><h2 style="margin:8px 0 12px">${esc(q.q)}</h2>${q.o.map(o=>`<button class="b ghost" data-o="${esc(o)}">${esc(o)}</button>`).join('')}<button class="b ghost" id=qc style="margin-top:20px">Stop quiz</button></div>`;
  $('#qc').onclick=closeOv;m.onclick=e=>{const o=e.target.dataset.o;if(o===undefined)return;if(o==q.a)sc++;e.target.style.background=o==q.a?'var(--gr)':'var(--rd)';e.target.style.color='#fff';m.onclick=null;setTimeout(()=>{i++;show()},600)}};
 show();
}
function planRate(){
 const k='w'+Math.ceil(dayNo(PL.start)/7),r=PL.ratings[k]||{},m=ov(),opt=v=>[1,2,3,4,5].map(n=>`<option ${n==v?'selected':''}>${n}</option>`).join('');
 m.innerHTML=`<div class=wrap style="padding-top:20px"><h2>Weekly rating (1 to 5)</h2><p class=mu>Be honest. This is only for you.</p>${SKILLS.map(([s,l])=>`<label class=mu>${l}</label><select id=rt_${s}>${opt(r[s]||3)}</select>`).join('')}<button class=b id=rsv>Save rating</button><button class="b ghost" id=rcx>Cancel</button></div>`;
 $('#rcx').onclick=closeOv;$('#rsv').onclick=()=>{const v={};SKILLS.forEach(([s])=>v[s]=+$('#rt_'+s).value);PL.ratings[k]=v;planSave();const w=SKILLS.slice().sort((a,b)=>v[a[0]]-v[b[0]])[0][1];closeOv();alert('Saved. Your weakest skill this week: '+w+'. Give it extra practice in the next days.');planDraw()};
}
function planNotes(){
 const m=ov(),draw=()=>{m.innerHTML=`<div class=wrap style="padding-top:20px"><div class=row><h2 style=flex:1>Objection notebook</h2><button class="b s ghost" id=nx>Close</button></div><button class=b id=na>Add a note</button>${PL.notes.map((n,i)=>`<div class=card><b>${esc(n.o)}</b><div>${esc(n.a)}</div><div class=mu>${new Date(n.at).toLocaleDateString()}</div><button class="b s red" data-d=${i}>Delete</button></div>`).join('')||'<div class=card>Write each objection you hear and the answer that worked.</div>'}</div>`;
  $('#nx').onclick=closeOv;$('#na').onclick=()=>{const o=(prompt('What did the customer say?')||'').trim();if(!o)return;const a=(prompt('What answer worked, or what will you try?')||'').trim();PL.notes.unshift({o,a,at:Date.now()});planSave();draw()};
  m.onclick=e=>{const i=e.target.dataset.d;if(i!==undefined&&confirm('Delete this note?')){PL.notes.splice(+i,1);planSave();draw()}}};
 draw();
}
