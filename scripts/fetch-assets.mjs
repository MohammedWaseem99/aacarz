import { mkdir, writeFile } from 'node:fs/promises';

const brands = ['toyota', 'honda', 'nissan', 'ford', 'bmw', 'mercedes-benz', 'hyundai', 'kia', 'mazda'];
const icons = ['house', 'car-front', 'circle-gauge', 'calendar-days', 'menu', 'heart', 'search', 'arrow-up-right', 'arrow-right', 'arrow-left', 'circle-check', 'shield-check', 'headset', 'badge-check', 'settings-2', 'fuel', 'x', 'chevron-right'];
await mkdir('dist/assets/brands', { recursive: true });
await mkdir('dist/assets/icons', { recursive: true });

async function download(url, target, expected) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`${target}: HTTP ${response.status}`);
  const data = Buffer.from(await response.arrayBuffer());
  if (expected === 'svg' && !data.toString().includes('<svg')) throw new Error(`Invalid SVG: ${target}`);
  if (expected === 'png' && data.subarray(1, 4).toString() !== 'PNG') throw new Error(`Invalid PNG: ${target}`);
  await writeFile(target, data);
  return data.toString();
}

const outcomes = await Promise.allSettled([
  ...brands.map(name => download(`https://raw.githubusercontent.com/filippofilip95/car-logos-dataset/master/logos/optimized/${name}.png`, `dist/assets/brands/${name}.png`, 'png')),
  ...icons.map(name => download(`https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/${name}.svg`, `dist/assets/icons/${name}.svg`, 'svg')),
  download('https://raw.githubusercontent.com/lucide-icons/lucide/main/LICENSE', 'dist/assets/icons/LICENSE.txt'),
]);
const errors = outcomes.filter(result => result.status === 'rejected');
if (errors.length) {
  for (const error of errors) console.error(error.reason.message);
  process.exitCode = 1;
} else {
  console.log(`Downloaded ${brands.length} brand logos and ${icons.length} Lucide icons with license.`);
}
