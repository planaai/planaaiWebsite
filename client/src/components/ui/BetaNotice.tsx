"use client";

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export function BetaNotice() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const isHidden = localStorage.getItem('hideBetaNotice');
    if (!isHidden) {
      setIsVisible(true);
    }
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    localStorage.setItem('hideBetaNotice', 'true');
  };

  if (!isVisible) return null;

  return (
    <div className="w-full bg-amber-50/80 backdrop-blur-sm border-b border-amber-200 px-4 py-2.5 text-[13px] text-amber-800 shadow-sm relative z-40 group">
      <div className="max-w-[1400px] mx-auto flex items-center justify-center gap-2 pr-8 relative">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 shrink-0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
        <span className="font-medium tracking-tight">
          <strong>[안내]</strong> 현재 사이트는 개발 중인 베타 버전으로, 일부 기능이 제한되거나 정보가 정확하지 않을 수 있습니다.
        </span>
        <button 
          onClick={handleClose}
          className="absolute right-0 text-amber-600/70 hover:text-amber-800 transition-colors"
          aria-label="닫기"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
