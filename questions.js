/* Customer questions. Answers are private: only the person who recorded them can read them (Firestore rules). The admin switches the feature on per user and edits the question list. */
const QS0=[
"prod|Which of our products sells fastest in your shop?|ما أكثر منتجاتنا مبيعًا في محلك؟",
"prod|Which product do customers ask for that you don't have?|ما المنتج الذي يطلبه الزبائن ولا يتوفر عندك؟",
"ch:Fair,Too expensive,Cheap|How is our price compared with others?|كيف تجد أسعارنا مقارنة بغيرنا؟",
"note|Which competing brand sells most here, and why?|ما العلامة المنافسة الأكثر مبيعًا هنا ولماذا؟",
"yn|Do you have enough freezer space?|هل لديك مساحة كافية في الثلاجة؟",
"yn|Is our product easy to see on your shelf or freezer?|هل منتجنا ظاهر بوضوح في العرض عندك؟",
"ch:Never,Sometimes,Often|Any complaints, such as melted, damaged or near expiry?|هل لديك شكاوى مثل الذوبان أو التلف أو قرب الانتهاء؟",
"score|How happy are you with our delivery time? (1 to 5)|ما رضاك عن موعد التوصيل؟ (1 إلى 5)",
"ch:Cash,Credit,Either|Do you prefer cash or credit?|هل تفضل الدفع نقدًا أم آجلًا؟",
"note|Which visit day or time suits you best?|ما اليوم أو الوقت المناسب لزيارتنا؟",
"yn|Would you try a new product or a special pack?|هل تجرب منتجًا جديدًا أو عبوة خاصة؟",
"note|How much do you expect to need next week?|كم تتوقع أن تحتاج الأسبوع القادم؟",
"score|How satisfied are you with our service overall? (1 to 5)|ما رضاك العام عن خدمتنا؟ (1 إلى 5)"];
const qList=()=>((CFG.questions&&CFG.questions.length)?CFG.questions:QS0).map(l=>{const [t,e,a]=l.split('|').map(x=>x.trim());return {t,e,a:a||''}}).filter(x=>x.t&&x.e);
const hasQ=()=>!!ME&&(ME.role=='admin'||!!(ME.perms&&ME.perms.custQ));
async function myAnswers(cid){let q=db.collection('custAnswers').where('uid','==',U.uid);if(cid)q=q.where('cid','==',cid);return (await q.get()).docs.map(d=>({id:d.id,...d.data()}))}
async function askQs(c){
 loadCash();let old=[];try{old=await myAnswers(c.id)}catch(e){}
 const last={};old.forEach(a=>{last[a.q]=Math.max(last[a.q]||0,a.at)});
 const n=Math.min(3,Math.max(1,CFG.qPerVisit||3)),Q=qList().sort((x,y)=>(last[x.e]||0)-(last[y.e]||0)).slice(0,n);
 if(!Q.length)return;
 let i=0;const m=ov();OV=null;
 const save=a=>{const q=Q[i];if(a!==null&&a!=='')db.collection('custAnswers').add({cid:c.id,cname:c.nameEn||c.nameAr,uid:U.uid,q:q.e,t:q.t,a:String(a),at:Date.now(),day:todayD()});i++;show()};
 const show=()=>{
  if(i>=Q.length){m.innerHTML='<div class=wrap style="padding-top:20px"><h2>Thank you</h2><p class=mu>Your answers are saved privately for you.</p><button class=b id=qd>Close</button></div>';$('#qd').onclick=closeOv;return}
  const q=Q[i],T=q.t,btn=v=>`<button class="b ghost" data-a="${esc(v)}" style="min-height:60px">${esc(v)}</button>`,box='style="width:100%;padding:10px;border:1.5px solid var(--bd);border-radius:12px;background:var(--card);color:var(--tx);font:inherit"';
  let body='';
  if(T=='yn')body=['Yes','No','Maybe'].map(btn).join('');
  else if(T=='score')body=`<div class=row style="gap:6px">${[1,2,3,4,5].map(x=>`<button class="b ghost" data-a=${x} style="min-height:60px;flex:1">${x}</button>`).join('')}</div>`;
  else if(T.startsWith('ch:'))body=T.slice(3).split(',').map(x=>btn(x.trim())).join('');
  else if(T=='prod'&&PRODS.length)body=`<input id=qs placeholder="Search one of our products"><div id=qr></div><input id=qf placeholder="Not in our list? Type the name"><button class=b id=qfs>Save typed name</button><button class="b ghost" data-a="None">Nothing</button>`;
  else body=`<textarea id=qn rows=3 ${box}></textarea><button class=b id=qsv>Save answer</button>`;
  m.innerHTML=`<div class=wrap style="padding-top:20px"><div class=row><span class=mu style=flex:1>${esc(c.nameEn||'')}, question ${i+1} of ${Q.length}</span><button class="b s ghost" id=qx>Stop</button></div><h2 style="margin:10px 0 4px">${esc(q.e)}</h2>${q.a?`<div dir=rtl style="font-size:19px;margin-bottom:12px">${esc(q.a)}</div>`:''}${body}<button class="b ghost" id=qk style="margin-top:14px">Skip this question</button></div>`;
  $('#qx').onclick=closeOv;$('#qk').onclick=()=>save(null);
  m.onclick=e=>{const a=e.target.dataset.a;if(a!==undefined){save(a);return}const p=e.target.closest('[data-p]');if(p)save(p.dataset.p)};
  if($('#qsv'))$('#qsv').onclick=()=>save($('#qn').value.trim());
  if($('#qfs'))$('#qfs').onclick=()=>save($('#qf').value.trim());
  if($('#qs'))$('#qs').oninput=e=>{const s=e.target.value.trim().toLowerCase(),r=s?PRODS.filter(p=>(p.name+' '+p.sl).toLowerCase().includes(s)).slice(0,6):[];$('#qr').innerHTML=r.map(p=>`<div class=card data-p="${esc(p.name)}">${esc(p.name)}</div>`).join('')};
 };
 show();
}
async function insightsView(el){
 el.innerHTML='<p class=mu>Loading...</p>';let A=[];
 try{A=(await myAnswers()).filter(a=>a.at>=Date.now()-90*864e5)}catch(e){el.innerHTML='<div class=card>Could not load. Check the internet and that the admin turned this on for you.</div>';return}
 const by={};A.forEach(a=>(by[a.q]=by[a.q]||[]).push(a));
 const tops=a=>{const c={};a.forEach(x=>c[x.a]=(c[x.a]||0)+1);return Object.entries(c).sort((x,y)=>y[1]-x[1])};
 el.innerHTML=`<button class="b s ghost" onclick="sig='';route()">Back</button><h2>My customer insights</h2><p class=mu>Last 90 days. Only you can see these answers. ${A.length<20?'You have few answers so far, so treat them as a signal, not a fact.':''}</p>`+
 (Object.keys(by).map(q=>{const a=by[q],t=a[0].t;let s='';
  if(t=='score')s=`<b>Average ${(a.reduce((z,x)=>z+(+x.a||0),0)/a.length).toFixed(1)} of 5</b>`;
  else if(t=='note')s=a.slice().sort((x,y)=>y.at-x.at).slice(0,5).map(x=>`<div class=mu>${esc(x.cname)}: ${esc(x.a)}</div>`).join('');
  else s=tops(a).slice(0,5).map(([k,n])=>`<div class=row><span style=flex:1>${esc(k)}</span><b>${n}</b></div>`).join('');
  return `<div class=card><b>${esc(q)}</b><div class=mu>${a.length} answers</div>${s}</div>`}).join('')||'<div class=card>No answers yet. Check in at a customer and answer the questions.</div>');
}
async function qShopNotes(c){
 if(!hasQ())return;const m=$('#ov');if(!m)return;let a=[];try{a=(await myAnswers(c.id)).sort((x,y)=>y.at-x.at).slice(0,6)}catch(e){return}
 m.insertAdjacentHTML('beforeend',`<div class=card><b>What this shop told us</b>${a.map(x=>`<div class=mu style="margin-top:6px">${new Date(x.at).toLocaleDateString()}: ${esc(x.q)}<br><b style="color:var(--tx)">${esc(x.a)}</b></div>`).join('')||'<div class=mu>No answers yet.</div>'}</div><button class=b id=qak>Ask questions now</button>`);
 const b=$('#qak');if(b)b.onclick=()=>askQs(c);
}
