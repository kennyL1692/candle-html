import { useSyncExternalStore } from 'react';

// All lengths are in centimetres (1 scene unit = 1 cm).
export const CANDLE = {
  radius: 3.5,
  height: 12,
  minHeight: 0.9,
  // A 7 cm pillar burns roughly 0.24 cm of height per hour.
  burnRate: 0.24,
  // The candle stands on a plate this thick.
  baseY: 0.6,
  maxCrater: 3.5 - 0.38,
  flameLength: 3.6,
};

export type SpeedId = 'real' | 'minute' | 'second' | 'life';
export const SPEEDS: { id: SpeedId; label: string; hint: string; factor: number }[] = [
  { id: 'real', label: 'Real', hint: 'Real time', factor: 1 },
  { id: 'minute', label: '1m = 1h', hint: '1 minute = 1 hour', factor: 60 },
  { id: 'second', label: '1s = 1h', hint: '1 second = 1 hour', factor: 3600 },
  { id: 'life', label: '1s = 6h', hint: '1 second = 6 hours', factor: 21600 },
];

export type RoomId = 'still' | 'window' | 'fan';
export const ROOMS: { id: RoomId; label: string }[] = [
  { id: 'still', label: 'Still room' },
  { id: 'window', label: 'Open window' },
  { id: 'fan', label: 'Ceiling fan' },
];

export const sim = {
  // Candle body
  height: CANDLE.height, // local y of the melt-pool surface
  craterR: 0.8, // widest the melt pool has reached (wax "memory")
  rimH: 0.12,
  liquid: 0, // 0 = solid top, 1 = fully molten pool
  burnedHours: 0,
  sessionHours: 0, // hours since the last time it was lit
  generation: 0,
  dripCount: 0,
  lastDh: 0,

  // Flame
  lit: true,
  litAmount: 0,
  burnedOut: false,
  ember: 0,
  smoke: 0,
  leanX: 0,
  leanZ: 0,
  leanVX: 0,
  leanVZ: 0,
  flameLen: 0,
  turb: 0,
  flicker: 1,

  // Air
  windX: 0,
  windZ: 0,
  windMag: 0,
  windAvg: 0,
  userWindX: 0,
  userWindZ: 0,
  gust: 0,
  gustX: 0,
  gustZ: 0,
  strongWind: 0,
  camFwdX: 0,
  camFwdZ: -1,
  micOn: false,
  micLevel: 0,

  speed: 'second' as SpeedId,
  room: 'still' as RoomId,
  time: 0,
};

export type SimSnapshot = {
  lit: boolean;
  burnedOut: boolean;
  burnedHours: number;
  waxLeft: number;
  hoursLeft: number;
  speed: SpeedId;
  room: RoomId;
  micOn: boolean;
  micLevel: number;
};

const listeners = new Set<() => void>();
let snapshot: SimSnapshot = makeSnapshot();

function makeSnapshot(): SimSnapshot {
  const waxLeft = Math.max(0, sim.height - CANDLE.minHeight);
  return {
    lit: sim.lit,
    burnedOut: sim.burnedOut,
    burnedHours: sim.burnedHours,
    waxLeft,
    hoursLeft: waxLeft / CANDLE.burnRate,
    speed: sim.speed,
    room: sim.room,
    micOn: sim.micOn,
    micLevel: sim.micLevel,
  };
}

export function emit() {
  snapshot = makeSnapshot();
  listeners.forEach(l => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useSim() {
  return useSyncExternalStore(subscribe, () => snapshot);
}

export function speedFactor() {
  return SPEEDS.find(s => s.id === sim.speed)!.factor;
}

export function blowOut(dirX = sim.camFwdX, dirZ = sim.camFwdZ) {
  if (!sim.lit) return;
  const len = Math.hypot(dirX, dirZ) || 1;
  sim.lit = false;
  sim.gust = 1;
  sim.gustX = dirX / len;
  sim.gustZ = dirZ / len;
  sim.smoke = 1;
  sim.ember = 1;
  navigator.vibrate?.(25);
  emit();
}

export function relight() {
  if (sim.lit || sim.burnedOut) return;
  sim.lit = true;
  sim.sessionHours = 0;
  sim.strongWind = 0;
  sim.userWindX = sim.userWindZ = 0;
  sim.gust = 0;
  emit();
}

export function newCandle() {
  sim.height = CANDLE.height;
  sim.craterR = 0.8;
  sim.rimH = 0.12;
  sim.liquid = 0;
  sim.burnedHours = 0;
  sim.sessionHours = 0;
  sim.dripCount = 0;
  sim.burnedOut = false;
  sim.lit = true;
  sim.litAmount = 0;
  sim.ember = 0;
  sim.smoke = 0;
  sim.gust = 0;
  sim.strongWind = 0;
  sim.generation += 1;
  emit();
}

export function setSpeed(id: SpeedId) {
  sim.speed = id;
  emit();
}

export function setRoom(id: RoomId) {
  sim.room = id;
  emit();
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __sim: typeof sim }).__sim = sim;
}
