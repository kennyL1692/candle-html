import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CANDLE, sim } from '../sim/store';
import { smoothstep } from '../sim/noise';
import { makeWaxGrain } from './textures';

const R = CANDLE.radius;
const MAX_DRIPS = 32;

// Shared by every wax surface so the "light glowing through wax" effect stays in sync.
export const waxUniforms = {
  uFlamePos: { value: new THREE.Vector3(0, 13, 0) },
  uTopY: { value: 13 },
  uGlow: { value: 0 },
  uThin: { value: 0 },
  uRadius: { value: R },
  uGlowColor: { value: new THREE.Color(1.0, 0.36, 0.08) },
};

function makeWaxMaterial(grain: THREE.Texture, clip?: THREE.Plane) {
  const mat = new THREE.MeshStandardMaterial({
    color: '#f1e7d3',
    roughness: 0.62,
    bumpMap: grain,
    bumpScale: 0.015,
    clippingPlanes: clip ? [clip] : null,
  });
  // Fake subsurface scattering: wax near the flame glows from inside, and the
  // thin rim of a well-burned pillar lights up like a lampshade.
  mat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, waxUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWaxPos;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvWaxPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWaxPos;
        uniform vec3 uFlamePos;
        uniform float uTopY;
        uniform float uGlow;
        uniform float uThin;
        uniform float uRadius;
        uniform vec3 uGlowColor;`,
      )
      // The rim hides the flame from the outside of the candle, so wax there
      // (the walls and the drips) gets no direct light from above.
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
        float rimBlock = step(uRadius - 0.06, length(vWaxPos.xz)) * step(vWaxPos.y, uTopY - 0.04);
        reflectedLight.directDiffuse *= 1.0 - 0.88 * rimBlock;
        reflectedLight.directSpecular *= 1.0 - 0.88 * rimBlock;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float wd = distance(vWaxPos, uFlamePos);
        float below = max(uTopY - vWaxPos.y, 0.0);
        float sss = exp(-wd / 1.3) * 1.4
          + exp(-below / 0.9) * (0.1 + uThin * 0.7)
          + exp(-below / 3.0) * 0.05;
        totalEmissiveRadiance += uGlowColor * sss * uGlow;`,
      );
  };
  mat.customProgramCacheKey = () => (clip ? 'wax-clip' : 'wax');
  return mat;
}

/** Side profile of the candle, revolved around the Y axis. */
function buildBody(height: number, crater: number, rimH: number) {
  const top = height + rimH;
  const inner = Math.min(crater + 0.1, R - 0.26);
  const pts = [
    [0.001, 0],
    [R - 0.3, 0],
    [R - 0.07, 0.05],
    [R, 0.25],
    [R, top * 0.5],
    [R, top - 0.32],
    [R - 0.02, top - 0.12],
    [R - 0.09, top - 0.02],
    [R - 0.18, top],
    [inner, top - 0.02],
    [crater + 0.03, height + 0.05],
    [crater, height],
    [crater * 0.6, height - 0.3],
    [0.001, height - 0.4],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 96);
}

type Drip = {
  theta: number;
  startY: number;
  length: number;
  r0: number;
  seed: number;
  grow: number;
  growTime: number;
  reachedBase: boolean;
  mesh: THREE.Mesh;
};

function buildDrip(d: Drip, len: number) {
  const ct = Math.cos(d.theta);
  const st = Math.sin(d.theta);
  const at = (radial: number, y: number, wob = 0) => {
    const a = d.theta + wob;
    return new THREE.Vector3(Math.cos(a) * radial, y, Math.sin(a) * radial);
  };
  const pts = [
    new THREE.Vector3(ct * (R - 0.45), d.startY + 0.02, st * (R - 0.45)),
    new THREE.Vector3(ct * (R - 0.08), d.startY + 0.07, st * (R - 0.08)),
    at(R + d.r0 * 0.4, d.startY - 0.18),
  ];
  const n = Math.max(2, Math.ceil(len / 0.5));
  for (let i = 1; i <= n; i++) {
    const y = d.startY - 0.18 - (len - 0.18) * (i / n);
    pts.push(at(R + d.r0 * 0.45, y, Math.sin(d.seed + y * 0.8) * 0.035));
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const S = Math.min(90, Math.max(14, Math.round(len * 9) + 10));
  const M = 10;
  const frames = curve.computeFrenetFrames(S, false);
  const tipFrac = Math.min(0.45, (d.r0 * 2.6) / (len + 0.6));
  const pos: number[] = [];
  const idx: number[] = [];
  const p = new THREE.Vector3();
  const dir = new THREE.Vector3();

  for (let i = 0; i <= S; i++) {
    const u = i / S;
    curve.getPointAt(u, p);
    let r = d.r0 * (1 - 0.28 * u) * (1 + 0.16 * Math.sin(u * len * 2.3 + d.seed));
    if (u > 1 - tipFrac) {
      const v = (u - (1 - tipFrac)) / tipFrac;
      r = THREE.MathUtils.lerp(r, d.r0 * 1.3, smoothstep(0, 0.45, v)) * Math.sqrt(Math.max(0, 1 - v * v));
    }
    for (let j = 0; j <= M; j++) {
      const a = (j / M) * Math.PI * 2;
      dir
        .copy(frames.normals[i])
        .multiplyScalar(Math.cos(a))
        .addScaledVector(frames.binormals[i], Math.sin(a));
      pos.push(p.x + dir.x * r, p.y + dir.y * r, p.z + dir.z * r);
    }
  }
  for (let i = 0; i < S; i++) {
    for (let j = 0; j < M; j++) {
      const a = i * (M + 1) + j;
      const b = a + M + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

const poolVertex = /* glsl */ `
  varying vec3 vW;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const poolFragment = /* glsl */ `
  uniform vec3 uFlameA;
  uniform vec3 uFlameB;
  uniform float uLit;
  uniform float uLiquid;
  uniform float uRadius;
  uniform float uEmber;
  varying vec3 vW;

  void main() {
    float r = length(vW.xz);
    float rr = r / uRadius;
    vec3 solid = vec3(0.92, 0.86, 0.74);
    vec3 liquid = vec3(0.9, 0.58, 0.26);
    vec3 base = mix(solid, liquid, uLiquid);

    // Direct light from the flame hanging just above the pool.
    float light = uLit * (0.55 + 1.1 * exp(-r * 0.9));
    // Light scattered inside the molten wax: deep amber, brightest near the wick.
    float sss = uLit * uLiquid * (0.12 + 0.5 * exp(-r * 0.9));
    // Molten wax is a dark mirror: far less diffuse than solid wax.
    vec3 col = base * light * mix(0.75, 0.2, uLiquid) + vec3(1.0, 0.36, 0.07) * sss;

    // Meniscus at the pool edge and the soot ring round the wick.
    col *= mix(1.0, 0.65, smoothstep(0.78, 1.0, rr) * uLiquid);
    col *= mix(0.3, 1.0, smoothstep(0.07, 0.26, r));

    // Mirror image of the flame on the liquid surface.
    vec3 V = normalize(vW - cameraPosition);
    vec3 Rf = reflect(V, vec3(0.0, 1.0, 0.0));
    float refl = 0.0;
    for (int i = 0; i < 10; i++) {
      float f = (float(i) + 0.5) / 10.0;
      vec3 q = mix(uFlameA, uFlameB, f);
      vec3 d = q - vW;
      float tt = dot(d, Rf);
      if (tt <= 0.0) continue;
      float dist = length(d - Rf * tt);
      float w = smoothstep(0.0, 0.3, f) * (1.0 - 0.5 * f);
      float width = 0.32 * (1.0 - f * 0.8) + 0.04;
      refl = max(refl, exp(-dist * dist / (width * width)) * w);
    }
    float fres = 0.04 + 0.96 * pow(1.0 - max(dot(-V, vec3(0.0, 1.0, 0.0)), 0.0), 5.0);
    col += vec3(1.0, 0.72, 0.36) * refl * uLit * uLiquid * (2.2 + 8.0 * fres);

    col += base * 0.015;
    col += vec3(1.0, 0.32, 0.06) * uEmber * 0.6 * exp(-r * 3.0);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function CandleBody() {
  const grain = useMemo(makeWaxGrain, []);
  const clipPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), 20), []);
  const waxMat = useMemo(() => makeWaxMaterial(grain), [grain]);
  const dripMat = useMemo(() => makeWaxMaterial(grain, clipPlane), [grain, clipPlane]);
  const poolMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: poolVertex,
        fragmentShader: poolFragment,
        uniforms: {
          uFlameA: { value: new THREE.Vector3() },
          uFlameB: { value: new THREE.Vector3() },
          uLit: { value: 0 },
          uLiquid: { value: 0 },
          uRadius: { value: 1 },
          uEmber: { value: 0 },
        },
      }),
    [],
  );
  const wickGeo = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.45, 0),
      new THREE.Vector3(0, 0.3, 0),
      new THREE.Vector3(0.02, 0.7, 0),
      new THREE.Vector3(0.1, 0.95, 0.02),
      new THREE.Vector3(0.22, 1.08, 0.04),
    ]);
    return new THREE.TubeGeometry(curve, 24, 0.06, 8, false);
  }, []);
  const wickMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#141010', roughness: 0.9 }), []);
  const tipMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#000000' }), []);
  const puddleMat = waxMat;
  const initialBody = useMemo(() => buildBody(CANDLE.height, 0.8, 0.12), []);

  const bodyRef = useRef<THREE.Mesh>(null!);
  const poolRef = useRef<THREE.Mesh>(null!);
  const wickRef = useRef<THREE.Group>(null!);
  const dripGroup = useRef<THREE.Group>(null!);
  const puddleRef = useRef<THREE.Mesh>(null!);
  const drips = useRef<Drip[]>([]);
  const built = useRef({ h: -1, c: -1, r: -1 });
  const generation = useRef(sim.generation);
  const puddle = useRef(0);

  useEffect(
    () => () => {
      drips.current.forEach(d => d.mesh.geometry.dispose());
      bodyRef.current?.geometry.dispose();
    },
    [],
  );

  const removeDrip = (d: Drip) => {
    dripGroup.current.remove(d.mesh);
    d.mesh.geometry.dispose();
  };

  const spawnDrip = () => {
    const windy = sim.windMag > 0.12;
    // Wind tilts the flame, which melts through the downwind rim first.
    const theta = windy
      ? Math.atan2(sim.windZ, sim.windX) + (Math.random() - 0.5) * 1.3
      : Math.random() * Math.PI * 2;
    const startY = sim.height + sim.rimH;
    const length = Math.min(1.0 + Math.pow(Math.random(), 1.6) * 7.5, startY - 0.05);
    const d: Drip = {
      theta,
      startY,
      length,
      r0: 0.17 + Math.random() * 0.15,
      seed: Math.random() * 100,
      grow: 0,
      growTime: 1.4 + Math.random() * 2,
      reachedBase: false,
      mesh: new THREE.Mesh(new THREE.BufferGeometry(), dripMat),
    };
    dripGroup.current.add(d.mesh);
    drips.current.push(d);
    if (drips.current.length > MAX_DRIPS) removeDrip(drips.current.shift()!);
  };

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const { height, craterR, rimH } = sim;
    const baseY = CANDLE.baseY;

    if (generation.current !== sim.generation) {
      generation.current = sim.generation;
      drips.current.forEach(removeDrip);
      drips.current = [];
      puddle.current = 0;
    }

    // Rebuild the candle shape only when it has visibly changed.
    const b = built.current;
    if (Math.abs(b.h - height) > 0.004 || Math.abs(b.c - craterR) > 0.004 || Math.abs(b.r - rimH) > 0.004) {
      bodyRef.current.geometry.dispose();
      bodyRef.current.geometry = buildBody(height, craterR, rimH);
      b.h = height;
      b.c = craterR;
      b.r = rimH;
    }

    // Melt pool
    poolRef.current.position.y = height + 0.004;
    poolRef.current.scale.setScalar(craterR + 0.02);
    const flameBaseY = baseY + height + 0.25;
    const u = poolMat.uniforms;
    u.uFlameA.value.set(sim.leanX * 0.1, flameBaseY, sim.leanZ * 0.1);
    u.uFlameB.value.set(sim.leanX * 1.1, flameBaseY + Math.max(sim.flameLen, 0.01), sim.leanZ * 1.1);
    u.uLit.value = sim.litAmount * sim.flicker;
    u.uLiquid.value = sim.liquid;
    u.uRadius.value = craterR;
    u.uEmber.value = sim.ember;

    // Wick and its glowing tip
    wickRef.current.position.y = height;
    const tipGlow = sim.lit ? 0.45 * sim.litAmount : Math.pow(sim.ember, 1.6) * 1.4;
    tipMat.color.setRGB(3.5 * tipGlow + 0.02, 0.9 * tipGlow + 0.015, 0.18 * tipGlow + 0.012);

    // Wax glow
    waxUniforms.uFlamePos.value.set(sim.leanX * 0.3, baseY + height + 0.55, sim.leanZ * 0.3);
    waxUniforms.uTopY.value = baseY + height + rimH;
    waxUniforms.uGlow.value = sim.litAmount * sim.flicker * (0.55 + 0.45 * sim.liquid) + sim.ember * 0.06;
    const wide = craterR / CANDLE.maxCrater;
    waxUniforms.uThin.value = wide * wide * wide;
    clipPlane.constant = baseY + height + rimH + 0.02;

    // Drips
    if (sim.lastDh > 0) {
      const rate = Math.pow(wide, 3) * (0.12 + 2.6 * sim.windAvg);
      if (Math.random() < rate * sim.lastDh) spawnDrip();
    }
    for (let i = drips.current.length - 1; i >= 0; i--) {
      const d = drips.current[i];
      if (d.startY - d.length > height + rimH + 0.05) {
        removeDrip(d);
        drips.current.splice(i, 1);
        continue;
      }
      if (d.grow < 1) {
        d.grow = Math.min(1, d.grow + dt / d.growTime);
        const ease = 1 - Math.pow(1 - d.grow, 3);
        d.mesh.geometry.dispose();
        d.mesh.geometry = buildDrip(d, 0.3 + (d.length - 0.3) * ease);
        if (d.grow === 1 && d.startY - d.length < 0.15) puddle.current += 1;
      }
    }

    const pr = R + 0.15 + Math.min(2.2, puddle.current * 0.22);
    puddleRef.current.scale.set(pr, 0.18 + Math.min(0.2, puddle.current * 0.02), pr);
    puddleRef.current.visible = puddle.current > 0;
  });

  return (
    <group position={[0, CANDLE.baseY, 0]}>
      <mesh ref={bodyRef} material={waxMat} geometry={initialBody} />
      <mesh ref={poolRef} rotation-x={-Math.PI / 2} material={poolMat}>
        <circleGeometry args={[1, 72]} />
      </mesh>
      <group ref={wickRef}>
        <mesh geometry={wickGeo} material={wickMat} />
        <mesh position={[0.22, 1.08, 0.04]} material={tipMat}>
          <sphereGeometry args={[0.075, 12, 12]} />
        </mesh>
      </group>
      <group ref={dripGroup} />
      <mesh ref={puddleRef} material={puddleMat} visible={false}>
        <sphereGeometry args={[1, 48, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
    </group>
  );
}
