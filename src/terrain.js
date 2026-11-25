'use strict';

function ground(T, renderer, scene, camera, kit) {
  const base = new T.Group(),
    surfaces = new T.Group();
  base.add(surfaces);
  scene.add(base);
  let seed = 9413;
  const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296,
    V = (x, y, z) => new T.Vector3(x, y, z);
  const map = kit.snowMap.clone();
  map.repeat.set(90, 90);
  map.needsUpdate = true;
  const gm = kit.snow.clone();
  gm.map = map;
  gm.normalMap = kit.normal.clone();
  gm.normalMap.repeat.set(80, 80);
  gm.normalMap.needsUpdate = true;
  gm.vertexColors = true;
  const field = new T.PlaneGeometry(470, 470, 96, 96).rotateX(-Math.PI / 2),
    a = field.attributes.position,
    col = new Float32Array(a.count * 3);
  for (let i = 0; i < a.count; i++) {
    const x = a.getX(i),
      z = a.getZ(i),
      border = Math.max(Math.abs(x) - 83, Math.abs(z - 9) - 89, 0),
      t = Math.min(1, border / 25);
    a.setY(
      i,
      -0.035 +
        t * (1.5 + 1.16 * Math.sin(x * 0.136 + z * 0.067) + 0.86 * Math.cos(z * 0.179 - x * 0.037))
    );
    const shade = 0.86 + 0.055 * Math.sin(x * 0.086 + Math.cos(z * 0.123)) + 0.045 * rnd();
    col.set([shade * 0.9, shade * 0.96, Math.min(1, shade * 1.06)], 3 * i);
  }
  field.setAttribute('color', new T.BufferAttribute(col, 3));
  field.computeVertexNormals();
  const terrain = new T.Mesh(field, gm);
  terrain.receiveShadow = true;
  surfaces.add(terrain);
  const cv = document.createElement('canvas');
  cv.width = cv.height = 512;
  const c = cv.getContext('2d');
  c.fillStyle = '#acc4d2';
  c.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 8; row++)
    for (let j = -1; j < 5; j++) {
      const x = j * 128 + (row % 2) * 64,
        y = row * 64,
        n = Math.round(rnd() * 13);
      c.fillStyle = `rgb(${148 + n},${177 + n},${194 + n})`;
      c.fillRect(x + 1, y + 1, 126.5, 62.5);
      c.fillStyle = 'rgba(231,248,255,.39)';
      c.fillRect(x + 1, y + 1, 125, 1);
      c.fillStyle = 'rgba(64,100,119,.39)';
      c.fillRect(x + 126, y + 3, 1, 61);
    }
  for (let j = 0; j < 2100; j++) {
    const x = rnd() * 512,
      y = rnd() * 512,
      l = 0.5 + rnd() ** 6 * 49;
    c.strokeStyle = 'rgba(222,248,255,' + (0.048 + rnd() * 0.23) + ')';
    c.lineWidth = 0.35 + rnd() * 0.6;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + l * 0.66, y + l * 0.39);
    c.lineTo(x + l, y + l * 0.46);
    c.stroke();
  }
  const tex = new T.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const rt = new T.WebGLRenderTarget(640, 360, {
    type: T.UnsignedByteType,
    minFilter: T.LinearFilter,
    magFilter: T.LinearFilter,
  });
  const mirror = new T.PerspectiveCamera(),
    matrix = new T.Matrix4(),
    enable = { value: 1 };
  function makeRoad(materialColor, gloss, pattern = true) {
    const m = new T.MeshPhysicalMaterial({
      color: materialColor,
      map: pattern ? tex : null,
      roughness: pattern ? 0.235 : 0.125,
      metalness: pattern ? 0.21 : 0.15,
      clearcoat: 0.75,
      clearcoatRoughness: 0.18,
      envMapIntensity: 0.64,
      normalMap: kit.normal,
      normalScale: new T.Vector2(0.12, 0.12),
    });
    m.onBeforeCompile = (s) => {
      s.uniforms.rTex = { value: rt.texture };
      s.uniforms.rMat = { value: matrix };
      s.uniforms.rEnabled = enable;
      s.uniforms.rGloss = { value: gloss };
      s.vertexShader =
        'varying vec4 projIce;varying vec3 worldIce;uniform mat4 rMat;\n' +
        s.vertexShader.replace(
          '#include <project_vertex>',
          '#include <project_vertex>\nworldIce=(modelMatrix*vec4(transformed,1.)).xyz;projIce=rMat*vec4(worldIce,1.);'
        );
      s.fragmentShader =
        'varying vec4 projIce;varying vec3 worldIce;uniform sampler2D rTex;uniform float rEnabled,rGloss;\n' +
        s.fragmentShader.replace(
          '#include <opaque_fragment>',
          `if (rEnabled>.5) {
 vec2 reflUV=projIce.xy/max(.001,projIce.w);
 float frost=.5+.5*sin(worldIce.x*.65+sin(worldIce.z*.42)*2.7)*cos(worldIce.z*.31+worldIce.x*.34);
 vec2 grains=vec2(sin(worldIce.x*4.7+worldIce.z*.81),cos(worldIce.z*3.6+worldIce.x*.59))*(.00016+.00053*frost);
 float grazing=1.-clamp(normalize(cameraPosition-worldIce).y,0.,1.);
 vec2 uv=clamp(reflUV+grains,vec2(.003),vec2(.997)), spread=vec2(.00072,.00175)*(.6+frost);
 vec3 refl=.44*texture2D(rTex,uv).rgb+.18*(texture2D(rTex,uv+spread).rgb+texture2D(rTex,uv-spread).rgb)
          +.10*(texture2D(rTex,uv+vec2(spread.x,-spread.y)).rgb+texture2D(rTex,uv+vec2(-spread.x,spread.y)).rgb);
 float inside=step(0.,reflUV.x)*step(reflUV.x,1.)*step(0.,reflUV.y)*step(reflUV.y,1.);
 outgoingLight=mix(outgoingLight,refl*vec3(.84,.95,1.05)+diffuseColor.rgb*.023,inside*rGloss*(.27+.65*grazing)*(1.-.28*frost));
 }
 #include <opaque_fragment>`
        );
    };
    m.customProgramCacheKey = () => 'mirror-floe-5';
    return m;
  }
  const road = makeRoad(0x7c9eaf, 0.77),
    rink = makeRoad(0x94c0d0, 0.87, false),
    side = makeRoad(0xa8bac9, 0.57),
    trim = kColor(0x9caeb5),
    brass = kColor(0x957d5c);
  function kColor(cc) {
    return new T.MeshStandardMaterial({ color: cc, roughness: 0.52, metalness: 0.39 });
  }
  function geometry(ps, id, uvs) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(ps, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
    g.setIndex(id);
    g.computeVertexNormals();
    return g;
  }
  function strip(points, width, mat, y = 0.052) {
    const ps = [],
      uvs = [],
      idx = [],
      curve = new T.CatmullRomCurve3(points.map(([x, z]) => V(x, y, z)));
    const n = Math.max(8, points.length * 9);
    for (let i = 0; i <= n; i++) {
      const t = i / n,
        p = curve.getPointAt(t),
        dir = curve.getTangentAt(t),
        w = typeof width === 'function' ? width(t) : width;
      for (const s of [-1, 1]) {
        const x = p.x - dir.z * s * w * 0.5,
          z = p.z + dir.x * s * w * 0.5;
        ps.push(x, y, z);
        uvs.push(x / 8, z / 8);
      }
      if (i < n) {
        const j = 2 * i;
        idx.push(j, j + 1, j + 2, j + 1, j + 3, j + 2);
      }
    }
    const o = new T.Mesh(geometry(ps, idx, uvs), mat);
    o.receiveShadow = true;
    surfaces.add(o);
    return o;
  }
  strip(
    [
      [0, 94],
      [0, 71],
      [0, 44],
      [0.2, 17],
      [0, -3],
      [0, -34],
    ],
    (t) => 15.1 + 3.3 * Math.sin(t * Math.PI),
    road,
    0.075
  );
  for (const s of [-1, 1]) {
    strip(
      [
        [s * 7.8, 93],
        [s * 8.05, 68],
        [s * 8.9, 43],
        [s * 9.14, 16],
        [s * 8.5, -5],
        [s * 7.65, -31],
      ],
      0.25,
      trim,
      0.087
    );
    strip(
      [
        [s * 7.52, 93],
        [s * 7.77, 68],
        [s * 8.62, 43],
        [s * 8.87, 16],
        [s * 8.23, -5],
        [s * 7.37, -31],
      ],
      0.052,
      brass,
      0.092
    );
  }
  for (const pts of [
    [
      [0, 57],
      [-16, 52],
      [-29, 43],
      [-40, 34],
      [-45, 22],
      [-46, 18],
    ],
    [
      [0, 54],
      [16, 50],
      [25, 43],
      [30, 31],
      [41, 13],
      [49, -10],
      [51, -14],
    ],
    [
      [0, 80],
      [-18, 78],
      [-34, 70],
      [-45, 70],
    ],
    [
      [0, 80],
      [16, 78],
      [28, 70],
      [39, 70],
    ],
    [
      [0, -4],
      [-20, -3],
      [-37, 5],
      [-43, 17],
    ],
    [
      [0, -4],
      [19, -7],
      [37, -11],
      [49, -13],
    ],
  ])
    strip(pts, 4.4, side, 0.046);
  function disk(x, z, rx, rz, y, m) {
    const g = new T.CircleGeometry(1, 96).rotateX(-Math.PI / 2),
      pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const xx = pos.getX(i) * rx + x,
        zz = pos.getZ(i) * rz + z;
      pos.setXYZ(i, xx, y, zz);
      g.attributes.uv.setXY(i, xx / 8, zz / 8);
    }
    const o = new T.Mesh(g, m);
    o.receiveShadow = true;
    surfaces.add(o);
    return o;
  }
  disk(-1, 10, 20, 14, 0.081, side);
  disk(43, 70, 15.15, 10.12, 0.09, rink);
  const ringMat = new T.MeshStandardMaterial({ color: 0xc2cfd2, metalness: 0.5, roughness: 0.37 });
  function ring(x, z, r, th, ratio, y) {
    const c = new T.Mesh(new T.RingGeometry(r - th, r + th, 96).rotateX(-Math.PI / 2), ringMat);
    c.scale.z = ratio;
    c.position.set(x, y, z);
    surfaces.add(c);
  }
  ring(-1, 10, 18.7, 0.1, 0.69, 0.094);
  ring(-1, 10, 17.8, 0.045, 0.69, 0.095);
  ring(43, 70, 14.55, 0.055, 0.658, 0.098);
  const beamGeo = new T.CylinderGeometry(1, 0.12, 1, 22, 1, true),
    beamMat = new T.ShaderMaterial({
      transparent: true,
      blending: T.AdditiveBlending,
      side: T.DoubleSide,
      depthWrite: false,
      uniforms: { t: kit.clock, fun: kit.festival },
      vertexShader:
        'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:
        'varying vec2 v;uniform float t,fun;void main(){float fade=pow(max(0.,1.-v.y),1.8);vec3 c=mix(vec3(.31,.56,.97),vec3(.82,.37,.85),smoothstep(.2,.8,sin(t*.23+v.x)));gl_FragColor=vec4(c,(.035+.044*fun)*fade);}',
    });
  for (const [x, z, h, rot] of [
    [-21, -34, 23, 0.18],
    [18, -35, 27, -0.17],
    [-10, -32, 21, -0.15],
    [10, -33, 20, 0.13],
    [-12, 9, 12, -0.13],
  ]) {
    const b = new T.Mesh(beamGeo, beamMat);
    b.scale.set(2.5, h, 2.5);
    b.rotation.z = rot;
    b.position.set(x - Math.sin(rot) * h * 0.5, 0.15 + h * 0.5, z);
    b.renderOrder = 1;
    scene.add(b);
  }
  const look = V(0, 0, 0),
    up = V(0, 0, 0),
    bias = new T.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  return {
    road,
    rt,
    resize(w, h, level) {
      enable.value = level === 'low' ? 0 : 1;
      const f = level === 'high' ? 0.52 : 0.37;
      rt.setSize(Math.max(64, (w * f) | 0), Math.max(48, (h * f) | 0));
    },
    reflect(hide) {
      if (!enable.value) return;
      mirror.copy(camera, false);
      const water = 0.07;
      mirror.position.y = 2 * water - camera.position.y;
      camera.getWorldDirection(look);
      look.y *= -1;
      look.add(mirror.position);
      up.set(0, 1, 0).applyQuaternion(camera.quaternion);
      up.y *= -1;
      mirror.up.copy(up);
      mirror.lookAt(look);
      mirror.updateMatrixWorld();
      matrix.copy(bias).multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse);
      surfaces.visible = false;
      const prev = hide.map((o) => o.visible);
      hide.forEach((o) => (o.visible = false));
      const shadow = renderer.shadowMap.autoUpdate;
      renderer.shadowMap.autoUpdate = false;
      renderer.setRenderTarget(rt);
      renderer.render(scene, mirror);
      renderer.shadowMap.autoUpdate = shadow;
      surfaces.visible = true;
      hide.forEach((o, i) => (o.visible = prev[i]));
      renderer.setRenderTarget(null);
    },
  };
}
