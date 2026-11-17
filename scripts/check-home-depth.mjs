import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const port=9264;
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',[
  '--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',
  `--remote-debugging-port=${port}`,`--user-data-dir=${resolve('.browser-qa')}`,'about:blank'
],{windowsHide:true,stdio:'ignore'});
let socket;
try {
  let pages;
  for(let i=0;i<60;i++){
    try{pages=await(await fetch(`http://127.0.0.1:${port}/json`)).json();break}catch{await new Promise(r=>setTimeout(r,250))}
  }
  if(!pages)throw new Error('Chrome preview was unavailable.');
  socket=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
  await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j});
  let nextId=0;const pending=new Map();const errors=[];
  socket.onmessage=event=>{const data=JSON.parse(event.data);if(data.id){const entry=pending.get(data.id);if(entry){pending.delete(data.id);data.error?entry.reject(new Error(data.error.message)):entry.resolve(data.result)}}if(data.method==='Runtime.exceptionThrown')errors.push(data.params.exceptionDetails.exception?.description||data.params.exceptionDetails.text)};
  const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++nextId;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}))});
  const evaluate=async expression=>(await cdp('Runtime.evaluate',{expression,returnByValue:true})).result.value;
  await cdp('Page.enable');await cdp('Runtime.enable');
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  const url=pathToFileURL(resolve('dist/index.html')).href;
  await cdp('Page.navigate',{url});await new Promise(r=>setTimeout(r,500));
  await mkdir('qa',{recursive:true});

  if(!await evaluate("document.querySelector('#site-shell').classList.contains('home-depth-enabled') && document.querySelectorAll('.home-depth-surface').length>=10"))throw new Error('Home depth surfaces missing.');
  const navTop=await evaluate("document.querySelector('#bottom-nav').getBoundingClientRect().top");
  await evaluate('window.scrollTo(0,250)');await new Promise(r=>setTimeout(r,220));
  if(!await evaluate("parseFloat(document.querySelector('.hero-car').style.getPropertyValue('--hero-depth-y'))>0 && getComputedStyle(document.querySelector('.hero-car')).transform.startsWith('matrix3d')"))throw new Error('Hero scroll perspective failed.');
  if(await evaluate("document.querySelector('#bottom-nav').getBoundingClientRect().top")!==navTop)throw new Error('Depth animation moved fixed navigation.');
  for(const width of [250,390,1440]){await cdp('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:width<768});await evaluate("(()=>{const card=document.querySelector('.vehicle-type-card');window.scrollTo(0,card.getBoundingClientRect().top+scrollY-innerHeight*.7)})()");await new Promise(r=>setTimeout(r,800));if(await evaluate('document.documentElement.scrollWidth>'+width))throw new Error('3D effects cause overflow at '+width);if(!await evaluate("getComputedStyle(document.querySelector('.vehicle-type-card')).transform.startsWith('matrix3d')"))throw new Error('Vehicle card perspective missing.');if(width===390)await writeFile('qa/home-3d-scroll.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));}
  await evaluate("location.hash='cars'");await new Promise(r=>setTimeout(r,130));if(await evaluate("document.querySelector('#site-shell').classList.contains('home-depth-enabled')"))throw new Error('Home depth leaked to other routes.');
  await evaluate("location.hash='home'");await new Promise(r=>setTimeout(r,130));await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await new Promise(r=>setTimeout(r,100));
  if(await evaluate("document.querySelector('#site-shell').classList.contains('home-depth-enabled') || document.querySelectorAll('.home-depth-surface').length>0"))throw new Error('Reduced motion failed to clean up 3D effects.');
  if(errors.length)throw new Error(errors.join('; '));console.log('Passed: scroll-driven hero/card perspective, fixed navigation, 250/390/1440px layouts, route cleanup and reduced-motion support.');
} finally {
  if(socket?.readyState===1){socket.send(JSON.stringify({id:99999,method:'Browser.close'}));socket.close()}
  chrome.kill();
}
