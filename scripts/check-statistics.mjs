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

  if(!await evaluate("Array.from(document.querySelectorAll('[data-stat-target]')).every(el=>el.textContent==='0+')"))throw new Error('Counters did not start at zero.');
  if(await evaluate("document.querySelector('.dealership-statistics').textContent.includes('Expert Professionals')"))throw new Error('Old professionals label remains.');
  await evaluate("document.querySelector('.dealership-statistics').scrollIntoView({block:'center'})");
  await new Promise(r=>setTimeout(r,350));
  const intermediate=await evaluate("parseInt(document.querySelector('[data-stat-target]').textContent)");
  if(!(intermediate>0&&intermediate<500))throw new Error('Counter animation did not advance through intermediate values.');
  await new Promise(r=>setTimeout(r,1800));
  const values=await evaluate("Array.from(document.querySelectorAll('[data-stat-target]')).map(el=>el.textContent)");
  if(values.join(',')!=='500+,10+,450+,200+')throw new Error('Incorrect final counters: '+values);
  await writeFile('qa/animated-statistics.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await evaluate("location.hash='cars'");await new Promise(r=>setTimeout(r,100));await evaluate("location.hash='home'");await new Promise(r=>setTimeout(r,100));
  if(!await evaluate("document.querySelector('[data-stat-target]').textContent==='500+'"))throw new Error('Reduced motion did not show final totals.');
  if(errors.length)throw new Error(errors.join('; '));
  console.log('Passed: zero start, intermediate animation, final totals, experience since 2016 and reduced-motion support.');
} finally {
  if(socket?.readyState===1){socket.send(JSON.stringify({id:99999,method:'Browser.close'}));socket.close()}
  chrome.kill();
}
