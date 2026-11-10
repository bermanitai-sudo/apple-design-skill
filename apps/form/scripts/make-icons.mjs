// Renders the app icon and iPhone splash screens with the preinstalled Chromium.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { mkdirSync } from 'node:fs';

const mark = (size, pad) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#080808"/>
  <g transform="translate(${pad} ${pad}) scale(${(100 - pad * 2) / 100})">
    <path d="M27 76 V24 H72" fill="none" stroke="#FFFFFF" stroke-width="11" stroke-linecap="square"/>
    <path d="M27 50 H58" fill="none" stroke="#FFFFFF" stroke-width="11" stroke-linecap="square"/>
    <circle cx="72" cy="72" r="7.5" fill="#B7FF35"/>
  </g>
</svg>`;

const splash = (w, h) => `
<html><body style="margin:0;width:${w}px;height:${h}px;background:#080808;display:grid;place-items:center">
  <div style="font:900 ${Math.round(w * 0.16)}px -apple-system,'Inter',system-ui,sans-serif;letter-spacing:-0.06em;color:#fff">FORM<span style="color:#B7FF35">.</span></div>
</body></html>`;

mkdirSync('public/icons', { recursive: true });
mkdirSync('public/splash', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();

for (const [file, size, pad] of [
  ['icon-192.png', 192, 8],
  ['icon-512.png', 512, 8],
  ['apple-touch-icon.png', 180, 8],
  ['maskable-512.png', 512, 20],
]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<body style="margin:0">${mark(size, pad)}</body>`);
  await page.screenshot({ path: `public/icons/${file}`, omitBackground: false });
}

for (const [w, h] of [
  [1320, 2868],
  [1290, 2796],
  [1206, 2622],
  [1179, 2556],
  [1170, 2532],
  [1284, 2778],
  [1125, 2436],
  [750, 1334],
]) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(splash(w, h));
  await page.screenshot({ path: `public/splash/${w}x${h}.png` });
}
await browser.close();
console.log('icons and splash screens written');
