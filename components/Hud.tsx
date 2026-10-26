import React, { useEffect, useState } from 'react';
import { Flame, Mic, MicOff, RotateCcw, Wind } from 'lucide-react';
import { CANDLE, ROOMS, SPEEDS, blowOut, emit, newCandle, relight, setRoom, setSpeed, sim, useSim } from '../sim/store';
import { startMic, stopMic } from '../sim/mic';

function formatHours(h: number) {
  if (h < 1) return `${Math.floor(h * 60)} min`;
  const whole = Math.floor(h);
  const mins = Math.floor((h - whole) * 60);
  return whole >= 10 ? `${whole} h` : `${whole} h ${mins.toString().padStart(2, '0')}`;
}

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string; hint?: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="seg-group">
      <span className="seg-label">{label}</span>
      <div className="seg" role="radiogroup" aria-label={label}>
        {options.map(o => (
          <button
            key={o.id}
            role="radio"
            aria-checked={value === o.id}
            title={o.hint ?? o.label}
            className={value === o.id ? 'on' : ''}
            onClick={() => onChange(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Hud() {
  const s = useSim();
  const [hint, setHint] = useState(true);
  const [micError, setMicError] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setHint(false), 9000);
    return () => window.clearTimeout(id);
  }, []);

  const toggleMic = async () => {
    if (sim.micOn) {
      stopMic();
      sim.micOn = false;
      sim.micLevel = 0;
      emit();
      return;
    }
    const ok = await startMic();
    setMicError(!ok);
    sim.micOn = ok;
    emit();
  };

  const used = 1 - s.waxLeft / (CANDLE.height - CANDLE.minHeight);

  let action: React.ReactNode;
  if (s.burnedOut) {
    action = (
      <button className="primary" onClick={newCandle}>
        <RotateCcw size={16} /> New candle
      </button>
    );
  } else if (s.lit) {
    action = (
      <button className="primary" onClick={() => blowOut()}>
        <Wind size={16} /> Blow out
      </button>
    );
  } else {
    action = (
      <button className="primary warm" onClick={relight}>
        <Flame size={16} /> Light
      </button>
    );
  }

  return (
    <div className="hud">
      <header className="top">
        <div className="brand">
          <h1>Pillar Candle</h1>
          <p>7 × 12 cm · unscented soy wax</p>
        </div>
        <dl className="stats">
          <div>
            <dt>Burned</dt>
            <dd>{formatHours(s.burnedHours)}</dd>
          </div>
          <div>
            <dt>Wax left</dt>
            <dd>{s.waxLeft.toFixed(1)} cm</dd>
          </div>
          <div>
            <dt>Time left</dt>
            <dd>~{formatHours(s.hoursLeft)}</dd>
          </div>
          <div className="meter" aria-hidden>
            <span style={{ width: `${Math.min(100, Math.max(0, used * 100))}%` }} />
          </div>
        </dl>
      </header>

      <p className={`hint ${hint ? 'show' : ''}`}>
        Tap the flame to blow it out · Wave beside it · Drag to look around
      </p>

      {s.burnedOut && (
        <div className="toast" role="status">
          The candle burned for {formatHours(s.burnedHours)} and drowned in its own wax.
        </div>
      )}
      {micError && (
        <div className="toast" role="alert" onClick={() => setMicError(false)}>
          Microphone not available. Tap the flame instead.
        </div>
      )}

      <footer className="dock">
        <Segmented label="Time" options={SPEEDS} value={s.speed} onChange={setSpeed} />
        <Segmented label="Air" options={ROOMS} value={s.room} onChange={setRoom} />
        <div className="actions">
          <button
            className={`icon ${s.micOn ? 'live' : ''}`}
            onClick={toggleMic}
            aria-pressed={s.micOn}
            title={s.micOn ? 'Stop listening' : 'Blow into your mic to put it out'}
            style={s.micOn ? ({ '--level': Math.min(1, s.micLevel * 6) } as React.CSSProperties) : undefined}
          >
            {s.micOn ? <Mic size={18} /> : <MicOff size={18} />}
            <span className="sr">{s.micOn ? 'Microphone on' : 'Use microphone'}</span>
          </button>
          {action}
        </div>
      </footer>
    </div>
  );
}
