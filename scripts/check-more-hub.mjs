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

  if(!await evaluate("getComputedStyle(document.querySelector('#site-header .header-menu')).display==='none'"))throw new Error('Mobile header menu is still visible.');
  await evaluate("location.hash='more'");await new Promise(r=>setTimeout(r,100));
  const destinations=await evaluate("Array.from(document.querySelectorAll('.more-hub a')).map(a=>a.getAttribute('href'))");for(const route of ['appointment','trade-in','process','financing','compare','about','contact','faq','cars'])if(!destinations.includes('#'+route))throw new Error('Missing More destination: '+route);
  for(const width of [250,390,1440]){await cdp('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:width<768});await new Promise(r=>setTimeout(r,100));if(await evaluate('document.documentElement.scrollWidth>'+width))throw new Error('More page overflow: '+width);if(width===390)await writeFile('qa/more-hub-mobile.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));if(width===1440&&!await evaluate("getComputedStyle(document.querySelector('#site-header .header-menu')).display!=='none'"))throw new Error('Desktop menu was removed.');}
  await evaluate("document.querySelector('.more-quick-book').click()");await new Promise(r=>setTimeout(r,100));if(!await evaluate("!!document.querySelector('#booking-form')"))throw new Error('Quick booking link failed.');
  await evaluate("location.hash='more'");await new Promise(r=>setTimeout(r,100));await evaluate("document.querySelector('.more-quick-trade').click()");await new Promise(r=>setTimeout(r,100));if(!await evaluate("!!document.querySelector('.trade-hero')"))throw new Error('Quick trade-in link failed.');
  if(errors.length)throw new Error(errors.join('; '));console.log('Passed: mobile menu hidden, desktop menu retained, all More links present, booking/trade-in actions and responsive layouts.');
} finally {
  if(socket?.readyState===1){socket.send(JSON.stringify({id:99999,method:'Browser.close'}));socket.close()}
  chrome.kill();
}
