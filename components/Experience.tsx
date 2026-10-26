import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerformanceMonitor } from '@react-three/drei';
import { Bloom, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { CANDLE, blowOut, relight, sim } from '../sim/store';
import { smoothstep } from '../sim/noise';
import { Simulation } from './Simulation';
import { RimShadow, Room } from './Room';
import { CandleBody } from './CandleBody';
import { Flame } from './Flame';
import { Smoke } from './Smoke';

const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

function Lights() {
  const main = useRef<THREE.PointLight>(null!);
  const fill = useRef<THREE.PointLight>(null!);
  const room = useRef<THREE.PointLight>(null!);

  useFrame(() => {
    const top = CANDLE.baseY + sim.height;
    const strength = sim.flameLen / CANDLE.flameLength;
    main.current.position.set(sim.leanX * 0.8, top + 0.25 + sim.flameLen * 0.42, sim.leanZ * 0.8);
    // Close to the flame the light is kept gentle so the wax keeps its colour…
    main.current.intensity = 16 * strength;
    // …while a second light, sitting higher up, carries the glow out to the table and wall.
    room.current.position.set(sim.leanX * 2, top + 22, sim.leanZ * 2);
    room.current.intensity = 130 * strength;
    // Light that leaks out through the glowing wax body.
    fill.current.position.set(0, top * 0.8, 0);
    fill.current.intensity = 60 * strength * (0.5 + 0.5 * sim.liquid) + 1.5 * sim.ember;
  });

  return (
    <>
      {/* The rim's shadow is drawn analytically by <RimShadow>, which is softer and cheaper than a shadow map. */}
      <pointLight ref={main} color="#ff9a48" decay={1.3} distance={0} />
      <pointLight ref={room} color="#ff9a48" decay={1.3} distance={0} />
      <pointLight ref={fill} color="#ff7a30" decay={1.3} distance={0} />
      {/* Cold moonlight from a window, so the room isn't pitch black when the candle is out. */}
      <directionalLight position={[-80, 70, 40]} color="#7d8fc9" intensity={0.4} />
      <hemisphereLight args={['#2a3350', '#0b0805', 0.35]} />
    </>
  );
}

function CameraRig({ controls }: { controls: React.RefObject<OrbitControlsImpl | null> }) {
  const { camera, size } = useThree();

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / size.height;
    const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    // Fit about 26 cm of height and 21 cm of width, whichever is tighter.
    const dist = Math.max(11 / tanV, 9 / (tanV * aspect));
    const portrait = aspect < 0.8;
    const target = new THREE.Vector3(0, portrait ? 7 : 9, 0);
    const polar = THREE.MathUtils.degToRad(67);
    cam.position.set(0, target.y + dist * Math.cos(polar), dist * Math.sin(polar));
    const c = controls.current;
    if (c) {
      c.target.copy(target);
      c.minDistance = dist * 0.45;
      c.maxDistance = dist * 1.3;
      c.update();
    }
  }, [camera, size.width, size.height, controls]);

  const fwd = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    camera.getWorldDirection(fwd);
    const len = Math.hypot(fwd.x, fwd.z) || 1;
    sim.camFwdX = fwd.x / len;
    sim.camFwdZ = fwd.z / len;
  });

  return null;
}

/** Tap the flame to blow it out, tap the wick to relight, wave near the flame to make a draft. */
function Interaction({ controls }: { controls: React.RefObject<OrbitControlsImpl | null> }) {
  const { camera, gl } = useThree();
  const s = useRef({
    down: false,
    downX: 0,
    downY: 0,
    startD: 99,
    has: false,
    lastT: 0,
    d: 99,
    prev: new THREE.Vector3(),
    vel: new THREE.Vector3(),
  });
  const tools = useMemo(
    () => ({
      ray: new THREE.Raycaster(),
      plane: new THREE.Plane(),
      ndc: new THREE.Vector2(),
      hit: new THREE.Vector3(),
      fwd: new THREE.Vector3(),
      flame: new THREE.Vector3(),
      tmp: new THREE.Vector3(),
    }),
    [],
  );

  useEffect(() => {
    const el = gl.domElement;
    const worldPoint = (clientX: number, clientY: number) => {
      const rect = el.getBoundingClientRect();
      tools.ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      tools.ray.setFromCamera(tools.ndc, camera);
      camera.getWorldDirection(tools.fwd);
      tools.fwd.y = 0;
      tools.fwd.normalize();
      tools.flame.set(0, CANDLE.baseY + sim.height + 1.6, 0);
      tools.plane.setFromNormalAndCoplanarPoint(tools.fwd, tools.flame);
      if (!tools.ray.ray.intersectPlane(tools.plane, tools.hit)) return null;
      return tools.hit.distanceTo(tools.flame);
    };

    const onDown = (e: PointerEvent) => {
      const st = s.current;
      const d = worldPoint(e.clientX, e.clientY);
      st.down = true;
      st.downX = e.clientX;
      st.downY = e.clientY;
      st.startD = d ?? 99;
      st.prev.copy(tools.hit);
      st.lastT = performance.now();
      st.has = d !== null;
      // Starting a drag near the flame fans it instead of turning the camera.
      if (st.startD < 4.5 && controls.current) controls.current.enabled = false;
    };

    const onMove = (e: PointerEvent) => {
      const st = s.current;
      const d = worldPoint(e.clientX, e.clientY);
      const now = performance.now();
      if (d === null) return;
      const dts = (now - st.lastT) / 1000;
      if (st.has && dts > 0.001 && dts < 0.1) {
        tools.tmp.subVectors(tools.hit, st.prev).divideScalar(dts);
        st.vel.lerp(tools.tmp, 0.5);
      }
      st.prev.copy(tools.hit);
      st.has = true;
      st.lastT = now;
      st.d = d;
    };

    const onUp = (e: PointerEvent) => {
      const st = s.current;
      const moved = Math.hypot(e.clientX - st.downX, e.clientY - st.downY);
      // A press that didn't move is a tap, however long it took (slow phones can stall a frame).
      if (st.down && moved < 12) {
        if (sim.lit && st.startD < 2.8) blowOut();
        else if (!sim.lit && st.startD < 6) relight();
      }
      st.down = false;
      if (controls.current) controls.current.enabled = true;
      if (e.pointerType !== 'mouse') st.has = false;
    };

    const onLeave = () => {
      s.current.has = false;
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [camera, gl, controls, tools]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const st = s.current;
    st.vel.multiplyScalar(Math.exp(-dt * 8));
    if (!st.has || performance.now() - st.lastT > 150) return;
    const prox = 1 - smoothstep(1.2, 7, st.d);
    if (prox <= 0) return;
    // Sideways hand speed (cm/s) becomes a draft across the flame.
    const rx = -sim.camFwdZ;
    const rz = sim.camFwdX;
    const side = st.vel.x * rx + st.vel.z * rz;
    const k = 0.0075 * prox;
    const blend = Math.min(1, dt * 12);
    sim.userWindX += (rx * side * k - sim.userWindX) * blend;
    sim.userWindZ += (rz * side * k - sim.userWindZ) * blend;
  });

  return null;
}

function Effects() {
  return (
    <EffectComposer multisampling={isTouch ? 0 : 4} frameBufferType={THREE.HalfFloatType}>
      <Bloom mipmapBlur luminanceThreshold={1.1} luminanceSmoothing={0.35} intensity={0.85} radius={0.75} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.22} darkness={0.8} />
      <Noise premultiply blendFunction={BlendFunction.ADD} opacity={0.2} />
    </EffectComposer>
  );
}

export function Experience() {
  const [dpr, setDpr] = useState(isTouch ? 1.5 : 2);
  const controls = useRef<OrbitControlsImpl | null>(null);

  return (
    <Canvas
      dpr={dpr}
      camera={{ fov: 32, near: 0.5, far: 900, position: [0, 15, 60] }}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
      onCreated={({ gl }) => {
        gl.localClippingEnabled = true;
      }}
    >
      <color attach="background" args={['#020203']} />
      <fog attach="fog" args={['#020203', 90, 260]} />
      <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(isTouch ? 1.5 : 2)} />

      <Simulation />
      <CameraRig controls={controls} />
      <Interaction controls={controls} />
      <Lights />
      <Room />
      <RimShadow />
      <CandleBody />
      <Flame />
      <Smoke />

      <OrbitControls
        ref={controls}
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.55}
        zoomSpeed={0.6}
        minPolarAngle={THREE.MathUtils.degToRad(50)}
        maxPolarAngle={THREE.MathUtils.degToRad(88)}
        minAzimuthAngle={-1}
        maxAzimuthAngle={1}
      />
      <Effects />
    </Canvas>
  );
}
