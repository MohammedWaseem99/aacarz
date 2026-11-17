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

  if(!await evaluate("!!document.querySelector('.hero-eyebrow') && document.querySelectorAll('.hero-copy h1>span').length===3"))throw new Error('Enhanced hero markup missing.');
  if(!await evaluate("getComputedStyle(document.querySelector('.hero-car img')).animationName==='hero-image-arrive'"))throw new Error('Hero image animation missing.');
  await new Promise(r=>setTimeout(r,1300));
  for(const width of [250,390,1440]){
    await cdp('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:width<768});await new Promise(r=>setTimeout(r,150));
    if(await evaluate('document.documentElement.scrollWidth>'+width))throw new Error('Hero overflow at '+width);
    if(!await evaluate("(()=>{const c=document.querySelector('.hero-copy').getBoundingClientRect(),h=document.querySelector('.home-hero').getBoundingClientRect();return c.bottom<=h.bottom+1})()"))throw new Error('Hero clips its content at '+width);
    if([390,1440].includes(width))await writeFile('qa/animated-hero-'+width+'.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  }
  await evaluate("document.querySelector('.hero-button').click()");await new Promise(r=>setTimeout(r,100));if(!await evaluate("!!document.querySelector('#car-finder-form') && location.hash==='#cars'"))throw new Error('Hero browse link failed.');
  await evaluate("location.hash='home'");await new Promise(r=>setTimeout(r,100));await evaluate("document.querySelector('.hero-visit-link').click()");await new Promise(r=>setTimeout(r,100));if(!await evaluate("!!document.querySelector('#booking-form')"))throw new Error('Hero booking link failed.');
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await evaluate("location.hash='home'");await new Promise(r=>setTimeout(r,100));
  if(!await evaluate("getComputedStyle(document.querySelector('.hero-car img')).animationName==='none' && getComputedStyle(document.querySelector('.hero-copy h1>span')).animationName==='none' && getComputedStyle(document.querySelector('.hero-copy h1>span')).opacity==='1'"))throw new Error('Reduced motion support failed.');
  if(errors.length)throw new Error(errors.join('; '));console.log('Passed: hero animations, readable unclipped content at 250/390/1440px, browse and booking actions, and reduced-motion support.');
} finally {
  if(socket?.readyState===1){socket.send(JSON.stringify({id:99999,method:'Browser.close'}));socket.close()}
  chrome.kill();
}
