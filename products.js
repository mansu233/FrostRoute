/* Phase 2: products, units, barcodes, VAT, cost PIN, CSV import */
let PRODS=[],pUnsub=null,PQ={q:'',cat:'',max:'',sort:'name'},COSTOK=0,COSTMAP={},IMG=null;
const canAdd=()=>ME.role=='admin'||(ME.perms&&ME.perms.addProducts);
const dg=s=>String(s??'').replace(/[٠-٩]/g,d=>d.charCodeAt(0)-1632);
const bcn=s=>dg(s).trim().toUpperCase(),num=s=>+dg(s).replace(/[^\d.]/g,'')||0;
const money=n=>(+n).toFixed(2),vat=p=>p*(1+(CFG.vatPercent||0)/100);

function productsView(el,member){
 el.innerHTML=`${member?'<button class="b s ghost" onclick="sig=\'\';route()">Back</button>':''}
 <div class=row><input id=pq placeholder="Search name, barcode, SL" value="${esc(PQ.q)}"><button class="b s" id=psc>Scan</button></div>
 <div class=row><select id=pc></select><input id=pm type=number placeholder="Max price" value="${PQ.max}"><select id=ps>
 ${[['name','A-Z'],['lo','Price low'],['hi','Price high'],['sl','SL']].map(x=>`<option value=${x[0]} ${PQ.sort==x[0]?'selected':''}>${x[1]}</option>`).join('')}</select></div>
 ${canAdd()?'<button class="b s" id=pad>Add product</button><button class="b s ghost" id=pim>Import CSV</button>':''}
 ${ME.role=='admin'?'<button class="b s ghost" id=pco>Show cost (30 s)</button>':''}<div id=pl></div>`;
 $('#pq').oninput=e=>{PQ.q=e.target.value.trim();drawProds()};
 $('#pq').onkeydown=e=>{if(e.key=='Enter')e.target.select()};
 $('#pm').oninput=e=>{PQ.max=e.target.value;drawProds()};
 $('#ps').onchange=e=>{PQ.sort=e.target.value;drawProds()};
 $('#pc').onchange=e=>{PQ.cat=e.target.value;drawProds()};
 $('#psc').onclick=()=>scanCam(c=>{PQ.q=c;$('#pq').value=c;drawProds()});
 if($('#pad'))$('#pad').onclick=()=>editForm({});
 if($('#pim'))$('#pim').onclick=importCsv;
 if($('#pco'))$('#pco').onclick=showCost;
 $('#pl').onclick=e=>{const d=e.target.dataset;if(d.edit)editForm(PRODS.find(p=>p.id==d.edit));if(d.newbc)editForm({bcs:[d.newbc],units:{pcs:{bc:d.newbc}}})};
 if(!pUnsub)pUnsub=db.collection('products').onSnapshot(s=>{PRODS=s.docs.map(d=>({id:d.id,...d.data()}));drawProds()},()=>{pUnsub=null});
 drawProds();
}
function drawProds(){
 const L=$('#pl');if(!L)return;
 const q=PQ.q.toLowerCase(),today=new Date().toISOString().slice(0,10),admin=ME.role=='admin';
 const cats=[...new Set(PRODS.map(p=>p.category).filter(Boolean))].sort();
 $('#pc').innerHTML='<option value="">All categories</option>'+cats.map(c=>`<option ${c==PQ.cat?'selected':''}>${esc(c)}</option>`).join('');
 const a=PRODS.filter(p=>(admin||p.active!==false)&&(!q||(p.name+' '+p.sl+' '+(p.bcs||[]).join(' ')+' '+(p.category||'')).toLowerCase().includes(q))&&(!PQ.cat||p.category==PQ.cat)&&(!PQ.max||p.rate<=+PQ.max));
 a.sort((x,y)=>PQ.sort=='lo'?x.rate-y.rate:PQ.sort=='hi'?y.rate-x.rate:PQ.sort=='sl'?(x.sl||0)-(y.sl||0):x.name.localeCompare(y.name));
 const showCost=admin&&COSTOK>Date.now();
 let h=`<p class=mu>${a.length} of ${PRODS.length} products. VAT ${CFG.vatPercent}% added automatically.</p>`;
 if(!a.length&&/^[0-9A-Z-]{6,}$/i.test(q)&&canAdd())h+=`<div class=card>Barcode not found. <button class="b s" data-newbc="${esc(bcn(q))}">Add as new product</button></div>`;
 h+=a.map(p=>{const u=p.units||{},inS=p.seasonFrom&&p.seasonTo&&today>=p.seasonFrom&&today<=p.seasonTo;
  const ul=['packet','carton'].filter(k=>u[k]&&u[k].qty).map(k=>`${k} x${u[k].qty} = ${money(p.rate*u[k].qty)}`).join(', ');
  return `<div class=card style="${p.active===false?'opacity:.5':''}"><div class=row>${p.img?`<img src="${p.img}" width=56 height=56 style="border-radius:8px;object-fit:cover">`:''}
  <div style=flex:1><b>${p.sl||''}. ${esc(p.name)}</b><div class=mu>${esc(p.category||'No category')}, ${esc((p.bcs||[])[0]||'no barcode')}</div></div>
  <div style=text-align:right><b>${money(p.rate)}</b><div class=mu>${money(vat(p.rate))} with VAT</div></div></div>
  <div class=mu>${ul}</div>${inS?'<span class="tag approved">In season</span> ':''}${p.active===false?'<span class="tag rejected">Inactive</span> ':''}
  ${showCost?`<span class="tag pending">Cost ${COSTMAP[p.id]??'-'}</span> `:''}${canAdd()?`<button class="b s ghost" data-edit=${p.id}>Edit</button>`:''}</div>`}).join('');
 L.innerHTML=h;
}
/* ----- add / edit form ----- */
function editForm(p){
 IMG=null;const u=p.units||{},m=document.createElement('div');m.id='pf';
 m.style.cssText='position:fixed;inset:0;background:var(--bg);overflow:auto;z-index:20;padding:12px;padding-top:calc(12px + env(safe-area-inset-top))';
 const f=(i,l,v='',t='text')=>`<label class=mu>${l}</label><input id=f_${i} type=${t} value="${esc(v)}">`;
 m.innerHTML=`<div class=wrap><h2>${p.id?'Edit':'New'} product</h2>${f('sl','SL (blank = next number)',p.sl||'')}${f('name','Product name',p.name||'')}${f('cat','Category',p.category||'')}
 ${f('rate','Sales rate per piece, without VAT',p.rate||'','number')}${f('b0','Piece barcode',(u.pcs&&u.pcs.bc)||(p.bcs||[])[0]||'')}
 ${f('q1','Pieces per packet',(u.packet&&u.packet.qty)||'','number')}${f('b1','Packet barcode',(u.packet&&u.packet.bc)||'')}
 ${f('q2','Pieces per carton',(u.carton&&u.carton.qty)||'','number')}${f('b2','Carton barcode',(u.carton&&u.carton.bc)||'')}
 ${f('sf','Season from',p.seasonFrom||'','date')}${f('st','Season to',p.seasonTo||'','date')}
 ${ME.role=='admin'?f('cost','Cost (leave empty to keep the saved cost)','','number'):''}
 <label class=mu>Image</label><input id=f_img type=file accept="image/*" capture=environment>
 <label class=perm><input type=checkbox id=f_act ${p.active===false?'':'checked'}>Active</label><p class=err id=fe></p>
 <button class=b id=fs>Save product</button><button class="b ghost" id=fc>Cancel</button></div>`;
 document.body.appendChild(m);
 $('#fc').onclick=()=>m.remove();
 $('#f_img').onchange=e=>{const fl=e.target.files[0];if(!fl)return;const im=new Image();im.onload=()=>{const c=document.createElement('canvas'),s=Math.min(1,160/Math.max(im.width,im.height));c.width=im.width*s;c.height=im.height*s;c.getContext('2d').drawImage(im,0,0,c.width,c.height);IMG=c.toDataURL('image/jpeg',.6)};im.src=URL.createObjectURL(fl)};
 $('#fs').onclick=async()=>{
  const g=i=>$('#f_'+i).value.trim(),bc={pcs:bcn(g('b0')),packet:bcn(g('b1')),carton:bcn(g('b2'))},q1=num(g('q1')),q2=num(g('q2')),rate=num(g('rate')),er=t=>$('#fe').textContent=t;
  if(!g('name')||!rate)return er('Name and rate are required.');
  if((bc.packet&&!q1)||(bc.carton&&!q2))return er('Enter pieces per packet / carton.');
  const bcs=Object.values(bc).filter(Boolean);if(new Set(bcs).size<bcs.length)return er('Each unit needs its own barcode.');
  const dup=PRODS.find(x=>x.id!=p.id&&(x.bcs||[]).some(b=>bcs.includes(b)));if(dup)return er('Barcode already used by '+dup.name);
  const ref=p.id?db.doc('products/'+p.id):db.collection('products').doc();
  const d={sl:g('sl')?num(g('sl')):(p.sl||Math.max(0,...PRODS.map(x=>x.sl||0))+1),name:g('name'),category:g('cat'),rate,
   units:{pcs:{bc:bc.pcs},packet:{bc:bc.packet,qty:q1},carton:{bc:bc.carton,qty:q2}},bcs,active:$('#f_act').checked,seasonFrom:g('sf'),seasonTo:g('st'),updatedAt:Date.now(),updatedBy:U.uid};
  if(IMG)d.img=IMG;
  try{await ref.set(d,{merge:true});if(ME.role=='admin'&&g('cost')!=='')await db.doc('productCosts/'+ref.id).set({cost:num(g('cost'))});m.remove()}catch(x){er(x.message)}
 };
}
/* ----- cost PIN (admin only, auto-hides after 30 s) ----- */
async function showCost(){
 const r=db.doc('productCosts/_pin'),s=await r.get();
 if(!s.exists){const n=prompt('Create a cost PIN (4 to 8 digits)');if(!/^\d{4,8}$/.test(n||''))return;await r.set({h:await hash(n,'cost')});alert('Cost PIN saved. Tap Show cost again.');return}
 const v=prompt('Enter cost PIN');if(!v)return;
 if(await hash(v,'cost')!==s.data().h)return alert('Wrong cost PIN.');
 COSTMAP={};(await db.collection('productCosts').get()).forEach(d=>{if(d.id!='_pin')COSTMAP[d.id]=d.data().cost});
 COSTOK=Date.now()+30000;drawProds();setTimeout(()=>{COSTOK=0;COSTMAP={};drawProds()},30500);
}
/* ----- camera barcode scan (1D only, no QR) ----- */
async function scanCam(cb){
 if(!('BarcodeDetector' in window))return alert('Camera scan needs Chrome on Android. Use a Bluetooth scanner or type the barcode. iPhone camera scan comes in a later version.');
 const det=new BarcodeDetector({formats:['ean_13','ean_8','upc_a','upc_e','code_128','code_39']}),v=document.createElement('video'),m=document.createElement('div');
 m.style.cssText='position:fixed;inset:0;background:#000;z-index:30;display:flex;flex-direction:column';
 v.style.cssText='flex:1;width:100%;object-fit:cover';v.setAttribute('playsinline','');m.appendChild(v);
 const x=document.createElement('button');x.className='b';x.textContent='Close';m.appendChild(x);document.body.appendChild(m);
 let st,stop=false;const end=()=>{stop=true;st&&st.getTracks().forEach(t=>t.stop());m.remove()};x.onclick=end;
 try{st=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});v.srcObject=st;await v.play()}catch(e){end();return alert('Camera blocked. Allow camera for this site.')}
 const t=setInterval(async()=>{if(stop)return clearInterval(t);try{const r=await det.detect(v);if(r.length){clearInterval(t);if(navigator.vibrate)navigator.vibrate(80);end();cb(r[0].rawValue)}}catch(e){}},300);
}
/* ----- CSV import ----- */
function importCsv(){
 const i=document.createElement('input');i.type='file';i.accept='.csv,text/csv';
 i.onchange=async()=>{
  const rows=(await i.files[0].text()).replace(/^\uFEFF/,'').split(/\r?\n/).filter(r=>r.trim()).map(r=>r.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map(c=>c.replace(/,$/,'').replace(/^"|"$/g,'').replace(/""/g,'"').trim()));
  const H=rows.shift().map(h=>h.toLowerCase().replace(/[^a-z_]/g,'')),ix=k=>H.indexOf(k);
  if(ix('name')<0||ix('rate')<0)return alert('CSV needs at least the columns: name, rate. Optional: sl, barcode, category, packet_qty, packet_barcode, carton_qty, carton_barcode, cost');
  let b=db.batch(),n=0,tot=0,nx=Math.max(0,...PRODS.map(x=>x.sl||0))+1;
  const c=(r,k)=>ix(k)<0?'':(r[ix(k)]||'');
  for(const r of rows){
   const name=c(r,'name'),rate=num(c(r,'rate'));if(!name||!rate)continue;
   const bc={pcs:bcn(c(r,'barcode')),packet:bcn(c(r,'packet_barcode')),carton:bcn(c(r,'carton_barcode'))},bcs=Object.values(bc).filter(Boolean);
   const old=PRODS.find(x=>(x.bcs||[]).some(y=>bcs.includes(y))),ref=old?db.doc('products/'+old.id):db.collection('products').doc();
   b.set(ref,{sl:c(r,'sl')?num(c(r,'sl')):(old?old.sl:nx++),name,category:c(r,'category'),rate,units:{pcs:{bc:bc.pcs},packet:{bc:bc.packet,qty:num(c(r,'packet_qty'))},carton:{bc:bc.carton,qty:num(c(r,'carton_qty'))}},bcs,active:true,updatedAt:Date.now(),updatedBy:U.uid},{merge:true});n++;
   if(ME.role=='admin'&&c(r,'cost')!=='')b.set(db.doc('productCosts/'+ref.id),{cost:num(c(r,'cost'))});
   if(++tot%200==0){await b.commit();b=db.batch()}
  }
  await b.commit();alert(n+' products imported or updated.');
 };i.click();
}
