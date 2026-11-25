'use strict';

function art(T, k, lighting) {
  const group = new T.Group(),
    colliders = [],
    V = (...v) => new T.Vector3(...v),
    A = 2 * Math.PI,
    B = new T.BoxGeometry(),
    S = new T.SphereGeometry(1, 16, 10),
    cache = new Map();
  const ice = k.ice(0x8ed8f5),
    white = k.ice(0xc4efff),
    aqua = k.ice(0x69dfdf),
    purple = k.ice(0xb29be7),
    deep = k.ice(0x537dab),
    brass = k.metal(0x9f8054),
    iron = k.metal(0x344957),
    gold = k.glow(0xffc67c, 1.12),
    mint = k.glow(0x92f8eb, 1.03),
    snow = k.snow;
  const node = (p, x, y, z) => {
    const o = new T.Group();
    o.position.set(x, y, z);
    p.add(o);
    return o;
  };
  function part(p, g, m, x, y, z, w = 1, h = 1, d = 1) {
    const o = new T.Mesh(g, m);
    o.position.set(x, y, z);
    o.scale.set(w, h, d);
    o.castShadow = o.receiveShadow = true;
    p.add(o);
    return o;
  }
  const box = (p, m, x, y, z, w, h, d) => part(p, B, m, x, y, z, w, h, d),
    egg = (p, m, x, y, z, w, h, d) => part(p, S, m, x, y, z, w, h, d);
  function cyl(n, top = 1, bot = 1) {
    const id = [n, top, bot].join(',');
    if (!cache.has(id)) cache.set(id, new T.CylinderGeometry(top, bot, 1, n));
    return cache.get(id);
  }
  function rod(p, a, b, r, m, r2 = r) {
    const d = V(...b).sub(V(...a)),
      c = V(...a).lerp(V(...b), 0.5),
      o = part(p, cyl(7, r2 / r), m, c.x, c.y, c.z, r, d.length(), r);
    o.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
  }
  function line(p, pts, rs, mat) {
    const curve = new T.CatmullRomCurve3(pts.map((a) => V(...a))),
      steps = pts.length * 3,
      frames = curve.computeFrenetFrames(steps, false),
      pos = [],
      uv = [],
      idx = [],
      n = 8;
    for (let j = 0; j <= steps; j++) {
      const t = j / steps,
        c = curve.getPointAt(t),
        u = t * (rs.length - 1),
        a = Math.min(rs.length - 2, Math.floor(u)),
        r = T.MathUtils.lerp(rs[a], rs[a + 1], u - a);
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * A,
          v = c
            .clone()
            .addScaledVector(frames.normals[j], Math.cos(ang) * r)
            .addScaledVector(frames.binormals[j], Math.sin(ang) * r);
        pos.push(v.x, v.y, v.z);
        uv.push(i / n, t);
        if (j) {
          const b = j * n + i,
            e = j * n + ((i + 1) % n);
          idx.push(b - n, e - n, b, e - n, e, b);
        }
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return part(p, g, mat, 0, 0, 0);
  }
  const prisms=Array.from({length:3},(_,variant)=>{
    const pos=[],uv=[],rings=[];
    const shape=[[.66,0],[.90,.105],[1,.55],[.95,.78]];
    for(const [row,[radius,height]] of shape.entries()){
      const ring=[];
      for(let i=0;i<6;i++){
        const a=A*i/6+.07*variant,flute=1+.10*Math.sin(i*7.6+variant);
        const y=height+(row===3?.087*Math.cos(a+.6*variant):0);
        ring.push([Math.cos(a)*radius*flute+.08*y,y,Math.sin(a)*radius*(.88+.04*variant)]);
      }
      rings.push(ring);
    }
    const vertex=(p,u)=>{pos.push(...p);uv.push(u,p[1]);};
    for(let i=0;i<6;i++){
      const j=(i+1)%6, u=i/6,v=(i+1)/6;
      for(let row=0;row<3;row++){
        const a=rings[row],b=rings[row+1];
        vertex(a[i],u);vertex(b[i],u);vertex(b[j],v);
        vertex(a[i],u);vertex(b[j],v);vertex(a[j],v);
      }
      vertex(rings[3][i],u);vertex([.22+.05*variant,1,-.13],(u+v)*.5);vertex(rings[3][j],v);
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));
    g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;
  });
  function shard(p, mat, x, y, z, r, h, tilt) {
    const o=node(p,x,y,z),variant=Math.abs(Math.round((x+z)*6+h*2))%prisms.length;
    o.rotation.z=tilt;
    part(o,prisms[variant],mat,0,0,0,r,h,r);
    return o;
  }
  function stand(x, z, w, d, m) {
    const a = node(group, x, 0, z);
    lighting?.contact(x,z,w*1.25,d*1.35,.67);
    const tint=m.color;
    lighting?.pool(x,z+1.0,w*1.88,d*2.1,0,tint ? [tint.r,tint.g,tint.b] : [.15,.4,.65],.47);
    for (const [y, wi, hi, ma] of [
      [0.17, 1, 0.34, iron],
      [0.38, 0.98, 0.1, brass],
      [0.58, 0.95, 0.31, deep],
      [0.75, 0.92, 0.04, m],
      [0.83, 0.93, 0.12, white],
    ])
      part(a, cyl(32, 0.98), ma, 0, y, 0, w * wi, hi, d * wi);
    colliders.push({ type: 'box', x, z, w: w * 1.88, d: d * 1.88, maxY: 2.8 });
    return node(a, 0, 0.89, 0);
  }
  const gem = stand(-12, 9, 3.6, 3.6, mint);
  shard(gem, k.ice(0x4bc8d8, { transmission: 0.49, thickness: 2.35, emissiveIntensity: .12 }), 0, 0, 0, 1.26, 8.5, -0.05);
  for (let i = 0; i < 7; i++) {
    const a = (i * A) / 7,
      o = node(gem, Math.cos(a) * 1.38, 0, Math.sin(a) * 1.38);
    o.rotation.y = -a;
    shard(o, [ice, purple, white][i % 3], 0, 0, 0, 0.54, 2.9 + ((i * 3) % 7) * 0.42, -0.33);
  }
  const hoop = part(gem, new T.TorusGeometry(2.72, 0.049, 8, 66), brass, 0, 2.73, 0);
  hoop.rotation.set(0.94, 0.24, -0.28);
  hoop.userData.dynamic = true;
  const dragon = stand(-39.7, 26.4, 5.5, 2.5, mint);
  dragon.rotation.y = -0.28;
  const path = [
    [-5, 0.29, -0.3],
    [-4.05, 0.76, 0.61],
    [-2.9, 1.84, 0.82],
    [-1.72, 2.04, 0.28],
    [-0.45, 1.67, -0.14],
    [0.52, 1.28, -0.45],
    [1.34, 1.95, -0.37],
    [1.48, 3.33, 0.12],
    [2.1, 4.23, 0.52],
    [2.65, 4.41, 0.59],
  ];
  line(dragon, path, [0.04, 0.22, 0.43, 0.52, 0.55, 0.5, 0.42, 0.33, 0.31, 0.38], aqua);
  const spine = new T.CatmullRomCurve3(path.map((p) => V(...p)));
  for (let i = 1; i < 19; i++) {
    const p = spine.getPoint(i / 20);
    shard(
      dragon,
      i % 3 ? white : purple,
      p.x,
      p.y + 0.22,
      p.z,
      0.14,
      0.38 + 0.3 * Math.sin((i / 20) * Math.PI),
      0.33
    );
  }
  for (const x of [-2.3, 0.8])
    for (const s of [-1, 1]) {
      line(
        dragon,
        [
          [x, 1.62, s * 0.12],
          [x - 0.23, 1.14, s * 0.52],
          [x + 0.13, 0.68, s * 0.81],
          [x + 0.19, 0.12, s * 1.14],
        ],
        [0.22, 0.17, 0.1, 0.08],
        ice
      );
      for (const t of [-1, 0, 1])
        rod(
          dragon,
          [x + 0.19, 0.12, s * 1.14],
          [x + 0.55, 0.05, s * (1.14 + t * 0.22)],
          0.07,
          white,
          0.008
        );
    }
  const head = node(dragon, 2.62, 4.43, 0.59);
  egg(head, ice, 0, 0.06, 0, 0.64, 0.47, 0.43);
  egg(head, aqua, 0.58, -0.11, 0, 0.68, 0.22, 0.32);
  egg(head, deep, 0.58, -0.38, 0, 0.6, 0.1, 0.29);
  egg(head, white, 1.05, -0.025, 0, 0.22, 0.17, 0.3);
  for (const s of [-1, 1]) {
    egg(head, gold, 0.29, 0.16, s * 0.38, 0.083, 0.066, 0.071);
    line(
      head,
      [
        [-0.14, 0.28, s * 0.18],
        [-0.47, 0.72, s * 0.34],
        [-0.91, 0.97, s * 0.59],
        [-1.1, 1.38, s * 0.72],
      ],
      [0.14, 0.1, 0.065, 0.009],
      white
    );
    for (let j = 0; j < 2; j++)
      rod(
        head,
        [-0.43 - j * 0.32, 0.7 + j * 0.19, s * (0.35 + j * 0.12)],
        [-0.38 - j * 0.3, 1.1 + j * 0.21, s * (0.44 + j * 0.15)],
        0.06,
        white,
        0.007
      );
    line(
      head,
      [
        [0.96, -0.12, s * 0.22],
        [1.34, 0.02, s * 0.53],
        [1.43, 0.36, s * 0.77],
        [1.15, 0.56, s * 0.94],
      ],
      [0.035, 0.029, 0.02, 0.004],
      mint
    );
  }
  function feather(p, a, b, r, mat) {
    const v = V(...b).sub(V(...a)),
      mid = V(...a).lerp(V(...b), 0.5);
    const o = egg(p, mat, mid.x, mid.y, mid.z, r, v.length() * 0.52, r * 0.29);
    o.quaternion.setFromUnitVectors(V(0, 1, 0), v.normalize());
  }
  const bird = stand(-49.1, 32.8, 4.8, 2.2, purple);
  egg(bird, purple, 0, 2.2, 0.1, 0.52, 0.83, 0.53);
  line(
    bird,
    [
      [-0.53, 0, -0.35],
      [-0.6, 0.71, -0.18],
      [-0.35, 1.41, 0.02],
      [0, 2, 0.21],
    ],
    [0.31, 0.23, 0.15, 0.13],
    ice
  );
  line(
    bird,
    [
      [0, 2.55, 0.14],
      [-0.03, 3.1, 0.41],
      [0.08, 3.65, 0.42],
      [0.43, 3.89, 0.55],
    ],
    [0.32, 0.22, 0.14, 0.2],
    white
  );
  egg(bird, purple, 0.42, 3.9, 0.54, 0.28, 0.21, 0.22);
  rod(bird, [0.52, 3.88, 0.61], [0.95, 3.72, 0.75], 0.12, aqua, 0.01);
  for (const s of [-1, 1]) {
    line(
      bird,
      [
        [s * 0.28, 2.53, 0.09],
        [s * 1.13, 3.1, -0.09],
        [s * 1.9, 3.87, -0.27],
        [s * 3.19, 4.5, -0.49],
      ],
      [0.28, 0.25, 0.17, 0.052],
      purple
    );
    for (let j = 0; j < 9; j++) {
      const f = j / 8;
      feather(
        bird,
        [s * (0.35 + 1.8 * f), 2.47 + 1.45 * f, -0.51 * f],
        [s * (1.19 + 3.03 * f), 1.76 + 3.76 * f, -0.32 - 0.56 * f],
        0.25,
        [purple, aqua, ice, white][j % 4]
      );
    }
    egg(bird, mint, 0.49, 3.96, 0.54 + s * 0.17, 0.043, 0.043, 0.043);
  }
  for (let j = -3; j <= 3; j++)
    feather(
      bird,
      [j * 0.065, 1.99, -0.19],
      [j * 0.65, 0.23 + Math.abs(j) * 0.12, -1.17],
      0.19,
      j % 2 ? purple : aqua
    );
  for (let j = -1; j <= 1; j++)
    feather(
      bird,
      [0.31, 4.01, 0.54 + j * 0.09],
      [-0.27 + j * 0.19, 4.68, 0.44 + j * 0.22],
      0.065,
      white
    );
  const deer = stand(-36.1, 40.1, 2.72, 1.79, mint);
  deer.rotation.y = -0.47;
  egg(deer, white, -0.1, 1.61, 0, 0.99, 0.54, 0.4);
  egg(deer, ice, -0.69, 1.69, 0, 0.5, 0.51, 0.39);
  line(
    deer,
    [
      [0.43, 1.75, 0],
      [0.7, 2.17, 0.02],
      [0.82, 2.65, 0.07],
      [1.04, 2.92, 0.11],
    ],
    [0.39, 0.31, 0.22, 0.18],
    ice
  );
  egg(deer, white, 1.17, 2.95, 0.1, 0.37, 0.24, 0.22);
  egg(deer, ice, 1.45, 2.82, 0.11, 0.28, 0.15, 0.15);
  for (const s of [-1, 1]) {
    for (const f of [-1, 1]) {
      const x = f * 0.59 + s * 0.13;
      line(
        deer,
        [
          [x, 1.71, s * 0.23],
          [x - f * 0.14, 1.08, s * 0.28],
          [x + f * 0.13, 0.65, s * 0.3],
          [x + f * 0.09, 0.13, s * 0.35],
        ],
        [0.2, 0.13, 0.07, 0.065],
        ice
      );
    }
    egg(deer, deep, 1.24, 3.02, 0.1 + s * 0.18, 0.04, 0.04, 0.04);
    feather(deer, [0.98, 3.07, 0.1 + s * 0.11], [0.55, 3.4, 0.1 + s * 0.39], 0.11, aqua);
    line(
      deer,
      [
        [1.02, 3.11, 0.1 + s * 0.11],
        [0.89, 3.5, 0.1 + s * 0.22],
        [0.59, 3.8, 0.1 + s * 0.39],
        [0.21, 4.11, 0.1 + s * 0.51],
        [0.02, 4.53, 0.1 + s * 0.69],
      ],
      [0.112, 0.095, 0.073, 0.051, 0.009],
      white
    );
    for (let j = 0; j < 3; j++) {
      const x = 0.89 - j * 0.31,
        y = 3.5 + j * 0.29,
        z = 0.1 + s * (0.22 + j * 0.13);
      rod(deer, [x, y, z], [x + 0.12, y + 0.49, z + s * 0.11], 0.059, white, 0.007);
    }
  }
  const man = stand(-46.25, 43.9, 2, 1.64, mint);
  for (const [y, r] of [
    [0.83, 0.86],
    [1.8, 0.65],
    [2.6, 0.49],
  ])
    egg(man, snow, 0, y, 0, r, r, r * 0.97);
  part(man, cyl(24), iron, 0, 3.03, 0.04, 0.47, 0.07, 0.47);
  part(man, cyl(24, 0.94), iron, 0, 3.3, 0.04, 0.32, 0.48, 0.33);
  part(man, cyl(24), deep, 0.01, 2.27, 0.04, 0.48, 0.18, 0.48);
  box(man, deep, -0.29, 1.99, 0.52, 0.17, 0.56, 0.07);
  rod(man, [0.02, 2.6, 0.47], [0.14, 2.56, 0.89], 0.08, brass, 0.01);
  for (const s of [-1, 1]) {
    egg(man, iron, 0.02 + s * 0.15, 2.7, 0.48, 0.047, 0.047, 0.047);
    rod(man, [s * 0.49, 1.88, 0], [s * 1.42, 2.57, 0.18], 0.055, brass, 0.01);
  }
  const wood = new T.MeshStandardMaterial({
      color: 0x86563b,
      roughness: 0.81,
      emissive: 0x351a0c,
      emissiveIntensity: 0.24,
    }),
    trim = new T.MeshStandardMaterial({ color: 0x543d32, roughness: 0.83 });
  wood.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 timberPos;\n' + shader.vertexShader.replace(
      '#include <project_vertex>', '#include <project_vertex>\ntimberPos=(modelMatrix*vec4(transformed,1.)).xyz;'
    );
    shader.fragmentShader = 'varying vec3 timberPos;\n' + shader.fragmentShader.replace(
      '#include <color_fragment>', `#include <color_fragment>
        float along=timberPos.x*.77+timberPos.z*.69, across=timberPos.y;
        float plank=floor(across/.35), growth=sin(across*167.+sin(along*1.6+plank)*1.7+sin(along*.53)*2.5);
        float variation=fract(sin(plank*47.31)*1782.13);
        diffuseColor.rgb*=.78+.35*variation+.10*growth*(1.-smoothstep(.23,1.,fwidth(across)*160.));
      `
    );
  };
  const panePixels = new Uint8Array(160 * 96 * 4);
  for (let y = 0; y < 96; y++) for (let x = 0; x < 160; x++) {
    const u = x / 159, v = y / 95;
    const lamp = Math.exp(-((u-.34)**2*11 + (v-.62)**2*3));
    const edge = Math.min(1, 12*Math.min(u, 1-u, v, 1-v));
    const frost = (.5+.5*Math.sin(x*.7+Math.sin(y*.3)*3)) * (1-edge) * .12;
    const shelf = v < .15 + .07 * Math.sin(u*23)**6 ? .46 : 1;
    const l = (.45 + .43*lamp + .09*Math.sin(Math.PI*u)) * (.72+.28*edge) * shelf;
    panePixels.set([245*l+25*frost, (138+72*lamp)*l, (58+62*lamp)*l+43*frost, 255], (y*160+x)*4);
  }
  const paneTexture = new T.DataTexture(panePixels,160,96);
  paneTexture.colorSpace = T.SRGBColorSpace;
  paneTexture.minFilter = paneTexture.magFilter = T.LinearFilter;
  paneTexture.needsUpdate = true;
  const window = new T.MeshStandardMaterial({
    color: 0xffdec4, emissive: 0xffce9b, emissiveIntensity: 2.4, map: paneTexture,
    emissiveMap: paneTexture, roughness: .28, metalness: .08
  });
  const roofHooks = [], chimneys = [];
  const wool = [0x37625a,0x803a49,0x536c71,0x7d4a34,0x495d78].map(color =>
    new T.MeshStandardMaterial({color,roughness:.92,side:T.DoubleSide}));
  const linen = new T.MeshStandardMaterial({color:0xe1cfa8,roughness:.92,side:T.DoubleSide});
  const forest = new T.MeshStandardMaterial({color:0x294c39,roughness:.88});
  const bread = new T.MeshStandardMaterial({color:0xc3874e,roughness:.86});
  const ceramic = new T.MeshStandardMaterial({color:0x63848a,roughness:.32});
  const copper = k.metal(0xb36d45);
  function canopyCloth(p, cx, y, z, w, color) {
    const stripes=9, step=w/stripes, curve=[[0,.0],[.25,.024],[.62,-.068],[.98,-.22]];
    for(let i=0;i<stripes;i++){
      const a=cx-w*.5+i*step, b=a+step, pos=[], ix=[];
      for(const [depth,dy] of curve) pos.push(a,y+dy,z+depth,b,y+dy,z+depth);
      pos.push(a,y-.35,z+.992,(a+b)/2,y-.418,z+1.00,b,y-.35,z+.992);
      for(let row=0;row<curve.length-1;row++){const j=row*2;ix.push(j,j+2,j+1,j+1,j+2,j+3);}
      ix.push(6,8,9,6,9,7,7,9,10);
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(ix);g.computeVertexNormals();
      part(p,g,i%3===1?linen:color,0,0,0);
    }
    rod(p,[cx-w*.5,y-.2,z+.96],[cx+w*.5,y-.2,z+.96],.035,copper);
    for(const x of [cx-w*.47,cx+w*.47]) rod(p,[x,y-.65,z+.03],[x,y-.24,z+.95],.029,iron);
  }
  for (const [x, z, yaw, w, d, h, rise, shop] of [
    [34.8, 24.9, -0.49, 6.9, 5.4, 3.67, 2.7, '雪松茶屋'],
    [46.4, 24.7, -0.68, 6.4, 5.15, 3.41, 2.16, '冰灯工坊'],
    [40, 38.9, -1.13, 7.3, 5.68, 3.62, 2.69, '暖炉咖啡'],
    [52, 39.1, -0.92, 6.7, 5.2, 3.39, 2.32, '松果邮局'],
    [48.5, 52.7, -1.25, 7.15, 5.53, 3.48, 2.12, '雪夜烘焙'],
  ]) {
    const b = node(group, x, 0, z);
    b.rotation.y = yaw;
    const shopIndex = roofHooks.length;
    const world = (lx,ly,lz) => V(x+lx*Math.cos(yaw)+lz*Math.sin(yaw),ly,z-lx*Math.sin(yaw)+lz*Math.cos(yaw));
    const end = d / 2,
      half = w / 2,
      span = half + 0.58,
      peak = h + rise,
      len = Math.hypot(span, rise);
    box(b, iron, 0, 0.19, 0.19, w + 0.47, 0.38, d + 0.89);
    box(b, wood, 0, h * 0.5 + 0.12, 0, w, h - 0.12, d);
    const sh = new T.Shape();
    sh.moveTo(-half, h - 0.05);
    sh.lineTo(half, h - 0.05);
    sh.lineTo(0, peak - 0.08);
    sh.closePath();
    part(b, new T.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false }), wood, 0, 0, -end);
    for (let j = 1; j < h / 0.35; j++)
      for (const s of [-1, 1]) {
        box(b, trim, 0, 0.21 + j * 0.35, s * (end + 0.014), w + 0.08, 0.035, 0.06);
        box(b, trim, s * (half + 0.012), 0.21 + j * 0.35, 0, 0.06, 0.035, d + 0.05);
      }
    for (const s of [-1, 1]) {
      const a = -s * Math.atan2(rise, span);
      box(b, trim, s * span * 0.5, h + rise * 0.5, 0, len, 0.18, d + 1.3).rotation.z = a;
      box(b, snow, s * span * 0.5, h + rise * 0.5 + 0.15, 0, len + 0.08, 0.18, d + 1.36).rotation.z = a;
      rod(b, [0, peak - 0.11, end + 0.64], [s * span, h - 0.11, end + 0.64], 0.095, wood);
      rod(
        b,
        [s * (half - 0.13), h + 0.08, end + 0.07],
        [s * 0.49, h + rise * 0.66, end + 0.07],
        0.066,
        trim
      );
      box(b, window, s * (half + 0.035), 1.85, 0, 0.07, 1.25, 1.65);
      box(b, trim, s * (half + 0.09), 1.85, 0, 0.07, 0.07, 1.73);
      box(b, trim, s * (half + 0.09), 1.85, 0, 0.07, 1.3, 0.07);
    }
    box(b, trim, w * 0.3, 1.42, end + 0.06, 1.16, 2.14, 0.15);
    box(b, wood, w * 0.3, 1.41, end + 0.15, 0.94, 1.97, 0.1);
    box(b, window, w * 0.3, 1.76, end + 0.21, 0.6, 0.77, 0.035);
    const cx = -w * 0.14,
      cw = w * 0.47;
    box(b, trim, cx, 1.94, end + 0.05, cw + 0.18, 1.43, 0.15);
    box(b, window, cx, 1.94, end + 0.145, cw, 1.23, 0.07);
    box(b, trim, cx, 1.94, end + 0.194, cw, 0.07, 0.05);
    for (const t of [-0.26, 0.25]) box(b, trim, cx + cw * t, 1.94, end + 0.194, 0.07, 1.25, 0.05);
    box(b, wood, cx, 1.25, end + 0.34, cw + 0.54, 0.14, 0.79);
    for (const s of [-1,1]) {
      const sx = cx + s * (cw*.5 + .25);
      box(b, trim, sx, 1.93, end+.13, .39, 1.38, .11);
      for (let row = 0; row < 6; row++) {
        const slat = box(b, wood, sx, 1.41 + row*.195, end+.205, .32, .12, .07);
        slat.rotation.x = -.22;
      }
      box(b, snow, sx, 2.63, end+.14, .43, .058, .18);
      box(b, trim, s*(half-.11), h*.51, end+.075, .16, h-.10, .19);
    }
    for (let j = 0; j < 4; j++) {
      const sx = cx + (j-1.5)*cw*.19, hh = .22 + .10*((j+Math.round(x))%3);
      part(b, cyl(14,.86), j%2 ? brass : trim, sx, 1.34+hh*.5, end+.46, .118, hh, .118);
      part(b, cyl(14), brass, sx, 1.35+hh, end+.46, .125, .045, .125);
    }
    const sign = document.createElement('canvas');
    sign.width = 384; sign.height = 80;
    const ink = sign.getContext('2d');
    ink.fillStyle = '#263a38'; ink.fillRect(0,0,384,80);
    ink.strokeStyle = '#c09a67'; ink.lineWidth = 3; ink.strokeRect(5,5,374,70);
    ink.fillStyle = '#ffe4ae'; ink.font = '600 45px "Microsoft YaHei", sans-serif'; ink.textAlign = 'center';
    ink.fillText(shop,192,55);
    const label = new T.CanvasTexture(sign);
    label.colorSpace = T.SRGBColorSpace;
    box(b, trim, cx, h-.3, end+.14, 2.65, .53, .22);
    part(b, new T.PlaneGeometry(2.57,.48), new T.MeshBasicMaterial({map:label}), cx,h-.3,end+.255,1,1,1);
    box(b, snow, cx, h-.022, end+.14, 2.7, .065, .28);
    const counterZ = end+.36;
    colliders.push({type:'obb', x:x+cx*Math.cos(yaw)+counterZ*Math.sin(yaw),
      z:z-cx*Math.sin(yaw)+counterZ*Math.cos(yaw), w:cw+.56, d:.8, rotation:yaw, maxY:1.4});
    canopyCloth(b,cx,2.96,end+.07,cw+.85,wool[shopIndex]);
    const hook=world(-half*.55,h+rise*.52,end+.66);
    roofHooks.push(hook);
    chimneys.push(world(-half*.52,peak+.77,-end*.47));
    const windowSpill=world(cx,.1,end+2.3);
    lighting?.pool(windowSpill.x,windowSpill.z,3.8,6.2,-yaw,[1,.41,.105],.83);
    lighting?.contact(x,z,half+1.15,end+1.26,.71,-yaw);
    // Merchandise is scaled to the actual counter, behind its existing collision boundary.
    for (let i=0;i<3;i++) {
      const xx=cx+(.15+i*.23)*cw-cw*.48, zz=end+.60;
      if(shopIndex===4){
        const loaf=egg(b,bread,xx,1.46,zz,.185,.113,.12);
        loaf.rotation.y=.24*i; rod(b,[xx-.06,1.545,zz-.03],[xx+.043,1.55,zz+.05],.009,linen);
      } else if(shopIndex===0 || shopIndex===2) {
        part(b,cyl(16,1,.77),shopIndex===2?linen:ceramic,xx,1.45,zz,.094,.19,.094);
        const handle=part(b,new T.TorusGeometry(.049,.013,6,16),copper,xx+.099,1.46,zz);
        handle.scale.x=.85;
      } else if(shopIndex===1) {
        egg(b,i%2?mint:gold,xx,1.53,zz,.106,.16,.103);
        part(b,cyl(8),brass,xx,1.39,zz,.105,.052,.104);
      } else {
        box(b,linen,xx,1.42,zz,.23,.125,.18);box(b,copper,xx,1.484,zz,.032,.009,.18);
      }
    }
    for(let i=0;i<16;i++){
      const u=i/15, xx=(u-.5)*(w-.12);
      const yy=h-.09+.21*Math.cos(u*Math.PI*4);
      egg(b,forest,xx,yy,end+.39,.28,.12,.15);
      if(i%4===1) egg(b,gold,xx,yy-.10,end+.47,.060,.067,.058);
    }
    for (let j = 0; j < 13; j++) {
      const f = j / 12,
        px = (f - 0.5) * (w + 1.04),
        py = h - 0.17 + (1 - Math.abs(2 * f - 1)) * rise;
      egg(b, j % 6 ? gold : mint, px, py, end + 0.69, 0.066, 0.066, 0.066);
      if (j % 2)
        rod(
          b,
          [px + 0.12, py + 0.06, end + 0.67],
          [px + 0.12, py - 0.2 - (j % 3) * 0.07, end + 0.67],
          0.04,
          white,
          0.002
        );
    }
    box(b, iron, -half * 0.52, peak - 0.38, -end * 0.47, 0.66, 2.1, 0.68);
    box(b, snow, -half * 0.52, peak + 0.69, -end * 0.47, 0.83, 0.09, 0.85);
    colliders.push({ type: 'obb', x, z, w: w + 0.28, d: d + 0.55, rotation: yaw, maxY: peak });
  }
  // Garlands are suspended from existing roof hooks and the spruce beside the market path.
  const treeHook=V(28.9,6.72,40.8);
  for(const [start,end] of [[treeHook,roofHooks[0]],[treeHook,roofHooks[2]],[roofHooks[2],roofHooks[4]],[roofHooks[0],roofHooks[1]],[roofHooks[1],roofHooks[3]]]){
    const span=start.distanceTo(end), sag=Math.min(span*.061,.94);
    const along = t => {const p=start.clone().lerp(end,t);p.y-=4*sag*t*(1-t);return p;};
    const pts=Array.from({length:10},(_,i)=>along(i/9));
    part(group,new T.TubeGeometry(new T.CatmullRomCurve3(pts),18,.026,5,false),iron,0,0,0);
    const count=Math.floor(span/.86);
    for(let i=1;i<count;i++){
      const p=along(i/count), ornate=i%4===1, drop=ornate?.33:.105;
      rod(group,[p.x,p.y,p.z],[p.x,p.y-drop,p.z],.015,iron);
      egg(group,ornate?gold:i%3?gold:mint,p.x,p.y-drop-.046,p.z,ornate?.135:.078,ornate?.19:.087,ornate?.135:.078);
      if(ornate){
        part(group,cyl(8,.42,1),copper,p.x,p.y-drop+.08,p.z,.15,.12,.15);
        part(group,cyl(8),brass,p.x,p.y-drop-.22,p.z,.087,.042,.087);
      }
    }
  }
  // Low-opacity, wind-bent puffs rise from the working chimneys in a single draw call.
  const plumePos=[], phase=[];
  for(const p of chimneys)for(let i=0;i<9;i++){p.toArray(plumePos,plumePos.length);phase.push((i+.28*Math.sin(i*3+p.x))/9);}
  const pg=new T.BufferGeometry();
  pg.setAttribute('position',new T.Float32BufferAttribute(plumePos,3));pg.setAttribute('phase',new T.Float32BufferAttribute(phase,1));
  const smoke=new T.Points(pg,new T.ShaderMaterial({
    transparent:true,depthWrite:false, uniforms:{t:k.clock,night:k.nightLight},
    vertexShader:`attribute float phase;uniform float t;varying float age; varying float puff;
    void main(){age=fract(t*.104+phase);puff=phase*73.;vec3 p=position;
    p.y+=age*4.5;p.x+=age*age*2.3+.20*age*sin(t*.54+puff);p.z+=.42*age*sin(puff+age*3.);
    vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((.23+age*.82)*420./max(1.,-mv.z),1.,62.);}`,
    fragmentShader:`varying float age,puff;uniform float night;void main(){
    vec2 q=gl_PointCoord-.5;float r=length(q)*(1.+.15*sin(puff+q.x*11.)*cos(q.y*9.));
    float a=(1.-smoothstep(.08,.51,r))*(1.-age)*smoothstep(.0,.17,age)*.235;
    gl_FragColor=vec4(mix(vec3(.48,.50,.51),vec3(.39,.32,.31),night),a);}`
  }));
  smoke.frustumCulled=false;group.add(smoke);
  return {
    group,
    colliders,
    update(t) {
      hoop.rotation.z = -0.28 + 0.1 * Math.sin(t * 0.23);
    },
  };
}
