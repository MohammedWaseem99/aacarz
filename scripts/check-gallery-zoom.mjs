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

  await cdp('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
  await evaluate("location.hash='car/1'");await new Promise(r=>setTimeout(r,150));
  await evaluate("document.querySelector('[data-gallery-open]').click()");await new Promise(r=>setTimeout(r,150));
  if(!await evaluate("document.querySelector('#gallery-lightbox').open && galleryZoom.scale===1"))throw new Error('Photo viewer did not open at normal zoom.');
  await evaluate("document.querySelector('[data-zoom-in]').click()");
  if(!await evaluate("galleryZoom.scale===1.5"))throw new Error('Zoom in button failed.');
  await evaluate("document.querySelector('[data-zoom-reset]').click()");
  const box=await evaluate("(()=>{const r=document.querySelector('.lightbox-viewport').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()");
  const touches=(radius)=>[{x:box.x-radius,y:box.y,id:1},{x:box.x+radius,y:box.y,id:2}];
  await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touches(30)});
  await cdp('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:touches(65)});
  await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  if(!await evaluate("galleryZoom.scale>2"))throw new Error('Pinch zoom failed.');
  await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x,y:box.y,id:1}]});
  await cdp('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x-60,y:box.y,id:1}]});
  await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  if(!await evaluate("galleryZoom.x<0"))throw new Error('Zoomed image pan failed.');
  for(let i=0;i<2;i++){await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x,y:box.y,id:1}]});await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await new Promise(r=>setTimeout(r,70));}
  if(!await evaluate("galleryZoom.scale===1"))throw new Error('Double tap reset failed.');
  for(let i=0;i<2;i++){await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x,y:box.y,id:1}]});await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await new Promise(r=>setTimeout(r,70));}
  if(!await evaluate("galleryZoom.scale>1"))throw new Error('Double tap zoom failed.');
  await writeFile('qa/product-photo-zoom.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await evaluate("document.querySelector('#gallery-lightbox [data-gallery-step=\"1\"]').click()");
  if(!await evaluate("galleryZoom.scale===1 && galleryZoom.x===0"))throw new Error('Changing photos did not reset zoom.');
  for(let i=0;i<10;i++)await evaluate("document.querySelector('[data-zoom-in]').click()");if(!await evaluate("galleryZoom.scale===4 && document.querySelector('[data-zoom-in]').disabled"))throw new Error('Zoom limit failed.');
  await evaluate("document.querySelector('[data-zoom-reset]').click()");
  const beforeSwipe=await evaluate('galleryIndex');
  await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+60,y:box.y,id:1}]});
  await cdp('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x-60,y:box.y,id:1}]});
  await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  if(await evaluate('galleryIndex')===beforeSwipe)throw new Error('Normal-size photo swipe failed.');
  await evaluate("document.querySelector('[data-gallery-close]').click()");await new Promise(r=>setTimeout(r,100));if(!await evaluate("!document.body.classList.contains('gallery-is-open')"))throw new Error('Page scroll was not restored.');
  if(errors.length)throw new Error(errors.join('; '));console.log('Passed: tap-to-open, zoom buttons, trusted touch pinch, pan, double-tap, per-photo reset, zoom limits and close.');
} finally {
  if(socket?.readyState===1){socket.send(JSON.stringify({id:99999,method:'Browser.close'}));socket.close()}
  chrome.kill();
}
