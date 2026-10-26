let NOLOCK=0;
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
 ${canAdd()?'<button class="b s" id=pad>Add product</button><button class="b s ghost" id=pim>Import CSV</button><button class="b s ghost" id=pit>CSV template</button><button class="b s ghost" id=pip>Import photos</button><button class="b s ghost" id=psm>Sample CSV</button>':''}
 ${ME.role=='admin'?'<button class="b s ghost" id=pco>Show cost (30 s)</button>':''}<div id=pl></div>`;
 $('#pq').oninput=e=>{PQ.q=e.target.value.trim();drawProds()};
 $('#pq').onkeydown=e=>{if(e.key=='Enter')e.target.select()};
 $('#pm').oninput=e=>{PQ.max=e.target.value;drawProds()};
 $('#ps').onchange=e=>{PQ.sort=e.target.value;drawProds()};
 $('#pc').onchange=e=>{PQ.cat=e.target.value;drawProds()};
 $('#psc').onclick=()=>scanCam(c=>{PQ.q=c;$('#pq').value=c;drawProds()});
 if($('#pad'))$('#pad').onclick=()=>editForm({});
 if($('#pim'))$('#pim').onclick=importCsv;if($('#pit'))$('#pit').onclick=csvTemplate;if($('#pip'))$('#pip').onclick=bulkPhotos;if($('#psm'))$('#psm').onclick=()=>dl('products-sample',[CSVH,['Rana Hot Sauce 474ML',12.5,'Sauces','',12,'',24,'','','https://example.com/rana.jpg','']]);
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
  const ul=Object.keys(u).filter(k=>k!='pcs'&&u[k]&&u[k].qty).map(k=>`${u[k].label||k} x${u[k].qty} = ${money(p.rate*u[k].qty)}`).join(', ');
  return `<div class=card style="${p.active===false?'opacity:.5':''}"><div class=row>${p.img?`<img src="${p.img}" width=56 height=56 style="border-radius:8px;object-fit:cover">`:''}
  <div style=flex:1><b>${p.sl||''}. ${esc(p.name)}</b><div class=mu>${esc(p.category||'No category')}, ${esc(p.code||'no code')}</div></div>
  <div style=text-align:right><b>${money(p.rate)}</b><div class=mu>${money(vat(p.rate))} with VAT</div></div></div>
  <div class=mu>${ul}</div>${inS?'<span class="tag approved">In season</span> ':''}${p.active===false?'<span class="tag rejected">Inactive</span> ':''}
  ${showCost?`<span class="tag pending">Cost ${COSTMAP[p.id]??'-'}</span> `:''}${canAdd()?`<button class="b s ghost" data-edit=${p.id}>Edit</button>`:''}</div>`}).join('');
 L.innerHTML=h;
}
/* ----- add / edit form (simple) ----- */
const fitImg=(f,S=360,q=.82)=>new Promise(r=>{const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,S,S);const s=Math.min(S/im.width,S/im.height),w=im.width*s,h=im.height*s;x.imageSmoothingQuality='high';x.drawImage(im,(S-w)/2,(S-h)/2,w,h);r(c.toDataURL('image/jpeg',q));URL.revokeObjectURL(im.src)};im.onerror=()=>r(null);im.src=URL.createObjectURL(f)});
const shrink=(f,M=560,q=.72)=>new Promise(r=>{const im=new Image();im.onload=()=>{const s=Math.min(1,M/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);const x=c.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(im,0,0,c.width,c.height);r(c.toDataURL('image/jpeg',q));URL.revokeObjectURL(im.src)};im.onerror=()=>r(null);im.src=URL.createObjectURL(f)});
const thumb=f=>fitImg(f),blobThumb=f=>fitImg(f);
const usedBcs=()=>new Set(PRODS.flatMap(p=>p.bcs||[]));
function nextCode(used){let n=Math.max(100000,...PRODS.map(p=>+p.code||0),window.LASTC||0)+1;while(used.has(String(n)))n++;window.LASTC=n;used.add(String(n));return String(n)}
const autoBc=nextCode;
function catOpts(sel){const cs=[...new Set(PRODS.map(p=>p.category).filter(Boolean))].sort();return '<option value="">Choose category</option>'+cs.map(c=>`<option ${c==sel?'selected':''}>${esc(c)}</option>`).join('')+'<option value="__new">+ New category...</option>'}
function unitOpts(sel){const n=[...new Set(['Packet','Carton','Box','Dozen',...PRODS.flatMap(p=>Object.values(p.units||{}).map(u=>u.label).filter(Boolean))])].sort();if(sel&&!n.includes(sel))n.push(sel);return '<option value="">Choose unit</option>'+n.filter(x=>x!='Pcs').map(x=>`<option ${x==sel?'selected':''}>${esc(x)}</option>`).join('')+'<option value="__new">+ New unit...</option>'}
const urow=(n,q,bc)=>`<div class="card ur"><div class=row><select class=un>${unitOpts(n)}</select><input class=uq type=number placeholder="Pieces in it" value="${q||''}"><button class="b s ghost" type=button data-rm=1>X</button></div><div class=row><input class=ub inputmode=numeric placeholder="Printed barcode of this unit" value="${esc(bc||'')}"><button class="b s" type=button data-sc=1>Scan</button></div></div>`;
function editForm(p){
 IMG=null;const u=p.units||{},m=document.createElement('div');m.id='pf';
 m.style.cssText='position:fixed;inset:0;background:var(--bg);overflow:auto;z-index:20;padding:12px;padding-top:calc(12px + env(safe-area-inset-top))';
 const f=(i,l,v='',t='text')=>`<label class=mu>${l}</label><input id=f_${i} type=${t} value="${esc(v)}">`;
 const rows=Object.keys(u).filter(k=>k!='pcs'&&u[k]&&u[k].qty).map(k=>urow(u[k].label||k[0].toUpperCase()+k.slice(1),u[k].qty,u[k].bc)).join('');
 m.innerHTML=`<div class=wrap><h2>${p.id?'Edit':'New'} product</h2>
 <img id=f_pv src="${p.img||''}" style="display:${p.img?'block':'none'};width:100%;max-width:260px;aspect-ratio:1;object-fit:contain;background:#fff;border-radius:14px;margin:6px auto">
 <div class=row><button class="b ghost" id=f_cm type=button>Take photo</button><button class="b ghost" id=f_gl type=button>From gallery</button></div>
 <input id=f_rf type=file accept="image/*" capture=environment hidden><input id=f_rg type=file accept="image/*" hidden><p class=mu>The picture is resized and fitted to a clear square automatically.</p>
 ${f('name','Product name (brand, product, size)',p.name||'')}<label class=mu>Category</label><select id=f_cat>${catOpts(p.category)}</select>
 ${f('rate','Price per piece, without VAT',p.rate||'','number')}
 <label class=mu>Piece barcode (printed, optional)</label><div class=row><input id=f_b0 inputmode=numeric value="${esc((u.pcs&&u.pcs.bc)||'')}"><button class="b s" id=f_sb type=button>Scan</button></div>
 <label class=mu>Other units (packet, carton, box...)</label><div id=f_ul>${rows}</div><button class="b s ghost" id=f_au type=button>+ Add unit</button>
 ${f('code','System code (automatic, 6 digits)',p.code||'Created when you save','text').replace('<input','<input readonly')}
 <details><summary>More options</summary>${f('sl','SL (empty = next number)',p.sl||'')}${f('sf','Season from',p.seasonFrom||'','date')}${f('st','Season to',p.seasonTo||'','date')}${ME.role=='admin'?f('cost','Cost (empty = keep saved cost)','','number'):''}<label class=perm><input type=checkbox id=f_act ${p.active===false?'':'checked'}>Active</label></details>
 <p class=err id=fe></p><button class=b id=fs>Save product</button><button class="b ghost" id=fc>Cancel</button></div>`;
 document.body.appendChild(m);draftBind(m,'prod',p.id);
 $('#fc').onclick=()=>{draftClear();m.remove()};
 const ph=async e=>{const fl=e.target.files[0];if(!fl)return;const d=await fitImg(fl);if(d){IMG=d;$('#f_pv').src=d;$('#f_pv').style.display='block'}};
 $('#f_cm').onclick=()=>pickFile($('#f_rf'));$('#f_gl').onclick=()=>pickFile($('#f_rg'));$('#f_rf').onchange=ph;$('#f_rg').onchange=ph;
 $('#f_sb').onclick=()=>scanCam(c=>{$('#f_b0').value=c});
 $('#f_au').onclick=()=>$('#f_ul').insertAdjacentHTML('beforeend',urow('','',''));
 $('#f_ul').onclick=e=>{const d=e.target.dataset,r=e.target.closest('.ur');if(d.rm&&r)r.remove();if(d.sc&&r)scanCam(c=>{r.querySelector('.ub').value=c})};
 m.addEventListener('change',e=>{const t=e.target;if(t.value!='__new')return;const isU=t.classList.contains('un'),n=(prompt(isU?'New unit name (for example Box, Tray, Kg)':'New category name')||'').trim();if(n){t.add(new Option(n,n));t.value=n}else t.value=''});
 $('#fs').onclick=async()=>{
  const g=i=>$('#f_'+i).value.trim(),er=t=>$('#fe').textContent=t,rate=num(g('rate'));
  if(!g('name')||!rate)return er('Name and price are required.');
  const units={pcs:{bc:bcn(g('b0')),qty:1,label:'Pcs'}},names=new Set();
  for(const r of m.querySelectorAll('.ur')){const n=r.querySelector('.un').value,q=num(r.querySelector('.uq').value),bc=bcn(r.querySelector('.ub').value);if(!n&&!q&&!bc)continue;
   if(!n||!q)return er('Each unit needs a name and the number of pieces.');const k=n.toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g,'_');if(k=='pcs'||names.has(k))return er('Unit "'+n+'" is used twice.');names.add(k);units[k]={bc,qty:q,label:n}}
  const mb=Object.values(units).map(x=>x.bc).filter(Boolean);if(new Set(mb).size<mb.length)return er('Each unit needs its own barcode.');
  const dup=PRODS.find(x=>x.id!=p.id&&(x.bcs||[]).some(b=>mb.includes(b)));if(dup)return er('Barcode already used by '+dup.name);
  const code=p.code||nextCode(new Set([...usedBcs(),...mb])),bcs=[code,...mb],ref=p.id?db.doc('products/'+p.id):db.collection('products').doc();
  const d={sl:g('sl')?num(g('sl')):(p.sl||Math.max(0,...PRODS.map(x=>x.sl||0))+1),name:g('name'),category:g('cat')=='__new'?'':g('cat'),rate,code,units,bcs,active:$('#f_act').checked,seasonFrom:g('sf'),seasonTo:g('st'),updatedAt:Date.now(),updatedBy:U.uid};
  if(IMG)d.img=IMG;
  try{await ref.set(d,{merge:true});if(p.id)await ref.update({units});logAct(p.id?'Product edited':'Product added',d.name+', rate '+d.rate+(p.id&&p.rate!=d.rate?' (was '+p.rate+')':''));
   if(ME.role=='admin'&&g('cost')!=='')await db.doc('productCosts/'+ref.id).set({cost:num(g('cost'))});draftClear();m.remove()}catch(x){er(x.message)}
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
 if(!('BarcodeDetector' in window))return scanZx(cb);
 const det=new BarcodeDetector({formats:['ean_13','ean_8','upc_a','upc_e','code_128','code_39']}),v=document.createElement('video'),m=document.createElement('div');
 m.style.cssText='position:fixed;inset:0;background:#000;z-index:30;display:flex;flex-direction:column';
 v.style.cssText='flex:1;width:100%;object-fit:cover';v.setAttribute('playsinline','');m.appendChild(v);
 const x=document.createElement('button');x.className='b';x.textContent='Close';m.appendChild(x);document.body.appendChild(m);
 let st,stop=false;const end=()=>{stop=true;st&&st.getTracks().forEach(t=>t.stop());m.remove()};x.onclick=end;
 try{st=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});v.srcObject=st;await v.play()}catch(e){end();return alert('Camera blocked. Allow camera for this site.')}
 const t=setInterval(async()=>{if(stop)return clearInterval(t);try{const r=await det.detect(v);if(r.length){clearInterval(t);if(navigator.vibrate)navigator.vibrate(80);end();cb(r[0].rawValue)}}catch(e){}},300);
}
/* ----- CSV import (100+ lines, photos by image_url) ----- */
const CSVH=['name','rate','category','barcode','packet_qty','packet_barcode','carton_qty','carton_barcode','cost','image_url','sl'];
function importCsv(){
 const i=document.createElement('input');i.type='file';i.accept='.csv,text/csv';NOLOCK=Date.now()+180000;
 i.onchange=async()=>{
  const rows=(await i.files[0].text()).replace(/^\uFEFF/,'').split(/\r?\n/).filter(r=>r.trim()).map(r=>r.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map(c=>c.replace(/,$/,'').replace(/^"|"$/g,'').replace(/""/g,'"').trim()));
  const H=rows.shift().map(h=>h.toLowerCase().replace(/[^a-z_]/g,'')),ix=k=>H.indexOf(k);
  if(ix('name')<0||ix('rate')<0)return alert('CSV needs at least the columns: name, rate. Use the Sample CSV button for the full pattern.');
  const t=document.createElement('div');t.style.cssText='position:fixed;left:12px;right:12px;top:80px;z-index:50;background:var(--card);border:2px solid var(--pr);border-radius:12px;padding:12px';document.body.appendChild(t);
  const UB=[];let b=db.batch(),n=0,tot=0,pic=0,miss=0,auto=0,nx=Math.max(0,...PRODS.map(x=>x.sl||0))+1;const used=usedBcs(),c=(r,k)=>ix(k)<0?'':(r[ix(k)]||'');
  for(const r of rows){
   t.textContent='Importing '+(tot+1)+' of '+rows.length+'…';
   const name=c(r,'name'),rate=num(c(r,'rate'));if(!name||!rate)continue;
   const old=PRODS.find(x=>x.name.toLowerCase()==name.toLowerCase())||PRODS.find(x=>c(r,'barcode')&&(x.bcs||[]).includes(bcn(c(r,'barcode'))));
   const bc={pcs:bcn(c(r,'barcode')),packet:bcn(c(r,'packet_barcode')),carton:bcn(c(r,'carton_barcode'))};
   if(!bc.pcs&&old&&old.units&&old.units.pcs)bc.pcs=old.units.pcs.bc||'';const code=(old&&old.code)||autoBc(used);if(!old||!old.code)auto++;
   const bcs=[...new Set([code,...(old&&old.bcs||[]),...Object.values(bc).filter(Boolean)])],ref=old?db.doc('products/'+old.id):db.collection('products').doc();
   const d={sl:c(r,'sl')?num(c(r,'sl')):(old?old.sl:nx++),name,category:c(r,'category'),rate,code,units:{pcs:{bc:bc.pcs,qty:1,label:'Pcs'},packet:{bc:bc.packet,qty:num(c(r,'packet_qty'))},carton:{bc:bc.carton,qty:num(c(r,'carton_qty'))}},bcs,active:true,updatedAt:Date.now(),updatedBy:U.uid};
   const url=c(r,'image_url');if(url)try{const rs=await fetch(url);if(!rs.ok)throw 0;d.img=await blobThumb(await rs.blob());pic++}catch(e){miss++}
   b.set(ref,d,{merge:true});n++;
   if(ME.role=='admin'&&c(r,'cost')!=='')b.set(db.doc('productCosts/'+ref.id),{cost:num(c(r,'cost'))});
   if(++tot%100==0){await b.commit();b=db.batch()}
  }
  await b.commit();t.remove();alert(n+' products imported or updated.\n'+auto+' got an automatic 6-digit barcode.\n'+pic+' pictures added'+(miss?', '+miss+' pictures could not be loaded (the link must be a direct image link that allows access).':'.'));
 };i.click();
}
/* iPhone / browsers without BarcodeDetector: ZXing library, loads once (needs internet the first time) */
async function scanZx(cb){
 if(!window.ZXing)try{await new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';s.onload=ok;s.onerror=no;document.head.appendChild(s)})}catch(e){return alert('Needs internet the first time to load the scanner.')}
 const F=ZXing.BarcodeFormat,h=new Map([[ZXing.DecodeHintType.POSSIBLE_FORMATS,[F.EAN_13,F.EAN_8,F.UPC_A,F.UPC_E,F.CODE_128,F.CODE_39]]]),r=new ZXing.BrowserMultiFormatReader(h),v=document.createElement('video'),m=document.createElement('div');
 m.style.cssText='position:fixed;inset:0;background:#000;z-index:30;display:flex;flex-direction:column';v.style.cssText='flex:1;width:100%;object-fit:cover';v.setAttribute('playsinline','');v.muted=true;m.appendChild(v);
 const x=document.createElement('button');x.className='b';x.textContent='Close';m.appendChild(x);document.body.appendChild(m);
 const end=()=>{try{r.reset()}catch(e){}m.remove()};x.onclick=end;
 r.decodeFromVideoDevice(null,v,res=>{if(res){if(navigator.vibrate)navigator.vibrate(80);end();cb(res.getText())}}).catch(()=>{end();alert('Camera blocked. Allow camera for this site.')});
}
