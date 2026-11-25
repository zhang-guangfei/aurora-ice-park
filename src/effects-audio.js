'use strict';

function effects(T, scene, kit) {
  const V = (x, y, z) => new T.Vector3(x, y, z),
    A = 2 * Math.PI,
    colors = [0x85e9eb, 0xffc68a, 0xe7a2e7, 0x9fa7ff, 0xdafcff],
    sparks = [],
    rockets = [];
  const max = 2000,
    pg = new T.BufferGeometry(),
    pp = new Float32Array(max * 3),
    cc = new Float32Array(max * 3),
    sz = new Float32Array(max),
    al = new Float32Array(max);
  for (const [name, a, n] of [
    ['position', pp, 3],
    ['color', cc, 3],
    ['size', sz, 1],
    ['alpha', al, 1],
  ])
    pg.setAttribute(name, new T.BufferAttribute(a, n).setUsage(T.DynamicDrawUsage));
  pg.setDrawRange(0, 0);
  const pm = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
    uniforms: { scale: { value: 650 } },
    vertexShader:
      'attribute vec3 color;attribute float size,alpha;varying vec3 c;varying float a;uniform float scale;void main(){vec4 p=modelViewMatrix*vec4(position,1.);c=color;a=alpha;gl_Position=projectionMatrix*p;gl_PointSize=clamp(size*scale/max(1.,-p.z),.9,8.);}',
    fragmentShader:
      'varying vec3 c;varying float a;void main(){float d=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(c*1.8,a*(1.-smoothstep(.12,1.,d)));}',
  });
  const points = new T.Points(pg, pm);
  points.frustumCulled = false;
  points.renderOrder = 13;
  scene.add(points);
  function spark(p, v, c, life, size, g, drag) {
    if (sparks.length >= max) return;
    sparks.push({ p: p.clone(), v, c, life, age: 0, size, g, drag });
  }
  function burst(pos, color, n = 80) {
    const c = new T.Color(color);
    for (let i = 0; i < n; i++) {
      const z = 1 - (2 * (i + 0.5)) / n,
        r = Math.sqrt(1 - z * z),
        theta = i * 2.3999632 + Math.random() * 0.21,
        s = 4.8 + Math.random() * 3.3;
      const v = V(Math.cos(theta) * r, z, Math.sin(theta) * r).multiplyScalar(s);
      spark(pos, v, c, 1.65 + Math.random() * 0.75, 0.24 + Math.random() * 0.18, 2.1, 0.31);
      if (i % 2 === 0)
        spark(pos, v.clone().multiplyScalar(0.89), c, 0.9 + Math.random(), 0.17, 2.1, 0.34);
    }
  }
  function snowflake(p) {
    const hues = [0x89eeec, 0xadbbff, 0xeea3db, 0xffcc96, 0xb6f2de, 0xb3c4ff];
    for (let j = 0; j < 6; j++) {
      const a = (j * Math.PI) / 3 + Math.PI / 2,
        col = new T.Color(hues[j]),
        dx = Math.cos(a),
        dy = Math.sin(a);
      for (let i = 1; i <= 15; i++) {
        const d = 0.57 * i;
        spark(
          p,
          V(dx * d, dy * d + 0.9, Math.sin(a * 0.9) * 0.72),
          col,
          1.95 + i * 0.018,
          0.24,
          1.07,
          0.08
        );
      }
      for (const side of [-1, 1])
        for (let i = 1; i <= 5; i++) {
          const d = i * 0.46;
          spark(
            p,
            V(dx * (4.6 + d) - dy * side * d * 0.65, dy * (4.6 + d) + dx * side * d * 0.65 + 0.9, 0.2),
            col,
            2.12,
            0.25,
            1.07,
            0.08
          );
        }
    }
  }
  function launch(t, show = false) {
    const left = Math.random() > 0.5,
      x = (left ? -1 : 1) * (18 + Math.random() * 43),
      z = -56 - Math.random() * 27,
      d = 1.32 + Math.random() * 0.46;
    rockets.push({
      p: V(x, 4, z),
      v: V((Math.random() - 0.5) * 1.5, 23 + Math.random() * 8, -0.5),
      age: 0,
      d,
      color: colors[Math.floor(Math.random() * colors.length)],
    });
    if (show && Math.random() > 0.5)
      rockets.push({
        p: V(-x + 4, 6, z + 3),
        v: V(0, 25.4, -0.6),
        age: -0.22,
        d: 1.58,
        color: 0xf9c494,
      });
  }
  function powder(p, n = 9) {
    const c = new T.Color(0xbed7e2);
    for (let i = 0; i < n; i++)
      spark(
        p,
        V((Math.random() - 0.5) * 1.6, 0.48 + Math.random() * 1.5, (Math.random() - 0.5) * 1.6),
        c,
        0.32 + Math.random() * 0.32,
        0.035 + Math.random() * 0.084,
        2.8,
        1.8
      );
  }
  const tread = new Uint8Array(32 * 48 * 4);
  for (let y = 0; y < 48; y++)
    for (let x = 0; x < 32; x++) {
      const u = (x - 15.5) / 15.6,
        v = (y - 23.5) / 23.5,
        toe = Math.pow(u / 0.77, 2) + Math.pow((v + 0.31) / 0.63, 2),
        heel = Math.pow(u / 0.65, 2) + Math.pow((v - 0.57) / 0.33, 2),
        d = Math.min(toe, heel),
        block = Math.cos(v * 36 + Math.abs(u) * 3) > 0.72 ? 0.55 : 1;
      const i = (y * 32 + x) * 4;
      tread.set([222, 232, 242, Math.round(Math.max(0, Math.min(1, (1 - d) * 6)) * block * 255)], i);
    }
  const sole = new T.DataTexture(tread, 32, 48);
  sole.minFilter = sole.magFilter = T.LinearFilter;
  sole.needsUpdate = true;
  const footMat = new T.MeshBasicMaterial({
    map: sole,
    color: 0x748a99,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const footGeo = new T.CircleGeometry(1, 14).rotateX(-Math.PI / 2),
    feet = new T.InstancedMesh(footGeo, footMat, 88);
  feet.frustumCulled = false;
  feet.renderOrder = 2;
  scene.add(feet);
  let cursor = 0,
    odd = false;
  const marks = [],
    o = new T.Object3D();
  o.scale.setScalar(0);
  o.updateMatrix();
  for (let i = 0; i < 88; i++) feet.setMatrixAt(i, o.matrix);
  function step(p, yaw, t) {
    odd = !odd;
    const x = p.x + Math.cos(yaw) * (odd ? 0.135 : -0.135),
      z = p.z + Math.sin(yaw) * (odd ? 0.135 : -0.135);
    const mark = { i: cursor++ % 88, x, y: p.y + 0.008, z, yaw: -(yaw + (odd ? 0.07 : -0.07)), time: t };
    marks[mark.i] = mark;
    powder(V(x, p.y + 0.08, z), 5);
  }
  let next = 7.8,
    limit = 1;
  return {
    points,
    feet,
    step,
    powder,
    burst,
    launch,
    quality(q, dpr) {
      limit = q === 'low' ? 0.55 : q === 'medium' ? 0.78 : 1;
      pm.uniforms.scale.value = 580 * dpr;
    },
    update(t, dt, show, night, audio) {
      if (t >= next) {
        if (night) launch(t, show);
        next = t + (show ? 1.2 + Math.random() * 0.85 : 10 + Math.random() * 8);
      }
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.age += dt;
        if (r.age < 0) continue;
        r.p.addScaledVector(r.v, dt);
        r.v.y -= 2.1 * dt;
        spark(r.p, V(0, -1, 0), new T.Color(0xffd8a0), 0.36, 0.21, 1, 0.5);
        if (r.age > r.d) {
          if (show && t % 5.4 < 2.7) snowflake(r.p);
          else burst(r.p, r.color, Math.round((show ? 103 : 81) * limit));
          audio.fx('firework');
          rockets.splice(i, 1);
        }
      }
      let count = 0;
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.age += dt;
        if (s.age >= s.life) {
          sparks.splice(i, 1);
          continue;
        }
        s.v.multiplyScalar(Math.exp(-s.drag * dt));
        s.v.y -= s.g * dt;
        s.p.addScaledVector(s.v, dt);
        s.p.toArray(pp, count * 3);
        s.c.toArray(cc, count * 3);
        sz[count] = s.size;
        al[count] = Math.min(1, (s.life - s.age) * 2.8);
        count++;
      }
      pg.setDrawRange(0, count);
      for (const a of Object.values(pg.attributes)) a.needsUpdate = true;
      for (const mark of marks) {
        if (!mark) continue;
        const tleft = Math.max(0, 1 - (t - mark.time) / 21);
        o.position.set(mark.x, mark.y, mark.z);
        o.rotation.set(0, mark.yaw, 0);
        o.scale.set(0.092 * tleft, 1, 0.18 * tleft);
        o.updateMatrix();
        feet.setMatrixAt(mark.i, o.matrix);
      }
      feet.instanceMatrix.needsUpdate = true;
    },
  };
}
function soundscape() {
  let ctx = null,
    master,
    windBuffer,
    ambient,
    rideGain,
    on = false,
    volume = 0.42,
    beat = 0,
    next = 0;
  const melody = [
    0,
    null,
    7,
    12,
    null,
    9,
    7,
    null,
    4,
    null,
    2,
    7,
    null,
    4,
    2,
    null,
    0,
    null,
    7,
    14,
    12,
    null,
    9,
    7,
    4,
    null,
    7,
    9,
    4,
    2,
    null,
    null,
  ];
  function tone(freq, time, dur, level, wave = 'sine') {
    if (!ctx || !on) return;
    const osc = ctx.createOscillator(),
      gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(level, time + Math.min(0.12, dur * 0.18));
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(gain).connect(master);
    osc.start(time);
    osc.stop(time + dur + 0.06);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }
  function noise(dur, hz, vol, kind = 'lowpass') {
    if (!ctx || !on) return;
    const src = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain(),
      t = ctx.currentTime;
    src.buffer = windBuffer;
    src.loop = true;
    filter.type = kind;
    filter.frequency.value = hz;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(master);
    src.start(t, Math.random() * 0.8);
    src.stop(t + dur);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
  async function set(enabled) {
    if (!ctx && enabled) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.001;
      master.connect(ctx.destination);
      const n = ctx.sampleRate * 2;
      windBuffer = ctx.createBuffer(1, n, ctx.sampleRate);
      const a = windBuffer.getChannelData(0);
      let old = 0;
      for (let i = 0; i < n; i++) {
        old = (old + 0.115 * (Math.random() * 2 - 1)) / 1.1;
        a[i] = old * 2.3;
      }
      ambient = ctx.createBufferSource();
      ambient.buffer = windBuffer;
      ambient.loop = true;
      const filter = ctx.createBiquadFilter(),
        wind = ctx.createGain();
      filter.type = 'lowpass';
      filter.frequency.value = 820;
      wind.gain.value = 0.09;
      ambient.connect(filter).connect(wind).connect(master);
      ambient.start();
      const ride = ctx.createOscillator();
      ride.frequency.value = 57;
      rideGain = ctx.createGain();
      rideGain.gain.value = 0;
      ride.connect(rideGain).connect(master);
      ride.start();
    }
    if (!ctx) return false;
    if (enabled) await ctx.resume();
    on = enabled;
    master.gain.setTargetAtTime(on ? volume : 0, ctx.currentTime, 0.08);
    if (on) next = ctx.currentTime + 0.1;
    return on;
  }
  function fx(which) {
    if (!ctx || !on) return;
    const t = ctx.currentTime;
    if (which === 'step') noise(0.115, 1200, 0.18, 'bandpass');
    else if (which === 'crystal') {
      for (let i = 0; i < 4; i++) tone([659, 831, 988, 1318][i], t + i * 0.085, 0.75, 0.104);
    } else if (which === 'firework') noise(0.63, 170, 0.25);
    else if (which === 'hit') {
      noise(0.2, 920, 0.38);
      tone(677, t + 0.03, 0.32, 0.085);
    } else if (which === 'throw') noise(0.16, 1600, 0.19);
    else if (which === 'ride') tone(523.25, t, 0.6, 0.105);
  }
  return {
    set,
    fx,
    get enabled() {
      return on;
    },
    get volume() {
      return volume;
    },
    level(v) {
      volume = Number(v);
      if (ctx && on) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.07);
    },
    update(mode, speed, fest) {
      if (!on || !ctx || ctx.state !== 'running') return;
      const t = ctx.currentTime;
      rideGain.gain.setTargetAtTime(mode === 'wheel' ? 0.035 : mode === 'slide' ? 0.055 : 0, t, 0.45);
      if (t + 0.18 < next) return;
      if (next < t) next = t + 0.05;
      const note = melody[beat % melody.length],
        root = [62, 57, 59, 55][Math.floor(beat / 8) % 4];
      if (beat % 8 === 0)
        for (const sem of [0, 7, 12])
          tone(440 * 2 ** ((root - 12 + sem - 69) / 12), next, 4.9, 0.026, 'sine');
      if (note !== null) tone(440 * 2 ** ((root + 12 + note - 69) / 12), next, 1.55, 0.041, 'sine');
      if (fest && beat % 2 === 0) tone(660 * 2 ** ((note ?? 0) / 12), next + 0.16, 0.59, 0.035);
      if (mode === 'slide' || (mode === 'skate' && speed > 1))
        noise(0.38, mode === 'slide' ? 1400 : 2200, 0.095, 'bandpass');
      next += fest ? 0.38 : 0.66;
      beat++;
    },
  };
}
