// 後製：半解析度 HDR 場景 → 環境遮蔽＋光霧 → 移軸景深 → 泛光 → 調色＋抖色 → 放大＋顆粒
// 做法參考 Cinderwatch（MIT，kevintngo/cinderwatch）的後製流程。
import * as THREE from 'three';

const NL = 16;
const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const BAYER = `
float bayer2(vec2 a){ a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a){ return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a){ return bayer4(0.5 * a) * 0.25 + bayer2(a); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
`;
const mat = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, toneMapped: false });

export function makePost(renderer, scene, cam) {
  const P = { focusDist: 90, exposure: 1.0, iw: 2, ih: 2, dw: 2, dh: 2 };
  const lightPos = [], lightCol = [];
  for (let i = 0; i < NL; i++) { lightPos.push(new THREE.Vector3()); lightCol.push(new THREE.Vector3()); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
  const fsScene = new THREE.Scene(), fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), fsMesh = new THREE.Mesh(g, null);
  fsMesh.frustumCulled = false; fsScene.add(fsMesh);

  const atmo = mat(`
precision highp float; varying vec2 vUv;
uniform sampler2D tColor; uniform sampler2D tDepth; uniform mat4 uInvVP; uniform vec3 uCamDir; uniform vec2 uPx; uniform float uTime;
uniform vec3 uLightPos[${NL}]; uniform vec3 uLightCol[${NL}]; uniform vec3 uAO; uniform vec3 uHaze;
${BAYER}
vec3 wpos(vec2 uv, float d){ vec4 p = uInvVP * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return p.xyz / p.w; }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y); }
void main(){
  vec3 col = texture2D(tColor, vUv).rgb; float d = texture2D(tDepth, vUv).x;
  if (d < 0.9999) {
    vec3 Pw = wpos(vUv, d);
    float dr = texture2D(tDepth, vUv + vec2(uPx.x, 0.0)).x, dl = texture2D(tDepth, vUv - vec2(uPx.x, 0.0)).x;
    float du = texture2D(tDepth, vUv + vec2(0.0, uPx.y)).x, dd = texture2D(tDepth, vUv - vec2(0.0, uPx.y)).x;
    vec3 ddx = abs(dr - d) < abs(d - dl) ? wpos(vUv + vec2(uPx.x, 0.0), dr) - Pw : Pw - wpos(vUv - vec2(uPx.x, 0.0), dl);
    vec3 ddy = abs(du - d) < abs(d - dd) ? wpos(vUv + vec2(0.0, uPx.y), du) - Pw : Pw - wpos(vUv - vec2(0.0, uPx.y), dd);
    vec3 N = normalize(cross(ddx, ddy)); if (dot(N, uCamDir) > 0.0) N = -N;
    float occ = 0.0, ang = bayer4(gl_FragCoord.xy) * 6.2831853;
    for (int i = 0; i < 10; i++) {
      float fi = (float(i) + 0.5) / 10.0, a = ang + float(i) * 2.39996;
      vec2 suv = vUv + vec2(cos(a), sin(a)) * uAO.y * sqrt(fi) * uPx;
      vec3 V = wpos(suv, texture2D(tDepth, suv).x) - Pw; float vv = dot(V, V);
      occ += max(0.0, dot(V, N) - 0.03) / (vv + 0.03) * step(vv, uAO.z);
    }
    col *= clamp(1.0 - occ * uAO.x * 0.1, 0.0, 1.0);
    // 貼著地板的薄霧，只在燈旁邊亮起來
    float n = vn(Pw.xz * 0.22 + uTime * vec2(0.05, 0.02)) * 0.65 + vn(Pw.xz * 0.6 - uTime * vec2(0.08, 0.03)) * 0.35;
    float tau = uHaze.x * exp(-max(Pw.y, 0.0) / uHaze.y) * smoothstep(0.25, 0.85, n) * step(-0.05, Pw.y);
    vec3 L = vec3(0.0); vec3 Pm = Pw + vec3(0.0, 0.35, 0.0);
    for (int i = 0; i < ${NL}; i++) { vec3 dv = uLightPos[i] - Pm; L += uLightCol[i] / (dot(dv, dv) + 1.5); }
    col = mix(col, L * uHaze.z, 1.0 - exp(-tau));
  }
  gl_FragColor = vec4(col, 1.0);
}`, { tColor: { value: null }, tDepth: { value: null }, uInvVP: { value: new THREE.Matrix4() }, uCamDir: { value: new THREE.Vector3() }, uPx: { value: new THREE.Vector2() }, uTime: { value: 0 },
    uLightPos: { value: lightPos }, uLightCol: { value: lightCol }, uAO: { value: new THREE.Vector3(1.0, 16, 0.6) }, uHaze: { value: new THREE.Vector3(0.5, 0.5, 0.05) } });

  const dof = mat(`
precision highp float; varying vec2 vUv;
uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 uPx; uniform vec4 uDof;
${BAYER}
float cocAt(float d){ return clamp((abs(d - uDof.x) - uDof.y) / uDof.z, 0.0, 1.0) * uDof.w; }
void main(){
  float dc = texture2D(tDepth, vUv).x, cc = cocAt(dc);
  vec3 col = texture2D(tColor, vUv).rgb; float tot = 1.0;
  float rad = 0.75, ang = bayer4(gl_FragCoord.xy) * 6.2831853;
  for (int i = 0; i < 36; i++) {
    ang += 2.39996323; vec2 tc = vUv + vec2(cos(ang), sin(ang)) * uPx * rad;
    float sd = texture2D(tDepth, tc).x, sc = cocAt(sd);
    if (sd > dc) sc = clamp(sc, 0.0, cc * 2.0);
    float m = smoothstep(rad - 0.5, rad + 0.5, sc);
    col += mix(col / tot, texture2D(tColor, tc).rgb, m); tot += 1.0;
    rad += 1.35 / rad; if (rad > uDof.w) break;
  }
  gl_FragColor = vec4(col / tot, 1.0);
}`, { tColor: { value: null }, tDepth: { value: null }, uPx: { value: new THREE.Vector2() }, uDof: { value: new THREE.Vector4(0.45, 0.02, 0.05, 8) } });

  const bright = mat(`
precision highp float; varying vec2 vUv; uniform sampler2D tColor; uniform vec2 uPx; uniform vec2 uThr;
void main(){
  vec3 c = texture2D(tColor, vUv + uPx * vec2(-0.5, -0.5)).rgb + texture2D(tColor, vUv + uPx * vec2(0.5, -0.5)).rgb + texture2D(tColor, vUv + uPx * vec2(-0.5, 0.5)).rgb + texture2D(tColor, vUv + uPx * vec2(0.5, 0.5)).rgb;
  c *= 0.25; float l = max(c.r, max(c.g, c.b)); c *= smoothstep(uThr.x, uThr.x + uThr.y, l);
  gl_FragColor = vec4(min(c, vec3(24.0)), 1.0);
}`, { tColor: { value: null }, uPx: { value: new THREE.Vector2() }, uThr: { value: new THREE.Vector2(0.9, 1.4) } });
  const blur = mat(`
precision highp float; varying vec2 vUv; uniform sampler2D tColor; uniform vec2 uDir;
void main(){
  vec3 c = texture2D(tColor, vUv).rgb * 0.227027;
  c += (texture2D(tColor, vUv + uDir * 1.3846).rgb + texture2D(tColor, vUv - uDir * 1.3846).rgb) * 0.316216;
  c += (texture2D(tColor, vUv + uDir * 3.2308).rgb + texture2D(tColor, vUv - uDir * 3.2308).rgb) * 0.070270;
  gl_FragColor = vec4(c, 1.0);
}`, { tColor: { value: null }, uDir: { value: new THREE.Vector2() } });

  const comp = mat(`
precision highp float; varying vec2 vUv;
uniform sampler2D tColor; uniform sampler2D tBloomA; uniform sampler2D tBloomB;
uniform vec4 uGrade; uniform vec3 uBloom; uniform vec3 uLift;
${BAYER}
vec3 filmic(vec3 x){ x = max(x, 0.0); return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main(){
  vec3 c = texture2D(tColor, vUv).rgb;
  c += texture2D(tBloomA, vUv).rgb * uBloom.x + texture2D(tBloomB, vUv).rgb * uBloom.y;
  c *= uGrade.x;
  float vig = smoothstep(0.95, 0.3, length((vUv - 0.5) * vec2(1.0, 0.9)) * 1.2);
  c *= mix(1.0 - uGrade.z, 1.0, vig);
  c = filmic(c);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uGrade.y);
  c += uLift * (1.0 - smoothstep(0.0, 0.3, l)) * mix(0.55, 1.0, vig);
  c = pow(c, vec3(1.0 / 2.2));
  float b = bayer8(gl_FragCoord.xy);
  c = floor(c * uBloom.z + b) / uBloom.z;
  gl_FragColor = vec4(c, 1.0);
}`, { tColor: { value: null }, tBloomA: { value: null }, tBloomB: { value: null }, uGrade: { value: new THREE.Vector4(1.0, 1.06, 0.6, 1.0) }, uBloom: { value: new THREE.Vector3(0.3, 0.4, 30) }, uLift: { value: new THREE.Vector3(0.010, 0.015, 0.032) } });

  const up = mat(`
precision highp float; varying vec2 vUv;
uniform sampler2D tColor; uniform vec2 uTex; uniform vec2 uOut; uniform float uGrain; uniform float uSeed;
${BAYER}
void main(){
  vec2 texel = vUv * uTex, scale = max(uOut / uTex, vec2(1.0));
  vec2 tf = floor(texel), f = texel - tf, region = 0.5 - 0.5 / scale, cen = f - 0.5;
  vec2 off = (cen - clamp(cen, -region, region)) * scale + 0.5;
  vec3 c = texture2D(tColor, (tf + off) / uTex).rgb;
  float gr = hash12(gl_FragCoord.xy + uSeed) - 0.5;
  c += gr * uGrain * (0.35 + 0.65 * (1.0 - dot(c, vec3(0.333))));
  gl_FragColor = vec4(c, 1.0);
}`, { tColor: { value: null }, uTex: { value: new THREE.Vector2() }, uOut: { value: new THREE.Vector2() }, uGrain: { value: 0.04 }, uSeed: { value: 0 } });

  const rt = {};
  const mk = (w, h, type, filter, depth) => {
    const t = new THREE.WebGLRenderTarget(w, h, { type, format: THREE.RGBAFormat, minFilter: filter, magFilter: filter, depthBuffer: !!depth, stencilBuffer: false, generateMipmaps: false });
    if (depth) { t.depthTexture = new THREE.DepthTexture(w, h); t.depthTexture.type = THREE.UnsignedIntType; }
    return t;
  };
  P.resize = (dw, dh, iw, ih) => {
    P.dw = dw; P.dh = dh; P.iw = iw; P.ih = ih; renderer.setSize(dw, dh, false);
    for (const k in rt) { rt[k].dispose(); if (rt[k].depthTexture) rt[k].depthTexture.dispose(); }
    const HF = THREE.HalfFloatType, NE = THREE.NearestFilter, LI = THREE.LinearFilter;
    rt.scene = mk(iw, ih, HF, NE, true); rt.atmo = mk(iw, ih, HF, NE, false); rt.dof = mk(iw, ih, HF, LI, false);
    const bw = Math.max(4, iw >> 1), bh = Math.max(4, ih >> 1), cw = Math.max(2, iw >> 2), ch = Math.max(2, ih >> 2);
    rt.bA = mk(bw, bh, HF, LI, false); rt.bA2 = mk(bw, bh, HF, LI, false); rt.bB = mk(cw, ch, HF, LI, false); rt.bB2 = mk(cw, ch, HF, LI, false);
    rt.final = mk(iw, ih, THREE.UnsignedByteType, LI, false);
  };
  P.lights = list => {
    for (let i = 0; i < NL; i++) {
      const l = list[i];
      if (l && l.intensity > 0) { lightPos[i].copy(l.position); lightCol[i].set(l.color.r, l.color.g, l.color.b).multiplyScalar(l.intensity); } else lightCol[i].set(0, 0, 0);
    }
  };
  const pass = (m, target) => { fsMesh.material = m; renderer.setRenderTarget(target); renderer.render(fsScene, fsCam); };
  const ivp = new THREE.Matrix4();
  P.render = time => {
    const px = atmo.uniforms.uPx.value.set(1 / P.iw, 1 / P.ih);
    renderer.setRenderTarget(rt.scene); renderer.render(scene, cam);
    let u = atmo.uniforms; u.tColor.value = rt.scene.texture; u.tDepth.value = rt.scene.depthTexture; u.uTime.value = time;
    ivp.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse).invert(); u.uInvVP.value.copy(ivp); cam.getWorldDirection(u.uCamDir.value);
    pass(atmo, rt.atmo);
    u = dof.uniforms; u.tColor.value = rt.atmo.texture; u.tDepth.value = rt.scene.depthTexture; u.uPx.value.copy(px);
    const zr = cam.far - cam.near;
    u.uDof.value.set((P.focusDist - cam.near) / zr, (P.dofBand ?? 3.6) / zr, (P.dofRamp ?? 7) / zr, P.nodof ? 0.6 : Math.max(2, P.ih * (P.dofMax ?? 0.009)));
    pass(dof, rt.dof);
    u = bright.uniforms; u.tColor.value = rt.dof.texture; u.uPx.value.copy(px); pass(bright, rt.bA);
    u = blur.uniforms;
    u.tColor.value = rt.bA.texture; u.uDir.value.set(1 / rt.bA.width, 0); pass(blur, rt.bA2);
    u.tColor.value = rt.bA2.texture; u.uDir.value.set(0, 1 / rt.bA.height); pass(blur, rt.bA);
    u.tColor.value = rt.bA.texture; u.uDir.value.set(1 / rt.bB.width, 0); pass(blur, rt.bB2);
    u.tColor.value = rt.bB2.texture; u.uDir.value.set(0, 1 / rt.bB.height); pass(blur, rt.bB);
    u.tColor.value = rt.bB.texture; u.uDir.value.set(1.6 / rt.bB.width, 0); pass(blur, rt.bB2);
    u.tColor.value = rt.bB2.texture; u.uDir.value.set(0, 1.6 / rt.bB.height); pass(blur, rt.bB);
    u = comp.uniforms; u.tColor.value = rt.dof.texture; u.tBloomA.value = rt.bA.texture; u.tBloomB.value = rt.bB.texture; u.uGrade.value.x = P.exposure;
    pass(comp, rt.final);
    u = up.uniforms; u.tColor.value = rt.final.texture; u.uTex.value.set(P.iw, P.ih); u.uOut.value.set(P.dw, P.dh); u.uSeed.value = (time * 60 % 97) * 13.7;
    pass(up, null);
  };
  P.mats = { atmo, dof, bright, comp, up };
  return P;
}
