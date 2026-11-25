'use strict';
function makeKit(T, renderer, scene) {
  const cache = new Map(),
    mcache = new Map(),
    gcache = new Map(),
    clock = { value: 0 },
    festival = { value: 0 };
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
    [0, '#16253e'],
    [0.32, '#4a6b94'],
    [0.48, '#badfe6'],
    [0.57, '#51647f'],
    [1, '#253652'],
  ])
    gr.addColorStop(p, color);
  e.fillStyle = gr;
  e.fillRect(0, 0, 512, 256);
  for (const [x, w, h, c] of [
    [40, 37, 58, '#afdbe4'],
    [118, 13, 47, '#c7f8ff'],
    [205, 27, 56, '#cebddd'],
    [353, 48, 83, '#edf8ff'],
    [461, 16, 54, '#a7bdff'],
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
  function ice(color = 0x92deed, opts = {}) {
    if (!opts || typeof opts !== 'object') opts = {};
    const k = String(color) + JSON.stringify(opts);
    if (cache.has(k)) return cache.get(k);
    const tint = new T.Color(color),
      mat = new T.MeshPhysicalMaterial({
        color: tint.clone().lerp(new T.Color(0xbddcf0), 0.055).multiplyScalar(0.77),
        emissive: tint,
        emissiveIntensity: opts.emissiveIntensity ?? 0.085,
        roughness: opts.roughness ?? 0.19,
        metalness: opts.metalness ?? 0.07,
        clearcoat: 0.76,
        clearcoatRoughness: 0.16,
        envMapIntensity: 0.95,
        transmission: opts.transmission ?? 0.26,
        ior: 1.31,
        thickness: opts.thickness ?? 1.5,
        attenuationDistance: 5,
        attenuationColor: tint.clone().lerp(new T.Color(0xffffff), 0.5),
        normalMap: norm,
        normalScale: new T.Vector2(0.19, 0.19),
        transparent: opts.transparent ?? false,
        opacity: opts.opacity ?? 1,
      });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uClock = clock;
      shader.uniforms.uFest = festival;
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
        'varying vec3 icePos;uniform float uClock,uFest;\n' +
        shader.fragmentShader.replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
       float vein=pow(1.-abs(sin(dot(icePos,vec3(.58,.91,.45))+sin(icePos.y*.39)*1.6)),15.);
       float fr=pow(1.-max(dot(normalize(normal),normalize(vViewPosition)),0.),2.5);
       vec3 spectrum=.5+.5*cos(icePos.y*.08+icePos.x*.031+uClock*.23+vec3(.65,2.15,4.7));
       totalEmissiveRadiance*=.87+.13*sin(uClock*.25+icePos.x*.064+icePos.z*.037);
       float facade=(1.-smoothstep(-29.,-20.,icePos.z))*(1.-smoothstep(32.,40.,abs(icePos.x)));
       vec3 wallNormal=inverseTransformDirection(normalize(normal),viewMatrix);
       vec3 faceNormal=abs(normalize(cross(dFdx(icePos),dFdy(icePos))));
       float side=mix(icePos.x,icePos.z,step(faceNormal.z,faceNormal.x));
       vec2 course=vec2(side/1.72+.5*mod(floor((icePos.y+.16)/.83),2.),(icePos.y+.16)/.83);
       vec2 edge=abs(fract(course+.5)-.5);
       vec2 aa=max(vec2(.013),fwidth(course)*.68);
       float joint=max(1.-smoothstep(.012,.012+aa.x,edge.x),1.-smoothstep(.016,.016+aa.y,edge.y));
       float block=fract(sin(dot(floor(course),vec2(42.37,15.67)))*1368.37);
       float cut=facade*(1.-smoothstep(.59,.91,abs(wallNormal.y)))*(1.-smoothstep(105.,175.,length(vViewPosition)));
       diffuseColor.rgb*=1.+cut*((block-.5)*.14-joint*.19);
       vec3 lantern=mix(vec3(.009,.22,.45),vec3(.34,.034,.30),smoothstep(-15.,18.,icePos.x));
       #if defined(USE_ENVMAP) && defined(ENVMAP_TYPE_CUBE_UV)
       vec3 bentRay=refract(normalize(icePos-cameraPosition),wallNormal,1./1.31);
       vec3 innerSky=textureCubeUV(envMap,bentRay,.29).rgb;
       totalEmissiveRadiance+=innerSky*diffuseColor.rgb*(.082+.065*fr);
       #endif
       float pool=.22+.78*pow(.5+.5*cos(side*.91+icePos.z*.09),3.);
       totalEmissiveRadiance+=facade*lantern*(.14+.84*exp(-icePos.y*.082))*pool*(1.-.45*cut*joint);
       totalEmissiveRadiance+=diffuseColor.rgb*(.073*vein+.105*fr)+spectrum*(.025+uFest*(.28+.22*sin(icePos.y*.25-uClock*2.)))*(.34+fr);`
        );
    };
    mat.userData.glassTransmission = mat.transmission;
    mat.customProgramCacheKey = () => 'park-glacier-4';
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
