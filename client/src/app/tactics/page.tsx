'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PveList from './_components/PveList';
import PvpList from './_components/PvpList';

function TacticsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modeParam = searchParams.get('mode');
  
  // Default to pve
  const [mode, setMode] = useState<'pve' | 'pvp'>('pve');

  useEffect(() => {
    if (modeParam === 'pvp') {
      setMode('pvp');
    } else {
      setMode('pve');
    }
  }, [modeParam]);

  const handleModeChange = (newMode: 'pve' | 'pvp') => {
    setMode(newMode);
    router.push(`/tactics?mode=${newMode}`);
  };

  return (
    <div className="flex-1 w-full h-full flex flex-col overflow-hidden">
      {/* Toggle UI */}
      <div className="flex justify-center mb-4 shrink-0 pt-2">
        <div className="flex bg-slate-100 p-1 rounded-xl w-72 shadow-inner border border-gray-200">
          <button
            onClick={() => handleModeChange('pve')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
              mode === 'pve' 
                ? 'bg-white text-[var(--plana-primary-dark)] shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            PVE (총력전)
          </button>
          <button
            onClick={() => handleModeChange('pvp')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
              mode === 'pvp' 
                ? 'bg-white text-pink-500 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            PVP (전술대항전)
          </button>
        </div>
      </div>

      {/* Render Mode Component */}
      <div className="flex-1 overflow-hidden relative">
        {mode === 'pve' ? <PveList /> : <PvpList />}
      </div>
    </div>
  );
}

export default function TacticsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-8"><div className="w-8 h-8 border-4 border-slate-700 border-t-[var(--plana-primary)] rounded-full animate-spin"></div></div>}>
      <TacticsContent />
    </Suspense>
  );
}
