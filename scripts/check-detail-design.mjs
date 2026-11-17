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

  await evaluate("document.querySelector('.appointment-invite').scrollIntoView({block:'center'})");await new Promise(r=>setTimeout(r,200));
  if(!await evaluate("document.querySelector('.appointment-invite-image img').naturalWidth>=1200"))throw new Error('Appointment image missing.');
  await writeFile('qa/appointment-invite-mobile.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await evaluate("document.querySelector('.appointment-invite-copy>.button').click()");await new Promise(r=>setTimeout(r,100));if(!await evaluate("!!document.querySelector('#booking-form')"))throw new Error('Booking CTA failed.');
  for(const width of [250,390,1440]){
    await cdp('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:width<768});
    await evaluate("location.hash='car/2'");await new Promise(r=>setTimeout(r,100));
    for(const [name,count]of [['Specifications',5],['Features',4],['Condition',4]]){
      await evaluate(`document.querySelector('[data-tab="${name}"]').click()`);await new Promise(r=>setTimeout(r,100));
      await evaluate("document.querySelector('.detail-tabs').scrollIntoView({behavior:'instant',block:'start'})");await new Promise(r=>setTimeout(r,100));
      if(await evaluate("document.querySelectorAll('.detail-designed-panel .detail-info-card').length")!==count)throw new Error('Incorrect '+name+' cards.');
      if(await evaluate('document.documentElement.scrollWidth>'+width))throw new Error(name+' overflows at '+width);
      if(width===390)await writeFile('qa/detail-'+name.toLowerCase()+'-cards.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
    }
  }
  await evaluate("location.hash='home'");await new Promise(r=>setTimeout(r,100));await evaluate("document.querySelector('.appointment-invite').scrollIntoView({block:'center'})");await new Promise(r=>setTimeout(r,200));
  await writeFile('qa/appointment-invite-desktop.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  if(errors.length)throw new Error(errors.join('; '));console.log('Passed: appointment image and booking link; Specifications, Features and Condition cards; no overflow at 250, 390 and 1440px.');
} finally {
  if(socket?.readyState===1){socket.send(JSON.stringify({id:99999,method:'Browser.close'}));socket.close()}
  chrome.kill();
}
