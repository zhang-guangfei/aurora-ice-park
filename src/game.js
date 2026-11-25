'use strict';

function showStartupIssue(message) {
  const loader = document.getElementById('loading');
  if (!loader) return;
  loader.hidden = false;
  loader.classList.remove('done');
  loader.querySelector('span').textContent = message;
  loader.querySelector('i').hidden = true;
  const button = loader.querySelector('button') || document.createElement('button');
  const inlineProject = !!document.getElementById('park-three')?.textContent;
  button.className = 'plain primary';
  button.textContent = inlineProject ? '下载离线项目' : '重新载入';
  button.onclick = () => {
    if (!inlineProject || !offerProject()) location.reload();
  };
  loader.append(button);
}

function play(T) {
  const $ = (id) => document.getElementById(id),
    game = $('game'),
    canvas = $('scene'),
    screen = $('hud');
  const now = () => performance.now() / 1000,
    clamp = (v, a, b) => Math.max(a, Math.min(b, v)),
    V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
  icons(game);
  if (window.parent !== window.self) document.documentElement.classList.add('embedded');
  const isTouch =
    matchMedia('(pointer:coarse)').matches || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
  if (isTouch) game.classList.add('touch');
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem('frostbound.park.v1') || '{}') || {};
  } catch {}
  const collected = new Set(
      Array.isArray(saved.crystals)
        ? saved.crystals.filter((id) => Number.isInteger(id) && id >= 0 && id < 7)
        : []
    ),
    visited = new Set(
      Array.isArray(saved.visited)
        ? saved.visited.filter((id) =>
            ['plaza', 'castle', 'wheel', 'slide', 'art', 'town', 'ice'].includes(id)
          )
        : []
    );
  visited.add('plaza');
  let quality = ['high', 'medium', 'low'].includes(saved.quality)
      ? saved.quality
      : isTouch
      ? 'medium'
      : 'high',
    timeMode = ['night', 'dusk', 'day'].includes(saved.time) ? saved.time : 'night',
    third = !!saved.third,
    muted = true;
  const audio = soundscape();
  if (Number.isFinite(saved.volume)) audio.level(clamp(saved.volume, 0, 1));
  const save = () => {
    try {
      localStorage.setItem(
        'frostbound.park.v1',
        JSON.stringify({
          crystals: [...collected],
          visited: [...visited],
          quality,
          time: timeMode,
          third,
          volume: audio.volume,
        })
      );
    } catch {}
  };
  let renderer;
  try {
    renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
      preserveDrawingBuffer: false,
      failIfMajorPerformanceCaveat: false,
    });
  } catch {
    showStartupIssue('浏览器未能启动 WebGL。请开启浏览器的硬件加速，或换一个支持 WebGL 的浏览器打开。');
    return;
  }
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera(54, 1, 0.065, 620);
  scene.background = new T.Color(0x12304b);
  const kit = makeKit(T, renderer, scene),
    sky = atmosphere(T, scene, kit),
    terrain = ground(T, renderer, scene, camera, kit),
    post = postFX(T, renderer, scene, camera);
  const castle = buildCastle(T, kit),
    rides = buildRides(T, kit),
    sculptures = art(T, kit),
    woods = landscape(T, kit),
    people = visitors(T, kit);
  const colliders = [];
  castle.group.position.z = -44;
  for (const [model, zOff] of [
    [castle, -44],
    [rides, 0],
    [sculptures, 0],
    [woods, 0],
    [people, 0],
  ]) {
    batch(T, model.group);
    scene.add(model.group);
    for (const c of model.colliders) colliders.push({ ...c, z: c.z + zOff });
  }
  // The opening above the last flight lets the capsule step onto the deck.
  colliders.push(
    { type: 'box', x: -49.525, z: -16.18, w: 12.25, d: 4.2, minY: 17.84, maxY: 18.6 },
    { type: 'box', x: -52.18, z: -13.35, w: 6.94, d: 1.42, minY: 17.84, maxY: 18.6 },
    { type: 'box', x: -43.83, z: -13.35, w: 0.86, d: 1.42, minY: 17.84, maxY: 18.6 }
  );
  const fx = effects(T, scene, kit);
  scene.add(people.avatar);
  const places = guidebook(rides);
  const player = { pos: V(0, 0.09, 70), yaw: 0, pitch: 0.164, speed: 0, grounded: true, skating: false },
    velocity = V(),
    photoPos = V(),
    lookDir = V(),
    cameraGoal = V();
  let vy = 0,
    mode = 'walk',
    region = 'plaza',
    nav = 1,
    picked = 0,
    dialog = '',
    photo = false,
    photoBack = null,
    rideClock = 0,
    seat = 0,
    slideU = 0,
    slideSpeed = 4.0,
    shootDelay = 0,
    tourTime = 0,
    stepDistance = 0,
    airFromGround = 0.08,
    festivalEnd = 0,
    specialEnd = 0,
    toastEnd = 0,
    globalTime = 0,
    shotHits = new Set(),
    near = null,
    mobileRun = false,
    held = Object.create(null),
    stick = { x: 0, y: 0 },
    drag = null,
    joyId = null,
    paused = false,
    adaptive = 1,
    recentFps = 0,
    sampleTime = 0,
    sampleFrames = 0;
  const clockCrystal = new T.Group(),
    gemGeo = new T.LatheGeometry(
      [
        [0.02, -0.7],
        [0.34, -0.21],
        [0.34, 0.23],
        [0.045, 0.66],
        [0.012, 0.7],
      ].map((p) => new T.Vector2(...p)),
      6
    ).toNonIndexed();
  gemGeo.computeVertexNormals();
  const gemMat = kit.ice(0x76eadd, { emissiveIntensity: 0.56 }),
    edgeMat = new T.LineBasicMaterial({ color: 0xadfff1, transparent: true, opacity: 0.78 }),
    gemEdges = new T.EdgesGeometry(gemGeo, 17);
  const crystals = [
    [-8.1, 0.09, 16.7],
    [0, 0.09, -51],
    [-54.1, 18.62, -14.6],
    [58.9, 0.09, -9.1],
    [-44.4, 0.09, 37.8],
    [34.9, 0.09, 34.3],
    [44, 0.09, 63.7],
  ].map(([x, y, z], i) => {
    const g = new T.Group();
    g.position.set(x, y + 1.08, z);
    const core = new T.Mesh(gemGeo, gemMat);
    g.add(core, new T.LineSegments(gemEdges, edgeMat));
    const orbital = new T.Mesh(new T.TorusGeometry(0.5, 0.013, 5, 40), kit.glow(0x9ce7de, 0.94));
    orbital.rotation.set(1.13, 0, 0.34);
    g.add(orbital);
    g.visible = !collected.has(i);
    clockCrystal.add(g);
    return { g, x, y, z, i };
  });
  scene.add(clockCrystal);
  const snowballGeo = new T.SphereGeometry(0.145, 14, 10),
    balls = [],
    hot = () => document.activeElement?.matches?.('input,select,textarea'),
    dist = (x, z) => Math.hypot(x - player.pos.x, z - player.pos.z),
    localeTime = { night: '夜晚', dusk: '黄昏', day: '白天' },
    localeMode = {
      walk: '自由探索',
      wheel: '摩天轮观景',
      slide: '冰道滑行',
      skate: '冰上漫游',
      snow: '雪球挑战',
    };
  const can = (x, z, y = player.pos.y, r = 0.34, h = 1.63) => canOccupy(x, z, y, r, h, colliders);
  function toast(s) {
    $('toast').textContent = s;
    $('toast').classList.add('on');
    toastEnd = now() + 2.75;
  }
  function dpr() {
    const cap = quality === 'high' ? 1.45 : quality === 'medium' ? 1.13 : 0.83;
    return (
      Math.min(
        window.devicePixelRatio || 1,
        cap,
        Math.sqrt(2200000 / Math.max(1, game.clientWidth * game.clientHeight))
      ) * adaptive
    );
  }
  function resize() {
    const w = Math.max(1, game.clientWidth),
      h = Math.max(1, game.clientHeight),
      pr = dpr();
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    if (!photo) camera.fov = w / h < 1 ? 66 : 54;
    camera.updateProjectionMatrix();
    const res = renderer.getDrawingBufferSize(new T.Vector2());
    post.resize(res.x, res.y, quality);
    terrain.resize(res.x, res.y, quality);
    kit.quality(quality);
    woods.setQuality(quality);
    sky.quality(quality, pr);
    fx.quality(quality, pr);
    renderer.shadowMap.enabled = quality !== 'low';
    renderer.shadowMap.needsUpdate = true;
    sky.moon.castShadow = quality !== 'low';
    sky.moon.shadow.mapSize.setScalar(quality === 'high' ? 1536 : 1024);
    if (sky.moon.shadow.map) {
      sky.moon.shadow.map.dispose();
      sky.moon.shadow.map = null;
    }
  }
  function setTime(t) {
    timeMode = t;
    sky.setMode(t);
    $('timeLabel').textContent = localeTime[t];
    $('timeBtn').querySelector('svg').dataset.i = t === 'night' ? 'moon' : t === 'day' ? 'sun' : 'dusk';
    icons($('timeBtn'));
    save();
  }
  function setQuality(v) {
    quality = v;
    adaptive = 1;
    recentFps = sampleTime = sampleFrames = 0;
    resize();
    save();
    toast('画质已切换为' + { high: '高', medium: '中', low: '低' }[v] + '档');
  }
  function stats() {
    const pc = Math.round((visited.size / 7) * 100);
    $('explored').textContent = pc + '%';
    $('explored').title = '园区探索 ' + visited.size + ' / 7';
    $('count').textContent = collected.size;
    [...$('ticks').children].forEach((o, i) => o.classList.toggle('lit', i < collected.size));
    $('goal').textContent = collected.size === 7 ? '已解锁极光盛典' : '集齐冰晶，点亮极光盛典';
  }
  function face(x, z, pitch = 0.06) {
    player.yaw = Math.atan2(x - player.pos.x, -(z - player.pos.z));
    player.pitch = pitch;
  }
  function stop() {
    held = Object.create(null);
    stick.x = stick.y = 0;
    velocity.set(0, 0, 0);
    player.speed = 0;
    drag = null;
    joyId = null;
    $('joy').firstElementChild.style.transform = '';
  }
  function relocate(x, y, z) {
    player.pos.set(x, y, z);
    velocity.set(0, 0, 0);
    vy = 0;
    player.grounded = true;
    stepDistance = 0;
    syncCamera(true);
  }
  function leaveMode() {
    const old = mode;
    mode = 'walk';
    player.skating = false;
    if (old === 'wheel') {
      const p = rides.wheelEntry;
      relocate(p.x, 0.815, p.z);
      face(0, 14);
    } else if (old === 'slide') {
      const p = rides.slideExit;
      relocate(p.x + 1, 0.09, p.z + 1);
      face(0, -36);
    } else if (old === 'snow') {
      for (const b of balls) b.o.removeFromParent();
      balls.length = 0;
    }
    velocity.set(0, 0, 0);
    $('modeLabel').textContent = localeMode[mode];
    $('banner').hidden = true;
  }
  function travel(i) {
    if (photo) endPhoto();
    if (mode !== 'walk') leaveMode();
    const dest = places[i];
    closeDialog();
    relocate(...dest.go);
    face(
      ...dest.face,
      dest.id === 'plaza' ? 0.164 : dest.id === 'castle' ? 0.19 : dest.id === 'slide' ? 0.22 : 0.06
    );
    syncCamera(true);
    nav = i;
    updateArea();
    detect();
    toast('已到达' + dest.n);
  }
  function updateArea() {
    if (photo) return;
    const { x, z } = player.pos;
    let id = 'plaza';
    if (mode === 'wheel' || (x > 34 && z < 8)) id = 'wheel';
    else if (mode === 'slide' || (x < -26 && z < 21)) id = 'slide';
    else if (z < -26 && Math.abs(x) < 38) id = 'castle';
    else if (x < -29 && z >= 21 && z < 54) id = 'art';
    else if (x > 29 && z >= 16 && z < 57) id = 'town';
    else if ((Math.abs(x) > 27 && z > 56) || mode === 'skate' || mode === 'snow') id = 'ice';
    region = id;
    const dest = places.find((p) => p.id === id);
    $('regionLabel').textContent = id === 'ice' && x < 0 ? '雪仗靶场' : dest.n;
    if (!visited.has(id)) {
      visited.add(id);
      save();
      stats();
      toast('发现新区域 · ' + dest.n);
    }
  }
  function look() {
    const cp = Math.cos(player.pitch);
    return lookDir.set(Math.sin(player.yaw) * cp, Math.sin(player.pitch), -Math.cos(player.yaw) * cp);
  }
  function syncCamera(jump = false) {
    const dir = look();
    let eye = player.pos.clone();
    eye.y += mode === 'slide' ? 0.87 : 1.67;
    if (photo) {
      camera.position.copy(photoPos);
      camera.lookAt(photoPos.clone().add(dir));
      people.avatar.visible = true;
      return;
    }
    people.avatar.visible = third && mode !== 'wheel';
    people.avatar.position.copy(player.pos);
    people.avatar.position.y += 0.012;
    people.avatar.rotation.y = -player.yaw;
    if (mode === 'wheel') {
      eye = rides.wheelSeat(seat);
      if (third) {
        const normal = V(Math.sin(-0.36), 0, Math.cos(-0.36));
        people.avatar.visible = true;
        people.avatar.position.copy(player.pos).addScaledVector(normal, -0.4);
        cameraGoal.copy(eye).addScaledVector(dir, -3.45);
        cameraGoal.y += 1.18;
        const projection = (cameraGoal.x - 53) * normal.x + (cameraGoal.z + 19) * normal.z;
        if (projection < 2.75) cameraGoal.addScaledVector(normal, 2.75 - projection);
        camera.position.copy(cameraGoal);
        camera.lookAt(eye.clone().addScaledVector(dir, 0.8));
      } else {
        camera.position.copy(eye);
        camera.lookAt(eye.clone().add(dir));
      }
      return;
    }
    if (third) {
      const goal = eye.clone().addScaledVector(dir, -4.4);
      goal.y = eye.y + 1.08 - dir.y * 1.3;
      const delta = goal.clone().sub(eye);
      let last = 0;
      for (let t = 0.04; t <= 1.01; t += 0.04) {
        const p = eye.clone().addScaledVector(delta, t);
        if (p.y < 0.18 || !can(p.x, p.z, p.y - 0.1, 0.18, 0.26)) break;
        last = t;
      }
      cameraGoal.copy(eye).addScaledVector(delta, Math.max(0, last - 0.015));
      camera.position.copy(cameraGoal);
      camera.lookAt(eye.clone().addScaledVector(dir, 5.4));
      people.avatar.visible = last > 0.24;
    } else {
      camera.position.copy(eye);
      if (player.grounded && mode === 'walk' && player.speed > 0.4)
        camera.position.y += Math.sin(tourTime * 2) * 0.02 * Math.min(1, player.speed / 3);
      camera.lookAt(camera.position.clone().add(dir));
    }
  }
  function changeView() {
    third = !third;
    syncCamera(true);
    save();
    toast(third ? '第三人称视角' : '第一人称视角');
    $('viewBtn').setAttribute('aria-pressed', String(third));
  }
  function jump() {
    if (photo) {
      photoPos.y = clamp(photoPos.y + 1, 0.35, 64);
      return;
    }
    if (player.grounded && mode !== 'wheel' && mode !== 'slide') {
      vy = 5.8;
      player.grounded = false;
      audio.fx('step');
    }
  }
  function throwBall() {
    if (mode !== 'snow' || shootDelay > 0) return;
    shootDelay = 0.4;
    const eye = player.pos.clone().add(V(0, 1.48, 0)),
      d = look().clone(),
      o = new T.Mesh(snowballGeo, kit.snow);
    o.position.copy(eye).addScaledVector(d, 0.62);
    scene.add(o);
    const v = d.multiplyScalar(22);
    v.y += 2.9;
    balls.push({ o, v, age: 0 });
    audio.fx('throw');
  }
  function rangeUpdate(dt) {
    shootDelay = Math.max(0, shootDelay - dt);
    for (let i = balls.length - 1; i >= 0; i--) {
      const ball = balls[i],
        from = ball.o.position.clone();
      ball.v.y -= 9.8 * dt;
      ball.o.position.addScaledVector(ball.v, dt);
      ball.age += dt;
      const segment = new T.Line3(from, ball.o.position);
      let hit = -1;
      for (let j = 0; j < people.targets.length; j++) {
        const q = people.targets[j];
        if (
          segment.closestPointToPoint(q.position, true, V()).distanceTo(q.position) <
          q.radius + 0.14
        ) {
          hit = j;
          break;
        }
      }
      if (hit >= 0 || ball.age > 3.5 || ball.o.position.y <= 0.12) {
        if (hit >= 0) {
          people.hitTarget(hit);
          audio.fx('hit');
          shotHits.add(hit);
          if (shotHits.size === 3) {
            toast('三座雪靶全部命中！');
            fx.burst(people.targets[hit].position.clone().add(V(0, 1, 0)), 0x9aeada, 27);
          }
        }
        fx.powder(ball.o.position, 16);
        ball.o.removeFromParent();
        balls.splice(i, 1);
      }
    }
  }
  function collect(i) {
    if (collected.has(i)) return;
    collected.add(i);
    crystals[i].g.visible = false;
    audio.fx('crystal');
    fx.burst(crystals[i].g.position, 0x8ce9d8, 18);
    save();
    stats();
    toast(
      collected.size === 7 ? '七枚冰晶已集齐 · 极光盛典开启' : '获得冰晶 · ' + collected.size + ' / 7'
    );
    if (collected.size === 7) {
      specialEnd = festivalEnd = globalTime + 42;
      setTime('night');
      fx.launch(globalTime, true);
    }
  }
  function detect() {
    if (photo) {
      near = null;
      return;
    }
    let action = null;
    const set = (name, fn) => {
      action = { name, fn };
    };
    if (mode === 'wheel') set('离开座舱', () => leaveMode());
    else if (mode === 'slide') set('结束滑行', () => leaveMode());
    else {
      let nearest = null,
        min = 2.65;
      for (const c of crystals) {
        const d = dist(c.x, c.z);
        if (c.g.visible && d < min && Math.abs(player.pos.y - c.y) < 2.25) {
          nearest = c;
          min = d;
        }
      }
      if (nearest) set('拾取冰晶', () => collect(nearest.i));
      else if (mode === 'skate') set('脱下冰鞋', () => leaveMode());
      else if (mode === 'snow') set('结束雪仗', () => leaveMode());
      else if (dist(rides.slideEntry.x, rides.slideEntry.z) < 6.9 && player.pos.y > 16)
        set('开始冰道滑行', () => {
          mode = 'slide';
          slideU = 0;
          slideSpeed = 4.2;
          rideClock = 0;
          player.grounded = true;
          audio.fx('ride');
          toast('冰道出发');
        });
      else if (dist(rides.stairFoot.x, rides.stairFoot.z) < 5.3 && player.pos.y < 4)
        set('登上滑梯高台', () => {
          const p = rides.slideEntry;
          relocate(p.x, 18.6, p.z + 0.55);
          const ahead = rides.slidePoint(0.05);
          face(ahead.x, ahead.z, -0.1);
          toast('已到达高台，按 E 开始滑行');
        });
      else if (dist(rides.wheelEntry.x, rides.wheelEntry.z) < 8)
        set('乘坐雪花摩天轮', () => {
          let best = 1e6;
          for (let j = 0; j < 16; j++) {
            const p = rides.wheelSeat(j);
            if (p.y < best) {
              best = p.y;
              seat = j;
            }
          }
          mode = 'wheel';
          rideClock = 0;
          audio.fx('ride');
          player.pos.copy(rides.wheelSeat(seat));
          player.pos.y -= 1.67;
          face(0, 10, 0.1);
          toast('已登乘 · 拖动可环顾园区');
        });
      else if (Math.pow((player.pos.x - 43) / 16.4, 2) + Math.pow((player.pos.z - 70) / 11.4, 2) < 1.18)
        set('穿上冰鞋', () => {
          mode = 'skate';
          player.skating = true;
          if (player.pos.x < 29.1) relocate(29.4, 0.09, 70);
          audio.fx('ride');
          toast('冰鞋已穿好 · 松开方向键可滑行');
        });
      else if (dist(-39, 70) < 10.5)
        set('开始雪仗', () => {
          mode = 'snow';
          shotHits = new Set();
          people.resetTargets();
          relocate(-33, 0.09, 70);
          face(-50.8, 70, 0.03);
          toast('瞄准胸前圆靶，点击或按 F 投掷');
        });
      else if (dist(-12, 9) < 10.3)
        set(collected.size === 7 ? '重播极光盛典' : '广场灯光秀', () => {
          festivalEnd = globalTime + (collected.size === 7 ? 42 : 14);
          if (collected.size === 7) specialEnd = festivalEnd;
          setTime('night');
          audio.fx('crystal');
          fx.launch(globalTime, collected.size === 7);
          toast(collected.size === 7 ? '极光盛典已开启' : '广场灯光秀已开始');
        });
      else if (dist(0, -37) < 13)
        set('敲响冰钟', () => {
          audio.fx('crystal');
          festivalEnd = Math.max(festivalEnd, globalTime + 4);
          toast('冰钟已敲响');
        });
      else if (dist(0, 70) < 8.5) set('园区导览', () => openMap());
      else if (region === 'art' && dist(-43, 35) < 12)
        set('查看冰雕展签', () =>
          info(
            '冰雕艺廊',
            '盘云冰龙、冰凤凰、林间鹿与雪人藏在四座独立展台上。沿展台之间的小径走一圈，可以从不同角度观察冰层的折光。'
          )
        );
      else if (region === 'town' && dist(37, 35) < 15)
        set('暖屋小憩', () => {
          audio.fx('ride');
          toast('热可可暖手，继续逛逛小街吧');
        });
    }
    near = action;
    $('prompt').hidden = !action;
    if (action) $('actionName').textContent = action.name;
    $('modeLabel').textContent = localeMode[mode];
    $('banner').hidden = mode === 'walk';
    if (mode !== 'walk')
      $('banner').textContent =
        mode === 'wheel'
          ? '座舱高度 ' + Math.max(0, Math.round(rides.wheelSeat(seat).y)) + ' m'
          : mode === 'slide'
          ? '滑行速度 ' + Math.round(slideSpeed * 3.6) + ' km/h'
          : mode === 'skate'
          ? '滑冰中 · 转向时保留滑行惯性'
          : '雪球命中 ' + shotHits.size + ' / 3 · 点击或 F 投掷';
  }
  function interact() {
    if (dialog || photo) return;
    detect();
    near?.fn();
    detect();
    updateArea();
  }
  function onSnow(x, z) {
    if (
      (Math.abs(x) < 9.5 && z > -34) ||
      ((x + 1) / 20) ** 2 + ((z - 10) / 14) ** 2 < 1 ||
      ((x - 43) / 15.2) ** 2 + ((z - 70) / 10.2) ** 2 < 1
    )
      return false;
    const paths = [
      [
        [0, 57],
        [-16, 52],
        [-29, 43],
        [-40, 34],
        [-46, 18],
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
        [-46, 70],
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
    ];
    for (const path of paths)
      for (let i = 1; i < path.length; i++) {
        const [a, b] = path[i - 1],
          [c, d] = path[i],
          v = c - a,
          w = d - b,
          t = clamp(((x - a) * v + (z - b) * w) / (v * v + w * w), 0, 1);
        if ((x - a - t * v) ** 2 + (z - b - t * w) ** 2 < 5.6) return false;
      }
    return true;
  }
  function physical(dt) {
    if (dialog || paused) return;
    let forward = (held.KeyW || held.ArrowUp ? 1 : 0) - (held.KeyS || held.ArrowDown ? 1 : 0) - stick.y,
      side = (held.KeyD || held.ArrowRight ? 1 : 0) - (held.KeyA || held.ArrowLeft ? 1 : 0) + stick.x;
    const l = Math.hypot(side, forward);
    if (l > 1) {
      side /= l;
      forward /= l;
    }
    const sin = Math.sin(player.yaw),
      cos = Math.cos(player.yaw),
      dx = sin * forward + cos * side,
      dz = -cos * forward + sin * side,
      running = held.ShiftLeft || held.ShiftRight || mobileRun;
    if (photo) {
      const speed = running ? 17 : 8,
        dir = look();
      photoPos.x = clamp(photoPos.x + (dir.x * forward + cos * side) * speed * dt, -86, 86);
      photoPos.z = clamp(photoPos.z + (dir.z * forward + sin * side) * speed * dt, -82, 100);
      photoPos.y = clamp(
        photoPos.y +
          (dir.y * forward + (held.KeyE || held.Space ? 1 : 0) - (held.KeyQ ? 1 : 0)) * speed * dt,
        0.4,
        66
      );
      return;
    }
    if (mode === 'wheel') {
      rideClock += dt;
      player.pos.copy(rides.wheelSeat(seat));
      player.pos.y -= 1.67;
      player.speed = 0;
      if (rideClock >= 106) leaveMode();
      return;
    }
    if (mode === 'slide') {
      rideClock += dt;
      const a = rides.slidePoint(slideU),
        b = rides.slidePoint(Math.min(1, slideU + 0.009));
      const slope = Math.max(0, (a.y - b.y) / Math.max(0.02, a.distanceTo(b)));
      slideSpeed = clamp(slideSpeed + (9.81 * slope + 0.62 - 0.016 * slideSpeed) * dt, 4, 21);
      slideU = Math.min(1, slideU + (slideSpeed * dt) / 78.31);
      const p = rides.slidePoint(slideU),
        next = rides.slidePoint(Math.min(1, slideU + 0.035));
      player.pos.copy(p);
      player.pos.y += 0.14;
      if (next.distanceToSquared(p) > 0.001) {
        const v = next.sub(p).normalize();
        player.yaw = Math.atan2(v.x, -v.z);
        player.pitch = clamp(Math.asin(v.y) + 0.075, -0.52, 0.19);
      }
      player.speed = slideSpeed;
      if (slideU >= 1) {
        leaveMode();
        toast('滑行结束 · 已抵达终点');
      }
      return;
    }
    const skate = mode === 'skate',
      speed = skate ? (running ? 11.8 : 8.5) : running ? 8.2 : 4.15,
      blend = 1 - Math.exp(-dt * (skate ? (l > 0.02 ? 2.1 : 0.52) : 15));
    velocity.x += (dx * speed - velocity.x) * blend;
    velocity.z += (dz * speed - velocity.z) * blend;
    function stepAxis(axis, amount) {
      if (Math.abs(amount) < 0.000002) return;
      const old = player.pos[axis],
        x = axis === 'x' ? old + amount : player.pos.x,
        z = axis === 'z' ? old + amount : player.pos.z;
      if (skate && ((x - 43) / 14.55) ** 2 + ((z - 70) / 9.57) ** 2 > 1) {
        velocity[axis] *= -0.15;
        return;
      }
      const ht = rides.stairsGround(x, z);
      let testY = player.pos.y;
      if (player.grounded && ht !== null && ht <= testY + 0.34 && ht > testY) testY = ht;
      if (can(x, z, testY)) {
        player.pos[axis] = old + amount;
      } else velocity[axis] = 0;
    }
    const oldX = player.pos.x,
      oldZ = player.pos.z;
    stepAxis('x', velocity.x * dt);
    stepAxis('z', velocity.z * dt);
    const raw = rides.stairsGround(player.pos.x, player.pos.z);
    let floor = onSnow(player.pos.x, player.pos.z) ? -0.025 : 0.085;
    if (raw !== null && raw <= player.pos.y + 0.36) floor = Math.max(0.09, raw);
    if (player.grounded && floor < player.pos.y - 0.36) {
      player.grounded = false;
      vy = 0;
    }
    if (!player.grounded) {
      vy -= 15.4 * dt;
      let y = player.pos.y + vy * dt;
      if (vy > 0 && !can(player.pos.x, player.pos.z, y)) {
        vy = 0;
        y = player.pos.y;
      }
      if (y <= floor && vy <= 0) {
        y = floor;
        vy = 0;
        player.grounded = true;
        fx.powder(player.pos, 5);
      }
      player.pos.y = y;
    } else player.pos.y = floor;
    player.speed = Math.hypot(player.pos.x - oldX, player.pos.z - oldZ) / dt;
    tourTime += dt * player.speed * 1.65;
    stepDistance += player.speed * dt;
    if (player.grounded && !skate && stepDistance > (running ? 1.36 : 0.95) && player.speed > 0.3) {
      stepDistance = 0;
      audio.fx('step');
      if (player.pos.y < 0.24 && onSnow(player.pos.x, player.pos.z))
        fx.step(player.pos, player.yaw, globalTime);
    }
  }
  function startPhoto() {
    if (dialog) closeDialog();
    if (!photo) {
      if (mode === 'wheel' || mode === 'slide') leaveMode();
      syncCamera(true);
      photoBack = { yaw: player.yaw, pitch: player.pitch };
      photoPos.copy(camera.position);
      photo = true;
      screen.hidden = true;
      $('photo').hidden = false;
      $('banner').hidden = true;
      game.classList.add('photomode');
      stop();
      toast('拖动环顾，滚轮调焦，Q／E 调整高度');
    }
  }
  function endPhoto() {
    if (!photo) return;
    photo = false;
    screen.hidden = false;
    $('photo').hidden = true;
    game.classList.remove('photomode');
    player.yaw = photoBack.yaw;
    player.pitch = photoBack.pitch;
    stop();
    resize();
    syncCamera(true);
    detect();
  }
  function photograph() {
    syncCamera(true);
    post.render();
    canvas.toBlob((b) => {
      if (b) {
        saveBlob(
          b,
          '梦幻冰雪大世界-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.png'
        );
        toast('照片已生成');
      } else toast('此浏览器无法导出当前画面');
    }, 'image/png');
  }
  function openDialog(kind, title, kicker, body, wide = false) {
    if (document.pointerLockElement === canvas) document.exitPointerLock?.();
    stop();
    dialog = kind;
    game.classList.add('modal-on');
    $('overlay').hidden = false;
    $('dialog').classList.toggle('wide', wide);
    $('dialogTitle').textContent = title;
    $('kicker').textContent = kicker;
    $('body').innerHTML = body;
    icons($('body'));
    $('closeDlg').focus({ preventScroll: true });
  }
  function closeDialog() {
    dialog = '';
    $('overlay').hidden = true;
    game.classList.remove('modal-on');
    stop();
    canvas.focus({ preventScroll: true });
  }
  function info(title, note) {
    openDialog('info', title, 'ICE GALLERY', '<p class="note"></p>');
    $('body').querySelector('p').textContent = note;
  }
  function help() {
    const keys = [
      ['WASD / ↑↓←→', '移动'],
      ['拖动鼠标', '环顾四周'],
      ['Shift', '奔跑'],
      ['Space', '跳跃'],
      ['E', '互动、收集或下车'],
      ['M', '地图与快速到达'],
      ['V', '切换第一／第三人称'],
      ['P', '进入或退出拍照'],
      ['F / 点击', '雪仗时投掷'],
      ['Q / E', '拍照镜头升降'],
      ['滚轮', '拍照调焦'],
      ['Esc', '关闭面板、释放鼠标'],
    ];
    openDialog(
      'help',
      '操作指南',
      'FIELD GUIDE',
      '<div class="gridhelp">' +
        keys.map(([a, b]) => '<div><kbd>' + a + '</kbd>' + b + '</div>').join('') +
        '</div><p class="note">轻点画面后即可使用键盘。双击可锁定鼠标。触屏可用左下摇杆走动，拖动空白处转向。</p>'
    );
  }
  function openMap() {
    picked =
      nav === null
        ? Math.max(
            0,
            places.findIndex((p) => p.id === region)
          )
        : nav;
    mapScreen();
  }
  function mapScreen() {
    openDialog(
      'map',
      '园区地图',
      'PARK ATLAS',
      '<div class="maplayout"><div class="mapbig"><canvas id="atlas" aria-label="园区导览图"></canvas></div><div class="places">' +
        places
          .map(
            (p, i) =>
              '<button class="place ' +
              (picked === i ? 'active' : '') +
              '" data-place="' +
              i +
              '"><svg data-i="' +
              p.icon +
              '"></svg><span>' +
              p.n +
              '</span><small>' +
              Math.round(dist(p.x, p.z)) +
              ' m</small></button>'
          )
          .join('') +
        '</div></div><div class="mapdetail"><div><b>' +
        places[picked].n +
        '</b><small>' +
        places[picked].detail +
        '</small></div><div><button class="plain" id="navBtn">' +
        (nav === picked ? '取消导航' : '标记导航') +
        '</button><button class="plain primary" id="travelBtn">前往此处</button></div></div>',
      true
    );
    const big = $('atlas'),
      hits = mapArt(big, player, places, picked, visited, true);
    big.onclick = (e) => {
      const b = big.getBoundingClientRect();
      let best = 17,
        id = -1;
      for (const h of hits) {
        const d = Math.hypot(e.clientX - b.left - h.x, e.clientY - b.top - h.y);
        if (d < best) {
          best = d;
          id = h.i;
        }
      }
      if (id >= 0) {
        picked = id;
        mapScreen();
      }
    };
    for (const o of $('body').querySelectorAll('[data-place]'))
      o.onclick = () => {
        picked = Number(o.dataset.place);
        mapScreen();
      };
    $('navBtn').onclick = () => {
      nav = nav === picked ? null : picked;
      closeDialog();
      toast(nav === null ? '已取消导航' : '已标记' + places[nav].n);
    };
    $('travelBtn').onclick = () => travel(picked);
  }
  async function toggleAudio() {
    try {
      const en = await audio.set(!audio.enabled);
      muted = !en;
      $('audioBtn').querySelector('svg').dataset.i = en ? 'volume' : 'muted';
      $('audioBtn').title = en ? '关闭声音' : '开启声音';
      $('audioBtn').setAttribute('aria-label', $('audioBtn').title);
      icons($('audioBtn'));
      if (dialog === 'settings') settings();
      toast(en ? '环境音与音乐已开启' : '声音已关闭');
    } catch {
      toast('当前浏览器暂未允许播放声音');
    }
  }
  function settings() {
    const seg = (name, items, current) =>
      '<div class="seg">' +
      items
        .map(
          ([id, n]) =>
            '<button data-option="' +
            name +
            '" data-value="' +
            id +
            '" class="' +
            (current === id ? 'active' : '') +
            '" aria-pressed="' +
            (current === id) +
            '">' +
            n +
            '</button>'
        )
        .join('') +
      '</div>';
    openDialog(
      'settings',
      '游戏设置',
      'PARK SETTINGS',
      '<div class="row"><span>画质</span>' +
        seg(
          'quality',
          [
            ['low', '低'],
            ['medium', '中'],
            ['high', '高'],
          ],
          quality
        ) +
        '</div><div class="row"><span>最近游览帧率</span><span id="fpsReadout">' +
        (recentFps ? recentFps + ' FPS' : '采样中') + ' · ' + canvas.width + ' × ' + canvas.height +
        '</span></div><div class="row"><span>园区时段</span>' +
        seg(
          'time',
          [
            ['day', '白天'],
            ['dusk', '黄昏'],
            ['night', '夜晚'],
          ],
          timeMode
        ) +
        '</div><div class="row"><span>游览视角</span>' +
        seg(
          'camera',
          [
            ['first', '第一人称'],
            ['third', '第三人称'],
          ],
          third ? 'third' : 'first'
        ) +
        '</div><div class="row"><span>音乐与环境音</span><button class="plain" id="audToggle">' +
        (audio.enabled ? '关闭声音' : '开启声音') +
        '</button></div><label class="row"><span>音量 <b id="volVal">' +
        Math.round(audio.volume * 100) +
        '%</b></span><input id="vol" type="range" min="0" max="100" value="' +
        Math.round(audio.volume * 100) +
        '"></label>' +
        (document.getElementById('park-three')?.textContent?.length > 500000
          ? '<div class="row"><span>完整游戏项目</span><button class="plain" id="offline">下载离线项目</button></div>'
          : '')
    );
    for (const b of $('body').querySelectorAll('[data-option]'))
      b.onclick = () => {
        const kind = b.dataset.option,
          v = b.dataset.value;
        if (kind === 'quality') setQuality(v);
        if (kind === 'time') setTime(v);
        if (kind === 'camera' && third !== (v === 'third')) changeView();
        settings();
      };
    $('audToggle').onclick = toggleAudio;
    $('vol').oninput = (e) => {
      audio.level(Number(e.target.value) / 100);
      $('volVal').textContent = e.target.value + '%';
      save();
    };
    if ($('offline'))
      $('offline').onclick = () => {
        if (offerProject()) toast('离线项目已打包');
      };
  }
  async function full() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (game.requestFullscreen) await game.requestFullscreen();
      else if (game.webkitRequestFullscreen) game.webkitRequestFullscreen();
      else toast('可在浏览器菜单中进入全屏');
    } catch {
      toast('当前预览窗口未开放全屏，可下载后在浏览器中全屏游玩');
    }
    resize();
  }
  $('audioBtn').onclick = toggleAudio;
  $('timeBtn').onclick = () => {
    const times = ['night', 'dusk', 'day'];
    setTime(times[(times.indexOf(timeMode) + 1) % 3]);
    toast('园区时段 · ' + localeTime[timeMode]);
  };
  $('settingsBtn').onclick = settings;
  $('fullBtn').onclick = full;
  $('mapBtn').onclick = openMap;
  $('helpBtn').onclick = help;
  $('interactBtn').onclick = interact;
  $('viewBtn').onclick = changeView;
  $('photoBtn').onclick = startPhoto;
  $('exitPhoto').onclick = endPhoto;
  $('shutter').onclick = photograph;
  $('higher').onclick = () => (photoPos.y = clamp(photoPos.y + 1.4, 0.4, 66));
  $('lower').onclick = () => (photoPos.y = clamp(photoPos.y - 1.4, 0.4, 66));
  $('closeDlg').onclick = closeDialog;
  $('overlay').onclick = (e) => {
    if (e.target === $('overlay')) closeDialog();
  };
  function keydown(e) {
    const code = e.code;
    if (hot() && code !== 'Escape') return;
    if (code === 'Escape') {
      if (dialog) closeDialog();
      else if (photo) endPhoto();
      return;
    }
    if (dialog) {
      if (code === 'KeyM' && dialog === 'map') {
        e.preventDefault();
        closeDialog();
      } else if (code === 'Tab') {
        const all = [...$('dialog').querySelectorAll('button,input')],
          f = all[0],
          l = all.at(-1);
        if (e.shiftKey && document.activeElement === f) {
          e.preventDefault();
          l.focus();
        } else if (!e.shiftKey && document.activeElement === l) {
          e.preventDefault();
          f.focus();
        }
      }
      return;
    }
    if (
      ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(code) &&
      code !== 'Tab'
    )
      e.preventDefault();
    held[code] = true;
    if (e.repeat) return;
    if (photo) {
      if (code === 'KeyP') endPhoto();
      if (code === 'Enter') photograph();
      return;
    }
    if (code === 'Space') jump();
    if (code === 'KeyE') interact();
    if (code === 'KeyV') changeView();
    if (code === 'KeyP') startPhoto();
    if (code === 'KeyM') openMap();
    if (code === 'KeyF') throwBall();
  }
  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', (e) => {
    delete held[e.code];
  });
  window.addEventListener('blur', stop);
  document.addEventListener('visibilitychange', () => {
    paused = document.hidden;
    stop();
  });
  function turn(dx, dy) {
    if (mode === 'slide' && !photo) return;
    player.yaw += dx * 0.00315;
    player.pitch = clamp(player.pitch - dy * 0.0026, -1.32, 1.31);
  }
  canvas.onpointerdown = (e) => {
    if (dialog) return;
    canvas.focus({ preventScroll: true });
    if (e.button > 0) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, travel: 0 };
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {}
  };
  canvas.onpointermove = (e) => {
    if (dialog) return;
    if (document.pointerLockElement === canvas) {
      turn(e.movementX, e.movementY);
      return;
    }
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x,
      dy = e.clientY - drag.y;
    drag.travel += Math.abs(dx) + Math.abs(dy);
    turn(dx, dy);
    drag.x = e.clientX;
    drag.y = e.clientY;
  };
  canvas.onpointerup = (e) => {
    if (drag?.id === e.pointerId) {
      if (drag.travel < 7 && mode === 'snow' && !photo) throwBall();
      drag = null;
    }
    if (canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  };
  canvas.onpointercancel = () => (drag = null);
  canvas.oncontextmenu = (e) => e.preventDefault();
  canvas.ondblclick = () => {
    if (!isTouch && !photo && !dialog && !document.pointerLockElement && canvas.requestPointerLock) {
      try {
        const f = canvas.requestPointerLock();
        f?.catch?.(() => {});
      } catch {}
    }
  };
  canvas.addEventListener(
    'wheel',
    (e) => {
      if (photo) {
        e.preventDefault();
        camera.fov = clamp(camera.fov + Math.sign(e.deltaY) * 2.3, 25, 84);
        camera.updateProjectionMatrix();
      }
    },
    { passive: false }
  );
  const joy = $('joy');
  function joyMove(e) {
    const b = joy.getBoundingClientRect(),
      rad = b.width * 0.4,
      xx = (e.clientX - b.left - b.width / 2) / rad,
      yy = (e.clientY - b.top - b.height / 2) / rad,
      len = Math.max(1, Math.hypot(xx, yy));
    stick.x = xx / len;
    stick.y = yy / len;
    joy.firstElementChild.style.transform =
      'translate(' + stick.x * rad * 0.6 + 'px,' + stick.y * rad * 0.6 + 'px)';
  }
  joy.onpointerdown = (e) => {
    joyId = e.pointerId;
    joy.setPointerCapture(joyId);
    joyMove(e);
  };
  joy.onpointermove = (e) => {
    if (e.pointerId === joyId) joyMove(e);
  };
  joy.onpointerup = joy.onpointercancel = () => {
    joyId = null;
    stick.x = stick.y = 0;
    joy.firstElementChild.style.transform = '';
  };
  $('jump').onclick = jump;
  $('run').onclick = () => {
    mobileRun = !mobileRun;
    $('run').classList.toggle('active', mobileRun);
  };
  if (window.ResizeObserver) new ResizeObserver(resize).observe(game);
  window.addEventListener('resize', resize);
  document.addEventListener('fullscreenchange', resize);
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    paused = true;
    toast('图形上下文已中断，正在等待恢复');
  });
  canvas.addEventListener('webglcontextrestored', () => {
    location.reload();
  });
  function marker() {
    const o = $('way');
    if (nav === null || photo || mode === 'slide' || mode === 'wheel') {
      o.hidden = true;
      return;
    }
    const p = places[nav],
      distance = dist(p.x, p.z);
    if (distance < 12) {
      o.hidden = true;
      return;
    }
    const v = V(p.x, p.id === 'castle' ? 5.1 : 3.1, p.z).project(camera);
    if (v.z < -1 || v.z > 1 || Math.abs(v.x) > 0.87 || Math.abs(v.y) > 0.75) {
      o.hidden = true;
      return;
    }
    o.hidden = false;
    o.style.left = (v.x + 1) * 50 + '%';
    o.style.top = (1 - v.y) * 50 + '%';
    o.children[1].textContent = p.n;
    o.children[2].textContent = Math.round(distance) + ' m';
  }
  resize();
  stats();
  setTime(timeMode);
  updateArea();
  detect();
  syncCamera(true);
  let prev = now(),
    frame = 0,
    hudTime = -1,
    cost = 0,
    slow = 0,
    adapting = 0,
    shown = false,
    mirrorClock = -1;
  function loop() {
    requestAnimationFrame(loop);
    const stamp = now(),
      real = Math.max(0, stamp - prev);
    prev = stamp;
    if (paused || document.hidden) return;
    const dt = Math.min(0.13, real || 0.0167);
    if (!dialog) globalTime += dt;
    const t = globalTime;
    rides.update(t);
    if (!dialog) {
      const n = Math.max(1, Math.ceil(dt / (1 / 90)));
      for (let i = 0; i < n; i++) {
        physical(dt / n);
        rangeUpdate(dt / n);
      }
    }
    syncCamera();
    castle.update(t);
    sculptures.update(t);
    woods.update(t, camera.position);
    player.sliding = mode === 'slide';
    people.update(t, dialog ? 0 : dt, player);
    kit.clock.value = t;
    kit.festival.value +=
      ((specialEnd > t ? 1 : festivalEnd > t ? 0.32 : 0) - kit.festival.value) *
      (1 - Math.exp(-dt * 2.5));
    sky.update(t, dt, camera.position);
    for (const cr of crystals)
      if (cr.g.visible) {
        cr.g.position.y = cr.y + 1.11 + Math.sin(t * 1.62 + cr.i) * 0.14;
        cr.g.rotation.y = t * 0.72 + cr.i * 0.67;
      }
    fx.update(t, dialog ? 0 : dt, specialEnd > t, timeMode === 'night', audio);
    audio.update(mode, player.speed, specialEnd > t);
    const period = quality === 'high' ? 0.082 : 0.17;
    if (quality !== 'low' && (stamp - mirrorClock > period || frame === 0)) {
      terrain.reflect([sky.snow, fx.points, fx.feet]);
      mirrorClock = stamp;
    }
    post.render();
    frame++;
    if (!shown) {
      shown = true;
      const l = $('loading');
      l.classList.add('done');
      setTimeout(() => (l.hidden = true), 400);
    }
    if (stamp - hudTime > 0.095) {
      updateArea();
      detect();
      if (!photo) {
        mapArt($('mini'), player, places, nav, visited);
        compassArt($('compass'), player.yaw);
        marker();
      }
      hudTime = stamp;
    }
    if (toastEnd && stamp > toastEnd) {
      $('toast').classList.remove('on');
      toastEnd = 0;
    }
    if (frame > 5 && !dialog && real > 0 && real < 2) {
      sampleFrames++;
      sampleTime += real;
      if (sampleTime >= 1.5) {
        recentFps = Math.round(sampleFrames / sampleTime);
        sampleTime = sampleFrames = 0;
      }
      const sample = Math.min(real, .36);
      cost = cost ? cost + (sample - cost) * (1 - Math.exp(-real * 1.8)) : sample;
      if (cost > 0.049) slow += Math.min(real, .3);
      else slow = Math.max(0, slow - dt * 0.5);
      if (slow > 4.2 && stamp - adapting > 7 && adaptive > 0.65) {
        adaptive = Math.max(0.64, adaptive - 0.14);
        adapting = stamp;
        slow = 0;
        resize();
      }
    }
  }
  try {
    loop();
  } catch (err) {
    $('loading').hidden = false;
    $('loading').classList.remove('done');
    $('loading').querySelector('span').textContent = '画面初始化未完成：' + String(err?.message || err);
    throw err;
  }
}

const mount = document.getElementById('park-mount');
mount.innerHTML =
  '<main id="game" aria-label="梦幻冰雪大世界"><canvas id="scene" tabindex="0" aria-label="3D 冰雪乐园，拖动环顾"></canvas><div class="shade"></div>\n<div id="hud"><header class="brand"><div class="brandmark"><svg viewBox="0 0 52 52" aria-hidden="true"><defs><g id="flake-arm"><path d="M26 5v15M20.5 10.5l5.5 4 5.5-4M22 16l4 3 4-3"/></g></defs><g fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><use href="#flake-arm" transform="rotate(0 26 26)"/><use href="#flake-arm" transform="rotate(60 26 26)"/><use href="#flake-arm" transform="rotate(120 26 26)"/><use href="#flake-arm" transform="rotate(180 26 26)"/><use href="#flake-arm" transform="rotate(240 26 26)"/><use href="#flake-arm" transform="rotate(300 26 26)"/><path d="m26 18 7 4v8l-7 4-7-4v-8z"/><path d="m26 22 3.5 2v4l-3.5 2-3.5-2v-4z" fill="currentColor" stroke="none"/></g></svg></div><div><h1>梦幻冰雪大世界</h1><small>HARBIN ICE &amp; SNOW WORLD</small></div></header>\n<div class="location glass"><i class="dot"></i><span id="modeLabel">自由探索</span><i class="divider"></i><svg data-i="pin"></svg><b id="regionLabel">中心广场</b></div>\n<div class="compass"><canvas id="compass"></canvas><i></i></div>\n<div class="tools glass"><button id="timeBtn" title="切换时段" aria-label="切换时段"><svg data-i="moon"></svg><span id="timeLabel">夜晚</span></button><i class="divider"></i><button id="audioBtn" title="开启声音" aria-label="开启声音"><svg data-i="muted"></svg></button><button id="settingsBtn" title="游戏设置" aria-label="游戏设置"><svg data-i="settings"></svg></button><button id="fullBtn" title="全屏" aria-label="全屏"><svg data-i="expand"></svg></button></div>\n<button id="mapBtn" class="mini glass" title="打开园区地图 (M)" aria-label="打开园区地图"><span class="drawing"><canvas id="mini"></canvas><b>N</b></span><span class="map-foot"><span><svg data-i="map"></svg>园区地图</span><kbd>M</kbd></span></button>\n<div id="way" hidden><i></i><span>冰雪城堡</span><small></small></div><b class="reticle"></b>\n<aside class="quest glass"><div class="qtop"><span><svg data-i="book"></svg>探索手记</span><b id="explored" title="已探索区域">14%</b></div><div class="qbody"><svg class="gem" viewBox="0 0 36 44" fill="none"><path d="m18 2 12 14-4 17-8 9-10-12-3-13z" fill="#67cdd3" fill-opacity=".21" stroke="#a4f8ef" stroke-width="1.3"/><path d="m18 2-4 16 4 24 5-25z" fill="#96f2ed" fill-opacity=".66"/><path d="m5 17 9 1 9-1 7-1M8 30l6-12M26 33l-3-16" stroke="#b5fffb" stroke-width=".9"/></svg><div class="qinfo"><div><strong>寻觅冰晶</strong><span><b id="count">0</b> / 7</span></div><div id="ticks"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><small id="goal">集齐冰晶，点亮极光盛典</small></div></div></aside>\n<div id="prompt"><button id="interactBtn" class="glass"><kbd>E</kbd><strong id="actionName">园区导览</strong><svg data-i="sign"></svg></button></div>\n<div class="actions"><button id="viewBtn" class="glass" title="切换视角 (V)"><svg data-i="user"></svg><span>视角</span><kbd>V</kbd></button><button id="photoBtn" class="glass" title="拍照模式 (P)"><svg data-i="camera"></svg><span>拍照</span><kbd>P</kbd></button></div>\n<footer><span class="move-keys"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><span>移动</span><span class="item"><svg data-i="mouse"></svg>拖动环顾</span><span class="item"><kbd>Shift</kbd>奔跑</span><span class="item"><kbd>Space</kbd>跳跃</span><button id="helpBtn"><svg data-i="help"></svg>操作指南</button></footer></div>\n<div id="touch"><div id="joy"><i></i></div><div class="touchbuttons"><button id="run" aria-label="切换奔跑">跑</button><button id="jump" aria-label="跳跃">跳</button></div></div>\n<div id="photo" hidden><div class="photo-badge glass"><svg data-i="camera"></svg>拍照模式</div><i class="frame tl"></i><i class="frame tr"></i><i class="frame bl"></i><i class="frame br"></i><div class="photo-tools glass"><button id="lower" title="降低镜头">−</button><span>高度</span><button id="higher" title="升高镜头">＋</button><i class="divider"></i><button id="shutter"><svg data-i="camera"></svg>保存照片</button><button id="exitPhoto" aria-label="退出拍照"><svg data-i="close"></svg></button></div></div>\n<div id="banner" class="glass" hidden></div><div id="toast" role="status" aria-live="polite"></div>\n<div id="overlay" hidden><section id="dialog" class="glass" role="dialog" aria-modal="true" aria-labelledby="dialogTitle"><header><div><small id="kicker"></small><h2 id="dialogTitle"></h2></div><button id="closeDlg" aria-label="关闭"><svg data-i="close"></svg></button></header><div id="body"></div></section></div>\n<div id="loading"><div>❄</div><strong>梦幻冰雪大世界</strong><span>正在点亮冰雪乐园</span><i></i></div></main>';
function boot() {
  try {
    play(THREE);
  } catch (e) {
    showStartupIssue('3D 场景未能载入。请确认已完整解压项目，并使用支持 WebGL 的浏览器打开。');
    console.error(e);
  }
}
requestAnimationFrame(() => requestAnimationFrame(boot));
