# 梦幻冰雪大世界

解压整个压缩包，用启用了 WebGL 的桌面浏览器打开 index.html 即可游玩。项目内含 Three.js r160，模型、材质、声音和天空均由程序生成。无需安装依赖或构建。也可在项目目录运行 python -m http.server 8000，通过 http://localhost:8000 启动。

## 操作
WASD 或方向键移动，鼠标拖动环顾。双击画面可锁定鼠标，Esc 释放。空格跳跃，Shift 奔跑，E 与附近设施互动或拾取冰晶，M 打开地图，V 切换视角，P 拍照。拍照时 Q/E 升降，滚轮调焦，Enter 保存无界面的 PNG。触屏可用摇杆、跳跃键和画面拖动。

## 游玩
从中心广场沿主路进入冰堡，也可在地图点选游乐项目并选择「前往此处」。冰滑梯可走楼梯登顶，也可在楼梯口按 E 上高台。摩天轮每圈 106 秒，随时可按 E 返回登乘台。冰场入口可换冰鞋，雪仗场内点击画面或按 F 投掷。七枚隐藏冰晶全部找到后将开启极光盛典，之后可在广场的巨型冰晶前重播。进度和设置保存在当前浏览器，声音由界面右上角的扬声器开启。

## 源码
index.html 为入口，style.css 为界面样式。src 下的 castle、rides、sculptures、landscape、visitors 模块负责场景建模。materials、atmosphere 和 terrain 负责冰材质、天空、辉光与冰面反射。navigation、effects-audio、interface 和 game 负责导览、音效、输入和游戏循环。vendor/THREE-LICENSE.txt 随附 Three.js 的 MIT 许可。
