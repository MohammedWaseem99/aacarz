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

  for(const route of ['home','cars','brands','brand/toyota','car/1','appointment/1','appointment/2','appointment/3','process','more','faq','contact','trade-in','financing','about','compare']){
    await evaluate('location.hash='+JSON.stringify(route));await new Promise(r=>setTimeout(r,140));
    if(!await evaluate("document.querySelectorAll('#app .scroll-reveal-target').length>0"))throw new Error('No scroll reveals on '+route);
    if(await evaluate("document.querySelectorAll('#site-header .scroll-reveal-target,#bottom-nav .scroll-reveal-target,.gallery-stage .scroll-reveal-target').length"))throw new Error('Controls were animated on '+route);
  }
  await evaluate("location.hash='home'");await new Promise(r=>setTimeout(r,120));
  if(!await evaluate("document.querySelector('.appointment-invite').classList.contains('scroll-reveal-target') && !document.querySelector('.appointment-invite').classList.contains('scroll-reveal-visible')"))throw new Error('Offscreen appointment section was revealed too early.');
  await evaluate("document.querySelector('.appointment-invite').scrollIntoView({block:'center'})");await new Promise(r=>setTimeout(r,160));
  if(!await evaluate("document.querySelector('.appointment-invite').classList.contains('scroll-reveal-visible')"))throw new Error('Scrolling did not reveal section.');
  await cdp('Emulation.setFocusEmulationEnabled',{enabled:true});
  await evaluate("window.scrollTo(0,0);document.querySelector('#site-footer .footer-links a').focus({preventScroll:true})");
  if(!await evaluate("document.querySelector('#site-footer .footer-links').classList.contains('scroll-reveal-immediate')"))throw new Error('Keyboard focus did not reveal its parent: '+JSON.stringify(await evaluate("({className:document.querySelector('#site-footer .footer-links').className,active:document.activeElement.outerHTML,focus:document.hasFocus()})")));
  await evaluate("location.hash='cars'");await new Promise(r=>setTimeout(r,130));await evaluate("document.querySelector('#search').value='BMW';document.querySelector('#search').dispatchEvent(new Event('input',{bubbles:true}))");await new Promise(r=>setTimeout(r,130));
  if(!await evaluate("document.querySelector('.car-card').classList.contains('scroll-reveal-target')"))throw new Error('Dynamic search result was not registered.');
  await evaluate("location.hash='car/1'");await new Promise(r=>setTimeout(r,120));await evaluate("document.querySelector('[data-tab=Features]').click()");await new Promise(r=>setTimeout(r,130));
  if(!await evaluate("document.querySelector('.detail-info-card').classList.contains('scroll-reveal-target')"))throw new Error('Dynamic tab content was not registered.');
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await new Promise(r=>setTimeout(r,100));
  if(!await evaluate("Array.from(document.querySelectorAll('.scroll-reveal-target')).every(el=>getComputedStyle(el).opacity==='1')"))throw new Error('Reduced-motion content was hidden.');
  await evaluate("location.hash='more'");await new Promise(r=>setTimeout(r,130));
  if(await evaluate("document.querySelectorAll('#app .scroll-reveal-target').length"))throw new Error('Reduced-motion route received animations.');
  if(errors.length)throw new Error(errors.join('; '));console.log('Passed: scroll reveals on 16 routes, stable controls, viewport triggers, keyboard visibility, dynamic search/tabs and reduced-motion support.');
} finally {
  if(socket?.readyState===1){socket.send(JSON.stringify({id:99999,method:'Browser.close'}));socket.close()}
  chrome.kill();
}
