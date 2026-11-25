'use strict';
function makeKit(T, renderer, scene) {
  const cache = new Map(),
    mcache = new Map(),
    gcache = new Map(),
    clock = { value: 0 },
    festival = { value: 0 },
    nightLight = { value: 1 };
  let seed = 709;
  const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const canvas = (w, h = w) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  };
  const grain = canvas(256),
    f = grain.getContext('2d'),
    img = f.createImageData(256, 256),
    cells = Array.from({ length: 64 }, () => [rnd(), rnd()]);
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 256; x++) {
      const u = x / 32,
        v = y / 32,
        k = (y * 256 + x) * 4;
      let a = 100,
        b = 100,
        dx = 0,
        dy = 0;
      for (let z = -1; z <= 1; z++)
        for (let i = -1; i <= 1; i++) {
          const xx = Math.floor(u) + i,
            yy = Math.floor(v) + z,
            c = cells[((yy + 8) % 8) * 8 + ((xx + 8) % 8)],
            p = xx + c[0] - u,
            q = yy + c[1] - v,
            d = p * p + q * q;
          if (d < a) {
            b = a;
            a = d;
            dx = p;
            dy = q;
          } else if (d < b) b = d;
        }
      const e = Math.exp(-20 * (b - a)),
        n = rnd() - 0.5;
      img.data.set([128 + dx * 66 * e + n * 19, 128 + dy * 66 * e + n * 19, 249, 255], k);
    }
  f.putImageData(img, 0, 0);
  const norm = new T.CanvasTexture(grain);
  norm.wrapS = norm.wrapT = T.RepeatWrapping;
  const sf = canvas(256),
    s = sf.getContext('2d');
  s.fillStyle = '#e5f0f7';
  s.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 36000; i++) {
    s.fillStyle = rnd() > 0.4 ? '#ffffff50' : '#7093a523';
    s.fillRect(rnd() * 256, rnd() * 256, rnd() * 2 + 0.4, rnd() + 0.3);
  }
  const snowMap = new T.CanvasTexture(sf);
  snowMap.colorSpace = T.SRGBColorSpace;
  snowMap.wrapS = snowMap.wrapT = T.RepeatWrapping;
  const snow = new T.MeshStandardMaterial({
    color: 0xeaf6ff,
    map: snowMap,
    normalMap: norm,
    normalScale: new T.Vector2(0.12, 0.12),
    roughness: 0.81,
    metalness: 0.025,
  });
  const env = canvas(512, 256),
    e = env.getContext('2d'),
    gr = e.createLinearGradient(0, 0, 0, 256);
  for (const [p, color] of [
    [0, '#101b38'],
    [0.32, '#344872'],
    [0.48, '#929faa'],
    [0.57, '#374767'],
    [1, '#1d2940'],
  ])
    gr.addColorStop(p, color);
  e.fillStyle = gr;
  e.fillRect(0, 0, 512, 256);
  for (const [x, w, h, c] of [
    [40, 37, 58, '#afdbe4'],
    [118, 13, 47, '#c7f8ff'],
    [205, 27, 56, '#cebddd'],
    [353, 48, 83, '#edf8ff'],
    [461, 16, 54, '#9eb3ef'],
    [280, 18, 13, '#e8ae72'],
    [153, 21, 16, '#75c7e3'],
  ]) {
    e.fillStyle = c;
    e.fillRect(x, 120 - h / 2, w, h);
  }
  const et = new T.CanvasTexture(env);
  et.mapping = T.EquirectangularReflectionMapping;
  et.colorSpace = T.SRGBColorSpace;
  const pm = new T.PMREMGenerator(renderer),
    filtered = pm.fromEquirectangular(et);
  scene.environment = filtered.texture;
  pm.dispose();
  et.dispose();
  // A tile of trapped air, fracture fans and cloudy laminae, packed into independent channels.
  // It is sampled twice at different optical depths, so inclusions move behind the polished face.
  function makeInclusions() {
    const size = 512, tile = canvas(size), ctx = tile.getContext('2d');
    const pixels = ctx.createImageData(size, size);
    const field = Array.from({ length: 1024 }, rnd);
    function noise(x, y) {
      const ix = Math.floor(x), iy = Math.floor(y);
      let u = x - ix, v = y - iy; u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
      const at = (a, b) => field[(a & 31) + 32 * (b & 31)];
      return (at(ix, iy) * (1 - u) + at(ix + 1, iy) * u) * (1 - v) +
        (at(ix, iy + 1) * (1 - u) + at(ix + 1, iy + 1) * u) * v;
    }
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size, tilt = Math.sin(2 * Math.PI * (u + v)) * 2.4;
      const sheet = noise(32 * u + tilt, 32 * v - tilt * .4);
      const band = .5 + .5 * Math.sin(2 * Math.PI * (3 * v - u + .2 * Math.sin(2 * Math.PI * u)) + sheet * 2.8);
      const k = 4 * (size * y + x);
      pixels.data[k + 2] = (band ** 5 * .59 + sheet * .22 + .095 * rnd()) * 225;
      pixels.data[k + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = ctx.lineCap = 'round';
    const drawWrapped = draw => {
      for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
        ctx.setTransform(1, 0, 0, 1, ox, oy); draw();
      }
      ctx.resetTransform();
    };
    function fracture(x, y, angle, length, strength, branch) {
      const path = new Path2D(); path.moveTo(x, y);
      const count = 4 + Math.floor(rnd() * 5);
      for (let i = 0; i < count; i++) {
        angle += (rnd() - .5) * .58;
        x += Math.cos(angle) * length / count; y += Math.sin(angle) * length / count;
        path.lineTo(x, y);
        if (branch && (i === 1 || i === count - 3)) fracture(x, y, angle + (i === 1 ? 1 : -1) * (.35 + .5 * rnd()), length * (.24 + .18 * rnd()), strength * .55, false);
      }
      ctx.strokeStyle = 'rgba(240,0,0,' + strength + ')';
      ctx.lineWidth = branch ? 1.25 : .72;
      drawWrapped(() => ctx.stroke(path));
    }
    for (let i = 0; i < 21; i++) {
      const x = rnd() * size, y = rnd() * size, angle = rnd() * Math.PI * 2;
      fracture(x, y, angle, 34 + 110 * rnd(), .38 + .5 * rnd(), true);
      if (i % 3 === 0) fracture(x, y, angle + 2.5, 18 + 62 * rnd(), .54, true);
    }
    for (let i = 0; i < 38; i++) {
      const x = size * rnd(), y = size * rnd();
      for (let j = 0; j < 15; j++) {
        const radius = .55 + 1.45 * rnd() ** 2, px = (x + rnd() * 16) % size, py = (y + j * (2 + rnd())) % size;
        ctx.fillStyle = 'rgba(0,226,0,' + (.27 + .6 * rnd()) + ')';
        ctx.beginPath(); ctx.ellipse(px, py, radius, radius * (.85 + rnd()), 0, 0, 2 * Math.PI); ctx.fill();
      }
    }
    const map = new T.CanvasTexture(tile);
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    return map;
  }
  const inclusions = makeInclusions();
  function ice(color = 0x92deed, opts = {}) {
    if (!opts || typeof opts !== 'object') opts = {};
    const k = String(color) + JSON.stringify(opts);
    if (cache.has(k)) return cache.get(k);
    const tint = new T.Color(color),
      mat = new T.MeshPhysicalMaterial({
        color: tint.clone().lerp(new T.Color(0xbddcf0), 0.055).multiplyScalar(0.62),
        emissive: tint,
        emissiveIntensity: opts.emissiveIntensity ?? 0.085,
        roughness: opts.roughness ?? 0.205,
        metalness: opts.metalness ?? 0.025,
        clearcoat: 0.61,
        clearcoatRoughness: 0.16,
        envMapIntensity: 0.95,
        transmission: opts.transmission ?? 0.40,
        ior: 1.31,
        thickness: opts.thickness ?? 1.5,
        attenuationDistance: 3.55,
        attenuationColor: tint.clone().lerp(new T.Color(0xffffff), 0.5),
        normalMap: norm,
        normalScale: new T.Vector2(0.19, 0.19),
        transparent: opts.transparent ?? false,
        opacity: opts.opacity ?? 1,
      });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uClock = clock;
      shader.uniforms.uFest = festival;
      shader.uniforms.iceLayers = { value: inclusions };
      shader.uniforms.uNight = nightLight;
      shader.vertexShader =
        'varying vec3 icePos;\n' +
        shader.vertexShader.replace(
          '#include <project_vertex>',
          `#include <project_vertex>
     vec4 iceVertex=vec4(transformed,1.0);
     #ifdef USE_INSTANCING
       iceVertex=instanceMatrix*iceVertex;
     #endif
     icePos=(modelMatrix*iceVertex).xyz;`
        );
      shader.fragmentShader =
        'varying vec3 icePos; uniform float uClock,uFest,uNight; uniform sampler2D iceLayers;\n' +
        shader.fragmentShader.replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
       vec3 viewDir=normalize(vViewPosition);
       float fr=pow(1.-clamp(dot(normalize(normal),viewDir),0.,1.),2.6);
       vec3 worldN=inverseTransformDirection(normalize(normal),viewMatrix);
       vec3 incident=normalize(icePos-cameraPosition), bent=refract(incident,worldN,1./1.31);
       vec2 cutUV=vec2(dot(icePos,vec3(.245,.021,.116)),dot(icePos,vec3(-.073,.257,.167)));
       vec2 shift=vec2(dot(bent,vec3(.245,.021,.116)),dot(bent,vec3(-.073,.257,.167)));
       vec3 skin=texture2D(iceLayers,cutUV).rgb;
       vec3 core=texture2D(iceLayers,cutUV*.67+shift*.84+vec2(.31,.72)).rgb;
       float nearDetail=1.-smoothstep(24.,89.,length(vViewPosition));
       float fracture=(skin.r*.86+core.r*.55+skin.g*.60+core.g*.32)*nearDetail;
       float haze=.52*skin.b+.48*core.b;
       vec3 faceN=abs(normalize(cross(dFdx(icePos),dFdy(icePos))));
       float facade=(1.-smoothstep(-29.,-20.,icePos.z))*(1.-smoothstep(34.,42.,abs(icePos.x)));
       float side=mix(icePos.x,icePos.z,step(faceN.z,faceN.x));
       vec2 course=vec2(side/1.72+.5*mod(floor((icePos.y+.16)/.83),2.),(icePos.y+.16)/.83);
       vec2 edge=abs(fract(course+.5)-.5), aa=max(vec2(.009),fwidth(course)*.72);
       float joint=max(1.-smoothstep(.014,.014+aa.x,edge.x),1.-smoothstep(.019,.019+aa.y,edge.y));
       float block=fract(sin(dot(floor(course),vec2(42.37,15.67)))*1368.37);
       float cut=facade*(1.-smoothstep(.59,.91,abs(worldN.y)))*(1.-smoothstep(88.,156.,length(vViewPosition)));
       diffuseColor.rgb*=1.+cut*((block-.5)*.23-joint*.32)+.10*(haze-.3);
       totalEmissiveRadiance*=.70+.18*uNight+.08*sin(uClock*.25+icePos.x*.064+icePos.z*.037);
       vec3 depthTint=mix(vec3(.014,.25,.87),vec3(.20,.031,.52),smoothstep(-2.,18.,icePos.x));
       vec3 flood=mix(vec3(.015,.49,.93),vec3(.63,.057,.52),smoothstep(-8.,22.,icePos.x));
       float uplight=.16+.84*pow(.5+.5*cos(side*.94+icePos.z*.12),3.);
       float glowDepth=(.22+1.07*exp(-max(0.,icePos.y)*.081))*uplight;
       float frostEdge=cut*joint*(.09+.19*fr);
       totalEmissiveRadiance+=facade*(flood*glowDepth*(1.-cut*joint*.66)+depthTint*(.23*haze+.42*fracture)+vec3(.42,.72,.86)*frostEdge)*(.23+.77*uNight);
       #if defined(USE_ENVMAP) && defined(ENVMAP_TYPE_CUBE_UV)
       vec3 innerSky=textureCubeUV(envMap,bent,.21+.24*haze).rgb;
       totalEmissiveRadiance+=innerSky*diffuseColor.rgb*(.068+.062*fr);
       #endif
       float wrap=.33+.67*max(0.,dot(-worldN,normalize(vec3(-.57,.62,.33))));
       totalEmissiveRadiance+=vec3(.13,.24,.30)*fracture*(.44+wrap)+diffuseColor.rgb*(.085*fr+.06*haze*wrap);
       vec3 spectrum=.5+.5*cos(icePos.y*.08+icePos.x*.031+uClock*.23+vec3(.65,2.15,4.7));
       totalEmissiveRadiance+=spectrum*(.012+uFest*(.28+.22*sin(icePos.y*.25-uClock*2.)))*(.34+fr);`
        );
    };
    mat.userData.glassTransmission = mat.transmission;
    mat.customProgramCacheKey = () => 'park-glacier-inclusions-5';
    cache.set(k, mat);
    return mat;
  }
  const metal = (color) => {
    if (!mcache.has(color))
      mcache.set(color, new T.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.66 }));
    return mcache.get(color);
  };
  const glow = (color, intensity = 1) => {
    const k = String(color) + ',' + intensity;
    if (!gcache.has(k))
      gcache.set(k, new T.MeshBasicMaterial({ color: new T.Color(color).multiplyScalar(intensity) }));
    return gcache.get(k);
  };
  return {
    ice,
    metal,
    glow,
    snow,
    clock,
    festival,
    nightLight,
    normal: norm,
    snowMap,
    quality(q) {
      for (const m of cache.values()) {
        const target = q === 'high' ? m.userData.glassTransmission : 0;
        if (m.transmission !== target) {
          m.transmission = target;
          m.needsUpdate = true;
        }
      }
    },
  };
}
function batch(T, root) {
  root.updateWorldMatrix(true, true);
  const inv = root.matrixWorld.clone().invert(),
    buckets = new Map(),
    nmat = new T.Matrix3(),
    vec = new T.Vector3();
  function visit(o) {
    if (o.userData.dynamic || o.isLOD || o.isInstancedMesh || o.isSkinnedMesh || !o.visible) return;
    if (
      o.isMesh &&
      o.geometry?.attributes.position &&
      !Array.isArray(o.material) &&
      !o.geometry?.morphAttributes?.position
    ) {
      const g = o.geometry,
        m = new T.Matrix4().multiplyMatrices(inv, o.matrixWorld);
      vec.setFromMatrixPosition(m);
      const k = [
        o.material.uuid,
        Math.floor(vec.x / 46),
        Math.floor(vec.z / 46),
        !!g.attributes.uv,
        !!g.attributes.color,
        !!g.attributes.normal,
        o.renderOrder,
        o.castShadow,
        o.receiveShadow,
      ].join('/');
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push({ g, m, o });
    }
    for (const c of o.children) visit(c);
  }
  for (const c of root.children) visit(c);
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    const first = list[0].o,
      a0 = first.geometry.attributes;
    let pts = 0,
      count = 0;
    for (const { g } of list) {
      pts += g.attributes.position.count;
      count += g.index?.count ?? g.attributes.position.count;
    }
    const pos = new Float32Array(pts * 3),
      normal = a0.normal && new Float32Array(pos.length),
      colors = a0.color && new Float32Array(pos.length),
      uv = a0.uv && new Float32Array(pts * 2),
      index = pts > 65535 ? new Uint32Array(count) : new Uint16Array(count);
    let offset = 0,
      ii = 0;
    for (const { g, m, o } of list) {
      const a = g.attributes,
        n = a.position.count;
      nmat.getNormalMatrix(m);
      for (let i = 0; i < n; i++) {
        const j = offset + i;
        vec
          .fromBufferAttribute(a.position, i)
          .applyMatrix4(m)
          .toArray(pos, j * 3);
        if (normal)
          vec
            .fromBufferAttribute(a.normal, i)
            .applyNormalMatrix(nmat)
            .toArray(normal, j * 3);
        if (colors) vec.fromBufferAttribute(a.color, i).toArray(colors, j * 3);
        if (uv) {
          uv[j * 2] = a.uv.getX(i);
          uv[j * 2 + 1] = a.uv.getY(i);
        }
      }
      const total = g.index?.count ?? n,
        flip = m.determinant() < 0;
      for (let i = 0; i < total; i++) {
        const src = flip ? (i % 3 === 1 ? i + 1 : i % 3 === 2 ? i - 1 : i) : i;
        index[ii++] = offset + (g.index ? g.index.getX(src) : src);
      }
      offset += n;
      o.removeFromParent();
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    if (normal) g.setAttribute('normal', new T.BufferAttribute(normal, 3));
    if (colors) g.setAttribute('color', new T.BufferAttribute(colors, 3));
    if (uv) g.setAttribute('uv', new T.BufferAttribute(uv, 2));
    g.setIndex(new T.BufferAttribute(index, 1));
    g.computeBoundingSphere();
    const o = new T.Mesh(g, first.material);
    o.castShadow = first.castShadow;
    o.receiveShadow = first.receiveShadow;
    o.renderOrder = first.renderOrder;
    root.add(o);
  }
}
