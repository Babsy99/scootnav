/* ScootNav V15: Settings sheet, map style, arrow, text scale, route preference,
   saved places and Get Me Home. Standalone module; index.html wires it in with
   the hook calls listed in v15/INTEGRATE.md. Everything is stored on-device
   (localStorage 'sn_settings' and 'sn_places'). No accounts, no keys. */
(function(root){
'use strict';
// ---------------- constants ----------------
const DARK_DEFAULT='https://tiles.openfreemap.org/styles/dark';
const STYLES={
  dark:{label:'Dark',credit:'© OpenFreeMap © OpenMapTiles © OpenStreetMap contributors'},
  // CARTO raster light_all (basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png) now returns an 'API KEY REQUIRED'
  // placeholder for every tile (checked 2026-10-30), so Light uses OpenFreeMap Positron: keyless, same host as Dark.
  // Keyless CARTO alternative (vector, worked 2026-10-30): url:'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
  light:{label:'Light',url:'https://tiles.openfreemap.org/styles/positron',credit:'© OpenFreeMap © OpenMapTiles © OpenStreetMap contributors'},
  satellite:{label:'Satellite',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],attribution:'Esri, Maxar, Earthstar Geographics',maxzoom:19,credit:'Search/routing data © OpenStreetMap contributors'}
};
const COLORS=['#3d8bfd','#22c55e','#f97316','#ef4444','#facc15','#d946ef','#ffffff'];
const SIZES={S:44,M:56,L:76,XL:100};
const SCALES={normal:{label:'Normal',v:1},large:{label:'Large',v:1.25},xl:{label:'XL',v:1.5}};
// Route preferences = BRouter variants of profile/courier.brf.
// ONLY cost numbers change. Legal blocks (every 10000 line: paths, footways,
// sidewalks, private access, wrong-way, trunk, motorway) are never touched;
// patchProfile() asserts that. Patches are anchored by regex so they rebase
// automatically onto any courier.brf (c5 today, c6 with the Private Alley block).
const PREFS={
  fastest:{label:'Fastest',patches:[]},
  quiet:{label:'Fewest busy roads',patches:[
    [/^(\s*switch or highway=primary highway=primary_link\s+)([\d.]+)/m,'3.0'],
    [/^(\s*switch or highway=secondary highway=secondary_link\s+)([\d.]+)/m,'2.2'],
    [/^(\s*switch or highway=tertiary highway=tertiary_link\s+)([\d.]+)/m,'1.6'],
    [/^(assign consider_traffic\s+=\s+)([\d.]+)/m,'0.6']],
    // scooter-only TIGHTENING (never a relaxation): without it the 3.0 primary penalty made a one-way
    // cycleway (base scooter cost 1.1) cheaper than the road, and proof/check.py counts cycleways as path-like
    tighten:[[/^(\s*switch\s+highway=cycleway\s+switch scooter \( switch and oneway=yes not or foot=designated foot=yes )([\d.]+)(?= 10000 \))/m,'3.0']]},
  hills:{label:'Avoid hills',patches:[
    [/^(assign uphillcost\s+=\s+)([\d.]+)/m,'200'],
    [/^(assign uphillcutoff\s+=\s+)([\d.]+)/m,'0.5']]}
};
function legalLines(t){return t.split('\n').filter(l=>/10000|access=private|footway=sidewalk/.test(l)).map(l=>l.replace(/\s+/g,' ').trim())}
function patchProfile(base,pref,mode){
  const P=PREFS[pref];if(!P)throw new Error('unknown pref '+pref);
  let t=base;
  for(const [re,val] of P.patches){
    if(!re.test(t))throw new Error('V15 patch anchor not found: '+re);
    t=t.replace(re,(m,a,old)=>a+val+'  # V15-PATCH '+pref+' (base '+old+')');
  }
  let exp=base;
  if(mode==='scooter')for(const [re,val] of (P.tighten||[])){
    const m=t.match(re);if(!m)throw new Error('V15 tighten anchor not found: '+re);
    if(!(+val>=+m[2]))throw new Error('V15 tighten would relax a rule');
    t=t.replace(re,(x,a,old)=>a+val);exp=exp.replace(re,(x,a,old)=>a+val);
    t=t.replace(/^(\s*switch\s+highway=cycleway.*)$/m,'$1  # V15-TIGHTEN '+pref+' scooter cycleway '+m[2]+'->'+val);
    exp=exp.replace(/^(\s*switch\s+highway=cycleway.*)$/m,'$1  # V15-TIGHTEN '+pref+' scooter cycleway '+m[2]+'->'+val);
  }
  if(mode==='ebike')t=t.replace('assign scooter = true','assign scooter = false');
  else if(!/assign scooter = true/.test(t))throw new Error('scooter flag missing');
  if(P.patches.length)t='# === V15 ROUTE-PREF VARIANT: '+pref+' / '+mode+' ===\n'+
    '# Generated from profile/courier.brf by v15/settings.js patchProfile(). Only lines marked V15-PATCH (and, scooter only, V15-TIGHTEN) differ.\n'+
    '# REBASE-ON-C6: no hand edits needed. Patches are regex-anchored; re-run node v15/tools/gen_profiles.js after courier.brf changes.\n'+t;
  const a=legalLines(exp.replace(mode==='ebike'?'assign scooter = true':'\u0000','assign scooter = false')),b=legalLines(t);
  if(a.join('\n')!==b.join('\n'))throw new Error('V15 patch touched a legal rule');
  return t;
}
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)}
const DEF={style:'dark',arrowColor:COLORS[0],arrowSize:'M',textScale:'normal',pref:'fastest'};
const API={STYLES,COLORS,SIZES,SCALES,PREFS,patchProfile,legalLines,DEF};
if(typeof module!=='undefined'&&module.exports){module.exports=API;return}

// ---------------- storage ----------------
const LS=root.localStorage;
function loadS(){try{return Object.assign({},DEF,JSON.parse(LS.getItem('sn_settings')||'{}'))}catch(e){return Object.assign({},DEF)}}
// 'sn_places' is shared with index2's V9 search: {saved:[{name,addr,ll}],recent:[...]}. V15 keeps Home and favorites
// in .saved and adds {id,home}; index2 ignores the extra fields. Re-read on every use so neither side clobbers the other.
function readStore(){let s;try{s=JSON.parse(LS.getItem('sn_places')||'null')}catch(e){s=null}
  if(Array.isArray(s))s={saved:s,recent:[]};if(!s||typeof s!=='object')s={saved:[],recent:[]};
  if(!Array.isArray(s.saved))s.saved=[];if(!Array.isArray(s.recent))s.recent=[];return s}
const pid=p=>'p'+hash(p.name+'|'+p.ll.join(','));
function loadP(){return readStore().saved.filter(p=>p&&p.name&&Array.isArray(p.ll)&&p.ll.length===2).map(p=>p.id?p:Object.assign({},p,{id:pid(p)}))}
let S=loadS(),PL=loadP();
const saveS=()=>LS.setItem('sn_settings',JSON.stringify(S));
const saveP=()=>{const s=readStore();s.saved=PL;LS.setItem('sn_places',JSON.stringify(s))};
const syncP=()=>{PL=loadP()};
let H={map:null,darkStyle:DARK_DEFAULT,brouter:'https://brouter.de/brouter',profileUrl:'profile/courier.brf',
  photon:'https://photon.komoot.io/api/',bbox:[-71.18,42.29,-71.03,42.41],
  routeTo:null,replan:null,getMe:()=>null};

// ---------------- helpers ----------------
const el=(tag,attrs,html)=>{const e=document.createElement(tag);if(attrs)for(const k in attrs){if(k==='class')e.className=attrs[k];else e.setAttribute(k,attrs[k])}if(html!=null)e.innerHTML=html;return e};
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const rad=x=>x*Math.PI/180;
function hav(a,b){const dLat=rad(b[0]-a[0]),dLon=rad(b[1]-a[1]);const h=Math.sin(dLat/2)**2+Math.cos(rad(a[0]))*Math.cos(rad(b[0]))*Math.sin(dLon/2)**2;return 2*6371000*Math.asin(Math.sqrt(h))}
const home=()=>{syncP();return PL.find(p=>p.home)||null};

// ---------------- V15a map style ----------------
function mapStyle(dark){if(dark)H.darkStyle=dark;const s=STYLES[S.style];if(!s||(!s.tiles&&!s.url))return H.darkStyle;if(s.url)return s.url;
  return {version:8,sources:{base:{type:'raster',tiles:s.tiles,tileSize:256,maxzoom:s.maxzoom,attribution:s.attribution}},layers:[{id:'bg',type:'background',paint:{'background-color':S.style==='light'?'#f2efe9':'#0b0b0b'}},{id:'base',type:'raster',source:'base'}]}}
function setStyle(k){if(!STYLES[k]||k===S.style)return;S.style=k;saveS();document.documentElement.dataset.snStyle=k;
  if(H.map){H.map.setStyle(mapStyle(),{diff:false});applyCredit()}paint()}

// Map credits: one compact AttributionControl, rebuilt on every style switch so the basemap credit always matches.
let attrCtl=null;const APP_CREDIT='Routing BRouter · Search Photon';
function applyCredit(){if(!H.map||!root.maplibregl)return;const s=STYLES[S.style]||STYLES.dark;
  if(attrCtl)try{H.map.removeControl(attrCtl)}catch(e){}
  attrCtl=new root.maplibregl.AttributionControl({compact:true,customAttribution:[s.credit,APP_CREDIT].filter(Boolean)});H.map.addControl(attrCtl);liftCtl()}
// keep map credits above the bottom panel so they stay visible
let liftObs=null;function liftCtl(){const b=document.getElementById('bottom');if(!b||!H.map)return;
  const f=()=>{const c=H.map.getContainer().querySelectorAll('.maplibregl-ctrl-bottom-right,.maplibregl-ctrl-bottom-left');const h=getComputedStyle(b).display==='none'?0:b.offsetHeight;c.forEach(e=>e.style.bottom=h+'px')};
  f();if(!liftObs&&root.ResizeObserver){liftObs=new ResizeObserver(f);liftObs.observe(b)}}
// ---------------- V15b arrow ----------------
function decorateArrow(d){if(!d)return d;const px=SIZES[S.arrowSize]||56,c=S.arrowColor;
  d.style.width=d.style.height=px+'px';const sv=d.querySelector('svg');if(sv){sv.setAttribute('width',px);sv.setAttribute('height',px)}
  const p=d.querySelector('path'),ci=d.querySelector('circle');
  if(p){p.setAttribute('fill',c);p.setAttribute('stroke',c.toLowerCase()==='#ffffff'?'#000':'#fff')}
  if(ci)ci.setAttribute('fill',c+'40');d.dataset.snArrow=S.arrowSize+' '+c;return d}
function applyArrow(){document.querySelectorAll('.me').forEach(decorateArrow)}

// ---------------- V15c text scale ----------------
function applyScale(){const v=(SCALES[S.textScale]||SCALES.normal).v;document.documentElement.style.setProperty('--sn-ts',v);document.documentElement.dataset.snTs=S.textScale}

// ---------------- V15d route preference (BRouter profile variants) ----------------
let baseText=null,profCache=null;
function pcache(){if(!profCache){try{profCache=JSON.parse(LS.getItem('sn_prof_v15')||'{}')}catch(e){profCache={}}}return profCache}
async function profileId(mode,host){const pref=S.pref;if(pref==='fastest')return null;host=host||H.brouter;
  try{baseText=baseText||await (await fetch(H.profileUrl,{cache:'no-cache'})).text();
    const t=patchProfile(baseText,pref,mode),k=host+'|'+pref+'_'+mode+'_'+hash(t),c=pcache();if(c[k])return c[k];
    const j=await (await fetch(host+'/profile',{method:'POST',headers:{'Content-Type':'text/plain'},body:t})).json();
    if(!j.profileid)throw new Error(j.error||'no profileid');c[k]=j.profileid;LS.setItem('sn_prof_v15',JSON.stringify(c));return j.profileid}
  catch(e){console.warn('V15 route pref fell back to Fastest:',e.message);API.lastError=e.message;return null}}
function resetProfiles(host){baseText=null;if(!host){profCache={};LS.removeItem('sn_prof_v15');return}const c=pcache();for(const k of Object.keys(c))if(k.startsWith(host+'|'))delete c[k];LS.setItem('sn_prof_v15',JSON.stringify(c))}
function setPref(k){if(!PREFS[k]||k===S.pref)return;S.pref=k;saveS();paint();H.replan&&H.replan()}

// ---------------- V15e saved places ----------------
function words(p){return ((p.name||'')+' '+(p.addr||'')).toLowerCase().split(/[\s,·.#-]+/).filter(Boolean)}
function placeMatches(q,me){syncP();q=(q||'').trim().toLowerCase();const toks=q.split(/[\s,]+/).filter(Boolean);
  const hit=PL.filter(p=>!toks.length||toks.every(t=>words(p).some(w=>w.startsWith(t))));
  const c=me||H.getMe();
  return hit.map(p=>({ll:p.ll,main:(p.home?'🏠 ':'★ ')+String(p.name).replace(/</g,'‹').replace(/>/g,'›'),sub:'Saved'+(p.addr?' · '+p.addr:''),sub0:p.addr||'',d:c?hav(c,p.ll):0,saved:true,place:p.id,name:p.name}))
    .sort((a,b)=>(PL.find(x=>x.id===b.place).home-PL.find(x=>x.id===a.place).home)||a.d-b.d)}
// Saved first, then search results (deduped against saved coords), capped.
function mergeSaved(q,list,me,max){const s=placeMatches(q,me);const rest=(list||[]).filter(r=>!r.saved&&!s.some(x=>hav(x.ll,r.ll)<25));return s.concat(rest).slice(0,Math.max(max||5,s.length))}
function upsertPlace(p){syncP();if(!p.ll||p.ll.length!==2||!p.name)return null;if(p.home)PL.forEach(x=>{if(x.id!==p.id)x.home=false});
  const i=PL.findIndex(x=>x.id===p.id);const rec={id:p.id||Date.now().toString(36)+Math.random().toString(36).slice(2,5),name:p.name.trim(),addr:(p.addr||'').trim(),ll:[+(+p.ll[0]).toFixed(6),+(+p.ll[1]).toFixed(6)],home:!!p.home};
  if(i>=0)PL[i]=rec;else PL.push(rec);saveP();paint();return rec}
function deletePlace(id){syncP();PL=PL.filter(p=>p.id!==id);saveP();paint()}

// ---------------- V15f Get Me Home ----------------
function getMeHome(){const h=home();if(!h){open();editPlace({home:true,name:'Home'});return false}
  if(!H.routeTo)return false;closeAll();H.routeTo(h.ll,h.name);return true}

// ---------------- UI ----------------
let sheet,editor,ui={};
function seg(name,opts,cur,fn){return '<div class="sn-seg" data-k="'+name+'">'+opts.map(([k,l])=>'<button type="button" data-v="'+k+'" class="'+(k===cur?'on':'')+'">'+l+'</button>').join('')+'</div>'}
function build(){
  // main-screen controls: Get Me Home + Settings, inserted above the existing #row
  const row=el('div',{id:'snrow'});
  row.append(ui.gmh=el('button',{id:'gmh',type:'button',class:'pri'},'🏠 Get Me Home'),ui.gear=el('button',{id:'snset',type:'button','aria-label':'Settings'},'⚙ Settings'));
  const anchor=document.getElementById('row');(anchor?anchor.parentNode:document.body).insertBefore(row,anchor||null);
  ui.gmh.onclick=getMeHome;ui.gear.onclick=open;
  sheet=el('div',{id:'snsheet',role:'dialog','aria-label':'Settings'});document.body.append(sheet);
  editor=el('div',{id:'snedit',role:'dialog'});document.body.append(editor);
  sheet.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const g=b.closest('.sn-seg');
    if(g){const k=g.dataset.k,v=b.dataset.v;if(k==='style')setStyle(v);else if(k==='size'){S.arrowSize=v;saveS();applyArrow();paint()}else if(k==='ts'){S.textScale=v;saveS();applyScale();paint()}else if(k==='pref')setPref(v);return}
    if(b.dataset.color){S.arrowColor=b.dataset.color;saveS();applyArrow();paint();return}
    const a=b.dataset.act,id=b.dataset.id;
    if(a==='close')close();else if(a==='sethome')editPlace(home()||{home:true,name:'Home'});else if(a==='add')editPlace({});
    else if(a==='edit')editPlace(PL.find(p=>p.id===id));else if(a==='go'){const p=PL.find(x=>x.id===id);if(p&&H.routeTo){closeAll();H.routeTo(p.ll,p.name)}}
    else if(a==='del'){if(b.dataset.armed){deletePlace(id)}else{b.dataset.armed=1;b.textContent='Delete?';b.classList.add('danger');setTimeout(()=>{if(b.isConnected){delete b.dataset.armed;b.textContent='Delete';b.classList.remove('danger')}},3000)}}});
  paint()}
function paint(){if(!sheet)return;const h=home();
  const plist=PL.filter(p=>!p.home).map(p=>'<div class="sn-place"><div class="sn-pl" ><b>★ '+esc(p.name)+'</b><small>'+esc(p.addr||'')+'</small></div><button data-act="go" data-id="'+p.id+'">Go</button><button data-act="edit" data-id="'+p.id+'">Edit</button><button data-act="del" data-id="'+p.id+'">Delete</button></div>').join('');
  sheet.innerHTML='<div class="sn-head"><div class="sn-title">Settings</div><button data-act="close" class="pri">Done</button></div><div class="sn-body">'+
   '<h3>Map style</h3>'+seg('style',Object.keys(STYLES).map(k=>[k,STYLES[k].label]),S.style)+
   '<h3>Arrow color</h3><div class="sn-sw">'+COLORS.map(c=>'<button type="button" data-color="'+c+'" style="background:'+c+'" class="'+(c===S.arrowColor?'on':'')+'" aria-label="'+c+'"></button>').join('')+'</div>'+
   '<h3>Arrow size</h3>'+seg('size',Object.keys(SIZES).map(k=>[k,k]),S.arrowSize)+
   '<h3>Text size</h3>'+seg('ts',Object.keys(SCALES).map(k=>[k,SCALES[k].label]),S.textScale)+
   '<h3>Route preference</h3>'+seg('pref',Object.keys(PREFS).map(k=>[k,PREFS[k].label]),S.pref)+
   '<div class="sn-note">Scooter mode stays legal in every preference: no paths, sidewalks, private alleys or wrong-way.</div>'+
   '<h3>Home</h3>'+(h?'<div class="sn-place"><div class="sn-pl"><b>🏠 '+esc(h.name)+'</b><small>'+esc(h.addr||'')+'</small></div><button data-act="sethome">Edit</button><button data-act="del" data-id="'+h.id+'">Delete</button></div>':'<button data-act="sethome" class="sn-wide">Set Home</button>')+
   '<h3>Saved places</h3>'+(plist||'<div class="sn-note">None yet.</div>')+'<button data-act="add" class="sn-wide">+ Add place</button>'+
   '<div class="sn-note">Saved on this phone only. No account.</div></div>';
  if(ui.gmh)ui.gmh.classList.toggle('unset',!h)}
let edTimer=null,edAbort=null,edSugg=[];
function editPlace(p){p=Object.assign({name:'',addr:'',ll:null,home:false},p||{});const isHome=!!p.home;
  if(!sheet.classList.contains('open'))open();
  editor.innerHTML='<div class="sn-head"><div class="sn-title">'+(isHome?'Set Home':(p.id?'Edit place':'Add place'))+'</div><button data-x="1">Cancel</button></div><div class="sn-body">'+
    '<label>Name<input id="snname" autocomplete="off" value="'+esc(p.name)+'" placeholder="'+(isHome?'Home':'Name')+'"></label>'+
    '<label>Address or place<input id="snaddr" autocomplete="off" autocorrect="off" value="'+esc(p.addr)+'" placeholder="Start typing an address"></label>'+
    '<div id="snesugg"></div><button id="snhere" class="sn-wide">📍 Use my current spot</button>'+
    '<div id="snll" class="sn-note">'+(p.ll?'Location set':'Pick an address or use your current spot')+'</div>'+
    '<button id="snsave" class="pri sn-wide">Save</button></div>';
  editor.classList.add('open');const st={...p};const q=editor.querySelector('#snaddr'),sg=editor.querySelector('#snesugg'),ll=editor.querySelector('#snll');
  const setLL=(v,txt)=>{st.ll=v;ll.textContent=txt||'Location set';ll.classList.add('ok')};
  q.addEventListener('input',()=>{st.ll=null;ll.textContent='Pick an address or use your current spot';ll.classList.remove('ok');clearTimeout(edTimer);edTimer=setTimeout(()=>edSuggest(q.value.trim(),sg),300)});
  sg.addEventListener('click',e=>{const d=e.target.closest('[data-i]');if(!d)return;const s=edSugg[+d.dataset.i];q.value=s.main;sg.innerHTML='';setLL(s.ll,'Location set: '+s.main);
    const n=editor.querySelector('#snname');if(!n.value.trim())n.value=isHome?'Home':s.main});
  editor.querySelector('#snhere').onclick=()=>{const m=H.getMe();if(!m){ll.textContent='No GPS fix yet';return}setLL(m.slice(),'Location set: current spot');if(!q.value.trim())q.value='Current spot'};
  editor.querySelector('[data-x]').onclick=()=>editor.classList.remove('open');
  editor.querySelector('#snsave').onclick=()=>{const n=editor.querySelector('#snname').value.trim()||(isHome?'Home':'');if(!n||!st.ll){ll.textContent=!n?'Add a name':'Pick an address or use your current spot';ll.classList.remove('ok');return}
    upsertPlace({id:p.id,name:n,addr:q.value,ll:st.ll,home:isHome});editor.classList.remove('open')};
  setTimeout(()=>q.focus(),50)}
async function edSuggest(q,sg){if(q.length<3){sg.innerHTML='';return}if(edAbort)edAbort.abort();edAbort=new AbortController();const c=H.getMe()||[42.3467,-71.0905];
  try{const j=await (await fetch(H.photon+'?q='+encodeURIComponent(q)+'&lat='+c[0]+'&lon='+c[1]+'&limit=10&lang=en&bbox='+H.bbox.join(','),{signal:edAbort.signal})).json();
    edSugg=j.features.map(f=>{const p=f.properties,a=[p.housenumber,p.street].filter(Boolean).join(' ');return {ll:[f.geometry.coordinates[1],f.geometry.coordinates[0]],main:p.name&&p.name!==a?p.name+(a?', '+a:''):(a||p.name||''),sub:p.city||p.district||'',d:hav(c,[f.geometry.coordinates[1],f.geometry.coordinates[0]])}}).filter(s=>s.main).sort((a,b)=>a.d-b.d).slice(0,5);
    sg.innerHTML=edSugg.map((s,i)=>'<div data-i="'+i+'">'+esc(s.main)+'<small>'+esc(s.sub)+'</small></div>').join('')}catch(e){}}
function open(){if(!sheet)return;paint();sheet.classList.add('open')}
function close(){sheet&&sheet.classList.remove('open');editor&&editor.classList.remove('open')}
const closeAll=close;

function init(h){Object.assign(H,h||{});if(h&&h.darkStyle)H.darkStyle=h.darkStyle;applyScale();document.documentElement.dataset.snStyle=S.style;build();applyArrow();applyCredit();return API}
Object.assign(API,{init,mapStyle,decorateArrow,profileId,resetProfiles,placeMatches,mergeSaved,getMeHome,open,close,upsertPlace,deletePlace,
  home,setStyle,setPref,
  setArrow(c,s){if(c)S.arrowColor=c;if(s)S.arrowSize=s;saveS();applyArrow();paint()},setTextScale(k){if(SCALES[k]){S.textScale=k;saveS();applyScale();paint()}}});
Object.defineProperties(API,{settings:{get(){return Object.assign({},S)},enumerable:true},places:{get(){return PL.map(p=>Object.assign({},p))},enumerable:true}});
applyScale();
root.SNS=API;
})(typeof window!=='undefined'?window:globalThis);
