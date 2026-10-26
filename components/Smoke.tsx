import React, { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CANDLE, sim } from '../sim/store';

const COUNT = 900;
const LIFE = 5.5;

const vertex = /* glsl */ `
  attribute float aAlpha;
  attribute float aSize;
  uniform float uScale;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
    vAlpha = aAlpha;
  }
`;

const fragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vec3(0.62, 0.64, 0.7), a * a * vAlpha);
  }
`;

type Puff = { born: number; x: number; y: number; z: number; strength: number; seed: number; alive: boolean };

export function Smoke() {
  const { size, camera } = useThree();
  const pointsRef = useRef<THREE.Points>(null!);
  const puffs = useRef<Puff[]>(
    Array.from({ length: COUNT }, () => ({ born: 0, x: 0, y: 0, z: 0, strength: 0, seed: 0, alive: false })),
  );
  const cursor = useRef(0);
  const carry = useRef(0);
  const clock = useRef(0);

  const { geometry, material } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(COUNT), 1));
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(COUNT), 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: { uScale: { value: 1 } },
      transparent: true,
      depthWrite: false,
    });
    return { geometry: g, material: m };
  }, []);

  useFrame((state, rawDt) => {
    // Smoke keeps its own clock so a stalled frame can't tear the stream apart.
    const dt = Math.min(rawDt, 0.25);
    clock.current += dt;
    const t = clock.current;
    const persp = camera as THREE.PerspectiveCamera;
    material.uniforms.uScale.value =
      (size.height * state.gl.getPixelRatio() * 0.5) / Math.tan(THREE.MathUtils.degToRad(persp.fov / 2));

    // Emit a steady stream from the wick tip while smoke is flowing.
    const rate = sim.smoke * 140 + (sim.lit && sim.turb > 0.75 ? 16 : 0);
    carry.current += rate * dt;
    const n = Math.floor(carry.current);
    for (let j = 0; j < n; j++) {
      carry.current -= 1;
      const p = puffs.current[cursor.current];
      cursor.current = (cursor.current + 1) % COUNT;
      p.alive = true;
      // Spread births across the frame so the stream stays continuous at low frame rates.
      p.born = t - (dt * j) / n;
      p.x = 0.22;
      p.y = CANDLE.baseY + sim.height + 1.1;
      p.z = 0.04;
      p.strength = Math.min(1, sim.smoke + 0.15);
      p.seed = Math.random();
    }

    const pos = geometry.attributes.position.array as Float32Array;
    const alpha = geometry.attributes.aAlpha.array as Float32Array;
    const sizes = geometry.attributes.aSize.array as Float32Array;
    for (let i = 0; i < COUNT; i++) {
      const p = puffs.current[i];
      const age = t - p.born;
      if (!p.alive || age > LIFE) {
        p.alive = false;
        alpha[i] = 0;
        continue;
      }
      // Rises and speeds up; the shared sine field makes the stream curl as one ribbon.
      const rise = 2.4 * age + 0.85 * age * age;
      const amp = 0.04 + 0.1 * rise;
      const chaos = Math.min(1, rise / 12);
      const sx =
        Math.sin(rise * 0.55 - t * 1.4) * amp +
        Math.sin(rise * 1.45 + t * 0.8 + 2) * amp * 0.55 * chaos +
        (p.seed - 0.5) * 0.25 * chaos;
      const sz = Math.cos(rise * 0.47 - t * 1.1 + 1) * amp * 0.8;
      pos[i * 3] = p.x + sx + sim.windX * age * age * 1.6;
      pos[i * 3 + 1] = p.y + rise;
      pos[i * 3 + 2] = p.z + sz + sim.windZ * age * age * 1.6;
      const life = age / LIFE;
      alpha[i] = p.strength * Math.pow(1 - life, 1.6) * Math.min(1, age * 4) * 0.2;
      sizes[i] = 0.2 + age * 0.85;
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.aAlpha.needsUpdate = true;
    geometry.attributes.aSize.needsUpdate = true;
  });

  return <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} renderOrder={5} />;
}
