// Records shots/v15/recenter.mp4 and get-me-home.mp4 (390x844). Same proxy/setup as v15full.js.
const puppeteer=require('puppeteer-core');const fs=require('fs');const {execFileSync}=require('child_process');
const H=require('/tmp/pw/v15full.js');const OUT='/workspace/scootnav-app/shots/v15/';
const sl=ms=>new Promise(r=>setTimeout(r,ms));
const URL0='http://127.0.0.1:8765/index.html?sim=1&lat=42.3489&lon=-71.0951';
const HOME={saved:[{name:'Test Home',addr:'100 Test St, Boston',ll:[42.3499,-71.0782],home:true}],recent:[]};
async function rec(name,body){
  const prof='/tmp/pw/rec_prof_'+name;fs.rmSync(prof,{recursive:true,force:true});
  const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',userDataDir:prof,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const p=await b.newPage();await p.setViewport({width:390,height:844,deviceScaleFactor:1});
  const errs=[],warns=[];await H.setup(p,errs,warns);
  await p.goto(URL0,{waitUntil:'networkidle2',timeout:60000});
  await p.evaluate(h=>{localStorage.clear();localStorage.setItem('sn_places',JSON.stringify(h))},HOME);
  await p.reload({waitUntil:'networkidle2'});
  await p.waitForFunction(()=>window._sn&&_sn.map&&_sn.map.loaded()&&document.querySelector('.me'),{timeout:40000});await sl(2500);
  await p.evaluate(()=>{const c=document.createElement('div');c.id='cap';c.style.cssText='position:fixed;left:8px;top:45%;z-index:99;background:rgba(255,235,59,.95);color:#000;font:bold 15px sans-serif;padding:6px 10px;border-radius:8px;pointer-events:none';document.body.appendChild(c);
    window._tapviz=(x,y)=>{const d=document.createElement('div');d.style.cssText=`position:fixed;left:${x-22}px;top:${y-22}px;width:44px;height:44px;border-radius:50%;border:4px solid #ff1744;background:rgba(255,23,68,.25);z-index:100;pointer-events:none`;document.body.appendChild(d);setTimeout(()=>d.remove(),380)}});
  const cap=t=>p.evaluate(t=>{document.getElementById('cap').textContent=t},t);
  const tap=async sel=>{const r=await p.$eval(sel,e=>{const q=e.getBoundingClientRect();return [q.left+q.width/2,q.top+q.height/2]});await p.evaluate((x,y)=>_tapviz(x,y),r[0],r[1]);await sl(350);await p.click(sel);await sl(400)};
  const dir='/tmp/pw/frames_'+name;fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir);
  const cdp=await p.target().createCDPSession();const frames=[];
  cdp.on('Page.screencastFrame',async f=>{frames.push({t:f.metadata.timestamp,d:f.data});cdp.send('Page.screencastFrameAck',{sessionId:f.sessionId}).catch(()=>{})});
  await cdp.send('Page.startScreencast',{format:'jpeg',quality:80,everyNthFrame:1});
  const info=await body(p,{cap,tap,sl});
  await sl(800);await cdp.send('Page.stopScreencast');await b.close();
  // write frames with real durations via concat demuxer
  let list='';frames.forEach((f,i)=>{const fn=`${dir}/f${String(i).padStart(5,'0')}.jpg`;fs.writeFileSync(fn,Buffer.from(f.d,'base64'));const dur=i<frames.length-1?Math.max(0.01,frames[i+1].t-f.t):0.5;list+=`file '${fn}'\nduration ${dur.toFixed(3)}\n`});
  list+=`file '${dir}/f${String(frames.length-1).padStart(5,'0')}.jpg'\n`;fs.writeFileSync(dir+'/list.txt',list);
  const mp4=OUT+name+'.mp4';
  execFileSync('ffmpeg',['-loglevel','error','-y','-f','concat','-safe','0','-i',dir+'/list.txt','-vf','scale=390:844,fps=25,format=yuv420p','-c:v','libx264','-crf','26','-preset','medium','-movflags','+faststart',mp4]);
  const res={mp4,bytes:fs.statSync(mp4).size,frames:frames.length,secs:+(frames[frames.length-1].t-frames[0].t).toFixed(1),errors:errs,info};
  console.log(JSON.stringify(res));return res}
(async()=>{const all={};
all.recenter=await rec('recenter',async(p,{cap,tap,sl})=>{
  await cap('Route to 40 Hemenway St');await p.type('#dest','40 Hemen',{delay:70});
  await p.waitForFunction(()=>[...document.querySelectorAll('#sugg div[data-i]')].some(d=>/Hemenway Street/.test(d.innerText)),{timeout:20000});await sl(600);
  const hi=await p.$$eval('#sugg div[data-i]',d=>d.findIndex(x=>/Hemenway Street/.test(x.innerText)));await tap(`#sugg div[data-i="${Math.max(0,hi)}"]`);
  await p.waitForFunction(()=>_sn.route,{timeout:60000});await sl(1500);
  await cap('Sim ride');if(await p.$eval('#more',e=>getComputedStyle(e).display==='none'))await tap('#menu');await tap('#sim');if(await p.$eval('#more',e=>getComputedStyle(e).display!=='none'))await tap('#menu');await sl(5000);
  const c0=await p.evaluate(()=>_sn.map.getCenter().toArray());
  await cap('Pan away');await p.mouse.move(200,480);await p.mouse.down();await p.mouse.move(60,300,{steps:20});await p.mouse.up();await sl(400);
  await p.mouse.move(200,480);await p.mouse.down();await p.mouse.move(80,340,{steps:20});await p.mouse.up();await sl(1800);
  const shown=await p.$eval('#recenter',e=>getComputedStyle(e).display==='block');
  const me1=await p.evaluate(()=>{const r=document.querySelector('.me').getBoundingClientRect();return [Math.round(r.left+r.width/2),Math.round(r.top+r.height/2)]});
  await cap('Tap Recenter');await tap('#recenter');await sl(2500);
  const me2=await p.evaluate(()=>{const r=document.querySelector('.me').getBoundingClientRect();return [Math.round(r.left+r.width/2),Math.round(r.top+r.height/2)]});
  const hidden=await p.$eval('#recenter',e=>getComputedStyle(e).display==='none');
  await cap('Map snapped back to the rider');await sl(2500);return {recenter_shown_after_pan:shown,arrow_px_after_pan:me1,arrow_px_after_recenter:me2,recenter_hidden_after_tap:hidden}});
all.gmh=await rec('get-me-home',async(p,{cap,tap,sl})=>{
  const st=await p.$eval('#gmh',e=>({unset:e.classList.contains('unset'),text:e.innerText}));
  await cap('Test Home saved. One tap:');await sl(1800);await tap('#gmh');
  const t0=Date.now();await p.waitForFunction(()=>_sn.route&&_sn.leg&&_sn.leg.dest_query==='Test Home',{timeout:45000}).catch(()=>{});const ms=Date.now()-t0;
  await sl(800);const r=await p.evaluate(()=>({dest:document.getElementById('dest').value,len:_sn.route&&Math.round(_sn.route.len),confirmOpen:!!document.querySelector('#snedit.open,#snsheet.open')}));
  await cap('Route home ready, no confirm');await sl(2500);
  return Object.assign({gmh_before:st,route_ms:ms},r)});
fs.writeFileSync('/workspace/scootnav-app/v15/proof/v15_videos.json',JSON.stringify(all,null,1));process.exit(0)})().catch(e=>{console.error(e);process.exit(1)});
