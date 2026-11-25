'use strict';

function mapArt(canvas, player, places, selected, visited, big = false) {
  const rect = canvas.getBoundingClientRect(),
    w = Math.max(1, rect.width),
    h = Math.max(1, rect.height),
    dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const c = canvas.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sx = (w - 10) / 165,
    sz = (h - 9) / 179,
    s = Math.min(sx, sz),
    x0 = w * 0.5,
    z0 = h * 0.5 - 12 * s,
    pt = (x, z) => [x0 + x * s, z0 + z * s];
  const rectAt = (x, z, rx, rz, color) => {
    const p = pt(x - rx / 2, z - rz / 2);
    c.fillStyle = color;
    c.fillRect(p[0], p[1], rx * s, rz * s);
  };
  const grad = c.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#223f4a');
  grad.addColorStop(1, '#112a39');
  c.fillStyle = grad;
  c.fillRect(0, 0, w, h);
  c.lineWidth = 0.7;
  c.save();
  c.globalAlpha = 0.22;
  c.strokeStyle = '#729b98';
  for (let k = -2; k < 16; k++) {
    const side = k % 2 === 0 ? -1 : 1;
    c.beginPath();
    for (let i = 0; i <= 92; i++) {
      const y = (i / 92) * h,
        x =
          side < 0
            ? -16 + k * 1.2 + Math.sin(i * 0.055 + k * 0.34) * 12 + Math.sin(i * 0.155) * 2
            : w - 4 - k * 1.55 + Math.sin(i * 0.079 + k * 0.3) * 13;
      if (i) c.lineTo(x, y);
      else c.moveTo(x, y);
    }
    c.stroke();
  }
  c.restore();
  const road = (arr, width, col) => {
    c.beginPath();
    arr.forEach(([x, z], i) => {
      const q = pt(x, z);
      if (i) c.lineTo(...q);
      else c.moveTo(...q);
    });
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.strokeStyle = col;
    c.lineWidth = Math.max(0.55, s * width);
    c.stroke();
  };
  for (const path of [
    [
      [0, 87],
      [0, -35],
    ],
    [
      [0, 57],
      [-16, 52],
      [-29, 43],
      [-40, 34],
      [-46, 18],
      [-48, -17],
    ],
    [
      [0, 54],
      [16, 50],
      [25, 43],
      [30, 31],
      [41, 13],
      [51, -14],
    ],
    [
      [0, 80],
      [-18, 78],
      [-34, 70],
      [-46, 69],
    ],
    [
      [0, 80],
      [16, 78],
      [28, 70],
      [44, 70],
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
  ]) {
    road(path, path.length === 2 ? 9 : 4.8, '#577b80');
    road(path, path.length === 2 ? 7 : 2.8, '#33555e');
  }
  const ell = (x, z, rx, rz, fill, stroke) => {
    const p = pt(x, z);
    c.beginPath();
    c.ellipse(p[0], p[1], rx * s, rz * s, 0, 0, Math.PI * 2);
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    if (stroke) {
      c.lineWidth = 0.8;
      c.strokeStyle = stroke;
      c.stroke();
    }
  };
  ell(0, 10, 18.5, 13, '#32545f', '#729393');
  ell(43, 70, 15, 10, '#315e69', '#739da0');
  ell(-44, 70, 12, 9, '#294852', '#54757c');
  rectAt(0, -42, 55, 16, '#4a6c79');
  rectAt(0, -49, 14, 24, '#678591');
  for (const [x, z, r] of [
    [-30, -39, 3.5],
    [30, -39, 3.5],
    [-15, -52, 4],
    [15, -52, 4],
    [-9, -33, 3],
    [9, -33, 3],
  ])
    ell(x, z, r, r, '#75919b', '#94abb1');
  ell(52, -19, 16.5, 12, null, '#a48ca2');
  ell(52, -19, 12.4, 8.3, null, '#718492');
  road(
    [
      [-53, -17],
      [-58, -24],
      [-61, -21],
      [-56, -15],
      [-41, -13],
      [-39, -5],
      [-41, 1],
      [-30, 17],
    ],
    2.8,
    '#7798a5'
  );
  for (const [x, z] of [
    [35, 25],
    [46, 25],
    [40, 39],
    [52, 39],
    [49, 53],
  ])
    rectAt(x, z, 6.9, 5.4, '#918c80');
  for (const [x, z] of [
    [-40, 26],
    [-49, 33],
    [-36, 40],
    [-46, 44],
  ])
    ell(x, z, 3.1, 2.1, '#64848b');
  const hits = [];
  for (let i = 0; i < places.length; i++) {
    const a = places[i],
      p = pt(a.x, a.z);
    hits.push({ i, x: p[0], y: p[1] });
    if (!big && a.id === 'snow') continue;
    const rad = big ? 7.6 : 1.9;
    c.beginPath();
    c.arc(p[0], p[1], rad, 0, Math.PI * 2);
    c.fillStyle = big
      ? selected === i
        ? '#a6f3da'
        : '#244650'
      : a.id === 'wheel'
      ? '#ddb1db'
      : '#a4d4cc';
    c.fill();
    if (big) {
      c.strokeStyle = selected === i ? '#ddfff1' : '#85aaa5';
      c.lineWidth = 1.25;
      c.stroke();
      c.fillStyle = selected === i ? '#224545' : '#e0efed';
      c.font = '600 9px "Segoe UI",sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(String(i + 1), p[0], p[1] + 0.4);
    }
  }
  const q = pt(player.pos.x, player.pos.z);
  c.save();
  c.translate(...q);
  c.rotate(player.yaw);
  const r = big ? 6.7 : 4.8;
  const gl = c.createRadialGradient(0, 0, 0, 0, 0, r * 3.1);
  gl.addColorStop(0, '#abffdc65');
  gl.addColorStop(1, '#a5f9d600');
  c.fillStyle = gl;
  c.beginPath();
  c.arc(0, 0, r * 3.1, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#a6f6d7';
  c.strokeStyle = '#092a31';
  c.lineWidth = 1.4;
  c.beginPath();
  c.moveTo(0, -r * 1.48);
  c.lineTo(r * 0.85, r);
  c.lineTo(0, r * 0.62);
  c.lineTo(-r * 0.85, r);
  c.closePath();
  c.fill();
  c.stroke();
  c.restore();
  if (big) {
    c.fillStyle = '#c0d4d4';
    c.font = '600 11px "Segoe UI",sans-serif';
    c.textAlign = 'left';
    c.fillText('N', 12, 18);
  }
  return hits;
}
function compassArt(cnv, yaw) {
  const w = cnv.clientWidth,
    h = cnv.clientHeight;
  if (w < 1 || h < 1) return;
  const d = Math.min(2, window.devicePixelRatio || 1);
  if (cnv.width !== Math.round(w * d) || cnv.height !== Math.round(h * d)) {
    cnv.width = Math.round(w * d);
    cnv.height = Math.round(h * d);
  }
  const c = cnv.getContext('2d');
  c.setTransform(d, 0, 0, d, 0, 0);
  c.clearRect(0, 0, w, h);
  const deg = (yaw * 180) / Math.PI,
    px = w / 96,
    names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  for (let v = Math.floor((deg - 50) / 5) * 5; v <= deg + 50; v += 5) {
    const x = w / 2 + (v - deg) * px,
      off = ((v % 360) + 360) % 360,
      major = off % 15 === 0;
    c.strokeStyle = off === 0 ? '#a4eed9' : '#d6edf0b8';
    c.lineWidth = major ? 1.3 : 0.85;
    c.beginPath();
    c.moveTo(x, h - 9);
    c.lineTo(x, h - (major ? 16 : 12));
    c.stroke();
    if (major) {
      c.font = (off % 45 === 0 ? '600 12px ' : '10px ') + '"Segoe UI",sans-serif';
      c.fillStyle = off === 0 ? '#a5f4dc' : '#dbe9eb';
      c.textAlign = 'center';
      c.fillText(off % 45 === 0 ? names[off / 45] : String(off), x, h - 21);
    }
  }
}
const skatingRink = { x: 43, z: 70, rx: 15, rz: 10 };
function railFraction(rail, x, z) {
  return Math.max(-0.5, Math.min(0.5, ((x - rail.x) * rail.dx + (z - rail.z) * rail.dz) * rail.invLengthSq));
}
// Resolve capsule/rail contact in the horizontal plane. Removing only the inward velocity leaves the tangent free.
function resolveRinkRail(pos, velocity, fromX, fromZ, radius, rails) {
  const ring = ((pos.x - skatingRink.x) / skatingRink.rx) ** 2 + ((pos.z - skatingRink.z) / skatingRink.rz) ** 2;
  if (ring < 0.76 || ring > 1.27) return -Infinity;
  let support = -Infinity;
  for (let pass = 0; pass < 3; pass++) {
    let adjusted = false;
    for (const rail of rails) {
      const t = railFraction(rail, pos.x, pos.z), cx = rail.x + t * rail.dx, cz = rail.z + t * rail.dz;
      let nx = pos.x - cx, nz = pos.z - cz;
      const distance = Math.hypot(nx, nz), limit = radius + rail.r;
      if (distance >= limit) continue;
      if (pos.y >= rail.maxY - 0.015) {
        support = Math.max(support, rail.maxY);
        continue;
      }
      if (distance > 1e-7) {
        nx /= distance; nz /= distance;
      } else {
        const length = Math.hypot(rail.dx, rail.dz);
        nx = -rail.dz / length; nz = rail.dx / length;
        if ((fromX - cx) * nx + (fromZ - cz) * nz < 0) { nx = -nx; nz = -nz; }
      }
      pos.x += nx * (limit - distance + 0.0001);
      pos.z += nz * (limit - distance + 0.0001);
      const inward = Math.min(0, velocity.x * nx + velocity.z * nz);
      velocity.x -= inward * nx;
      velocity.z -= inward * nz;
      adjusted = true;
    }
    if (!adjusted) break;
  }
  return support;
}
function canOccupy(x, z, foot, bodyRadius, bodyHeight, colliders) {
  if (x < -77 || x > 77 || z < -75 || z > 92) return false;
  for (const c of colliders) {
    if (foot >= (c.maxY ?? 100) - 0.015 || foot + bodyHeight <= (c.minY ?? -1) + 0.015) continue;
    const dx = x - c.x,
      dz = z - c.z;
    if (c.type === 'rinkRail') {
      const t = railFraction(c, x, z);
      if ((dx - t * c.dx) ** 2 + (dz - t * c.dz) ** 2 < (c.r + bodyRadius) ** 2) return false;
      continue;
    }
    if (c.type === 'circle') {
      if (dx * dx + dz * dz < (c.r + bodyRadius) ** 2) return false;
      continue;
    }
    const rot = c.rotation || 0,
      co = rot ? Math.cos(rot) : 1,
      si = rot ? Math.sin(rot) : 0,
      lx = dx * co - dz * si,
      lz = dx * si + dz * co;
    const ex = Math.max(Math.abs(lx) - c.w / 2, 0),
      ez = Math.max(Math.abs(lz) - c.d / 2, 0);
    if (ex * ex + ez * ez < bodyRadius ** 2) return false;
  }
  return true;
}
function guidebook(r) {
  return [
    {
      id: 'plaza',
      area: 'plaza',
      n: '中心广场',
      en: 'CENTRAL PLAZA',
      x: 0,
      z: 10,
      go: [0, 0.09, 70],
      face: [0, -38],
      icon: 'crystal',
      detail: '沿冰晶大道向北，可抵达城堡正门。',
    },
    {
      id: 'castle',
      area: 'castle',
      n: '冰雪城堡',
      en: 'ICE PALACE',
      x: 0,
      z: -40,
      go: [0, 0.09, -27],
      face: [0, -51],
      icon: 'castle',
      detail: '穿过双层尖拱，在玫瑰花窗下听一段冰钟。',
    },
    {
      id: 'wheel',
      area: 'wheel',
      n: '雪花摩天轮',
      en: 'SNOWFLAKE WHEEL',
      x: 53,
      z: -19,
      go: [r.wheelEntry.x, 0.82, r.wheelEntry.z],
      face: [0, 15],
      icon: 'wheel',
      detail: '从南侧登乘台上车，随雪花轮缓缓升至高空。',
    },
    {
      id: 'slide',
      area: 'slide',
      n: '超级冰滑梯',
      en: 'GLACIER SLIDE',
      x: -49,
      z: -13,
      go: [r.stairFoot.x, 0.09, r.stairFoot.z + 1],
      face: [-46, -12],
      icon: 'slide',
      detail: '沿台阶登顶，或在入口按 E 直达高台。',
    },
    {
      id: 'art',
      area: 'art',
      n: '冰雕艺廊',
      en: 'ICE GALLERY',
      x: -43,
      z: 35,
      go: [-36, 0.09, 34],
      face: [-41, 26],
      icon: 'gem',
      detail: '冰龙、凤凰和鹿分立在林间的展台上。',
    },
    {
      id: 'town',
      area: 'town',
      n: '冰雪商业街',
      en: 'WINTER VILLAGE',
      x: 41,
      z: 37,
      go: [30.5, 0.09, 31],
      face: [36, 26],
      icon: 'house',
      detail: '暖灯木屋与挂满彩灯的云杉围成一条小街。',
    },
    {
      id: 'ice',
      area: 'ice',
      n: '冰上游乐场',
      en: 'FROZEN POND',
      x: 43,
      z: 69,
      go: [28.7, 0.09, 70],
      face: [47, 68],
      icon: 'skate',
      detail: '西门直通园路。冰鞋可随处穿脱，冰面滑行，雪地步行。',
    },
    {
      id: 'snow',
      area: 'ice',
      n: '雪仗靶场',
      en: 'SNOWBALL RANGE',
      x: -44,
      z: 70,
      go: [-33, 0.09, 70],
      face: [-50, 70],
      icon: 'target',
      detail: '用雪球击中三座雪人胸前的彩色圆靶。',
    },
  ];
}
