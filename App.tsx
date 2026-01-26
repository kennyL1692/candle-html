import React, { useState, useEffect } from 'react';
import { Candle } from './components/Candle';
import { RefreshCcw } from 'lucide-react';

const MELT_DURATION_MS = 10000;

export default function App() {
  const [key, setKey] = useState(0);
  const [isMelting, setIsMelting] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    // Start melting automatically on mount
    setIsMelting(true);
  }, [key]);

  useEffect(() => {
    if (isMelting) {
      const timer = setTimeout(() => {
        setIsMelting(false);
        setIsFinished(true);
      }, MELT_DURATION_MS);
      return () => clearTimeout(timer);
    }
  }, [isMelting]);

  const handleRestart = () => {
    setIsMelting(false);
    setIsFinished(false);
    setKey(prev => prev + 1);
  };

  return (
    <div className="relative w-full h-screen bg-[#0a0a0f] flex flex-col items-center justify-center overflow-hidden">
      
      {/* Ambient Room Light */}
      <div 
        className={`absolute inset-0 pointer-events-none transition-opacity duration-[2000ms] ${isFinished ? 'opacity-0' : 'opacity-20'}`}
        style={{
          background: 'radial-gradient(circle at 50% 60%, #ff8800 0%, transparent 60%)'
        }}
      />

      <div className="z-10 flex flex-col items-center gap-8">
        <div className="relative h-[400px] flex items-end justify-center">
          <Candle 
            isMelting={isMelting} 
            durationMs={MELT_DURATION_MS} 
            isFinished={isFinished}
          />
        </div>

        <div className="h-12 flex items-center justify-center">
           {isFinished && (
             <button 
                onClick={handleRestart}
                className="flex items-center gap-2 px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-full transition-all duration-300 border border-slate-700 shadow-lg animate-fade-in"
             >
               <RefreshCcw size={16} />
               <span>Relight Candle</span>
             </button>
           )}
        </div>
      </div>
      
      <div className="absolute top-4 left-4 text-slate-600 text-sm">
        <p>Simulation Time: 10s</p>
      </div>

    </div>
  );
}