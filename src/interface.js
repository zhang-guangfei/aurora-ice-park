'use strict';

function icons(el = document) {
  const paths = {
    pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.3"/>',
    map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z"/><path d="M9 3v15m6-12v15"/>',
    moon: '<path d="M20.5 14A8.6 8.6 0 0 1 10 3.5 8.8 8.8 0 1 0 20.5 14Z"/><path d="m17 3 .6 1.7L19 5.3l-1.4.5L17 7.5l-.6-1.7-1.4-.5 1.4-.6Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    dusk: '<path d="M2 16h20M4 20h16M6 15a6 6 0 0 1 12 0M12 3v3m-8 2 2 2m12 0 2-2"/>',
    muted: '<path d="M3 9h4l5-4v14l-5-4H3zM16 9l5 6m0-6-5 6"/>',
    volume: '<path d="M3 9h4l5-4v14l-5-4H3zM15 8a5 5 0 0 1 0 8m3-11a9 9 0 0 1 0 14"/>',
    settings:
      '<path d="m10 3-.6 2.1-2 .9-2-.6-1.9 3.2 1.5 1.5-.2 2 .1 1.2-1.4 1.4 1.9 3.3 2.1-.5 1.9.9.6 2.1h4l.6-2.1 1.9-.9 2.1.5 1.9-3.3-1.4-1.4.1-2-.1-1.2 1.4-1.5-1.9-3.2-2 .6-2-.9L14 3z"/><circle cx="12" cy="12" r="3"/>',
    expand: '<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/>',
    book: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 3v18m3-12h5m-5 4h4"/>',
    sign: '<path d="M12 3v18M4 5h12l3 3-3 3H4Zm4 9h12v5H8l-3-2.5z"/>',
    user: '<circle cx="12" cy="7" r="3.1"/><path d="M5.5 20v-1.6a6.5 6.5 0 0 1 13 0V20z"/>',
    camera: '<path d="M3 7h4l1.8-3h6.4L17 7h4v13H3z"/><circle cx="12" cy="13" r="4"/>',
    mouse: '<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 2v7"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.5 2.5 0 1 1 3.8 2.2c-1 .6-1.5 1-1.5 2.4m0 3h.01"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    crystal: '<path d="m12 2 7 7-2 9-5 4-6-7-1-6zM12 2l-2 8 2 12 3-12z"/>',
    gem: '<path d="m3 9 4-5h10l4 5-9 12zM3 9h18m-14-5 5 17 5-17"/>',
    castle: '<path d="M2 21h20M4 20V8l3-5 3 5v6h4V8l3-5 3 5v12M4 9h6m4 0h6m-10 12v-3a2 2 0 0 1 4 0v3"/>',
    wheel:
      '<circle cx="12" cy="9" r="7"/><path d="m7 22 5-13 5 13m-11-1h12M5 9h14M12 2v7m-5-5 10 10m0-10L7 14"/>',
    slide: '<path d="M2 18h4V4l6 1c0 8 3 11 10 11v3c-9 0-13-4-14-11v10M3 9h3m-3 4h3"/>',
    house: '<path d="m2 11 10-8 10 8M5 9v12h14V9m-9 12v-7h4v7"/>',
    skate: '<path d="M5 4h7l1 6 5 2 2 3H5zM7 16v3m9-3v3M3 20h15l3-2"/>',
    target:
      '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  };
  const arr = el.matches?.('svg[data-i]') ? [el] : el.querySelectorAll('svg[data-i]');
  for (const svg of arr) {
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = paths[svg.dataset.i] || paths.gem;
  }
}
function saveBlob(blob, name) {
  const a = document.createElement('a'),
    url = URL.createObjectURL(blob);
  a.href = url;
  a.download = name;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 90000);
}
function zipFiles(files) {
  const enc = new TextEncoder(),
    u16 = (n) => [n & 255, (n >>> 8) & 255],
    u32 = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255],
    crcTable = Array.from({ length: 256 }, (_, i) => {
      for (let b = 0; b < 8; b++) i = i & 1 ? 0xedb88320 ^ (i >>> 1) : i >>> 1;
      return i >>> 0;
    });
  const entries = [],
    central = [];
  let offset = 0,
    csize = 0;
  for (const [name, content] of files) {
    const data = enc.encode(content),
      fn = enc.encode(name);
    let crc = 0xffffffff;
    for (const b of data) crc = crcTable[(crc ^ b) & 255] ^ (crc >>> 8);
    crc = (crc ^ 0xffffffff) >>> 0;
    const common = [
      ...u16(20),
      ...u16(0x800),
      0,
      0,
      0,
      0,
      0x21,
      0,
      ...u32(crc),
      ...u32(data.length),
      ...u32(data.length),
      ...u16(fn.length),
      0,
      0,
    ];
    const header = new Uint8Array([...u32(0x04034b50), ...common, ...fn]);
    entries.push(header, data);
    const cent = new Uint8Array([
      ...u32(0x02014b50),
      ...u16(20),
      ...common,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      ...u32(offset),
      ...fn,
    ]);
    central.push(cent);
    csize += cent.length;
    offset += header.length + data.length;
  }
  return new Blob(
    [
      ...entries,
      ...central,
      new Uint8Array([
        ...u32(0x06054b50),
        0,
        0,
        0,
        0,
        ...u16(files.length),
        ...u16(files.length),
        ...u32(csize),
        ...u32(offset),
        0,
        0,
      ]),
    ],
    { type: 'application/zip' }
  );
}
function offerProject() {
  const lic =
    'MIT License\n\nCopyright 2010-2023 Three.js Authors\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.';
  const css = document.getElementById('park-css')?.textContent,
    lib = document.getElementById('park-three')?.textContent,
    program = document.getElementById('park-main')?.textContent;
  if (!css || !lib || !program || lib.length < 500000) {
    return false;
  }
  saveBlob(zipFiles(sourceFiles(css, lib, program, lic)), 'aurora-ice-park.zip');
  return true;
}
function sourceFiles(css, lib, program, lic) {
  const names = {
    kit: 'materials',
    atmosphere: 'atmosphere',
    ground: 'terrain',
    castle: 'castle',
    rides: 'rides',
    art: 'sculptures',
    landscape: 'landscape',
    visitors: 'visitors',
    nav: 'navigation',
    effects: 'effects-audio',
    helpers: 'interface',
    play: 'game',
  };
  const headers = [
    ...program.matchAll(
      /^\/\* (kit|atmosphere|ground|castle|rides|art|landscape|visitors|nav|effects|helpers|play) \*\/\s*$/gm
    ),
  ];
  const modules = headers.map((a, i) => {
    const end = headers[i + 1]?.index ?? program.lastIndexOf('})();');
    const source = program.slice(a.index + a[0].length, end).trim();
    return ['src/' + names[a[1]] + '.js', "'use strict';\n\n" + source + '\n'];
  });
  const scripts = ['vendor/three.min.js', ...modules.map((f) => f[0])]
    .map((f) => '<script defer src="' + f + '"><' + '/script>')
    .join('\n  ');
  const index =
    '<!doctype html>\n<html lang="zh-CN">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n  <meta name="theme-color" content="#0c2430">\n  <title>梦幻冰雪大世界</title>\n  <link id="park-css" rel="stylesheet" href="style.css">\n  ' +
    scripts +
    '\n</head>\n<body><div id="park-mount"></div></body>\n</html>\n';
  const readme =
    '# 梦幻冰雪大世界\n\n解压整个压缩包，用启用了 WebGL 的桌面浏览器打开 index.html 即可游玩。项目内含 Three.js r160，模型、材质、声音和天空均由程序生成。无需安装依赖或构建。也可在项目目录运行 python -m http.server 8000，通过 http://localhost:8000 启动。\n\n## 操作\nWASD 或方向键移动，鼠标拖动环顾。双击画面可锁定鼠标，Esc 释放。空格跳跃，Shift 奔跑，E 与附近设施互动或拾取冰晶，M 打开地图，V 切换视角，P 拍照。拍照时 Q/E 升降，滚轮调焦，Enter 保存无界面的 PNG。触屏可用摇杆、跳跃键和画面拖动。\n\n## 游玩\n从中心广场沿主路进入冰堡，也可在地图点选游乐项目并选择「前往此处」。冰滑梯可走楼梯登顶，也可在楼梯口按 E 上高台。摩天轮每圈 106 秒，随时可按 E 返回登乘台。冰场入口可换冰鞋，雪仗场内点击画面或按 F 投掷。七枚隐藏冰晶全部找到后将开启极光盛典，之后可在广场的巨型冰晶前重播。进度和设置保存在当前浏览器，声音由界面右上角的扬声器开启。\n\n## 源码\nindex.html 为入口，style.css 为界面样式。src 下的 castle、rides、sculptures、landscape、visitors 模块负责场景建模。materials、atmosphere 和 terrain 负责冰材质、天空、辉光与冰面反射。navigation、effects-audio、interface 和 game 负责导览、音效、输入和游戏循环。vendor/THREE-LICENSE.txt 随附 Three.js 的 MIT 许可。\n';
  return [
    ['index.html', index],
    ['style.css', css],
    ...modules,
    ['vendor/three.min.js', lib],
    ['vendor/THREE-LICENSE.txt', lic],
    ['README.md', readme],
  ];
}
