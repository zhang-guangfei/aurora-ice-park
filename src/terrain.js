'use strict';

function ground(T, renderer, scene, camera, kit) {
  const base = new T.Group(),
    surfaces = new T.Group();
  base.add(surfaces);
  scene.add(base);
  let seed = 9413;
  const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296,
    V = (x, y, z) => new T.Vector3(x, y, z);
  // Bake local pools of light and soft contact shadows into one world-space texture.
  // The same coordinates shade the snow, the rink and every paved ice path.
  const lightSize = 384, lightSpan = 224, lightData = new Uint8Array(lightSize * lightSize * 4);
  const irradiance = new T.DataTexture(lightData, lightSize, lightSize, T.RGBAFormat);
  irradiance.minFilter = irradiance.magFilter = T.LinearFilter;
  irradiance.needsUpdate = true;
  function stampLight(x, z, rx, rz, angle, color, strength) {
    const scale = lightSize / lightSpan, cs = Math.cos(angle), sn = Math.sin(angle);
    const ex = Math.hypot(rx * cs, rz * sn), ez = Math.hypot(rx * sn, rz * cs);
    const px = (x / lightSpan + .5) * lightSize - .5, pz = (z / lightSpan + .5) * lightSize - .5;
    const maxX = Math.min(lightSize - 1, Math.ceil(px + ex * scale));
    const maxZ = Math.min(lightSize - 1, Math.ceil(pz + ez * scale));
    for (let j = Math.max(0, Math.floor(pz - ez * scale)); j <= maxZ; j++) {
      for (let i = Math.max(0, Math.floor(px - ex * scale)); i <= maxX; i++) {
        const dx = (i - px) / scale, dz = (j - pz) / scale;
        const u = (dx * cs + dz * sn) / rx, v = (-dx * sn + dz * cs) / rz;
        const d = 1 - u * u - v * v;
        if (d <= 0) continue;
        const f = d * d * strength * 255, k = 4 * (j * lightSize + i);
        if (color) {
          for (let c = 0; c < 3; c++) lightData[k+c] = Math.min(255, lightData[k+c] + f * color[c]);
        } else lightData[k+3] = Math.max(lightData[k+3], Math.min(255, f));
      }
    }
  }
  const lighting = {
    texture: irradiance,
    pool: (x, z, rx, rz, angle, color, strength) => stampLight(x, z, rx, rz, angle, color, strength),
    contact: (x, z, rx, rz, strength, angle = 0) => stampLight(x, z, rx, rz, angle, null, strength),
  };
  function groundLight(shader, varying, receive) {
    shader.uniforms.parkIrradiance = { value: irradiance };
    shader.uniforms.parkNight = kit.nightLight || { value: 1 };
    shader.fragmentShader = 'uniform sampler2D parkIrradiance;uniform float parkNight;\n' + shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      'vec4 bakedLight=texture2D(parkIrradiance,' + varying + '.xz/224.+.5);\n' +
      'outgoingLight*=1.-.53*bakedLight.a; outgoingLight+=bakedLight.rgb*' + receive + '*(.13+.87*parkNight);\n#include <opaque_fragment>'
    );
  }
  const map = kit.snowMap.clone();
  map.repeat.set(90, 90);
  map.needsUpdate = true;
  const gm = kit.snow.clone();
  gm.map = map;
  gm.normalMap = (kit.snowNormal || kit.normal).clone();
  gm.normalMap.repeat.set(80, 80);
  gm.normalMap.needsUpdate = true;
  gm.vertexColors = true;
  gm.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 snowWorld;\n' + shader.vertexShader.replace(
      '#include <project_vertex>', '#include <project_vertex>\nsnowWorld=(modelMatrix*vec4(transformed,1.)).xyz;'
    );
    shader.fragmentShader = 'varying vec3 snowWorld;\n' + shader.fragmentShader.replace(
      '#include <color_fragment>', `#include <color_fragment>
      float crossWind=snowWorld.x*.74+snowWorld.z*.42;
      float folds=sin(crossWind+sin(snowWorld.z*.54)*.93+sin(snowWorld.x*.36)*.51);
      float bank=smoothstep(.28,.93,folds)*(.55+.45*sin(snowWorld.z*.27+snowWorld.x*.18));
      diffuseColor.rgb*=vec3(.90,.94,.99)+vec3(.10,.077,.055)*bank;`
    );
    groundLight(shader, 'snowWorld', '.82');
  };
  gm.customProgramCacheKey = () => 'wind-snow-pools-1';
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
  // Blade scratches cross in paired arcs. The texture tiles at all four boundaries.
  const wearCanvas=document.createElement('canvas');
  wearCanvas.width=wearCanvas.height=512;
  const ink=wearCanvas.getContext('2d');
  ink.fillStyle='#000';ink.fillRect(0,0,512,512);
  ink.globalCompositeOperation='lighter';ink.lineCap='round';
  for(let mark=0;mark<54;mark++){
    const x=rnd()*512,z=rnd()*512,angle=rnd()*Math.PI*2;
    const length=36+122*rnd(),curl=(rnd()-.5)*length, gap=3.5+rnd()*3;
    for(const offset of [0,gap]){
      const path=new Path2D();path.moveTo(0,offset);
      path.bezierCurveTo(length*.28,offset+curl*.08,length*.65,offset+curl*.76,length,offset+curl);
      ink.lineWidth=.60+.55*rnd();ink.strokeStyle='rgba(224,0,0,'+(.18+.54*rnd())+')';
      for(const ox of [-512,0,512])for(const oz of [-512,0,512]){
        ink.setTransform(Math.cos(angle),Math.sin(angle),-Math.sin(angle),Math.cos(angle),x+ox,z+oz);ink.stroke(path);
      }
    }
  }
  ink.resetTransform();
  for(let j=0;j<280;j++){
    const x=rnd()*512,z=rnd()*512;ink.fillStyle='rgba(0,255,0,'+(.18+.58*rnd())+')';
    ink.beginPath();ink.ellipse(x,z,.48+rnd()*1.1,.52+rnd()*1.25,0,0,Math.PI*2);ink.fill();
  }
  const wear=new T.CanvasTexture(wearCanvas);
  wear.wrapS=wear.wrapT=T.RepeatWrapping;
  wear.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  const rt = new T.WebGLRenderTarget(640, 360, {
    type: T.UnsignedByteType,
    minFilter: T.LinearFilter,
    magFilter: T.LinearFilter,
  });
  const sampleDepth = renderer.capabilities.isWebGL2 || renderer.extensions.has('WEBGL_depth_texture');
  if (sampleDepth) rt.depthTexture = new T.DepthTexture(rt.width, rt.height, T.UnsignedIntType);

  const iceLevel = 0.07;
  const mirror = new T.PerspectiveCamera(),
    matrix = new T.Matrix4(),
    capturedProjection = new T.Matrix4(),
    capturedRotation = new T.Quaternion(),
    reflectedEye = new T.Vector3(),
    eyeInCapture = new T.Vector4(),
    inverseDepth = new T.Vector2(),
    enable = { value: 1 };
  const maxTurn = Math.cos(T.MathUtils.degToRad(5) / 2);
  let lastCapture = -Infinity, captureInterval = 0.082;
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
    if (sampleDepth) m.defines.ICE_DEPTH_REPROJECTION = 1;
    m.onBeforeCompile = (s) => {
      if (sampleDepth) {
        s.uniforms.rDepth = { value: rt.depthTexture };
        s.uniforms.rEyeInCapture = { value: eyeInCapture };
        s.uniforms.rInverseDepth = { value: inverseDepth };
      }
      s.uniforms.rTex = { value: rt.texture };
      s.uniforms.rMat = { value: matrix };
      s.uniforms.rEnabled = enable;
      s.uniforms.rGloss = { value: gloss };
      s.uniforms.iceWear = { value: wear };
      s.uniforms.wearAmount = { value: pattern ? .44 : 1 };
      s.vertexShader =
        'varying vec4 projIce;varying vec3 worldIce;uniform mat4 rMat;\n' +
        s.vertexShader.replace(
          '#include <project_vertex>',
          '#include <project_vertex>\nworldIce=(modelMatrix*vec4(transformed,1.)).xyz;projIce=rMat*vec4(worldIce,1.);'
        );
      s.fragmentShader =
        `varying vec4 projIce;
varying vec3 worldIce;
uniform sampler2D rTex, iceWear;
uniform float rEnabled, rGloss, wearAmount;
#ifdef ICE_DEPTH_REPROJECTION
uniform sampler2D rDepth;
uniform vec4 rEyeInCapture;
uniform vec2 rInverseDepth;

float inverseCaptureDepth(vec2 uv, float atIce) {
  float depth = texture2D(rDepth, clamp(uv, 0.0, 1.0)).r;
  return min(atIce, rInverseDepth.y + (1.0 - depth) * rInverseDepth.x);
}
#endif
vec2 reflectionUV() {
#ifdef ICE_DEPTH_REPROJECTION
  // Project the current mirror ray into the last capture. Points along it differ by offset / view depth.
  vec4 ray = projIce - rEyeInCapture;
  vec2 atInfinity = ray.xy / max(ray.w, 0.0001);
  vec2 offset = rEyeInCapture.xy - atInfinity * rEyeInCapture.w;
  float atIce = 1.0 / max(projIce.w, 0.0001);
  vec2 estimate = atInfinity + offset * min(atIce, 0.04);
  estimate = atInfinity + offset * inverseCaptureDepth(estimate, atIce);
  return atInfinity + offset * inverseCaptureDepth(estimate, atIce);
#else
  return projIce.xy / max(projIce.w, 0.0001);
#endif
}
` +
        s.fragmentShader.replace(
          '#include <opaque_fragment>',
          `vec2 cuts=texture2D(iceWear,worldIce.xz*.115).rg;
 float wearDetail=wearAmount*(1.-smoothstep(11.,38.,length(worldIce-cameraPosition)));
 if (rEnabled>.5 && projIce.w>.001) {
 vec2 reflUV=reflectionUV();
 float frost=.5+.5*sin(worldIce.x*.65+sin(worldIce.z*.42)*2.7)*cos(worldIce.z*.31+worldIce.x*.34);
 vec2 grains=vec2(sin(worldIce.x*4.7+worldIce.z*.81),cos(worldIce.z*3.6+worldIce.x*.59))*(.00016+.00053*frost);
 float grazing=1.-clamp(normalize(cameraPosition-worldIce).y,0.,1.);
 vec2 uv=clamp(reflUV+grains,vec2(.003),vec2(.997)), spread=vec2(.00072,.00175)*(.6+frost+cuts.r*wearDetail);
 vec3 refl=.44*texture2D(rTex,uv).rgb+.18*(texture2D(rTex,uv+spread).rgb+texture2D(rTex,uv-spread).rgb)
          +.10*(texture2D(rTex,uv+vec2(spread.x,-spread.y)).rgb+texture2D(rTex,uv+vec2(-spread.x,spread.y)).rgb);
 vec2 border=min(reflUV,1.0-reflUV);
 float inside=smoothstep(0.0,0.012,min(border.x,border.y));
 outgoingLight=mix(outgoingLight,refl*vec3(.84,.95,1.05)+diffuseColor.rgb*.023,inside*rGloss*(.27+.65*grazing)*(1.-.28*frost));
 }
 outgoingLight+=cuts.r*wearDetail*vec3(.15,.22,.25)+cuts.g*wearDetail*vec3(.07,.12,.14);
 #include <opaque_fragment>`
        );
      groundLight(s, 'worldIce', '.48');
    };
    m.customProgramCacheKey = () => 'mirror-floe-pools-7';
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
  // Index the same triangles that draw the ice. Curved paths, the plaza and the rink share these edges.
  const iceCells = new Map();
  const cellSize = 8;
  function registerIce(geometry) {
    const p = geometry.attributes.position, indices = geometry.index.array;
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i], b = indices[i + 1], c = indices[i + 2];
      const x = p.getX(a), z = p.getZ(a), bx = p.getX(b), bz = p.getZ(b), cx = p.getX(c), cz = p.getZ(c);
      const det = (bx - x) * (cz - z) - (bz - z) * (cx - x);
      if (Math.abs(det) < 1e-9) continue;
      const tri = { x, z, ux: (cz - z) / det, uz: (x - cx) / det, vx: (z - bz) / det, vz: (bx - x) / det };
      for (let gx = Math.floor(Math.min(x, bx, cx) / cellSize); gx <= Math.floor(Math.max(x, bx, cx) / cellSize); gx++) {
        for (let gz = Math.floor(Math.min(z, bz, cz) / cellSize); gz <= Math.floor(Math.max(z, bz, cz) / cellSize); gz++) {
          const key = gx + ',' + gz;
          if (!iceCells.has(key)) iceCells.set(key, []);
          iceCells.get(key).push(tri);
        }
      }
    }
  }
  function isIce(x, z) {
    const cell = iceCells.get(Math.floor(x / cellSize) + ',' + Math.floor(z / cellSize));
    if (!cell) return false;
    for (const t of cell) {
      const dx = x - t.x, dz = z - t.z, u = dx * t.ux + dz * t.uz, v = dx * t.vx + dz * t.vz;
      if (u >= -1e-7 && v >= -1e-7 && u + v <= 1.0000001) return true;
    }
    return false;
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
    if (mat === road || mat === side) registerIce(o.geometry);
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
    registerIce(g);
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
  const look = V(0, 0, 0),
    up = V(0, 0, 0),
    bias = new T.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  let detailedMirror=false, mirrorIce=null;
  function reflectionSurfaces() {
    // At the planar probe's smaller resolution the internal transmission pass cannot resolve inclusions.
    // Keep the same surface shaders and lights, and use their environment refraction in the mirror.
    const pairs=[], proxies=new Map();
    scene.traverse(mesh=>{
      const original=mesh.material;
      if(!mesh.isMesh || !original?.userData?.glassTransmission) return;
      let proxy=proxies.get(original);
      if(!proxy){
        proxy=original.clone();proxy.transmission=0;
        proxy.onBeforeCompile=original.onBeforeCompile;
        proxy.customProgramCacheKey=original.customProgramCacheKey;
        proxies.set(original,proxy);
      }
      pairs.push({mesh,original,proxy});
    });
    return pairs;
  }
  function capture(hide) {
    mirror.copy(camera, false);
    // Leave a border so turning between captures can reveal real reflected pixels.
    mirror.zoom /= 1.12;
    mirror.updateProjectionMatrix();
    mirror.position.copy(reflectedEye);
    camera.getWorldDirection(look);
    look.y *= -1;
    up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    up.y *= -1;
    mirror.up.copy(up);
    mirror.lookAt(look.add(mirror.position));
    mirror.updateMatrixWorld();
    matrix.copy(bias).multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse);
    inverseDepth.set(1 / mirror.near - 1 / mirror.far, 1 / mirror.far);
    capturedProjection.copy(camera.projectionMatrix);
    capturedRotation.copy(camera.quaternion);

    const target = renderer.getRenderTarget(), shadow = renderer.shadowMap.autoUpdate;
    const surfaceVisible = surfaces.visible, visible = hide.map(object => object.visible);
    const optical = detailedMirror ? (mirrorIce || (mirrorIce=reflectionSurfaces())) : null;
    try {
      surfaces.visible = false;
      if(optical)for(const pass of optical)pass.mesh.material=pass.proxy;
      for (const object of hide) object.visible = false;
      renderer.shadowMap.autoUpdate = false;
      renderer.setRenderTarget(rt);
      renderer.render(scene, mirror);
    } finally {
      renderer.setRenderTarget(target);
      renderer.shadowMap.autoUpdate = shadow;
      surfaces.visible = surfaceVisible;
      if(optical)for(const pass of optical)pass.mesh.material=pass.original;
      hide.forEach((object, i) => { object.visible = visible[i]; });
    }
  }
  return {
    road,
    lighting,
    rt,
    isIce,
    resize(w, h, level) {
      detailedMirror = level === 'high';
      enable.value = level === 'low' ? 0 : 1;
      captureInterval = level === 'high' ? 0.082 : 0.17;
      const f = level === 'high' ? 0.52 : 0.37;
      rt.setSize(Math.max(64, (w * f) | 0), Math.max(48, (h * f) | 0));
      lastCapture = -Infinity;
    },
    reflect(hide, stamp) {
      if (!enable.value) return;
      reflectedEye.copy(camera.position);
      reflectedEye.y = 2 * iceLevel - camera.position.y;
      const shiftSq = reflectedEye.distanceToSquared(mirror.position);
      const facing = Math.abs(camera.quaternion.dot(capturedRotation));
      const outsideCapture = sampleDepth
        ? shiftSq > 0.55 * 0.55 || facing < maxTurn
        : shiftSq > 1e-10 || facing < 1 - 1e-10;
      if (outsideCapture || stamp - lastCapture >= captureInterval || !capturedProjection.equals(camera.projectionMatrix)) {
        capture(hide);
        lastCapture = stamp;
      }
      // This uniform follows both camera translation and head bob on every displayed frame.
      eyeInCapture.set(reflectedEye.x, reflectedEye.y, reflectedEye.z, 1).applyMatrix4(matrix);
    },
  };
}
