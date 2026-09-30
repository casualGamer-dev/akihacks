"use client";
/* eslint-disable react-hooks/immutability -- three.js uniforms and scene objects are mutated every frame by design */
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { RefObject } from "react";
import { STOPS, stopZ } from "@/lib/journey";
import { CHZ, clamp, heightAt, pieces, RIDGES, riverX, rng, ss, vnoise, ZMIN, type ChunkPiece, type Piece } from "@/lib/worldgen";

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
  float fd = length(cameraPosition - vW);
  if (fd < 110.0){ // far water is mostly fog: skip the noise there
    float n = noise(vec2(vW.x*0.6, vW.z*0.15 - uTime*0.5));
    float lines = sin(vW.z*2.2 + n*6.0 - uTime*1.6);
    float spark = smoothstep(0.94, 0.995, lines)*(0.5 + 0.5*noise(vec2(vW.x*2.0, vW.z*0.5 + uTime)));
    c = mix(c, vec3(1.0), spark*0.7);
  }
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
  gl_FragColor = vec4(fogIt(c, fd), 1.0);
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
  float lodKeep = 1.0 - 0.72*smoothstep(35.0, 95.0, -mv.z); // same curve as updateLOD on the CPU
  mv.xy += mat2(cos(r), -sin(r), sin(r), cos(r))*position.xy*aPar.x*1.22*inversesqrt(lodKeep); // camera-facing card
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
  vec3 c = vCol*band*(0.8 + 0.2*t.r)*vShade; // vShade = baked occlusion
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

  // clouds and ridge silhouettes: meshes exist now (so their shaders compile with the rest), the baked noise streams in
  const mkTex = (w: number, h: number, data: Uint8Array, mirror: boolean) => {
    const t = new THREE.DataTexture(data, w, h, THREE.RedFormat);
    t.minFilter = t.magFilter = THREE.LinearFilter;
    if (mirror) t.wrapS = THREE.MirroredRepeatWrapping;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    return t;
  };
  const cloudMat = shader(
    CLOUD_F,
    {
      uLit: { value: col(HEX.cloudLit) },
      uShade: { value: col(HEX.cloudShade) },
      uNoise: { value: mkTex(1, 1, new Uint8Array(1), false) },
    },
    { transparent: true, depthWrite: false },
  );
  const clouds = new THREE.Mesh(new THREE.PlaneGeometry(2600, 300), cloudMat);
  clouds.position.set(0, 140, -520);
  group.add(clouds);

  // mountain ridges, painted back to front
  const ridgeMats = RIDGES.map((r) => {
    const H = r.base + r.amp * 1.4 + 4;
    const mat = shader(
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
        uCrest: { value: mkTex(1, 1, new Uint8Array(1), true) },
      },
      { transparent: true },
    );
    const m = new THREE.Mesh(new THREE.PlaneGeometry(r.w, H), mat);
    m.position.set(0, -2 + H / 2, r.z);
    group.add(m);
    return mat;
  });

  // terrain
  const [sx, sz] = hi ? [200, 200] : [120, 120];
  const tg = new THREE.PlaneGeometry(280, 240, sx, sz);
  tg.rotateX(-Math.PI / 2);
  tg.translate(0, 0, -80);
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
  const wg = new THREE.PlaneGeometry(280, 240);
  wg.rotateX(-Math.PI / 2);
  wg.translate(0, 0, -80);
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

  // ---- trees and grass stream in from lib/worldgen, one river slice at a time (see addPiece).
  // Chunking: every slice is its own draw, so the GPU skips slices behind or beside the camera,
  // and far slices get thinned (see updateLOD).
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
  type Chunk = { geo: THREE.InstancedBufferGeometry; total: number; zc: number };
  const canopyChunks: Chunk[] = [];
  const grassChunks: Chunk[] = [];
  const sph = (v: [number, number, number, number]) => new THREE.Sphere(new THREE.Vector3(v[0], v[1], v[2]), v[3]);

  const card = new THREE.PlaneGeometry(1, 1);
  const canopyMat = shader(
    CANOPY_F,
    { uLeaf: { value: leafTex }, uLightDir: { value: new THREE.Vector3(70, 55, -10).normalize() } },
    {},
    CANOPY_V,
  );
  const mkCanopy = (a: { center: Float32Array; dir: Float32Array; par: Float32Array; col: Float32Array }, n: number, sphere: THREE.Sphere) => {
    const cg = new THREE.InstancedBufferGeometry();
    cg.setIndex(card.index);
    cg.setAttribute("position", card.getAttribute("position"));
    cg.setAttribute("uv", card.getAttribute("uv"));
    cg.setAttribute("aCenter", new THREE.InstancedBufferAttribute(a.center, 3));
    cg.setAttribute("aDir", new THREE.InstancedBufferAttribute(a.dir, 4));
    cg.setAttribute("aPar", new THREE.InstancedBufferAttribute(a.par, 4));
    cg.setAttribute("aCol", new THREE.InstancedBufferAttribute(a.col, 3));
    cg.instanceCount = n;
    cg.boundingSphere = sphere;
    return cg;
  };

  const trunkGeo = new THREE.CylinderGeometry(0.6, 1, 1, 6);
  trunkGeo.translate(0, 0.5, 0);
  const trunkMat = new THREE.MeshToonMaterial({ color: "#5a3a2a", gradientMap: ramp });

  // soft contact shadows under each crown: cheap fake occlusion that grounds the trees
  const shadowTex = (() => {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 64;
    const g = cv.getContext("2d")!;
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    grad.addColorStop(0, "rgba(0,0,0,1)");
    grad.addColorStop(0.55, "rgba(0,0,0,0.45)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  })();
  const shadowGeo = new THREE.PlaneGeometry(1, 1);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    color: "#3a2210",
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const mkTrunks = (data: Float32Array, n: number) => {
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, n);
    const shadows = new THREE.InstancedMesh(shadowGeo, shadowMat, n);
    for (let i = 0; i < n; i++) {
      const x = data[i * 5], y = data[i * 5 + 1], z = data[i * 5 + 2], h = data[i * 5 + 3], w = data[i * 5 + 4];
      o.position.set(x, y, z);
      o.scale.set(w, h, w);
      o.updateMatrix();
      trunks.setMatrixAt(i, o.matrix);
      o.position.set(x, y + 0.35, z);
      o.scale.setScalar(w * 18);
      o.updateMatrix();
      shadows.setMatrixAt(i, o.matrix);
    }
    return [trunks, shadows]; // both frustum-culled per slice
  };

  // meadow grass: one draw per river slice, wind + pointer brushing on the GPU
  const gw = 0.05;
  const gIndex = [0, 1, 2, 2, 1, 3, 2, 3, 4];
  const gPos = new THREE.Float32BufferAttribute([-gw, 0, 0, gw, 0, 0, -gw * 0.75, 0.45, 0, gw * 0.75, 0.45, 0, 0, 1, 0], 3);
  const grassMat = shader(
    GRASS_F,
    {
      uBase: { value: col(HEX.grassBase) },
      uTip: { value: col(HEX.grassTip) },
      uTipAutumn: { value: col(HEX.grassAutumn) },
    },
    { side: THREE.DoubleSide },
    GRASS_V,
  );
  const mkGrass = (off: Float32Array, par: Float32Array, n: number, sphere: THREE.Sphere) => {
    const gg = new THREE.InstancedBufferGeometry();
    gg.setIndex(gIndex);
    gg.setAttribute("position", gPos);
    gg.setAttribute("aOff", new THREE.InstancedBufferAttribute(off, 3));
    gg.setAttribute("aPar", new THREE.InstancedBufferAttribute(par, 4));
    gg.instanceCount = n;
    gg.boundingSphere = sphere;
    return gg;
  };

  // one hidden instance of each, so every shader compiles up front (compileAsync) instead of when the first slice lands
  const away = new THREE.Sphere(new THREE.Vector3(0, -1000, 0), 1);
  group.add(new THREE.Mesh(mkCanopy({ center: new Float32Array(3), dir: new Float32Array(4), par: new Float32Array(4), col: new Float32Array(3) }, 1, away), canopyMat));
  group.add(new THREE.Mesh(mkGrass(new Float32Array([0, -1000, 0]), new Float32Array(4), 1, away), grassMat));
  group.add(...mkTrunks(new Float32Array([0, -1000, 0, 1, 1]), 1));

  /** Clouds and ridge silhouettes: baked noise streamed in from the worker. */
  const addPiece = (p: Exclude<Piece, ChunkPiece>) => {
    if (p.k === "cloud") {
      const old = cloudMat.uniforms.uNoise.value as THREE.Texture;
      cloudMat.uniforms.uNoise.value = mkTex(p.w, p.h, p.data, false);
      old.dispose();
    } else {
      const u = ridgeMats[p.i].uniforms.uCrest;
      const old = u.value as THREE.Texture;
      u.value = mkTex(p.w, 1, p.data, true);
      old.dispose();
    }
  };

  // River slices are built on the GPU only while the boat is near them: the data arrives early, but slices far ahead
  // (hidden in fog anyway) and far behind are not resident. Data stays in memory, so sailing back re-creates them.
  const AHEAD = 150, BEHIND = 50;
  const stored = new Map<number, ChunkPiece>();
  type Live = { objs: THREE.Object3D[]; entries: Chunk[] };
  const live = new Map<number, Live>();
  const storeChunk = (p: ChunkPiece) => void stored.set(p.ci, p);
  const buildSlice = (p: ChunkPiece) => {
    const zc = ZMIN + (p.ci + 0.5) * CHZ;
    const objs: THREE.Object3D[] = [];
    const entries: Chunk[] = [];
    if (p.canopy) {
      const c = p.canopy;
      const geo = mkCanopy(c, c.total, sph(c.sphere));
      objs.push(new THREE.Mesh(geo, canopyMat));
      const e = { geo, total: c.total, zc };
      entries.push(e);
      canopyChunks.push(e);
    }
    if (p.trunks) objs.push(...mkTrunks(p.trunks.data, p.trunks.n));
    if (p.grass) {
      const g = p.grass;
      const geo = mkGrass(g.off, g.par, g.n, sph(g.sphere));
      objs.push(new THREE.Mesh(geo, grassMat));
      const e = { geo, total: g.n, zc };
      entries.push(e);
      grassChunks.push(e);
    }
    group.add(...objs);
    live.set(p.ci, { objs, entries });
  };
  const dropSlice = (ci: number) => {
    const l = live.get(ci);
    if (!l) return;
    for (const o of l.objs) {
      group.remove(o);
      // trunk/shadow meshes share their geometry, so only free their instance buffers
      if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();
      else (o as THREE.Mesh).geometry.dispose();
    }
    for (const e of l.entries) {
      const i = canopyChunks.indexOf(e);
      if (i >= 0) canopyChunks.splice(i, 1);
      const j = grassChunks.indexOf(e);
      if (j >= 0) grassChunks.splice(j, 1);
    }
    live.delete(ci);
  };
  /** Per frame: drop slices out of range, build at most one needed slice (nearest the boat first). */
  const syncSlices = (boatZ: number) => {
    for (const ci of [...live.keys()]) {
      const zc = ZMIN + (ci + 0.5) * CHZ;
      if (zc > boatZ + BEHIND + CHZ || zc < boatZ - AHEAD - CHZ) dropSlice(ci);
    }
    let best: ChunkPiece | null = null;
    let bestD = Infinity;
    for (const p of stored.values()) {
      if (live.has(p.ci)) continue;
      const zc = ZMIN + (p.ci + 0.5) * CHZ;
      if (zc > boatZ + BEHIND || zc < boatZ - AHEAD) continue;
      const d = Math.abs(zc - boatZ);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (best) buildSlice(best);
    return !!best;
  };

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

  // stern lantern on a pole
  const lanternMat = new THREE.MeshBasicMaterial({ color: "#ffb35a" });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 1.3, 5), wood);
  pole.position.set(0.25, 0.9, 1.95);
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.3, 10), lanternMat);
  lantern.position.set(0.25, 1.45, 1.95);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.12, 10), ribMat);
  cap.position.set(0.25, 1.65, 1.95);
  boat.add(hullOut, hullIn, rail(1), rail(-1), floor, seat, roof, ...ribs, mast, yard, sail, pole, lantern, cap);
  boat.scale.setScalar(1.15);
  group.add(boat);

  const plank = new THREE.BoxGeometry(2.8, 0.1, 1.2);
  const post = new THREE.CylinderGeometry(0.07, 0.09, 1.1, 6);
  const lampPost = new THREE.CylinderGeometry(0.05, 0.07, 2.6, 6);
  const lamp = new THREE.SphereGeometry(0.22, 10, 8);
  // docks: 7 stops x 5 parts as 4 instanced draws instead of 35 meshes
  const dockParts = [
    { geo: plank, mat: deckMat, at: (rx: number, z: number) => [[rx + 4.3, 0.2, z]] },
    { geo: post, mat: wood, at: (rx: number, z: number) => [[rx + 3.0, 0.1, z - 0.5], [rx + 3.0, 0.1, z + 0.5]] },
    { geo: lampPost, mat: wood, at: (rx: number, z: number) => [[rx + 5.7, heightAt(rx + 5.7, z) + 1.2, z]] },
    { geo: lamp, mat: lanternMat, at: (rx: number, z: number) => [[rx + 5.7, heightAt(rx + 5.7, z) + 2.6, z]] },
  ];
  const dm = new THREE.Object3D();
  for (const part of dockParts) {
    const pts = Array.from({ length: STOPS }, (_, i) => part.at(riverX(stopZ(i)), stopZ(i))).flat();
    const im = new THREE.InstancedMesh(part.geo, part.mat, pts.length);
    pts.forEach((p, i) => {
      dm.position.set(p[0], p[1], p[2]);
      dm.updateMatrix();
      im.setMatrixAt(i, dm.matrix);
    });
    group.add(im);
  }

  const rxp = (z: number) => 0.3 * Math.cos(0.05 * z + 0.6) + 0.04; // d(riverX)/dz
  // pooled results: valid until the next call (the frame loop uses them immediately)
  const posOut = { x: 0, z: 0 };
  const boatOut = { x: 0, z: 0 };
  const boatPos = (seg: number) => {
    const z = stopZ(0) + (seg / (STOPS - 1)) * (stopZ(STOPS - 1) - stopZ(0));
    posOut.x = riverX(z) + 0.6;
    posOut.z = z;
    return posOut;
  };
  /** seg = position along the river in stop units. Returns the boat's world position. */
  const placeBoat = (seg: number, t: number) => {
    const { x, z } = boatPos(seg);
    boat.position.set(x, 0.22 + Math.sin(t * 1.3) * 0.03, z); // floor must stay above the opaque water plane or water shows inside the hull
    boat.rotation.set(Math.sin(t * 0.9) * 0.02, Math.atan2(rxp(z), 1), Math.sin(t * 1.1) * 0.035, "YXZ");
    sail.rotation.y = Math.sin(t * 0.8) * 0.05;
    boatOut.x = x;
    boatOut.z = z;
    return boatOut;
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
  /** Level of detail: 1 = full. Lowered by the adaptive-resolution loop on slow devices. */
  let detail = 1;
  const setDetail = (k: number) => {
    detail = k;
  };
  const sst = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  /** Per frame: far slices get fewer leaf cards and grass blades (they are a few pixels wide behind fog anyway). */
  const updateLOD = (camZ: number) => {
    for (const c of canopyChunks)
      c.geo.instanceCount = Math.max(1, Math.floor(c.total * (1 - 0.72 * sst(35, 95, Math.abs(c.zc - camZ))) * Math.max(detail, 0.85)));
    for (const c of grassChunks)
      c.geo.instanceCount = Math.max(1, Math.floor(c.total * (1 - 0.8 * sst(25, 70, Math.abs(c.zc - camZ))) * Math.max(detail, 0.5)));
  };
  return { group, dispose, setDetail, updateLOD, placeBoat, boatPos, addPiece, storeChunk, syncSlices };
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
  paused,
}: {
  quality: Quality;
  maxDpr: number;
  paused: boolean;
  onReady: () => void;
  /** The boat trip: target stop to sail to, and a callback on arrival. Absent = the still hero. */
  story?: RefObject<{ target: number; onArrive: () => void }>;
}) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const setDpr = useThree((s) => s.setDpr);
  const scene = useThree((s) => s.scene);
  const U = useMemo(() => makeUniforms(), []);
  const world = useMemo(() => buildWorld(quality, U), [quality, U]);

  // Streaming: shaders compile in the background (compileAsync), then the scene appears and trees/grass arrive
  // one river slice per frame from a worker, so the page never freezes on load.
  const [shown, setShown] = useState(false);
  const shownRef = useRef(false);
  const queue = useRef<Piece[]>([]);
  const fallback = useRef<Generator<Piece> | null>(null);
  useEffect(() => {
    let dead = false;
    const hi = quality === "high";
    gl.compileAsync(world.group, camera, scene)
      .catch(() => {}) // no async compile support: the first frame just compiles synchronously
      .then(() => {
        if (dead) return;
        shownRef.current = true;
        setShown(true);
      });

    let received = 0;
    let worker: Worker | null = null;
    const fallBackToMainThread = () => {
      if (received === 0) fallback.current = pieces(hi); // worker died before delivering anything: generate here, a piece per frame
    };
    try {
      worker = new Worker(new URL("../lib/world.worker.ts", import.meta.url));
      worker.onmessage = (e: MessageEvent<Piece | { k: "done" }>) => {
        if (e.data.k !== "done") {
          received++;
          queue.current.push(e.data as Piece);
        }
      };
      worker.onerror = () => {
        worker?.terminate();
        worker = null;
        fallBackToMainThread();
      };
      worker.postMessage({ hi });
    } catch {
      fallBackToMainThread();
    }
    return () => {
      dead = true;
      worker?.terminate();
      queue.current = [];
      fallback.current = null;
    };
  }, [world, quality, gl, camera, scene]);
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
  const invalidate = useThree((s) => s.invalidate);
  const perfEl = useRef<HTMLPreElement | null>(null);
  const st = useRef({ lastBuild: 0, pf: 0, pt: 0, seg: 0, from: 0, to: 0, tt: 0, dur: 1, sailing: false, ripple: 0, t: 0, gust: 0, lastGust: -99, wind: 0, active: false, frames: 0, acc: 0, n: 0, dpr: maxDpr, detail: 1 });

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
      if (st.current.t - st.current.lastGust < 4) return; // cooldown: one gust (and ripple) at a time, no spamming
      st.current.lastGust = st.current.t;
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

  // Frames are requested by us (frameloop="demand"): full rate while sailing or in the hero,
  // ~30fps while parked at a stop, when only leaf sway and water move.
  useEffect(() => {
    if (paused) return;
    let raf = 0, last = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last >= (story && !st.current.sailing ? 30 : 0)) {
        last = now;
        invalidate();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, story, invalidate]);

  // dev (or ?perf in the URL): live frame stats
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && !location.search.includes("perf")) return;
    const el = document.createElement("pre");
    el.style.cssText =
      "position:fixed;left:8px;bottom:8px;z-index:99;margin:0;padding:6px 8px;font:11px/1.35 monospace;background:#000c;color:#7f7;pointer-events:none";
    document.body.append(el);
    perfEl.current = el;
    return () => {
      el.remove();
      perfEl.current = null;
    };
  }, []);

  useFrame(({ size, viewport }, rawDt) => {
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

    world.updateLOD(camera.position.z);

    if (perfEl.current) {
      s.pf++;
      s.pt += rawDt;
      if (s.pt > 0.5) {
        const r = gl.info.render;
        perfEl.current.textContent = `${Math.round(s.pf / s.pt)} fps · ${r.calls} calls · ${Math.round(r.triangles / 1000)}k tris · dpr ${viewport.dpr.toFixed(2)} · detail ${s.detail.toFixed(2)}${story && !s.sailing ? " · parked" : ""}`;
        s.pf = 0;
        s.pt = 0;
      }
    }

    // pointer brushes the grass
    if (s.active) {
      tmp.ray.setFromCamera(tmp.ndc, camera);
      if (tmp.ray.ray.intersectPlane(GROUND, tmp.hit)) {
        tmp.p2.set(tmp.hit.x, tmp.hit.z);
        U.uPointer.value.lerp(tmp.p2, 1 - Math.exp(-dt * 10));
      }
    } else U.uPointer.value.set(999, 999);

    // stream in one piece (clouds, ridges, then a river slice) per frame
    if (shownRef.current) {
      const p = queue.current.shift() ?? (fallback.current?.next().value as Piece | undefined);
      if (p) {
        if (p.k === "chunk") world.storeChunk(p);
        else world.addPiece(p);
      }
      const built = world.syncSlices(world.boatPos(s.seg).z);
      if (p || built) s.lastBuild = s.frames;
    }

    // first frames rendered: reveal
    if (shownRef.current && ++s.frames === 3) onReady();

    // adaptive resolution: step down if the device can't hold ~48fps
    if (rawDt < 0.25 && s.frames > 60 && s.frames - s.lastBuild > 90 && !(story && !s.sailing)) {
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

  return shown ? <primitive object={world.group} /> : null;
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
      frameloop="demand"
      camera={{ position: CAM.toArray(), fov: 40, near: 0.5, far: 1200 }}
      gl={{ antialias: quality === "high", powerPreference: "high-performance", stencil: false, alpha: false }}
      onCreated={({ gl, scene }) => {
        gl.setClearColor(HEX.fog);
        scene.fog = new THREE.Fog(HEX.fog, FOG_NEAR, FOG_FAR);
      }}
    >
      <hemisphereLight args={["#d6e6fb", "#c79a62", 1.6]} />
      <directionalLight position={[70, 55, -10]} intensity={1.7} color="#fff0db" />
      <World quality={quality} maxDpr={maxDpr} onReady={onReady} story={story} paused={paused} />
    </Canvas>
  );
}
