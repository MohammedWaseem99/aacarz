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

  const red='rgb(211, 12, 7)';
  for(const selector of ['.hero-button','.hero-brand-line','#bottom-nav .active','#site-footer']){const color=await evaluate('getComputedStyle(document.querySelector('+JSON.stringify(selector)+')).'+(selector==='.hero-button'?'backgroundColor':selector==='#site-footer'?'borderTopColor':'color'));if(color!==red)throw new Error('Logo red mismatch: '+selector+' '+color);}
  await new Promise(r=>setTimeout(r,1400));await writeFile('qa/logo-red-home.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await evaluate("location.hash='faq'");await new Promise(r=>setTimeout(r,100));if(await evaluate("getComputedStyle(document.querySelector('.faq-categories .active')).backgroundColor")!==red)throw new Error('FAQ active state color mismatch.');
  await evaluate("location.hash='car/1'");await new Promise(r=>setTimeout(r,100));if(await evaluate("getComputedStyle(document.querySelector('.gallery-featured-tag')).backgroundColor")!=='rgb(36, 131, 76)')throw new Error('Green featured status was changed.');
  if(await evaluate("getComputedStyle(document.querySelector('.product-visit-card .button')).backgroundColor")!==red)throw new Error('Product CTA color mismatch.');
  if(errors.length)throw new Error(errors.join('; '));console.log('Passed: logo red on buttons, hero text, active nav, footer border, FAQ selection and product CTA; green Featured status preserved.');
} finally {
  if(socket?.readyState===1){socket.send(JSON.stringify({id:99999,method:'Browser.close'}));socket.close()}
  chrome.kill();
}
