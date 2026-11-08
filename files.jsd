/* Customer photos and documents, automatic customer serial code, cost PIN reset */
const hasF=()=>!!ME&&(ME.role=='admin'||!!(ME.perms&&ME.perms.custFiles)),FL={photo:'Freezer photos',doc:'Business documents'};
let FILES=[];
/* ---- automatic customer code ---- */
const nextCustCode=()=>Promise.race([db.runTransaction(async t=>{const r=db.doc('meta/custSeq'),s=await t.get(r),n=s.exists?s.data().n+1:1001;t.set(r,{n});return n}),new Promise((_,no)=>setTimeout(()=>no(new Error('offline')),8000))]);
async function fixCodes(){if(!navigator.onLine||window._fc||typeof CUST=='undefined')return;const p=CUST.filter(c=>c.codePending&&(ME.role=='admin'||c.owner==U.uid));if(!p.length)return;window._fc=1;try{for(const c of p){const n=await nextCustCode();await db.doc('customers/'+c.id).update({code:String(n),codePending:false})}}catch(e){}window._fc=0}
setInterval(()=>{if(typeof U!='undefined'&&U&&ME)fixCodes()},60000);
/* ---- cost PIN reset (admin account password) ---- */
async function resetCostPin(){const pw=prompt('Enter your admin account password');if(!pw)return;
 try{await auth.currentUser.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(U.email,pw))}catch(e){return alert('Wrong password.')}
 const n=prompt('New cost PIN (4 to 8 digits)');if(!/^\d{4,8}$/.test(n||''))return;await db.doc('productCosts/_pin').set({h:await hash(n,'cost')});logAct('Cost PIN reset','');alert('Cost PIN changed. Tap Show cost again.')}
/* ---- image and PDF helpers ---- */
const loadSrc=s=>new Promise(ok=>{const i=new Image();i.onload=()=>ok(i);i.src=s});
const loadScript=u=>new Promise((ok,no)=>{const s=document.createElement('script');s.src=u;s.onload=ok;s.onerror=()=>no(new Error('Needs internet the first time'));document.head.appendChild(s)});
async function procImg(f,max,q,stamp){const im=await loadSrc(URL.createObjectURL(f)),s=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);const x=c.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(im,0,0,c.width,c.height);
 if(stamp){const h=Math.max(20,Math.round(c.width/34));x.fillStyle='rgba(0,0,0,.55)';x.fillRect(0,c.height-h*1.7,c.width,h*1.7);x.fillStyle='#fff';x.font=h+'px sans-serif';x.fillText(stamp,h*.4,c.height-h*.55)}return c.toDataURL('image/jpeg',q)}
async function pdfPages(f){if(!window.pdfjsLib){await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'}
 const d=await pdfjsLib.getDocument({data:await f.arrayBuffer()}).promise,o=[];for(let i=1;i<=Math.min(2,d.numPages);i++){const p=await d.getPage(i),v=p.getViewport({scale:1100/p.getViewport({scale:1}).width}),c=document.createElement('canvas');c.width=v.width;c.height=v.height;await p.render({canvasContext:c.getContext('2d'),viewport:v}).promise;o.push(c.toDataURL('image/jpeg',.68))}return o}
async function filePdf(f){if(!window.jspdf)await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');const p=new window.jspdf.jsPDF({unit:'pt',format:'a4'});
 for(let i=0;i<f.pages.length;i++){if(i)p.addPage();const im=await loadSrc(f.pages[i]),s=Math.min(595/im.width,842/im.height);p.addImage(f.pages[i],'JPEG',(595-im.width*s)/2,(842-im.height*s)/2,im.width*s,im.height*s)}return p.output('blob')}
async function fileBlob(f){return f.slot=='doc'?{b:await filePdf(f),n:(f.cap||'document')+'.pdf'}:{b:await (await fetch(f.pages[0])).blob(),n:(f.cap||'freezer')+'.jpg'}}
async function fileOut(f,share){try{const {b,n}=await fileBlob(f),nm=n.replace(/[^\w.-]+/g,'_'),file=new File([b],nm,{type:b.type});
 if(share&&navigator.canShare&&navigator.canShare({files:[file]}))return navigator.share({files:[file],title:f.cap||nm});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=nm;a.click()}catch(e){alert(e.message)}}
/* ---- add a file ---- */
function addFile(c,slot,kind){
 const inp=document.createElement('input');inp.type='file';inp.accept=kind=='pdf'?'application/pdf':'image/*';if(kind=='cam')inp.capture='environment';
 inp.onchange=async()=>{const f=inp.files[0];if(!f)return;
  try{const st=slot=='photo'?new Date().toLocaleString('en-GB')+' | '+(c.nameEn||'')+' | '+ME.name:'',pages=kind=='pdf'?await pdfPages(f):[await procImg(f,slot=='photo'?1000:1300,slot=='photo'?.75:.68,st)];
   if(pages.reduce((s,x)=>s+x.length,0)>950000)return alert('This file is too large. Use a smaller or clearer picture.');
   const cap=(prompt(slot=='photo'?'Freezer serial number or a note (optional)':'What is this document? (optional)')||'').trim();
   db.collection('custFiles').add({cid:c.id,cname:c.nameEn||c.nameAr,owner:c.owner||U.uid,uid:U.uid,by:ME.name,slot,cap,pages,at:Date.now()}).catch(e=>alert('The file could not be saved: '+e.message+'. Ask the admin to check the permission and publish the latest rules.'));logAct('Customer file added',(c.nameEn||'')+', '+FL[slot])}catch(e){alert('Could not read this file. '+e.message)}};
 pickFile(inp);
}
/* ---- gallery (hidden until opened from the profile) ---- */
function filesView(c){
 const m=ov();OV=null;window.fUn&&window.fUn();let q=db.collection('custFiles').where('cid','==',c.id);if(ME.role!='admin')q=q.where('owner','==',U.uid);
 const draw=()=>{m.innerHTML=`<div class=row style="padding:8px 0"><button class="b s ghost" id=fbk>Back</button><h2 style=flex:1>${esc(c.nameEn)}</h2></div><p class=mu>Freezer photos are proof of the freezer given. Business papers are kept for security on future cash transactions. Only you and the admin can see them.</p>`+
  ['photo','doc'].map(sl=>{const a=FILES.filter(x=>x.slot==sl).sort((x,y)=>x.at-y.at);return `<div class=card><b>${FL[sl]} (${a.length} of 2)</b><div class=row style="flex-wrap:wrap;align-items:flex-start;margin-top:8px">${a.map(x=>`<div data-v=${x.id} style="width:47%;cursor:pointer"><img src="${x.pages[0]}" style="width:100%;height:130px;object-fit:cover;border-radius:10px"><div class=mu>${esc(x.cap||'')} ${x.pages.length>1?'('+x.pages.length+' pages)':''}<br>${new Date(x.at).toLocaleDateString()}, ${esc(x.by)}</div></div>`).join('')}</div>${a.length<2?`<div class=row style="flex-wrap:wrap"><button class="b s" data-add=${sl} data-k=cam>Take photo</button><button class="b s ghost" data-add=${sl} data-k=gal>From gallery</button>${sl=='doc'?'<button class="b s ghost" data-add=doc data-k=pdf>PDF</button>':''}</div>`:''}</div>`}).join('');
  $('#fbk').onclick=()=>{window.fUn&&window.fUn();window.fUn=null;profileView(c)};
  m.onclick=e=>{const d=e.target.dataset,v=e.target.closest('[data-v]');if(d.add)return FILES.filter(x=>x.slot==d.add).length>=2?alert('Maximum 2. Delete one first.'):addFile(c,d.add,d.k);if(v)fileViewer(FILES.find(x=>x.id==v.dataset.v))}};
 window.fUn=q.onSnapshot(s=>{FILES=s.docs.map(d=>({id:d.id,...d.data()}));draw()},()=>{m.innerHTML='<div class=wrap><button class="b s ghost" onclick="closeOv()">Back</button><div class=card>Could not load. Check the internet, the admin permission and that the latest rules are published.</div></div>'});
}
/* ---- viewer: zoom, page, download, share, rotate, caption, delete with code ---- */
function fileViewer(f){
 if(!f)return;let pg=0,zm=1;const w=document.createElement('div');w.style.cssText='position:fixed;inset:0;background:#000;z-index:60;display:flex;flex-direction:column';document.body.appendChild(w);
 const draw=()=>{w.innerHTML=`<div style="display:flex;gap:6px;padding:8px;flex-wrap:wrap;background:#111"><button class="b s" id=vb>Back</button><button class="b s ghost" id=vz>Zoom +</button><button class="b s ghost" id=vm>Zoom -</button><button class="b s ghost" id=vd>Download</button><button class="b s ghost" id=vs>Share</button><button class="b s ghost" id=vr>Rotate</button><button class="b s ghost" id=ve>Caption</button><button class="b s red" id=vx>Delete</button></div>
  <div style="color:#fff;padding:4px 10px;font-size:13px">${esc(f.cap||FL[f.slot])}, ${new Date(f.at).toLocaleString()}, ${esc(f.by)}${f.pages.length>1?', page '+(pg+1)+' of '+f.pages.length:''}</div>
  <div style="flex:1;overflow:auto;text-align:center"><img id=vi src="${f.pages[pg]}" style="width:${zm*100}%;max-width:none"></div>${f.pages.length>1?'<div class=row style="padding:8px;background:#111"><button class="b s ghost" id=vp>Previous page</button><button class="b s ghost" id=vn>Next page</button></div>':''}`;
  $('#vb').onclick=()=>w.remove();$('#vz').onclick=()=>{zm=Math.min(4,zm+.5);draw()};$('#vm').onclick=()=>{zm=Math.max(1,zm-.5);draw()};$('#vi').ondblclick=()=>{zm=zm>1?1:2.5;draw()};
  $('#vd').onclick=()=>fileOut(f,false);$('#vs').onclick=()=>fileOut(f,true);
  $('#vr').onclick=async()=>{const im=await loadSrc(f.pages[pg]),c=document.createElement('canvas');c.width=im.height;c.height=im.width;const x=c.getContext('2d');x.translate(c.width,0);x.rotate(Math.PI/2);x.drawImage(im,0,0);f.pages[pg]=c.toDataURL('image/jpeg',.72);db.doc('custFiles/'+f.id).update({pages:f.pages});draw()};
  $('#ve').onclick=()=>{const v=prompt('Caption',f.cap||'');if(v!==null){f.cap=v.trim();db.doc('custFiles/'+f.id).update({cap:f.cap});draw()}};
  $('#vx').onclick=()=>{const k=Math.floor(100+Math.random()*900);if(prompt('Delete this file? Type '+k+' to confirm')==k){db.doc('custFiles/'+f.id).delete();logAct('Customer file deleted',(f.cname||'')+', '+(f.cap||FL[f.slot]));w.remove()}else alert('Code did not match. Nothing deleted.')};
  if($('#vp')){$('#vp').onclick=()=>{pg=(pg-1+f.pages.length)%f.pages.length;draw()};$('#vn').onclick=()=>{pg=(pg+1)%f.pages.length;draw()}}};
 draw();
}
