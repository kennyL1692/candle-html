import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  kind: 'core' | 'spark' | 'smoke';
}

interface FlameProps {
  wind: number;
  intensity: number;
}

export const Flame: React.FC<FlameProps> = ({ wind, intensity }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const particles: Particle[] = [];
    let animationFrameId: number;
    let frameCount = 0;

    const spawnParticle = () => {
      const centerX = rect.width / 2;
      const centerY = rect.height - 16;
      const draft = (Math.random() - 0.5 + wind) * 0.42;

      particles.push({
        x: centerX + (Math.random() - 0.5) * 5,
        y: centerY,
        vx: draft,
        vy: -0.85 - Math.random() * 1.65 * intensity,
        life: 1,
        maxLife: 1,
        size: 8 + Math.random() * 8 * intensity,
        kind: 'core',
      });

      if (Math.random() > 0.9 - wind * 0.08) {
        particles.push({
          x: centerX + (Math.random() - 0.5) * 8,
          y: centerY - 9,
          vx: (Math.random() - 0.5 + wind) * 1.45,
          vy: -2.2 - Math.random() * 2.8,
          life: 1,
          maxLife: 0.72 + Math.random() * 0.3,
          size: 1.2 + Math.random() * 2.5,
          kind: 'spark',
        });
      }

      if (Math.random() > 0.94) {
        particles.push({
          x: centerX + (Math.random() - 0.5) * 10,
          y: centerY - 12,
          vx: (Math.random() - 0.5 + wind) * 0.6,
          vy: -0.7 - Math.random() * 0.8,
          life: 1,
          maxLife: 1.25,
          size: 8 + Math.random() * 6,
          kind: 'smoke',
        });
      }
    };

    const colorForParticle = (particle: Particle) => {
      if (particle.kind === 'smoke') {
        return { r: 120, g: 122, b: 128, a: particle.life * 0.12 };
      }

      if (particle.kind === 'spark') {
        return { r: 255, g: 205, b: 76, a: particle.life };
      }

      if (particle.life > 0.82) {
        return { r: 112, g: 180, b: 255, a: particle.life * 0.5 };
      }

      if (particle.life > 0.54) {
        return { r: 255, g: 238, b: 107, a: particle.life * 0.86 };
      }

      if (particle.life > 0.24) {
        return { r: 255, g: 122, b: 15, a: particle.life * 0.68 };
      }

      return { r: 154, g: 23, b: 5, a: particle.life * 0.35 };
    };

    const updateAndDraw = () => {
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.globalCompositeOperation = 'lighter';

      frameCount++;
      const windForce = Math.sin(frameCount * 0.07) * 0.05 + wind * 0.09 + (Math.random() - 0.5) * 0.035;
      const spawnCount = Math.max(2, Math.round(3 * intensity));
      for (let i = 0; i < spawnCount; i++) spawnParticle();

      for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        const topWeight = 1 - particle.life;

        particle.x += particle.vx + windForce * topWeight;
        particle.y += particle.vy;
        particle.life -= particle.kind === 'spark' ? 0.022 : 0.012 + Math.random() * 0.012;
        particle.size *= particle.kind === 'smoke' ? 1.008 : 0.965;

        if (particle.life <= 0 || particle.size < 0.45) {
          particles.splice(i, 1);
          continue;
        }

        const { r, g, b, a } = colorForParticle(particle);
        const radius = particle.kind === 'spark' ? particle.size * 2.1 : particle.size * 1.55;
        const gradient = ctx.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, radius);
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${a})`);
        gradient.addColorStop(0.45, `rgba(${r}, ${g}, ${b}, ${a * 0.5})`);
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(updateAndDraw);
    };

    updateAndDraw();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [intensity, wind]);

  return (
    <div className="pointer-events-none relative left-1/2 -top-32 h-44 w-36 -translate-x-1/2">
      <canvas
        ref={canvasRef}
        className="h-full w-full blur-[1.6px] filter"
        style={{ transform: 'translateY(18px)' }}
      />
      <div className="absolute left-1/2 top-[55%] h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500 opacity-20 blur-2xl mix-blend-screen animate-pulse" />
      <div className="absolute left-1/2 top-[64%] h-10 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-200/40 blur-md mix-blend-screen" />
    </div>
  );
};
