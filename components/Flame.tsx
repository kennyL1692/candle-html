import React, { useEffect, useRef } from 'react';

interface FlameProps {
  wind: number;
  intensity: number;
}

// Sum of sine waves — cheap organic noise
const osc = (t: number, specs: [number, number, number][]) =>
  specs.reduce((sum, [freq, amp, phase]) => sum + Math.sin(t * freq + phase) * amp, 0);

export const Flame: React.FC<FlameProps> = ({ wind, intensity }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 144, H = 176;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    interface Spark { x: number; y: number; vx: number; vy: number; life: number; size: number; }
    const sparks: Spark[] = [];
    let t = 0;
    let raf: number;

    // Teardrop bezier: base at (cx, by), tip at (cx+sx, by-h), half-width w
    const flamePath = (cx: number, by: number, h: number, w: number, sx: number) => {
      const tx = cx + sx, ty = by - h;
      ctx.beginPath();
      ctx.moveTo(cx, by);
      ctx.bezierCurveTo(cx + w, by - h * 0.22, tx + w * 0.65, by - h * 0.54, tx, ty);
      ctx.bezierCurveTo(tx - w * 0.65, by - h * 0.54, cx - w, by - h * 0.22, cx, by);
      ctx.closePath();
    };

    const render = () => {
      t += 1 / 60;
      ctx.clearRect(0, 0, W, H);

      const cx = W / 2, by = H - 8;

      // Multi-frequency sway simulates turbulent air
      const sw = osc(t, [[1.1, 5.5, 0], [2.9, 2.8, 1.2], [5.7, 1.4, 2.5]]) + wind * 22;
      // Breathing: the flame swells and contracts
      const br = 1 + osc(t, [[0.85, 0.07, 0], [2.3, 0.035, 1.5]]);
      const fh = (84 + osc(t, [[1.4, 6, 0.6], [3.3, 2.8, 2.2]])) * intensity * br;

      // Layer 1 — outer orange halo (heavy blur, wide)
      ctx.save();
      ctx.filter = 'blur(10px)';
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.48 * intensity;
      flamePath(cx, by, fh * 0.92, 28, sw * 0.6);
      const g1 = ctx.createLinearGradient(cx, by, cx + sw * 0.4, by - fh);
      g1.addColorStop(0, 'rgba(255, 108, 8, 1)');
      g1.addColorStop(0.5, 'rgba(255, 68, 5, 0.55)');
      g1.addColorStop(1, 'rgba(175, 22, 0, 0)');
      ctx.fillStyle = g1;
      ctx.fill();
      ctx.restore();

      // Layer 2 — mid yellow flame (soft blur)
      ctx.save();
      ctx.filter = 'blur(2px)';
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.82;
      flamePath(cx, by, fh * 0.78, 15 * intensity, sw * 0.82);
      const g2 = ctx.createLinearGradient(cx, by, cx + sw * 0.35, by - fh * 0.78);
      g2.addColorStop(0, 'rgba(255, 248, 202, 1)');
      g2.addColorStop(0.28, 'rgba(255, 196, 52, 0.95)');
      g2.addColorStop(0.65, 'rgba(255, 118, 14, 0.55)');
      g2.addColorStop(1, 'rgba(255, 76, 0, 0)');
      ctx.fillStyle = g2;
      ctx.fill();
      ctx.restore();

      // Layer 3 — inner hot core: blue at wick base → white hot → fading yellow tip
      ctx.save();
      ctx.filter = 'blur(0.8px)';
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.92;
      flamePath(cx, by, fh * 0.52, 7.5, sw * 0.9);
      const g3 = ctx.createLinearGradient(cx, by, cx + sw * 0.15, by - fh * 0.52);
      g3.addColorStop(0, 'rgba(168, 208, 255, 1)');   // blue at wick (combustion zone)
      g3.addColorStop(0.1, 'rgba(255, 255, 248, 1)'); // white hot
      g3.addColorStop(0.48, 'rgba(255, 238, 112, 0.85)');
      g3.addColorStop(1, 'rgba(255, 162, 22, 0)');
      ctx.fillStyle = g3;
      ctx.fill();
      ctx.restore();

      // Sparks — ejected from upper flame, drift on wind
      if (Math.random() > 0.9) {
        sparks.push({
          x: cx + (Math.random() - 0.5) * 12 + sw * 0.35,
          y: by - fh * (0.45 + Math.random() * 0.35),
          vx: (Math.random() - 0.5 + wind * 0.28) * 2.8,
          vy: -(2.2 + Math.random() * 3.2),
          life: 1,
          size: 0.8 + Math.random() * 1.8,
        });
      }

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = sparks.length - 1; i >= 0; i--) {
        const sp = sparks[i];
        sp.x += sp.vx; sp.y += sp.vy;
        sp.vy += 0.07; sp.vx *= 0.97; // slight gravity, air drag
        sp.life -= 0.026;
        if (sp.life <= 0) { sparks.splice(i, 1); continue; }
        const r = sp.size * sp.life * 2.2;
        ctx.globalAlpha = sp.life * 0.88;
        const sg = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, r);
        sg.addColorStop(0, `rgba(255, 255, 200, ${sp.life})`);
        sg.addColorStop(1, 'rgba(255, 130, 0, 0)');
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      raf = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(raf);
  }, [wind, intensity]);

  return (
    <div className="pointer-events-none relative left-1/2 -top-32 h-44 w-36 -translate-x-1/2">
      <canvas
        ref={canvasRef}
        className="h-full w-full blur-[0.8px] filter"
        style={{ transform: 'translateY(18px)' }}
      />
      <div className="absolute left-1/2 top-[60%] h-16 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-400 opacity-[0.1] blur-2xl mix-blend-screen" />
    </div>
  );
};
