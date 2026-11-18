import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const port = 9271;
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${port}`, `--user-data-dir=${resolve('.desktop-qa')}`, 'about:blank'
], { windowsHide: true, stdio: 'ignore' });
let socket;
try {
  let pages;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { pages = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; }
    catch { await new Promise(resolveWait => setTimeout(resolveWait, 250)); }
  }
  if (!pages) throw new Error('Chrome preview was unavailable.');
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolveOpen, rejectOpen) => { socket.onopen = resolveOpen; socket.onerror = rejectOpen; });
  let id = 0; const pending = new Map(); const errors = [];
  socket.onmessage = event => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const request = pending.get(data.id); pending.delete(data.id);
      data.error ? request.reject(new Error(data.error.message)) : request.resolve(data.result);
    }
    if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.text);
  };
  const cdp = (method, params = {}) => new Promise((resolveRequest, rejectRequest) => {
    const requestId = ++id; pending.set(requestId, { resolve: resolveRequest, reject: rejectRequest });
    socket.send(JSON.stringify({ id: requestId, method, params }));
  });
  const evaluate = async expression => (await cdp('Runtime.evaluate', { expression, returnByValue: true })).result.value;
  await cdp('Page.enable'); await cdp('Runtime.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.navigate', { url: pathToFileURL(resolve('dist/index.html')).href });
  await new Promise(resolveWait => setTimeout(resolveWait, 500));
  await mkdir('qa/desktop', { recursive: true });
  const routes = [
    ['home', 'home'], ['cars', 'vehicles'], ['brands', 'brands'], ['brand/toyota', 'toyota'],
    ['car/1', 'vehicle-detail'], ['appointment/1', 'appointment'], ['process', 'process'],
    ['more', 'more'], ['faq', 'faq'], ['contact', 'contact'], ['trade-in', 'trade-in']
  ];
  for (const [route, name] of routes) {
    await evaluate(`location.hash=${JSON.stringify(route)}`);
    // Let entrance motion finish before taking a visual regression capture.
    await new Promise(resolveWait => setTimeout(resolveWait, 1150));
    if (await evaluate('document.documentElement.scrollWidth > 1440')) throw new Error(`Desktop horizontal overflow: ${route}`);
    if (!await evaluate(`getComputedStyle(document.querySelector('.desktop-navigation')).display === 'flex'`)) throw new Error(`Desktop navigation missing: ${route}`);
    if (await evaluate(`getComputedStyle(document.querySelector('#bottom-nav')).display !== 'none'`)) throw new Error(`Mobile navigation visible: ${route}`);
    if (!await evaluate(`document.querySelector('#site-shell').getBoundingClientRect().width >= 1100`)) throw new Error(`Desktop canvas too narrow: ${route}`);
    const screenshot = await cdp('Page.captureScreenshot', { format: 'png' });
    await writeFile(`qa/desktop/${name}.png`, Buffer.from(screenshot.data, 'base64'));
  }
  if (errors.length) throw new Error(`Page runtime errors: ${errors.join('; ')}`);
  console.log('Desktop layout QA passed for 11 routes at 1440px.');
} finally {
  socket?.close(); chrome.kill();
}
