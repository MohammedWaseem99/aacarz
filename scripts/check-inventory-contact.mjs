import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const port=9274;
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',`--remote-debugging-port=${port}`,`--user-data-dir=${resolve('.inventory-qa')}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
let socket;
try {
  let pages;for(let i=0;i<60;i+=1){try{pages=await(await fetch(`http://127.0.0.1:${port}/json`)).json();break}catch{await new Promise(done=>setTimeout(done,250))}}
  if(!pages)throw new Error('Chrome preview was unavailable.');
  socket=new WebSocket(pages.find(page=>page.type==='page').webSocketDebuggerUrl);await new Promise((done,fail)=>{socket.onopen=done;socket.onerror=fail});
  let id=0;const pending=new Map();socket.onmessage=event=>{const data=JSON.parse(event.data);if(data.id&&pending.has(data.id)){const request=pending.get(data.id);pending.delete(data.id);data.error?request.reject(new Error(data.error.message)):request.resolve(data.result)}};
  const cdp=(method,params={})=>new Promise((done,fail)=>{const requestId=++id;pending.set(requestId,{resolve:done,reject:fail});socket.send(JSON.stringify({id:requestId,method,params}))});
  const evaluate=async expression=>(await cdp('Runtime.evaluate',{expression,returnByValue:true})).result.value;
  await cdp('Page.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await cdp('Page.navigate',{url:pathToFileURL(resolve('dist/index.html')).href});await new Promise(done=>setTimeout(done,500));
  await evaluate("location.hash='cars'");await new Promise(done=>setTimeout(done,250));
  if(await evaluate(`document.querySelectorAll('.car-card').length`)!==21)throw new Error('Expected 21 inventory vehicles.');
  if(!await evaluate(`document.querySelector('#whatsapp-float')?.href.includes('94777972569')`))throw new Error('WhatsApp shortcut is missing.');
  if(await evaluate(`getComputedStyle(document.querySelector('#whatsapp-float')).bottom`)==='auto')throw new Error('WhatsApp shortcut is not positioned.');
  for(let id=1;id<=21;id+=1){await evaluate(`location.hash='car/${id}'`);await new Promise(done=>setTimeout(done,90));if(!await evaluate(`Array.from(document.querySelectorAll('.gallery-thumbnail span')).some(node=>node.textContent==='Rear seats')`))throw new Error(`Rear-seat photo is missing for vehicle ${id}`)}
  await evaluate("location.hash='contact'");await new Promise(done=>setTimeout(done,250));
  if(!await evaluate(`document.querySelector('.contact-map iframe')?.src.includes('google.com/maps')`))throw new Error('Showroom map is missing.');
  if(!await evaluate(`document.querySelector('.contact-map a')?.href.includes('maps.app.goo.gl/uqDQpJ7fuBmZAhf98')`))throw new Error('Showroom map link is incorrect.');
  if(!await evaluate(`document.querySelector('.contact-details').textContent.includes('077 797 2569')`))throw new Error('WhatsApp contact number is missing.');
  console.log('Inventory, rear-seat galleries, WhatsApp, and map QA passed.');
} finally {socket?.close();chrome.kill();}
