import * as THREE from 'three';
import { mulberry32 } from '../sim/noise';

function canvas(size: number) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')!] as const;
}

function addPixelNoise(g: CanvasRenderingContext2D, size: number, amount: number, rand: () => number) {
  const img = g.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rand() - 0.5) * amount;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

function finish(c: HTMLCanvasElement, repeat: number, srgb: boolean) {
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 8;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Dark oiled walnut planks. */
export function makeWood() {
  const S = 1024;
  const rand = mulberry32(7);
  const [c, g] = canvas(S);
  g.fillStyle = '#7a4f30';
  g.fillRect(0, 0, S, S);

  const planks = 4;
  for (let p = 0; p < planks; p++) {
    const shade = rand();
    g.fillStyle = shade > 0.5 ? `rgba(110,70,40,${0.12 + rand() * 0.18})` : `rgba(20,10,4,${0.12 + rand() * 0.2})`;
    g.fillRect(0, (p * S) / planks, S, S / planks);
  }

  for (let i = 0; i < 1100; i++) {
    const y0 = rand() * S;
    const amp = 1.5 + rand() * 9;
    const freq = 0.002 + rand() * 0.006;
    const ph = rand() * Math.PI * 2;
    const dark = rand() < 0.68;
    g.strokeStyle = dark
      ? `rgba(28,14,5,${0.05 + rand() * 0.22})`
      : `rgba(150,102,62,${0.04 + rand() * 0.12})`;
    g.lineWidth = 0.4 + rand() * 2.4;
    g.beginPath();
    for (let x = 0; x <= S; x += 16) {
      const y = y0 + Math.sin(x * freq + ph) * amp + Math.sin(x * freq * 3.1 + ph * 2) * amp * 0.3;
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }

  // Plank seams
  for (let p = 0; p <= planks; p++) {
    const y = (p * S) / planks;
    g.fillStyle = 'rgba(8,4,2,0.85)';
    g.fillRect(0, y - 1.5, S, 3);
    g.fillStyle = 'rgba(160,110,70,0.12)';
    g.fillRect(0, y + 1.5, S, 1);
  }

  addPixelNoise(g, S, 14, rand);
  return finish(c, 3, true);
}

/** Warm, slightly uneven plaster for the back wall. */
export function makePlaster() {
  const S = 512;
  const rand = mulberry32(21);
  const [c, g] = canvas(S);
  g.fillStyle = '#8a7a69';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 260; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const r = 10 + rand() * 70;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    const light = rand() > 0.5;
    grad.addColorStop(0, light ? `rgba(180,165,145,${rand() * 0.12})` : `rgba(40,32,26,${rand() * 0.12})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  addPixelNoise(g, S, 22, rand);
  return finish(c, 2, true);
}

/** Fine grain used as a bump map on the wax. */
export function makeWaxGrain() {
  const S = 256;
  const rand = mulberry32(3);
  const [c, g] = canvas(S);
  g.fillStyle = '#808080';
  g.fillRect(0, 0, S, S);
  // Faint vertical pour marks
  for (let i = 0; i < 90; i++) {
    const x = rand() * S;
    g.fillStyle = rand() > 0.5 ? `rgba(255,255,255,${rand() * 0.06})` : `rgba(0,0,0,${rand() * 0.06})`;
    g.fillRect(x, 0, 1 + rand() * 4, S);
  }
  addPixelNoise(g, S, 30, rand);
  const tex = finish(c, 1, false);
  tex.repeat.set(3, 2);
  return tex;
}
