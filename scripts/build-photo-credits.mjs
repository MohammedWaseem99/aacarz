import {readFile,writeFile} from 'node:fs/promises';
const credits=JSON.parse(await readFile('dist/assets/cars/credits.json','utf8'));
try {
  const galleries=JSON.parse(await readFile('dist/assets/cars/gallery/manifest.json','utf8'));
  for(const [key,photos] of Object.entries(galleries)) {
    const model=credits.find(c=>c.key===key)?.model||key;
    for(const photo of photos)credits.push({...photo,model:model+' — '+photo.label,file:photo.title,local:'gallery/'+photo.src.split('/').pop()});
  }
} catch(error) { if(error.code!=='ENOENT')throw error; }
const esc=value=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
await writeFile('dist/photo-credits.html',`<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vehicle Photo Credits — A&A CARZ</title><style>body{font:14px/1.6 Arial,sans-serif;max-width:760px;margin:35px auto;padding:0 20px;color:#15212a;background:#f8f9fa}a{color:#d30c07}article{padding:18px 0;border-bottom:1px solid #dce2e6}h1{font-size:27px}h2{font-size:19px}img{width:220px;max-width:100%;border-radius:6px}p{overflow-wrap:anywhere}</style></head><body><a href="index.html">← Back to A&A CARZ</a><h1>Vehicle Photo Credits</h1><p>Original photographs from Wikimedia Commons. Photos illustrate the vehicle models and do not represent actual showroom inventory. Wikimedia supplies the resized image files; the site displays them with responsive framing.</p>${credits.map(c=>`<article><img src="assets/cars/${esc(c.local)}" alt="${esc(c.model)}" loading="lazy"><h2>${esc(c.model)}</h2><p>Photographer: ${esc(c.artist?.replace(/<[^>]*>/g,'')||'See source')}<br>License: <a href="${esc(c.licenseUrl)}">${esc(c.license)}</a><br>Source: <a href="${esc(c.source)}">${esc(c.file)}</a></p></article>`).join('')}</body></html>`);
console.log('Built attribution page for '+credits.length+' vehicle photographs.');
