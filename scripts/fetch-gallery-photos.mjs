import {mkdir,readFile,writeFile} from 'node:fs/promises';
const models=[['rav4','Toyota RAV4'],['camry','Toyota Camry'],['corolla','Toyota Corolla'],['crv','Honda CR-V'],['bmw','BMW G20'],['escape','Ford Escape'],['xtrail','Nissan X-Trail'],['mercedes','Mercedes-Benz W206'],['hyundai','Hyundai Tucson'],['kia','Kia Sportage'],['mazda','Mazda CX-5']];
await mkdir('dist/assets/cars/gallery',{recursive:true});
const headers={'User-Agent':'AA-Carz-Demo/1.0 (vehicle photo attribution)'};
async function json(url){for(let i=0;i<5;i++){const r=await fetch(url,{headers,signal:AbortSignal.timeout(30000)});if(r.status===429){await new Promise(r=>setTimeout(r,5000*(i+1)));continue}if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}throw new Error('Rate limited')}
let galleries={};try{galleries=JSON.parse(await readFile('dist/assets/cars/gallery/manifest.json','utf8'))}catch{}
for(const[key,model]of models){
 if(galleries[key])continue;
 await new Promise(r=>setTimeout(r,1400));
 const params=new URLSearchParams({action:'query',format:'json',generator:'search',gsrsearch:'"'+model+'" (interior OR dashboard OR steering OR seats)',gsrnamespace:'6',gsrlimit:'30',prop:'imageinfo',iiprop:'url|extmetadata|size',iiurlwidth:'1400'});
 const data=await json('https://commons.wikimedia.org/w/api.php?'+params);
 const pages=Object.values(data.query?.pages||{}).filter(p=>p.imageinfo?.[0]?.mime!=='image/svg+xml'&&/\.(jpg|jpeg|png)$/i.test(p.title)).map(p=>({title:p.title,info:p.imageinfo[0],description:p.imageinfo[0].extmetadata?.ImageDescription?.value||''}));
 const chosen=[];
 for(const[type,pattern]of [['Rear seats',/rear.?seat|back.?seat|second.?row|rear.?interior/i],['Steering wheel',/steering|cockpit/i],['Dashboard',/dashboard|dash\b|instrument|cockpit/i],['Interior',/interior|inside|cockpit/i]]){
  const candidate=pages.filter(p=>!chosen.some(c=>c.title===p.title)&&p.info.width>=900).sort((a,b)=>(pattern.test(b.title)?10:pattern.test(b.description)?2:0)-(pattern.test(a.title)?10:pattern.test(a.description)?2:0)).find(p=>pattern.test(p.title)||pattern.test(p.description));
  if(!candidate)continue;
  const url=candidate.info.thumburl||candidate.info.url;
  const response=await fetch(url,{headers,signal:AbortSignal.timeout(45000)});
  if(!response.ok||!response.headers.get('content-type')?.startsWith('image/'))continue;
  const local=key+'-'+type.toLowerCase().replaceAll(' ','-')+'.jpg';
  await writeFile('dist/assets/cars/gallery/'+local,Buffer.from(await response.arrayBuffer()));
  const meta=candidate.info.extmetadata;
  chosen.push({label:type,src:'assets/cars/gallery/'+local,title:candidate.title,source:candidate.info.descriptionurl,artist:meta?.Artist?.value,license:meta?.LicenseShortName?.value,licenseUrl:meta?.LicenseUrl?.value});
 }
 galleries[key]=chosen;
 await writeFile('dist/assets/cars/gallery/manifest.json',JSON.stringify(galleries,null,2));
 console.log(model+': '+chosen.map(c=>c.label).join(', '));
}
await writeFile('dist/gallery-data.js','// Model reference photos, not photographs of actual inventory.\nconst galleryPhotos='+JSON.stringify(galleries,null,2)+';\n');
