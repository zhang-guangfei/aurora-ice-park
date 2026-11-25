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
    assert.equal(await page.locator('#viewBtn span').textContent(), '窗边广角');
    await page.locator('#viewBtn').click();
    assert.equal(await page.locator('#viewBtn span').textContent(), '舱外全景');
    await page.mouse.move(430, 250);
    await page.mouse.down();
    await page.mouse.move(495, 260, { steps: 3 });
    await page.mouse.up();
    await page.locator('#photoBtn').click();
    await page.locator('#exitPhoto').waitFor({ state: 'visible' });
    await page.locator('#exitPhoto').click();
    assert.ok(await page.locator('#game.wheel-ride').count());
    assert.equal(await page.locator('#modeLabel').textContent(), '摩天轮观景');
    await page.keyboard.press('v');
    assert.equal(await page.locator('#viewBtn span').textContent(), '窗边广角');
    await page.keyboard.press('e');
    await page.waitForFunction(() => document.querySelector('#modeLabel').textContent === '自由探索');
    assert.equal(await page.locator('#game.wheel-ride').count(), 0);
    console.log('Live wheel: boarded, looked around, switched both viewpoints, took camera control and returned to the platform.');

    await page.locator('#mapBtn').click();
    await page.locator('[data-place]').filter({ hasText: '超级冰滑梯' }).click();
    await page.locator('#travelBtn').click();
    assert.equal(await page.locator('#actionName').textContent(), '登上滑梯高台');
    await page.locator('#interactBtn').click();
    assert.equal(await page.locator('#actionName').textContent(), '开始冰道滑行');
    await page.keyboard.press('e');
    await page.waitForFunction(() => document.querySelector('#modeLabel').textContent === '冰道滑行');
    await page.keyboard.press('e');
    await page.waitForFunction(() => document.querySelector('#modeLabel').textContent === '自由探索');
    console.log('Live slide: reached the platform and rode the new chute.');

    await page.locator('#mapBtn').click();
    await page.locator('[data-place]').filter({ hasText: '中心广场' }).click();
    await page.locator('#travelBtn').click();
    await page.locator('#settingsBtn').click();
    await page.locator('[data-option="quality"][data-value="medium"]').click();
    await page.locator('#closeDlg').click();
    const sign = page.locator('#way small');
    await page.waitForFunction(() => !document.querySelector('#way').hidden && /\d/.test(document.querySelector('#way small').textContent));
    const startDistance = parseInt(await sign.textContent(), 10);
    await page.keyboard.down('w');
    try {
      await page.waitForFunction(start => parseInt(document.querySelector('#way small').textContent, 10) <= start - 2, startDistance);
    } finally {
      await page.keyboard.up('w');
    }
    await page.locator('#mapBtn').click();
    await page.locator('[data-place]').filter({ hasText: '中心广场' }).click();
    await page.locator('#travelBtn').click();
    assert.equal(await page.locator('#skatesBtn span').textContent(), '领冰鞋');
    await page.keyboard.press('r');
    assert.equal(await page.locator('[data-place].active span').textContent(), '冰上游乐场');
    assert.equal(await page.locator('#skatesBtn').getAttribute('aria-pressed'), 'false');
    await page.locator('#travelBtn').click();
    assert.equal(await page.locator('#actionName').textContent(), '领取冰鞋');
    assert.equal(await page.evaluate(() => !!JSON.parse(localStorage.getItem('frostbound.park.v1')).ownsSkates), false);
    await page.keyboard.press('e');
    assert.equal(await page.locator('#skatesBtn').getAttribute('aria-pressed'), 'true');
    assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem('frostbound.park.v1')).ownsSkates));
    await page.locator('#skatesBtn').click();
    await page.locator('#mapBtn').click();
    await page.locator('[data-place]').filter({ hasText: '中心广场' }).click();
    await page.locator('#travelBtn').click();
    await page.keyboard.press('r');
    await page.waitForFunction(() => document.querySelector('#skatesBtn').getAttribute('aria-pressed') === 'true'
      && document.querySelector('#modeLabel').textContent === '冰上漫游');
    for (const [key, label] of [['d', '穿冰鞋步行'], ['a', '冰上漫游']]) {
      await page.keyboard.down(key);
      try {
        await page.waitForFunction(expected => document.querySelector('#modeLabel').textContent === expected, label);
      } finally {
        await page.keyboard.up(key);
      }
    }
    await page.locator('#skatesBtn').click();
    assert.equal(await page.locator('#skatesBtn').getAttribute('aria-pressed'), 'false');
    console.log('Live skates: no remote grant, claimed at the west gate, equipped at the plaza, walked on snow and glided on ice.');
    assert.deepEqual(errors, []);
    console.log('Walked along the ice avenue in medium quality with planar reflections enabled.');

    await page.close();
    const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    phone.setDefaultTimeout(90000);
    phone.on('pageerror',error=>errors.push(error.message));
    phone.on('console',m=>{if(m.type()==='error' && /WebGLProgram|shader error|context lost/i.test(m.text())) errors.push(m.text());});
    // Enter as a new touch visitor to exercise the actual default mobile quality setting.
    await phone.goto(site.href, { waitUntil: 'domcontentloaded' });
    await phone.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 90000 });
    assert.equal(await phone.evaluate(()=>JSON.parse(localStorage.getItem('frostbound.park.v1')).quality),'medium');
    const skyLight = async () => {
      const png=PNG.sync.read(await phone.screenshot({clip:{x:158,y:175,width:70,height:45}, style:'#hud, #touch, #toast, #banner { visibility: hidden !important; }'}));
      let total=0;
      for(let i=0;i<png.data.length;i+=4) total+=png.data[i]*.21+png.data[i+1]*.72+png.data[i+2]*.07;
      return total/(png.width*png.height);
    };
    const night=await skyLight();
    await phone.locator('#timeBtn').tap();
    assert.equal(await phone.locator('#timeLabel').textContent(),'黄昏');
    await phone.locator('#timeBtn').tap();
    assert.equal(await phone.locator('#timeLabel').textContent(),'白天');
    // Allow the sky interpolation to settle even on a software GPU.
    let day=0;
    for(let i=0;i<6;i++){day=await skyLight();if(day>night+12)break;await delay(500);}
    assert.ok(day>night+12,'The live portrait sky should brighten from night to day: '+night+' -> '+day);
    await phone.locator('#timeBtn').tap();
    assert.equal(await phone.locator('#timeLabel').textContent(),'夜晚');
    console.log('Live portrait lighting: default medium preset, night/dusk/day controls and measured sky brightness '+night.toFixed(1)+' -> '+day.toFixed(1));
    await phone.locator('#settingsBtn').tap();
    await phone.locator('[data-option="quality"][data-value="low"]').tap();
    await phone.locator('#closeDlg').tap();
    await phone.locator('#skatesBtn').tap();
    assert.equal(await phone.locator('[data-place].active span').textContent(), '冰上游乐场');
    await phone.locator('#travelBtn').tap();
    assert.equal(await phone.locator('#actionName').textContent(), '领取冰鞋');
    assert.equal(await phone.locator('#skatesBtn').getAttribute('aria-pressed'), 'false');
    await phone.locator('#interactBtn').tap();
    assert.equal(await phone.locator('#skatesBtn').getAttribute('aria-pressed'), 'true');
    await phone.locator('#mapBtn').tap();
    await phone.locator('[data-place]').filter({ hasText: '中心广场' }).tap();
    await phone.locator('#travelBtn').tap();
    await phone.locator('#skatesBtn').tap();
    assert.equal(await phone.locator('#skatesBtn').getAttribute('aria-pressed'), 'false');
    await phone.locator('#skatesBtn').tap();
    assert.equal(await phone.locator('#skatesBtn').getAttribute('aria-pressed'), 'true');
    assert.deepEqual(errors,[]);
    console.log('Touch HUD: found the rink, claimed skates at the rack and changed footwear away from the rink on a 390px screen.');
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
