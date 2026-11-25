'use strict';

function buildCastle(T, kit) {
  const group = new T.Group(),
    colliders = [],
    kitIce = kit.ice,
    pale = kitIce(0xc5e8f5),
    trim = kitIce(0x96cee5),
    dark = kitIce(0x517da7),
    blue = kitIce(0x71add5),
    purple = kitIce(0xa698cb),
    shade = new T.MeshStandardMaterial({ color: 0x193450, roughness: 0.28, metalness: 0.29 });
  const boxG = new T.BoxGeometry(1, 1, 1),
    rodG = new T.CylinderGeometry(1, 1, 1, 5),
    disc = new T.CircleGeometry(1, 32),
    ring = new T.TorusGeometry(1, 0.066, 6, 32),
    up = new T.Vector3(0, 1, 0),
    cache = new Map(),
    tex = new Uint8Array(48 * 64 * 4);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 48; x++) {
      let s = x / 47,
        t = y / 63,
        i = (48 * y + x) * 4,
        l =
          76 +
          81 * Math.sin(Math.PI * s) +
          44 * (1 - t) +
          19 * Math.sin(19 * s + 7 * t + Math.cos(8 * t)) ** 12 +
          17 * Math.sin(33 * s - 11 * t) ** 18;
      tex.set([l, l + 3, Math.min(255, l + 11), 255], i);
    }
  const texture = new T.DataTexture(tex, 48, 64);
  texture.minFilter = texture.magFilter = T.LinearFilter;
  texture.needsUpdate = true;
  const pane = (color) =>
    new T.MeshStandardMaterial({
      color,
      map: texture,
      emissive: color,
      emissiveMap: texture,
      emissiveIntensity: 1.15,
      metalness: 0.12,
      roughness: 0.2,
    });
  const W = { wall: blue, cap: kitIce(0x477cab), glass: pane(0x72d5f1), edge: kit.glow(0x9adff5, 1) },
    E = { wall: purple, cap: kitIce(0x746dae), glass: pane(0xd293df), edge: kit.glow(0xdca9e8, 0.95) },
    C = { wall: trim, cap: kitIce(0x6b91bc), glass: pane(0x98b6fa), edge: W.edge },
    warm = pane(0xffcf98);
  const m = (g, mat, x, y, z, w = 1, h = 1, d = 1, a = 0) => {
    const o = new T.Mesh(g, mat);
    o.position.set(x, y, z);
    o.rotation.y = a;
    o.scale.set(w, h, d);
    o.castShadow = !mat.emissiveMap;
    o.receiveShadow = true;
    group.add(o);
    return o;
  };
  const box = (mat, x, y, z, w, h, d, a = 0) => m(boxG, mat, x, y, z, w, h, d, a);
  const V = (...xyz) => new T.Vector3(...xyz);
  function bar(mat, a, b, r) {
    const d = V(...b).sub(V(...a)),
      len = d.length();
    if (len > 0.001) {
      const c = V(...a).lerp(V(...b), 0.5),
        o = m(rodG, mat, c.x, c.y, c.z, r, len, r);
      o.quaternion.setFromUnitVectors(up, d.normalize());
    }
  }
  function lathe(x, y, z, prof, n, mat) {
    const g = new T.LatheGeometry(
      prof.map(([r, h]) => new T.Vector2(r, h)),
      n
    ).toNonIndexed();
    g.computeVertexNormals();
    return m(g, mat, x, y, z, 1, 1, 1, -Math.PI / n);
  }
  function arch(w, h) {
    const a = w / 2,
      sy = h * 0.55,
      p = [
        [-a, 0],
        [-a, sy],
      ];
    for (let k = 1; k <= 7; k++) {
      const t = (k * Math.PI) / 21;
      p.push([a - 2 * a * Math.cos(t), sy + ((h - sy) * Math.sin(t)) / 0.8660254]);
    }
    for (let k = 6; k >= 0; k--) {
      const t = (k * Math.PI) / 21;
      p.push([-a + 2 * a * Math.cos(t), sy + ((h - sy) * Math.sin(t)) / 0.8660254]);
    }
    p.push([a, 0]);
    return p;
  }
  const shape = (pts) => new T.Shape(pts.map((p) => new T.Vector2(...p))),
    extr = (pts, d, b = 0) =>
      new T.ExtrudeGeometry(shape(pts), {
        depth: d,
        steps: 1,
        bevelEnabled: b > 0,
        bevelSize: b,
        bevelThickness: b,
        bevelSegments: 1,
      });
  function frame(s) {
    if (!cache.has(s))
      cache.set(s, extr(arch(1, 1).concat(arch(s, 0.65 + 0.35 * s).reverse()), 0.18, 0.006));
    return cache.get(s);
  }
  const glass = new T.ShapeGeometry(shape(arch(1, 1)));
  for (let i = 0; i < glass.attributes.uv.count; i++)
    glass.attributes.uv.setX(i, glass.attributes.uv.getX(i) + 0.5);
  function win(x, y, z, a, w, h, p, rich = false) {
    const ss = Math.sin(a),
      cc = Math.cos(a),
      at = (s, v, f) => [x + cc * s + ss * f, y + v, z - ss * s + cc * f];
    m(glass, shade, ...at(0, 0, 0.015), w, h, 1, a);
    m(glass, p.glass, ...at(0, 0.06, 0.05), w * 0.83, h * 0.927, 1, a);
    m(frame(0.83), p.wall, ...at(0, 0, 0.06), w, h, 0.42 + w * 0.19, a);
    box(trim, ...at(0, 0.06, 0.15), w * 1.09, 0.13, 0.35, a);
    bar(dark, at(0, 0.1, 0.13), at(0, h * 0.74, 0.13), Math.max(0.034, w * 0.019));
    if (rich) {
      for (const s of [-1, 1]) {
        bar(pale, at(0, h * 0.47, 0.14), at(s * w * 0.26, h * 0.76, 0.14), w * 0.017);
        bar(dark, at(s * w * 0.23, 0.14, 0.13), at(s * w * 0.23, h * 0.64, 0.13), w * 0.014);
      }
      m(ring, pale, ...at(0, h * 0.79, 0.14), w * 0.11, w * 0.115, w * 0.12, a);
      box(dark, ...at(0, h * 0.3, 0.135), w * 0.78, 0.057, 0.07, a);
    }
  }
  const block = (x, z, w, d, hi, lo = 0) =>
    colliders.push({ type: 'box', x, z, w, d, minY: lo, maxY: hi });
  function tower(x, z, r, h, sp, n, p, y = 0, rich = false) {
    const small = r < 2;
    lathe(
      x,
      y,
      z,
      [
        [r * 1.16, 0],
        [r * 1.16, 0.32],
        [r * 1.08, 0.56],
        [r * 1.08, 0.82],
        [r, 1.12],
        [r * 0.967, h * 0.42],
        [r * 0.912, h],
      ],
      n,
      p.wall
    );
    const band = (b, rad, th, mat) =>
      lathe(
        x,
        y + b,
        z,
        [
          [rad * 0.985, 0],
          [rad * 1.05, th * 0.25],
          [rad * 1.05, th * 0.74],
          [rad, th],
        ],
        n,
        mat
      );
    for (const f of [0.2, 0.4, 0.66])
      band(h * f, r * (1 - f * 0.09), small ? 0.13 : 0.24, f === 0.4 ? trim : p.wall);
    for (let i = 0; i < n; i++) {
      const a = (i * 2 * Math.PI) / n,
        s = Math.sin(a),
        c = Math.cos(a),
        r1 = r * 0.963 * Math.cos(Math.PI / n);
      if (c > -0.08 || rich)
        win(
          x + s * r1,
          y + h * 0.46,
          z + c * r1,
          a,
          2 * r * Math.sin(Math.PI / n) * 0.7,
          h * 0.435,
          p,
          rich && c > -0.1
        );
      if (!small && c >= 0) {
        const rr = r * 0.996 * Math.cos(Math.PI / n);
        win(x + s * rr, y + h * 0.11, z + c * rr, a, 2 * r * Math.sin(Math.PI / n) * 0.47, h * 0.233, p);
      }
      const b = a - Math.PI / n,
        ss = Math.sin(b),
        cc = Math.cos(b);
      if (!small)
        bar(
          trim,
          [x + ss * r, y + 1, z + cc * r],
          [x + ss * r * 0.915, y + h, z + cc * r * 0.915],
          r * 0.045
        );
      box(
        trim,
        x + ss * r * 0.947,
        y + h - 0.08,
        z + cc * r * 0.947,
        r * 0.17,
        small ? 0.45 : 0.88,
        r * 0.17,
        b
      );
    }
    band(h - 0.16, r * 0.985, small ? 0.51 : 0.87, pale);
    const ry = y + h + (small ? 0.28 : 0.51),
      prof = [
        [0.9, 0],
        [1.085, 0.045],
        [1.07, 0.073],
        [0.85, 0.17],
        [0.62, 0.35],
        [0.35, 0.59],
        [0.17, 0.81],
        [0.016, 1],
      ];
    lathe(
      x,
      ry,
      z,
      prof.map(([s, h]) => [s * r, h * sp]),
      n,
      p.cap
    );
    for (let i = 0; i < n; i++) {
      const a = ((i - 0.5) * 2 * Math.PI) / n,
        s = Math.sin(a),
        c = Math.cos(a);
      for (let j = 2; j < prof.length - 1; j++) {
        const [r1, y1] = prof[j],
          [r2, y2] = prof[j + 1];
        bar(
          i % 3 === 0 ? pale : trim,
          [x + s * r * r1, ry + y1 * sp, z + c * r * r1],
          [x + s * r * r2, ry + y2 * sp, z + c * r * r2],
          Math.max(0.018, r * 0.018 * (1 - y1))
        );
      }
    }
    if (rich)
      lathe(
        x,
        ry + sp * 0.59,
        z,
        [
          [r * 0.35, 0],
          [r * 0.37, 0.08],
          [r * 0.35, 0.18],
        ],
        n,
        pale
      );
    lathe(
      x,
      ry + sp - 0.1,
      z,
      [
        [r * 0.035, 0],
        [r * 0.073, 0.22],
        [r * 0.072, 0.3],
        [0.01, Math.min(1.23, sp * 0.1)],
      ],
      6,
      p.edge
    );
    if (y === 0) colliders.push({ type: 'circle', x, z, r: r * 1.07, maxY: h + sp });
  }
  function roof(x, z, w, d, y, top, p) {
    const g = extr(
      [
        [-d * 0.5, 0],
        [d * 0.5, 0],
        [0, top - y],
      ],
      w
    );
    m(g, p.cap, x - w / 2, y, z, 1, 1, 1, Math.PI / 2);
    for (const s of [-1, 1]) {
      box(pale, x, y + 0.05, z + s * d * 0.5, w + 0.18, 0.15, 0.23);
      for (let i = -2; i <= 2; i++)
        bar(trim, [x + (i * w) / 6, y + 0.03, z + (s * d) / 2], [x + (i * w) / 6, top + 0.03, z], 0.057);
    }
    bar(pale, [x - w / 2, top, z], [x + w / 2, top, z], 0.14);
  }
  function rose(x, y, z, r, p) {
    m(disc, shade, x, y, z, r * 1.14, r * 1.14);
    m(disc, p.glass, x, y, z + 0.04, r, r);
    m(ring, dark, x, y, z + 0.09, r * 1.1, r * 1.1, r * 1.25);
    m(ring, pale, x, y, z + 0.14, r, r, r);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        s = Math.sin(a),
        c = Math.cos(a);
      m(ring, trim, x + s * r * 0.61, y + c * r * 0.61, z + 0.17, r * 0.275, r * 0.275, r * 0.55);
      bar(
        pale,
        [x + s * r * 0.2, y + c * r * 0.2, z + 0.145],
        [x + s * r * 0.38, y + c * r * 0.38, z + 0.145],
        r * 0.027
      );
    }
    m(ring, pale, x, y, z + 0.21, r * 0.26, r * 0.26, r * 0.5);
    m(disc, warm, x, y, z + 0.12, r * 0.21, r * 0.21);
  }
  function entry(z, w, side, top, depth, aw, ah, r, p) {
    m(
      extr(
        [[-w / 2, 0], ...arch(aw, ah), [w / 2, 0], [w / 2, side], [0, top], [-w / 2, side]],
        depth,
        0.05
      ),
      p.wall,
      0,
      0,
      z - depth
    );
    m(frame(0.78), dark, 0, 0, z + 0.03, aw * 1.18, ah * 1.12, 1.5);
    m(frame(0.89), pale, 0, 0, z + 0.3, aw * 1.11, ah * 1.067, 1.56);
    m(frame(0.94), p.wall, 0, 0, z + 0.58, aw * 1.03, ah * 1.021, 1.3);
    m(frame(0.96), p.edge, 0, 0, z + 0.82, aw * 0.986, ah, 0.52);
    const bw = (w - aw) / 2;
    for (const s of [-1, 1]) {
      block(s * (aw / 2 + bw / 2), z - depth / 2, bw, depth, side);
      const x = s * aw * 0.55;
      box(p.wall, x, 0.55, z + 0.7, aw * 0.17, 1.1, 1.55);
      box(pale, x, 1.13, z + 0.73, aw * 0.18, 0.16, 1.61);
      lathe(
        x,
        1.16,
        z + 0.68,
        [
          [0.37, 0],
          [0.38, 0.2],
          [0.29, 0.37],
          [0.24, ah * 0.45],
          [0.4, ah * 0.47],
        ],
        8,
        pale
      );
      bar(dark, [(s * w) / 2, side, z + 0.1], [0, top, z + 0.1], 0.31);
      bar(pale, [(s * w) / 2, side + 0.14, z + 0.23], [0, top + 0.15, z + 0.23], 0.14);
      for (let i = 1; i < 5; i++) {
        const t = i / 5;
        lathe(
          (s * w * (1 - t)) / 2,
          side + (top - side) * t,
          z + 0.15,
          [
            [0.1, 0],
            [0.22, 0.21],
            [0.005, 0.82 + t * 0.3],
          ],
          5,
          pale
        );
      }
      win(s * w * 0.35, ah * 0.48, z + 0.04, 0, 1.35, ah * 0.48, s < 0 ? W : E);
    }
    block(0, z - depth / 2, aw, depth, top, ah * 0.83);
    rose(0, ah + 0.58 * (top - ah), z + 0.2, r, p);
    lathe(
      0,
      top - 0.05,
      z + 0.14,
      [
        [0.18, 0],
        [0.37, 0.38],
        [0.005, 2],
      ],
      6,
      pale
    );
  }
  for (const s of [-1, 1]) {
    const x = s * 20,
      p = s < 0 ? W : E,
      z = 3,
      front = 8.65;
    box(dark, x, 0.36, z, 20.6, 0.72, 11.7);
    box(p.wall, x, 4.4, z, 19.9, 8.8, 11.3);
    box(trim, x, 1.02, z, 20.2, 0.35, 11.55);
    box(pale, x, 8.65, z, 20.45, 0.24, 11.83);
    block(x, z, 20.15, 11.55, 8.9);
    roof(x, z, 20.4, 11.85, 8.8, 13.66, p);
    for (let i = -2; i <= 2; i++) {
      const u = x + 3.84 * i;
      win(u, 1.58, front + 0.04, 0, 2.63, 6.16, p, true);
      win(u, 1.8, -2.69, Math.PI, 2.35, 5.62, p);
      if (i < 2) {
        const k = u + 1.93;
        box(p.wall, k, 3.19, front + 0.35, 0.83, 6.4, 1.42);
        box(pale, k, 6.44, front + 0.32, 0.99, 0.2, 1.52);
        lathe(
          k,
          6.5,
          front + 0.25,
          [
            [0.44, 0],
            [0.43, 1.3],
            [0.53, 1.43],
            [0.33, 1.62],
            [0.014, 3.56],
          ],
          4,
          p.wall
        );
      }
      if (i % 2 === 0) {
        m(
          extr(
            [
              [-1.07, 0],
              [1.07, 0],
              [1.07, 1.05],
              [0, 3.34],
              [-1.07, 1.05],
            ],
            1,
            0.035
          ),
          p.wall,
          u,
          9.22,
          front - 1.87
        );
        win(u, 9.44, front - 0.84, 0, 1.41, 2.42, p);
      }
    }
    for (let i = 0; i < 3; i++) {
      const zz = -1.5 + 4.35 * i;
      m(frame(0.82), p.wall, s * 7.08, 0, zz, 4.56, 6.33, 1.8, (s * Math.PI) / 2);
      m(frame(0.93), pale, s * 7.37, 0, zz, 4.45, 6.2, 0.82, (s * Math.PI) / 2);
    }
    box(trim, s * 7.08, 6.42, 2.85, 0.74, 0.42, 13.42);
    box(kit.snow, s * 7.08, 6.68, 2.85, 0.89, 0.13, 13.56);
    box(C.wall, s * 7.1, 6.15, -10.7, 0.89, 12.3, 14.7);
    block(s * 7.1, -10.7, 0.89, 14.7, 12.3);
    for (let i = 0; i < 3; i++)
      win(s * 7.57, 2.5, -15.1 + 4.5 * i, (s * Math.PI) / 2, 2.5, 7.7, p, true);
  }
  entry(12.04, 15.66, 10.74, 20.76, 2.83, 7.28, 10.63, 2.03, C);
  entry(-3.31, 15.12, 12.23, 17.93, 1.29, 6.48, 9.09, 1.53, C);
  box(dark, 0, 6.22, -18.14, 15.2, 12.5, 0.85);
  block(0, -18.14, 15.2, 0.85, 12.5);
  for (const x of [-4, 0, 4])
    win(x, 2, -17.69, 0, x ? 2.2 : 3, x ? 7.6 : 9, x ? C : { ...C, glass: warm }, true);
  roof(0, -10.7, 15.4, 15.2, 12.32, 18.88, C);
  tower(0, -10, 5.42, 21.6, 16.2, 8, C, 14, true);
  tower(-14.45, -7.35, 4, 24.35, 14.2, 8, W, 0, true);
  tower(14.85, -8.55, 4.17, 25.45, 14.9, 8, E, 0, true);
  tower(-24.58, -4.3, 3.13, 18.7, 10.2, 6, C);
  tower(24.38, -5.12, 3.04, 18.1, 10.8, 8, E);
  tower(-9.12, 10.4, 2.87, 15.25, 8.95, 8, W);
  tower(9.16, 10.2, 2.94, 15.85, 9.46, 8, E);
  tower(-30.9, 5.25, 3.32, 12.18, 8.48, 8, W);
  tower(30.82, 5.02, 3.4, 13.52, 8.2, 8, E);
  for (const s of [-1, 1]) {
    const p = s < 0 ? W : E;
    for (const f of [-1, 1])
      tower(s * 4.68, -10 + f * 3.32, 1.42, 11.85 + (f < 0 ? 1.35 : 0), 6.86, 6, p, 17.65);
    tower(s * 6.63, -2.64, 1.22, 9.25, 5.35, 6, p, 9.55);
    box(p.wall, s * 16.8, 4.1, -4.15, 10.35, 8.2, 5.95);
    block(s * 16.8, -4.15, 10.35, 5.95, 8.2);
    bar(trim, [s * 10.83, 13.5, -4.75], [s * 4.34, 23.7, -8.92], 0.47);
    bar(pale, [s * 10.83, 14, -4.75], [s * 4.34, 24.2, -8.92], 0.19);
  }
  return {
    group,
    colliders,
    update(t) {
      W.glass.emissiveIntensity = 1.23 + 0.2 * Math.sin(t * 0.25);
      E.glass.emissiveIntensity = 1.22 + 0.23 * Math.sin(t * 0.23 + 0.7);
      C.glass.emissiveIntensity = 1.32 + 0.18 * Math.sin(t * 0.21 + 2.3);
    },
  };
}
