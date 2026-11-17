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

  await evaluate("document.querySelector('.trade-promo').scrollIntoView({block:'center'})");await new Promise(r=>setTimeout(r,200));
  await writeFile('qa/trade-banner-mobile.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await evaluate("document.querySelector('.trade-promo-link').click()");await new Promise(r=>setTimeout(r,150));
  if(!await evaluate("!!document.querySelector('.trade-hero') && document.querySelectorAll('.trade-process-step').length===3"))throw new Error('Trade-in page failed.');
  if(!await evaluate("document.querySelector('.trade-hero img').naturalWidth>=1200"))throw new Error('Trade-in hero photo missing.');
  await evaluate("document.querySelector('.trade-faq summary').click()");if(!await evaluate("document.querySelector('.trade-faq details').open"))throw new Error('Trade-in FAQ failed.');
  for(const width of [250,390,768,1440]){await cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});await evaluate('window.scrollTo(0,0)');await new Promise(r=>setTimeout(r,150));if(await evaluate('document.documentElement.scrollWidth>'+width))throw new Error('Trade page overflow: '+width);if([390,1440].includes(width))await writeFile('qa/trade-page-'+width+'.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));}
  await evaluate("document.querySelector('.trade-question-link').click()");await new Promise(r=>setTimeout(r,100));
  if(!await evaluate("document.querySelector('#contact-subject').value==='Trade-In' && document.querySelector('#contact-message').value.includes('trading in')"))throw new Error('Trade-in enquiry prefill failed.');
  await evaluate("location.hash='trade-in'");await new Promise(r=>setTimeout(r,100));await evaluate("document.querySelector('[data-trade-appointment]').click()");await new Promise(r=>setTimeout(r,100));
  if(!await evaluate("!!document.querySelector('#booking-form') && booking.purpose==='Discuss & Negotiate'"))throw new Error('Trade-in booking link failed.');
  if(errors.length)throw new Error(errors.join('; '));console.log('Passed: banner link, original hero image, three steps, FAQ, enquiry prefill, booking and four responsive sizes.');
} finally {
  if(socket?.readyState===1){socket.send(JSON.stringify({id:99999,method:'Browser.close'}));socket.close()}
  chrome.kill();
}
