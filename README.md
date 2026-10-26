# Pillar Candle

A real-time 3D candle you can play with. Built with React, Three.js (React Three Fiber) and Vite.

## What makes it feel real

- **Layered flame shader:** blue base, dark inner cone, bright yellow body and an orange tip, with turbulence that rises up the flame.
- **Glowing wax:** wax near the flame glows from inside, and the thin rim of a well-burned pillar lights up like a lampshade.
- **Melt pool with memory:** the pool widens over the first hours, never shrinks back, and forms a rim. Molten wax is glossy and reflects the flame.
- **Drips:** wind leans the flame, which melts the downwind rim and sends wax running down that side.
- **Light:** the flame lights the table and wall, the flicker moves the light, and the rim casts a soft shadow worked out from the flame and rim heights.
- **Smoke:** blow it out and a ribbon of smoke curls up from the glowing wick.
- **Honest burn rate:** a 7 × 12 cm pillar burns about 0.24 cm an hour (about 46 hours in all). The time control speeds up the burn, while the flame and air always move in real time.

## How to play

| Do this | What happens |
|---|---|
| Tap / click the flame | Blows it out |
| Tap the wick | Relights it |
| Wave or swipe beside the flame | Makes a draft; swipe fast to blow it out |
| Drag anywhere else | Look around the candle |
| Mic button | Blow into your microphone to put it out |
| Time | Real time, 1 min = 1 h, 1 s = 1 h, 1 s = 6 h |
| Air | Still room, open window, ceiling fan |

Works on phones (portrait and landscape) and drops resolution on slower devices.

## Run locally

**Prerequisites:** Node.js 20+

```bash
npm install
npm run dev      # start the dev server
npm run build    # production build in dist/
```

Pushing to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml`.

## Project layout

```
sim/            simulation state, noise helpers, microphone input
components/
  Experience    canvas, lights, camera, touch input, post-processing
  Simulation    wind, flame physics, burning
  CandleBody    wax body, melt pool, wick, drips
  Flame         flame and halo shaders
  Smoke         smoke ribbon particles
  Room          table, wall, plate, rim shadow
  Hud           on-screen controls
```
