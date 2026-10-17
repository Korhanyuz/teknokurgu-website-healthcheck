const { test, expect } = require('@playwright/test');
const fs = require('fs');

const BASE = 'https://www.teknokurgu.com.tr/';
const MAX_PAGES = 250;
const PAGE_TIMEOUT = 20000;
const DOWNLOAD_RE = /\.(pdf|zip|jpe?g|png|webp|svg|gif|mp4|docx?|xlsx?)(?:$|[?#])/i;
const failures = [];
const warnings = [];
const checked = new Set();
const linkSources = new Map();
const queued = new Set([BASE]);

function normalized(value) {
  const u = new URL(value);
  u.hash = '';
  return u.href;
}
function internal(value) {
  try {
    const u = new URL(value);
    return ['teknokurgu.com.tr', 'www.teknokurgu.com.tr'].includes(u.hostname)
      && ['http:', 'https:'].includes(u.protocol);
  } catch { return false; }
}
function recordSource(target, source, text) {
  if (!linkSources.has(target)) linkSources.set(target, []);
  const entries = linkSources.get(target);
  if (!entries.some(x => x.page === source && x.linkText === text)) {
    entries.push({ page: source, linkText: text });
  }
}
function isDownload(url) {
  const u = new URL(url);
  return DOWNLOAD_RE.test(u.pathname) || u.searchParams.has('download');
}
function saveReport(queue) {
  fs.mkdirSync('test-results', { recursive: true });
  const sources = Object.fromEntries(linkSources);
  const report = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    checkedCount: checked.size,
    checked: [...checked],
    failures,
    warnings,
    pendingCount: queue.length,
    linkSources: sources,
    failureDetails: failures.map(f => ({
      ...f,
      sources: sources[f.url] || [],
    })),
  };
  fs.writeFileSync('test-results/health-summary.json', JSON.stringify(report, null, 2));
  fs.writeFileSync('test-results/link-sources.json', JSON.stringify(sources, null, 2));
  fs.writeFileSync('test-results/failures-with-sources.json', JSON.stringify(report.failureDetails, null, 2));
}

test('daily website crawl and browser checks', async ({ page }) => {
  const queue = [BASE];
  const jsErrors = new Set();
  let currentPage = BASE;
  page.on('pageerror', error => {
    const key = `${currentPage}: ${error.message}`;
    if (!jsErrors.has(key)) {
      jsErrors.add(key);
      warnings.push({ type: 'javascript', url: currentPage, message: error.message });
    }
  });

  try {
    while (queue.length && checked.size < MAX_PAGES) {
      const url = queue.shift();
      queued.delete(url);
      if (checked.has(url)) continue;
      checked.add(url);
      currentPage = url;
      try {
        // Download endpoints must not be navigated to as HTML pages.
        if (isDownload(url)) {
          warnings.push({ type: 'download-not-verified', url, message: 'Download link skipped by HTML crawler' });
          continue;
        }
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT });
        const status = response?.status();
        if (!response || status >= 400) {
          failures.push({ type: 'http', url, status: status ?? null, message: `HTTP ${status ?? 'no response'}` });
          continue;
        }
        const contentType = response.headers()['content-type'] || '';
        if (!contentType.includes('text/html')) {
          warnings.push({ type: 'non-html', url, message: `Content-Type: ${contentType}` });
          continue;
        }
        const title = await page.title();
        if (!title.trim()) warnings.push({ type: 'empty-title', url, message: 'Empty page title' });

        const links = await page.locator('a[href]').evaluateAll(nodes => nodes.map(n => ({
          href: n.href,
          text: (n.innerText || n.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120),
        })));
        for (const link of links) {
          if (!internal(link.href)) continue;
          const target = normalized(link.href);
          recordSource(target, url, link.text);
          if (!checked.has(target) && !queued.has(target)) {
            queue.push(target);
            queued.add(target);
          }
        }

        // Lazy-loaded images may not have loaded until scrolled into view.
        const brokenImages = await page.locator('img').evaluateAll(nodes => nodes
          .filter(n => n.complete && n.naturalWidth === 0 && (n.currentSrc || n.src))
          .map(n => n.currentSrc || n.src));
        for (const src of [...new Set(brokenImages)]) {
          warnings.push({ type: 'image', url, message: `Image failed: ${src}` });
        }
      } catch (error) {
        const message = String(error.message || error).split('\n')[0];
        failures.push({ type: 'navigation', url, message });
      }
    }
    if (queue.length) warnings.push({ type: 'crawl-limit', url: BASE, message: `${queue.length} URLs remain unvisited` });
  } finally {
    // Reports must survive even when an assertion fails.
    saveReport(queue);
  }

  console.log(`Checked ${checked.size} URLs; failures ${failures.length}; warnings ${warnings.length}`);
  for (const item of failures) {
    console.error('FAIL', item.url, item.message, 'SOURCES:', JSON.stringify(linkSources.get(item.url) || []));
  }
  for (const item of warnings) console.warn('WARN', item.url, item.message);
  expect(failures, JSON.stringify(failures, null, 2)).toEqual([]);
});
