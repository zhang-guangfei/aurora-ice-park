'use strict';

function landscape(T, k) {
  const group = new T.Group(),
    colliders = [],
    lods = [],
    outer = [],
    lamps = [],
    V = (x, y, z) => new T.Vector3(x, y, z),
    C = (c) => new T.Color(c),
    A = Math.PI * 2;
  let seed = 73129;
  const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296,
    cl = (x, a, b) => Math.max(a, Math.min(b, x)),
    mix = (a, b, t) => a + (b - a) * t;
  function writer() {
    const pos = [],
      col = [],
      ix = [];
    return {
      v(x, y, z, c) {
        pos.push(x, y, z);
        col.push(c.r, c.g, c.b);
        return pos.length / 3 - 1;
      },
      tri(a, b, c) {
        ix.push(a, b, c);
      },
      geo() {
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
        g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
        g.setIndex(ix);
        g.computeVertexNormals();
        g.computeBoundingSphere();
        return g;
      },
    };
  }
  function mesh(p, g, m, x = 0, y = 0, z = 0) {
    const o = new T.Mesh(g, m);
    o.position.set(x, y, z);
    p.add(o);
    return o;
  }
  for (const far of [true, false]) {
    const b = writer(),
      N = 272,
      M = far ? 7 : 12,
      S = M - 2,
      noise = [10, 24, 49, 97, 159].map((n) => Array.from({ length: n }, rnd));
    function n(u, k) {
      const ar = noise[k],
        p = (((u % 1) + 1) % 1) * ar.length,
        i = Math.floor(p),
        f = p - i;
      return mix(ar[i % ar.length], ar[(i + 1) % ar.length], f * f * (3 - 2 * f));
    }
    const rock = C(far ? 0x435b7c : 0x344b60),
      frost = C(far ? 0x9db3c9 : 0xb5cbd6);
    for (let r = 0; r <= M; r++) {
      const q = r / S;
      for (let i = 0; i < N; i++) {
        const u = i / N,
          flow = u + 0.013 * Math.sin(A * (u * 5 + q * 0.22)) * (1 - Math.min(1, q)),
          spur = n(flow, 2),
          rad = mix(
            (far ? 218 : 124) + 14 * n(u, 0) + 12 * (1 - spur),
            (far ? 282 : 196) + 19 * n(u, 1),
            q
          ),
          a = u * A;
        let h =
          (far ? 17 : 5) + 13 * n(flow, 0) + 9 * n(flow, 1) + 5 * spur + 3 * n(flow, 3) + 2 * n(flow, 4);
        for (const [at, ht, w] of [
          [0.116, far ? 40 : 27, 0.043],
          [0.9, far ? 32 : 24, 0.053],
          [0.29, 25, 0.05],
          [0.49, 17, 0.04],
          [0.67, 22, 0.055],
        ]) {
          const d = Math.abs(((flow - at + 1.5) % 1) - 0.5);
          h += ht * Math.exp(-Math.pow(d / w, 1.15) * 1.78);
        }
        const y =
          q <= 1
            ? -2 + h * Math.pow(q, 1.12 + 0.72 * (1 - spur)) + Math.sin(q * Math.PI) * (spur - 0.42) * 14
            : h - 2 - (q - 1) * 62;
        b.v(
          Math.sin(a) * rad,
          y,
          -Math.cos(a) * rad * 0.92 + 9,
          rock
            .clone()
            .lerp(frost, cl(((y - 5) / 31) * 0.48 + 0.37 * spur + 0.22 * n(flow + 0.013 * q, 4), 0, 1))
            .multiplyScalar(0.78 + 0.3 * n(flow, 1))
        );
        if (r < M) {
          const v = r * N + i,
            w = r * N + ((i + 1) % N);
          b.tri(v, w, v + N);
          b.tri(w, w + N, v + N);
        }
      }
    }
    mesh(
      group,
      b.geo(),
      new T.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.98,
        emissive: 0x152539,
        emissiveIntensity: 0.27,
      })
    );
  }
  const pine = C(0x25434a),
    spruce = C(0x4b6d74),
    under = C(0x91aeb9),
    powder = C(0xe4eff3),
    wood = C(0x64594e);
  function canopy(level, kind) {
    const b = writer(),
      tiers = [13, 10, 6][level],
      lean = (kind - 1) * 0.018;
    function spray(x, y, z, a, len, width, cap, fall, bend, pointed) {
      const dx = Math.cos(a), dz = Math.sin(a), mantle = powder.clone().lerp(under, rnd() * 0.38);
      let previous;
      for (const u of [0, 0.31, 0.68, 1]) {
        const r = width * (u === 1 ? 0.015 : u === 0 ? 0.25 : u < 0.4 ? 1 : 0.73);
        const off = bend * u * u, cx = x + dx * len * u - dz * off, cz = z + dz * len * u + dx * off;
        const cy = y - fall * (0.26 * u + 0.74 * u * u) + 0.022 * len * Math.sin(u * Math.PI);
        const lift = cap * (r / width);
        const point = (side, dy, tint) => b.v(cx - dz * r * side, cy + dy, cz + dx * r * side, tint);
        const row = [point(0,-lift*.42,pine),point(1,-lift*.15,spruce),point(.65,lift*.72,mantle),
          point(0,lift, powder),point(-.72,lift*.65,mantle),point(-1,-lift*.11,spruce)];
        if (previous) for (let i = 0; i < row.length; i++) {
          const j = (i + 1) % row.length;
          b.tri(previous[i],row[i],row[j]);
          b.tri(previous[i],row[j],previous[j]);
        }
        if (pointed && (u === .31 || u === .68)) for (const side of [-1,1]) {
          const e = side > 0 ? 1 : 5, edge = side > 0 ? 2 : 4;
          const length = len * (.18 + .19 * rnd()), reach = side * r * (1.15 + .72 * rnd());
          const tip = b.v(cx + dx * length - dz * reach, cy - length * (.22 + .32 * rnd()), cz + dz * length + dx * reach, spruce);
          b.tri(row[e],tip,row[edge]);
        }
        previous = row;
      }
    }
    let prev;
    for (const [y, r] of [
      [0, 0.037],
      [0.08, 0.03],
      [0.55, 0.015],
      [1, 0.002],
    ]) {
      const ring = [];
      for (let j = 0; j < 7; j++) {
        const a = (j * A) / 7;
        ring.push(b.v(lean * y + Math.cos(a) * r, y, Math.sin(a) * r, wood));
      }
      if (prev)
        for (let j = 0; j < 7; j++) {
          const l = (j + 1) % 7;
          b.tri(prev[j], ring[j], ring[l]);
          b.tri(prev[j], ring[l], prev[l]);
        }
      prev = ring;
    }
    let phase = rnd() * A;
    for (let i = 0; i < tiers; i++) {
      const f = i / tiers,
        y = 0.183 + 0.805 * f,
        R = (0.31 + 0.02 * Math.sin(f * 4.7)) * Math.pow(1 - f, 0.82),
        nb = Math.round([9, 8, 7][level] - f * 3);
      phase += 1.94 + rnd() * 0.4;
      if (level === 2) {
        const top = b.v(lean * y, y + 0.105 * (1 - f) + 0.025, 0, powder),
          bottom = b.v(lean * y, y - 0.008, 0, pine),
          sh = [],
          rim = [];
        for (let j = 0; j < nb * 2; j++) {
          const a = phase + (A * j) / (nb * 2),
            rr = R * (j % 2 ? 0.64 : 1) * (0.91 + rnd() * 0.19),
            x = Math.cos(a) * rr,
            z = Math.sin(a) * rr,
            h = y - rr * 0.22;
          rim.push(b.v(x + lean * y, h, z, spruce));
          sh.push(b.v(x * 0.79 + lean * y, h + R * 0.19, z * 0.79, j % 2 ? under : powder));
        }
        for (let j = 0; j < rim.length; j++) {
          const l = (j + 1) % rim.length;
          b.tri(bottom, rim[j], rim[l]);
          b.tri(rim[j], sh[j], sh[l]);
          b.tri(rim[j], sh[l], rim[l]);
          b.tri(sh[j], top, sh[l]);
        }
        continue;
      }
      for (let j = 0; j < nb; j++) {
        const a = phase + (A * (j + 0.56 * (rnd() - 0.5))) / nb,
          dx = Math.cos(a),
          dz = Math.sin(a),
          len = R * (0.77 + rnd() * 0.42),
          fall = len * (.17 + rnd() * .26),
          bend = len * (rnd() - .5) * .17,
          base = y + len * (rnd() - .5) * .23;
        spray(lean*y,base,0,a,len,len*.095,len*.061,fall,bend,false);
        const pairs = level === 0 ? 5 : 3;
        for (let s = 0; s < pairs; s++) for (const side of [-1,1]) {
          const u = .13 + (.68 * (s + .55*rnd())) / pairs, offset = bend*u*u;
          const x = lean*y + dx*len*u - dz*offset, z = dz*len*u + dx*offset;
          const yy = base - fall*(.26*u + .74*u*u);
          const length = len * (1.-u*.79) * (.44 + rnd()*.27);
          spray(x, yy, z, a + side * (.44 + .50*rnd()), length, length*(.13+.05*rnd()),
            length*(.085+.085*rnd()), length*(.17+.34*rnd()), side*length*.08, level===0);
        }
      }
    }
    return b.geo();
  }
  const models = Array.from({ length: 3 }, (_, s) => [0, 1, 2].map((l) => canopy(l, s))),
    treeMat = new T.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.94,
      emissive: 0x0a2027,
      emissiveIntensity: 0.16,
    }),
    trees = [];
  function plant(x, z, h, idx, width = 1, far = false) {
    trees.push({ x, z, h, idx, width, far, y: rnd() * A });
    if (!far) colliders.push({ type: 'circle', x, z, r: cl(h * 0.09, 0.39, 1.16), maxY: h });
  }
  for (const t of [
    [-15.8, 50, 10.8, 0],
    [-19.1, 51.8, 6.8, 1],
    [-20.9, 46.8, 8.1, 2],
    [16.1, 48.6, 10.4, 2],
    [18.9, 53.2, 6.8, 1],
    [22.5, 50.3, 8.5, 0],
    [-22.6, 61.1, 8.8, 1],
    [-25.1, 54.9, 6.2, 2],
    [-20.5, 21.8, 8.6, 1],
    [-24.1, 22.3, 5.8, 2],
    [21.3, 20.1, 8.5, 1],
    [23.8, 17.9, 6, 0],
    [19.4, 9, 5.9, 2],
    [-22.2, -10.7, 7.7, 0],
    [27.4, -4.2, 6.3, 0],
    [-29.6, 45.5, 5.4, 1],
    [29.4, 58.7, 5.9, 2],
    [-25.4, 76.8, 7.6, 1],
    [27.6, 83.3, 8, 1],
    [62.4, 53.9, 6.3, 0],
    [65.3, 46.3, 7.4, 2],
    [-60.4, 46.1, 6.4, 1],
    [-58.9, 52.5, 7.8, 0],
    [-57.9, 32.6, 7.5, 2],
    [-46.9, -60.3, 11.2, 0],
    [43.6, -57.5, 9.7, 1],
    [47.8, -61.6, 7.9, 2],
    [28.9, 40.8, 8.2, 2, 1.14],
  ])
    plant(...t);
  for (let i = 0; i < 100; i++) {
    const a = (A * (i + rnd() * 0.7)) / 100,
      r = 80 + rnd() * 15,
      x = Math.sin(a) * r,
      z = Math.cos(a) * r + 5;
    if (Math.abs(x) > 26 && Math.abs(x) < 66 && z > 56 && z < 84) continue;
    plant(x, z, 4.5 + rnd() * 7.5, i % 3, 0.82 + rnd() * 0.36);
  }
  for (let i = 0; i < 170; i++) {
    const a = (A * (i + rnd() * 0.8)) / 170,
      r = 111 + rnd() * 26;
    plant(Math.sin(a) * r, Math.cos(a) * r + 7, 3.8 + rnd() * 7.6, i % 3, 0.8 + rnd() * 0.32, true);
  }
  const cells = new Map(),
    tr = new T.Object3D();
  for (const t of trees) {
    const key = t.far ? 'outer' : Math.floor(t.x / 34) + ',' + Math.floor(t.z / 34);
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(t);
  }
  for (const [key, ts] of cells) {
    const cx = ts.reduce((s, t) => s + t.x, 0) / ts.length,
      cz = ts.reduce((s, t) => s + t.z, 0) / ts.length,
      lod = new T.LOD(),
      far = key === 'outer';
    lod.userData.dynamic = true;
    lod.position.set(cx, 0, cz);
    for (const l of far ? [2] : [0, 1, 2]) {
      const set = new T.Group();
      for (let j = 0; j < 3; j++) {
        const sel = ts.filter((t) => t.idx === j);
        if (!sel.length) continue;
        const im = new T.InstancedMesh(models[j][l], treeMat, sel.length);
        sel.forEach((t, i) => {
          tr.position.set(t.x - cx, 0.016, t.z - cz);
          tr.rotation.y = t.y;
          tr.scale.set(t.width * t.h, t.h, t.width * t.h);
          tr.updateMatrix();
          im.setMatrixAt(i, tr.matrix);
        });
        im.castShadow = !far && !l;
        im.receiveShadow = !far && l < 2;
        im.computeBoundingSphere();
        set.add(im);
      }
      lod.addLevel(set, far ? 0 : [0, 40, 86][l], 0.08);
    }
    group.add(lod);
    (far ? outer : lods).push(lod);
  }
  const nearbyTrees = trees.filter(t => !t.far);
  const driftMaterial = k.snow.clone();
  driftMaterial.color.multiply(new T.Color(.78, .83, .90));
  const drifts = new T.InstancedMesh(
    new T.SphereGeometry(1, 20, 7, 0, A, 0, Math.PI / 2),
    driftMaterial, nearbyTrees.length
  );
  nearbyTrees.forEach((tree, i) => {
    tr.position.set(tree.x + tree.h * .08, -.047, tree.z - tree.h * .04);
    tr.rotation.y = tree.y * .3;
    tr.scale.set(tree.h * .36, .08 + tree.h * .011, tree.h * .22);
    tr.updateMatrix();
    drifts.setMatrixAt(i, tr.matrix);
  });
  drifts.receiveShadow = true;
  drifts.computeBoundingSphere();
  group.add(drifts);
  const iron = k.metal(0x34484a),
    bronze = k.metal(0x9c7b52),
    warm = new T.MeshStandardMaterial({
      color: 0xffdaad,
      emissive: 0xffa24e,
      emissiveIntensity: 1.5,
      roughness: 0.42,
    }),
    snow = k.snow;
  const sphere = new T.SphereGeometry(1, 10, 7),
    pole = new T.CylinderGeometry(1, 1, 1, 8),
    lathe = (p, n = 12) =>
      new T.LatheGeometry(
        p.map((v) => new T.Vector2(...v)),
        n
      );
  function ball(p, x, y, z, a, b, c, m) {
    const o = mesh(p, sphere, m, x, y, z);
    o.scale.set(a, b, c);
    return o;
  }
  function rod(p, a, b, r, m) {
    const d = b.clone().sub(a),
      o = mesh(p, pole, m);
    o.position.copy(a).lerp(b, 0.5);
    o.scale.set(r, d.length(), r);
    o.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
    return o;
  }
  const column = lathe([
      [0.32, 0],
      [0.32, 0.11],
      [0.24, 0.22],
      [0.19, 0.29],
      [0.17, 0.39],
      [0.13, 0.51],
      [0.125, 0.73],
      [0.09, 0.85],
      [0.077, 2.82],
      [0.12, 2.9],
      [0.085, 3],
    ]),
    cap = lathe(
      [
        [0.03, 0],
        [0.41, 0],
        [0.41, 0.035],
        [0.34, 0.083],
        [0.24, 0.16],
        [0.14, 0.26],
        [0.09, 0.3],
      ],
      6
    ),
    foot = lathe(
      [
        [0.05, 0],
        [0.12, 0.045],
        [0.19, 0.071],
        [0.223, 0.13],
        [0.21, 0.16],
      ],
      6
    ),
    glass = new T.CylinderGeometry(0.336, 0.21, 0.57, 6);
  const haloData = new Uint8Array(48 * 48 * 4);
  for (let y = 0; y < 48; y++)
    for (let x = 0; x < 48; x++) {
      const off = (y * 48 + x) * 4,
        a = (x + 0.5) / 24 - 1,
        b = (y + 0.5) / 24 - 1;
      haloData.set([255, 255, 255, 255 * Math.max(0, Math.exp(-4 * (a * a + b * b)) - 0.019)], off);
    }
  const tex = new T.DataTexture(haloData, 48, 48);
  tex.magFilter = tex.minFilter = T.LinearFilter;
  tex.needsUpdate = true;
  const halo = new T.MeshBasicMaterial({
      color: 0xf5a654,
      map: tex,
      transparent: true,
      opacity: 0.27,
      depthWrite: false,
      blending: T.AdditiveBlending,
    }),
    floor = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const pool = (x, z, s) => mesh(group, floor, halo, x, 0.146, z).scale.set(s, 1, s);
  function lamp(x, z, small) {
    const g = new T.Group();
    g.position.set(x, 0, z);
    const s = small ? 0.84 : 1;
    g.scale.setScalar(s);
    group.add(g);
    mesh(g, column, iron).castShadow = true;
    for (const [y, r] of [
      [0.17, 0.285],
      [0.4, 0.18],
      [0.77, 0.14],
      [2.8, 0.11],
      [2.93, 0.135],
    ])
      mesh(g, pole, bronze, 0, y, 0).scale.set(r, 0.047, r);
    mesh(g, foot, bronze, 0, 2.97, 0);
    mesh(g, glass, warm, 0, 3.423, 0);
    for (let j = 0; j < 6; j++) {
      const a = (j * A) / 6;
      rod(
        g,
        V(Math.sin(a) * 0.218, 3.12, Math.cos(a) * 0.218),
        V(Math.sin(a) * 0.35, 3.72, Math.cos(a) * 0.35),
        0.023,
        iron
      );
    }
    mesh(g, cap, iron, 0, 3.73, 0);
    ball(g, 0, 3.91, 0, 0.239, 0.068, 0.239, snow);
    ball(g, 0, 4.06, 0, 0.062, 0.093, 0.062, bronze);
    mesh(g, new T.ConeGeometry(0.043, 0.175, 7), bronze, 0, 4.17, 0);
    colliders.push({ type: 'circle', x, z, r: 0.31 * s, maxY: 4.3 * s });
    pool(x, z, 7.6 * s);
    lamps.push([x, 3.44 * s, z, 1.95 * s]);
  }
  for (const [x, z] of [
    [-8.7, 52.7],
    [9.1, 52.7],
    [-10.7, 30.2],
    [10.7, 30.2],
    [-9.4, 8.5],
    [9.4, 8.5],
    [-10.1, -12.4],
    [10.1, -12.4],
    [-20.3, 36],
    [24.4, 32.5],
    [-32.8, 16.2],
    [36.4, 0.8],
    [52.4, 17.8],
    [-54.9, 20.5],
    [32.1, 58.6],
    [-32, 54.9],
    [60.6, 61.3],
    [-57.7, 61.8],
  ])
    lamp(x, z, Math.abs(x) > 15);
  const lanterns = lamps.slice();
  const localLights = lanterns.slice(0, 2).map(lamp => {
    const light = new T.PointLight(0xffab64, 64, 16, 2);
    light.position.set(lamp[0], lamp[1], lamp[2]);
    group.add(light);
    return light;
  });
  let lastLampUpdate = -1;
  const bollard = lathe(
    [
      [0.18, 0],
      [0.19, 0.1],
      [0.136, 0.17],
      [0.116, 0.56],
      [0.09, 0.65],
      [0.14, 0.69],
    ],
    10
  );
  for (const [x, z] of [
    [-7.8, 66.4],
    [7.8, 66.4],
    [-10, 42.2],
    [10, 42.2],
    [-10.1, 19.6],
    [10.1, 19.6],
    [-10.2, -1.8],
    [10.2, -1.8],
    [-26, 33.9],
    [27.2, 47.8],
    [35, 83.7],
  ]) {
    mesh(group, bollard, iron, x, 0, z);
    mesh(group, pole, warm, x, 0.77, z).scale.set(0.12, 0.19, 0.12);
    ball(group, x, 0.9, z, 0.155, 0.06, 0.155, bronze);
    ball(group, x, 0.948, z, 0.11, 0.047, 0.11, snow);
    lamps.push([x, 0.77, z, 0.87]);
    pool(x, z, 2.65);
    colliders.push({ type: 'circle', x, z, r: 0.18, maxY: 1 });
  }
  const g = new T.BufferGeometry();
  g.setAttribute(
    'position',
    new T.Float32BufferAttribute(
      lamps.flatMap((v) => v.slice(0, 3)),
      3
    )
  );
  g.setAttribute(
    'radius',
    new T.Float32BufferAttribute(
      lamps.map((v) => v[3]),
      1
    )
  );
  const glow = new T.Points(
    g,
    new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
      vertexShader:
        'attribute float radius;void main(){vec4 v=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*v;gl_PointSize=clamp(radius*435./max(1.,-v.z),2.,100.);}',
      fragmentShader:
        'void main(){vec2 d=gl_PointCoord*2.-1.;float r=dot(d,d);if(r>1.)discard;gl_FragColor=vec4(1.,.48,.15,.26*exp(-4.*r)+.19*exp(-31.*r));}',
    })
  );
  glow.renderOrder = 3;
  group.add(glow);
  for (const [ax, az, bx, bz, n] of [
    [-52, 49, -37, 48, 6],
    [-54, 43, -56, 37, 3],
    [61, 69, 58, 77, 4],
    [57, 79, 49, 81, 4],
    [-54, 78, -46, 83, 4],
  ]) {
    let prev;
    for (let i = 0; i <= n; i++) {
      const x = mix(ax, bx, i / n),
        z = mix(az, bz, i / n),
        p = V(x, 0.69, z);
      rod(group, V(x, 0, z), V(x, 0.85, z), 0.12, iron);
      ball(group, x, 0.87, z, 0.16, 0.095, 0.16, snow);
      if (prev) {
        rod(group, prev, p, 0.049, iron);
        rod(group, V(prev.x, 0.73, prev.z), V(x, 0.73, z), 0.032, snow);
        rod(group, V(prev.x, 0.37, prev.z), V(x, 0.37, z), 0.034, iron);
      }
      prev = p;
    }
    colliders.push({
      type: 'obb',
      x: (ax + bx) / 2,
      z: (az + bz) / 2,
      w: 0.35,
      d: Math.hypot(ax - bx, az - bz),
      rotation: Math.atan2(bx - ax, bz - az),
      maxY: 0.89,
    });
  }
  const fir = V(28.9, 0, 40.8),
    bauble = [k.glow(0xffce84, 1.3), k.glow(0xa1f3df, 1.18), k.glow(0xf18c9b, 0.97)];
  for (let i = 0; i < 93; i++) {
    const u = i / 93,
      a = u * A * 4.7,
      r = 2.68 * (1 - 0.91 * u);
    ball(
      group,
      fir.x + Math.cos(a) * r,
      1.49 + 6.29 * u,
      fir.z + Math.sin(a) * r,
      0.075,
      0.09,
      0.075,
      bauble[i % 3]
    );
  }
  const star = new T.Shape();
  for (let j = 0; j < 10; j++) {
    const a = Math.PI / 2 + (j * Math.PI) / 5,
      r = j % 2 ? 0.216 : 0.49;
    star[j ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
  }
  star.closePath();
  mesh(
    group,
    new T.ExtrudeGeometry(star, {
      depth: 0.09,
      bevelSize: 0.04,
      bevelThickness: 0.03,
      bevelSegments: 1,
    }),
    bauble[0],
    fir.x,
    8.45,
    fir.z
  );
  if (typeof document !== 'undefined')
    for (const [x, z, labels] of [
      [-10.7, 46.3, ['冰雪城堡', '冰雕艺廊']],
      [14.6, 25.1, ['雪花摩天轮', '冰雪小镇']],
      [-31.9, 19.8, ['超级冰滑梯']],
      [25.9, 64.3, ['冰上游乐场', '中心广场']],
    ]) {
      rod(group, V(x, 0, z), V(x, 2.95, z), 0.09, iron);
      ball(group, x, 2.97, z, 0.14, 0.07, 0.14, snow);
      labels.forEach((name, i) => {
        const c = document.createElement('canvas');
        c.width = 384;
        c.height = 86;
        const f = c.getContext('2d');
        f.fillStyle = '#294b50';
        f.fillRect(0, 0, 384, 86);
        f.strokeStyle = '#b9b08b';
        f.lineWidth = 5;
        f.strokeRect(4, 4, 376, 78);
        f.fillStyle = '#f1f1db';
        f.font = '600 44px "Microsoft YaHei",sans-serif';
        f.textAlign = 'center';
        f.fillText(name, 192, 60);
        const t = new T.CanvasTexture(c);
        t.colorSpace = T.SRGBColorSpace;
        mesh(group, new T.BoxGeometry(2.7, 0.54, 0.15), iron, x, 2.55 - i * 0.62, z);
        mesh(
          group,
          new T.PlaneGeometry(2.66, 0.52),
          new T.MeshBasicMaterial({ map: t }),
          x,
          2.55 - i * 0.62,
          z + 0.079
        );
      });
      colliders.push({ type: 'circle', x, z, r: 0.22, maxY: 3 });
    }
  return {
    group,
    colliders,
    update(t, eye) {
      if (!eye || t - lastLampUpdate < .25 || !localLights[0].visible) return;
      lastLampUpdate = t;
      let first = null, second = null, d1 = Infinity, d2 = Infinity;
      for (const lamp of lanterns) {
        const d = (lamp[0] - eye.x) ** 2 + (lamp[2] - eye.z) ** 2;
        if (d < d1) { second = first; d2 = d1; first = lamp; d1 = d; }
        else if (d < d2) { second = lamp; d2 = d; }
      }
      localLights[0].position.set(first[0], first[1], first[2]);
      localLights[1].position.set(second[0], second[1], second[2]);
    },
    setQuality(level) {
      for (const light of localLights) light.visible = level !== 'low';
      lastLampUpdate = -1;
      const dist = level === 'low' ? [16, 43] : level === 'medium' ? [33, 75] : [46, 100];
      for (const l of lods) {
        l.levels[1].distance = dist[0];
        l.levels[2].distance = dist[1];
      }
      for (const o of outer) o.visible = level !== 'low';
    },
  };
}
