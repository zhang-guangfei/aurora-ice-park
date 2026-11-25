'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright-core');

async function check() {
  const browser = await chromium.launch({
    channel: 'chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });
    for (const path of ['vendor/three.min.js', 'src/terrain.js']) {
      const ref = process.env.SOURCE_REF || 'HEAD';
      const content = execFileSync('git', ['show', ref + ':' + path], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
      await page.addScriptTag({ content });
    }
    const results = await page.evaluate(() => {
      const T = THREE, width = 400, height = 240;
      const renderer = new T.WebGLRenderer(), scene = new T.Scene();
      renderer.setSize(width, height);
      const camera = new T.PerspectiveCamera(53, width / height, 0.065, 200);
      const texture = (rgb) => {
        const map = new T.DataTexture(new Uint8Array([...rgb, 255]), 1, 1);
        map.needsUpdate = true;
        return map;
      };
      const kit = {
        snowMap: texture([180, 200, 220]), normal: texture([128, 128, 255]),
        snow: new T.MeshStandardMaterial(), clock: { value: 0 }, festival: { value: 0 },
      };
      const ice = ground(T, renderer, scene, camera, kit);
      const lamp = new T.Mesh(new T.BoxGeometry(3.0, 1.6, 0.6), new T.MeshBasicMaterial({ color: 0xff0000 }));
      lamp.position.set(0, 3.7, 5);
      scene.add(lamp);
      const frame = new T.WebGLRenderTarget(width, height);
      const pixels = new Uint8Array(width * height * 4);
      let captures = 0;
      const render = renderer.render.bind(renderer);
      renderer.render = (scene, camera) => {
        if (renderer.getRenderTarget() === ice.rt) captures++;
        return render(scene, camera);
      };
      function position(step) {
        camera.position.set(step * 0.082, 1.75 + 0.012 * Math.sin(step), 23 - step * 0.035);
        camera.lookAt(camera.position.clone().add(new T.Vector3(0, -0.04, -1)));
      }
      // The lower half contains only the ground. Track the red lamp's reflection in pixels.
      function centroid() {
        renderer.setRenderTarget(frame);
        renderer.render(scene, camera);
        renderer.readRenderTargetPixels(frame, 0, 0, width, height, pixels);
        renderer.setRenderTarget(null);
        let xSum = 0, ySum = 0, sum = 0;
        for (let y = 0; y < Math.floor(height / 2); y++) {
          for (let x = 0; x < width; x++) {
            const i = 4 * (y * width + x);
            const red = Math.max(0, pixels[i] - Math.max(pixels[i + 1], pixels[i + 2]) - 8);
            sum += red;
            xSum += x * red;
            ySum += y * red;
          }
        }
        if (sum < 1500) throw Error('The red reflection was not visible');
        return [xSum / sum, ySum / sum];
      }
      let clock = 0;
      function walk(mode) {
        clock += 10;
        const start = captures, centers = [];
        for (let i = 0; i <= 4; i++) {
          position(i);
          if (mode !== 'frozen' || i === 0) ice.reflect([], clock + i * (mode === 'reference' ? 1 : 1 / 60));
          centers.push(centroid());
        }
        return { centers, captures: captures - start };
      }
      const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
      const outcomes = [];
      for (const level of ['high', 'medium']) {
        ice.resize(width, height, level);
        const frozen = walk('frozen'), cached = walk('cached'), reference = walk('reference');
        const maxError = path => Math.max(...path.centers.map((p, i) => distance(p, reference.centers[i])));
        const pixelsPerMirrorTexel = width / ice.rt.width;
        const before = captures;
        camera.position.x += 25; ice.reflect([], clock + 4.001);
        camera.rotateY(0.25); ice.reflect([], clock + 4.002);
        camera.fov -= 3; camera.updateProjectionMatrix(); ice.reflect([], clock + 4.003);
        ice.resize(width / 2, height / 2, level); ice.reflect([], clock + 4.004);
        outcomes.push({ level, pixelsPerMirrorTexel, oldError: maxError(frozen), error: maxError(cached),
          captures: cached.captures, referenceCaptures: reference.captures, cutCaptures: captures - before });
      }
      const beforeLow = captures;
      ice.resize(width, height, 'low');
      for (let i = 0; i < 5; i++) { position(i); ice.reflect([], ++clock); }
      return { outcomes, lowCaptures: captures - beforeLow };
    });
    for (const m of results.outcomes) {
      console.log(m.level + ': held image ' + m.oldError.toFixed(2) + ' px, reprojected ' +
        m.error.toFixed(2) + ' px from full redraw; ' + m.captures + ' capture for 5 screen frames');
      assert.ok(m.oldError > 4, 'Walking must expose the original stepping');
      assert.ok(m.error < m.pixelsPerMirrorTexel && m.error < m.oldError * 0.3, 'Reflected landmark drifted under camera translation');
      assert.equal(m.captures, 1);
      assert.equal(m.referenceCaptures, 5);
      assert.equal(m.cutCaptures, 4, 'Teleport, turn, zoom and resize must refresh immediately');
    }
    assert.equal(results.lowCaptures, 0);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
}

check().catch(error => { console.error(error); process.exitCode = 1; });
