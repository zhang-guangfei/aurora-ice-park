'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const { chromium } = require('playwright-core');
const { PNG } = require('pngjs');

const site = new URL('https://zhang-guangfei.github.io/aurora-ice-park/');
const release = process.env.RELEASE_REF || 'origin/gh-pages';

function releasedFile(path) {
  return execFileSync('git', ['show', release + ':' + path], { maxBuffer: 4 * 1024 * 1024 });
}

async function verifyFiles() {
  const index = releasedFile('index.html');
  const paths = [...index.toString('utf8').matchAll(/\b(?:src|href)="([^"]+)"/g)].map(match => match[1]);
  const files = [['', index], ...paths.map(path => [path, releasedFile(path)])];
  // Pages edges can briefly serve the previous release after a successful deployment.
  for (let attempt = 1; ; attempt++) {
    try {
      await Promise.all(files.map(async ([path, expected]) => {
        const response = await fetch(new URL(path, site), { signal: AbortSignal.timeout(20000) });
        assert.equal(response.status, 200, path || 'index.html');
        const actual = Buffer.from(await response.arrayBuffer());
        assert.ok(expected.equals(actual), 'Published bytes differ in ' + (path || 'index.html'));
      }));
      console.log('Verified the live entry page and ' + paths.length + ' assets against ' + release);
      return;
    } catch (error) {
      if (attempt === 6) throw error;
      await delay(5000);
    }
  }
}

async function verifyPark() {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
    page.setDefaultTimeout(90000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error' && /WebGLProgram|shader error|context lost/i.test(message.text())) {
        errors.push(message.text());
      }
    });
    // The cloud runner renders WebGL in software. Use the in-game low preset.
    await page.addInitScript(() => {
      localStorage.setItem('frostbound.park.v1', JSON.stringify({ quality: 'low' }));
    });
    await page.goto(site.href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true);
    assert.equal(await page.title(), '梦幻冰雪大世界');
    assert.equal(await page.locator('#regionLabel').textContent(), '中心广场');
    const image = PNG.sync.read(await page.screenshot({ clip: { x: 280, y: 165, width: 330, height: 230 } }));
    const colors = new Set();
    let lit = 0;
    for (let i = 0; i < image.data.length; i += 4) {
      const r = image.data[i], g = image.data[i + 1], b = image.data[i + 2];
      if (Math.max(r, g, b) > 22) lit++;
      colors.add(((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4));
    }
    assert.ok(colors.size >= 16 && lit > image.width * image.height * 0.25, 'The scene has no visible detail');
    console.log('The live WebGL scene rendered at Central Plaza (' + colors.size + ' color bins)');

    await page.locator('#mapBtn').click();
    const stops = await page.locator('[data-place] span').allTextContents();
    for (const label of ['中心广场', '冰雪城堡', '雪花摩天轮', '超级冰滑梯', '冰雕艺廊', '冰雪商业街', '冰上游乐场', '雪仗靶场']) {
      assert.ok(stops.includes(label), 'Missing map destination: ' + label);
    }
    await page.locator('[data-place]').filter({ hasText: '雪花摩天轮' }).click();
    await page.locator('#travelBtn').click();
    await page.locator('#interactBtn').click();
    await page.waitForFunction(() => document.querySelector('#modeLabel').textContent === '摩天轮观景');
    await page.keyboard.press('e');
    await page.waitForFunction(() => document.querySelector('#modeLabel').textContent === '自由探索');
    assert.deepEqual(errors, []);
    console.log('The park map opened. Fast travel, boarding and exiting the Ferris wheel passed.');
  } finally {
    await browser.close();
  }
}

(async () => {
  await verifyFiles();
  await verifyPark();
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
