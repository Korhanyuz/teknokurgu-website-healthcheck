const { test, expect } = require('@playwright/test');
const fs = require('fs');
const BASE = 'https://www.teknokurgu.com.tr/';
const MAX = 250;
const failures = [];
const warnings = [];
const checked = new Set();
function normalized(url) { const u = new URL(url); u.hash = ''; return u.href; }
function internal(url) { const u = new URL(url); return ['teknokurgu.com.tr','www.teknokurgu.com.tr'].includes(u.hostname) && /^https?:$/.test(u.protocol); }
test('daily website crawl and browser checks', async ({ page, request }) => {
  const queue = [BASE];
  page.on('pageerror', err => warnings.push(`JavaScript: ${page.url()} ${err.message}`));
  while (queue.length && checked.size < MAX) {
    const url = queue.shift();
    if (checked.has(url)) continue;
    checked.add(url);
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(400);
      if (!response || response.status() >= 400) { failures.push(`${url}: HTTP ${response?.status() ?? 'no response'}`); continue; }
      const title = await page.title();
      if (!title.trim()) warnings.push(`${url}: empty title`);
      const links = await page.locator('a[href]').evaluateAll(nodes => nodes.map(n => n.href));
      for (const link of links) {
        try {
          if (!internal(link)) continue;
          const next = normalized(link);
          if (!checked.has(next) && !queue.includes(next) && !/\.(pdf|zip|jpg|jpeg|png|webp|svg|mp4|docx?|xlsx?)(\?|$)/i.test(next)) queue.push(next);
        } catch {}
      }
      const brokenImages = await page.locator('img').evaluateAll(nodes => nodes.filter(n => !n.complete || n.naturalWidth === 0).map(n => n.currentSrc || n.src));
      for (const img of brokenImages) warnings.push(`${url}: image not loaded ${img}`);
    } catch (e) { failures.push(`${url}: ${e.message.split('\n')[0]}`); }
  }
  if (queue.length) warnings.push(`Crawl limit ${MAX} reached; ${queue.length} URLs remain`);
  fs.mkdirSync('test-results', { recursive: true });
  fs.writeFileSync('test-results/health-summary.json', JSON.stringify({ checked: [...checked], failures, warnings }, null, 2));
  console.log(`Checked ${checked.size} pages; failures ${failures.length}; warnings ${warnings.length}`);
  failures.forEach(x => console.error('FAIL', x));
  warnings.forEach(x => console.warn('WARN', x));
  expect(failures, failures.join('\n')).toEqual([]);
});
