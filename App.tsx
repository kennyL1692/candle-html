import React, { useEffect, useMemo, useState } from 'react';
import { Candle } from './components/Candle';
import { FlameKindling, RefreshCcw, Sparkles, Wind } from 'lucide-react';

const MELT_DURATION_MS = 10000;

type DemoMode = 'cinematic' | 'storm' | 'calm';

const modeDetails: Record<DemoMode, { label: string; wind: number; intensity: number; description: string }> = {
  cinematic: {
    label: 'Cinematic',
    wind: 0.28,
    intensity: 1.1,
    description: 'Balanced flame, strong glow, and visible wax motion.',
  },
  storm: {
    label: 'Storm draft',
    wind: 0.75,
    intensity: 1.35,
    description: 'Aggressive flicker, sparks, and a dramatic room pulse.',
  },
  calm: {
    label: 'Gallery calm',
    wind: 0.08,
    intensity: 0.82,
    description: 'Slow, elegant motion for a polished booth/demo loop.',
  },
};

const formatSeconds = (milliseconds: number) => `${Math.ceil(milliseconds / 1000)}s`;

export default function App() {
  const [key, setKey] = useState(0);
  const [isMelting, setIsMelting] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [mode, setMode] = useState<DemoMode>('cinematic');
  const [remainingMs, setRemainingMs] = useState(MELT_DURATION_MS);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });

  const activeMode = modeDetails[mode];
  const progress = 1 - remainingMs / MELT_DURATION_MS;

  const roomStyle = useMemo(
    () => ({
      background: `
        radial-gradient(circle at ${50 + cursor.x * 5}% ${58 + cursor.y * 4}%, rgba(255, 138, 32, ${isFinished ? 0 : 0.24 * activeMode.intensity}) 0%, transparent 42%),
        radial-gradient(circle at 20% 20%, rgba(101, 78, 255, 0.12), transparent 34%),
        linear-gradient(145deg, #05050a 0%, #11111b 48%, #050507 100%)
      `,
    }),
    [activeMode.intensity, cursor.x, cursor.y, isFinished],
  );

  useEffect(() => {
    setIsMelting(true);
  }, [key]);

  useEffect(() => {
    if (!isMelting) return;

    const startedAt = performance.now();
    let frameId = 0;

    const tick = (time: number) => {
      const nextRemaining = Math.max(MELT_DURATION_MS - (time - startedAt), 0);
      setRemainingMs(nextRemaining);

      if (nextRemaining > 0) {
        frameId = requestAnimationFrame(tick);
        return;
      }

      setIsMelting(false);
      setIsFinished(true);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [isMelting, key]);

  const handleRestart = () => {
    setIsMelting(false);
    setIsFinished(false);
    setRemainingMs(MELT_DURATION_MS);
    setKey(prev => prev + 1);
  };

  const handleModeChange = (nextMode: DemoMode) => {
    setMode(nextMode);
    handleRestart();
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const { innerWidth, innerHeight } = window;
    setCursor({
      x: (event.clientX / innerWidth - 0.5) * 2,
      y: (event.clientY / innerHeight - 0.5) * 2,
    });
  };

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden bg-[#050507] text-slate-100"
      onPointerMove={handlePointerMove}
    >
      <div className="absolute inset-0 transition-opacity duration-700" style={roomStyle} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.2)_55%,rgba(0,0,0,0.82)_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.18] mix-blend-screen [background-image:linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.04)_1px,transparent_1px)] [background-size:44px_44px]" />

      <main className="relative z-10 grid min-h-screen grid-cols-1 items-center gap-8 px-6 py-8 lg:grid-cols-[minmax(280px,420px)_1fr_minmax(260px,360px)] lg:px-12">
        <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/30 backdrop-blur-md">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-amber-200">
            <Sparkles size={14} /> JS Demo Upgrade
          </div>
          <h1 className="text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl">
            Real-time candle physics
          </h1>
          <p className="mt-4 text-sm leading-6 text-slate-300">
            The demo now uses JavaScript animation loops for the melt timer, cursor-driven light, draft presets, sparks, smoke, and wax movement.
          </p>

          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl bg-black/25 p-3">
              <div className="text-2xl font-bold text-amber-200">{formatSeconds(remainingMs)}</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500">remaining</div>
            </div>
            <div className="rounded-2xl bg-black/25 p-3">
              <div className="text-2xl font-bold text-orange-200">{Math.round(progress * 100)}%</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500">melted</div>
            </div>
            <div className="rounded-2xl bg-black/25 p-3">
              <div className="text-2xl font-bold text-sky-200">{Math.round(activeMode.wind * 100)}</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500">draft</div>
            </div>
          </div>
        </section>

        <section className="relative flex min-h-[520px] items-end justify-center rounded-[2rem] border border-white/10 bg-black/20 p-8 shadow-[inset_0_0_80px_rgba(255,147,41,0.06)]">
          <div className="absolute bottom-8 h-16 w-80 rounded-full bg-amber-500/10 blur-3xl" />
          <div className="absolute inset-x-8 bottom-16 h-px bg-gradient-to-r from-transparent via-amber-100/20 to-transparent" />
          <Candle
            key={key}
            isMelting={isMelting}
            durationMs={MELT_DURATION_MS}
            isFinished={isFinished}
            wind={activeMode.wind + Math.abs(cursor.x) * 0.12}
            intensity={activeMode.intensity}
          />
        </section>

        <aside className="rounded-3xl border border-white/10 bg-slate-950/60 p-5 shadow-2xl shadow-black/30 backdrop-blur-md">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
            <Wind size={16} /> Demo presets
          </div>

          <div className="space-y-3">
            {(Object.keys(modeDetails) as DemoMode[]).map(option => (
              <button
                key={option}
                onClick={() => handleModeChange(option)}
                className={`w-full rounded-2xl border p-4 text-left transition-all duration-300 ${
                  mode === option
                    ? 'border-amber-300/50 bg-amber-300/15 text-white shadow-lg shadow-amber-900/20'
                    : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/25 hover:bg-white/[0.08]'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="font-semibold">{modeDetails[option].label}</span>
                  {mode === option && <FlameKindling size={18} className="text-amber-200" />}
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-400">{modeDetails[option].description}</p>
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-widest text-slate-500">
              <span>Melt timeline</span>
              <span>{Math.round(progress * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-200 via-orange-400 to-red-500 transition-[width] duration-100"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>

          <button
            onClick={handleRestart}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/15 px-6 py-3 font-semibold text-amber-100 transition-all duration-300 hover:-translate-y-0.5 hover:bg-amber-300/25 hover:shadow-lg hover:shadow-amber-900/25"
          >
            <RefreshCcw size={16} />
            {isFinished ? 'Relight Candle' : 'Restart Demo'}
          </button>
        </aside>
      </main>
    </div>
  );
}
