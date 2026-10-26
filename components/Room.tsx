import React, { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CANDLE, sim } from '../sim/store';
import { makePlaster, makeWood } from './textures';

export function Room() {
  const wood = useMemo(makeWood, []);
  const plaster = useMemo(makePlaster, []);

  const plate = useMemo(() => {
    const t = CANDLE.baseY;
    const pts = [
      [0.001, 0.02],
      [5.4, 0.02],
      [6.2, 0.12],
      [6.75, t + 0.2],
      [6.95, t + 0.38],
      [6.8, t + 0.42],
      [6.35, t + 0.12],
      [5.6, t],
      [0.001, t],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(pts, 96);
  }, []);

  return (
    <group>
      {/* Table */}
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial map={wood} bumpMap={wood} bumpScale={0.8} roughness={0.48} color="#ffffff" />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, 100, -95]}>
        <planeGeometry args={[400, 200]} />
        <meshStandardMaterial map={plaster} bumpMap={plaster} bumpScale={2} roughness={0.95} />
      </mesh>

      {/* Stoneware plate */}
      <mesh geometry={plate}>
        <meshPhysicalMaterial color="#1d1c1f" roughness={0.32} clearcoat={0.7} clearcoatRoughness={0.25} />
      </mesh>
    </group>
  );
}

const shadowVertex = /* glsl */ `
  varying vec2 vXZ;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vXZ = w.xz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const shadowFragment = /* glsl */ `
  uniform float uRim;
  uniform float uTip;
  uniform float uBase;
  uniform float uR;
  uniform float uStrength;
  varying vec2 vXZ;
  void main() {
    float r = length(vXZ);
    // Lowest point of the flame that can be seen over the rim from here.
    float hmin = uRim * r / max(r - uR, 0.001);
    float visible = clamp((uTip - hmin) / max(uTip - uBase, 0.01), 0.0, 1.0);
    visible = smoothstep(0.0, 1.0, visible);
    gl_FragColor = vec4(0.0, 0.0, 0.0, uStrength * (1.0 - visible));
  }
`;

/**
 * The candle's rim hides the flame from the nearby table. Instead of a shadow map,
 * work out the shadow edge from the flame and rim heights (similar triangles).
 */
export function RimShadow() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: shadowVertex,
        fragmentShader: shadowFragment,
        uniforms: {
          uRim: { value: 12 },
          uTip: { value: 16 },
          uBase: { value: 13 },
          uR: { value: CANDLE.radius },
          uStrength: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    [],
  );

  useFrame(() => {
    const top = CANDLE.baseY + sim.height;
    material.uniforms.uRim.value = top + sim.rimH;
    material.uniforms.uBase.value = top + 0.25 + sim.flameLen * 0.12;
    material.uniforms.uTip.value = top + 0.25 + Math.max(sim.flameLen, 0.01);
    material.uniforms.uStrength.value = 0.82 * Math.min(1, sim.flameLen / CANDLE.flameLength) * sim.litAmount;
  });

  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position-y={0.02} material={material} renderOrder={1}>
        <planeGeometry args={[300, 300]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={CANDLE.baseY + 0.005} material={material} renderOrder={1}>
        <circleGeometry args={[5.6, 64]} />
      </mesh>
    </>
  );
}
