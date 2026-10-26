import { useFrame } from '@react-three/fiber';
import { CANDLE, blowOut, emit, sim, speedFactor } from '../sim/store';
import { noise1, smoothstep, wobble } from '../sim/noise';
import { readMic } from '../sim/mic';

// Wind above this strength for a moment puts the flame out.
const BLOW_OUT_WIND = 1.05;

function roomWind(t: number): [number, number] {
  switch (sim.room) {
    case 'window': {
      // Slow gusts from one side, with fast turbulence riding on top.
      const gust = smoothstep(0.45, 0.85, noise1(t * 0.22 + 4));
      const strength = 0.1 + gust * 0.62 + wobble(t * 3.1) * (0.08 + gust * 0.18);
      const angle = 0.35 + wobble(t * 0.09) * 1.1;
      return [Math.cos(angle) * strength, Math.sin(angle) * strength];
    }
    case 'fan': {
      // A ceiling fan pushes air in a slowly rotating, pulsing pattern.
      const angle = t * 1.25;
      const strength = 0.26 + Math.sin(t * 7.5) * 0.05 + wobble(t * 2.4) * 0.16;
      return [Math.cos(angle) * strength, Math.sin(angle) * strength];
    }
    default:
      // Even a "still" room has tiny convection currents.
      return [wobble(t * 0.35) * 0.05, wobble(t * 0.31 + 50) * 0.05];
  }
}

let emitTimer = 0;

export function Simulation() {
  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const t = state.clock.elapsedTime;
    sim.time = t;

    // ---- Air -------------------------------------------------------------
    const [rx, rz] = roomWind(t);
    sim.userWindX *= Math.exp(-dt * 3.5);
    sim.userWindZ *= Math.exp(-dt * 3.5);
    sim.gust *= Math.exp(-dt * 4);

    let micX = 0;
    let micZ = 0;
    if (sim.micOn) {
      const level = readMic();
      sim.micLevel += (level - sim.micLevel) * Math.min(1, dt * 18);
      const push = Math.max(0, sim.micLevel - 0.035) * 14;
      micX = sim.camFwdX * push;
      micZ = sim.camFwdZ * push;
    }

    sim.windX = rx + sim.userWindX + sim.gustX * sim.gust * 2.4 + micX;
    sim.windZ = rz + sim.userWindZ + sim.gustZ * sim.gust * 2.4 + micZ;
    sim.windMag = Math.hypot(sim.windX, sim.windZ);
    sim.windAvg += (sim.windMag - sim.windAvg) * Math.min(1, dt * 0.8);

    if (sim.lit && sim.litAmount > 0.6 && sim.windMag > BLOW_OUT_WIND) {
      sim.strongWind += dt;
      if (sim.strongWind > 0.12) blowOut(sim.windX, sim.windZ);
    } else {
      sim.strongWind = Math.max(0, sim.strongWind - dt * 2);
    }

    // ---- Flame -----------------------------------------------------------
    // The flame leans with the wind like a damped spring.
    const maxLean = 1.5;
    const tx = Math.max(-maxLean, Math.min(maxLean, sim.windX));
    const tz = Math.max(-maxLean, Math.min(maxLean, sim.windZ));
    const k = 46;
    const c = 7.5;
    sim.leanVX += (k * (tx - sim.leanX) - c * sim.leanVX) * dt;
    sim.leanVZ += (k * (tz - sim.leanZ) - c * sim.leanVZ) * dt;
    sim.leanX += sim.leanVX * dt;
    sim.leanZ += sim.leanVZ * dt;

    sim.turb = Math.min(1, 0.05 + sim.windMag * 0.75);
    sim.flicker =
      1 +
      wobble(t * 7.3) * 0.05 +
      wobble(t * 17.9 + 7) * 0.035 +
      wobble(t * 23 + 3) * sim.turb * 0.35;

    if (sim.lit) {
      sim.litAmount = Math.min(1, sim.litAmount + dt / 1.3);
      sim.ember = 0;
    } else {
      sim.litAmount = Math.max(0, sim.litAmount - dt / 0.16);
      sim.ember = Math.max(0, sim.ember - dt / 6);
    }
    sim.smoke = Math.max(0, sim.smoke - dt / 7);

    // Near the end the wick drowns in wax and the flame shrinks.
    const drown = smoothstep(CANDLE.minHeight, CANDLE.minHeight + 0.8, sim.height);
    const grow = sim.litAmount * sim.litAmount * (3 - 2 * sim.litAmount);
    sim.flameLen =
      CANDLE.flameLength *
      grow *
      (0.45 + 0.55 * drown) *
      (1 + (sim.flicker - 1) * 1.6) *
      (1 - 0.22 * Math.min(1, sim.windMag));

    // ---- Burning ---------------------------------------------------------
    const dh = (dt * speedFactor()) / 3600; // simulated hours this frame
    sim.lastDh = 0;
    if (sim.lit && sim.litAmount > 0.5) {
      sim.lastDh = dh;
      sim.burnedHours += dh;
      sim.sessionHours += dh;
      // Drafts make a candle burn faster.
      sim.height -= dh * CANDLE.burnRate * (1 + 0.6 * Math.min(1, sim.windAvg));
      // The melt pool widens over the first couple of hours, and never shrinks back.
      const target = CANDLE.maxCrater * (1 - Math.exp(-sim.sessionHours / 1.3));
      sim.craterR = Math.max(sim.craterR, target, 0.8);
      sim.liquid += (1 - sim.liquid) * Math.min(1, dh * 4);

      if (sim.height <= CANDLE.minHeight) {
        sim.height = CANDLE.minHeight;
        sim.lit = false;
        sim.burnedOut = true;
        sim.smoke = 0.8;
        sim.ember = 0.8;
        emit();
      }
    } else {
      // A blown-out pool sets solid in about 20 minutes.
      sim.liquid = Math.max(0, sim.liquid - ((dt * speedFactor()) / 3600) * 3);
    }
    const wide = sim.craterR / CANDLE.maxCrater;
    sim.rimH = 0.12 + 0.55 * wide * wide;

    emitTimer += dt;
    if (emitTimer > 0.2) {
      emitTimer = 0;
      emit();
    }
  }, -2);

  return null;
}
