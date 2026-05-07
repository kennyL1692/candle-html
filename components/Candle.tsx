import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Flame } from './Flame';

interface CandleProps {
  isMelting: boolean;
  durationMs: number;
  isFinished: boolean;
  wind: number;
  intensity: number;
}

const dripProfiles = [
  { left: 9, width: 9, delay: 0.04, speed: 1.05, max: 118 },
  { left: 33, width: 6, delay: 0.2, speed: 0.86, max: 92 },
  { left: 47, width: 7, delay: 0.34, speed: 1.22, max: 132 },
];

export const Candle: React.FC<CandleProps> = ({ isMelting, durationMs, isFinished, wind, intensity }) => {
  const [progress, setProgress] = useState(0);
  const [flicker, setFlicker] = useState(0);
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
        setFlicker(Math.sin(time * 0.018) * 0.5 + Math.sin(time * 0.047) * 0.3 + (Math.random() - 0.5) * 0.35);

        if (nextProgress < 1) {
          reqRef.current = requestAnimationFrame(animate);
        }
      };
      reqRef.current = requestAnimationFrame(animate);
    } else if (isFinished) {
      setProgress(1);
      setFlicker(0);
    } else {
      setProgress(0);
      setFlicker(0);
      startTimeRef.current = null;
    }

    return () => {
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
    };
  }, [isMelting, durationMs, isFinished]);

  const initialHeight = 220;
  const width = 68;
  const currentHeight = Math.max(12, initialHeight * (1 - progress));
  const poolScale = 1 + progress * 1.9;
  const meltedLip = 8 + progress * 22;
  const glowStrength = isFinished ? 0 : (0.58 + flicker * 0.08) * intensity;

  const droplets = useMemo(
    () =>
      dripProfiles.map(drip => ({
        ...drip,
        height: Math.max(0, Math.min((progress - drip.delay) * drip.max * drip.speed, drip.max)),
        opacity: progress > drip.delay ? Math.min((progress - drip.delay) * 4, 0.75) : 0,
      })),
    [progress],
  );

  return (
    <div className="relative flex flex-col items-center">
      <div
        className="pointer-events-none absolute top-0 h-80 w-80 -translate-y-full rounded-full blur-2xl transition-opacity duration-500"
        style={{
          background: 'radial-gradient(closest-side, rgba(255, 201, 91, 0.34), rgba(255, 122, 24, 0.12) 42%, transparent 76%)',
          opacity: glowStrength,
          transform: `translateY(-${currentHeight - 4}px) translateX(${flicker * 7 + wind * 10}px) scale(${1 + Math.abs(flicker) * 0.05})`,
        }}
      />

      <div
        className="absolute z-20 transition-all duration-100 ease-out"
        style={{
          bottom: `${currentHeight - 2}px`,
          opacity: isFinished ? 0 : 1,
          transform: `translateX(${wind * 9 + flicker * 3}px) rotate(${wind * 7 + flicker * 2}deg) scale(${isFinished ? 0 : 1})`,
          transition: 'opacity 1s, transform 160ms ease-out',
        }}
      >
        <Flame wind={wind} intensity={intensity} />
      </div>

      <div
        className="absolute z-10 w-1 rounded-t-sm bg-gradient-to-b from-slate-700 to-slate-950"
        style={{
          height: '16px',
          bottom: `${Math.max(currentHeight - 9, 4)}px`,
          opacity: isFinished ? 0.45 : 1,
          transform: `rotate(${wind * 7}deg)`,
        }}
      />

      <div
        className="absolute bottom-0 z-0 rounded-full bg-[#f7f1e4] opacity-95 blur-[1px] transition-transform duration-100"
        style={{
          width: `${width + 24}px`,
          height: '28px',
          transform: `scaleX(${poolScale}) scaleY(${1 + progress * 0.72})`,
          boxShadow: `0 0 ${14 + progress * 18}px rgba(255, 210, 150, ${0.18 + progress * 0.24})`,
        }}
      />

      <div
        className="relative overflow-visible bg-gradient-to-r from-[#e5dfd1] via-[#fffdf5] to-[#d9d1c3] shadow-inner transition-all duration-100"
        style={{
          width: `${width}px`,
          height: `${currentHeight}px`,
          borderRadius: `${meltedLip}px ${meltedLip}px 8px 8px`,
          boxShadow: 'inset -14px 0 18px rgba(90,70,42,0.16), inset 11px 0 18px rgba(255,255,255,0.78), 0 0 26px rgba(255, 178, 90, 0.14)',
        }}
      >
        <div className="absolute inset-x-0 top-0 h-12 rounded-t-full bg-gradient-to-b from-[#fff6dd] to-transparent opacity-90" />
        <div
          className="absolute -top-1 left-1/2 h-5 w-[76px] -translate-x-1/2 rounded-full border border-amber-100/50 bg-gradient-to-r from-[#e4d6bd] via-[#fff6df] to-[#d2bea0]"
          style={{ transform: `translateX(-50%) scaleX(${1 + progress * 0.2})` }}
        />
        <div className="absolute inset-y-0 left-3 w-2 rounded-full bg-white/35 blur-[1px]" />
        <div className="absolute inset-y-0 right-2 w-3 rounded-full bg-amber-900/10 blur-[2px]" />

        {droplets.map(drip => (
          <div
            key={drip.left}
            className="absolute top-1 rounded-full bg-gradient-to-b from-white/70 to-amber-100/45 shadow-sm"
            style={{
              left: `${drip.left}px`,
              width: `${drip.width}px`,
              height: `${drip.height}px`,
              opacity: drip.opacity,
            }}
          >
            <span className="absolute bottom-[-5px] left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-amber-50/80" />
          </div>
        ))}
      </div>

      <div className="absolute -bottom-5 h-5 w-44 rounded-full bg-black/60 blur-xl" />
      <div className="absolute -bottom-1 h-1 w-32 rounded-full bg-amber-100/20 blur-sm" />
    </div>
  );
};
