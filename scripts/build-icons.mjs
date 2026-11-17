import { readFile, readdir, writeFile } from 'node:fs/promises';

const assets = {};
for (const file of (await readdir('dist/assets/icons')).filter(name => name.endsWith('.svg'))) {
  const source = await readFile(`dist/assets/icons/${file}`, 'utf8');
  assets[file.slice(0,-4)] = source.slice(source.indexOf('<svg')).replace(/<svg\b/, '<svg class="icon" aria-hidden="true" focusable="false"');
}
await writeFile('dist/icons.js', `// Local Lucide SVG assets. See assets/icons/LICENSE.txt.\nconst iconAssets=${JSON.stringify(assets,null,2)};\nfunction icon(name,filled=false){const svg=iconAssets[name];if(!svg)throw new Error('Unknown icon: '+name);return filled?svg.replace('fill="none"','fill="currentColor"'):svg;}\ndocument.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.icon)});\n`);
console.log(`Bundled ${Object.keys(assets).length} accessible SVG icons.`);
