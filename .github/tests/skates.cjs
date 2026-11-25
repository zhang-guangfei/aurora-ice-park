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
    await page.addInitScript(() => {
      if (!localStorage.getItem('frostbound.park.v1')) {
        // A saved toggle from before the rental desk is not a claim.
        localStorage.setItem('frostbound.park.v1', JSON.stringify({ quality: 'low', skatesOn: true, crystals: [2] }));
      }
    });
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
          '    state() { const {x,y,z} = player.pos; return {x,y,z, legal: can(x,z,y), ice: terrain.isIce(x,z), gliding: player.skating, worn: player.skatesOn, owned: player.ownsSkates}; },',
          '    travel(id) { travel(places.findIndex(p => p.id === id)); },',
          '    interact() { interact(); syncCamera(); },',
          '    advance(seconds) { const n = Math.ceil(seconds * 60); for (let i = 0; i < n; i++) { const dt = seconds / n; globalTime += dt; rides.update(globalTime); physical(dt); } syncCamera(); detect(); },',
          '    view() { camera.updateMatrixWorld(); const project = v => v.clone().project(camera).toArray(); return { mode, seat, photo, pos: camera.position.toArray(), aim: camera.getWorldDirection(V()).toArray(), fov: camera.fov, phase: slideU, height: rides.wheelSeat(seat).y, palace: project(palaceView), plaza: project(plazaView) }; },',
          '    frame() { paused = false; prev = now() - 1 / 60; loop(); paused = true; }',

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
      pass(!h.state().owned && !h.state().worn, 'Legacy toggle must not grant skates', h.state());
      window.dispatchEvent(new KeyboardEvent('keydown', {code:'KeyR'}));
      window.dispatchEvent(new KeyboardEvent('keyup', {code:'KeyR'}));
      pass(!h.state().owned && !h.state().worn && document.querySelector('[data-place].active').textContent.includes('冰上游乐场'),
        'An off-site request must only show the rink', h.state());
      document.querySelector('#travelBtn').click();
      pass(!h.state().owned && document.querySelector('#actionName').textContent === '领取冰鞋', 'Arrival alone must not grant skates', h.state());
      h.interact();
      const saved = JSON.parse(localStorage.getItem('frostbound.park.v1'));
      pass(h.state().owned && h.state().worn && saved.ownsSkates && saved.crystals.includes(2), 'Claim and preserve existing progress', h.state());
      h.place(0, 70);
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
    console.log('Park movement and skate pickup checks passed:', JSON.stringify(summary));
    await page.reload();
    await page.waitForFunction(() => !!window.testMotion);
    assert.equal(await page.evaluate(() => window.testMotion.state().owned), true);
    assert.equal(await page.evaluate(() => window.testMotion.state().worn), true);

    const ride = await page.evaluate(() => {
      const h = window.testMotion;
      const check = (condition, message) => { if (!condition) throw Error(message); };
      const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
      const centered = view => [view.palace, view.plaza].every(([x,y,z]) => Math.abs(x) < 0.90 && Math.abs(y) < 0.75 && z > -1 && z < 1);
      h.travel('wheel');
      const walkingLens = h.view().fov;
      h.interact();
      h.advance(53);
      const windowView = h.view();
      check(windowView.mode === 'wheel' && windowView.height > 51 && windowView.fov > walkingLens + 14 && centered(windowView), 'Framing at the top window');
      document.querySelector('#viewBtn').click();
      const outside = h.view();
      check(centered(outside) && distance(windowView.pos, outside.pos) > 12, 'Open panorama outside the cabin');
      const canvas = document.querySelector('#scene');
      canvas.dispatchEvent(new PointerEvent('pointerdown', {pointerId: 17, clientX: 280, clientY: 150, button:0}));
      canvas.dispatchEvent(new PointerEvent('pointermove', {pointerId: 17, clientX: 460, clientY: 183}));
      canvas.dispatchEvent(new PointerEvent('pointerup', {pointerId: 17, clientX: 460, clientY: 183}));
      h.advance(0.02);
      const turned = h.view();
      h.advance(4);
      check(distance(turned.aim, outside.aim) > 0.25 && distance(turned.aim, h.view().aim) < 0.001, 'Manual look must stay under player control');
      document.querySelector('#photoBtn').click();
      const photo = h.view();
      check(photo.photo && photo.mode === 'wheel' && photo.pos[1] > 45, 'Entering photo mode at altitude');
      h.advance(1);
      document.querySelector('#exitPhoto').click();
      check(!h.view().photo && h.view().mode === 'wheel', 'Resume the same cabin after a photo');
      h.interact();
      check(h.view().mode === 'walk' && h.view().fov === walkingLens && h.view().pos[1] < 7, 'Walking lens and station restored');
      h.travel('slide');
      h.interact(); h.interact();
      check(h.view().mode === 'slide', 'Stairs, launch platform and slide entry');
      h.advance(4);
      const chase = h.view();
      check(chase.phase > 0.12 && chase.phase < 0.85 && chase.pos.every(Number.isFinite), 'Slide chase camera follows a bend');
      h.advance(24);
      check(h.view().mode === 'walk' && h.state().legal, 'Finished the slide at a free exit');
      // Leave the camera at the top for the real WebGL frame check below.
      h.travel('wheel'); h.interact(); h.advance(53); h.frame();
      return { height: windowView.height, windowFov: windowView.fov, outsideFov: outside.fov, slideU: chase.phase };
    });
    await page.waitForFunction(() => document.querySelector('#loading').hidden === true);
    const { PNG } = require('pngjs');
    const shot = PNG.sync.read(await page.screenshot({ clip: { x: 140, y: 105, width: 340, height: 165 } }));
    const palette = new Set();
    for (let i = 0; i < shot.data.length; i += 16) {
      palette.add(((shot.data[i] >> 4) << 8) + ((shot.data[i + 1] >> 4) << 4) + (shot.data[i + 2] >> 4));
    }
    assert.ok(palette.size > 35, 'The aerial view must contain visible scene detail.');
    console.log('Ride framing, altitude photo and full slide passed:', JSON.stringify(ride), 'color bins:', palette.size);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
}
check().catch(error => { console.error(error); process.exitCode = 1; });
