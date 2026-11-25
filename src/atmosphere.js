'use strict';

function atmosphere(T, scene, kit) {
  const u = { t: { value: 0 }, day: { value: 0 }, dusk: { value: 0 }, festival: kit.festival };
  const sky = new T.Mesh(
    new T.SphereGeometry(488, 48, 28),
    new T.ShaderMaterial({
      side: T.BackSide,
      depthWrite: false,
      depthTest: false,
      uniforms: u,
      vertexShader: `varying vec3 dir;void main(){dir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec3 dir;uniform float t,day,dusk,festival;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 a=floor(p),b=fract(p);b=b*b*(3.-2.*b);return mix(mix(hash(a),hash(a+vec2(1,0)),b.x),mix(hash(a+vec2(0,1)),hash(a+1.),b.x),b.y);}
 float fb(vec2 p){return noise(p)*.54+noise(p*2.11)*.29+noise(p*4.18)*.13+noise(p*8.3)*.04;}
 vec3 curtain(float a,float h,float center,float lift,vec3 hue){
   float p=atan(sin(a-center),cos(a-center)), time=t*.012;
   float sweep=1.-smoothstep(.45,1.85,abs(p));
   float folds=sin(p*4.1+time)+.40*sin(p*8.8-time*.8)+.15*sin(p*15.8+time);
   float base=lift+.058*folds+.035*p;
   float x=h-base, fans=fb(vec2(p*6.4+time*.5,.8));
   float height=.09+.20*fans, top=smoothstep(-.024,.022,x)*(1.-smoothstep(height*.14,height,x));
   float rake=p*112.+x*(22.+9.*sin(p*3.))+5.*folds+time;
   float striae=.32+.68*pow(noise(vec2(rake*.6,time*.9)),1.7);
   float edge=exp(-abs(x)*58.), veil=.10*exp(-abs(x-.09)*10.);
   vec3 tip=mix(hue,vec3(.15,.057,.35),smoothstep(.035,.22,x)*.72);
   return sweep*(.22+.78*fans)*(tip*(top*striae+veil)+hue*edge*.35);
 }
 void main(){vec3 r=normalize(dir);float h=asin(clamp(r.y,-1.,1.)),a=atan(r.x,-r.z);
 vec3 n=mix(vec3(.023,.048,.091),vec3(.0012,.0038,.015),smoothstep(-.055,1.0,h));
 float cloud=fb(vec2(sin(a)*3.4+cos(a)*2.2+t*.0014,h*14.));
 n+=vec3(.033,.026,.066)*pow(cloud,2.6)*(1.-smoothstep(.20,.70,h));
 n+=vec3(.032,.012,.025)*exp(-abs(h-.036)*8.)*(.35+.65*pow(.5+.5*cos(a-.4),2.));
 n+=(curtain(a,h,-.65,.43,vec3(.012,.33,.225))+
     curtain(a,h,.36,.57,vec3(.06,.16,.36))*.78+
     curtain(a,h,1.75,.39,vec3(.17,.055,.30))*.77+
     curtain(a,h,-2.54,.47,vec3(.027,.20,.23))*.63)*(1.+festival*.85);
 vec3 c=mix(mix(n,mix(vec3(.74,.33,.23),vec3(.066,.053,.16),smoothstep(-.1,.77,h)),dusk),mix(vec3(.66,.83,.95),vec3(.097,.34,.64),smoothstep(-.1,1.17,h)),day);
 float m=distance(r,normalize(vec3(-.58,.54,-1.)));c+=vec3(.86,.99,1.13)*((1.-smoothstep(.016,.0176,m))*1.4+.048*exp(-m*16.)+.059*exp(-m*65.))*(1.-day);
 gl_FragColor=vec4(c,1.);}`,
    })
  );
  sky.renderOrder = -100;
  sky.frustumCulled = false;
  scene.add(sky);
  let seed = 45688;
  const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const buildPoints = (n, star) => {
    const g = new T.BufferGeometry(),
      pos = new Float32Array(n * 3),
      attr = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      if (star) {
        const a = rnd() * 2 * Math.PI,
          y = 0.022 + rnd() * 0.973,
          r = Math.sqrt(1 - y * y);
        pos.set([r * Math.sin(a) * 412, y * 412, r * Math.cos(a) * 412], 3 * i);
      } else pos.set([rand42(), rnd() * 24, rand42()], 3 * i);
      attr[i] = rnd();
    }
    function rand42() {
      return rnd() * 42;
    }
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setAttribute('seed', new T.BufferAttribute(attr, 1));
    const mat = new T.ShaderMaterial({
      transparent: true,
      blending: star ? T.AdditiveBlending : T.NormalBlending,
      depthWrite: false,
      uniforms: { t: u.t, eye: { value: new T.Vector3() }, dpr: { value: 1 }, fade: { value: 1 } },
      vertexShader: star
        ? `uniform float t,dpr;attribute float seed;varying float a;void main(){a=(.64+.36*sin(position.z+t*.55))*(.48+.49*seed);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=max(1.,(.5+2.1*pow(seed,4.))*dpr);}`
        : `uniform float t,dpr;uniform vec3 eye;attribute float seed;varying float a;void main(){vec3 p=position;p.y-=t*(.65+.8*seed);p.x+=t*.47+sin(t*.4+seed*39.)*.39;p.z+=sin(t*.34+seed*20.)*.44;p=mod(p-eye+vec3(21.,10.,21.),vec3(42.,24.,42.))-vec3(21.,10.,21.)+eye;vec4 v=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*v;gl_PointSize=clamp((23.+seed*20.)/max(1.,-v.z),.7,4.)*dpr;a=(.2+.48*seed)*smoothstep(.7,3.,-v.z)*(1.-smoothstep(15.,30.,-v.z))*smoothstep(-.1,.5,p.y);}`,
      fragmentShader: `uniform float fade;varying float a;void main(){float r=2.*length(gl_PointCoord-.5);gl_FragColor=vec4(.79,.9,1.,a*fade*(1.-smoothstep(.08,1.,r)));}`,
    });
    const o = new T.Points(g, mat);
    o.frustumCulled = false;
    o.renderOrder = star ? -99 : 15;
    scene.add(o);
    return o;
  };
  const stars = buildPoints(2400, true),
    snow = buildPoints(1450, false),
    hemi = new T.HemisphereLight(0x839fce, 0x253148, 0.39),
    moon = new T.DirectionalLight(0xa5cffa, 1.03);
  moon.position.set(-77, 63, 9);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  Object.assign(moon.shadow.camera, { left: -86, right: 86, top: 87, bottom: -87, near: 1, far: 208 });
  moon.shadow.bias = -0.00035;
  moon.shadow.normalBias = 0.06;
  const rim = new T.DirectionalLight(0xaa8be4, 0.66);
  rim.position.set(41, 45, -59);
  scene.add(hemi, moon, moon.target, rim);
  scene.fog = new T.FogExp2(0x283950, 0.00415);
  const states = {
    night: [0, 0, 0.39, 1.03, 0x839fce, 0xa5cffa, 0x253952],
    dusk: [0, 1, 1.5, 2.2, 0xffd3cf, 0xffbd91, 0xae849c],
    day: [1, 0, 1.9, 2.72, 0xe1f4ff, 0xfff3dd, 0xa9c9da],
  };
  let target = states.night;
  return {
    snow,
    moon,
    setMode(mode) {
      target = states[mode];
      hemi.color.setHex(target[4]);
      moon.color.setHex(target[5]);
      scene.fog.color.setHex(target[6]);
    },
    quality(level, dpr) {
      snow.geometry.setDrawRange(0, level === 'low' ? 360 : level === 'medium' ? 850 : 1450);
      snow.material.uniforms.dpr.value = dpr;
      stars.material.uniforms.dpr.value = dpr;
    },
    update(t, dt, eye) {
      u.t.value = t;
      const f = 1 - Math.exp(-dt * 3);
      u.day.value += (target[0] - u.day.value) * f;
      u.dusk.value += (target[1] - u.dusk.value) * f;
      kit.nightLight.value = 1 - .91*u.day.value - .49*u.dusk.value;
      moon.intensity += (target[3] - moon.intensity) * f;
      hemi.intensity += (target[2] - hemi.intensity) * f;
      stars.material.uniforms.fade.value = (1 - u.day.value) * (1 - u.dusk.value * 0.83);
      sky.position.copy(eye);
      stars.position.copy(eye);
      snow.material.uniforms.eye.value.copy(eye);
    },
  };
}
function postFX(T, renderer, scene, camera, kit) {
  const type =
    renderer.capabilities.isWebGL2 && renderer.extensions.has('EXT_color_buffer_float')
      ? T.HalfFloatType
      : T.UnsignedByteType;
  const rt = (depth) =>
    new T.WebGLRenderTarget(8, 8, {
      type,
      depthBuffer: depth,
      stencilBuffer: false,
      minFilter: T.LinearFilter,
      magFilter: T.LinearFilter,
    });
  const main = rt(true),
    s1 = rt(false),
    s2 = rt(false),
    wideX = rt(false), wideY = rt(false),
    stage = new T.Scene(),
    cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1),
    quad = new T.Mesh(new T.PlaneGeometry(2, 2));
  const hasDepth = renderer.capabilities.isWebGL2 || renderer.extensions.has('WEBGL_depth_texture');
  if (hasDepth) main.depthTexture = new T.DepthTexture(8, 8, T.UnsignedIntType);
  quad.frustumCulled = false;
  stage.add(quad);
  const pass = (fs, uniforms) =>
    new T.ShaderMaterial({
      vertexShader: 'varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader: 'varying vec2 v;' + fs,
      uniforms,
      depthTest: false,
      depthWrite: false,
    });
  const bright = pass(
    'uniform sampler2D tex;void main(){vec3 c=texture2D(tex,v).rgb;float l=max(c.r,max(c.g,c.b));gl_FragColor=vec4(c*smoothstep(.68,1.69,l)*.74,1.);}',
    { tex: { value: main.texture } }
  );
  const blur = pass(
    'uniform sampler2D tex;uniform vec2 dir;void main(){vec3 c=texture2D(tex,v).rgb*.227;c+=(texture2D(tex,v+dir*1.385).rgb+texture2D(tex,v-dir*1.385).rgb)*.316;c+=(texture2D(tex,v+dir*3.23).rgb+texture2D(tex,v-dir*3.23).rgb)*.0703;gl_FragColor=vec4(c,1.);}',
    { tex: { value: s1.texture }, dir: { value: new T.Vector2() } }
  );
  const display = pass(
    `uniform sampler2D tex,light,wideLight;uniform float gain,wideGain,night;uniform vec2 texel;
     #ifdef PARK_AIR_DEPTH
     uniform sampler2D sceneDepth;uniform mat4 projInv,worldCam;
     // Integral of a quadratic density over a finite ellipsoid, clipped at the first visible surface.
     float lightShaft(vec3 eye,vec3 ray,float reach,vec3 source,vec3 tip,float radius){
       vec3 axis=tip-source;float height=length(axis);axis/=height;
       vec3 p=eye-(source+tip)*.5;
       float py=dot(p,axis),dy=dot(ray,axis);
       vec3 pn=(p-py*axis)/radius,dn=(ray-dy*axis)/radius;
       py*=2./height;dy*=2./height;
       float a=dot(dn,dn)+dy*dy,b=dot(pn,dn)+py*dy,c=dot(pn,pn)+py*py;
       float disc=b*b-a*(c-1.);
       if(disc<=0.)return 0.;
       float span=sqrt(disc)/a,center=-b/a;
       float lo=max(0.,center-span),hi=min(reach,center+span);
       if(hi<=lo)return 0.;
       float mid=(hi+lo)*.5,len=hi-lo;
       float density=disc/a-a*((mid-center)*(mid-center)+len*len/12.);
       return max(0.,density)*len/(2.*radius);
     }
     vec3 aerial(vec3 col){
       float raw=texture2D(sceneDepth,v).r;
       vec4 p=projInv*vec4(v*2.-1.,2.*raw-1.,1.);
       vec3 to=(worldCam*vec4(p.xyz/p.w,0.)).xyz, eye=worldCam[3].xyz;
       float dist=min(length(to),175.);vec3 ray=normalize(to);
       float h0=max(0.,eye.y),h1=max(0.,eye.y+ray.y*dist);
       float delta=(h1-h0)*.115;
       float fogDensity=abs(delta)<.035?exp(-.0575*(h0+h1)):(exp(-h0*.115)-exp(-h1*.115))/delta;
       float air=1.-exp(-dist*.0028*max(fogDensity,0.));
       col=mix(col,mix(vec3(.28,.36,.46),vec3(.030,.062,.105),night),min(.32,air));
       if(night>.12){
         vec3 beams=vec3(.034,.23,.61)*lightShaft(eye,ray,dist,vec3(-22.,.6,-34.),vec3(-28.,28.,-41.),3.5);
         beams+=vec3(.43,.056,.34)*lightShaft(eye,ray,dist,vec3(20.,.6,-34.),vec3(26.,25.,-42.),3.3);
         beams+=vec3(.58,.27,.08)*lightShaft(eye,ray,dist,vec3(1.,1.,-35.),vec3(-.8,15.,-40.),2.);
         beams+=vec3(.085,.27,.37)*lightShaft(eye,ray,dist,vec3(-2.,.4,10.),vec3(-3.,11.,8.),2.2);
         col+=beams*night*.35;
       }
       return col;
     }
     #endif
     vec3 acesFit(vec3 x){return x*(2.51*x+.03)/(x*(2.43*x+.59)+.14);}
     float luma(vec3 c){float l=dot(c,vec3(.299,.587,.114));return l/(1.+l);}
     vec3 resolveEdges(vec3 center){
       vec2 h=texel*.68;
       float a=luma(texture2D(tex,v+vec2(-h.x,-h.y)).rgb),b=luma(texture2D(tex,v+vec2(h.x,-h.y)).rgb);
       float c=luma(texture2D(tex,v+vec2(-h.x,h.y)).rgb),d=luma(texture2D(tex,v+h).rgb),m=luma(center);
       float lo=min(m,min(min(a,b),min(c,d))),hi=max(m,max(max(a,b),max(c,d)));
       if(hi-lo<max(.023,hi*.115))return center;
       vec2 axis=vec2(-((a+b)-(c+d)),(a+c)-(b+d));
       axis=clamp(axis/(min(abs(axis.x),abs(axis.y))+max(.022,(a+b+c+d)*.04)),vec2(-4.),vec2(4.))*texel;
       vec3 mid=.5*(texture2D(tex,v-axis*.19).rgb+texture2D(tex,v+axis*.19).rgb);
       vec3 edge=.5*mid+.25*(texture2D(tex,v-axis*.49).rgb+texture2D(tex,v+axis*.49).rgb);
       float le=luma(edge);return le<lo||le>hi?mid:edge;
     }
     void main(){vec3 c=texture2D(tex,v).rgb;
       if(gain>0.){
         c=resolveEdges(c)+texture2D(light,v).rgb*gain;
         if(wideGain>0.)c+=texture2D(wideLight,v).rgb*wideGain;
         #ifdef PARK_AIR_DEPTH
         c=aerial(c);
         #endif
       }
       c=max(c*mix(.94,.84,night),vec3(0.));
       float lum=max(.00001,dot(c,vec3(.2126,.7152,.0722)));
       c=clamp(mix(acesFit(c),min(vec3(1.06),c*acesFit(vec3(lum)).r/lum),.22),0.,1.);
       c=mix(c*12.92,1.055*pow(max(c,vec3(.000001)),vec3(1./2.4))-.055,step(vec3(.0031308),c));gl_FragColor=vec4(c,1.);}`,
    { tex: { value: main.texture }, light: { value: s1.texture }, wideLight: { value: wideY.texture }, wideGain: { value: 0 },
      night: kit.nightLight, sceneDepth: { value: main.depthTexture }, projInv: { value: camera.projectionMatrixInverse },
      worldCam: { value: camera.matrixWorld }, gain: { value: 0.27 }, texel: { value: new T.Vector2() } }
  );
  if (hasDepth) display.defines = { PARK_AIR_DEPTH: 1 };
  let w = 1,
    h = 1,
    bloom = true;
  function draw(m, target) {
    quad.material = m;
    renderer.setRenderTarget(target);
    renderer.render(stage, cam);
  }
  return {
    resize(width, height, level) {
      main.setSize(width, height);
      display.uniforms.texel.value.set(1 / width, 1 / height);
      w = Math.max(4, Math.round(width * 0.21));
      h = Math.max(4, Math.round(height * 0.21));
      s1.setSize(w, h);
      s2.setSize(w, h);
      bloom = level !== 'low';
      display.uniforms.gain.value = bloom ? 0.27 : 0;
      display.uniforms.wideGain.value = level === 'high' ? .16 : 0;
      const divisor = level === 'high' ? 3 : Math.max(w,h);
      wideX.setSize(Math.max(1,Math.ceil(w/divisor)), Math.max(1,Math.ceil(h/divisor)));
      wideY.setSize(wideX.width,wideX.height);
    },
    render() {
      renderer.setRenderTarget(main);
      renderer.render(scene, camera);
      if (bloom) {
        draw(bright, s1);
        blur.uniforms.tex.value = s1.texture;
        blur.uniforms.dir.value.set(1.55 / w, 0);
        draw(blur, s2);
        blur.uniforms.tex.value = s2.texture;
        blur.uniforms.dir.value.set(0, 1.55 / h);
        draw(blur, s1);
        if (display.uniforms.wideGain.value) {
          blur.uniforms.tex.value = s1.texture;
          blur.uniforms.dir.value.set(1.65/wideX.width,0); draw(blur,wideX);
          blur.uniforms.tex.value = wideX.texture;
          blur.uniforms.dir.value.set(0,1.65/wideY.height); draw(blur,wideY);
        }
      }
      draw(display, null);
    },
  };
}
