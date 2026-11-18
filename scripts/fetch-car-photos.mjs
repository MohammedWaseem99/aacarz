import {mkdir,writeFile,readFile} from 'node:fs/promises';
const models=[['rav4','Toyota_RAV4'],['camry','Toyota_Camry'],['corolla','Toyota_Corolla'],['crv','Honda_CR-V'],['bmw','BMW_3_Series_(G20)'],['escape','Ford_Escape'],['xtrail','Nissan_X-Trail'],['mercedes','Mercedes-Benz_C-Class_(W206)'],['hyundai','Hyundai_Tucson'],['kia','Kia_Sportage'],['mazda','Mazda_CX-5'],['hatchback','Toyota_Yaris_(XP210)'],['wagon','Volvo_V60'],['coupe','Ford_Mustang_(sixth_generation)'],['convertible','Mazda_MX-5_(ND)'],['pickup','Toyota_Hilux'],['van','Toyota_HiAce'],['mpv','Toyota_Alphard'],['civic','Honda_Civic_(eleventh_generation)'],['leaf','Nissan_Leaf'],['gla','Mercedes-Benz_GLA-Class']];
await mkdir('dist/assets/cars',{recursive:true});
const headers={'User-Agent':'AA-Carz-Demo/1.0 (vehicle image attribution; local website development)'};
async function json(url){for(let attempt=0;attempt<6;attempt++){const r=await fetch(url,{headers,signal:AbortSignal.timeout(30000)});if(r.status===429){await new Promise(resolve=>setTimeout(resolve,Math.min(5000*(attempt+1),25000)));continue}if(!r.ok)throw new Error(`HTTP ${r.status}: ${url}`);return r.json()}throw new Error('Rate limited: '+url)}
let credits=[];try{credits=JSON.parse(await readFile('dist/assets/cars/credits.json','utf8'))}catch{}
for(const[key,title]of models){
  if(credits.some(c=>c.key===key))continue;
  await new Promise(resolve=>setTimeout(resolve,1800));
  const query=new URLSearchParams({action:'query',format:'json',prop:'pageimages',titles:title,piprop:'thumbnail|original|name',pithumbsize:'1600',redirects:'1'});
  const data=await json('https://en.wikipedia.org/w/api.php?'+query);
  const page=Object.values(data.query.pages)[0];
  if(!page.thumbnail)throw new Error('No lead vehicle photo: '+title);
  const response=await fetch(page.thumbnail.source,{headers,signal:AbortSignal.timeout(45000)});
  if(!response.ok)throw new Error('Photo download failed: '+title+' '+response.status);
  if(!response.headers.get('content-type')?.startsWith('image/'))throw new Error('Not an image: '+title);
  const bytes=Buffer.from(await response.arrayBuffer());
  await writeFile(`dist/assets/cars/${key}.jpg`,bytes);
  const infoQuery=new URLSearchParams({action:'query',format:'json',prop:'imageinfo',titles:'File:'+page.pageimage,iiprop:'url|extmetadata'});
  const info=await json('https://commons.wikimedia.org/w/api.php?'+infoQuery);
  const metadata=Object.values(info.query.pages)[0].imageinfo?.[0];
  credits.push({key,model:page.title,file:page.pageimage,local:`${key}.jpg`,width:page.thumbnail.width,height:page.thumbnail.height,source:metadata?.descriptionurl||'https://commons.wikimedia.org/wiki/File:'+encodeURIComponent(page.pageimage),original:page.original?.source,artist:metadata?.extmetadata?.Artist?.value,license:metadata?.extmetadata?.LicenseShortName?.value,licenseUrl:metadata?.extmetadata?.LicenseUrl?.value});
  await writeFile('dist/assets/cars/credits.json',JSON.stringify(credits,null,2));
  console.log(`${key}: ${page.thumbnail.width}x${page.thumbnail.height}`);
}
await writeFile('dist/assets/cars/ATTRIBUTION.md','# Vehicle photography\n\nOriginal vehicle photographs from Wikimedia Commons, resized by Wikimedia for web delivery. Images illustrate models and do not depict actual dealership inventory.\n\n'+credits.map(c=>`- **${c.model}**: [${c.file}](${c.source}). Artist: ${c.artist||'See source'}. License: [${c.license||'See source'}](${c.licenseUrl||c.source}).`).join('\n'));
