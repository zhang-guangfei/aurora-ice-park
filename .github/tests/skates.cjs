'use strict';
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright-core');

async function check() {
  const browser = await chromium.launch({
    channel: 'chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const ref = process.env.SOURCE_REF || 'HEAD';
    await page.addInitScript(() => localStorage.setItem('frostbound.park.v1', JSON.stringify({ quality: 'low' })));
    await page.route('https://park.test/**', async route => {
      const path = new URL(route.request().url()).pathname.slice(1) || 'index.html';
      if (!/^(index\.html|style\.css|(?:src|vendor)\/[\w.-]+\.js)$/.test(path)) return route.fulfill({ status: 404, body: '' });
      let body = execFileSync('git', ['show', ref + ':' + path], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
      if (path === 'src/game.js') {
        // Use the real park and its normal physics step. Only this isolated browser gets a deterministic clock.
        const anchor = '  try {\n    loop();';
        assert.ok(body.includes(anchor));
        const harness = [
          '  window.testMotion = {',
          '    place(x, z, yaw = 0, y = 0.085) { stop(); relocate(x, y, z); player.yaw = yaw; if (y > 1) player.grounded = false; },',
          '    step(keys = [], count = 1) { held = Object.fromEntries(keys.map(key => [key, true])); for (let i = 0; i < count; i++) physical(1 / 90); return this.state(); },',
          '    state() { const {x,y,z} = player.pos; return {x,y,z, legal: can(x,z,y), ice: terrain.isIce(x,z), gliding: player.skating, worn: player.skatesOn}; }',
          '  };',
          '  return;',
        ].join('\n');
        body = body.replace(anchor, () => harness + '\n' + anchor);
      }
      const contentType = path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html';
      await route.fulfill({ contentType, body });
    });
    await page.goto('https://park.test/');
    await page.waitForFunction(() => !!window.testMotion, null, { timeout: 90000 });
    const summary = await page.evaluate(() => {
      const h = window.testMotion;
      const pass = (ok, msg, state) => { if (!ok) throw Error(msg + ': ' + JSON.stringify(state)); };
      const moved = (a,b) => Math.hypot(a.x-b.x, a.z-b.z);
      const button = document.querySelector('#skatesBtn');
      h.place(0, 70);
      button.click();
      const iceRun = h.step(['KeyW'], 55), iceCoast = h.step([], 35);
      const drift = moved(iceRun, iceCoast);
      pass(iceCoast.worn && iceCoast.gliding && drift > 1, 'Ice avenue should coast outside the rink', iceCoast);

      h.place(12, 62, Math.PI / 2);
      button.click();
      window.dispatchEvent(new KeyboardEvent('keydown', {code:'KeyR'}));
      window.dispatchEvent(new KeyboardEvent('keyup', {code:'KeyR'}));
      const snowWalk = h.step(['KeyW'], 30), snowStop = h.step([], 60);
      pass(button.getAttribute('aria-pressed') === 'true' && snowStop.worn && !snowStop.ice && !snowStop.gliding &&
        snowWalk.x > 12.8 && moved(snowWalk, snowStop) < 1e-7, 'Skates must walk and stop on snow', snowStop);

      h.place(3, 62, Math.PI / 2);
      let edge = h.state();
      for (let i = 0; i < 200 && edge.ice; i++) edge = h.step(['KeyW']);
      const stopped = h.step([], 45);
      pass(!edge.ice && !edge.gliding && moved(edge, stopped) < 1e-7, 'Ice-to-snow momentum leaked across the edge', stopped);
      const back = h.step(['KeyS'], 60), reentry = h.step([], 20);
      pass(back.ice && back.gliding && moved(back, reentry) > 0.3, 'Returning to ice should resume gliding', back);

      h.place(32, 70, -Math.PI / 2);
      const outside = h.step(['KeyW'], 125), inside = h.step(['KeyS'], 240);
      pass(outside.x < 27.3 && outside.legal && inside.x > 31 && inside.legal && inside.worn, 'West gate must work in both directions', [outside, inside]);

      h.place(54, 70, Math.PI / 2);
      const impact = h.step(['KeyW'], 130), tangent = h.step(['KeyW', 'KeyA'], 55), away = h.step(['KeyS'], 110);
      pass(impact.x > 56.7 && impact.x < 57.8 && impact.legal && tangent.legal && away.legal &&
        tangent.z < impact.z - 0.45 && away.x < tangent.x - 1, 'Oblique contact must slide along the fence and release', [impact, tangent, away]);

      h.place(58, 70);
      const embedded = h.state(), recovered = h.step();
      pass(!embedded.legal && recovered.legal && moved(embedded, recovered) < 0.8, 'Embedded capsule should be freed locally', recovered);
      h.place(58, 70, -Math.PI / 2, 1.8);
      const landed = h.step([], 100), off = h.step(['KeyW'], 120);
      pass(landed.y > 0.9 && landed.y < 1 && landed.legal && off.y < 0.2 && off.legal, 'Landing on the rail must allow stepping off', [landed, off]);
      return { iceCoast: drift, snowCoast: moved(snowWalk, snowStop), gateOutside: outside.x, gateInside: inside.x,
        fenceSlide: moved(impact, tangent), railHeight: landed.y };
    });
    assert.deepEqual(errors, []);
    console.log('Park movement checks passed:', JSON.stringify(summary));
  } finally {
    await browser.close();
  }
}
check().catch(error => { console.error(error); process.exitCode = 1; });
