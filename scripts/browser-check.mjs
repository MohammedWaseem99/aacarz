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
  const screens=[['home','home'],['brands','brands'],['brand/toyota','toyota'],['car/1','overview'],['cars','cars'],['appointment/1','booking-details'],['appointment/2','booking-schedule'],['appointment/3','booking-confirm'],['process','purchase'],['more','more']];
  for(const[route,name]of screens){
    await evaluate(`location.hash=${JSON.stringify(route)}`);await new Promise(r=>setTimeout(r,100));
    if(!await evaluate(`document.querySelector('#app').innerHTML.length>100`))throw new Error(`Empty view: ${route}`);
    if(await evaluate('document.documentElement.scrollWidth>390'))throw new Error(`Horizontal overflow: ${route}`);
    if(await evaluate('Array.from(document.images).some(i=>i.loading!=="lazy"&&(!i.complete||!i.naturalWidth))'))throw new Error(`Missing image: ${route}`);
    const screenshot=await cdp('Page.captureScreenshot',{format:'png'});await writeFile(`qa/${name}.png`,Buffer.from(screenshot.data,'base64'));
  }
  await evaluate("location.hash='car/1'");await new Promise(r=>setTimeout(r,100));
  await evaluate(`document.querySelector('[data-tab="Specifications"]').click()`);
  if(!await evaluate(`document.querySelector('.detail-panel').textContent.includes('2000 CC')`))throw new Error('Specifications tab failed.');
  await writeFile('qa/specifications.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await evaluate("location.hash='cars'");await new Promise(r=>setTimeout(r,100));
  await evaluate(`document.querySelector('#search').value='BMW';document.querySelector('#search').dispatchEvent(new Event('input',{bubbles:true}))`);
  if(await evaluate(`document.querySelectorAll('.car-card').length`)!==1)throw new Error('Search failed.');
  const savedBefore=await evaluate(`document.querySelector('[data-save]').getAttribute('aria-pressed')`);
  await evaluate(`document.querySelector('[data-save]').click()`);
  if(await evaluate(`document.querySelector('[data-save]').getAttribute('aria-pressed')`)===savedBefore)throw new Error('Favourites failed.');
  await evaluate("location.hash='appointment/1'");await new Promise(r=>setTimeout(r,100));
  await evaluate(`document.querySelector('#name').value='Test Visitor';document.querySelector('#phone').value='0771234567';document.querySelector('#email').value='test@example.com';document.querySelector('#booking-form').requestSubmit()`);
  if(!await evaluate(`!!document.querySelector('#date')`))throw new Error('Booking details submission failed.');
  await evaluate(`document.querySelector('#date').value='2027-12-01';document.querySelector('#time').value='10:00 AM';document.querySelector('#booking-form').requestSubmit()`);
  if(!await evaluate(`document.querySelector('#booking-form').textContent.includes('Review & Confirm')`))throw new Error('Booking schedule submission failed.');
  await evaluate(`document.querySelector('[name=confirmed]').checked=true;document.querySelector('#booking-form').requestSubmit()`);
  if(!await evaluate(`document.querySelector('.booking-success').textContent.includes('Appointment saved')`))throw new Error('Booking confirmation failed.');
  await evaluate("location.hash='home'");await new Promise(r=>setTimeout(r,100));
  if(await evaluate(`document.querySelectorAll('.home-featured .range-card').length`)!==21)throw new Error('Home featured cars failed.');
  await evaluate(`document.querySelector('.home-faq summary').click()`);
  if(!await evaluate(`document.querySelector('.home-faq details').open`))throw new Error('Home FAQ did not expand.');
  const layout=await cdp('Page.getLayoutMetrics');
  await writeFile('qa/home-full.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:390,height:layout.cssContentSize.height,scale:1}})).data,'base64'));
  await evaluate(`document.querySelector('a[href="#cars?type=SUV"]').click()`);await new Promise(r=>setTimeout(r,100));
  if(!await evaluate(`document.querySelector('[data-category="SUV"]').getAttribute('aria-pressed')==='true'`))throw new Error('Home SUV shortcut failed.');
  if(await evaluate(`document.querySelector('#results').textContent.includes('BMW 3 Series')`))throw new Error('Home shortcut did not filter sedans.');
  await evaluate("location.hash='faq'");await new Promise(r=>setTimeout(r,100));
  if(await evaluate(`document.querySelectorAll('.support-question').length`)!==12)throw new Error('FAQ list missing.');
  await evaluate(`document.querySelector('[data-faq-category="Visits"]').click()`);
  if(await evaluate(`document.querySelectorAll('.support-question').length`)!==4)throw new Error('FAQ category failed.');
  await evaluate(`document.querySelector('#faq-search').value='test drive';document.querySelector('#faq-search').dispatchEvent(new Event('input',{bubbles:true}))`);
  if(!await evaluate(`document.querySelector('.support-question').textContent.includes('test drive')`))throw new Error('FAQ search failed.');
  await evaluate(`document.querySelector('.support-question summary').click()`);
  if(!await evaluate(`document.querySelector('.support-question').open`))throw new Error('FAQ accordion failed.');
  await evaluate(`document.querySelector('#faq-search').value='no-such-question';document.querySelector('#faq-search').dispatchEvent(new Event('input',{bubbles:true}))`);
  if(!await evaluate(`!!document.querySelector('.faq-empty')`))throw new Error('FAQ empty state failed.');
  await evaluate(`document.querySelector('[data-faq-reset]').click()`);
  if(await evaluate(`document.querySelectorAll('.support-question').length`)!==12)throw new Error('FAQ reset failed.');
  await writeFile('qa/faqs.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await evaluate("location.hash='contact'");await new Promise(r=>setTimeout(r,100));
  if(!await evaluate(`!document.querySelector('#contact-form').checkValidity()`))throw new Error('Contact validation failed.');
  await evaluate(`document.querySelector('#contact-name').value='Test Visitor';document.querySelector('#contact-email').value='test@example.com';document.querySelector('#contact-subject').value='Vehicle Enquiry';document.querySelector('#contact-message').value='I would like to view the Toyota RAV4.';document.querySelector('#contact-form').requestSubmit()`);
  if(!await evaluate(`!document.querySelector('#enquiry-status').hidden && JSON.parse(localStorage.getItem('aa-enquiry')).subject==='Vehicle Enquiry'`))throw new Error('Contact enquiry save failed.');
  await evaluate('window.scrollTo(0,0)');await new Promise(r=>setTimeout(r,300));
  await writeFile('qa/contact.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  for(const width of [250,390]){await cdp('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});for(const route of ['faq','contact']){await evaluate(`location.hash=${JSON.stringify(route)}`);await new Promise(r=>setTimeout(r,100));if(await evaluate(`document.documentElement.scrollWidth>${width}`))throw new Error(`Support page overflow: ${route}, ${width}`)}}
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  const brandPhotos={toyota:'rav4',honda:'crv',nissan:'xtrail',ford:'escape',bmw:'bmw','mercedes-benz':'mercedes',hyundai:'hyundai',kia:'kia',mazda:'mazda'};
  for(const [slug,file]of Object.entries(brandPhotos)){
    await evaluate(`location.hash='brand/${slug}'`);await new Promise(r=>setTimeout(r,150));
    if(!await evaluate(`(()=>{const img=document.querySelector('.brand-banner .car-image');return img&&img.getAttribute('src')==='assets/cars/${file}.jpg'&&img.complete&&img.naturalWidth>=1200})()`))throw new Error('Incorrect or low-resolution brand hero: '+slug);
    if(!await evaluate(`document.querySelectorAll('.car-row').length>0`))throw new Error('Missing brand cars: '+slug);
    if(['toyota','bmw'].includes(slug))await writeFile(`qa/${slug}-hq.png`,Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  }
  for(let id=1;id<=21;id++){
    await evaluate(`location.hash='car/${id}'`);await new Promise(r=>setTimeout(r,150));
    if(await evaluate(`document.querySelectorAll('[data-gallery-index]').length`)<2)throw new Error('Missing multi-photo gallery for car '+id);
    await evaluate(`document.querySelector('[data-gallery-index="1"]').click()`);
    if(!await evaluate(`document.querySelector('[data-gallery-index="1"]').getAttribute('aria-pressed')==='true'`))throw new Error('Thumbnail selection failed '+id);
    if(!await evaluate(`document.querySelector('.gallery-main-image').getAttribute('src').includes('/gallery/')`))throw new Error('Interior selection failed '+id);
  }
  await evaluate(`document.querySelector('[data-gallery-open]').click()`);
  if(!await evaluate(`document.querySelector('#gallery-lightbox').open`))throw new Error('Fullscreen gallery failed.');
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))`);
  if(!await evaluate(`document.querySelector('#lightbox-caption').textContent.includes('1 /')`))throw new Error('Keyboard gallery navigation failed.');
  await evaluate(`document.querySelector('[data-gallery-close]').click()`);
  if(await evaluate(`document.querySelector('#gallery-lightbox').open`))throw new Error('Closing gallery failed.');
  await evaluate(`location.hash='car/7'`);await new Promise(r=>setTimeout(r,150));
  await evaluate(`document.querySelector('[data-gallery-index="1"]').click()`);
  await writeFile('qa/gallery-rear-seats.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await evaluate(`location.hash='car/1'`);await new Promise(r=>setTimeout(r,150));
  await evaluate(`document.querySelector('[data-gallery-index="1"]').click()`);
  await writeFile('qa/gallery-interior.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await evaluate(`location.hash='home'`);await new Promise(r=>setTimeout(r,100));
  await evaluate(`document.querySelector('#finder-make').value='Toyota';document.querySelector('#finder-make').dispatchEvent(new Event('change',{bubbles:true}))`);
  if(await evaluate(`document.querySelector('#finder-model').options.length`)!==8)throw new Error('Make/model dependency failed.');
  await evaluate(`document.querySelector('#finder-model').value='Toyota RAV4';document.querySelector('#finder-model').dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#finder-year').value='2024';document.querySelector('#finder-year').dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#finder-body').value='SUV';document.querySelector('#finder-body').dispatchEvent(new Event('change',{bubbles:true}))`);
  if(!await evaluate(`document.querySelector('#finder-count').textContent==='Search 1 car'`))throw new Error('Combined filter count failed.');
  await evaluate(`document.querySelector('#car-finder-form').requestSubmit()`);await new Promise(r=>setTimeout(r,120));
  if(!await evaluate(`document.querySelectorAll('#results .car-card').length===1 && document.querySelector('#results').textContent.includes('Toyota RAV4')`))throw new Error('Combined filter submission failed.');
  await evaluate(`document.querySelector('#finder-body').value='Sedan';document.querySelector('#finder-body').dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#car-finder-form').requestSubmit()`);await new Promise(r=>setTimeout(r,100));
  if(!await evaluate(`!!document.querySelector('#results .empty-state')`))throw new Error('Filter zero-match state failed.');
  await evaluate(`document.querySelector('[data-finder-reset]').click()`);await new Promise(r=>setTimeout(r,100));
  if(await evaluate(`document.querySelectorAll('#results .car-card').length`)!==21)throw new Error('Filter reset failed.');
  for(const width of [250,390,768,1440]){
    await cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
    await evaluate(`location.hash='cars'`);await new Promise(r=>setTimeout(r,100));
    if(await evaluate(`document.documentElement.scrollWidth>${width}`))throw new Error('Finder overflow at '+width);
    if(width===1440&&!await evaluate(`getComputedStyle(document.querySelector('.finder-fields')).gridTemplateColumns.split(' ').length===4`))throw new Error('Desktop finder must have four columns.');
    if([390,1440].includes(width))await writeFile(`qa/finder-${width}.png`,Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  }
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await evaluate(`location.hash='home'`);await new Promise(r=>setTimeout(r,100));
  if(await evaluate(`document.querySelectorAll('.vehicle-type-card').length`)!==9)throw new Error('Vehicle category cards missing.');
  await evaluate(`document.querySelectorAll('.vehicle-type-card img').forEach(img=>img.loading='eager');document.querySelector('.home-body-types').closest('section').scrollIntoView()`);await new Promise(r=>setTimeout(r,300));
  if(!await evaluate(`Array.from(document.querySelectorAll('.vehicle-type-card img')).every(img=>img.complete&&img.naturalWidth>=1200)`))throw new Error('Vehicle category photo missing.');
  await writeFile('qa/vehicle-categories-mobile.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  for(const type of ['SUV','Sedan','Hatchback','Wagon','Coupe','Convertible','Pickup','Van','MPV']){
    await evaluate(`location.hash='cars?type=${type}'`);await new Promise(r=>setTimeout(r,100));
    if(!await evaluate(`document.querySelector('[data-category="${type}"]').getAttribute('aria-pressed')==='true'`))throw new Error('Vehicle category route failed: '+type);
    if(!['SUV','Sedan'].includes(type)&&!await evaluate(`!!document.querySelector('#results a[href="#contact"]')`))throw new Error('Missing availability enquiry: '+type);
  }
  await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await evaluate(`location.hash='home'`);await new Promise(r=>setTimeout(r,100));await evaluate(`document.querySelector('.home-body-types').closest('section').scrollIntoView()`);await new Promise(r=>setTimeout(r,200));
  await writeFile('qa/vehicle-categories-desktop.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await evaluate(`location.hash='home'`);await new Promise(r=>setTimeout(r,150));
  await evaluate(`document.querySelector('.vehicle-range').scrollIntoView()`);await new Promise(r=>setTimeout(r,100));
  if(await evaluate(`document.querySelectorAll('.range-card').length`)!==21)throw new Error('Vehicle carousel cards missing.');
  await evaluate(`document.querySelector('[data-range-step="1"]').click()`);await new Promise(r=>setTimeout(r,500));
  if(!await evaluate(`document.querySelector('#vehicle-range-track').scrollLeft>100`))throw new Error('Carousel next failed.');
  await evaluate(`document.querySelector('[data-range-tab="new"]').click()`);
  if(!await evaluate(`!!document.querySelector('.range-empty')`))throw new Error('New Cars empty state failed.');
  await evaluate(`document.querySelector('[data-range-tab="used"]').click()`);
  if(await evaluate(`document.querySelectorAll('.range-card').length`)!==21)throw new Error('Used Cars tab failed.');
  if(await evaluate(`document.querySelectorAll('.dealership-statistics strong').length`)!==4)throw new Error('Statistics section missing.');
  await writeFile('qa/vehicle-carousel-mobile.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await new Promise(r=>setTimeout(r,200));
  await evaluate(`document.querySelector('.vehicle-range').scrollIntoView()`);await new Promise(r=>setTimeout(r,150));
  if(await evaluate(`document.documentElement.scrollWidth>1440`))throw new Error('Carousel causes page overflow.');
  await writeFile('qa/vehicle-carousel-desktop.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await evaluate(`location.hash='car/2'`);await new Promise(r=>setTimeout(r,120));
  for(const text of ['Toyota Camry New','20 miles','Car Overview','MCB123818','Description','Schedule-Test-Drive.Pdf','Car-Brochure.Pdf','Interior','Comfort & Convenience','Safety','Exterior','Dimensions & Capacity','Engine and Transmission','6500'])if(!await evaluate(`document.querySelector('.product-page').textContent.includes(${JSON.stringify(text)})`))throw new Error('Product detail missing: '+text);
  const brochure=await evaluate(`downloadProductPdf('brochure',true)`);
  if(brochure.includes('LKR')||!brochure.startsWith('%PDF-1.4')||!brochure.includes('MCB123818')||!brochure.includes('xref'))throw new Error('Brochure PDF generation failed.');
  await writeFile('qa/Car-Brochure.pdf',brochure);
  const planner=await evaluate(`downloadProductPdf('test-drive',true)`);if(!planner.includes('confirmed booking'))throw new Error('Planner PDF generation failed.');await writeFile('qa/Schedule-Test-Drive.pdf',planner);
  await evaluate(`comparedCars=[];document.querySelector('[data-product-compare]').click()`);
  if(!await evaluate(`comparedCars.includes(2)`))throw new Error('Add to compare failed.');
  await evaluate(`location.hash='car/5'`);await new Promise(r=>setTimeout(r,100));await evaluate(`document.querySelector('[data-product-compare]').click()`);
  await evaluate(`location.hash='compare'`);await new Promise(r=>setTimeout(r,100));
  if(await evaluate(`document.querySelectorAll('.compare-grid article').length`)!==2)throw new Error('Compare page failed.');
  await evaluate(`document.querySelector('[data-remove-compare]').click()`);if(await evaluate(`document.querySelectorAll('.compare-grid article').length`)!==1)throw new Error('Remove comparison failed.');
  await evaluate(`location.hash='car/2'`);await new Promise(r=>setTimeout(r,100));
  await writeFile('qa/product-detail-mobile.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  for(const width of [250,390,768,1440]){await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<768});await evaluate(`location.hash='car/2'`);await new Promise(r=>setTimeout(r,100));if(await evaluate(`document.documentElement.scrollWidth>${width}`))throw new Error('Product page overflow: '+width);if(width===1440)await writeFile('qa/product-detail-desktop.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));}
  for(const route of ['home','cars','car/2','compare','brands','appointment','faq','contact','trade-in','more']){
    await evaluate(`location.hash=${JSON.stringify(route)}`);await new Promise(r=>setTimeout(r,100));
    if(await evaluate(`/LKR|Asking price|Budget LKR/.test(document.body.innerText)`))throw new Error('Vehicle price remains on '+route);
    if(!await evaluate(`document.querySelectorAll('#site-footer').length===1 && !!document.querySelector('#site-footer a[href="#contact"]')`))throw new Error('Shared footer missing on '+route);
  }
  await evaluate(`location.hash='home'`);await new Promise(r=>setTimeout(r,100));
  await evaluate(`document.querySelector('#site-footer').scrollIntoView({block:'end'})`);await new Promise(r=>setTimeout(r,100));
  await writeFile('qa/footer-desktop.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:1000,deviceScaleFactor:1,mobile:true});
  await evaluate(`document.querySelector('#site-footer').scrollIntoView({block:'end'})`);await new Promise(r=>setTimeout(r,150));
  if(await evaluate(`document.documentElement.scrollWidth>390`))throw new Error('Footer overflows mobile width.');
  await writeFile('qa/footer-mobile.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  if(errors.length)throw new Error(errors.join('; '));
  console.log('Passed: 11 reference views, no horizontal overflow or missing logos, specifications tab, search and favourites. Screenshots saved to qa/.');
} finally {
  if(socket?.readyState===1){socket.send(JSON.stringify({id:99999,method:'Browser.close'}));socket.close()}
  chrome.kill();
}
