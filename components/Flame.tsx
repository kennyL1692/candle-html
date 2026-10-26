import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CANDLE, sim } from '../sim/store';

// Flame quad size in cm. The flame base sits BASE cm above the quad's bottom edge.
const PLANE_W = 5;
const PLANE_H = 7.5;
const BASE = 0.35;

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const flameFragment = /* glsl */ `
  uniform float uTime;
  uniform float uLen;
  uniform float uLean;
  uniform float uTurb;
  uniform float uLit;
  uniform float uWidth;
  uniform vec2 uPlane;
  uniform float uBase;
  varying vec2 vUv;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }

  void main() {
    float xcm = (vUv.x - 0.5) * uPlane.x;
    float ycm = vUv.y * uPlane.y - uBase;
    float len = max(uLen, 0.001);
    float h = ycm / len;
    float hc = clamp(h, 0.0, 1.2);

    // Bend: the tip moves most when the flame leans.
    float x = xcm - uLean * hc * hc * len * 0.55;

    // Hot gas rises, so turbulence scrolls upward and grows towards the tip.
    float n = fbm(vec2(xcm * 1.3, ycm * 0.9 - uTime * 3.6));
    float n2 = noise(vec2(uTime * 2.3, ycm * 0.5));
    x += (n - 0.5) * hc * hc * (0.16 + uTurb * 1.0);
    x += (n2 - 0.5) * hc * 0.05;

    // Teardrop profile: round bottom, widest at about a quarter, pointed tip.
    float t = clamp((h + 0.07) / 1.07, 0.0, 1.0);
    float prof = pow(t, 0.5) * pow(1.0 - t, 1.1) / 0.37;
    float w = uWidth * prof * (1.0 - 0.25 * uTurb);
    float e = abs(x) / max(w, 1e-4);

    float inside = (1.0 - smoothstep(0.8, 1.0, e)) * step(-0.07, h);
    float tipFade = 1.0 - smoothstep(0.7 + (n - 0.5) * 0.25, 1.0, h);

    // Zones of a real candle flame.
    float lum = smoothstep(0.08, 0.3, h - e * 0.06);                // glowing soot zone
    float core = (1.0 - smoothstep(0.0, 0.55, e)) * smoothstep(0.1, 0.32, h) * (1.0 - smoothstep(0.42, 0.85, h));
    float darkCone = (1.0 - smoothstep(0.0, 0.45, e)) * (1.0 - smoothstep(0.03, 0.32, h));
    float blue = (1.0 - smoothstep(0.0, 0.28, h)) * (0.35 + 0.65 * smoothstep(0.1, 0.85, e))
               + (1.0 - smoothstep(-0.07, 0.06, h)) * 0.5;

    vec3 cOrange = vec3(1.0, 0.3, 0.04);
    vec3 cYellow = vec3(1.0, 0.56, 0.12);
    vec3 cWhite = vec3(1.0, 0.88, 0.66);
    vec3 cBlue = vec3(0.1, 0.24, 1.0);

    vec3 col = mix(cOrange, cYellow, 1.0 - smoothstep(0.35, 0.85, e));
    col = mix(col, cOrange * 0.9, smoothstep(0.45, 0.95, h));
    col = mix(col, cWhite, core);
    float bright = inside * lum * tipFade * (1.0 - 0.65 * darkCone) * (1.05 + 1.35 * core);

    vec3 outc = col * bright + cBlue * blue * inside * 1.1;

    // Faint, almost invisible outer mantle.
    float mantle = (1.0 - smoothstep(0.85, 1.4, e)) * (1.0 - inside) * smoothstep(-0.05, 0.1, h) * (1.0 - smoothstep(0.6, 1.05, h));
    outc += vec3(0.5, 0.17, 0.04) * mantle * 0.22;

    gl_FragColor = vec4(outc * uLit, 1.0);
  }
`;

const haloFragment = /* glsl */ `
  uniform float uLit;
  uniform float uSize;
  varying vec2 vUv;
  void main() {
    vec2 d = (vUv - 0.5) * uSize;
    d.y *= 0.72;
    float r = length(d);
    float g = 0.05 * exp(-r * 0.3) + 0.1 * exp(-r * r * 0.35);
    g *= 1.0 - smoothstep(0.3, 0.5, length(vUv - 0.5));
    gl_FragColor = vec4(vec3(1.0, 0.52, 0.2) * g * uLit, 1.0);
  }
`;

export function Flame() {
  const flameRef = useRef<THREE.Mesh>(null!);
  const haloRef = useRef<THREE.Mesh>(null!);

  const flameMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: flameFragment,
        uniforms: {
          uTime: { value: 0 },
          uLen: { value: CANDLE.flameLength },
          uLean: { value: 0 },
          uTurb: { value: 0 },
          uLit: { value: 1 },
          uWidth: { value: 0.56 },
          uPlane: { value: new THREE.Vector2(PLANE_W, PLANE_H) },
          uBase: { value: BASE },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [],
  );

  const haloMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: haloFragment,
        uniforms: { uLit: { value: 1 }, uSize: { value: 18 } },
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  useFrame(({ camera, clock }) => {
    const baseY = CANDLE.baseY + sim.height;
    const f = flameRef.current;
    // Billboard around the vertical axis only, so the flame always stands upright.
    const angle = Math.atan2(camera.position.x - f.position.x, camera.position.z - f.position.z);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const sideLean = sim.leanX * cos - sim.leanZ * sin;
    const towardLean = sim.leanX * sin + sim.leanZ * cos;

    f.rotation.y = angle;
    f.position.set(0, baseY - BASE + PLANE_H / 2 - 0.1, 0);

    const u = flameMat.uniforms;
    u.uTime.value = clock.elapsedTime;
    u.uLen.value = Math.max(0.001, sim.flameLen * (1 - 0.18 * Math.min(1, Math.abs(towardLean))));
    u.uLean.value = sideLean;
    u.uTurb.value = sim.turb;
    u.uLit.value = sim.litAmount > 0.001 ? 1 : 0;
    f.visible = sim.litAmount > 0.001;

    const h = haloRef.current;
    h.position.set(sideLean * cos * 0.6, baseY + 0.25 + sim.flameLen * 0.42, -sideLean * sin * 0.6);
    h.rotation.y = angle;
    haloMat.uniforms.uLit.value = sim.litAmount * sim.flicker * (sim.flameLen / CANDLE.flameLength);
    h.visible = sim.litAmount > 0.001;
  });

  return (
    <>
      <mesh ref={flameRef} material={flameMat} renderOrder={10}>
        <planeGeometry args={[PLANE_W, PLANE_H]} />
      </mesh>
      <mesh ref={haloRef} material={haloMat} renderOrder={11}>
        <planeGeometry args={[18, 18]} />
      </mesh>
    </>
  );
}
