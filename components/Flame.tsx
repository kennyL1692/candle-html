import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: { r: number; g: number; b: number };
}

export const Flame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set high resolution
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Particle System State
    const particles: Particle[] = [];
    let animationFrameId: number;
    let frameCount = 0;

    const spawnParticle = () => {
      // Spawn point (bottom center of canvas)
      const centerX = rect.width / 2;
      const centerY = rect.height - 10;

      // Create main flame body particles
      const p: Particle = {
        x: centerX + (Math.random() - 0.5) * 4,
        y: centerY,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -0.5 - Math.random() * 1.5, // Upward velocity
        life: 1.0,
        maxLife: 1.0,
        size: 8 + Math.random() * 6,
        color: { r: 255, g: 255, b: 255 } // Starts white/hot
      };
      particles.push(p);

      // Occasional spark/smoke
      if (Math.random() > 0.95) {
        particles.push({
           x: centerX + (Math.random() - 0.5) * 6,
           y: centerY - 10,
           vx: (Math.random() - 0.5) * 0.5,
           vy: -1 - Math.random(),
           life: 1.0,
           maxLife: 0.8 + Math.random() * 0.4,
           size: 2 + Math.random() * 2,
           color: { r: 50, g: 50, b: 50 } // Grey smoke
        });
      }
    };

    const updateAndDraw = () => {
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.globalCompositeOperation = 'lighter'; // Additive blending for fire glow

      // Wind/Flicker simulation
      frameCount++;
      const windForce = Math.sin(frameCount * 0.1) * 0.05 + (Math.random() - 0.5) * 0.02;

      // Spawn new particles
      // Spawn rate
      for (let i = 0; i < 3; i++) spawnParticle();

      // Update Loop
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        
        // Physics
        p.x += p.vx + windForce * (1 - p.life); // Wind affects top more
        p.y += p.vy;
        p.life -= 0.015 + Math.random() * 0.01; // Decay
        p.size *= 0.96; // Shrink

        // Color Logic based on life (Heat map)
        // Life 1.0 -> 0.8: Blue/White (Base)
        // Life 0.8 -> 0.5: Yellow/Orange (Body)
        // Life 0.5 -> 0.0: Red/Grey (Tip)
        
        let r, g, b, a;
        
        if (p.color.r === 50) { // Smoke particle handling
             r = 80; g = 80; b = 80; a = p.life * 0.3;
        } else {
            // Fire particle gradient
            if (p.life > 0.8) {
                r = 100; g = 150; b = 255; a = p.life * 0.5; // Blue core
            } else if (p.life > 0.5) {
                r = 255; g = 220; b = 50; a = p.life * 0.8; // Yellow body
            } else if (p.life > 0.2) {
                r = 255; g = 100; b = 0; a = p.life * 0.6; // Orange/Red tip
            } else {
                r = 100; g = 0; b = 0; a = p.life * 0.4; // Fading red
            }
        }

        // Render
        if (p.life <= 0 || p.size < 0.5) {
          particles.splice(i, 1);
        } else {
          ctx.beginPath();
          // Create a soft radial gradient for each particle for "puff" look
          const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
          gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${a})`);
          gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
          
          ctx.fillStyle = gradient;
          ctx.arc(p.x, p.y, p.size * 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animationFrameId = requestAnimationFrame(updateAndDraw);
    };

    updateAndDraw();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // Filter blur helps blend the particles into a fluid flame
  return (
    <div className="relative w-32 h-40 -translate-x-1/2 left-1/2 -top-32 pointer-events-none">
       <canvas 
        ref={canvasRef} 
        className="w-full h-full filter blur-[2px]" 
        style={{ transform: 'translateY(20px)'}}
       />
       {/* Halo glow */}
       <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-orange-500 rounded-full opacity-20 blur-xl mix-blend-screen animate-pulse" />
    </div>
  );
};