import {initializeApp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,signOut,sendPasswordResetEmail} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {initializeFirestore,persistentLocalCache,persistentMultipleTabManager,doc,setDoc,updateDoc,onSnapshot,collection,query,orderBy,limit,addDoc,getDocs} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {firebaseConfig} from "./firebase-config.js";

const fb=initializeApp(firebaseConfig),auth=getAuth(fb);
const db=initializeFirestore(fb,{localCache:persistentLocalCache({tabManager:persistentMultipleTabManager()})});

const $=s=>document.querySelector(s),app=$("#app");
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ls=(k,v)=>{try{if(v===undefined)return JSON.parse(localStorage.getItem(k));v===null?localStorage.removeItem(k):localStorage.setItem(k,JSON.stringify(v))}catch{}};
const sha=async s=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)))].map(x=>x.toString(16).padStart(2,"0")).join("");
let tt;const toast=m=>{const t=$("#toast");t.textContent=m;t.className="on";clearTimeout(tt);tt=setTimeout(()=>t.className="",3000)};

// Every feature is OFF for members until the admin switches it on.
const PERMS=[["createOrders","Create orders"],["editRate","Edit rate in order"],["addProducts","Add / edit products"],["viewCustomers","Manage customers"],["makeReturns","Make sales returns"],["collectPayments","Collect payments"],["dayClosing","Day closing"],["moneyCounter","Money counter + WhatsApp share"],["cancelSent","Cancel sent orders"],["viewReports","Reports and customer ranking"],["loadList","Night load list"]];
const DEF={vat:15,pinTimeout:2,pwDays:30,requirePin:true,gpsRadius:150,gpsMode:"warn",visitLimit:20,loadBuffer:10,dupScan:"highlight",branches:["Main"]};

const S={user:null,profile:null,set:{...DEF},users:[],unsubs:[],locked:true,cur:"",tab:"home",sub:"users",flt:"pending",mode:"in"};
const log=(action,detail)=>addDoc(collection(db,"logs"),{at:Date.now(),by:S.profile?.email||"",action,detail}).catch(()=>{});

/* ---------- auth state ---------- */
onAuthStateChanged(auth,u=>{
  S.unsubs.forEach(f=>f());S.unsubs=[];S.user=u;S.profile=null;S.locked=true;S.cur="";S.subbed=false;S.users=[];
  if(!u)return route();
  if(S.justLogin||ls(`pw_${u.uid}`)==null){ls(`pw_${u.uid}`,Date.now());S.justLogin=false}
  S.unsubs.push(onSnapshot(doc(db,"users",u.uid),async s=>{
    if(!s.exists()){await setDoc(doc(db,"users",u.uid),{email:u.email,name:S.signupName||u.email.split("@")[0],role:"member",status:"pending",branch:"",perms:{},createdAt:Date.now()}).catch(e=>toast(e.message));return}
    S.profile={id:s.id,...s.data()};
    if(S.profile.status==="approved"&&!S.subbed){S.subbed=true;subscribeData()}
    route();
  },e=>toast(e.message)));
});
function subscribeData(){
  S.unsubs.push(onSnapshot(doc(db,"settings","app"),s=>{S.set={...DEF,...(s.exists()?s.data():{})};route()}));
  if(S.profile.role==="admin")S.unsubs.push(onSnapshot(collection(db,"users"),s=>{
    S.users=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    if(S.cur==="main"&&S.tab==="admin"&&S.sub==="users")renderMain();
  }));
}
const out=m=>{signOut(auth).then(()=>toast(m))};

/* ---------- router ---------- */
function route(force){
  const u=S.user,p=S.profile;
  const go=(k,f)=>{if(S.cur===k&&!force)return;S.cur=k;f()};
  if(!u)return go("auth",authScreen);
  if(!p)return go("load",()=>app.innerHTML=`<div class="center"><p class="mu">Setting up your account…</p></div>`);
  if(p.status!=="approved")return go("wait:"+p.status,waitScreen);
  const pw=ls(`pw_${u.uid}`)||0;
  if(p.forceLogoutAt>pw)return out("Admin signed you out. Sign in again.");
  if(Date.now()-pw>S.set.pwDays*864e5)return out("Session expired. Sign in again.");
  let pin=ls(`pin_${u.uid}`);
  if(pin&&p.pinResetAt>pin.at){ls(`pin_${u.uid}`,null);pin=null}
  if(S.set.requirePin){
    if(!pin)return go("setup",()=>showSetup());
    if(S.locked)return go("lock",showUnlock);
  }
  if(S.cur==="main"&&S.tab==="admin"&&S.sub==="settings"&&!force)return;
  S.cur="main";renderMain();
}

/* ---------- sign in / up ---------- */
function authScreen(){
  const up=S.mode==="up";
  app.innerHTML=`<div class="center"><div class="card"><h2>${up?"Create account":"Sign in"}</h2><p class="mu">${up?"The admin must approve you before you can use the app.":"Use your email and password."}</p>
  ${up?`<label>Your name</label><input id="name" autocomplete="name">`:""}
  <label>Email</label><input id="email" type="email" autocomplete="email">
  <label>Password (6+ characters)</label><input id="pass" type="password" autocomplete="${up?"new-password":"current-password"}">
  <button class="pri" data-act="authgo">${up?"Create account":"Sign in"}</button>
  <button class="link" data-act="mode">${up?"I already have an account":"Create a new account"}</button>
  ${up?"":`<button class="link" data-act="reset">Forgot password</button>`}</div></div>`;
}
function waitScreen(){
  const m={pending:["Waiting for approval","The admin has to approve your account. This page updates by itself."],rejected:["Request declined","The admin did not approve this account."],disabled:["Account disabled","Ask the admin to enable your account."]}[S.profile.status]||["Not active",""];
  app.innerHTML=`<div class="center"><div class="card pin"><h2>${m[0]}</h2><p class="mu">${m[1]}</p><p><small>${esc(S.profile.email)}</small></p><button class="link" data-act="logout">Sign out</button></div></div>`;
}

/* ---------- PIN ---------- */
function pinScreen(title,sub,done,foot=""){
  let v="";
  const draw=()=>{
    app.innerHTML=`<div class="center"><div class="card pin"><h2>${title}</h2><p class="mu">${sub}</p><div class="dots">${[0,1,2,3,4,5].map(i=>`<i class="${i<v.length?"on":""}"></i>`).join("")}</div><div class="pad">${[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map(k=>`<button data-k="${k}" ${k===""?"disabled":""}>${k}</button>`).join("")}</div>${foot}</div></div>`;
    app.querySelectorAll("[data-k]").forEach(b=>b.onclick=async()=>{
      const k=b.dataset.k;if(k==="⌫")v=v.slice(0,-1);else if(v.length<6)v+=k;
      draw();
      if(v.length===6){const x=v;v="";if(await done(x)!==true)draw()}
    });
  };
  draw();
}
function showSetup(after){
  let first=null;
  const go=()=>pinScreen(first?"Confirm PIN":"Create a 6-digit PIN",first?"Enter the same PIN again":"This PIN opens the app on this phone",async x=>{
    if(!first){first=x;go();return true}
    if(x!==first){first=null;toast("PINs did not match");go();return true}
    ls(`pin_${S.user.uid}`,{h:await sha(x+S.user.uid),at:Date.now()});
    S.locked=false;S.cur="";after?after():route();return true;
  },after?`<button class="link" data-act="cancelpin">Cancel</button>`:"");
  go();
}
function showUnlock(){
  const u=S.user.uid,p=ls(`pin_${u}`);
  pinScreen("Enter PIN","Unlock the app",async x=>{
    if(await sha(x+u)===p.h){ls(`tries_${u}`,0);S.locked=false;S.cur="";route();return true}
    const t=(ls(`tries_${u}`)||0)+1;ls(`tries_${u}`,t);
    if(t>=5){ls(`pin_${u}`,null);ls(`tries_${u}`,0);out("Too many wrong tries. Sign in again.");return true}
    toast(`Wrong PIN. ${5-t} tries left.`);
  },`<button class="link" data-act="forgot">Forgot PIN? Sign in again</button>`);
}
document.addEventListener("visibilitychange",()=>{
  if(document.hidden){S.hid=Date.now();return}
  if(S.user&&S.profile?.status==="approved"&&S.set.requirePin&&!S.locked&&S.hid&&Date.now()-S.hid>S.set.pinTimeout*6e4){S.locked=true;$("#modal").innerHTML="";route(true)}
});

/* ---------- main shell ---------- */
const tabBtn=(t,i,l)=>`<button data-act="tab" data-t="${t}" class="${S.tab===t?"on":""}">${i}<span>${l}</span></button>`;
function renderMain(){
  const p=S.profile,adm=p.role==="admin",pend=S.users.filter(x=>x.status==="pending").length;
  if(!adm&&S.tab==="admin")S.tab="home";
  app.innerHTML=`<header><div><b>${esc(p.name)}</b><small>${adm?"Admin":"Member"} · ${esc(p.branch||"No branch")}</small></div><span id="sync" class="badge"></span></header><main id="view"></main><nav>${tabBtn("home","🏠","Home")}${adm?tabBtn("admin","🛠","Admin"+(pend?` (${pend})`:"")):""}${tabBtn("account","👤","Account")}</nav>`;
  sync();view();
}
const sync=()=>{const e=$("#sync");if(e)e.textContent=navigator.onLine?"Online":"Offline"};
addEventListener("online",sync);addEventListener("offline",sync);
function view(){
  const v=$("#view");if(!v)return;
  if(S.tab==="home")v.innerHTML=homeV();else if(S.tab==="account")v.innerHTML=accV();else adminV(v);
}
function homeV(){
  const p=S.profile,adm=p.role==="admin",on=PERMS.filter(([k])=>adm||p.perms?.[k]);
  return `<div class="card"><h3>Welcome, ${esc(p.name)}</h3><p class="mu">${adm?"You have full access.":on.length?"Features the admin enabled for you:":"No features enabled yet. Ask the admin to turn them on."}</p><div class="chips">${on.map(([,l])=>`<span class="chip">${l}</span>`).join("")}</div></div><div class="card mu">Sign-in, approval, PIN lock and the admin panel are ready. Products, customers and orders come in the next phases.</div>`;
}
function accV(){
  const p=S.profile;
  return `<div class="card"><h3>${esc(p.name)}</h3><p class="mu">${esc(p.email)}</p><p>Role: ${p.role} · Branch: ${esc(p.branch||"none")}</p>${S.set.requirePin?`<button class="pri" data-act="changepin">Change PIN</button>`:""}<button class="pri dng" data-act="logout">Sign out</button></div>`;
}

/* ---------- admin ---------- */
function adminV(v){
  const nav=`<div class="seg">${[["users","Users"],["settings","Settings"],["log","Log"]].map(([k,l])=>`<button data-act="sub" data-s="${k}" class="${S.sub===k?"on":""}">${l}</button>`).join("")}</div>`;
  if(S.sub==="users")return v.innerHTML=nav+usersV();
  if(S.sub==="settings")return v.innerHTML=nav+setV();
  v.innerHTML=nav+`<p class="card mu">Loading…</p>`;
  getDocs(query(collection(db,"logs"),orderBy("at","desc"),limit(40))).then(s=>{
    v.innerHTML=nav+(s.empty?`<p class="card mu">No activity yet.</p>`:s.docs.map(d=>{const x=d.data();return `<div class="card"><b>${esc(x.action)}</b><div class="mu">${esc(x.detail)}</div><small>${new Date(x.at).toLocaleString()} · ${esc(x.by)}</small></div>`}).join(""));
  }).catch(e=>toast(e.message));
}
function usersV(){
  const f=S.flt,list=S.users.filter(u=>f==="all"||(f==="pending"?u.status==="pending":u.status!=="pending"));
  const chips=[["pending","Pending"],["other","Others"],["all","All"]].map(([k,l])=>`<button data-act="flt" data-f="${k}" class="${f===k?"on":""}" style="${f===k?"background:var(--pr);color:var(--prt)":""}">${l}</button>`).join("");
  return `<div class="btns" style="padding:10px 12px 0">${chips}</div>`+(list.length?list.map(u=>`<div class="card"><div class="row" data-act="user" data-id="${u.id}"><div><b>${esc(u.name)}</b><small>${esc(u.email)}${u.branch?" · "+esc(u.branch):""}</small></div><span class="st ${u.status}">${u.status}</span></div>${u.status==="pending"?`<div class="btns"><button class="pri" style="margin:0" data-act="approve" data-id="${u.id}">Approve</button><button class="dng" data-act="reject" data-id="${u.id}">Reject</button></div>`:""}</div>`).join(""):`<p class="card mu">No users here.</p>`);
}
function openUser(id){
  const u=S.users.find(x=>x.id===id);if(!u)return;
  const me=id===S.user.uid,sel=(a,b)=>a===b?"selected":"";
  const brs=[...new Set(["",...S.set.branches,u.branch||""])];
  $("#modal").innerHTML=`<div class="sheet-bg"><div class="sheet"><div class="row"><h3>${esc(u.name)}</h3><button class="x" data-act="close">✕</button></div><p class="mu">${esc(u.email)}</p>
  <label>Role</label><select id="u_role" ${me?"disabled":""}><option value="member" ${sel(u.role,"member")}>Member</option><option value="admin" ${sel(u.role,"admin")}>Admin</option></select>
  <label>Status</label><select id="u_st" ${me?"disabled":""}>${["pending","approved","rejected","disabled"].map(s=>`<option ${sel(u.status,s)}>${s}</option>`).join("")}</select>
  <label>Branch (change only when the person returns from vacation)</label><select id="u_br">${brs.map(b=>`<option value="${esc(b)}" ${sel(u.branch||"",b)}>${esc(b||"No branch")}</option>`).join("")}</select>
  <label>Features (all off by default)</label>${PERMS.map(([k,l])=>`<div class="perm"><input type="checkbox" data-p="${k}" id="p_${k}" ${u.perms?.[k]?"checked":""}><label for="p_${k}" style="margin:0;color:var(--tx)">${l}</label></div>`).join("")}
  <button class="pri" data-act="saveUser" data-id="${id}">Save changes</button>
  ${me?"":`<div class="btns"><button data-act="resetPin" data-id="${id}">Reset PIN</button><button class="dng" data-act="forceOut" data-id="${id}">Force sign out</button></div>`}</div></div>`;
}
function setV(){
  const s=S.set,o=(v,a)=>v===a?"selected":"";
  return `<div class="card"><label>VAT % (added automatically on orders)</label><input id="s_vat" type="number" step="0.01" value="${s.vat}">
  <label>Ask PIN again after (minutes in background)</label><input id="s_pt" type="number" value="${s.pinTimeout}">
  <label>Ask email password again after (days)</label><input id="s_pw" type="number" value="${s.pwDays}">
  <div class="perm"><input type="checkbox" id="s_pin" ${s.requirePin?"checked":""}><label for="s_pin" style="margin:0;color:var(--tx)">Require 6-digit PIN for everyone</label></div>
  <label>GPS check-in distance (meters)</label><input id="s_gr" type="number" value="${s.gpsRadius}">
  <label>Check-in mode</label><select id="s_gm"><option value="warn" ${o(s.gpsMode,"warn")}>Warn only</option><option value="required" ${o(s.gpsMode,"required")}>Required</option></select>
  <label>Daily visit limit per salesman</label><input id="s_vl" type="number" value="${s.visitLimit}">
  <label>Night load buffer %</label><input id="s_lb" type="number" value="${s.loadBuffer}">
  <label>Scan of a product already in the order</label><select id="s_ds"><option value="highlight" ${o(s.dupScan,"highlight")}>Highlight the line</option><option value="plus1" ${o(s.dupScan,"plus1")}>Add +1 quantity</option></select>
  <label>Branches (separate with commas)</label><input id="s_br" value="${esc(s.branches.join(", "))}">
  <label>Cost PIN (4–8 digits, leave empty to keep the current one)</label><input id="s_cost" type="password" inputmode="numeric" autocomplete="off">
  <button class="pri" data-act="saveSet">Save settings</button></div>`;
}

/* ---------- actions ---------- */
const closeM=()=>$("#modal").innerHTML="";
const A={
  mode:()=>{S.mode=S.mode==="up"?"in":"up";authScreen()},
  authgo:async()=>{
    const em=$("#email").value.trim(),pw=$("#pass").value;
    if(!em||pw.length<6)return toast("Enter your email and a password of 6+ characters");
    S.justLogin=true;
    try{if(S.mode==="up"){S.signupName=$("#name").value.trim();await createUserWithEmailAndPassword(auth,em,pw)}else await signInWithEmailAndPassword(auth,em,pw)}
    catch(e){S.justLogin=false;toast((e.code||e.message).replace("auth/","").replace(/-/g," "))}
  },
  reset:async()=>{const em=$("#email").value.trim();if(!em)return toast("Type your email first");try{await sendPasswordResetEmail(auth,em);toast("Reset link sent to your email")}catch(e){toast(e.code||e.message)}},
  logout:()=>out("Signed out"),
  forgot:()=>{ls(`pin_${S.user.uid}`,null);out("Sign in with your email password")},
  changepin:()=>{const u=S.user.uid,p=ls(`pin_${u}`);pinScreen("Current PIN","Enter your current PIN",async x=>{if(await sha(x+u)===p.h){showSetup(()=>{S.cur="";S.tab="account";route()});return true}toast("Wrong PIN")},`<button class="link" data-act="cancelpin">Cancel</button>`)},
  cancelpin:()=>{S.cur="";route()},
  tab:a=>{S.tab=a.dataset.t;renderMain()},
  sub:a=>{S.sub=a.dataset.s;renderMain()},
  flt:a=>{S.flt=a.dataset.f;renderMain()},
  user:a=>openUser(a.dataset.id),
  close:closeM,
  approve:async a=>{const u=S.users.find(x=>x.id===a.dataset.id);try{await updateDoc(doc(db,"users",u.id),{status:"approved"});log("User approved",u.email);toast("Approved")}catch(e){toast(e.message)}},
  reject:async a=>{const u=S.users.find(x=>x.id===a.dataset.id);try{await updateDoc(doc(db,"users",u.id),{status:"rejected"});log("User rejected",u.email)}catch(e){toast(e.message)}},
  saveUser:async a=>{
    const id=a.dataset.id,u=S.users.find(x=>x.id===id),perms={};
    document.querySelectorAll("[data-p]").forEach(c=>{if(c.checked)perms[c.dataset.p]=true});
    const d={role:$("#u_role").value,status:$("#u_st").value,branch:$("#u_br").value,perms};
    try{
      await updateDoc(doc(db,"users",id),d);
      const ch=[];if(d.branch!==(u.branch||""))ch.push(`branch ${u.branch||"-"} to ${d.branch||"-"}`);if(d.status!==u.status)ch.push(`status ${u.status} to ${d.status}`);if(d.role!==u.role)ch.push(`role ${d.role}`);
      log("User updated",`${u.email}: ${ch.join(", ")||"features"}`);closeM();toast("Saved");
    }catch(e){toast(e.message)}
  },
  resetPin:async a=>{const u=S.users.find(x=>x.id===a.dataset.id);try{await updateDoc(doc(db,"users",u.id),{pinResetAt:Date.now()});log("PIN reset",u.email);toast("PIN reset. The user sets a new one.")}catch(e){toast(e.message)}},
  forceOut:async a=>{const u=S.users.find(x=>x.id===a.dataset.id);try{await updateDoc(doc(db,"users",u.id),{forceLogoutAt:Date.now()});log("Force sign out",u.email);toast("User will be signed out")}catch(e){toast(e.message)}},
  saveSet:async()=>{
    const g=i=>$("#"+i),vat=+g("s_vat").value;
    if(!(vat>=0&&vat<=100))return toast("VAT must be between 0 and 100");
    const d={vat,pinTimeout:+g("s_pt").value||2,pwDays:+g("s_pw").value||30,requirePin:g("s_pin").checked,gpsRadius:+g("s_gr").value||150,gpsMode:g("s_gm").value,visitLimit:+g("s_vl").value||20,loadBuffer:+g("s_lb").value||0,dupScan:g("s_ds").value,branches:g("s_br").value.split(",").map(x=>x.trim()).filter(Boolean)};
    const c=g("s_cost").value.trim();
    if(c&&!/^\d{4,8}$/.test(c))return toast("Cost PIN must be 4–8 digits");
    try{
      await setDoc(doc(db,"settings","app"),d,{merge:true});
      if(c){await setDoc(doc(db,"adminSecure","costPin"),{h:await sha("cost"+c),at:Date.now()});g("s_cost").value=""}
      log("Settings changed",`VAT ${vat}%`+(c?", cost PIN changed":""));toast("Saved");
    }catch(e){toast(e.message)}
  }
};
document.addEventListener("click",e=>{const a=e.target.closest("[data-act]");if(a&&!e.target.closest("button:not([data-act])"))A[a.dataset.act]?.(a)});

if("serviceWorker"in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});
