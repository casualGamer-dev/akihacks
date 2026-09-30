"use client";
/* eslint-disable react-hooks/immutability -- three.js uniforms and scene objects are mutated every frame by design */
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { RefObject } from "react";
import { STOPS, stopZ } from "@/lib/journey";

export type Quality = "high" | "low";

/* ----------------------------------------------------------------------------
   Palette: late-afternoon autumn, anime background-painting style.
---------------------------------------------------------------------------- */
const HEX = {
  zenith: "#78aee6",
  horizon: "#fbe2c8",
  sun: "#ffd29c",
  fog: "#f2dcc8",
  cloudLit: "#fffaf2",
  cloudShade: "#e3c4c9",
  deep: "#3f7fb5",
  shallow: "#6fb3d9",
  skyRef: "#cfe4f5",
  warmRef: "#e88a4a",
  grassBase: "#5e7a2a",
  grassTip: "#d6cf66",
  grassAutumn: "#e59440",
  leaf1: "#e4552a",
  leaf2: "#f28c34",
  leaf3: "#f4b840",
};
const FOG_NEAR = 45;
const FOG_FAR = 200;
const CAM = new THREE.Vector3(-2, 4.5, 36);
const SUN_DIR = new THREE.Vector3(0.45, 0.2, -1).normalize();
const col = (h: string) => new THREE.Color(h);

/* ----------------------------------------------------------------------------
   Deterministic JS noise (terrain + placement). GLSL twin below.
---------------------------------------------------------------------------- */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (x: number, z: number) => {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
function vnoise(x: number, z: number) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number, oct = 5) {
  let v = 0, a = 0.5;
  for (let i = 0; i < oct; i++) {
    v += a * vnoise(x, y);
    x = x * 2.03 + 17.1;
    y = y * 2.03 + 17.1;
    a *= 0.5;
  }
  return v;
}
/** Bake a noise field into an 8-bit texture once, so shaders do a lookup instead of fbm per pixel. */
function bake(w: number, h: number, f: (u: number, v: number) => number) {
  const data = new Uint8Array(w * h);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) data[j * w + i] = Math.round(clamp(f((i + 0.5) / w, (j + 0.5) / h)) * 255);
  const t = new THREE.DataTexture(data, w, h, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.wrapS = THREE.MirroredRepeatWrapping;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ss = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const riverX = (z: number) => 2 + 6 * Math.sin(0.05 * z + 0.6) + 0.04 * z;

function heightAt(x: number, z: number) {
  const d = Math.abs(x - riverX(z));
  let h = -1 + 1.3 * ss(3.2, 5.2, d);
  h += ss(5, 35, d) * 2.4 * (0.6 + 0.8 * vnoise(x * 0.05, z * 0.05));
  h += (vnoise(x * 0.15 + 3, z * 0.15) - 0.5) * 0.7 * ss(5, 10, d);
  const far = Math.max(0, -z - 25);
  h += far * far * 0.0026 * (0.5 + vnoise(x * 0.03 + 5, z * 0.03)) * ss(5, 16, d); // not under the river, or the boat sinks
  h += Math.max(0, Math.abs(x) - 45) * 0.28;
  return h;
}

/* ----------------------------------------------------------------------------
   GLSL
---------------------------------------------------------------------------- */
const COMMON = /* glsl */ `
float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x*p.y); }
float noise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f*f*(3.0 - 2.0*f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p){ float v = 0.0; float a = 0.5; for (int i = 0; i < OCT; i++){ v += a*noise(p); p = p*2.03 + 17.1; a *= 0.5; } return v; }
uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar;
vec3 fogIt(vec3 c, float d){ return mix(c, uFogColor, smoothstep(uFogNear, uFogFar, d)); }
float riverX(float z){ return 2.0 + 6.0*sin(0.05*z + 0.6) + 0.04*z; }
`;

const WORLD_V = /* glsl */ `
varying vec2 vUv; varying vec3 vW;
void main(){ vUv = uv; vec4 w = modelMatrix*vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }
`;

const SKY_F = /* glsl */ `
uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uSun; uniform vec3 uSunDir;
varying vec2 vUv; varying vec3 vW;
void main(){
  vec3 d = normalize(vW - cameraPosition);
  vec3 c = mix(uHorizon, uZenith, pow(smoothstep(-0.03, 0.6, d.y), 0.75));
  float s = max(dot(d, uSunDir), 0.0);
  c += uSun*(pow(s, 10.0)*0.35 + pow(s, 200.0)*0.5);
  c = mix(c, vec3(1.0, 0.98, 0.93), smoothstep(0.9990, 0.9994, s));
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}
`;

const CLOUD_F = /* glsl */ `
uniform float uTime; uniform vec3 uLit; uniform vec3 uShade; uniform sampler2D uNoise;
varying vec2 vUv; varying vec3 vW;
// uNoise covers p.x in [0, 12.4], p.y in [-0.08, 2.32]
float dens(vec2 p){ return texture2D(uNoise, vec2(p.x/12.4, (p.y + 0.08)/2.4)).r; }
void main(){
  float env = smoothstep(0.03, 0.2, vUv.y)*(1.0 - smoothstep(0.35, 0.8, vUv.y));
  env *= 0.5 + 0.5*smoothstep(-300.0, 150.0, vW.x);
  vec2 p = vec2(vW.x*0.0032 + 4.2 + uTime*0.004, vW.y*0.008);
  float d = dens(p)*env*1.25;
  float a = smoothstep(0.62, 0.70, d);
  if (a <= 0.001) discard;
  float up = dens(p + vec2(0.0, 0.05))*env*1.25;
  vec3 c = mix(uShade, uLit, clamp((d - up)*5.0 + 0.6, 0.0, 1.0));
  c = mix(uFogColor, c, smoothstep(0.03, 0.25, vUv.y));
  gl_FragColor = vec4(c, a);
  #include <colorspace_fragment>
}
`;

const RIDGE_F = /* glsl */ `
uniform vec3 uColor; uniform vec3 uColor2; uniform vec3 uSnow; uniform vec3 uLight;
uniform float uSeed; uniform float uAmp; uniform float uBase; uniform float uFreq;
uniform float uSnowLine; uniform float uHeight; uniform float uPatch; uniform float uW; uniform sampler2D uCrest;
varying vec2 vUv; varying vec3 vW;
float crest(float u){ float n = texture2D(uCrest, vec2(u, 0.5)).r; return uBase + uAmp*n*n*1.8; }
void main(){
  float y = vUv.y*uHeight;
  float ridge = crest(vUv.x);
  float aa = fwidth(y)*1.5;
  float alpha = 1.0 - smoothstep(ridge - aa, ridge + aa, y);
  if (alpha <= 0.001) discard;
  vec3 c = mix(uColor, uColor2, smoothstep(0.35, 0.75, noise(vec2(vW.x*0.05, y*0.1)))*uPatch);
  // slopes that fall away toward the sun (right) catch the light
  float lit = clamp((ridge - crest(vUv.x + 4.0/uW))*0.5, 0.0, 1.0);
  c = mix(c, uLight, lit*0.45*smoothstep(ridge*0.3, ridge, y));
  float sl = step(uSnowLine, ridge)*smoothstep(ridge - 6.0 - 6.0*noise(vec2(vW.x*0.09, uSeed)), ridge - 3.5, y);
  c = mix(c, uSnow, sl);
  c = mix(uFogColor, c, smoothstep(0.0, max(ridge*0.75, 2.0), y));
  gl_FragColor = vec4(c, alpha);
  #include <colorspace_fragment>
}
`;

const WATER_F = /* glsl */ `
uniform float uTime; uniform vec3 uRipple;
uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uSkyRef; uniform vec3 uWarm;
varying vec2 vUv; varying vec3 vW;
void main(){
  vec3 V = normalize(cameraPosition - vW);
  float fres = pow(1.0 - max(V.y, 0.0), 3.0);
  float d = abs(vW.x - riverX(vW.z));
  vec3 c = mix(uDeep, uShallow, smoothstep(0.0, 4.0, d));
  c = mix(c, uSkyRef, 0.3 + 0.55*fres);
  c = mix(c, uWarm, smoothstep(2.2, 4.3, d)*0.35);
  float n = noise(vec2(vW.x*0.6, vW.z*0.15 - uTime*0.5));
  float lines = sin(vW.z*2.2 + n*6.0 - uTime*1.6);
  float spark = smoothstep(0.94, 0.995, lines)*(0.5 + 0.5*noise(vec2(vW.x*2.0, vW.z*0.5 + uTime)));
  c = mix(c, vec3(1.0), spark*0.7);
  c = mix(c, vec3(1.0, 0.98, 0.94), smoothstep(3.6, 4.2, d)*0.55);
  float rt = uTime - uRipple.z;
  if (rt > 0.0 && rt < 4.0){
    float rd = length(vW.xz - uRipple.xy);
    float ring = 0.0;
    for (int i = 0; i < 3; i++){
      float r0 = rt*2.4 - float(i)*0.7;
      ring += (1.0 - smoothstep(0.0, 0.12, abs(rd - r0)))*step(0.0, r0);
    }
    c = mix(c, vec3(1.0), clamp(ring, 0.0, 1.0)*exp(-rt*0.9)*0.8);
  }
  gl_FragColor = vec4(fogIt(c, length(cameraPosition - vW)), 1.0);
  #include <colorspace_fragment>
}
`;

const GRASS_V = /* glsl */ `
attribute vec3 aOff; attribute vec4 aPar;
uniform float uTime; uniform float uGust; uniform vec2 uPointer;
varying float vY; varying float vTint; varying float vDist;
void main(){
  float hgt = aPar.x;
  vec3 p = position; p.y *= hgt;
  float c = cos(aPar.y); float s = sin(aPar.y);
  p.xz = mat2(c, -s, s, c)*p.xz;
  vec3 w = aOff + p;
  float k = position.y*position.y;
  float wave = sin(uTime*1.7 + aOff.x*0.35 + aOff.z*0.22) + 0.6*sin(uTime*2.9 + aOff.x*0.9 - aOff.z*0.5);
  float gust = uGust*(0.8 + 0.4*sin(uTime*6.0 + aOff.x*0.5));
  vec2 bend = vec2(0.9, 0.35)*(wave*0.12 + 0.12 + gust*0.75)*hgt;
  vec2 dp = aOff.xz - uPointer; float dl = length(dp);
  bend += (dp/max(dl, 0.001))*(1.0 - smoothstep(0.0, 2.6, dl))*0.9*hgt;
  w.xz += bend*k;
  w.y -= length(bend)*k*0.35;
  vY = position.y; vTint = aPar.w;
  vec4 mv = viewMatrix*vec4(w, 1.0);
  vDist = -mv.z;
  gl_Position = projectionMatrix*mv;
}
`;

const GRASS_F = /* glsl */ `
uniform vec3 uBase; uniform vec3 uTip; uniform vec3 uTipAutumn;
varying float vY; varying float vTint; varying float vDist;
void main(){
  vec3 tip = mix(uTip, uTipAutumn, smoothstep(0.55, 0.8, vTint));
  vec3 c = mix(uBase, tip, smoothstep(0.0, 1.0, vY))*(0.85 + 0.15*vTint);
  gl_FragColor = vec4(fogIt(c, vDist), 1.0);
  #include <colorspace_fragment>
}
`;

const CANOPY_V = /* glsl */ `
attribute vec3 aCenter; attribute vec4 aDir; attribute vec4 aPar; attribute vec3 aCol;
uniform float uTime; uniform float uGust;
varying vec2 vUv; varying vec3 vN; varying vec3 vCol; varying float vShade; varying float vDist;
void main(){
  vUv = uv;
  // whole crown sways with the wind, top more than bottom
  float sw = sin(uTime*1.4 + aCenter.x*0.35 + aCenter.z*0.27)*(0.05 + uGust*0.22);
  vec3 c = aCenter + aDir.xyz*aDir.w;
  float up = aDir.w*(aDir.y + 1.3);
  c.x += sw*up; c.z += sw*0.4*up;
  // each card flutters a little on its own
  float ph = aPar.w*6.2832;
  c += vec3(sin(uTime*2.3 + ph), cos(uTime*1.9 + ph), 0.0)*0.025*(1.0 + uGust*4.0);
  vec4 mv = viewMatrix*vec4(c, 1.0);
  float r = aPar.y + sin(uTime*1.7 + ph*1.6)*0.1*(1.0 + uGust*2.0);
  mv.xy += mat2(cos(r), -sin(r), sin(r), cos(r))*position.xy*aPar.x; // camera-facing card
  vDist = -mv.z; vN = aDir.xyz; vCol = aCol; vShade = aPar.z;
  gl_Position = projectionMatrix*mv;
}
`;

const CANOPY_F = /* glsl */ `
uniform sampler2D uLeaf; uniform vec3 uLightDir;
varying vec2 vUv; varying vec3 vN; varying vec3 vCol; varying float vShade; varying float vDist;
void main(){
  vec4 t = texture2D(uLeaf, vUv);
  if (t.a < 0.5) discard;
  vec3 n = normalize(vN);
  float l = (dot(n, uLightDir)*0.5 + 0.5)*0.7 + (n.y*0.5 + 0.5)*0.3;
  float band = l < 0.4 ? 0.64 : (l < 0.62 ? 0.84 : 1.0); // toon bands, matches the rest of the scene
  vec3 c = vCol*band*(0.8 + 0.2*t.r)*(0.9 + 0.2*vShade);
  gl_FragColor = vec4(fogIt(c, vDist), 1.0);
  #include <colorspace_fragment>
}
`;

const LEAF_V = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime; uniform float uWind; uniform float uGust; uniform vec2 uOrigin;
uniform vec3 uL1; uniform vec3 uL2; uniform vec3 uL3;
varying vec2 vUv; varying vec3 vCol; varying float vDist;
void main(){
  vUv = uv;
  float H = 17.0;
  float y = 15.5 - mod(uTime*(0.55 + aSeed.w*0.8) + aSeed.y*H, H);
  float x = mix(-30.0, 30.0, aSeed.x) + uWind*(0.6 + aSeed.w*0.8) + sin(uTime*0.7 + aSeed.y*20.0)*1.3;
  x = mod(x + 32.0, 64.0) - 32.0;
  float z = mix(0.0, 30.0, aSeed.z) + sin(uTime*0.5 + aSeed.x*12.0)*0.8;
  x += uOrigin.x; z += uOrigin.y;
  float a = uTime*(0.9 + aSeed.w*2.0)*(1.0 + uGust*2.0) + aSeed.x*40.0;
  vec3 v = position*vec3(0.24, 0.15, 1.0)*(0.7 + aSeed.w*0.7);
  v = vec3(v.x, v.y*cos(a), v.y*sin(a));
  float b = a*0.7 + aSeed.z*10.0;
  v = vec3(v.x*cos(b) + v.z*sin(b), v.y, -v.x*sin(b) + v.z*cos(b));
  vCol = aSeed.w < 0.4 ? uL1 : (aSeed.w < 0.75 ? uL2 : uL3);
  vec4 mv = viewMatrix*vec4(vec3(x, y, z) + v, 1.0);
  vDist = -mv.z;
  gl_Position = projectionMatrix*mv;
}
`;

const LEAF_F = /* glsl */ `
varying vec2 vUv; varying vec3 vCol; varying float vDist;
void main(){
  vec2 q = vUv - 0.5;
  if (length(q*vec2(1.0, 1.0 + abs(q.x)*1.2)) > 0.5) discard;
  vec3 c = vCol*(gl_FrontFacing ? 1.0 : 0.72);
  gl_FragColor = vec4(fogIt(c, vDist), 1.0);
  #include <colorspace_fragment>
}
`;

/* ----------------------------------------------------------------------------
   World construction (runs once per quality tier)
---------------------------------------------------------------------------- */
function makeUniforms() {
  return {
    uTime: { value: 0 },
    uGust: { value: 0 },
    uWind: { value: 0 },
    uPointer: { value: new THREE.Vector2(999, 999) },
    uRipple: { value: new THREE.Vector3(0, 0, -99) },
    uOrigin: { value: new THREE.Vector2(0, 0) }, // leaves follow the boat
    uFogColor: { value: col(HEX.fog) },
    uFogNear: { value: FOG_NEAR },
    uFogFar: { value: FOG_FAR },
  };
}
type Uniforms = ReturnType<typeof makeUniforms>;

const RIDGES = [
  { z: -320, w: 1600, c: "#b3c3e8", c2: "#c3cdee", base: 30, amp: 48, freq: 0.011, seed: 3.1, snow: 44, patch: 0.3 },
  { z: -230, w: 1200, c: "#8fa7da", c2: "#9aaedb", base: 18, amp: 34, freq: 0.017, seed: 8.7, snow: 40, patch: 0.3 },
  { z: -160, w: 900, c: "#6c89c2", c2: "#7b8f9e", base: 10, amp: 20, freq: 0.025, seed: 1.9, snow: 1e4, patch: 0.5 },
  { z: -105, w: 650, c: "#b8663a", c2: "#8a7c3c", base: 5, amp: 12, freq: 0.035, seed: 5.3, snow: 1e4, patch: 1 },
];

function buildWorld(q: Quality, U: Uniforms) {
  const hi = q === "high";
  const group = new THREE.Group();
  const shader = (
    fragmentShader: string,
    extra: Record<string, THREE.IUniform> = {},
    opts: THREE.ShaderMaterialParameters = {},
    vertexShader = WORLD_V,
  ) =>
    new THREE.ShaderMaterial({
      uniforms: { ...U, ...extra },
      vertexShader: COMMON + vertexShader,
      fragmentShader: COMMON + fragmentShader,
      defines: { OCT: hi ? 5 : 3 },
      ...opts,
    });

  const ramp = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.RedFormat);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
  ramp.generateMipmaps = false;
  ramp.needsUpdate = true;

  // sky
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(800, 32, 16),
    shader(
      SKY_F,
      {
        uZenith: { value: col(HEX.zenith) },
        uHorizon: { value: col(HEX.horizon) },
        uSun: { value: col(HEX.sun) },
        uSunDir: { value: SUN_DIR },
      },
      { side: THREE.BackSide, depthWrite: false, depthTest: false },
    ),
  );
  sky.renderOrder = -10;
  group.add(sky);

  // clouds (noise baked once)
  const cloudTex = bake(hi ? 1024 : 512, hi ? 192 : 96, (u, v) => fbm(u * 12.4, v * 2.4 - 0.08, hi ? 5 : 4));
  const clouds = new THREE.Mesh(
    new THREE.PlaneGeometry(2600, 300),
    shader(
      CLOUD_F,
      {
        uLit: { value: col(HEX.cloudLit) },
        uShade: { value: col(HEX.cloudShade) },
        uNoise: { value: cloudTex },
      },
      { transparent: true, depthWrite: false },
    ),
  );
  clouds.position.set(0, 140, -520);
  group.add(clouds);

  // mountain ridges, painted back to front
  for (const r of RIDGES) {
    const H = r.base + r.amp * 1.4 + 4;
    const crestTex = bake(hi ? 2048 : 1024, 1, (u) => fbm((u - 0.5) * r.w * r.freq + r.seed, r.seed * 0.37));
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(r.w, H),
      shader(
        RIDGE_F,
        {
          uColor: { value: col(r.c) },
          uColor2: { value: col(r.c2) },
          uLight: { value: col(r.c).lerp(col("#fff1de"), 0.45) },
          uSnow: { value: col("#f6f7ff") },
          uSeed: { value: r.seed },
          uAmp: { value: r.amp },
          uBase: { value: r.base },
          uFreq: { value: r.freq },
          uSnowLine: { value: r.snow },
          uHeight: { value: H },
          uPatch: { value: r.patch },
          uW: { value: r.w },
          uCrest: { value: crestTex },
        },
        { transparent: true },
      ),
    );
    m.position.set(0, -2 + H / 2, r.z);
    group.add(m);
  }

  // terrain
  const [sx, sz] = hi ? [200, 130] : [120, 76];
  const tg = new THREE.PlaneGeometry(280, 140, sx, sz);
  tg.rotateX(-Math.PI / 2);
  tg.translate(0, 0, -30);
  const pos = tg.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const P = {
    a: col("#a3ab45"), b: col("#cdb752"), litter: col("#dc7a3a"), sand: col("#e0cda2"),
    bed: col("#5f8c95"), forest: col("#9c5a33"), olive: col("#7c7d3c"),
  };
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const d = Math.abs(x - riverX(z));
    const n = vnoise(x * 0.08, z * 0.08), n2 = vnoise(x * 0.2 + 11, z * 0.2);
    c.copy(P.a).lerp(P.b, n);
    if (n2 > 0.62) c.lerp(P.litter, clamp((n2 - 0.62) * 2.2));
    c.lerp(n > 0.5 ? P.forest : P.olive, ss(3, 9, h) * 0.8);
    c.lerp(P.sand, 1 - ss(4.6, 6, d));
    c.lerp(P.bed, 1 - ss(3, 4.4, d));
    c.toArray(colors, i * 3);
  }
  tg.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  tg.computeVertexNormals();
  group.add(new THREE.Mesh(tg, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp })));

  // river
  const wg = new THREE.PlaneGeometry(280, 140);
  wg.rotateX(-Math.PI / 2);
  wg.translate(0, 0, -30);
  group.add(
    new THREE.Mesh(
      wg,
      shader(WATER_F, {
        uDeep: { value: col(HEX.deep) },
        uShallow: { value: col(HEX.shallow) },
        uSkyRef: { value: col(HEX.skyRef) },
        uWarm: { value: col(HEX.warmRef) },
      }),
    ),
  );

  // maple trees: one instanced draw for foliage, one for trunks
  const r = rng(7);
  const autumn = ["#ee6b2b", "#f58e36", "#d8432b", "#f4b13f", "#e25a2c"].map(col);
  const ever = ["#557c3d", "#476f39"].map(col);
  const blobs: { x: number; y: number; z: number; s: number; c: THREE.Color }[] = [];
  const trunks: { x: number; y: number; z: number; h: number; w: number }[] = [];
  const addTree = (x: number, z: number, s: number, full: boolean) => {
    const h = heightAt(x, z);
    const th = (1.3 + r() * 0.8) * s;
    trunks.push({ x, y: h - 0.3, z, h: th + 0.3 + 0.5 * s, w: 0.18 * s });
    const pal = r() < 0.14 ? ever : autumn;
    const tc = pal[Math.floor(r() * pal.length)];
    blobs.push({ x, y: h + th + 0.9 * s, z, s: 1.35 * s, c: tc });
    if (full) {
      blobs.push({ x: x + 0.9 * s, y: h + th + 0.5 * s, z: z + 0.4 * s, s: 1.0 * s, c: tc });
      blobs.push({ x: x - 0.8 * s, y: h + th + 0.6 * s, z: z - 0.3 * s, s: 1.05 * s, c: tc });
    }
    blobs.push({ x: x + 0.15 * s, y: h + th + 1.9 * s, z, s: 0.95 * s, c: tc });
  };
  for (let n = 0, tries = 0; n < (hi ? 170 : 90) && tries < 30000; tries++) {
    const x = -70 + r() * 140, z = -60 + r() * 60;
    const d = Math.abs(x - riverX(z));
    if (d < 6.5 || (z > -12 && x < 0) || (z > -8 && d > 14)) continue; // keep the meadow under the headline clear
    if (r() > (0.25 + 0.75 * (1 - ss(6, 22, d))) * (0.4 + vnoise(x * 0.07, z * 0.07))) continue;
    addTree(x, z, 0.7 + r() * 0.5, true);
    n++;
  }
  for (let n = 0, tries = 0; n < (hi ? 420 : 220) && tries < 30000; tries++) {
    const x = -95 + r() * 190, z = -88 + r() * 63;
    if (Math.abs(x - riverX(z)) < 7 || r() > 0.3 + vnoise(x * 0.05, z * 0.05)) continue;
    addTree(x, z, 1.5 + r() * 0.9, false);
    n++;
  }
  // near-first: early depth rejection + LOD can trim the far end by lowering .count
  blobs.sort((a, b) => b.z - a.z);
  trunks.sort((a, b) => b.z - a.z);
  const o = new THREE.Object3D();

  // leaf cards: camera-facing clusters of painted leaves on each crown, so crowns read leafy, not round
  const leafTex = (() => {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 128;
    const g = cv.getContext("2d")!;
    const lr2 = rng(11);
    for (let i = 0; i < 9; i++) {
      const a = lr2() * Math.PI * 2, d = i ? 18 + lr2() * 26 : 0, r = 20 + lr2() * 12;
      g.save();
      g.translate(64 + Math.cos(a) * d, 64 + Math.sin(a) * d);
      g.rotate(lr2() * Math.PI * 2);
      const v = Math.round(170 + lr2() * 85);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.beginPath();
      g.moveTo(0, -r);
      g.quadraticCurveTo(r * 0.75, -r * 0.1, 0, r);
      g.quadraticCurveTo(-r * 0.75, -r * 0.1, 0, -r);
      g.fill();
      g.strokeStyle = `rgb(${v - 60},${v - 60},${v - 60})`; // midrib
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, -r * 0.8);
      g.lineTo(0, r * 0.9);
      g.stroke();
      g.restore();
    }
    const t = new THREE.CanvasTexture(cv);
    t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  })();
  const CARDS = hi ? 40 : 22; // crowns are leaf cards only, no solid core, so they need more
  const leafN = blobs.length * CARDS;
  const cg = new THREE.InstancedBufferGeometry();
  const card = new THREE.PlaneGeometry(1, 1);
  cg.setIndex(card.index);
  cg.setAttribute("position", card.getAttribute("position"));
  cg.setAttribute("uv", card.getAttribute("uv"));
  const aCenter = new Float32Array(leafN * 3), aDir = new Float32Array(leafN * 4);
  const aPar = new Float32Array(leafN * 4), aCol = new Float32Array(leafN * 3);
  const cr = rng(13);
  const v3 = new THREE.Vector3();
  const lc = new THREE.Color();
  // card-major order: trimming instanceCount thins every crown evenly instead of stripping far ones bare
  for (let j = 0, n = 0; j < CARDS; j++)
    for (const b of blobs) {
      v3.set(cr() * 2 - 1, (cr() * 2 - 1) * 0.85 + 0.2, cr() * 2 - 1).normalize();
      aCenter.set([b.x, b.y, b.z], n * 3);
      aDir.set([v3.x, v3.y, v3.z, b.s * (0.2 + 0.85 * Math.cbrt(cr()))], n * 4);
      aPar.set([b.s * (0.75 + cr() * 0.45), cr() * Math.PI * 2, cr(), cr()], n * 4);
      lc.copy(b.c).offsetHSL((cr() - 0.5) * 0.03, 0, (cr() - 0.5) * 0.08);
      lc.toArray(aCol, n * 3);
      n++;
    }
  cg.setAttribute("aCenter", new THREE.InstancedBufferAttribute(aCenter, 3));
  cg.setAttribute("aDir", new THREE.InstancedBufferAttribute(aDir, 4));
  cg.setAttribute("aPar", new THREE.InstancedBufferAttribute(aPar, 4));
  cg.setAttribute("aCol", new THREE.InstancedBufferAttribute(aCol, 3));
  cg.instanceCount = leafN;
  const canopy = new THREE.Mesh(
    cg,
    shader(
      CANOPY_F,
      { uLeaf: { value: leafTex }, uLightDir: { value: new THREE.Vector3(70, 55, -10).normalize() } },
      {},
      CANOPY_V,
    ),
  );
  canopy.frustumCulled = false;
  group.add(canopy);

  const trunkGeo = new THREE.CylinderGeometry(0.6, 1, 1, 6);
  trunkGeo.translate(0, 0.5, 0);
  const trunkMesh = new THREE.InstancedMesh(
    trunkGeo,
    new THREE.MeshToonMaterial({ color: "#5a3a2a", gradientMap: ramp }),
    trunks.length,
  );
  trunks.forEach((t, i) => {
    o.position.set(t.x, t.y, t.z);
    o.scale.set(t.w, t.h, t.w);
    o.updateMatrix();
    trunkMesh.setMatrixAt(i, o.matrix);
  });
  trunkMesh.frustumCulled = false;
  group.add(trunkMesh);

  // meadow grass: one draw call, wind + pointer brushing on the GPU
  const GRASS = hi ? 22000 : 9000;
  const w = 0.05;
  const gg = new THREE.InstancedBufferGeometry();
  gg.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4]);
  gg.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([-w, 0, 0, w, 0, 0, -w * 0.75, 0.45, 0, w * 0.75, 0.45, 0, 0, 1, 0], 3),
  );
  const off = new Float32Array(GRASS * 3), par = new Float32Array(GRASS * 4);
  const gr = rng(3);
  for (let n = 0; n < GRASS; ) {
    const z = -72 + gr() * 106;
    const side = gr() < 0.5 ? -1 : 1;
    const x = riverX(z) + side * (5.4 + gr() * gr() * 20);
    off.set([x, heightAt(x, z) - 0.05, z], n * 3);
    const t = vnoise(x * 0.15, z * 0.15);
    par.set([0.45 + gr() * 0.55 + t * 0.25, gr() * Math.PI, gr(), t], n * 4);
    n++;
  }
  gg.setAttribute("aOff", new THREE.InstancedBufferAttribute(off, 3));
  gg.setAttribute("aPar", new THREE.InstancedBufferAttribute(par, 4));
  gg.instanceCount = GRASS;
  const grass = new THREE.Mesh(
    gg,
    shader(
      GRASS_F,
      {
        uBase: { value: col(HEX.grassBase) },
        uTip: { value: col(HEX.grassTip) },
        uTipAutumn: { value: col(HEX.grassAutumn) },
      },
      { side: THREE.DoubleSide },
      GRASS_V,
    ),
  );
  grass.frustumCulled = false;
  group.add(grass);

  // falling maple leaves
  const LEAVES = hi ? 420 : 180;
  const leafBase = new THREE.PlaneGeometry(1, 1);
  const lg = new THREE.InstancedBufferGeometry();
  lg.setIndex(leafBase.index);
  lg.setAttribute("position", leafBase.getAttribute("position"));
  lg.setAttribute("uv", leafBase.getAttribute("uv"));
  const seeds = new Float32Array(LEAVES * 4);
  const lr = rng(5);
  for (let i = 0; i < seeds.length; i++) seeds[i] = lr();
  lg.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 4));
  lg.instanceCount = LEAVES;
  const leaves = new THREE.Mesh(
    lg,
    shader(
      LEAF_F,
      { uL1: { value: col(HEX.leaf1) }, uL2: { value: col(HEX.leaf2) }, uL3: { value: col(HEX.leaf3) } },
      { side: THREE.DoubleSide },
      LEAF_V,
    ),
  );
  leaves.frustumCulled = false;
  group.add(leaves);

  // ---- the boat and its docks (one dock per stop of the journey)
  const wood = new THREE.MeshToonMaterial({ color: "#8a4f2b", gradientMap: ramp });
  const deckMat = new THREE.MeshToonMaterial({ color: "#dba765", gradientMap: ramp });
  // hull: lofted cross-sections with an upswept bow and stern (a Japanese river boat, loosely)
  const L = 4.4, NS = 28, NT = 12;
  const hw = (t: number) => 0.82 * Math.pow(Math.sin(Math.PI * t), 0.6);
  const top = (t: number) => 0.32 + 0.55 * Math.pow(Math.abs(2 * t - 1), 3) * (t < 0.5 ? 1.25 : 0.7);
  const keel = (t: number) => -0.42 * Math.pow(Math.sin(Math.PI * t), 0.35);
  const hp: number[] = [], hc: number[] = [], hIdx: number[] = [];
  const HULL = col("#6b3a22"), STRIPE = col("#d9542a"), RIM = col("#3f2114");
  for (let i = 0; i <= NS; i++) {
    const t = i / NS, z = -L / 2 + t * L, w = hw(t), tp = top(t), k = keel(t);
    for (let j = 0; j <= NT; j++) {
      const th = (j / NT) * Math.PI;
      const y = tp + (k - tp) * Math.pow(Math.sin(th), 0.7);
      hp.push(w * Math.cos(th), y, z);
      const fromTop = tp - y;
      (fromTop < 0.05 ? RIM : fromTop < 0.16 ? STRIPE : HULL).toArray(hc, hc.length);
    }
  }
  for (let i = 0; i < NS; i++)
    for (let j = 0; j < NT; j++) {
      const a = i * (NT + 1) + j, b = a + NT + 1;
      hIdx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  const hullGeo = new THREE.BufferGeometry();
  hullGeo.setAttribute("position", new THREE.Float32BufferAttribute(hp, 3));
  hullGeo.setAttribute("color", new THREE.Float32BufferAttribute(hc, 3));
  hullGeo.setIndex(hIdx);
  hullGeo.computeVertexNormals();
  // front faces must point outward: mid-ship, the starboard side should face +x
  if (hullGeo.attributes.normal.getX((NS / 2) * (NT + 1) + 2) < 0) {
    for (let i = 0; i < hIdx.length; i += 3) [hIdx[i + 1], hIdx[i + 2]] = [hIdx[i + 2], hIdx[i + 1]];
    hullGeo.setIndex(hIdx);
    hullGeo.computeVertexNormals();
  }
  const boat = new THREE.Group();
  const hullOut = new THREE.Mesh(hullGeo, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp }));
  const hullIn = new THREE.Mesh(
    hullGeo,
    new THREE.MeshToonMaterial({ color: "#b9814c", side: THREE.BackSide, gradientMap: ramp }),
  );
  const railMat = new THREE.MeshToonMaterial({ color: "#3f2114", gradientMap: ramp });
  const rail = (side: number) =>
    new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(
          Array.from(
            { length: 15 },
            (_, i) => new THREE.Vector3(side * hw(i / 14) * 1.01, top(i / 14) + 0.02, -L / 2 + (i / 14) * L),
          ),
        ),
        40,
        0.045,
        5,
      ),
      railMat,
    );
  // plank floor
  const fl = new THREE.Shape();
  for (let i = 0; i <= 20; i++) {
    const t = 0.1 + (i / 20) * 0.8;
    if (i) fl.lineTo(hw(t) * 0.7, L / 2 - t * L);
    else fl.moveTo(hw(t) * 0.7, L / 2 - t * L);
  }
  for (let i = 20; i >= 0; i--) {
    const t = 0.1 + (i / 20) * 0.8;
    fl.lineTo(-hw(t) * 0.7, L / 2 - t * L);
  }
  const floorGeo = new THREE.ShapeGeometry(fl);
  floorGeo.rotateX(-Math.PI / 2);
  const floor = new THREE.Mesh(floorGeo, deckMat);
  floor.position.y = -0.14;
  const seat = new THREE.Mesh(new THREE.BoxGeometry(hw(0.3) * 2, 0.07, 0.34), deckMat);
  seat.position.set(0, top(0.3) - 0.1, -L / 2 + 0.3 * L);

  // woven straw canopy over the stern half
  const straw = new THREE.MeshToonMaterial({ color: "#d4ac62", side: THREE.DoubleSide, gradientMap: ramp });
  const roofGeo = new THREE.CylinderGeometry(0.72, 0.72, 1.4, 16, 1, true, -Math.PI / 2, Math.PI);
  roofGeo.rotateX(-Math.PI / 2);
  const roof = new THREE.Mesh(roofGeo, straw);
  roof.position.set(0, 0.36, 0.95);
  roof.scale.set(1, 0.9, 1);
  const ribMat = new THREE.MeshToonMaterial({ color: "#7a4a24", gradientMap: ramp });
  const ribs = [0.28, 0.95, 1.62].map((z) => {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.73, 0.03, 5, 18, Math.PI), ribMat);
    r.position.set(0, 0.36, z);
    r.scale.set(1, 0.9, 1);
    return r;
  });

  // mast and battened sail, forward of the canopy
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.075, 3.2, 7), wood);
  mast.position.set(0, 1.45, -0.6);
  const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.95, 6), wood);
  yard.rotation.z = Math.PI / 2;
  yard.position.set(0, 2.95, -0.6);
  const sailTex = (() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 300;
    const g = c.getContext("2d")!;
    g.fillStyle = "#f7ecd8";
    g.fillRect(0, 0, 256, 300);
    g.strokeStyle = "#8a5a33"; // battens
    g.lineWidth = 5;
    for (let y = 60; y < 300; y += 60) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(256, y);
      g.stroke();
    }
    g.strokeStyle = "#c9ab7c";
    g.lineWidth = 8;
    g.strokeRect(4, 4, 248, 292);
    g.fillStyle = "#f25d27";
    g.font = "700 180px 'Noto Serif JP','Yu Mincho','MS Mincho','Hiragino Mincho ProN',serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("秋", 128, 155);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const sailGeo = new THREE.PlaneGeometry(1.8, 2.1, 8, 8);
  const sp = sailGeo.attributes.position;
  for (let i = 0; i < sp.count; i++)
    sp.setZ(i, 0.2 * Math.cos((sp.getX(i) / 1.8) * Math.PI) * (0.5 + (sp.getY(i) / 2.1 + 0.5)));
  sailGeo.computeVertexNormals();
  const sail = new THREE.Mesh(
    sailGeo,
    new THREE.MeshToonMaterial({ map: sailTex, side: THREE.DoubleSide, gradientMap: ramp }),
  );
  sail.position.set(0, 1.85, -0.62);

  // stern lantern on a pole, and the sculling oar
  const lanternMat = new THREE.MeshBasicMaterial({ color: "#ffb35a" });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 1.3, 5), wood);
  pole.position.set(0.25, 0.9, 1.95);
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.3, 10), lanternMat);
  lantern.position.set(0.25, 1.45, 1.95);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.12, 10), ribMat);
  cap.position.set(0.25, 1.65, 1.95);
  const oar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.6, 5), wood);
  oar.position.set(-0.3, 0.2, 2.8);
  oar.rotation.set(1.15, 0, 0.25);
  boat.add(hullOut, hullIn, rail(1), rail(-1), floor, seat, roof, ...ribs, mast, yard, sail, pole, lantern, cap, oar);
  boat.scale.setScalar(1.15);
  group.add(boat);

  const plank = new THREE.BoxGeometry(2.8, 0.1, 1.2);
  const post = new THREE.CylinderGeometry(0.07, 0.09, 1.1, 6);
  const lampPost = new THREE.CylinderGeometry(0.05, 0.07, 2.6, 6);
  const lamp = new THREE.SphereGeometry(0.22, 10, 8);
  for (let i = 0; i < STOPS; i++) {
    const z = stopZ(i);
    const rx = riverX(z);
    const d = new THREE.Group();
    const pl = new THREE.Mesh(plank, deckMat);
    pl.position.set(rx + 4.3, 0.2, z);
    const p1 = new THREE.Mesh(post, wood);
    p1.position.set(rx + 3.0, 0.1, z - 0.5);
    const p2 = p1.clone();
    p2.position.z = z + 0.5;
    const lp = new THREE.Mesh(lampPost, wood);
    lp.position.set(rx + 5.7, heightAt(rx + 5.7, z) + 1.2, z);
    const lm = new THREE.Mesh(lamp, lanternMat);
    lm.position.set(rx + 5.7, lp.position.y + 1.4, z);
    d.add(pl, p1, p2, lp, lm);
    group.add(d);
  }
  const rxp = (z: number) => 0.3 * Math.cos(0.05 * z + 0.6) + 0.04; // d(riverX)/dz
  const boatPos = (seg: number) => {
    const z = stopZ(0) + (seg / (STOPS - 1)) * (stopZ(STOPS - 1) - stopZ(0));
    return { x: riverX(z) + 0.6, z };
  };
  /** seg = position along the river in stop units. Returns the boat's world position. */
  const placeBoat = (seg: number, t: number) => {
    const { x, z } = boatPos(seg);
    boat.position.set(x, 0.22 + Math.sin(t * 1.3) * 0.03, z); // floor must stay above the opaque water plane or water shows inside the hull
    boat.rotation.set(Math.sin(t * 0.9) * 0.02, Math.atan2(rxp(z), 1), Math.sin(t * 1.1) * 0.035, "YXZ");
    sail.rotation.y = Math.sin(t * 0.8) * 0.05;
    return { x, z };
  };
  placeBoat(0, 0);

  const dispose = () => {
    group.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.dispose();
      (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => {
        const u = (x as THREE.ShaderMaterial).uniforms;
        if (u) Object.values(u).forEach((v) => (v.value as THREE.Texture)?.isTexture && v.value.dispose());
        x.dispose();
      });
    });
    leafBase.dispose();
    card.dispose();
    ramp.dispose();
  };
  /** Level of detail: 1 = full, lower trims the farthest trees and thins the grass. */
  const setDetail = (k: number) => {
    cg.instanceCount = Math.floor(leafN * Math.max(k, 0.55));
    gg.instanceCount = Math.floor(GRASS * Math.max(k, 0.5));
  };
  return { group, dispose, setDetail, placeBoat, boatPos };
}

/* ----------------------------------------------------------------------------
   Runtime: camera rig, pointer, gusts, ripples, adaptive resolution
---------------------------------------------------------------------------- */
const GROUND = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.5);
const WATER = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

function World({
  quality,
  maxDpr,
  onReady,
  story,
}: {
  quality: Quality;
  maxDpr: number;
  onReady: () => void;
  /** The boat trip: target stop to sail to, and a callback on arrival. Absent = the still hero. */
  story?: RefObject<{ target: number; onArrive: () => void }>;
}) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const setDpr = useThree((s) => s.setDpr);
  const U = useMemo(() => makeUniforms(), []);
  const world = useMemo(() => buildWorld(quality, U), [quality, U]);
  useEffect(() => {
    // dev-only handle for profiling layers from the console
    if (process.env.NODE_ENV !== "production") (window as unknown as { __valley: THREE.Group }).__valley = world.group;
    return () => world.dispose();
  }, [world]);

  const tmp = useMemo(
    () => ({
      ray: new THREE.Raycaster(),
      ndc: new THREE.Vector2(),
      hit: new THREE.Vector3(),
      target: new THREE.Vector3(),
      look: new THREE.Vector3(0, 3.6, -60),
      lookTarget: new THREE.Vector3(),
      p2: new THREE.Vector2(),
    }),
    [],
  );
  const st = useRef({ seg: 0, from: 0, to: 0, tt: 0, dur: 1, sailing: false, ripple: 0, t: 0, gust: 0, wind: 0, active: false, frames: 0, acc: 0, n: 0, dpr: maxDpr, detail: 1 });

  useEffect(() => {
    st.current.dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    const el = gl.domElement;
    const locate = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (inside) tmp.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      st.current.active = inside;
      return inside;
    };
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || !locate(e)) return;
      if ((e.target as Element | null)?.closest?.("a,button,input,textarea,select,summary")) return;
      st.current.gust = 1;
      tmp.ray.setFromCamera(tmp.ndc, camera);
      if (tmp.ray.ray.intersectPlane(WATER, tmp.hit) && Math.abs(tmp.hit.x - riverX(tmp.hit.z)) < 4)
        U.uRipple.value.set(tmp.hit.x, tmp.hit.z, st.current.t);
    };
    const leave = () => (st.current.active = false);
    window.addEventListener("pointermove", locate, { passive: true });
    window.addEventListener("pointerdown", down, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    return () => {
      window.removeEventListener("pointermove", locate);
      window.removeEventListener("pointerdown", down);
      document.documentElement.removeEventListener("pointerleave", leave);
    };
  }, [gl, camera, tmp, U, maxDpr]);

  useFrame(({ size }, rawDt) => {
    const s = st.current;
    const dt = Math.min(rawDt, 0.05);
    s.t += dt;
    s.gust *= Math.exp(-dt * 1.1);
    s.wind += dt * (0.5 + s.gust * 9);
    U.uTime.value = s.t;
    U.uGust.value = s.gust;
    U.uWind.value = s.wind;

    // camera: slow idle drift + pointer parallax, or (story) trailing the boat down the river
    const px = s.active ? tmp.ndc.x : 0, py = s.active ? tmp.ndc.y : 0;
    const k = 1 - Math.exp(-dt * 2.5);
    if (story?.current) {
      // sail: time-based ease between stops, independent of scroll or frame rate
      const goal = story.current.target;
      if (goal !== s.to) {
        s.from = s.seg;
        s.to = goal;
        s.tt = 0;
        s.dur = Math.min(9, 3.4 + 1.5 * Math.abs(goal - s.seg));
        s.sailing = true;
      }
      if (s.sailing) {
        s.tt += Math.min(rawDt, 0.25); // wall-clock, so slow frames do not stretch the trip
        const u = Math.min(1, s.tt / s.dur);
        s.seg = s.from + (s.to - s.from) * (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
        if (s.t - s.ripple > 0.45) {
          const w = world.boatPos(s.seg);
          U.uRipple.value.set(w.x, w.z, s.t); // wake
          s.ripple = s.t;
        }
        if (u === 1) {
          s.sailing = false;
          story.current.onArrive();
        }
      }
      const bp = world.placeBoat(s.seg, s.t);
      U.uOrigin.value.set(bp.x, bp.z - 22);
      tmp.target.set(bp.x * 0.85 - 1 + px * 1.0, 3.8 + py * 0.3 + Math.sin(s.t * 0.11) * 0.1, bp.z + 13.5);
      camera.position.lerp(tmp.target, 1 - Math.exp(-dt * 6));
      tmp.lookTarget.set(bp.x * 0.4 + px * 1.2, 1.2 + py * 0.5, bp.z - 60);
      tmp.look.lerp(tmp.lookTarget, k);
      camera.lookAt(tmp.look);
      // the card sits on one side (bottom on phones), so slide the boat away from it; centred while sailing
      const wide = size.width >= 900;
      const cam = camera as THREE.PerspectiveCamera;
      cam.setViewOffset(
        size.width,
        size.height,
        wide ? -Math.cos(Math.PI * s.seg) * 0.22 * size.width : 0,
        size.height * (wide ? 0.05 : 0.22),
        size.width,
        size.height,
      );
    } else {
      tmp.target.set(CAM.x + px * 1.4 + Math.sin(s.t * 0.07) * 0.6, CAM.y + py * 0.5 + Math.sin(s.t * 0.11) * 0.15, CAM.z);
      camera.position.lerp(tmp.target, k);
      tmp.lookTarget.set(px * 1.5, 3.6 + py * 0.6, -60);
      tmp.look.lerp(tmp.lookTarget, k);
      camera.lookAt(tmp.look);
    }

    // pointer brushes the grass
    if (s.active) {
      tmp.ray.setFromCamera(tmp.ndc, camera);
      if (tmp.ray.ray.intersectPlane(GROUND, tmp.hit)) {
        tmp.p2.set(tmp.hit.x, tmp.hit.z);
        U.uPointer.value.lerp(tmp.p2, 1 - Math.exp(-dt * 10));
      }
    } else U.uPointer.value.set(999, 999);

    // first frames rendered: reveal
    if (++s.frames === 3) onReady();

    // adaptive resolution: step down if the device can't hold ~48fps
    if (rawDt < 0.25 && s.frames > 60) {
      s.acc += rawDt;
      s.n++;
      if (s.acc > 1.5) {
        if (s.n / s.acc < 48) {
          if (s.dpr > 0.75) {
            s.dpr = Math.max(0.75, s.dpr - 0.25);
            setDpr(s.dpr);
          } else if (s.detail > 0.45) {
            s.detail -= 0.2;
            world.setDetail(s.detail);
          }
        }
        s.acc = 0;
        s.n = 0;
      }
    }
  });

  return <primitive object={world.group} />;
}

export default function ValleyScene({
  quality,
  paused,
  onReady,
  story,
}: {
  quality: Quality;
  paused: boolean;
  onReady: () => void;
  story?: RefObject<{ target: number; onArrive: () => void }>;
}) {
  const maxDpr = quality === "high" ? 1.5 : 1.25;
  return (
    <Canvas
      flat
      dpr={[0.75, maxDpr]}
      frameloop={paused ? "never" : "always"}
      camera={{ position: CAM.toArray(), fov: 40, near: 0.5, far: 1200 }}
      gl={{ antialias: quality === "high", powerPreference: "high-performance", stencil: false, alpha: false }}
      onCreated={({ gl, scene }) => {
        gl.setClearColor(HEX.fog);
        scene.fog = new THREE.Fog(HEX.fog, FOG_NEAR, FOG_FAR);
      }}
    >
      <hemisphereLight args={["#d6e6fb", "#c79a62", 1.6]} />
      <directionalLight position={[70, 55, -10]} intensity={1.7} color="#fff0db" />
      <World quality={quality} maxDpr={maxDpr} onReady={onReady} story={story} />
    </Canvas>
  );
}
