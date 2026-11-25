'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright-core');

const ref = process.env.SOURCE_REF || 'HEAD';
const out = path.join(process.env.RUNNER_TEMP || require('node:os').tmpdir(), 'park-frames');
// Fixed world coordinates make editions of the park directly comparable.
const views = [
  ['promenade', [0,1.76,70], [0,18,-29], 'high', 'night'],
  ['palace', [13,3.3,3], [0,18,-45], 'high', 'night'],
  ['ice-gate', [-3.2,2.1,-21], [0,7.2,-35], 'medium', 'night'],
  ['slide', [-35,11,31], [-52,10,-7], 'medium', 'night'],
  ['wheel', [13.6,3.2,17.8], [53,23,-19], 'medium', 'night'],
  ['market', [34.4,2.1,48.2], [43.4,3.3,31.2], 'high', 'night'],
  ['twilight', [-12,3.8,25], [4,17,-39], 'medium', 'dusk'],
  ['daylight', [13,3.3,3], [0,18,-45], 'low', 'day'],
];

async function run() {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', m => { if (m.type() === 'error' && /WebGL|shader|GL_INVALID/i.test(m.text())) errors.push(m.text()); });
    await page.addInitScript(() => localStorage.setItem('frostbound.park.v1', JSON.stringify({ quality: 'medium' })));
    await page.route('https://park.test/**', async route => {
      const name = new URL(route.request().url()).pathname.slice(1) || 'index.html';
      if (!/^(?:index\.html|style\.css|(?:src|vendor)\/[\w.-]+\.js)$/.test(name)) return route.fulfill({ status: 404, body: '' });
      let body = execFileSync('git', ['show', ref + ':' + name], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
      if (name === 'src/game.js') {
        const anchor = '  try {\n    loop();';
        assert.ok(body.includes(anchor));
        const lab = [
          '  let viewNumber = 0;',
          '  window.renderParkFrame = ([name, eye, aim, preset, light]) => {',
          '    const t = 16.25; quality = preset; setTime(light); resize();',
          '    camera.position.fromArray(eye); camera.lookAt(...aim); camera.updateMatrixWorld();',
          '    rides.update(t); castle.update(t); sculptures.update(t); woods.update(++viewNumber + t, camera.position);',
          '    people.update(t, 0, player); people.avatar.visible = false; kit.clock.value = t;',
          '    sky.update(t, 10, camera.position);',
          '    terrain.reflect(reflectionExclusions, viewNumber * 10); post.render();',
          '    return canvas.toDataURL("image/jpeg", .91);',
          '  };',
          '  return;',
        ].join('\n');
        body = body.replace(anchor, () => lab + '\n' + anchor);
      }
      return route.fulfill({ contentType: name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html', body });
    });
    await page.goto('https://park.test/');
    await page.waitForFunction(() => !!window.renderParkFrame, null, { timeout: 90000 });
    const shots = [];
    for (const view of views) {
      const data = await page.evaluate(view => window.renderParkFrame(view), view);
      fs.writeFileSync(path.join(out, view[0] + '.jpg'), Buffer.from(data.split(',')[1], 'base64'));
      shots.push(data);
    }
    assert.deepEqual(errors, []);
    const board = await page.evaluate(async shots => {
      const canvas = document.createElement('canvas'), w = 256, h = 144;
      canvas.width = w * 2; canvas.height = h * 4;
      const ctx = canvas.getContext('2d');
      for (const [i, data] of shots.entries()) {
        const im = new Image(); im.src = data; await im.decode();
        ctx.drawImage(im, (i % 2) * w, Math.floor(i / 2) * h, w, h);
      }
      return canvas.toDataURL('image/webp', .72);
    }, shots);
    fs.writeFileSync(path.join(out, 'overview.webp'), Buffer.from(board.split(',')[1], 'base64'));
    // A portable preview is also readable when artifact downloads require a signed-in browser.
    console.log('PARK_PREVIEW ' + board);
    console.log('Rendered ' + views.length + ' fixed park views across all three quality and lighting settings.');
  } finally { await browser.close(); }
}
run().catch(err => { console.error(err); process.exitCode = 1; });
