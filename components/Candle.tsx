import React, { useEffect, useRef, useState } from 'react';
import { Flame } from './Flame';

interface CandleProps {
  isMelting: boolean;
  durationMs: number;
  isFinished: boolean;
}

export const Candle: React.FC<CandleProps> = ({ isMelting, durationMs, isFinished }) => {
  const [progress, setProgress] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const reqRef = useRef<number>();

  useEffect(() => {
    if (isMelting) {
      startTimeRef.current = performance.now();
      const animate = (time: number) => {
        if (!startTimeRef.current) return;
        const elapsed = time - startTimeRef.current;
        const nextProgress = Math.min(elapsed / durationMs, 1);
        
        setProgress(nextProgress);

        if (nextProgress < 1) {
          reqRef.current = requestAnimationFrame(animate);
        }
      };
      reqRef.current = requestAnimationFrame(animate);
    } else if (isFinished) {
      setProgress(1);
    } else {
      setProgress(0);
    }

    return () => {
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
    };
  }, [isMelting, durationMs, isFinished]);

  // Dimensions
  const INITIAL_HEIGHT = 200;
  const WIDTH = 60;
  
  // Calculated properties
  const currentHeight = Math.max(10, INITIAL_HEIGHT * (1 - progress));
  const poolScale = 1 + (progress * 1.5); // Wax pool grows
  const flickerOpacity = isFinished ? 0 : 1;

  return (
    <div className="relative flex flex-col items-center">
      
      {/* Dynamic Glow behind flame */}
      <div 
        className="absolute top-0 transform -translate-y-full w-64 h-64 rounded-full pointer-events-none transition-opacity duration-1000"
        style={{
          background: 'radial-gradient(closest-side, rgba(255, 180, 50, 0.15), transparent)',
          opacity: isFinished ? 0 : 0.6 + (Math.random() * 0.1), // Subtle global flicker
          transform: `translateY(-${currentHeight + 20}px) scale(${1 + Math.random() * 0.1})`
        }}
      />

      {/* Flame Container */}
      <div 
        className="absolute z-20 transition-all duration-75 ease-out"
        style={{ 
          bottom: `${currentHeight}px`,
          opacity: isFinished ? 0 : 1,
          transform: `scale(${isFinished ? 0 : 1})`,
          transition: 'opacity 1s, transform 1s' 
        }}
      >
        <Flame />
      </div>

      {/* Wick */}
      <div 
        className="absolute z-10 w-1 bg-slate-800 rounded-t-sm"
        style={{ 
            height: '12px',
            bottom: `${currentHeight - 6}px`, // Slightly embedded
            opacity: isFinished ? 0.5 : 1
        }} 
      />

      {/* Wax Pool (accumulates at bottom) */}
      <div 
        className="absolute bottom-0 z-0 bg-[#f5f5f0] rounded-full blur-[1px] shadow-lg opacity-90 transition-transform duration-75"
        style={{
            width: `${WIDTH + 20}px`,
            height: '24px',
            transform: `scaleX(${poolScale}) scaleY(${1 + (progress * 0.5)})`,
            boxShadow: '0 0 10px rgba(255, 255, 255, 0.2)'
        }}
      />

      {/* Molten Wax Dripping effect (simulated with gradient overlay) */}
      <div 
        className="relative bg-gradient-to-b from-[#fffdf5] to-[#f0efe9] rounded-sm shadow-inner overflow-hidden transition-all duration-75"
        style={{
            width: `${WIDTH}px`,
            height: `${currentHeight}px`,
            borderRadius: '4px',
            boxShadow: 'inset 0 -10px 20px rgba(0,0,0,0.1), 0 0 15px rgba(255, 200, 100, 0.1)'
        }}
      >
        {/* Subsurface scattering glow near top */}
        <div 
            className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-[#ffeedd] to-transparent opacity-80"
        />
        
        {/* Drip lines that appear as it melts */}
        <div className="absolute top-0 left-2 w-2 bg-white/40 rounded-full" style={{ height: `${progress * 100}%`, opacity: progress > 0.1 ? 0.6 : 0 }} />
        <div className="absolute top-0 right-3 w-1.5 bg-white/30 rounded-full" style={{ height: `${progress * 80}%`, opacity: progress > 0.2 ? 0.5 : 0 }} />
      </div>

      {/* Base reflection */}
      <div className="absolute -bottom-4 w-32 h-4 bg-black/40 blur-xl rounded-full" />
    </div>
  );
};