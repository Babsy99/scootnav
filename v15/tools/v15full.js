// V15 + drop-1 regression, production index.html. brouter.de (403 to this box) is proxied to the local BRouter :17778.
const puppeteer=require('puppeteer-core');const fs=require('fs');
const BASE=process.argv[2]||'http://127.0.0.1:8765/index.html';const OUT='/workspace/scootnav-app/shots/v15/';const PROOF=process.argv[3]||'/workspace/scootnav-app/v15/proof/';
const LBR='http://127.0.0.1:17778/brouter';const TEST_HOME=[42.3499,-71.0782];// Copley Sq, public; label '100 Test St' is made up
const sl=ms=>new Promise(r=>setTimeout(r,ms));const R=[];const ok=(k,v,info)=>{R.push([k,!!v,info===undefined?'':info]);console.log(v?'PASS':'FAIL',k,typeof info==='string'?info.slice(0,300):JSON.stringify(info||'').slice(0,300))};
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'};const proxied={brouter:0,photon_live:0,photon_fallback:0,fixture:0};
async function photon(u){const q=new URL(u).searchParams.get('q')||'';
  if(/test st/i.test(q)){proxied.fixture++;return JSON.stringify({type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'Point',coordinates:[TEST_HOME[1],TEST_HOME[0]]},properties:{housenumber:'100',street:'Test St',city:'Boston',osm_key:'place',osm_value:'house'}}]})}
  try{const r=await fetch(u,{signal:AbortSignal.timeout(9000),headers:{'User-Agent':'ScootNav-test'}});if(r.ok){proxied.photon_live++;return await r.text()}}catch(e){}
  proxied.photon_fallback++;let j=[];try{j=await (await fetch('https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=10&bounded=1&viewbox=-71.19,42.40,-70.99,42.23&q='+encodeURIComponent(q),{headers:{'User-Agent':'ScootNav-test'},signal:AbortSignal.timeout(12000)})).json()}catch(e){}
  return JSON.stringify({type:'FeatureCollection',features:j.map(r=>({type:'Feature',geometry:{type:'Point',coordinates:[+r.lon,+r.lat]},properties:{name:r.name||undefined,housenumber:r.address&&r.address.house_number,street:r.address&&r.address.road,city:r.address&&(r.address.city||r.address.town),osm_key:r.class,osm_value:r.type}}))})}
module.exports.setup=async function(p,errs,warns){
  await p.setRequestInterception(true);
  p.on('request',async r=>{const u=r.url();
    if(r.method()==='OPTIONS'&&/brouter\.de|photon\.komoot/.test(u))return r.respond({status:204,headers:CORS});
    if(u.startsWith('https://brouter.de/brouter')){proxied.brouter++;try{const x=await fetch(LBR+u.slice('https://brouter.de/brouter'.length),{method:r.method(),body:r.method()==='POST'?r.postData():undefined,headers:{'Content-Type':'text/plain'}});
        return r.respond({status:x.status,contentType:x.headers.get('content-type')||'application/json',headers:CORS,body:await x.text()})}catch(e){return r.respond({status:502,headers:CORS,body:'proxy fail'})}}
    if(u.startsWith('https://photon.komoot.io/')){if(/test(%20|\+| )st/i.test(u))return r.respond({status:200,contentType:'application/json',headers:CORS,body:await photon(u)});proxied.photon_live++}
    r.continue()});
  p.on('pageerror',e=>errs.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());if(m.type()==='warn'||m.type()==='warning')warns.push(m.text())});
  p.on('requestfailed',r=>{const f=(r.failure()||{}).errorText||'';(module.exports.netfail=module.exports.netfail||[]).push(r.url().slice(0,100)+' '+f)});}
module.exports.proxied=proxied;
if(require.main!==module)return;
(async()=>{const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',userDataDir:'/tmp/pw/v15full_prof',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await b.newPage();await p.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:false});
const errs=[],warns=[];await module.exports.setup(p,errs,warns);
const URL0=BASE+'?sim=1&lat=42.3489&lon=-71.0951';
const S=async n=>{await sl(500);await p.screenshot({path:OUT+n+'.png'});console.log('  shot',n)};
const ready=()=>p.waitForFunction(()=>window._sn&&_sn.map&&_sn.map.loaded()&&document.querySelector('.me'),{timeout:40000});
const tap=async sel=>{await p.click(sel);await sl(350)};
const seg=async(k,v)=>tap(`#snsheet .sn-seg[data-k="${k}"] button[data-v="${v}"]`);
const typeDest=async(q,wait)=>{await p.click('#dest',{clickCount:3});await p.keyboard.press('Backspace');await sl(1100);await p.type('#dest',q,{delay:80});
  const t0=Date.now();let rows=[];while(Date.now()-t0<(wait||2500)){await sl(500);rows=await p.$$eval('#sugg div[data-i]',d=>d.map(x=>x.innerText.replace(/\n/g,' | ')));if(await p.evaluate(q=>_sn.sugQ===q,q)&&(rows.length||!wait))break}await sl(500);return rows};
const setLanes=async on=>{if(await p.$eval('#more',e=>getComputedStyle(e).display==='none'))await tap('#menu');if(await p.evaluate(()=>lanesOn)!==on)await tap('#layer');await tap('#menu');await sl(300)};
const routeWait=async()=>{await p.waitForFunction(()=>_sn.route,{timeout:60000}).catch(e=>console.log('no route'));await sl(2500)};
const attrib=async()=>{await p.evaluate(()=>{const c=document.querySelector('.maplibregl-ctrl-attrib');if(c){c.classList.add('maplibregl-compact-show');c.setAttribute('open','')}});await sl(400);
  return p.$eval('.maplibregl-ctrl-attrib-inner',e=>e.innerText).catch(()=>'')};
// ---- cold load (fresh profile, empty storage) ----
await p.goto(URL0,{waitUntil:'networkidle2',timeout:60000});await p.evaluate(()=>localStorage.clear());await p.reload({waitUntil:'networkidle2'});await ready();await sl(2000);
ok('D1 cold load Scooter',(await p.$eval('#mode',e=>e.textContent)).includes('Scooter'));await S('01-cold-load-scooter');
ok('D1 PROFILE_VER c6',await p.evaluate(()=>PROFILE_VER==='c6'));
// ---- V15f unset ----
ok('V15f gmh visible >=60px',await p.$eval('#gmh',e=>e.offsetHeight>=60&&getComputedStyle(e).display!=='none'));
ok('V15f gmh unset state',await p.$eval('#gmh',e=>e.classList.contains('unset')));await S('02-gmh-not-set');
// ---- drop-1 search ----
let rows;
rows=await typeDest('Mc');ok('D1 Mc local only (no remote)',rows.every(r=>/Saved|Recent/.test(r)),rows);
rows=await typeDest('McD',15000);if(!rows.length){console.log('McD debug',JSON.stringify(proxied),JSON.stringify(await p.evaluate(()=>[_sn.sugQ,Object.keys(_sn.photon),document.getElementById('sugg').innerText])).slice(0,600));rows=await typeDest('McD',15000)}ok("D1 McD -> McDonald's nearest first",rows.length&&/McDonald/.test(rows[0])&&/Commonwealth/.test(rows[0]),rows.slice(0,3));
rows=await typeDest('El Jefe',15000);ok('D1 El Jefe',rows.some(r=>/El Jefe/.test(r)),rows.slice(0,2));
rows=await typeDest('Prudential',15000);ok('D1 Prudential',rows.some(r=>/Prudential/.test(r)),rows.slice(0,2));
rows=await typeDest('40 Hemen',15000);ok('D1 40 Hemen address row',rows.some(r=>/40 Hemenway Street/.test(r)),rows);
const hi=rows.findIndex(r=>/Hemenway Street/.test(r));await tap(`#sugg div[data-i="${Math.max(0,hi)}"]`);await routeWait();
const r1=await p.evaluate(()=>_sn.route&&{len:Math.round(_sn.route.len),router:_sn.leg.router,steps:_sn.steps.length});ok('D1 route',r1&&r1.len>500,r1);
await tap('#menu');await tap('#layer');await sl(3500);ok('D1 Lanes on',await p.evaluate(()=>_sn.map.getLayoutProperty('lanes','visibility')==='visible'));await S('03-d1-route-lanes-on');
await tap('#layer');await sl(500);ok('D1 Lanes off',await p.evaluate(()=>_sn.map.getLayoutProperty('lanes','visibility')==='none'));
await tap('#sim');await sl(7000);
const card=await p.evaluate(()=>{const c=getComputedStyle(document.getElementById('card'));return {display:c.display,bg:c.backgroundColor,fg:getComputedStyle(document.getElementById('cdist')).color}});ok('D1 sim ride turn card',card.display!=='none'&&card.bg==='rgb(255, 255, 255)'&&card.fg==='rgb(0, 0, 0)',card);
if(await p.$eval('#more',e=>getComputedStyle(e).display==='none'))await tap('#menu');await tap('#miss');await p.waitForFunction(()=>_sn.leg&&_sn.leg.reroutes&&_sn.leg.reroutes.length>0,{timeout:45000}).catch(()=>{});
const rr=await p.evaluate(()=>_sn.leg.reroutes);ok('D1 reroute after Sim miss',rr.length>0,rr[0]);await tap('#menu');
await p.mouse.move(195,450);await p.mouse.down();await p.mouse.move(120,380,{steps:8});await p.mouse.up();await sl(1000);
ok('D1 Recenter appears on pan',await p.$eval('#recenter',e=>getComputedStyle(e).display==='block'));await tap('#recenter');
ok('D1 Recenter hides after tap',await p.$eval('#recenter',e=>getComputedStyle(e).display==='none'));
await tap('#end');await sl(800);if(await p.$eval('#rate',e=>getComputedStyle(e).display!=='none').catch(()=>false))await tap('#skip').catch(()=>{});await sl(500);
ok('D1 handoff_s logged',await p.evaluate(()=>JSON.stringify(localStorage).includes('handoff_s')));
// ---- V15f Set Home ----
await tap('#gmh');ok('V15f unset tap opens Set Home',await p.evaluate(()=>{const t=document.querySelector('#snedit.open .sn-title');return !!t&&t.textContent==='Set Home'}));
await p.click('#snname',{clickCount:3});await p.type('#snname','Test Home');await p.type('#snaddr','100 Test St');await p.waitForSelector('#snesugg div',{timeout:15000}).catch(()=>{});
ok('V15f Set Home autocomplete',await p.$$eval('#snesugg div',d=>d.length>0));await S('04-set-home-autocomplete');
await tap('#snesugg div');await p.$eval('#snaddr',e=>e.value='100 Test St');await tap('#snsave');
ok('V15e/f home saved',await p.evaluate(()=>{const h=SNS.home();return !!h&&h.name==='Test Home'&&h.addr==='100 Test St'}));
await tap('#snsheet [data-act="add"]');await p.type('#snname','Fenway Park');await p.type('#snaddr','Fenway Park');await p.waitForSelector('#snesugg div',{timeout:20000}).catch(()=>{});
const fav=await p.$('#snesugg div');if(fav){await fav.click();await sl(300)}else await tap('#snhere');await tap('#snsave');
await tap('#snsheet [data-act="add"]');await p.type('#snname','Kenmore Sq');await tap('#snhere');await tap('#snsave');
const names=await p.evaluate(()=>SNS.places.map(x=>x.name));ok('V15e places add',names.includes('Fenway Park')&&names.includes('Kenmore Sq'),names);await S('05-settings-places');
const kid=await p.evaluate(()=>SNS.places.find(x=>x.name==='Kenmore Sq').id);
await tap(`#snsheet [data-act="edit"][data-id="${kid}"]`);await p.click('#snname',{clickCount:3});await p.type('#snname','Kenmore Square');await tap('#snsave');
ok('V15e edit',await p.evaluate(()=>SNS.places.some(x=>x.name==='Kenmore Square')));
await tap(`#snsheet [data-act="del"][data-id="${kid}"]`);await tap(`#snsheet [data-act="del"][data-id="${kid}"]`);
ok('V15e delete (two-tap)',await p.evaluate(()=>!SNS.places.some(x=>x.name==='Kenmore Square')));await tap('#snsheet [data-act="close"]');
ok('V15e shared sn_places keeps V9 recents',await p.evaluate(()=>{const s=JSON.parse(localStorage.sn_places);return Array.isArray(s.recent)&&s.recent.length>0&&s.saved.some(x=>x.home)}));
// ---- V15e saved first ----
rows=await typeDest('100');await sl(800);ok('V15e bare house number: Test Home first',rows.length&&/Test Home/.test(rows[0]),rows);await S('06-saved-first-bare-number');
rows=await typeDest('Fen',15000);ok('V15e Fen: saved Fenway first',rows.length&&/Fenway Park/.test(rows[0])&&/Saved/.test(rows[0]),rows.slice(0,3));await S('07-saved-first-Fen');
await tap('#sugg div[data-i="0"]');await routeWait();ok('V15e one tap on saved routes',await p.evaluate(()=>!!_sn.route&&document.getElementById('dest').value.includes('Fenway')));
// ---- V15f one tap home ----
await tap('#gmh');await sl(500);await p.waitForFunction(()=>document.getElementById('dest').value==='Test Home'&&_sn.route&&_sn.leg&&_sn.leg.dest_query==='Test Home',{timeout:40000}).catch(()=>{});await sl(2000);
const hr=await p.evaluate(()=>({dest:document.getElementById('dest').value,sheet:document.getElementById('snsheet').classList.contains('open'),legDest:_sn.leg&&_sn.leg.dest,len:_sn.route&&Math.round(_sn.route.len)}));
ok('V15f one tap routes Home, no confirm',hr.dest==='Test Home'&&!hr.sheet&&hr.len>0,hr);await S('08-gmh-one-tap-route');
// ---- V15a styles + credits ----
const showMe=async(z,keepAttr)=>{await p.evaluate((z,keepAttr)=>{const m=_sn.map;if(!keepAttr){const c=document.querySelector('.maplibregl-ctrl-attrib');if(c){c.classList.remove('maplibregl-compact-show');c.removeAttribute('open')}}
 const e=document.querySelector('.me');if(!e)return;const r=e.getBoundingClientRect(),mr=m.getContainer().getBoundingClientRect();const ll=m.unproject([r.left+r.width/2-mr.left,r.top+r.height/2-mr.top]);m.jumpTo({center:ll,zoom:z});
 const r2=e.getBoundingClientRect(),bt=document.getElementById('bottom').getBoundingClientRect().top;const ty=bt*0.45;m.panBy([0,(r2.top+r2.height/2)-ty],{animate:false})},z,!!keepAttr);await sl(2200)};
const ov=()=>p.evaluate(()=>{const m=_sn.map;return {route:!!m.getLayer('route'),lanes:m.getLayer('lanes')?m.getLayoutProperty('lanes','visibility'):'missing',arrow:document.querySelectorAll('.me').length}});
const style=async st=>{await tap('#snset');await seg('style',st);await tap('#snsheet [data-act="close"]');await p.waitForFunction(()=>_sn.map.isStyleLoaded()&&_sn.map.getLayer('route'),{timeout:25000}).catch(()=>{});await sl(4000)};
const CRED={dark:'© OpenFreeMap © OpenMapTiles © OpenStreetMap contributors',light:'© OpenFreeMap © OpenMapTiles © OpenStreetMap contributors',satellite:'Esri, Maxar, Earthstar Geographics'};
for(const st of ['light','satellite','dark']){await style(st);await showMe(15.5,true);await sl(800);const o=await ov();const a=await attrib();
  ok('V15a style '+st+' (route+arrow kept)',o.route&&o.arrow>0,o);ok('V15a '+st+' credit visible',a.includes(CRED[st]),a);const vis=await p.evaluate(()=>{const e=document.querySelector('.maplibregl-ctrl-attrib');const r=e.getBoundingClientRect(),bt=document.getElementById('bottom').getBoundingClientRect().top;const x=r.left+r.width/2,y=r.top+r.height/2;const hit=document.elementFromPoint(x,y);return {attribBottom:Math.round(r.bottom),panelTop:Math.round(bt),onTop:!!(hit&&e.contains(hit))}});ok('V15a '+st+' credit not covered by panel',vis.onTop&&vis.attribBottom<=vis.panelTop+1,vis);await S('09-style-'+st)}
await setLanes(true);
for(const st of ['satellite','dark']){await style(st);const o=await ov();ok('V15a Lanes survive switch to '+st,o.route&&o.lanes==='visible',o)}
await setLanes(false);ok('V15a Lanes off again',await p.evaluate(()=>_sn.map.getLayoutProperty('lanes','visibility')==='none'));
// ---- V15b arrows ----
const colors=['#3d8bfd','#22c55e','#f97316','#ef4444'];let i=0;
for(const z of ['S','M','L','XL']){await tap('#snset');await tap(`#snsheet [data-color="${colors[i++]}"]`);await seg('size',z);await tap('#snsheet [data-act="close"]');
  const a=await p.$eval('.me',e=>({w:e.offsetWidth,fill:e.querySelector('path').getAttribute('fill')}));
  ok('V15b arrow '+z,a.w===({S:44,M:56,L:76,XL:100})[z]&&a.fill===colors[i-1],a);await showMe(17);await S('10-arrow-'+z)}
// ---- V15c text scale while riding ----
await tap('#start');await sl(2500);
for(const t of ['normal','large','xl']){await tap('#snset');await seg('ts',t);await tap('#snsheet [data-act="close"]');await sl(500);
  const m=await p.evaluate(()=>({cdist:parseFloat(getComputedStyle(document.getElementById('cdist')).fontSize),end:Math.round(document.getElementById('end').getBoundingClientRect().height),card:getComputedStyle(document.getElementById('card')).display}));
  ok('V15c text '+t,m.cdist===({normal:46,large:57.5,xl:69})[t]&&m.card!=='none',m);await S('11-text-'+t)}
await tap('#end').catch(()=>{});await sl(800);if(await p.$eval('#rate',e=>getComputedStyle(e).display!=='none').catch(()=>false))await tap('#skip').catch(()=>{});await sl(500);
// ---- V15d route pref + reload ----
await tap('#snset');await seg('ts','large');await seg('style','light');await seg('pref','quiet');await sl(1500);await S('12-settings-before-reload');await tap('#snsheet [data-act="close"]');
const pid=await p.evaluate(async()=>[await SNS.profileId('scooter','https://brouter.de/brouter'),await SNS.profileId('ebike','https://brouter.de/brouter'),SNS.lastError||'']);ok('V15d quiet profile ids minted',pid[0]&&pid[1],pid);
const before=await p.evaluate(()=>[SNS.settings,SNS.places.map(x=>x.name)]);
await p.reload({waitUntil:'networkidle2'});await ready();await sl(2500);
const after=await p.evaluate(()=>[SNS.settings,SNS.places.map(x=>x.name)]);ok('V15 settings + places restored after reload',JSON.stringify(before)===JSON.stringify(after),after);
ok('V15 arrow restored after reload',await p.$eval('.me',e=>e.offsetWidth===100));
ok('V15 mode still Scooter after reload',(await p.$eval('#mode',e=>e.textContent)).includes('Scooter'));
await tap('#snset');await sl(600);await S('13-settings-after-reload');await tap('#snsheet [data-act="close"]');
const reqs=[];p.on('request',r=>{if(r.url().includes('lonlats='))reqs.push(new URL(r.url()).searchParams.get('profile'))});
await tap('#gmh');await routeWait();ok('V15d route request uses quiet id',reqs.length&&reqs.every(x=>x===pid[0]||x===pid[1]),reqs);
const rt=await p.evaluate(()=>({len:_sn.route&&Math.round(_sn.route.len),router:_sn.leg&&_sn.leg.router}));ok('V15d quiet route ok',rt.len>0,rt);await attrib();await S('14-gmh-route-quiet-light');
const E=[...new Set(errs)],W=[...new Set(warns)];ok('0 console errors',E.length===0,E);
const out={when:new Date().toISOString(),url:URL0,viewport:'390x844@2x',from:'Kenmore Sq 42.3489,-71.0951',test_home:'Test Home, 100 Test St (made-up label at Copley Sq 42.3499,-71.0782)',proxied,network_failures_not_console:(module.exports.netfail||[]),results:R,errors:E,warnings:W,
  passed:R.filter(x=>x[1]).length,failed:R.filter(x=>!x[1]).map(x=>x[0])};
fs.writeFileSync(PROOF+'v15_integrated_check.json',JSON.stringify(out,null,1));console.log('passed',out.passed,'failed',out.failed,'warn',W,'proxied',proxied);await b.close()})().catch(e=>{console.log('CRASH',e.stack);process.exit(1)});
